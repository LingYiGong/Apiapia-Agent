from typing import Any, Dict, List, Optional
import json

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.conversation import Conversation, Message
from app.models.user import User
from app.services.media_storage import media_storage, MediaStorageError

router = APIRouter(prefix="/media", tags=["media"])

CONTENT_TYPES = {
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "webp": "image/webp",
    "gif": "image/gif",
}


async def get_user_for_media(
    token: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    Accept the JWT either as a Bearer header or a ``?token=`` query parameter.

    The query form is required because an ``<img src>`` request cannot carry an
    Authorization header, and the browser has to be able to lazy-load artwork.
    """
    raw_token = None
    if authorization and authorization.startswith("Bearer "):
        raw_token = authorization.split(" ", 1)[1].strip()
    elif token:
        raw_token = token.strip()

    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user_id = decode_access_token(raw_token)
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    stmt = select(User).where(User.id == user_id)
    user = (await db.execute(stmt)).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    if hasattr(user, "is_active") and not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User deactivated")
    return user


@router.get("/images/{image_id}")
async def get_image(
    image_id: str,
    download: int = Query(0),
    current_user: User = Depends(get_user_for_media),
    db: AsyncSession = Depends(get_db)
):
    """
    Stream one generated image back to its owner.

    Ownership is resolved through the message that references the image, so a
    caller can never read another account's artwork by guessing an id.
    """
    if not media_storage.is_valid_image_id(image_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="图片不存在")

    # The id lives inside a JSON blob, so find candidate rows by substring and
    # confirm the exact match afterwards.
    stmt = select(Message.id, Message.conversation_id, Message.generated_images).where(
        Message.generated_images.isnot(None),
        Message.generated_images.contains(image_id),
    )
    rows = (await db.execute(stmt)).all()

    owner_id: Optional[str] = None
    rel_path: Optional[str] = None
    ext: Optional[str] = None

    for msg_id, conversation_id, raw in rows:
        try:
            entries = json.loads(raw) if isinstance(raw, str) else raw
        except (TypeError, ValueError):
            continue
        if not isinstance(entries, list):
            continue
        for entry in entries:
            if not isinstance(entry, dict) or entry.get("id") != image_id:
                continue
            rel_path = entry.get("path")
            ext = entry.get("ext")
            owner_id = conversation_id
            break
        if rel_path:
            break

    if not rel_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="图片不存在或已删除")

    conv_stmt = select(Conversation.user_id).where(Conversation.id == owner_id)
    conversation_owner = (await db.execute(conv_stmt)).scalar_one_or_none()

    is_owner = conversation_owner == current_user.id
    if not (is_owner or getattr(current_user, "is_superuser", False)):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权访问该图片")

    try:
        absolute = media_storage.resolve(rel_path)
    except MediaStorageError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

    if not absolute.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="图片文件已丢失")

    media_type = CONTENT_TYPES.get((ext or absolute.suffix.lstrip(".")).lower(), "application/octet-stream")
    headers = {
        "Cache-Control": "private, max-age=31536000, immutable",
        # The asset URL carries a JWT, so never let it leak through Referer.
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
    }
    if download:
        filename = f"apiapia-{image_id}.{(ext or 'png').lower()}"
        headers["Content-Disposition"] = f'attachment; filename="{filename}"'

    return FileResponse(absolute, media_type=media_type, headers=headers)