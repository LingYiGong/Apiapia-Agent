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

import httpx

from app.core.config import settings

logger = logging.getLogger("media_storage")

IMAGE_ID_RE = re.compile(r"^[0-9a-f]{32}$")
EXT_RE = re.compile(r"^(png|jpe?g|webp|gif)$")

# Only used to infer the extension when the payload carries no media type.
MAGIC_SIGNATURES: Tuple[Tuple[bytes, str], ...] = (
    (b"\x89PNG\r\n\x1a\n", "png"),
    (b"\xff\xd8\xff", "jpg"),
    (b"GIF87a", "gif"),
    (b"GIF89a", "gif"),
)

REMOTE_FETCH_TIMEOUT_SECONDS = 60.0
REMOTE_FETCH_MAX_BYTES = 32 * 1024 * 1024


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
    def is_valid_image_id(image_id: str) -> bool:
        return bool(image_id and IMAGE_ID_RE.match(image_id))

    def relative_path(self, image_id: str, ext: str) -> str:
        """Year/month sharding keeps directories small over long lifetimes."""
        if not self.is_valid_image_id(image_id):
            raise MediaStorageError("非法的图片 ID")
        ext = (ext or "png").lower()
        if not EXT_RE.match(ext):
            raise MediaStorageError(f"不支持的图片格式: {ext}")
        now = datetime.now(timezone.utc)
        return f"images/{now:%Y}/{now:%m}/{image_id}.{ext}"

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
            if ";base64" in header:
                try:
                    data = base64.b64decode(payload, validate=False)
                except (binascii.Error, ValueError) as e:
                    raise MediaStorageError(f"base64 解码失败: {e}")
            else:
                from urllib.parse import unquote_to_bytes
                data = unquote_to_bytes(payload)
            mime = header[5:].split(";")[0]
            return data, self.sniff_ext(data, mime)

        if url.startswith(("http://", "https://")):
            async with httpx.AsyncClient(timeout=REMOTE_FETCH_TIMEOUT_SECONDS, follow_redirects=True) as client:
                resp = await client.get(url)
                if resp.status_code != 200:
                    raise MediaStorageError(f"下载图片失败 [{resp.status_code}]")
                data = resp.content
            if len(data) > REMOTE_FETCH_MAX_BYTES:
                raise MediaStorageError(f"图片体积超出上限: {len(data)}")
            mime = resp.headers.get("content-type", "")
            return data, self.sniff_ext(data, mime)

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