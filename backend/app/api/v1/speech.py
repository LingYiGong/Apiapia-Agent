import logging
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.models.setting import UserSetting
from app.models.user import User
from app.schemas.speech import SpeakRequest, SpeakVoicesResponse, SpeechTranscription
from app.services.speech.service import (
    CAPABILITY_STT,
    CAPABILITY_TTS,
    SpeechError,
    speech_service,
)

logger = logging.getLogger("speech_api")

router = APIRouter(prefix="/speech", tags=["speech"])

#: Read granularity while draining an upload. The point is to stop early rather
#: than buffer an oversized body, so this only needs to be big enough that the
#: loop overhead is negligible.
_READ_CHUNK_BYTES = 1024 * 1024


def _raise_http(exc: SpeechError) -> HTTPException:
    """Turn a service-layer failure into the response the client sees.

    ``SpeechError`` already carries the right status (see
    ``_map_upstream_status``), so this only adds the log. The message is safe to
    return: it is built from the upstream provider's own complaint, not from a
    connection string or a key.
    """
    logger.warning("Speech request failed [%s]: %s", exc.status_code, exc)
    return HTTPException(status_code=exc.status_code, detail=str(exc))


async def _read_capped(file: UploadFile) -> bytes:
    """Read an upload, refusing to buffer more than the configured ceiling.

    ``await file.read()`` with no argument would take whatever was sent. The
    body-size middleware in ``main.py`` caps the *request* at 32 MB, which is
    above the 25 MB multipart limit, so an upload between the two sizes would be
    fully buffered here and then rejected upstream — turning a free local check
    into a paid round trip. Draining in chunks stops at the limit instead.

    This gate exists to protect the process, and it defaults to OpenRouter's own
    25 MB ceiling. It is deliberately tunable rather than pinned to that number:
    the provider limit moves, and a local gate hardcoded to a vendor's constant
    is one that silently rots.
    """
    limit = settings.SPEECH_MAX_AUDIO_BYTES
    chunks: List[bytes] = []
    total = 0
    while True:
        chunk = await file.read(_READ_CHUNK_BYTES)
        if not chunk:
            break
        total += len(chunk)
        if total > limit:
            raise HTTPException(
                # Literal rather than status.HTTP_413_*: Starlette renamed that
                # constant in 2024 (REQUEST_ENTITY_TOO_LARGE → CONTENT_TOO_LARGE)
                # and kept the old name as a deprecation alias, so depending on
                # it means this file breaks on one upgrade or the other. This is
                # the same call main.py's MaxBodySizeMiddleware already makes.
                status_code=413,
                detail=f"音频文件超过 {limit // (1024 * 1024)}MB 上限，请压缩或分段录音",
            )
        chunks.append(chunk)
    return b"".join(chunks)


async def _resolve_user_model(
    db: AsyncSession, user_id: str, column: Any, capability: str
) -> Optional[str]:
    """Read one of the account's chosen speech models.

    Resolved here rather than accepted in the request body so the browser has no
    way to name a model: the selection is a server-side account preference
    (user_settings), and a request-supplied model would be an unauthenticated way
    to route a user's traffic at an arbitrary, possibly unentitled, model.

    Falls back to the configured default when the column is empty, which is the
    normal state for an account that never opened the speech section.
    """
    stmt = select(column).where(UserSetting.user_id == user_id)
    chosen = (await db.execute(stmt)).scalar_one_or_none()
    chosen = (chosen or "").strip()
    return chosen or speech_service.default_model_for(capability)


@router.post("/transcribe", response_model=SpeechTranscription)
async def transcribe_audio(
    file: UploadFile = File(..., description="音频文件（浏览器录音或上传）"),
    language: Optional[str] = Form(None, max_length=8, description="ISO-639-1，如 zh / en；留空自动检测"),
    prompt: Optional[str] = Form(None, max_length=1000, description="词汇提示，偏向专有名词"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """把一段录音转成文字。

    Accepts multipart/form-data rather than a base64 JSON body on purpose: a
    recording is already binary, and base64 would inflate it by a third on the
    way in and on the way out. This is the same shape OpenAI's own endpoint
    takes, so an OpenAI-SDK client works against it unchanged.
    """
    audio = await _read_capped(file)
    model_name = await _resolve_user_model(db, current_user.id, UserSetting.stt_model, CAPABILITY_STT)
    try:
        result = await speech_service.transcribe(
            audio,
            filename=file.filename,
            content_type=file.content_type,
            language=(language or "").strip() or None,
            prompt=(prompt or "").strip() or None,
            model=model_name,
        )
    except SpeechError as exc:
        raise _raise_http(exc)

    logger.info(
        "Transcribed %d bytes to %d chars with %s for user %s",
        len(audio), len(result["text"]), model_name, current_user.id,
    )
    return SpeechTranscription(**result)


@router.post("/speak")
async def speak(
    payload: SpeakRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """把一段文字合成为语音，直接返回音频字节流。

    The response body is the audio, not JSON, so the frontend has to fetch it as
    a blob and hand it to an ``<audio>`` element. That is unavoidable for this
    endpoint — base64 in a JSON envelope would inflate every reply by a third and
    force both sides to hold the whole file in memory to play any of it.
    """
    model_name = await _resolve_user_model(db, current_user.id, UserSetting.tts_model, CAPABILITY_TTS)
    try:
        audio, content_type, used_model = await speech_service.synthesize(
            payload.text,
            model=model_name,
            voice=(payload.voice or "").strip() or None,
            speed=payload.speed,
            instructions=(payload.instructions or "").strip() or None,
            response_format=payload.response_format,
        )
    except SpeechError as exc:
        raise _raise_http(exc)

    logger.info(
        "Synthesized %d chars to %d bytes (%s) for user %s",
        len(payload.text), len(audio), used_model, current_user.id,
    )
    return Response(
        content=audio,
        media_type=content_type,
        headers={
            # The audio is derived from a message the user already has, so it is
            # safe to let the browser hold it briefly — but not to let a shared
            # cache keep a copy of anyone's reply.
            "Cache-Control": "private, no-store",
            "X-Speech-Model": used_model,
            # Lets the client see which container it actually got. TTS models
            # disagree about supported formats, so a pcm-only model answers with
            # audio/wav rather than the mp3 that was requested.
            "X-Speech-Format": content_type,
        },
    )


@router.get("/voices", response_model=SpeakVoicesResponse)
async def list_voices(
    model: Optional[str] = Query(None, max_length=120),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """返回指定语音合成模型可用的音色列表，以及各项限制。

    Voices come from the synced catalog, which persists each model's
    ``supported_voices`` at sync time — the same reason video_gen stores its
    supported durations and aspect ratios. Reading them here means no live
    provider call on the request path, and a hardcoded copy would go stale the
    next time OpenRouter adds a provider.
    """
    if not speech_service.is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="语音功能未配置：请在 .env 中设置 OPENROUTER_API_KEY",
        )

    voice_model = (model or "").strip() or await _resolve_user_model(
        db, current_user.id, UserSetting.tts_model, CAPABILITY_TTS
    )
    caps = speech_service.capabilities()
    return SpeakVoicesResponse(
        **caps,
        voices=speech_service.voices_for(voice_model) if voice_model else [],
        # The requested model may differ from the account's selection, so say
        # which model's voices these actually are.
        voice_model=voice_model or "",
    )