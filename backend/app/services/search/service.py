import logging
import re
import urllib.parse
from dataclasses import dataclass
from html import unescape
from typing import List, Dict, Any, Optional
import httpx
from app.core.config import settings

logger = logging.getLogger("web_search")

#: Tavily's synthesized answer is injected straight into the system prompt, so it
#: is capped to keep the prompt from ballooning on verbose answers.
MAX_ANSWER_CHARS = 2000


@dataclass(frozen=True)
class WebSearchOutcome:
    """The outcome of one completed search.

    ``results`` is the ranked source list shared by every tier. ``answer`` is an
    optional model-written synthesis that only Tavily produces (``include_answer``,
    which Tavily bills separately). It is a *hint*, not a citation: it can be wrong
    or stale, so callers must present it to the LLM as something to cross-check
    against ``results`` rather than as ground truth.

    ``provider`` names the tier that actually answered, so callers can tell a
    Tavily answer apart from a DuckDuckGo result list that happens to be non-empty.
    """

    results: List[Dict[str, str]]
    answer: Optional[str] = None
    provider: str = "duckduckgo"


class WebSearchService:
    """
    High-availability web search service.
    Primary: Tavily AI-native search when TAVILY_API_KEY is configured.
    Fallback: DuckDuckGo over plain HTTP — html endpoint, lite endpoint, then the
    Instant Answer API. Zero third-party dependencies.
    """

    def __init__(self):
        self.headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7",
        }

    def is_tavily_configured(self) -> bool:
        """Check if Tavily API key is available (same pattern as MemoryService.is_configured)."""
        return bool(settings.TAVILY_API_KEY and settings.TAVILY_API_KEY.strip())

    async def search(
        self,
        query: str,
        max_results: int = 10,
        topic: str = "general",
        time_range: Optional[str] = None
    ) -> WebSearchOutcome:
        """
        Execute web search with multi-tier fallback.
        topic/time_range follow Tavily official enums and are only sent to Tavily;
        DuckDuckGo fallback tiers ignore them.
        Returns a WebSearchOutcome whose ``results`` is a list of dicts:
        [{'title': '...', 'url': '...', 'snippet': '...'}]
        """
        clean_q = query.strip()
        if not clean_q:
            return WebSearchOutcome([])

        if topic not in ("general", "news", "finance"):
            topic = "general"
        if time_range not in ("day", "week", "month", "year", None):
            time_range = None

        logger.info(
            "Executing web search for query: '%s' (max_results=%d, topic=%s, time_range=%s)",
            clean_q, max_results, topic, time_range
        )

        # 1. Try Tavily AI-native search when API key is configured
        if self.is_tavily_configured():
            try:
                tavily_outcome = await self._search_tavily(
                    clean_q, max_results=max_results, topic=topic, time_range=time_range
                )
                if tavily_outcome.results:
                    logger.info(
                        "Tavily search succeeded: %d items (answer=%s)",
                        len(tavily_outcome.results), "yes" if tavily_outcome.answer else "no",
                    )
                    return WebSearchOutcome(
                        tavily_outcome.results[:max_results], tavily_outcome.answer, "tavily"
                    )
                logger.warning("Tavily returned empty, falling back to DuckDuckGo.")
            except Exception as e:
                logger.warning("Tavily search failed: %s. Falling back to DuckDuckGo.", str(e))

        # 2-4. DuckDuckGo over plain HTTP.
        #
        # These run in sequence, so every tier's timeout is added to the user's
        # wait for a first token when the ones above it fail. Timeouts are
        # deliberately tight (8s, 8s, 6s) for that reason: a stale answer is
        # worth less than no answer. When Tavily is configured it normally answers
        # first and none of this runs.
        tiers = (
            ("html", self._search_duckduckgo_html),
            ("lite", self._search_duckduckgo_lite),
            ("instant-answer", self._search_duckduckgo_api),
        )
        for label, tier in tiers:
            try:
                results = await tier(clean_q, max_results=max_results)
                if results:
                    logger.info("DuckDuckGo %s tier succeeded: %d items", label, len(results))
                    return WebSearchOutcome(results[:max_results])
            except Exception as e:
                logger.warning("DuckDuckGo %s tier failed: %s", label, e)

        logger.warning("All web search attempts returned empty for query '%s'", clean_q)
        return WebSearchOutcome([], provider="none")

    async def _search_tavily(
        self,
        query: str,
        max_results: int = 5,
        topic: str = "general",
        time_range: Optional[str] = None
    ) -> WebSearchOutcome:
        """Tavily AI-native search: relevance-scored results optimized for RAG/LLM.

        When TAVILY_INCLUDE_ANSWER is on, Tavily additionally returns a
        model-written ``answer`` synthesis. It is billed as a separate item by
        Tavily, so it is only requested because callers actually consume it now
        (see WebSearchOutcome.answer).
        """
        api_key = (settings.TAVILY_API_KEY or "").strip()
        if not api_key:
            return WebSearchOutcome([], provider="tavily")

        payload: Dict[str, Any] = {
            "api_key": api_key,
            "query": query,
            "search_depth": settings.TAVILY_SEARCH_DEPTH or "advanced",
            "topic": topic,
            "max_results": max(1, min(max_results, 20)),
            "include_answer": bool(settings.TAVILY_INCLUDE_ANSWER),
            "include_images": False,
        }
        if time_range:
            payload["time_range"] = time_range
        async with httpx.AsyncClient(timeout=12.0) as client:
            resp = await client.post("https://api.tavily.com/search", json=payload)
            if resp.status_code in (401, 403):
                logger.warning("Tavily auth failed (HTTP %d): check TAVILY_API_KEY", resp.status_code)
                return WebSearchOutcome([], provider="tavily")
            if resp.status_code == 429:
                logger.warning("Tavily rate limited (HTTP 429), falling back.")
                return WebSearchOutcome([], provider="tavily")
            if resp.status_code != 200:
                logger.warning("Tavily returned HTTP %d: %s", resp.status_code, resp.text[:300])
                return WebSearchOutcome([], provider="tavily")
            data = resp.json()

        # Tavily returns a JSON string here, not a list. Treat anything else as absent.
        raw_answer = data.get("answer")
        answer = raw_answer.strip() if isinstance(raw_answer, str) else ""
        if not answer:
            if settings.TAVILY_INCLUDE_ANSWER:
                # include_answer was requested and billed for, but came back empty.
                # Worth a warning: it usually means the plan does not cover it.
                logger.warning("Tavily returned no 'answer' for query '%.60s'", query)
            answer = None
        elif len(answer) > MAX_ANSWER_CHARS:
            answer = answer[:MAX_ANSWER_CHARS].rstrip() + "..."

        results: List[Dict[str, str]] = []
        for item in data.get("results", []) or []:
            title = (item.get("title") or "").strip()
            url = (item.get("url") or "").strip()
            snippet = (item.get("content") or item.get("snippet") or "").strip()
            if url and title:
                # Keep prompt compact (same "..." truncation style as _search_duckduckgo_api)
                if len(snippet) > 800:
                    snippet = snippet[:800].rstrip() + "..."
                results.append({"title": title, "url": url, "snippet": snippet})
                if len(results) >= max_results:
                    break
        return WebSearchOutcome(results, answer, "tavily")

    async def _search_duckduckgo_html(self, query: str, max_results: int = 10) -> List[Dict[str, str]]:
        url = "https://html.duckduckgo.com/html/"
        data = {"q": query, "b": ""}
        async with httpx.AsyncClient(timeout=8.0, follow_redirects=True, headers=self.headers) as client:
            resp = await client.post(url, data=data)
            if resp.status_code != 200:
                logger.warning("DuckDuckGo HTML returned HTTP %d", resp.status_code)
                return []

            content = resp.text
            results = []

            # Extract result blocks using regex
            blocks = re.findall(r'<div class="result results_links[^"]*">(.*?)</div>\s*</div>', content, re.DOTALL)
            if not blocks:
                blocks = re.findall(r'<div class="[^"]*result__body[^"]*">(.*?)</div>', content, re.DOTALL)

            for block in blocks:
                # Title & Target URL
                a_match = re.search(r'<a class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)</a>', block, re.DOTALL)
                if not a_match:
                    continue
                raw_href = a_match.group(1)
                raw_title = a_match.group(2)

                # Clean Title
                title = re.sub(r'<[^>]+>', '', raw_title)
                title = unescape(title).strip()

                # Clean URL (DuckDuckGo wraps actual url in /l/?uddg=...)
                clean_url = raw_href
                if "uddg=" in raw_href:
                    uddg_match = re.search(r'uddg=([^&]+)', raw_href)
                    if uddg_match:
                        clean_url = urllib.parse.unquote(uddg_match.group(1))

                # Snippet
                snippet_match = re.search(r'<a class="result__snippet"[^>]*>(.*?)</a>', block, re.DOTALL)
                snippet = ""
                if snippet_match:
                    raw_snippet = snippet_match.group(1)
                    snippet = re.sub(r'<[^>]+>', '', raw_snippet)
                    snippet = unescape(snippet).strip()

                if clean_url and title:
                    results.append({
                        "title": title,
                        "url": clean_url,
                        "snippet": snippet
                    })
                    if len(results) >= max_results:
                        break

            return results

    async def _search_duckduckgo_lite(self, query: str, max_results: int = 10) -> List[Dict[str, str]]:
        url = "https://lite.duckduckgo.com/lite/"
        data = {"q": query}
        async with httpx.AsyncClient(timeout=8.0, follow_redirects=True, headers=self.headers) as client:
            resp = await client.post(url, data=data)
            if resp.status_code != 200:
                return []

            content = resp.text
            results = []

            links = re.findall(r'<a class="result-link" href="([^"]+)">(.*?)</a>', content, re.DOTALL)
            snippets = re.findall(r'<td class="result-snippet">(.*?)</td>', content, re.DOTALL)

            for i in range(min(len(links), len(snippets), max_results)):
                raw_href, raw_title = links[i]
                title = unescape(re.sub(r'<[^>]+>', '', raw_title)).strip()
                snippet = unescape(re.sub(r'<[^>]+>', '', snippets[i])).strip()

                clean_url = raw_href
                if "uddg=" in raw_href:
                    uddg_match = re.search(r'uddg=([^&]+)', raw_href)
                    if uddg_match:
                        clean_url = urllib.parse.unquote(uddg_match.group(1))

                if clean_url and title:
                    results.append({
                        "title": title,
                        "url": clean_url,
                        "snippet": snippet
                    })

            return results

    async def _search_duckduckgo_api(self, query: str, max_results: int = 10) -> List[Dict[str, str]]:
        """Instant Answer API — the last-resort tier.

        Returns at most a handful of encyclopaedic entries, never a ranked web
        result list, so it is only useful when the two scraping tiers were blocked.
        ``max_results`` was ignored and the cap hardcoded at 4; now it is honoured
        so all three fallback tiers share one signature and one call shape.
        """
        url = "https://api.duckduckgo.com/"
        params = {"q": query, "format": "json", "no_html": "1", "skip_disambig": "1"}
        async with httpx.AsyncClient(timeout=6.0, headers=self.headers) as client:
            resp = await client.get(url, params=params)
            if resp.status_code != 200:
                return []
            data = resp.json()
            results = []
            if data.get("AbstractText") and data.get("AbstractURL"):
                results.append({
                    "title": data.get("Heading") or query,
                    "url": data.get("AbstractURL"),
                    "snippet": data.get("AbstractText")
                })
            for topic in data.get("RelatedTopics", []):
                if isinstance(topic, dict) and topic.get("Text") and topic.get("FirstURL"):
                    results.append({
                        "title": topic.get("Text")[:50] + "...",
                        "url": topic.get("FirstURL"),
                        "snippet": topic.get("Text")
                    })
                    if len(results) >= max_results:
                        break
            return results


web_search_service = WebSearchService()
