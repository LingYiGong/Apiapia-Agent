from fastapi import Depends, HTTPException, Header, Query, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.errors import ApiError
from app.core.security import decode_access_token
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def _unauthorized() -> HTTPException:
    # Built per call rather than shared: a module-level instance would be the same
    # object for every failed request, and HTTPException carries mutable state.
    return ApiError(
        status_code=status.HTTP_401_UNAUTHORIZED,
        code="AUTH_INVALID_TOKEN",
        headers={"WWW-Authenticate": "Bearer"},
    )


def _bearer_from_header_or_query(
    authorization: str | None, token: str | None
) -> str | None:
    """Accept the JWT as a Bearer header or a ``?token=`` query parameter.

    The query form is required for the two endpoints a plain ``<img src>`` reaches:
    a browser cannot attach an Authorization header to an image request, and the
    artwork has to lazy-load.
    """
    if authorization and authorization.startswith("Bearer "):
        return authorization.split(" ", 1)[1].strip()
    if token:
        return token.strip()
    return None


async def _load_active_user(db: AsyncSession, raw_token: str | None) -> User:
    if not raw_token:
        raise _unauthorized()
    user_id = decode_access_token(raw_token)
    if not user_id:
        raise _unauthorized()

    user = (
        await db.execute(select(User).where(User.id == user_id))
    ).scalar_one_or_none()
    if not user:
        raise _unauthorized()

    if hasattr(user, "is_active") and not user.is_active:
        raise ApiError(
            status_code=status.HTTP_403_FORBIDDEN,
            code="ACCOUNT_DISABLED",
        )
    return user


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    STRICT SECURITY MANDATE:
    Authenticates token and derives user_id securely from the verified JWT payload.
    Any request parameter or body purporting to specify user_id is ignored or prohibited.
    """
    user = await _load_active_user(db, token)
    return user


async def get_current_user_allow_query_token(
    token: str | None = Query(None),
    authorization: str | None = Header(None),
    db: AsyncSession = Depends(get_db)
) -> User:
    """get_current_user, plus acceptance of ``?token=``.

    Deliberately the same checks in the same order, including the deactivated-user
    rejection — a second copy of this that skipped the is_active test would leave a
    disabled account able to read its images and export its memories.
    """
    return await _load_active_user(db, _bearer_from_header_or_query(authorization, token))


async def get_current_admin(
    current_user: User = Depends(get_current_user)
) -> User:
    """Dependency ensuring current user has superuser / admin privileges."""
    if not getattr(current_user, "is_superuser", False):
        raise ApiError(
            status_code=status.HTTP_403_FORBIDDEN,
            code="ADMIN_REQUIRED"
        )
    return current_user
