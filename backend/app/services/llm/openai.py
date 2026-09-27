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

    async def chat(
        self,
        messages: List[Dict[str, str]],
        model: str = "gpt-4o-mini",
        stream: bool = True,
        temperature: float = 0.7,
        **kwargs
    ) -> AsyncGenerator[str, None]:
        create_kwargs = {
            "model": model,
            "messages": messages,
            "stream": stream,
            "temperature": temperature,
            **kwargs
        }
        if stream:
            create_kwargs["stream_options"] = {"include_usage": True}

        self.last_usage = None
        try:
            response = await self.client.chat.completions.create(**create_kwargs)
        except Exception:
            create_kwargs.pop("stream_options", None)
            response = await self.client.chat.completions.create(**create_kwargs)

        if stream:
            in_thinking = False
            async for chunk in response:
                if hasattr(chunk, "usage") and chunk.usage:
                    self.last_usage = {
                        "prompt_tokens": getattr(chunk.usage, "prompt_tokens", 0) or 0,
                        "completion_tokens": getattr(chunk.usage, "completion_tokens", 0) or 0,
                        "total_tokens": getattr(chunk.usage, "total_tokens", 0) or 0,
                    }
                if chunk.choices:
                    delta = chunk.choices[0].delta
                    # Capture reasoning tokens (DeepSeek R1, o1, o3, OpenRouter)
                    reasoning = getattr(delta, "reasoning_content", None) or getattr(delta, "reasoning", None)
                    if not reasoning and hasattr(delta, "model_extra") and isinstance(delta.model_extra, dict):
                        reasoning = delta.model_extra.get("reasoning_content") or delta.model_extra.get("reasoning")

                    if reasoning:
                        if not in_thinking:
                            in_thinking = True
                            yield "<think>\n"
                        yield reasoning

                    if delta.content:
                        if in_thinking:
                            in_thinking = False
                            yield "\n</think>\n\n"
                        yield delta.content

            if in_thinking:
                yield "\n</think>\n\n"
        else:
            if hasattr(response, "usage") and response.usage:
                self.last_usage = {
                    "prompt_tokens": getattr(response.usage, "prompt_tokens", 0) or 0,
                    "completion_tokens": getattr(response.usage, "completion_tokens", 0) or 0,
                    "total_tokens": getattr(response.usage, "total_tokens", 0) or 0,
                }
            content = response.choices[0].message.content or ""
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
        return response.choices[0].message.content or ""
