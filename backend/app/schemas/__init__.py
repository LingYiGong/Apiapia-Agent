"""This module is intentionally empty.

It used to re-export every schema. No module imported from the package — all of
them reach for the specific file (``from app.schemas.chat import ChatRequest``) —
so the barrel added an import path that could go stale silently: adding a schema
to ``__all__`` suggested it was reachable from here, while editing a schema left
a name here that no longer existed.

Import submodules directly instead.
"""