"""Long-term memory subsystem (Mem0 OSS + pgvector).

Import submodules directly instead of re-exporting from here:

    from app.services.memory.service import memory_service
    from app.services.memory.retrieval import retrieve_relevant_memories

This module is intentionally empty. A previous version re-exported every public
symbol, but nothing in the codebase imported from the package (``from
app.services.memory import ...`` had zero call sites) and the eager imports
created an implicit service <- extraction <- dreaming initialisation order.
"""
