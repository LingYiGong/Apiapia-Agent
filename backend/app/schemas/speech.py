from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator

from app.core.i18n import tr


class SpeechTranscription(BaseModel):
    """What ``POST /speech/transcribe`` returns.

    ``language`` and ``duration`` are nullable on purpose. OpenRouter only
    reports them for some providers and some response formats, and inventing a
    value here would make the UI claim a detection it never received.
    """

    text: str
    model: str
    language: Optional[str] = None
    duration: Optional[float] = Field(default=None, description="Audio duration in seconds")
    usage: Dict[str, Any] = Field(default_factory=dict)


class SpeakRequest(BaseModel):
    """Body for ``POST /speech/speak``.

    Deliberately has no ``model`` field. The synthesis model is the account's
    own setting (user_settings.tts_model), resolved server-side, so the client
    cannot name a model — a request-supplied one would be an unauthenticated way
    to bill an arbitrary or unentitled model. ``voice`` stays client-selectable
    because it is a presentation preference within the chosen model, and the
    server validates it against that model's synced voice list.
    """

    text: str = Field(min_length=1, max_length=20000)
    voice: Optional[str] = Field(default=None, max_length=120)
    # Only honoured by models that implement speed control; others either
    # ignore it or 400 on a non-default value, which is why it stays unset by
    # default rather than being pinned to 1.0.
    speed: Optional[float] = Field(default=None, ge=0.25, le=4.0)
    # Delivery hints ("用温和的语气"), supported by the OpenAI and Gemini TTS
    # models and silently ignored elsewhere.
    instructions: Optional[str] = Field(default=None, max_length=500)
    # A preference, not a guarantee. Gemini TTS accepts only pcm and Mistral
    # Voxtral only mp3, so the service negotiates: it retries as the other format
    # when the provider refuses, remembers the answer, and always returns
    # playable bytes (raw pcm is wrapped in a WAV container).
    response_format: str = Field(default="mp3")

    @field_validator("response_format")
    @classmethod
    def _known_format(cls, value: str) -> str:
        lowered = (value or "").lower()
        if lowered not in ("mp3", "pcm"):
            # pydantic 会把这条 ValueError 的文本原样塞进 422 响应的 msg 字段，
            # 所以它和 HTTPException(detail=…) 一样属于面向用户的文案 ——
            # 写死中文会让英文用户在表单校验失败时看到中文。
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