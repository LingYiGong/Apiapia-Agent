import logging
import re
import urllib.parse
from html import unescape
from typing import List, Dict, Any, Optional
import httpx

logger = logging.getLogger("web_search")


class WebSearchService:
    """
    High-availability, zero-configuration web search service.
    Primary: DuckDuckGo HTML & API (100% free, no key required).
    Fallback/Enhancement: duckduckgo_search library and Tavily API if configured.
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

    async def search(self, query: str, max_results: int = 5) -> List[Dict[str, str]]:
        """
        Execute web search with multi-tier fallback.
        Returns a list of dicts: [{'title': '...', 'url': '...', 'snippet': '...'}]
        """
        clean_q = query.strip()
        if not clean_q:
            return []

        logger.info("Executing web search for query: '%s' (max_results=%d)", clean_q, max_results)

        # 1. Try DuckDuckGo via duckduckgo_search library if available
        try:
            from duckduckgo_search import DDGS
            results = []
            with DDGS() as ddgs:
                ddg_gen = ddgs.text(clean_q, max_results=max_results)
                for item in ddg_gen:
                    results.append({
                        "title": item.get("title", ""),
                        "url": item.get("href") or item.get("url", ""),
                        "snippet": item.get("body") or item.get("snippet", "")
                    })
            if results:
                logger.info("DuckDuckGo library search succeeded: %d items", len(results))
                return results[:max_results]
        except Exception as e:
            logger.debug("duckduckgo_search library failed or not installed: %s. Using HTTP fallback.", str(e))

        # 2. Try DuckDuckGo HTML direct HTTP scraping (zero external dependencies)
        try:
            html_results = await self._search_duckduckgo_html(clean_q, max_results=max_results)
            if html_results:
                logger.info("DuckDuckGo HTML scraping succeeded: %d items", len(html_results))
                return html_results[:max_results]
        except Exception as e:
            logger.warning("DuckDuckGo HTML scraping failed: %s", str(e))

        # 3. Try DuckDuckGo Lite endpoint
        try:
            lite_results = await self._search_duckduckgo_lite(clean_q, max_results=max_results)
            if lite_results:
                logger.info("DuckDuckGo Lite search succeeded: %d items", len(lite_results))
                return lite_results[:max_results]
        except Exception as e:
            logger.warning("DuckDuckGo Lite search failed: %s", str(e))

        # 4. Try DuckDuckGo Instant Answer API as final fallback
        try:
            api_results = await self._search_duckduckgo_api(clean_q)
            if api_results:
                logger.info("DuckDuckGo Instant Answer API succeeded: %d items", len(api_results))
                return api_results[:max_results]
        except Exception as e:
            logger.warning("DuckDuckGo Instant Answer API failed: %s", str(e))

        logger.warning("All web search attempts returned empty for query '%s'", clean_q)
        return []

    async def _search_duckduckgo_html(self, query: str, max_results: int = 5) -> List[Dict[str, str]]:
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

    async def _search_duckduckgo_lite(self, query: str, max_results: int = 5) -> List[Dict[str, str]]:
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

    async def _search_duckduckgo_api(self, query: str) -> List[Dict[str, str]]:
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
                    if len(results) >= 4:
                        break
            return results


web_search_service = WebSearchService()
