"""
Speech in and out service (STT and TTS) through OpenRouter.
"""

import json
import logging
import re
import struct
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import httpx

from app.core.config import settings
from app.services.catalog import read_json_catalog, write_json_catalog

logger = logging.getLogger("speech_service")

#: Persistent synced audio models file.
SYNCED_AUDIO_MODELS_FILE = Path(__file__).resolve().parent.parent.parent / "synced_audio_models.json"

#: Supported audio model capabilities.
CAPABILITY_STT = "stt"
CAPABILITY_TTS = "tts"

#: OpenRouter's ``output_modalities`` query value for each capability.
MODALITY_QUERY_BY_CAPABILITY: Dict[str, str] = {
    CAPABILITY_STT: "transcription",
    CAPABILITY_TTS: "speech",
}

UPSTREAM_TIMEOUT_SECONDS = 90.0

#: MIME types supported for audio uploads, keyed by file extension.
AUDIO_MIME_BY_EXTENSION: Dict[str, str] = {
    "webm": "audio/webm",
    "mp3": "audio/mpeg",
    "wav": "audio/wav",
    "m4a": "audio/mp4",
    "mp4": "audio/mp4",
    "ogg": "audio/ogg",
    "oga": "audio/ogg",
    "opus": "audio/ogg",
    "aac": "audio/aac",
    "flac": "audio/flac",
}

DEFAULT_AUDIO_MIME = "audio/webm"

TTS_CONTENT_TYPES: Dict[str, str] = {
    "mp3": "audio/mpeg",
    "pcm": "audio/pcm",
}

WAV_CONTENT_TYPE = "audio/wav"

DEFAULT_PCM_SAMPLE_RATE = 24000
DEFAULT_PCM_CHANNELS = 1

#: model id -> response_format cache learned from upstream responses.
_LEARNED_TTS_FORMAT: Dict[str, str] = {}

_FORMAT_ERROR_MARKERS = ("only supports", "supports only", "accepts", "not supported")


def _is_format_mismatch(message: str, attempted: str) -> bool:
    """Whether a 400 says "this model wants the other format"."""
    lowered = (message or "").lower()
    if not any(marker in lowered for marker in _FORMAT_ERROR_MARKERS):
        return False
    other = "pcm" if attempted == "mp3" else "mp3"
    return other in lowered


def _parse_audio_content_type(value: str) -> Tuple[str, int, int]:
    """Split ``audio/pcm;rate=24000;channels=1`` into type, rate and channels."""
    parts = [p.strip() for p in (value or "").split(";")]
    base = (parts[0] or "application/octet-stream").lower()
    params: Dict[str, str] = {}
    for part in parts[1:]:
        if "=" in part:
            key, val = part.split("=", 1)
            params[key.strip().lower()] = val.strip().strip('"')

    def _int_param(raw: Optional[str], fallback: int) -> int:
        try:
            parsed = int(raw) if raw else fallback
        except (TypeError, ValueError):
            return fallback
        return parsed if parsed > 0 else fallback

    return (
        base,
        _int_param(params.get("rate"), DEFAULT_PCM_SAMPLE_RATE),
        _int_param(params.get("channels"), DEFAULT_PCM_CHANNELS),
    )


def _pcm_to_wav(pcm: bytes, sample_rate: int, channels: int) -> bytes:
    """Wrap raw 16-bit little-endian PCM samples in a 44-byte RIFF/WAVE header."""
    bits_per_sample = 16
    block_align = channels * bits_per_sample // 8
    byte_rate = sample_rate * block_align
    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF",
        36 + len(pcm),
        b"WAVE",
        b"fmt ",
        16,          # PCM subchunk size
        1,           # audio format: 1 = uncompressed PCM
        channels,
        sample_rate,
        byte_rate,
        block_align,
        bits_per_sample,
        b"data",
        len(pcm),
    )
    return header + pcm


class SpeechError(RuntimeError):
    """A speech request that failed, tagged with the status code to report."""

    def __init__(self, message: str, status_code: int = 502) -> None:
        super().__init__(message)
        self.status_code = status_code


def _resolve_mime(filename: str, content_type: Optional[str]) -> str:
    """Pick the MIME type to upload with, preferring the filename."""
    match = re.search(r"\.([A-Za-z0-9]+)$", filename or "")
    if match:
        mapped = AUDIO_MIME_BY_EXTENSION.get(match.group(1).lower())
        if mapped:
            return mapped
    if content_type and content_type.lower().startswith("audio/"):
        return content_type.split(";", 1)[0].strip().lower()
    return DEFAULT_AUDIO_MIME


def _describe_upstream_error(response: httpx.Response, action: str) -> str:
    """Turn an OpenRouter error body into a readable message."""
    raw = ""
    try:
        raw = response.text
    except Exception:  # pragma: no cover - body not decodable
        raw = ""

    detail = ""
    if raw:
        try:
            parsed = response.json()
            if isinstance(parsed, dict):
                candidate = (
                    parsed.get("error") or parsed.get("detail") or parsed.get("message")
                )
                if isinstance(candidate, dict):
                    candidate = candidate.get("message") or candidate.get("code")
                if candidate:
                    detail = str(candidate)
        except Exception:
            detail = raw
    if not detail:
        detail = raw.strip() or response.reason_phrase
    detail = detail.strip()
    if len(detail) > 400:
        detail = detail[:400] + "…"
    return f"{action}失败 [{response.status_code}]: {detail}"


def _as_float(value: Any) -> Optional[float]:
    """Coerce an upstream numeric field to float, returning None on failure."""
    if value is None or isinstance(value, bool):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _map_upstream_status(status_code: int) -> int:
    """Translate an OpenRouter status code into one to show the client."""
    if status_code in (400, 404, 413, 415, 422):
        return status_code
    if status_code in (401, 402, 403):
        return 503
    if status_code == 429:
        return 429
    return 502


class SpeechService:
    """STT and TTS against OpenRouter, using the server-level OpenRouter key."""

    def __init__(self) -> None:
        self.api_key = settings.OPENROUTER_API_KEY
        self.base_url = (settings.OPENROUTER_BASE_URL or "").rstrip("/")
        self.default_stt_model = settings.STT_MODEL
        self.default_tts_model = settings.TTS_MODEL
        self.configured_voice = (settings.TTS_VOICE or "").strip()
        self.free_models = [
            m.strip() for m in (settings.FREE_AUDIO_MODELS or "").split(",") if m.strip()
        ]

    def is_configured(self) -> bool:
        """True when both an OpenRouter key and a base URL are present."""
        return bool(self.api_key and self.api_key.strip() and self.base_url)

    def _require_configured(self) -> None:
        # Raised as 503 rather than 500: nothing is broken, a key is simply
        # missing, and that is what the health check reports too.
        if not self.api_key or not self.api_key.strip():
            raise SpeechError("语音功能未配置：请在 .env 中设置 OPENROUTER_API_KEY", 503)
        if not self.base_url:
            raise SpeechError("语音功能未配置：OPENROUTER_BASE_URL 为空", 503)

    def _headers(self) -> Dict[str, str]:
        # HTTP-Referer / X-Title are OpenRouter's optional attribution headers.
        # They identify this app on OpenRouter's dashboard; omitting them is
        # allowed but loses the attribution, so they are set unconditionally
        # rather than read from config the way the image service does.
        return {
            "Authorization": f"Bearer {self.api_key}",
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "Apiapia Assistant",
        }

    # ── Catalog ────────────────────────────────────────────────────────

    def is_free_audio_model(self, model_id: str) -> bool:
        """Zero-cost models, declared through FREE_AUDIO_MODELS."""
        return model_id in self.free_models

    def active_providers(self) -> set:
        """Providers that currently hold usable credentials."""
        active = set()
        if self.api_key:
            active.add("openrouter")
        return active

    def load_stored_models(self) -> List[Dict[str, Any]]:
        """
        Read the persisted audio catalog from synced_audio_models.json.
        """
        return read_json_catalog(SYNCED_AUDIO_MODELS_FILE)

    def save_stored_models(self, models: List[Dict[str, Any]]) -> None:
        """Write the audio catalog to JSON."""
        write_json_catalog(SYNCED_AUDIO_MODELS_FILE, models)

    async def fetch_models_from_providers(self) -> List[Dict[str, Any]]:
        """
        Live query OpenRouter for both audio families.

        The catalog endpoint is the same for both directions; ``output_modalities``
        is what selects them, and it is why STT and TTS are separate picks —
        ``transcription`` and ``speech`` return disjoint model sets.
        """
        fetched: List[Dict[str, Any]] = []

        if not self.api_key:
            return fetched

        headers = {"Authorization": f"Bearer {self.api_key}"}
        async with httpx.AsyncClient(timeout=20.0) as client:
            for capability in (CAPABILITY_STT, CAPABILITY_TTS):
                modality = MODALITY_QUERY_BY_CAPABILITY[capability]
                try:
                    resp = await client.get(
                        f"{self.base_url}/models",
                        params={"output_modalities": modality},
                        headers=headers,
                    )
                    if resp.status_code != 200:
                        logger.warning(
                            "Audio model lookup failed for %s (output_modalities=%s) [%s]",
                            capability, modality, resp.status_code,
                        )
                        continue

                    data = resp.json()
                    raw = (data.get("data") or []) if isinstance(data, dict) else []
                    logger.info(
                        "Audio model lookup %s (output_modalities=%s): %d models",
                        capability, modality, len(raw),
                    )
                    for item in raw:
                        if not isinstance(item, dict):
                            continue
                        mid = item.get("id")
                        if not mid:
                            continue

                        name = item.get("name") or mid
                        desc = str(item.get("description") or "")[:120]

                        is_free = self.is_free_audio_model(mid)
                        pricing = item.get("pricing")
                        if isinstance(pricing, dict):
                            # Unlike the images endpoint, the models feed does
                            # price audio models, so a zero rate is authoritative
                            # rather than something an operator has to declare.
                            if pricing.get("prompt") in (0, "0", 0.0) and pricing.get(
                                "completion"
                            ) in (0, "0", 0.0):
                                is_free = True

                        supported_voices = item.get("supported_voices")
                        if not isinstance(supported_voices, list):
                            supported_voices = None

                        fetched.append({
                            "id": mid,
                            "name": name,
                            "provider": "openrouter",
                            "description": desc,
                            "is_free": is_free,
                            "capability": capability,
                            # Voices are per-model and change whenever the
                            # upstream adds a provider. Persisting them with the
                            # catalog is what lets /speech/voices answer without
                            # a live lookup on the request path.
                            "supported_voices": (
                                [str(v) for v in supported_voices] if supported_voices else None
                            ),
                        })
                except Exception as e:
                    logger.warning(
                        "Audio model lookup error for %s (output_modalities=%s): %s",
                        capability, modality, e,
                    )

        return fetched

    async def list_available_models(self) -> List[Dict[str, Any]]:
        """
        The synced catalog, restricted to providers that hold credentials.

        Returns an empty list until a sync has been performed, which is the same
        contract as the chat model catalog.
        """
        stored = self.load_stored_models()
        active = self.active_providers()
        return [m for m in stored if m.get("provider") in active]

    async def sync_models(self) -> Dict[str, Any]:
        """
        Merge a live provider query into the persisted catalog.

        Merge rather than replace, so a transient provider failure cannot wipe
        the catalog the way ``merged[mid] = m`` on an empty fetch would.
        """
        current = self.load_stored_models()
        known_ids = {m["id"] for m in current}
        fetched = await self.fetch_models_from_providers()

        new_models: List[Dict[str, Any]] = []
        merged: Dict[str, Dict[str, Any]] = {m["id"]: m for m in current}
        for m in fetched:
            mid = m["id"]
            if mid not in known_ids:
                new_models.append(m)
                known_ids.add(mid)
            merged[mid] = m

        # Recompute the free flag so adding a model to FREE_AUDIO_MODELS takes
        # effect on the next sync without a file hand-edit. One-directional,
        # matching video_gen: a model that stops being free stays flagged rather
        # than being silently upgraded for a trial account.
        for mid, m in merged.items():
            if self.is_free_audio_model(mid):
                m["is_free"] = True

        merged_list = list(merged.values())
        # STT before TTS so the two selectors are each fed a contiguous block,
        # then free-first within each capability.
        merged_list.sort(
            key=lambda m: (
                0 if m.get("capability") == CAPABILITY_STT else 1,
                0 if m.get("is_free") else 1,
                m.get("id") or "",
            )
        )
        self.save_stored_models(merged_list)

        providers = sorted(self.active_providers())
        if not fetched:
            message = "同步完成，但未从提供商获取到语音模型，请检查 OpenRouter 服务凭证是否有效。"
        elif new_models:
            message = f"同步成功！从提供商新增发现了 {len(new_models)} 个语音模型"
        else:
            message = "同步完成，当前已是最新模型，未发现新模型"

        return {
            "success": True,
            "new_count": len(new_models),
            "new_models": new_models,
            "total": len(merged_list),
            "synced_providers": providers,
            "message": message,
        }

    # ── Capability lookups ─────────────────────────────────────────────

    def _catalog_entry(self, model_id: str, capability: str) -> Optional[Dict[str, Any]]:
        """Find a stored entry by id, requiring the given capability.

        The capability check is the point: without it a user who pasted a TTS
        model into the STT selector would get an upstream 400 with a provider
        message instead of a plain "this model cannot transcribe".
        """
        if not model_id:
            return None
        for entry in self.load_stored_models():
            if entry.get("id") == model_id and entry.get("capability") == capability:
                return entry
        return None

    def default_model_for(self, capability: str) -> Optional[str]:
        """
        The model to use when an account has not chosen one.

        Three tiers, mirroring video_gen.default_video_model: the configured
        default if it survived the sync, then the first stored model of the right
        capability, then the configured default anyway so the feature still works
        on a fresh deployment that has not synced yet.
        """
        configured = (
            self.default_stt_model if capability == CAPABILITY_STT else self.default_tts_model
        )
        stored = self.load_stored_models()
        matching = [m.get("id") for m in stored if m.get("capability") == capability]
        if configured and configured in matching:
            return configured
        if matching:
            return matching[0]
        return configured or None

    def voices_for(self, model_id: str) -> List[str]:
        """Voices the given TTS model accepts, read from the synced catalog."""
        entry = self._catalog_entry(model_id, CAPABILITY_TTS)
        if not entry:
            return []
        voices = entry.get("supported_voices")
        if not isinstance(voices, list):
            return []
        return [str(v) for v in voices]

    def resolve_voice(self, model_id: str, voice: Optional[str] = None) -> Optional[str]:
        """Pick the voice to synthesize with, or None to omit the field."""
        available = self.voices_for(model_id)

        if voice:
            if available and voice not in available:
                raise SpeechError(
                    f"音色「{voice}」不适用于当前语音合成模型，请重新选择", 400
                )
            return voice

        if self.configured_voice and (not available or self.configured_voice in available):
            return self.configured_voice

        if available:
            return available[0]

        return None

    # ── STT ────────────────────────────────────────────────────────────

    async def transcribe(
        self,
        audio: bytes,
        filename: Optional[str] = None,
        content_type: Optional[str] = None,
        language: Optional[str] = None,
        prompt: Optional[str] = None,
        model: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Transcribe ``audio`` to text."""
        self._require_configured()

        if not audio:
            raise SpeechError("音频为空，未收到任何数据", 400)

        model_name = model or self.default_model_for(CAPABILITY_STT)
        if not model_name:
            raise SpeechError("未配置语音识别模型（STT_MODEL）", 503)

        name = filename or "recording.webm"
        mime = _resolve_mime(name, content_type)

        data: Dict[str, str] = {"model": model_name}
        if language:
            data["language"] = language
        if prompt:
            data["prompt"] = prompt

        url = f"{self.base_url}/audio/transcriptions"
        logger.info(
            "Calling OpenRouter STT: model=%s, bytes=%d, mime=%s, language=%s",
            model_name, len(audio), mime, language or "auto",
        )

        try:
            async with httpx.AsyncClient(timeout=UPSTREAM_TIMEOUT_SECONDS) as client:
                response = await client.post(
                    url,
                    headers=self._headers(),
                    data=data,
                    files={"file": (name, audio, mime)},
                )
        except httpx.TimeoutException:
            # The upstream cut us off at its own ~60s ceiling, or the upload was
            # too slow to arrive. Splitting the recording and retrying is the fix.
            raise SpeechError(
                "语音识别超时：录音可能过长，请控制在 1 分钟以内，或分段转写", 504
            )
        except httpx.RequestError as exc:
            raise SpeechError(f"无法连接 OpenRouter 语音识别服务: {exc}", 502)

        if response.status_code != 200:
            raise SpeechError(
                _describe_upstream_error(response, "OpenRouter 语音识别"),
                _map_upstream_status(response.status_code),
            )

        try:
            payload = response.json()
        except Exception:
            raise SpeechError("OpenRouter 语音识别返回了无法解析的响应", 502)

        text = payload.get("text")
        if not isinstance(text, str):
            raise SpeechError("OpenRouter 语音识别未返回文本字段", 502)

        usage = payload.get("usage") if isinstance(payload.get("usage"), dict) else {}

        return {
            "text": text.strip(),
            "model": model_name,
            # Both of these come from `usage` on the default response format.
            # `seconds` is the audio duration OpenRouter billed for; it is the
            # only duration signal available without asking for verbose_json.
            "language": payload.get("language") or None,
            "duration": _as_float(usage.get("seconds")) or _as_float(payload.get("duration")),
            "usage": {
                "cost": _as_float(usage.get("cost")),
                "input_tokens": usage.get("input_tokens"),
                "output_tokens": usage.get("output_tokens"),
                "total_tokens": usage.get("total_tokens"),
                "seconds": _as_float(usage.get("seconds")),
            },
        }

    # ── TTS ────────────────────────────────────────────────────────────

    async def synthesize(
        self,
        text: str,
        model: Optional[str] = None,
        voice: Optional[str] = None,
        speed: Optional[float] = None,
        instructions: Optional[str] = None,
        response_format: str = "mp3",
    ) -> Tuple[bytes, str, str]:
        """Synthesize ``text`` into speech audio, in a browser-playable format."""
        self._require_configured()

        cleaned = (text or "").strip()
        if not cleaned:
            raise SpeechError("待朗读的文本为空", 400)

        max_chars = settings.SPEECH_MAX_TEXT_CHARS
        if len(cleaned) > max_chars:
            raise SpeechError(
                f"待朗读文本约 {len(cleaned)} 字，超过单次 {max_chars} 字上限", 400
            )

        model_name = model or self.default_model_for(CAPABILITY_TTS)
        if not model_name:
            raise SpeechError("未配置语音合成模型（TTS_MODEL）", 503)

        voice_name = self.resolve_voice(model_name, voice)

        requested = (response_format or "mp3").lower()
        if requested not in TTS_CONTENT_TYPES:
            raise SpeechError(
                f"不支持的音频格式「{response_format}」，仅支持 mp3 / pcm", 400
            )

        first_choice = _LEARNED_TTS_FORMAT.get(model_name, requested)
        second_choice = "pcm" if first_choice == "mp3" else "mp3"

        last_error: Optional[SpeechError] = None
        for fmt in (first_choice, second_choice):
            try:
                audio, content_type = await self._synthesize_once(
                    text=cleaned,
                    model_name=model_name,
                    voice_name=voice_name,
                    speed=speed,
                    instructions=instructions,
                    fmt=fmt,
                )
            except SpeechError as exc:
                if exc.status_code != 400 or not _is_format_mismatch(str(exc), fmt):
                    raise
                last_error = exc
                _LEARNED_TTS_FORMAT[model_name] = "pcm" if fmt == "mp3" else "mp3"
                logger.info(
                    "TTS model %s rejected %s; retrying as %s",
                    model_name, fmt, _LEARNED_TTS_FORMAT[model_name],
                )
                continue

            _LEARNED_TTS_FORMAT[model_name] = fmt
            return audio, content_type, model_name

        if last_error is not None:
            raise last_error
        raise SpeechError("语音合成失败", 400)

    async def _synthesize_once(
        self,
        text: str,
        model_name: str,
        voice_name: Optional[str],
        speed: Optional[float],
        instructions: Optional[str],
        fmt: str,
    ) -> Tuple[bytes, str]:
        """One upstream synthesis call. Returns playable bytes and their MIME type."""
        payload: Dict[str, Any] = {
            "model": model_name,
            "input": text,
            "response_format": fmt,
        }
        if voice_name:
            payload["voice"] = voice_name
        if speed is not None:
            payload["speed"] = speed
        if instructions:
            payload["instructions"] = instructions

        url = f"{self.base_url}/audio/speech"
        logger.info(
            "Calling OpenRouter TTS: model=%s, voice=%s, chars=%d, format=%s",
            model_name, voice_name or "<provider default>", len(text), fmt,
        )

        try:
            async with httpx.AsyncClient(timeout=UPSTREAM_TIMEOUT_SECONDS) as client:
                response = await client.post(
                    url, headers={**self._headers(), "Content-Type": "application/json"},
                    json=payload,
                )
        except httpx.TimeoutException:
            raise SpeechError("语音合成超时，请缩短文本后重试", 504)
        except httpx.RequestError as exc:
            raise SpeechError(f"无法连接 OpenRouter 语音合成服务: {exc}", 502)

        if response.status_code != 200:
            raise SpeechError(
                _describe_upstream_error(response, "OpenRouter 语音合成"),
                _map_upstream_status(response.status_code),
            )

        audio = response.content
        if not audio:
            raise SpeechError("OpenRouter 语音合成返回了空音频", 502)

        upstream_type, sample_rate, channels = _parse_audio_content_type(
            response.headers.get("content-type", "")
        )

        # Prefer the upstream header over what we asked for: some providers
        # silently substitute, and the byte stream is what the browser plays.
        if upstream_type == TTS_CONTENT_TYPES["mp3"]:
            return audio, TTS_CONTENT_TYPES["mp3"]
        if upstream_type == TTS_CONTENT_TYPES["pcm"]:
            return _pcm_to_wav(audio, sample_rate, channels), WAV_CONTENT_TYPE
        if upstream_type == WAV_CONTENT_TYPE:
            # Already a container — nothing to add.
            return audio, WAV_CONTENT_TYPE

        # Unknown/absent header: fall back to what was requested.
        if fmt == "pcm":
            return _pcm_to_wav(audio, sample_rate, channels), WAV_CONTENT_TYPE
        return audio, TTS_CONTENT_TYPES["mp3"]

    def capabilities(self) -> Dict[str, Any]:
        """A snapshot of what the frontend needs to render the speech controls."""
        return {
            "configured": self.is_configured(),
            "stt_model": self.default_model_for(CAPABILITY_STT),
            "tts_model": self.default_model_for(CAPABILITY_TTS),
            "max_audio_bytes": settings.SPEECH_MAX_AUDIO_BYTES,
            "max_text_chars": settings.SPEECH_MAX_TEXT_CHARS,
            "formats": sorted(TTS_CONTENT_TYPES.keys()),
        }


speech_service = SpeechService()