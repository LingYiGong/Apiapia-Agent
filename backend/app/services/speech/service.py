"""
Speech in and out, both through OpenRouter.

OpenRouter exposes two dedicated audio endpoints that are OpenAI-compatible:

* ``POST /audio/transcriptions`` — audio in, text out (STT)
* ``POST /audio/speech``         — text in, raw audio bytes out (TTS)

Both authenticate with the same ``OPENROUTER_API_KEY`` that chat already uses,
so there is no new credential to provision.

The audio model catalog is persisted to ``synced_audio_models.json`` and
refreshed only by an explicit sync request, mirroring how the chat, image and
video catalogs are handled. No models are hardcoded and no request path performs
a live catalog lookup.

The two directions are separate model families upstream — OpenRouter filters its
models endpoint with ``output_modalities=transcription`` and ``=speech``, and the
two lists do not overlap. Every catalog entry therefore carries a
``capability`` of ``"stt"`` or ``"tts"``, and a user picks one of each; a single
combined selector could only ever be right half the time.

Both endpoints are called with plain ``httpx`` rather than the OpenAI SDK. The
SDK's ``audio.transcriptions``/``audio.speech`` helpers would work against a
base_url, but reaching for them buys nothing here: the request bodies are one
JSON object (TTS) or one multipart file (STT), the TTS response is a raw byte
stream rather than JSON, and the surrounding code in this repo talks to
OpenRouter over httpx directly (see ``image_gen/service.py`` and
``video_gen/service.py``). Staying on httpx keeps one HTTP idiom in the codebase
and makes the non-JSON responses trivial to handle.
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

logger = logging.getLogger("speech_service")

#: Persistent synced audio models file, sibling of synced_image_models.json and
#: synced_video_models.json. backend/app is bind-mounted in compose, so writing
#: here needs no extra volume.
SYNCED_AUDIO_MODELS_FILE = Path(__file__).resolve().parent.parent.parent / "synced_audio_models.json"

#: The two capabilities an audio model can have. These are internal tags only —
#: what gets persisted in the catalog, what the frontend filters on, and what the
#: settings columns imply.
CAPABILITY_STT = "stt"
CAPABILITY_TTS = "tts"

#: OpenRouter's ``output_modalities`` query value for each capability.
#:
#: Deliberately a separate mapping rather than reusing CAPABILITY_* directly.
#: They are different vocabularies and conflating them fails silently: querying
#: ``?output_modalities=stt`` is accepted by the endpoint, matches no model, and
#: returns a well-formed empty catalog — so a sync reports success and writes an
#: empty file instead of raising anything.
MODALITY_QUERY_BY_CAPABILITY: Dict[str, str] = {
    CAPABILITY_STT: "transcription",
    CAPABILITY_TTS: "speech",
}

#: Both audio endpoints time out upstream at ~60 seconds. Ask for a little more
#: than that so *our* timeout is never the one that fires — a request that would
#: have succeeded then reads as a clean gateway timeout instead of being killed
#: mid-upload.
UPSTREAM_TIMEOUT_SECONDS = 90.0

#: MIME types we will hand to OpenRouter, keyed by file extension. The STT
#: endpoint derives the format from the filename or the part's content type, so
#: an unrecognised upload would otherwise arrive with no format at all and be
#: rejected. Browsers are inconsistent here — MediaRecorder commonly produces
#: ``audio/webm;codecs=opus`` on Chrome and a plain ``audio/webm`` elsewhere — so
#: the extension is the more reliable of the two signals.
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

#: Fallback for uploads whose extension and content type are both unrecognised.
DEFAULT_AUDIO_MIME = "audio/webm"

#: Formats OpenRouter accepts for the TTS response, as an *upstream* preference.
#:
#: Which of the two a given model accepts is not ours to decide and not stable:
#: Gemini TTS takes pcm only and rejects mp3 with a 400, while Mistral Voxtral
#: takes mp3 only and rejects pcm. So this is the format we *ask* for, and the
#: service falls back to the other one when the provider refuses (see
#: ``_LEARNED_TTS_FORMAT``). pcm is never handed to a browser raw — it is wrapped
#: in a WAV container first, since bare samples are not playable.
TTS_CONTENT_TYPES: Dict[str, str] = {
    "mp3": "audio/mpeg",
    "pcm": "audio/pcm",
}

#: Returned Content-Type when pcm bytes were wrapped into a playable container.
WAV_CONTENT_TYPE = "audio/wav"

#: Fallbacks for the PCM response header, used only when OpenRouter omits the
#: parameters. 24 kHz mono 16-bit is what both Gemini and the MAI-Voice family
#: emit, so these are the values, not convenient guesses.
DEFAULT_PCM_SAMPLE_RATE = 24000
DEFAULT_PCM_CHANNELS = 1

#: model id -> the response_format that provider actually accepted.
#:
#: Learned from the first request instead of declared, because nothing in the
#: models API reports it and a hardcoded per-model table would rot with every
#: new release. Bounded by the number of TTS models a deployment touches.
_LEARNED_TTS_FORMAT: Dict[str, str] = {}

#: Phrases that mark a 400 as "wrong format for this model" rather than "bad
#: request". Checked together with the *other* format's name, so an unrelated 400
#: (bad voice id, unsupported speed) never triggers a pointless retry.
_FORMAT_ERROR_MARKERS = ("only supports", "supports only", "accepts", "not supported")


def _is_format_mismatch(message: str, attempted: str) -> bool:
    """Whether a 400 says "this model wants the other format"."""
    lowered = (message or "").lower()
    if not any(marker in lowered for marker in _FORMAT_ERROR_MARKERS):
        return False
    other = "pcm" if attempted == "mp3" else "mp3"
    return other in lowered


def _parse_audio_content_type(value: str) -> Tuple[str, int, int]:
    """Split ``audio/pcm;rate=24000;channels=1`` into type, rate and channels.

    OpenRouter documents the PCM response as carrying the sample rate and channel
    count in these parameters, which is the only reason raw pcm can be turned into
    playable audio at all — a guessed rate plays back at the wrong pitch.
    """
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
    """Wrap raw 16-bit little-endian PCM samples in a 44-byte RIFF/WAVE header.

    Browsers play WAV natively and refuse headerless PCM, so this is what makes
    a pcm-only model usable from the web at all. Standard canonical WAV: PCM
    format tag 1, little-endian throughout, no extra chunks.
    """
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
    """A speech request that failed, tagged with the status to report.

    The other provider services in this repo raise bare ``RuntimeError`` and let
    the caller discover the failure as a 500. Speech is different in kind: a
    rejected voice id, an expired key and an over-quota account are all things
    the user can act on, so the upstream status is carried through to the HTTP
    layer instead of being flattened into "Internal Server Error".
    """

    def __init__(self, message: str, status_code: int = 502) -> None:
        super().__init__(message)
        self.status_code = status_code


def _resolve_mime(filename: str, content_type: Optional[str]) -> str:
    """Pick the MIME type to upload with, preferring the filename.

    A browser-supplied ``content_type`` on a ``MediaRecorder`` blob is the
    unreliable one (it can carry codec parameters or be absent entirely), so the
    extension wins when we recognise it.
    """
    match = re.search(r"\.([A-Za-z0-9]+)$", filename or "")
    if match:
        mapped = AUDIO_MIME_BY_EXTENSION.get(match.group(1).lower())
        if mapped:
            return mapped
    if content_type and content_type.lower().startswith("audio/"):
        # Strip any `;codecs=opus` parameters — the STT endpoint matches the
        # base type, and the parameters only add ways for it to disagree.
        return content_type.split(";", 1)[0].strip().lower()
    return DEFAULT_AUDIO_MIME


def _describe_upstream_error(response: httpx.Response, action: str) -> str:
    """Turn an OpenRouter error body into one sentence a user can act on.

    The bodies are JSON with a ``detail``/``error`` carrying the provider's own
    message ("Voice 'Kore' is not available for this model"), which is far more
    useful than the status alone. The raw text is truncated because some
    providers echo the whole request back in the error.
    """
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
    """Coerce an upstream numeric field, tolerating strings and nulls.

    OpenRouter reports usage in JSON numbers, but some providers send them as
    strings and a couple send null for an unpriced field. Anything that is not a
    real number becomes None rather than propagating into a Pydantic response and
    failing the request after the billable work already happened.
    """
    if value is None or isinstance(value, bool):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _map_upstream_status(status_code: int) -> int:
    """Translate an OpenRouter status into one to show the client.

    The distinction that matters is *whose* problem it is. 4xx codes describing
    this request (400 for an unknown voice, 413 too large) pass through, because
    the user can fix them by changing what they asked for. Codes describing the
    account or the provider (401 bad key, 402 out of credits) become 503, because
    a client retrying them unchanged fails identically and the actionable fix is a
    server-side key, not a retry.

    429 is the exception kept at face value: it is transient and retryable, and
    flattening it to 502 would tell the caller to give up on something that would
    succeed in a moment.
    """
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
        if not SYNCED_AUDIO_MODELS_FILE.exists():
            return []
        try:
            with open(SYNCED_AUDIO_MODELS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    return data
        except Exception as e:
            logger.error(f"Error reading synced_audio_models.json: {e}")
        return []

    def save_stored_models(self, models: List[Dict[str, Any]]) -> None:
        """Write the audio catalog to JSON."""
        try:
            SYNCED_AUDIO_MODELS_FILE.parent.mkdir(parents=True, exist_ok=True)
            with open(SYNCED_AUDIO_MODELS_FILE, "w", encoding="utf-8") as f:
                json.dump(models, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"Error writing synced_audio_models.json: {e}")

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
        """
        Pick the voice to synthesize with, or None to omit the field entirely.

        Preference order: the caller's choice, then the pinned TTS_VOICE when it
        belongs to this model, then the first voice the catalog reports.

        **None is a valid answer, not a failure.** Some TTS models publish no
        voice list at all — the catalog entry carries ``supported_voices: null``
        for the Fish Audio and Seed Audio families. Those are exactly the models
        whose provider documents its own default voice, and OpenRouter accepts a
        request with ``voice`` omitted only for those. Treating an empty list as a
        configuration error locked the user out of synthesis for a whole class of
        perfectly working models.

        An explicitly requested voice is still validated against the catalog, so
        a voice belonging to a different provider fails here with a usable
        message rather than at the provider.
        """
        available = self.voices_for(model_id)

        if voice:
            # An empty list means the model publishes no voices to check against,
            # so pass it through and let the provider be the judge.
            if available and voice not in available:
                raise SpeechError(
                    f"音色「{voice}」不适用于当前语音合成模型，请重新选择", 400
                )
            return voice

        if self.configured_voice and (not available or self.configured_voice in available):
            return self.configured_voice

        if available:
            return available[0]

        # No published voices: let the provider apply its documented default.
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
        """Transcribe ``audio`` to text.

        Args:
            audio: Raw file bytes. Already size-checked by the caller.
            filename: Original name, used to derive the audio format.
            content_type: Browser MIME type, a fallback for ``filename``.
            language: ISO-639-1 code (``zh``, ``en``, ...). Omitted means
                auto-detect, which is the right default for a chat app.
            prompt: Optional vocabulary hint that biases the decoder toward
                proper nouns and domain terms.
            model: The account's chosen STT model; falls back to the configured
                default when unset.

        Returns:
            ``{"text", "model", "language", "duration", "usage"}``. ``language``
            and ``duration`` are ``None`` unless the upstream reports them — with
            the default ``json`` response format they arrive inside ``usage`` or
            not at all, and this does not invent them.

        Raises:
            SpeechError: On any upstream failure, with a status worth showing.
        """
        self._require_configured()

        if not audio:
            raise SpeechError("音频为空，未收到任何数据", 400)

        model_name = model or self.default_model_for(CAPABILITY_STT)
        if not model_name:
            raise SpeechError("未配置语音识别模型（STT_MODEL）", 503)

        # The multipart endpoint derives the format from the filename extension
        # or the part's content type, so one of them has to be right.
        name = filename or "recording.webm"
        mime = _resolve_mime(name, content_type)

        data: Dict[str, str] = {"model": model_name}
        if language:
            data["language"] = language
        if prompt:
            data["prompt"] = prompt
        # Left at the "json" default deliberately. "verbose_json" buys segment
        # timestamps, which this app has no surface to show, and it is rejected
        # outright (400) by models that cannot produce them — so asking for it
        # would trade a feature nobody uses for a class of outright failure.

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
        """Synthesize ``text`` into speech audio, in a browser-playable format.

        The requested ``response_format`` is a *preference*, not a guarantee.
        Gemini TTS accepts only pcm and Mistral Voxtral only mp3, so a format the
        model refuses is retried as the other one and the outcome remembered in
        ``_LEARNED_TTS_FORMAT`` — one wasted request per model per process, then
        never again. Raw pcm is wrapped in a WAV container before returning, so
        the caller always receives something an ``<audio>`` element can play.

        Returns:
            ``(audio_bytes, content_type, model)``. ``content_type`` reflects what
            was actually produced: ``audio/mpeg``, or ``audio/wav`` when pcm was
            wrapped.

        Raises:
            SpeechError: On any upstream failure, with a status worth showing.
        """
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

        # A previously learned format wins over the caller's preference: it is
        # the one this provider is known to accept, so trying the other first
        # would burn a request on every single call.
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
                # The model wants the other format. Remember it and try that.
                last_error = exc
                _LEARNED_TTS_FORMAT[model_name] = "pcm" if fmt == "mp3" else "mp3"
                logger.info(
                    "TTS model %s rejected %s; retrying as %s",
                    model_name, fmt, _LEARNED_TTS_FORMAT[model_name],
                )
                continue

            _LEARNED_TTS_FORMAT[model_name] = fmt
            return audio, content_type, model_name

        # Both formats refused, so the model accepts neither: this is a real 400.
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
        """One upstream synthesis call. Returns playable bytes and their MIME type.

        Raises SpeechError on any failure; the caller decides whether a format
        mismatch is worth retrying.
        """
        payload: Dict[str, Any] = {
            "model": model_name,
            "input": text,
            "response_format": fmt,
        }
        # Omitted rather than sent as null/empty: OpenRouter rejects a request
        # with an empty voice, and only accepts an absent one — for the models
        # that document a provider-side default.
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