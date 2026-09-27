from typing import AsyncGenerator, List, Dict, Any, Optional
from anthropic import AsyncAnthropic
from app.services.llm.base import LLMProvider
from app.core.config import settings


class AnthropicProvider(LLMProvider):
    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None):
        self.api_key = api_key or settings.ANTHROPIC_API_KEY
        self.base_url = base_url or settings.ANTHROPIC_BASE_URL
        if not self.api_key:
            raise ValueError("Anthropic API Key is not configured. Please set it in Settings or .env.")
        self.client = AsyncAnthropic(api_key=self.api_key, base_url=self.base_url)

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

    async def chat(
        self,
        messages: List[Dict[str, str]],
        model: str = "claude-3-5-sonnet-20240620",
        stream: bool = True,
        temperature: float = 0.7,
        **kwargs
    ) -> AsyncGenerator[str, None]:
        system_prompt, formatted_messages = self._prepare_messages(messages)
        
        create_kwargs: Dict[str, Any] = {
            "model": model,
            "max_tokens": kwargs.get("max_tokens", 4096),
            "messages": formatted_messages,
            "temperature": temperature
        }
        if system_prompt:
            create_kwargs["system"] = system_prompt

        if stream:
            async with self.client.messages.stream(**create_kwargs) as stream_resp:
                async for text in stream_resp.text_stream:
                    yield text
        else:
            response = await self.client.messages.create(**create_kwargs)
            yield "".join([block.text for block in response.content if hasattr(block, "text")])

    async def complete(
        self,
        messages: List[Dict[str, str]],
        model: str = "claude-3-5-sonnet-20240620",
        temperature: float = 0.7,
        **kwargs
    ) -> str:
        system_prompt, formatted_messages = self._prepare_messages(messages)
        create_kwargs: Dict[str, Any] = {
            "model": model,
            "max_tokens": kwargs.get("max_tokens", 4096),
            "messages": formatted_messages,
            "temperature": temperature
        }
        if system_prompt:
            create_kwargs["system"] = system_prompt
        response = await self.client.messages.create(**create_kwargs)
        return "".join([block.text for block in response.content if hasattr(block, "text")])
