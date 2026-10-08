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
        # Populated at the end of a stream. Without this the chat endpoint always
        # fell back to estimate_token_count(), whose CJK rule (1 char = 1 token)
        # overstates Claude by roughly a third, so the usage dashboard drifted.
        self.last_usage: Optional[Dict[str, int]] = None

    def _record_usage(self, usage: Any) -> None:
        """Normalise an Anthropic usage object into the chat endpoint's shape.

        Anthropic reports input/output tokens and bills on those two; cache reads
        and cache writes are already reflected in them, so no extra terms.
        """
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
        system_content = ""
        clean_messages = []
        for msg in messages:
            role = msg.get("role")
            content = msg.get("content", "")
            if role == "system":
                system_content += f"\n{str(content)}"
            elif role in ["user", "assistant"]:
                if isinstance(content, list):
                    clean_parts = []
                    for item in content:
                        if item.get("type") == "text":
                            clean_parts.append({"type": "text", "text": item.get("text", "")})
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
                    clean_messages.append({"role": role, "content": clean_parts})
                else:
                    clean_messages.append({"role": role, "content": str(content)})
        return system_content.strip(), clean_messages

    def _build_request(
        self,
        messages: List[Dict[str, Any]],
        model: str,
        temperature: float,
        kwargs: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Shape a request for the Messages API.

        Shared by chat() and complete() because the two differ only in how they
        consume the result — the payload itself must be identical, and it used to
        be assembled twice.
        """
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

        if stream:
            async with self.client.messages.stream(**create_kwargs) as stream_resp:
                async for text in stream_resp.text_stream:
                    yield text

                # Anthropic streams message_start with the input count and only
                # settles the output count at the end, so the totals are only
                # complete once the stream finishes. get_final_message() is the
                # documented way to collect them after consuming text_stream.
                #
                # Wrapped because this runs *after* every chunk was already yielded:
                # an exception here would surface as a truncated reply, which is a
                # far worse outcome than falling back to an estimate.
                try:
                    final_message = await stream_resp.get_final_message()
                    self._record_usage(getattr(final_message, "usage", None))
                except Exception as e:
                    logger.warning(
                        "Anthropic usage unavailable (falling back to estimate): %s", e
                    )
        else:
            response = await self.client.messages.create(**create_kwargs)
            self._record_usage(getattr(response, "usage", None))
            yield "".join([block.text for block in response.content if hasattr(block, "text")])

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
        return "".join([block.text for block in response.content if hasattr(block, "text")])
