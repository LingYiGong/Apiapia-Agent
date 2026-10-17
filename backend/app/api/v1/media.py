from typing import Optional, List, Dict, Any
import json

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.conversation import Conversation, Message
from app.models.user import User
from app.api.v1.deps import get_current_user_allow_query_token
from app.services.media_storage import media_storage, MediaStorageError
from app.core.errors import ApiError

router = APIRouter(prefix="/media", tags=["media"])

CONTENT_TYPES = {
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "webp": "image/webp",
    "gif": "image/gif",
    "mp4": "video/mp4",
    "webm": "video/webm",
    "mov": "video/quicktime",
}


async def _stream_media_file(
    db: AsyncSession,
    current_user: User,
    media_id: str,
    media_columns: List[Any],
    not_found_or_deleted_code: str,
    forbidden_code: str,
    file_missing_code: str,
    default_mime: str,
    default_ext: str,
    download: bool,
    extra_headers: Optional[Dict[str, str]] = None,
) -> FileResponse:
    """Stream a stored media attachment back to its owner after verifying ownership."""
    conditions = [col.contains(media_id) for col in media_columns]
    stmt = (
        select(Message.id, Message.conversation_id, *media_columns)
        .where(or_(*conditions))
    )
    rows = (await db.execute(stmt)).all()

    owner_id: Optional[str] = None
    rel_path: Optional[str] = None
    ext: Optional[str] = None

    for row in rows:
        conversation_id = row[1]
        blobs = row[2:]
        for blob in blobs:
            if not blob:
                continue
            try:
                entries = json.loads(blob) if isinstance(blob, str) else blob
            except (TypeError, ValueError):
                continue
            if not isinstance(entries, list):
                continue
            for entry in entries:
                if not isinstance(entry, dict) or entry.get("id") != media_id:
                    continue
                rel_path = entry.get("path")
                ext = entry.get("ext")
                owner_id = conversation_id
                break
            if rel_path:
                break
        if rel_path:
            break

    if not rel_path or not owner_id:
        raise ApiError(status.HTTP_404_NOT_FOUND, not_found_or_deleted_code)

    conv_stmt = select(Conversation.user_id).where(Conversation.id == owner_id)
    conversation_owner = (await db.execute(conv_stmt)).scalar_one_or_none()

    is_owner = conversation_owner == current_user.id
    if not (is_owner or getattr(current_user, "is_superuser", False)):
        raise ApiError(status.HTTP_403_FORBIDDEN, forbidden_code)

    try:
        absolute = media_storage.resolve(rel_path)
    except MediaStorageError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

    if not absolute.is_file():
        raise ApiError(status.HTTP_404_NOT_FOUND, file_missing_code)

    media_type = CONTENT_TYPES.get((ext or absolute.suffix.lstrip(".")).lower(), default_mime)
    headers = {
        "Cache-Control": "private, max-age=31536000, immutable",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
    }
    if extra_headers:
        headers.update(extra_headers)

    if download:
        filename = f"apiapia-{media_id}.{(ext or default_ext).lower()}"
        headers["Content-Disposition"] = f'attachment; filename="{filename}"'

    return FileResponse(absolute, media_type=media_type, headers=headers)


@router.get("/images/{image_id}")
async def get_image(
    image_id: str,
    download: int = Query(0),
    current_user: User = Depends(get_current_user_allow_query_token),
    db: AsyncSession = Depends(get_db)
):
    """
    Stream one generated or uploaded image back to its owner.
    """
    if not media_storage.is_valid_image_id(image_id):
        raise ApiError(status.HTTP_404_NOT_FOUND, "IMAGE_NOT_FOUND")

    return await _stream_media_file(
        db=db,
        current_user=current_user,
        media_id=image_id,
        media_columns=[Message.generated_images, Message.user_attachments],
        not_found_or_deleted_code="IMAGE_NOT_FOUND_OR_DELETED",
        forbidden_code="IMAGE_FORBIDDEN",
        file_missing_code="IMAGE_FILE_MISSING",
        default_mime="application/octet-stream",
        default_ext="png",
        download=bool(download),
    )


@router.get("/videos/{video_id}")
async def get_video(
    video_id: str,
    download: int = Query(0),
    current_user: User = Depends(get_current_user_allow_query_token),
    db: AsyncSession = Depends(get_db)
):
    """
    Stream one generated video back to its owner.
    """
    if not media_storage.is_valid_video_id(video_id):
        raise ApiError(status.HTTP_404_NOT_FOUND, "VIDEO_NOT_FOUND")

    return await _stream_media_file(
        db=db,
        current_user=current_user,
        media_id=video_id,
        media_columns=[Message.generated_videos],
        not_found_or_deleted_code="VIDEO_NOT_FOUND_OR_DELETED",
        forbidden_code="VIDEO_FORBIDDEN",
        file_missing_code="VIDEO_FILE_MISSING",
        default_mime="video/mp4",
        default_ext="mp4",
        download=bool(download),
        extra_headers={"Accept-Ranges": "bytes"},
    )