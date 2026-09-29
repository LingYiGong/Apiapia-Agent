from typing import Optional
from openai import AsyncOpenAI
from app.services.llm.openai import OpenAIProvider
from app.core.config import settings


class OpenRouterProvider(OpenAIProvider):
    """
    OpenRouter Adapter.
    OpenRouter uses OpenAI-compatible protocol with specialized headers and model IDs
    (e.g., anthropic/claude-3.5-sonnet, openai/gpt-4o, meta-llama/llama-3.1-70b-instruct).
    """

    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None):
        self.api_key = api_key or settings.OPENROUTER_API_KEY or settings.OPENAI_API_KEY
        self.base_url = (base_url or settings.OPENROUTER_BASE_URL).rstrip("/")
        if not self.api_key:
            raise ValueError("OpenRouter API Key is not configured. Please set it in Settings or .env.")

        # OpenRouter recommends HTTP-Referer and X-Title headers for ranking/stats
        default_headers = {
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "Apiapia 助理",
        }

        self.client = AsyncOpenAI(
            api_key=self.api_key,
            base_url=self.base_url,
            default_headers=default_headers,
        )
