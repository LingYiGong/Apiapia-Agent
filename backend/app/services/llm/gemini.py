import json
import httpx
from typing import AsyncGenerator, List, Dict, Any, Optional
from app.services.llm.base import LLMProvider
from app.core.config import settings


class GeminiProvider(LLMProvider):
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.GEMINI_API_KEY
        if not self.api_key:
            raise ValueError("Gemini API Key is not configured. Please set it in Settings or .env.")
        self.base_url = "https://generativelanguage.googleapis.com/v1beta"

    def _convert_messages(self, messages: List[Dict[str, Any]]):
        system_instruction = None
        contents = []

        for msg in messages:
            role = msg.get("role")
            raw_content = msg.get("content", "")
            if role == "system":
                system_instruction = {"parts": [{"text": str(raw_content)}]}
            elif role == "user":
                if isinstance(raw_content, list):
                    parts = []
                    for item in raw_content:
                        if item.get("type") == "text":
                            parts.append({"text": item.get("text", "")})
                        elif item.get("type") == "image_url":
                            url = item.get("image_url", {}).get("url", "")
                            if "data:" in url and ";base64," in url:
                                mime, b64 = url.split(";base64,")
                                mime = mime.replace("data:", "")
                                parts.append({"inline_data": {"mime_type": mime, "data": b64}})
                    contents.append({"role": "user", "parts": parts})
                else:
                    contents.append({"role": "user", "parts": [{"text": str(raw_content)}]})
            elif role == "assistant":
                contents.append({"role": "model", "parts": [{"text": str(raw_content)}]})
        return system_instruction, contents

    async def chat(
        self,
        messages: List[Dict[str, str]],
        model: str = "gemini-1.5-flash",
        stream: bool = True,
        temperature: float = 0.7,
        **kwargs
    ) -> AsyncGenerator[str, None]:
        system_instruction, contents = self._convert_messages(messages)
        
        clean_model = model.replace("models/", "")
        url = f"{self.base_url}/models/{clean_model}:streamGenerateContent?alt=sse"
        headers = {
            "x-goog-api-key": self.api_key,
            "Content-Type": "application/json"
        }
        payload: Dict[str, Any] = {
            "contents": contents,
            "generationConfig": {
                "temperature": temperature
            }
        }
        if system_instruction:
            payload["systemInstruction"] = system_instruction

        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream("POST", url, headers=headers, json=payload) as response:
                if response.status_code != 200:
                    error_text = await response.aread()
                    raise RuntimeError(f"Gemini API error ({response.status_code}): {error_text.decode('utf-8')}")

                buffer = ""
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data_str = line[6:].strip()
                        if not data_str:
                            continue
                        try:
                            data = json.loads(data_str)
                            candidates = data.get("candidates", [])
                            if candidates:
                                parts = candidates[0].get("content", {}).get("parts", [])
                                for part in parts:
                                    if "text" in part:
                                        yield part["text"]
                        except json.JSONDecodeError:
                            continue

    async def complete(
        self,
        messages: List[Dict[str, str]],
        model: str = "gemini-1.5-flash",
        temperature: float = 0.7,
        **kwargs
    ) -> str:
        res = []
        async for chunk in self.chat(messages, model=model, stream=False, temperature=temperature, **kwargs):
            res.append(chunk)
        return "".join(res)
