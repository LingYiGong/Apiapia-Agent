from typing import AsyncGenerator, List, Dict, Any, Optional
from openai import AsyncOpenAI
from app.services.llm.base import LLMProvider
from app.core.config import settings


class OpenAIProvider(LLMProvider):
    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None):
        self.api_key = api_key or settings.OPENAI_API_KEY
        self.base_url = base_url or settings.OPENAI_BASE_URL
        if not self.api_key:
            raise ValueError("OpenAI API Key is not configured. Please set it in Settings or .env.")
        self.client = AsyncOpenAI(api_key=self.api_key, base_url=self.base_url)
        self.last_usage: Optional[Dict[str, int]] = None

    @staticmethod
    def _text_part(value: Any) -> str:
        """Normalize string or OpenAI content-part arrays to displayable text."""
        if isinstance(value, str):
            return value
        if isinstance(value, list):
            parts = []
            for part in value:
                if isinstance(part, str):
                    parts.append(part)
                elif isinstance(part, dict):
                    text = part.get("text") or part.get("content")
                    if isinstance(text, str):
                        parts.append(text)
            return "".join(parts)
        return ""

    async def chat(
        self,
        messages: List[Dict[str, str]],
        model: str = "gpt-4o-mini",
        stream: bool = True,
        temperature: float = 0.7,
        **kwargs
    ) -> AsyncGenerator[str, None]:
        # Adapt messages for o1 / o3 reasoning models (they prefer 'developer' role instead of 'system')
        model_lower = model.lower()
        is_reasoning_model = any(k in model_lower for k in ["o1", "o3", "o3-mini", "r1"])

        prepared_messages = []
        for msg in messages:
            role = msg.get("role")
            if is_reasoning_model and role == "system" and "o1" in model_lower:
                prepared_messages.append({**msg, "role": "developer"})
            else:
                prepared_messages.append(msg)

        create_kwargs = {
            "model": model,
            "messages": prepared_messages,
            "stream": stream,
            **kwargs
        }

        # OpenAI o1/o3 models do not accept standard 'temperature', and instead accept reasoning_effort
        if not is_reasoning_model:
            create_kwargs["temperature"] = temperature
        else:
            if "reasoning_effort" in kwargs and kwargs["reasoning_effort"]:
                create_kwargs["reasoning_effort"] = kwargs["reasoning_effort"]

        if stream:
            create_kwargs["stream_options"] = {"include_usage": True}

        self.last_usage = None
        self.last_finish_reason = None
        self.last_model = None
        try:
            response = await self.client.chat.completions.create(**create_kwargs)
        except Exception:
            create_kwargs.pop("stream_options", None)
            response = await self.client.chat.completions.create(**create_kwargs)

        if stream:
            in_thinking = False
            async for chunk in response:
                if getattr(chunk, "model", None):
                    self.last_model = chunk.model
                if hasattr(chunk, "usage") and chunk.usage:
                    self.last_usage = {
                        "prompt_tokens": getattr(chunk.usage, "prompt_tokens", 0) or 0,
                        "completion_tokens": getattr(chunk.usage, "completion_tokens", 0) or 0,
                        "total_tokens": getattr(chunk.usage, "total_tokens", 0) or 0,
                    }
                if chunk.choices:
                    choice = chunk.choices[0]
                    if getattr(choice, "finish_reason", None):
                        self.last_finish_reason = choice.finish_reason

                    delta = choice.delta
                    # Capture reasoning tokens (DeepSeek R1, o1, o3, OpenRouter)
                    reasoning = getattr(delta, "reasoning_content", None) or getattr(delta, "reasoning", None)
                    if not reasoning and hasattr(delta, "model_extra") and isinstance(delta.model_extra, dict):
                        reasoning = delta.model_extra.get("reasoning_content") or delta.model_extra.get("reasoning")

                    reasoning_text = self._text_part(reasoning)
                    if reasoning_text:
                        if not in_thinking:
                            in_thinking = True
                            yield "<think>\n"
                        yield reasoning_text

                    content_text = self._text_part(getattr(delta, "content", None))
                    refusal_text = self._text_part(getattr(delta, "refusal", None))
                    if content_text or refusal_text:
                        if in_thinking:
                            in_thinking = False
                            yield "\n</think>\n\n"
                        yield content_text or refusal_text

                    # Capture any model tool_calls stream if emitted
                    tool_calls = getattr(delta, "tool_calls", None)
                    if tool_calls:
                        if in_thinking:
                            in_thinking = False
                            yield "\n</think>\n\n"
                        for tc in tool_calls:
                            fn = getattr(tc, "function", None)
                            if fn:
                                fn_name = getattr(fn, "name", "")
                                fn_args = getattr(fn, "arguments", "")
                                if fn_name:
                                    yield f"\n🛠️ `[工具调用: {fn_name}]`\n"
                                if fn_args:
                                    yield fn_args

            if in_thinking:
                yield "\n</think>\n\n"
        else:
            if getattr(response, "model", None):
                self.last_model = response.model
            if hasattr(response, "usage") and response.usage:
                self.last_usage = {
                    "prompt_tokens": getattr(response.usage, "prompt_tokens", 0) or 0,
                    "completion_tokens": getattr(response.usage, "completion_tokens", 0) or 0,
                    "total_tokens": getattr(response.usage, "total_tokens", 0) or 0,
                }
            if response.choices:
                self.last_finish_reason = response.choices[0].finish_reason
                content = response.choices[0].message.content or ""
            else:
                content = ""
            yield content

    async def complete(
        self,
        messages: List[Dict[str, str]],
        model: str = "gpt-4o-mini",
        temperature: float = 0.7,
        **kwargs
    ) -> str:
        response = await self.client.chat.completions.create(
            model=model,
            messages=messages,
            stream=False,
            temperature=temperature,
            **kwargs
        )
        if getattr(response, "model", None):
            self.last_model = response.model
        if response.choices:
            self.last_finish_reason = response.choices[0].finish_reason
            return response.choices[0].message.content or ""
        return ""

