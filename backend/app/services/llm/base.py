from abc import ABC, abstractmethod
from typing import AsyncGenerator, List, Dict, Optional


class LLMProvider(ABC):
    """Abstract base class for all LLM providers."""

    last_usage: Optional[Dict[str, int]] = None
    last_finish_reason: Optional[str] = None

    @abstractmethod
    async def chat(
        self,
        messages: List[Dict[str, str]],
        model: str,
        stream: bool = True,
        temperature: float = 0.7,
        **kwargs
    ) -> AsyncGenerator[str, None]:
        """Stream response chunks from the LLM."""
        pass

    @abstractmethod
    async def complete(
        self,
        messages: List[Dict[str, str]],
        model: str,
        temperature: float = 0.7,
        **kwargs
    ) -> str:
        """Non-streaming one-off completion."""
        pass

