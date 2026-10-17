from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator

from app.core.i18n import tr


class SpeechTranscription(BaseModel):
    """Transcription response model."""

    text: str
    model: str
    language: Optional[str] = None
    duration: Optional[float] = Field(default=None, description="Audio duration in seconds")
    usage: Dict[str, Any] = Field(default_factory=dict)


class SpeakRequest(BaseModel):
    """Body for POST /speech/speak."""

    text: str = Field(min_length=1, max_length=20000)
    voice: Optional[str] = Field(default=None, max_length=120)
    speed: Optional[float] = Field(default=None, ge=0.25, le=4.0)
    instructions: Optional[str] = Field(default=None, max_length=500)
    response_format: str = Field(default="mp3")

    @field_validator("response_format")
    @classmethod
    def _known_format(cls, value: str) -> str:
        lowered = (value or "").lower()
        if lowered not in ("mp3", "pcm"):
            raise ValueError(tr("SPEECH_BAD_RESPONSE_FORMAT"))
        return lowered


class SpeakVoicesResponse(BaseModel):
    """Shape of ``GET /speech/voices``."""

    configured: bool
    stt_model: Optional[str] = None
    tts_model: Optional[str] = None
    #: The model ``voices`` were read for, which is the account's ``tts_model``
    #: unless the caller named a different one.
    voice_model: str
    voices: List[str] = Field(default_factory=list)
    max_audio_bytes: int
    max_text_chars: int
    formats: List[str] = Field(default_factory=list)