import logging
from typing import AsyncGenerator, List, Dict, Any, Optional
from openai import AsyncOpenAI
from app.services.llm.base import LLMProvider
from app.core.config import settings
from app.services.catalog import is_model_multimodal

logger = logging.getLogger(__name__)


def strip_image_parts_from_messages(messages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Sanitize messages payload by replacing multimodal image_url items
    with a textual placeholder, allowing text-only models to process the
    conversation without triggering 404/400 'Filter by Image Support' errors.
    """
    sanitized = []
    for msg in messages:
        content = msg.get("content")
        if isinstance(content, list):
            text_parts = []
            for item in content:
                if isinstance(item, dict):
                    if item.get("type") == "text":
                        text_parts.append(item.get("text", ""))
                    elif item.get("type") == "image_url":
                        text_parts.append("[附图: 图片]")
                elif isinstance(item, str):
                    text_parts.append(item)
            sanitized.append({**msg, "content": "".join(text_parts).strip() or " "})
        else:
            sanitized.append(msg)
    return sanitized


def is_image_unsupported_error(err: Exception) -> bool:
    """
    Detect whether an API error was caused by submitting image/multimodal
    inputs to a text-only model or endpoint lacking image support.
    """
    err_str = str(err)
    if hasattr(err, "response") and getattr(err.response, "text", None):
        err_str += " " + err.response.text
    err_lower = err_str.lower()
    return any(
        k in err_lower
        for k in [
            "no endpoints found that support image input",
            "filter by image support",
            "support image input",
            "does not support image",
            "does not support vision",
            "image_url is not supported",
            "unsupported modality",
        ]
    )


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
        # Adapt messages for o1 / o3 / o4 reasoning models (they prefer 'developer' role instead of 'system')
        model_lower = model.lower()
        is_openai_reasoning = any(k in model_lower for k in ["o1", "o3", "o3-mini", "o4"])

        prepared_messages = []
        for msg in messages:
            role = msg.get("role")
            if is_openai_reasoning and role == "system":
                prepared_messages.append({**msg, "role": "developer"})
            else:
                prepared_messages.append(msg)

        create_kwargs = {
            "model": model,
            "messages": prepared_messages,
            "stream": stream,
            **kwargs
        }

        # OpenAI o1/o3 reasoning models reject 'max_tokens' and require 'max_completion_tokens'
        if is_openai_reasoning:
            if "max_tokens" in create_kwargs:
                mt = create_kwargs.pop("max_tokens")
                if "max_completion_tokens" not in create_kwargs and mt is not None:
                    create_kwargs["max_completion_tokens"] = mt

        # If model does not support image input, strip multimodal image_url parts proactively
        if not is_model_multimodal(model):
            create_kwargs["messages"] = strip_image_parts_from_messages(prepared_messages)


        # OpenAI o1/o3 models do not accept standard 'temperature', and instead accept reasoning_effort
        if not is_openai_reasoning:
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
        except Exception as e:
            if is_image_unsupported_error(e):
                logger.warning(
                    "Model %s failed with image support error (%s). Stripping images and retrying...",
                    model, e
                )
                create_kwargs["messages"] = strip_image_parts_from_messages(create_kwargs.get("messages", []))
                try:
                    response = await self.client.chat.completions.create(**create_kwargs)
                except Exception:
                    create_kwargs.pop("stream_options", None)
                    response = await self.client.chat.completions.create(**create_kwargs)
            else:
                create_kwargs.pop("stream_options", None)
                try:
                    response = await self.client.chat.completions.create(**create_kwargs)
                except Exception as retry_err:
                    if is_image_unsupported_error(retry_err):
                        logger.warning(
                            "Model %s failed with image support error on second try (%s). Retrying with text-only...",
                            model, retry_err
                        )
                        create_kwargs["messages"] = strip_image_parts_from_messages(create_kwargs.get("messages", []))
                        response = await self.client.chat.completions.create(**create_kwargs)
                    else:
                        raise

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
                                if fn_name:
                                    yield f"\n🛠️ `[工具调用: {fn_name}]`\n"

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
        model_lower = model.lower()
        is_openai_reasoning = any(k in model_lower for k in ["o1", "o3", "o3-mini", "o4"])
        prepared_messages = []
        for msg in messages:
            role = msg.get("role")
            if is_openai_reasoning and role == "system":
                prepared_messages.append({**msg, "role": "developer"})
            else:
                prepared_messages.append(msg)

        create_kwargs = {
            "model": model,
            "messages": prepared_messages,
            "stream": False,
            **kwargs
        }
        # OpenAI o1/o3 reasoning models reject 'max_tokens' and require 'max_completion_tokens'
        if is_openai_reasoning:
            if "max_tokens" in create_kwargs:
                mt = create_kwargs.pop("max_tokens")
                if "max_completion_tokens" not in create_kwargs and mt is not None:
                    create_kwargs["max_completion_tokens"] = mt

        # If model does not support image input, strip multimodal image_url parts proactively
        if not is_model_multimodal(model):
            create_kwargs["messages"] = strip_image_parts_from_messages(prepared_messages)


        if not is_openai_reasoning:
            create_kwargs["temperature"] = temperature
        else:
            if "reasoning_effort" in kwargs and kwargs["reasoning_effort"]:
                create_kwargs["reasoning_effort"] = kwargs["reasoning_effort"]

        try:
            response = await self.client.chat.completions.create(**create_kwargs)
        except Exception as e:
            if is_image_unsupported_error(e):
                logger.warning(
                    "Model %s failed with image support error in complete() (%s). Stripping images and retrying...",
                    model, e
                )
                create_kwargs["messages"] = strip_image_parts_from_messages(create_kwargs.get("messages", []))
                response = await self.client.chat.completions.create(**create_kwargs)
            else:
                raise
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
            msg = response.choices[0].message
            content = self._text_part(getattr(msg, "content", None))
            reasoning = getattr(msg, "reasoning_content", None) or getattr(msg, "reasoning", None)
            if not reasoning and hasattr(msg, "model_extra") and isinstance(msg.model_extra, dict):
                reasoning = msg.model_extra.get("reasoning_content") or msg.model_extra.get("reasoning")
            reasoning_text = self._text_part(reasoning)
            if reasoning_text:
                return f"<think>\n{reasoning_text}\n</think>\n\n{content}"
            return content
        return ""
