from typing import Optional
import json

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.conversation import Conversation, Message
from app.models.user import User
from app.api.v1.deps import get_current_user_allow_query_token
from app.services.media_storage import media_storage, MediaStorageError

router = APIRouter(prefix="/media", tags=["media"])

CONTENT_TYPES = {
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "webp": "image/webp",
    "gif": "image/gif",
}


@router.get("/images/{image_id}")
async def get_image(
    image_id: str,
    download: int = Query(0),
    current_user: User = Depends(get_current_user_allow_query_token),
    db: AsyncSession = Depends(get_db)
):
    """
    Stream one generated or uploaded image back to its owner.

    Ownership is resolved through the message that references the image, so a
    caller can never read another account's artwork by guessing an id.
    """
    if not media_storage.is_valid_image_id(image_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="图片不存在")

    # The id lives inside a JSON blob, so find candidate rows by substring and
    # confirm the exact match afterwards.
    #
    # Only the two JSON columns are searched, never messages.content. content is
    # where the markdown reference lives, but it does not carry the on-disk path —
    # user_attachments does — so a content-only hit would be a row we could locate
    # and then not serve. Searching it would also put a LIKE scan over the one
    # column that, for pre-existing rows, still holds megabytes of inline base64.
    stmt = (
        select(
            Message.id,
            Message.conversation_id,
            Message.generated_images,
            Message.user_attachments,
        )
        .where(
            Message.generated_images.contains(image_id)
            | Message.user_attachments.contains(image_id),
        )
    )
    rows = (await db.execute(stmt)).all()

    owner_id: Optional[str] = None
    rel_path: Optional[str] = None
    ext: Optional[str] = None

    for msg_id, conversation_id, generated, uploads in rows:
        for blob in (generated, uploads):
            if not blob:
                continue
            try:
                entries = json.loads(blob) if isinstance(blob, str) else blob
            except (TypeError, ValueError):
                continue
            if not isinstance(entries, list):
                continue
            for entry in entries:
                if not isinstance(entry, dict) or entry.get("id") != image_id:
                    continue
                rel_path = entry.get("path")
                ext = entry.get("ext")
                # owner_id comes from the same row as rel_path, so ownership can
                # never be attributed to a different conversation than the file.
                owner_id = conversation_id
                break
            if rel_path:
                break
        if rel_path:
            break

    if not rel_path or not owner_id:
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