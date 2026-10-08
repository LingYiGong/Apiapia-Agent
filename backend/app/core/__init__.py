"""This module is intentionally empty.

It used to re-export settings, Base, engine, get_db, init_db and the security
helpers. Nothing in the codebase imported from the package — every caller used
``from app.core.config import settings`` or ``from app.core.database import get_db``
— and the eager imports meant merely touching ``app.core.*`` pulled in the engine
factory, the settings object and the JWT/Fernet helpers whether or not the caller
needed them.

Import submodules directly instead.
"""