"""
Generated image storage.

Images are written to disk as their original bytes: never re-encoded, never
resized. The database keeps only a small metadata record ({id, ext, prompt,
provider, model, bytes}), which keeps the messages table lean and lets the UI
lazy-load artwork instead of shipping megabytes inside the message list.

Filenames are derived from a server-generated uuid, and every path is validated
against the storage root before it is read or written, so a tampered database
row cannot be used to reach arbitrary files.
"""
import base64
import binascii
import logging
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional, Tuple
from urllib.parse import unquote_to_bytes

from app.core.net import (
    ContentTooLargeError,
    UnsafeURLError,
    fetch_public_bytes,
)
from app.core.config import settings

logger = logging.getLogger("media_storage")

IMAGE_ID_RE = re.compile(r"^[0-9a-f]{32}$")
VIDEO_ID_RE = re.compile(r"^[0-9a-f]{32}$")
EXT_RE = re.compile(r"^(png|jpe?g|webp|gif)$")
VIDEO_EXT_RE = re.compile(r"^(mp4|webm|mov|mkv)$")

# Only used to infer the extension when the payload carries no media type.
MAGIC_SIGNATURES: Tuple[Tuple[bytes, str], ...] = (
    (b"\x89PNG\r\n\x1a\n", "png"),
    (b"\xff\xd8\xff", "jpg"),
    (b"GIF87a", "gif"),
    (b"GIF89a", "gif"),
)

REMOTE_FETCH_TIMEOUT_SECONDS = 60.0
REMOTE_FETCH_MAX_BYTES = 32 * 1024 * 1024
REMOTE_VIDEO_FETCH_MAX_BYTES = 200 * 1024 * 1024
REMOTE_VIDEO_FETCH_TIMEOUT_SECONDS = 180.0


class MediaStorageError(RuntimeError):
    pass


class MediaStorage:
    def __init__(self, root: Optional[str] = None):
        self.root = Path(root or settings.MEDIA_DIR)

    # ── path handling ──────────────────────────────────────────────
    @staticmethod
    def new_image_id() -> str:
        return uuid.uuid4().hex

    @staticmethod
    def new_video_id() -> str:
        return uuid.uuid4().hex

    @staticmethod
    def is_valid_image_id(image_id: str) -> bool:
        return bool(image_id and IMAGE_ID_RE.match(image_id))

    @staticmethod
    def is_valid_video_id(video_id: str) -> bool:
        return bool(video_id and VIDEO_ID_RE.match(video_id))

    def relative_path(self, image_id: str, ext: str) -> str:
        """Year/month sharding keeps directories small over long lifetimes."""
        if not self.is_valid_image_id(image_id):
            raise MediaStorageError("非法的图片 ID")
        ext = (ext or "png").lower()
        if not EXT_RE.match(ext):
            raise MediaStorageError(f"不支持的图片格式: {ext}")
        now = datetime.now(timezone.utc)
        return f"images/{now:%Y}/{now:%m}/{image_id}.{ext}"

    def relative_video_path(self, video_id: str, ext: str) -> str:
        """Year/month sharding for generated video files."""
        if not self.is_valid_video_id(video_id):
            raise MediaStorageError("非法的视频 ID")
        ext = (ext or "mp4").lower()
        if not VIDEO_EXT_RE.match(ext):
            raise MediaStorageError(f"不支持的视频格式: {ext}")
        now = datetime.now(timezone.utc)
        return f"videos/{now:%Y}/{now:%m}/{video_id}.{ext}"

    def resolve(self, relative_path: str) -> Path:
        """Resolve a stored relative path, refusing anything outside the root."""
        if not relative_path or relative_path.startswith("/") or ".." in relative_path:
            raise MediaStorageError("非法的图片路径")
        candidate = (self.root / relative_path).resolve()
        root = self.root.resolve()
        try:
            candidate.relative_to(root)
        except ValueError:
            raise MediaStorageError("图片路径越界")
        return candidate

    # ── bytes in / bytes out ───────────────────────────────────────
    @staticmethod
    def sniff_ext(data: bytes, declared: Optional[str] = None) -> str:
        if declared:
            d = declared.lower().lstrip(".")
            if d in ("jpeg",):
                d = "jpg"
            if EXT_RE.match(d):
                return d
        if data.startswith(b"RIFF") and data[8:12] == b"WEBP":
            return "webp"
        for magic, ext in MAGIC_SIGNATURES:
            if data.startswith(magic):
                return ext
        return "png"

    async def materialize(self, url: str) -> Tuple[bytes, str]:
        """
        Turn whatever the provider returned into raw bytes.

        Providers hand back either a base64 data URI or a short-lived https URL,
        so remote results must be downloaded now in order to be kept forever.
        """
        if not url:
            raise MediaStorageError("空的图片地址")

        if url.startswith("data:"):
            header, _, payload = url.partition(",")
            if not payload:
                raise MediaStorageError("非法的 data URI")
            # Check the encoded length *before* decoding. The remote-URL branch is
            # capped while streaming; without this the inline path would be the one
            # way a provider response could still allocate without bound, since a
            # provider that answers with b64_json hands us the whole image inline.
            estimated_bytes = (len(payload) * 3) // 4
            if estimated_bytes > REMOTE_FETCH_MAX_BYTES:
                raise MediaStorageError(
                    f"图片体积超出上限: 内联数据约 {estimated_bytes} 字节，"
                    f"上限 {REMOTE_FETCH_MAX_BYTES} 字节"
                )
            if ";base64" in header:
                try:
                    data = base64.b64decode(payload, validate=False)
                except (binascii.Error, ValueError) as e:
                    raise MediaStorageError(f"base64 解码失败: {e}")
            else:
                data = unquote_to_bytes(payload)
            mime = header[5:].split(";")[0]
            return data, self.sniff_ext(data, mime)

        if url.startswith(("http://", "https://")):
            # The URL is whatever the provider handed back, so it is one hop further
            # removed from trust than a user-supplied link — but it is still a URL
            # this process is about to fetch, so it gets the same public-address
            # check and the same streaming byte cap. A provider that is MITM'd, or
            # that simply returns a link into the private network, must not be able
            # to use this server as its fetch proxy.
            try:
                fetched = await fetch_public_bytes(
                    url,
                    max_bytes=REMOTE_FETCH_MAX_BYTES,
                    timeout=REMOTE_FETCH_TIMEOUT_SECONDS,
                )
            except UnsafeURLError as e:
                raise MediaStorageError(f"拒绝抓取非公开图片地址：{e}") from e
            except ContentTooLargeError as e:
                raise MediaStorageError(f"图片体积超出上限: {e}") from e
            return fetched.data, self.sniff_ext(fetched.data, fetched.content_type)

        raise MediaStorageError("不支持的图片地址协议")

    def write(self, relative_path: str, data: bytes) -> int:
        target = self.resolve(relative_path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        return len(data)

    def delete(self, relative_path: str) -> bool:
        try:
            target = self.resolve(relative_path)
        except MediaStorageError:
            return False
        if target.is_file():
            target.unlink()
            return True
        return False


media_storage = MediaStorage()


async def store_generated_image(
    url: str,
    prompt: str,
    provider: str,
    model: str,
) -> Dict[str, Any]:
    """
    Persist one generated image and return its metadata record.

    Raises MediaStorageError on failure; callers decide whether that should
    degrade the reply or surface an error to the user.
    """
    data, ext = await media_storage.materialize(url)
    image_id = media_storage.new_image_id()
    rel = media_storage.relative_path(image_id, ext)
    size = media_storage.write(rel, data)

    logger.info("Stored generated image %s (%s, %d bytes)", image_id, ext, size)
    return {
        "id": image_id,
        "path": rel,
        "ext": ext,
        "bytes": size,
        "prompt": prompt,
        "provider": provider,
        "model": model,
    }


#: Path prefix of the authenticated media endpoint, written into messages.content
#: in place of the old inline data URL. Relative, because the media URL is built
#: per request (it needs the caller's JWT) — see the frontend's getMediaImageUrl.
MEDIA_IMAGE_PATH_PREFIX = "/api/media/images/"
MEDIA_VIDEO_PATH_PREFIX = "/api/media/videos/"


async def store_generated_video(
    data_or_url: Any,
    prompt: str,
    provider: str,
    model: str,
    ext: str = "mp4",
) -> Dict[str, Any]:
    """
    Persist one generated video (from raw bytes or remote URL) and return its metadata record.
    """
    video_id = media_storage.new_video_id()
    clean_ext = (ext or "mp4").lower().lstrip(".")
    if not clean_ext or clean_ext not in ("mp4", "webm", "mov"):
        clean_ext = "mp4"

    if isinstance(data_or_url, bytes):
        data = data_or_url
    elif isinstance(data_or_url, str) and data_or_url.startswith(("http://", "https://")):
        try:
            fetched = await fetch_public_bytes(
                data_or_url,
                max_bytes=REMOTE_VIDEO_FETCH_MAX_BYTES,
                timeout=REMOTE_VIDEO_FETCH_TIMEOUT_SECONDS,
            )
            data = fetched.data
        except Exception as e:
            raise MediaStorageError(f"抓取视频文件失败: {e}") from e
    else:
        raise MediaStorageError("未知的视频数据源")

    rel = media_storage.relative_video_path(video_id, clean_ext)
    size = media_storage.write(rel, data)
    logger.info("Stored generated video %s (%s, %d bytes)", video_id, clean_ext, size)
    return {
        "id": video_id,
        "path": rel,
        "ext": clean_ext,
        "bytes": size,
        "prompt": prompt,
        "provider": provider,
        "model": model,
    }


def store_uploaded_image(
    data_url: str,
    name: str,
) -> Optional[Dict[str, Any]]:
    """Persist one user-uploaded image from its inline data URL.

    Returns the same record shape as :func:`store_generated_image` plus ``name``,
    or ``None`` when the payload cannot be stored. Returning None rather than
    raising is deliberate: the caller's fallback is to keep the original inline
    markdown, so a storage hiccup degrades to "bigger row" rather than to a lost
    attachment the user can no longer see.

    The bytes are the user's own upload, so no network fetch is involved and
    :func:`materialize`'s remote guards do not apply — but the size ceiling does,
    since it is the same unbounded-allocation hazard.
    """
    if not data_url or not data_url.startswith("data:"):
        return None

    header, _, payload = data_url.partition(",")
    if not payload:
        logger.warning("Refusing to store attachment %s: malformed data URL", name)
        return None

    estimated_bytes = (len(payload) * 3) // 4
    if estimated_bytes > REMOTE_FETCH_MAX_BYTES:
        logger.warning(
            "Refusing to store attachment %s: ~%d bytes exceeds %d",
            name, estimated_bytes, REMOTE_FETCH_MAX_BYTES,
        )
        return None

    if ";base64" in header:
        try:
            data = base64.b64decode(payload, validate=False)
        except (binascii.Error, ValueError) as e:
            logger.warning("Failed to decode attachment %s: %s", name, e)
            return None
    else:
        data = unquote_to_bytes(payload)

    if not data:
        return None

    ext = media_storage.sniff_ext(data, header[5:].split(";")[0])
    try:
        image_id = media_storage.new_image_id()
        rel = media_storage.relative_path(image_id, ext)
        size = media_storage.write(rel, data)
    except (MediaStorageError, OSError) as e:
        logger.warning("Failed to persist attachment %s: %s", name, e)
        return None

    logger.info("Stored uploaded image %s (%s, %d bytes) as %s", name, ext, size, image_id)
    return {
        "id": image_id,
        "path": rel,
        "ext": ext,
        "bytes": size,
        "name": name,
    }