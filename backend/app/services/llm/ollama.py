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
            raise ValueError(
                "Ollama service address is not configured. Please set OLLAMA_BASE_URL in .env."
            )
        self.base_url = str(raw_base).rstrip("/")
        self.last_usage: Optional[Dict[str, int]] = None

    def _record_usage(self, data: Dict[str, Any]) -> None:
        """Capture prompt_eval_count and eval_count from an Ollama response object."""
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

    def _prepare_messages(self, messages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Normalize messages, converting OpenAI-style multimodal parts to Ollama's format."""
        clean_messages = []
        for msg in messages:
            role = msg.get("role")
            raw_content = msg.get("content", "")
            if isinstance(raw_content, list):
                text_parts = []
                images = []
                for item in raw_content:
                    if item.get("type") == "text":
                        text_parts.append(item.get("text", ""))
                    elif item.get("type") == "image_url":
                        url = item.get("image_url", {}).get("url", "")
                        if ";base64," in url:
                            images.append(url.split(";base64,", 1)[1])
                entry: Dict[str, Any] = {"role": role, "content": "".join(text_parts)}
                if images:
                    entry["images"] = images
                clean_messages.append(entry)
            else:
                clean_messages.append({"role": role, "content": str(raw_content)})
        return clean_messages

    async def chat(
        self,
        messages: List[Dict[str, str]],
        model: str = "llama3:latest",
        stream: bool = True,
        temperature: float = 0.7,
        **kwargs
    ) -> AsyncGenerator[str, None]:
        url = f"{self.base_url}/api/chat"
        formatted_messages = self._prepare_messages(messages)
        options: Dict[str, Any] = {"temperature": temperature}
        if "max_tokens" in kwargs and kwargs["max_tokens"]:
            try:
                options["num_predict"] = int(kwargs["max_tokens"])
            except (ValueError, TypeError):
                pass

        payload = {
            "model": model,
            "messages": formatted_messages,
            "stream": stream,
            "options": options
        }
        self.last_finish_reason = None
        in_thinking = False

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
                    msg_obj = data.get("message", {})
                    thinking_text = msg_obj.get("thinking", "")
                    content = msg_obj.get("content", "")

                    if thinking_text:
                        if not in_thinking:
                            in_thinking = True
                            yield "<think>\n"
                        yield thinking_text

                    if content:
                        if in_thinking:
                            in_thinking = False
                            yield "\n</think>\n\n"
                        yield content

                    if data.get("done"):
                        self.last_finish_reason = data.get("done_reason") or "stop"

                if in_thinking:
                    yield "\n</think>\n\n"

    async def complete(
        self,
        messages: List[Dict[str, str]],
        model: str = "llama3:latest",
        temperature: float = 0.7,
        **kwargs
    ) -> str:
        url = f"{self.base_url}/api/chat"
        formatted_messages = self._prepare_messages(messages)
        options: Dict[str, Any] = {"temperature": temperature}
        if "max_tokens" in kwargs and kwargs["max_tokens"]:
            try:
                options["num_predict"] = int(kwargs["max_tokens"])
            except (ValueError, TypeError):
                pass

        payload = {
            "model": model,
            "messages": formatted_messages,
            "stream": False,
            "options": options
        }
        async with httpx.AsyncClient(timeout=180.0) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            data = response.json()
            self._record_usage(data)
            if data.get("done"):
                self.last_finish_reason = data.get("done_reason") or "stop"
            return data.get("message", {}).get("content", "")

