import logging
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.core.errors import ApiError
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

_READ_CHUNK_BYTES = 1024 * 1024


def _raise_http(exc: SpeechError) -> HTTPException:
    """Turn a service-layer failure into an HTTPException."""
    logger.warning("Speech request failed [%s]: %s", exc.status_code, exc)
    return HTTPException(status_code=exc.status_code, detail=str(exc))


async def _read_capped(file: UploadFile) -> bytes:
    """Read an upload, refusing to buffer more than the configured ceiling."""
    limit = settings.SPEECH_MAX_AUDIO_BYTES
    chunks: List[bytes] = []
    total = 0
    while True:
        chunk = await file.read(_READ_CHUNK_BYTES)
        if not chunk:
            break
        total += len(chunk)
        if total > limit:
            raise ApiError(
                status_code=413,
                code="AUDIO_FILE_TOO_LARGE",
                limit=limit // (1024 * 1024),
            )
        chunks.append(chunk)
    return b"".join(chunks)


async def _resolve_user_model(
    db: AsyncSession, user_id: str, column: Any, capability: str
) -> Optional[str]:
    """Read one of the account's chosen speech models, or fallback to default."""
    stmt = select(column).where(UserSetting.user_id == user_id)
    chosen = (await db.execute(stmt)).scalar_one_or_none()
    chosen = (chosen or "").strip()
    return chosen or speech_service.default_model_for(capability)


@router.post("/transcribe", response_model=SpeechTranscription)
async def transcribe_audio(
    file: UploadFile = File(..., description="Audio file (browser recording or upload)"),
    language: Optional[str] = Form(
        None,
        max_length=8,
        description="ISO-639-1 code, e.g. zh / en; leave empty to auto-detect",
    ),
    prompt: Optional[str] = Form(
        None, max_length=1000, description="Vocabulary hints, biased toward proper nouns"
    ),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """把一段录音转成文字。"""
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
    """把一段文字合成为语音，直接返回音频字节流。"""
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
            "Cache-Control": "private, no-store",
            "X-Speech-Model": used_model,
            "X-Speech-Format": content_type,
        },
    )


@router.get("/voices", response_model=SpeakVoicesResponse)
async def list_voices(
    model: Optional[str] = Query(None, max_length=120),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """返回指定语音合成模型可用的音色列表，以及各项限制。"""
    if not speech_service.is_configured():
        raise ApiError(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            code="SPEECH_NOT_CONFIGURED",
        )

    voice_model = (model or "").strip() or await _resolve_user_model(
        db, current_user.id, UserSetting.tts_model, CAPABILITY_TTS
    )
    caps = speech_service.capabilities()
    return SpeakVoicesResponse(
        **caps,
        voices=speech_service.voices_for(voice_model) if voice_model else [],
        voice_model=voice_model or "",
    )