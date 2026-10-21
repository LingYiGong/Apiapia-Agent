import json
import logging
import httpx
from typing import AsyncGenerator, List, Dict, Any, Optional
from app.services.llm.base import LLMProvider
from app.core.config import settings

logger = logging.getLogger("llm_gemini")


class GeminiProvider(LLMProvider):
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.GEMINI_API_KEY
        if not self.api_key:
            raise ValueError("Gemini API Key is not configured. Please set it in Settings or .env.")
        self.base_url = "https://generativelanguage.googleapis.com/v1beta"
        # Filled from usageMetadata on whichever chunk carries the final totals.
        self.last_usage: Optional[Dict[str, int]] = None

    def _record_usage(self, data: Dict[str, Any]) -> None:
        """Capture Gemini's usageMetadata.

        Gemini includes it on every chunk, with the counts growing as the response
        goes on, so the last one seen is the settled total. It also reports
        cachedContentTokenCount, which is a subset of promptTokenCount and must
        therefore not be added on top.
        """
        usage = data.get("usageMetadata")
        if not isinstance(usage, dict):
            return
        prompt_tokens = usage.get("promptTokenCount")
        completion_tokens = usage.get("candidatesTokenCount")
        if prompt_tokens is None and completion_tokens is None:
            return
        self.last_usage = {
            "prompt_tokens": int(prompt_tokens or 0),
            "completion_tokens": int(completion_tokens or 0),
            "total_tokens": int(usage.get("totalTokenCount") or 0)
            or int(prompt_tokens or 0) + int(completion_tokens or 0),
        }

    def _convert_messages(self, messages: List[Dict[str, Any]]):
        system_instruction = None
        contents = []

        for msg in messages:
            role = msg.get("role")
            raw_content = msg.get("content", "")
            if role == "system":
                sys_text = ""
                if isinstance(raw_content, list):
                    sys_text = "".join(item.get("text", "") for item in raw_content if isinstance(item, dict) and item.get("type") == "text")
                else:
                    sys_text = str(raw_content or "")
                if sys_text.strip():
                    system_instruction = {"parts": [{"text": sys_text.strip()}]}
            elif role == "user":
                parts = []
                if isinstance(raw_content, list):
                    for item in raw_content:
                        if item.get("type") == "text":
                            t = item.get("text", "")
                            if t and t.strip():
                                parts.append({"text": t})
                        elif item.get("type") == "image_url":
                            url = item.get("image_url", {}).get("url", "")
                            if "data:" in url and ";base64," in url:
                                mime, b64 = url.split(";base64,")
                                mime = mime.replace("data:", "")
                                parts.append({"inline_data": {"mime_type": mime, "data": b64}})
                else:
                    txt = str(raw_content or "").strip()
                    if txt:
                        parts.append({"text": txt})
                if parts:
                    if contents and contents[-1]["role"] == "user":
                        contents[-1]["parts"].extend(parts)
                    else:
                        contents.append({"role": "user", "parts": parts})
            elif role == "assistant":
                txt = ""
                if isinstance(raw_content, list):
                    txt = "".join(i.get("text", "") for i in raw_content if isinstance(i, dict)).strip()
                else:
                    txt = str(raw_content or "").strip()
                if txt:
                    parts = [{"text": txt}]
                    if contents and contents[-1]["role"] == "model":
                        contents[-1]["parts"].extend(parts)
                    else:
                        contents.append({"role": "model", "parts": parts})

        # Gemini strictly requires the first turn to be 'user'
        while contents and contents[0]["role"] != "user":
            contents.pop(0)

        # Gemini strictly requires non-empty contents
        if not contents:
            contents.append({"role": "user", "parts": [{"text": "你好"}]})

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
        gen_config: Dict[str, Any] = {"temperature": temperature}
        if "max_tokens" in kwargs and kwargs["max_tokens"]:
            try:
                gen_config["maxOutputTokens"] = int(kwargs["max_tokens"])
            except (ValueError, TypeError):
                pass

        payload: Dict[str, Any] = {
            "contents": contents,
            "generationConfig": gen_config
        }
        if system_instruction:
            payload["systemInstruction"] = system_instruction

        self.last_finish_reason = None
        in_thinking = False

        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream("POST", url, headers=headers, json=payload) as response:
                if response.status_code != 200:
                    error_text = await response.aread()
                    raise RuntimeError(f"Gemini API error ({response.status_code}): {error_text.decode('utf-8', errors='replace')}")

                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data_str = line[6:].strip()
                        if not data_str:
                            continue
                        try:
                            data = json.loads(data_str)
                        except json.JSONDecodeError:
                            continue
                        self._record_usage(data)
                        candidates = data.get("candidates", [])
                        if candidates:
                            cand = candidates[0]
                            raw_reason = cand.get("finishReason")
                            if raw_reason:
                                if raw_reason in ["MAX_TOKENS", "MAX_OUTPUT_TOKENS"]:
                                    self.last_finish_reason = "length"
                                elif raw_reason in ["SAFETY", "RECITATION", "BLOCKLIST"]:
                                    self.last_finish_reason = "content_filter"
                                elif raw_reason == "STOP":
                                    self.last_finish_reason = "stop"
                                else:
                                    self.last_finish_reason = raw_reason.lower()

                            parts = cand.get("content", {}).get("parts", [])
                            for part in parts:
                                is_thought = bool(part.get("thought"))
                                txt = part.get("text", "")
                                if txt:
                                    if is_thought:
                                        if not in_thinking:
                                            in_thinking = True
                                            yield "<think>\n"
                                        yield txt
                                    else:
                                        if in_thinking:
                                            in_thinking = False
                                            yield "\n</think>\n\n"
                                        yield txt

                if in_thinking:
                    yield "\n</think>\n\n"

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

