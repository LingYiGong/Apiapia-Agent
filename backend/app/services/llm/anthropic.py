import logging
from typing import AsyncGenerator, List, Dict, Any, Optional
from anthropic import AsyncAnthropic
from app.services.llm.base import LLMProvider
from app.core.config import settings

logger = logging.getLogger("llm_anthropic")


class AnthropicProvider(LLMProvider):
    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None):
        self.api_key = api_key or settings.ANTHROPIC_API_KEY
        self.base_url = base_url or settings.ANTHROPIC_BASE_URL
        if not self.api_key:
            raise ValueError("Anthropic API Key is not configured. Please set it in Settings or .env.")
        self.client = AsyncAnthropic(api_key=self.api_key, base_url=self.base_url)
        self.last_usage: Optional[Dict[str, int]] = None

    def _record_usage(self, usage: Any) -> None:
        """Normalise an Anthropic usage object into standard dictionary format."""
        if usage is None:
            return
        prompt_tokens = getattr(usage, "input_tokens", None)
        completion_tokens = getattr(usage, "output_tokens", None)
        if prompt_tokens is None and completion_tokens is None:
            return
        self.last_usage = {
            "prompt_tokens": int(prompt_tokens or 0),
            "completion_tokens": int(completion_tokens or 0),
            "total_tokens": int(prompt_tokens or 0) + int(completion_tokens or 0),
        }

    def _prepare_messages(self, messages: List[Dict[str, Any]]):
        system_content: Any = ""
        clean_messages = []
        for msg in messages:
            role = msg.get("role")
            content = msg.get("content", "")
            if role == "system":
                if isinstance(content, list):
                    system_content = content
                elif isinstance(system_content, list):
                    system_content.append({"type": "text", "text": str(content or "")})
                else:
                    system_content = f"{system_content}\n{str(content or '')}".strip()
            elif role in ["user", "assistant"]:
                if isinstance(content, list):
                    clean_parts = []
                    for item in content:
                        if item.get("type") == "text":
                            txt = item.get("text", "") or " "
                            part = {"type": "text", "text": txt}
                            if "cache_control" in item:
                                part["cache_control"] = item["cache_control"]
                            clean_parts.append(part)
                        elif item.get("type") == "image_url":
                            url = item.get("image_url", {}).get("url", "")
                            if "data:" in url and ";base64," in url:
                                mime, b64 = url.split(";base64,")
                                mime = mime.replace("data:", "")
                                clean_parts.append({
                                    "type": "image",
                                    "source": {
                                        "type": "base64",
                                        "media_type": mime,
                                        "data": b64
                                    }
                                })
                    if clean_parts:
                        clean_messages.append({"role": role, "content": clean_parts})
                else:
                    txt = str(content) if content else " "
                    clean_messages.append({"role": role, "content": txt})

        # Anthropic requires the first message to be 'user'
        while clean_messages and clean_messages[0]["role"] == "assistant":
            clean_messages.pop(0)

        # Merge consecutive messages of the same role to strictly satisfy Anthropic role alternation
        merged_messages: List[Dict[str, Any]] = []
        for m in clean_messages:
            if not merged_messages:
                merged_messages.append(m)
                continue
            if merged_messages[-1]["role"] == m["role"]:
                prev = merged_messages[-1]
                p_c = prev["content"]
                m_c = m["content"]
                if isinstance(p_c, str) and isinstance(m_c, str):
                    prev["content"] = f"{p_c}\n\n{m_c}".strip()
                else:
                    p_parts = p_c if isinstance(p_c, list) else [{"type": "text", "text": str(p_c)}]
                    m_parts = m_c if isinstance(m_c, list) else [{"type": "text", "text": str(m_c)}]
                    prev["content"] = p_parts + m_parts
            else:
                merged_messages.append(m)

        if not merged_messages:
            merged_messages.append({"role": "user", "content": " "})

        return system_content, merged_messages

    def _build_request(
        self,
        messages: List[Dict[str, Any]],
        model: str,
        temperature: float,
        kwargs: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Shape a request for the Messages API."""
        system_prompt, formatted_messages = self._prepare_messages(messages)
        request: Dict[str, Any] = {
            "model": model,
            "max_tokens": kwargs.get("max_tokens", 4096),
            "messages": formatted_messages,
            "temperature": temperature,
        }
        if system_prompt:
            request["system"] = system_prompt
        return request

    async def chat(
        self,
        messages: List[Dict[str, str]],
        model: str = "claude-3-5-sonnet-20240620",
        stream: bool = True,
        temperature: float = 0.7,
        **kwargs
    ) -> AsyncGenerator[str, None]:
        create_kwargs = self._build_request(messages, model, temperature, kwargs)
        self.last_finish_reason = None

        if stream:
            async with self.client.messages.stream(**create_kwargs) as stream_resp:
                in_thinking = False
                async for event in stream_resp:
                    ev_type = getattr(event, "type", None)
                    if ev_type == "content_block_start":
                        cb = getattr(event, "content_block", None)
                        if cb and getattr(cb, "type", None) == "thinking":
                            if not in_thinking:
                                in_thinking = True
                                yield "<think>\n"
                    elif ev_type == "content_block_delta":
                        delta = getattr(event, "delta", None)
                        if delta:
                            d_type = getattr(delta, "type", None)
                            if d_type == "thinking_delta":
                                th = getattr(delta, "thinking", "")
                                if th:
                                    if not in_thinking:
                                        in_thinking = True
                                        yield "<think>\n"
                                    yield th
                            elif d_type == "text_delta":
                                txt = getattr(delta, "text", "")
                                if txt:
                                    if in_thinking:
                                        in_thinking = False
                                        yield "\n</think>\n\n"
                                    yield txt
                    elif ev_type == "content_block_stop":
                        if in_thinking:
                            in_thinking = False
                            yield "\n</think>\n\n"
                    elif ev_type == "message_delta":
                        delta_obj = getattr(event, "delta", None)
                        sr = getattr(delta_obj, "stop_reason", None)
                        if sr:
                            self.last_finish_reason = "length" if sr == "max_tokens" else sr

                if in_thinking:
                    yield "\n</think>\n\n"

                # Anthropic settles the total output count on get_final_message()
                try:
                    final_message = await stream_resp.get_final_message()
                    self._record_usage(getattr(final_message, "usage", None))
                    sr = getattr(final_message, "stop_reason", None)
                    if sr:
                        self.last_finish_reason = "length" if sr == "max_tokens" else sr
                except Exception as e:
                    logger.warning(
                        "Anthropic usage unavailable (falling back to estimate): %s", e
                    )
        else:
            response = await self.client.messages.create(**create_kwargs)
            self._record_usage(getattr(response, "usage", None))
            sr = getattr(response, "stop_reason", None)
            if sr:
                self.last_finish_reason = "length" if sr == "max_tokens" else sr
            parts = []
            for block in response.content:
                if getattr(block, "type", None) == "thinking" and hasattr(block, "thinking"):
                    parts.append(f"<think>\n{block.thinking}\n</think>\n\n")
                elif hasattr(block, "text"):
                    parts.append(block.text)
            yield "".join(parts)

    async def complete(
        self,
        messages: List[Dict[str, str]],
        model: str = "claude-3-5-sonnet-20240620",
        temperature: float = 0.7,
        **kwargs
    ) -> str:
        response = await self.client.messages.create(
            **self._build_request(messages, model, temperature, kwargs)
        )
        self._record_usage(getattr(response, "usage", None))
        sr = getattr(response, "stop_reason", None)
        if sr:
            self.last_finish_reason = "length" if sr == "max_tokens" else sr
        parts = []
        for block in response.content:
            if getattr(block, "type", None) == "thinking" and hasattr(block, "thinking"):
                parts.append(f"<think>\n{block.thinking}\n</think>\n\n")
            elif hasattr(block, "text"):
                parts.append(block.text)
        return "".join(parts)

