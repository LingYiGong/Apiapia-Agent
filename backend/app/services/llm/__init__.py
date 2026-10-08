"""This module is intentionally empty.

It used to re-export the provider base class, all five adapters, and the factory.
Nothing imported from the package: the chat endpoint uses
``from app.services.llm.factory import get_llm_provider``, and the factory itself
imports each adapter by module path.

The barrel also hid a real cost. It eagerly imported all five adapters, so the
Gemini and Ollama modules were loaded whenever anything touched ``llm.*`` —
including the plain ``llm.base`` import that only wants the ABC.
"""

# Import submodules directly instead:
#   from app.services.llm.base import LLMProvider
#   from app.services.llm.factory import get_llm_provider, detect_provider