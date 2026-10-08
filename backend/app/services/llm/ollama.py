import json
import logging
import httpx
from typing import AsyncGenerator, List, Dict, Any, Optional
from app.services.llm.base import LLMProvider
from app.core.config import settings

logger = logging.getLogger("llm_ollama")


class OllamaProvider(LLMProvider):
    def __init__(self, base_url: Optional[str] = None):
        raw_base = base_url or settings.OLLAMA_BASE_URL
        if not raw_base or not str(raw_base).strip():
            # Previously this reached `None.rstrip()` and raised AttributeError,
            # which surfaced to the user as an opaque 500 from inside the stream.
            raise ValueError(
                "Ollama service address is not configured. Please set OLLAMA_BASE_URL in .env."
            )
        self.base_url = str(raw_base).rstrip("/")
        # Ollama reports token counts on its final NDJSON object. Without capturing
        # them the chat endpoint fell back to estimate_token_count() and every local
        # model's usage was invented rather than measured.
        self.last_usage: Optional[Dict[str, int]] = None

    def _record_usage(self, data: Dict[str, Any]) -> None:
        """Capture prompt_eval_count / eval_count from an Ollama response object.

        Ollama keeps eval counts running in a background chunked object even after
        the message stream ends, so the counts reported when ``done`` flips are
        provisional and can rise on later objects. Keeping the highest seen avoids
        recording a total that is smaller than what was already streamed.
        """
        prompt_tokens = data.get("prompt_eval_count")
        completion_tokens = data.get("eval_count")
        if prompt_tokens is None and completion_tokens is None:
            return
        prompt_tokens = int(prompt_tokens or 0)
        completion_tokens = int(completion_tokens or 0)
        previous = self.last_usage or {"prompt_tokens": 0, "completion_tokens": 0}
        prompt_tokens = max(prompt_tokens, previous["prompt_tokens"])
        completion_tokens = max(completion_tokens, previous["completion_tokens"])
        self.last_usage = {
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": prompt_tokens + completion_tokens,
        }

    async def chat(
        self,
        messages: List[Dict[str, str]],
        model: str = "llama3:latest",
        stream: bool = True,
        temperature: float = 0.7,
        **kwargs
    ) -> AsyncGenerator[str, None]:
        url = f"{self.base_url}/api/chat"
        payload = {
            "model": model,
            "messages": messages,
            "stream": stream,
            "options": {
                "temperature": temperature
            }
        }

        async with httpx.AsyncClient(timeout=180.0) as client:
            async with client.stream("POST", url, json=payload) as response:
                if response.status_code != 200:
                    error_text = await response.aread()
                    raise RuntimeError(f"Ollama error ({response.status_code}): {error_text.decode('utf-8')}")

                async for line in response.aiter_lines():
                    if not line:
                        continue
                    try:
                        data = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    self._record_usage(data)
                    content = data.get("message", {}).get("content", "")
                    if content:
                        yield content

    async def complete(
        self,
        messages: List[Dict[str, str]],
        model: str = "llama3:latest",
        temperature: float = 0.7,
        **kwargs
    ) -> str:
        url = f"{self.base_url}/api/chat"
        payload = {
            "model": model,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": temperature
            }
        }
        async with httpx.AsyncClient(timeout=180.0) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            data = response.json()
            self._record_usage(data)
            return data.get("message", {}).get("content", "")
