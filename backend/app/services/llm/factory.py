from typing import Optional, Tuple
from app.services.llm.base import LLMProvider
from app.services.llm.openai import OpenAIProvider
from app.services.llm.anthropic import AnthropicProvider
from app.services.llm.gemini import GeminiProvider
from app.services.llm.ollama import OllamaProvider
from app.services.llm.openrouter import OpenRouterProvider
from app.core.config import settings

#: Provider names this factory can build.
SUPPORTED_PROVIDERS: Tuple[str, ...] = (
    "openai",
    "anthropic",
    "gemini",
    "ollama",
    "openrouter",
)


def detect_provider(model: str) -> str:
    """Infer provider from model name if not explicitly specified."""
    model_lower = model.lower()
    # OpenRouter standard model identifiers format: vendor/model-name
    if "/" in model_lower:
        return "openrouter"
    elif any(k in model_lower for k in ["gpt", "text-embedding", "o1", "o3"]):
        return "openai"
    elif "claude" in model_lower:
        return "anthropic"
    elif "gemini" in model_lower:
        return "gemini"
    elif any(k in model_lower for k in ["llama", "qwen", "mistral", "deepseek", "phi"]):
        return "ollama"
    return settings.DEFAULT_PROVIDER


def get_llm_provider(
    provider: Optional[str] = None,
    model: Optional[str] = None,
    api_key: Optional[str] = None,
    base_url: Optional[str] = None
) -> LLMProvider:
    """Factory to retrieve configured LLM provider instance."""
    resolved_provider = provider
    if not resolved_provider:
        if model:
            resolved_provider = detect_provider(model)
        else:
            resolved_provider = settings.DEFAULT_PROVIDER

    resolved_provider = resolved_provider.lower().strip()

    if resolved_provider == "openrouter":
        return OpenRouterProvider(api_key=api_key, base_url=base_url)
    elif resolved_provider == "anthropic":
        return AnthropicProvider(api_key=api_key, base_url=base_url)
    elif resolved_provider == "gemini":
        # GeminiProvider takes no base_url: its endpoint shape differs enough that
        # overriding it is not supported.
        return GeminiProvider(api_key=api_key)
    elif resolved_provider == "ollama":
        # Local inference, no credential — base_url is the only knob.
        return OllamaProvider(base_url=base_url)
    # "openai", and anything unrecognised, falls back to the OpenAI-compatible
    # adapter. Several gateways speak that dialect under other names.
    return OpenAIProvider(api_key=api_key, base_url=base_url)
