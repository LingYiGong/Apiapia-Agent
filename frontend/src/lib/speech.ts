import { ApiError, getApiBase, getToken } from "./api";
import { getTranslator, resolveStoredLocale } from "@/i18n/runtime";
import type { MessageKey, TranslateValues } from "@/i18n";

/**
 * 按调用时解析翻译器。
 *
 * 这个模块全程在事件回调里跑（录音上传、朗读点击），不在渲染期，
 * 因此不需要订阅语言变化；而在模块顶部抓一份 t 反而会读到首次加载时的语言。
 */
function tr(key: MessageKey, values?: TranslateValues): string {
  return getTranslator(resolveStoredLocale())(key, values);
}

/**
 * Client for the speech endpoints (`/api/speech/*` on the backend).
 *
 * These do not go through `apiRequest` for two reasons. `/speech/speak` answers
 * with an audio byte stream, not JSON, so it needs `response.blob()` rather
 * than `response.json()` — and `/speech/transcribe` posts multipart/form-data,
 * where `apiRequest` would set a JSON Content-Type that the browser then
 * refuses to attach a multipart boundary to. Both are three lines of fetch
 * each; duplicating that beats bending the shared helper.
 */

/**
 * Mirrors the backend's SPEECH_MAX_AUDIO_BYTES. Duplicated deliberately rather
 * than fetched on every call: the backend is the real gate and will answer 413,
 * and this only saves the user a pointless upload. The two must be kept in
 * step when either changes.
 */
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

/** Mirrors the backend's SPEECH_MAX_TEXT_CHARS, for the same reason. */
export const MAX_SPEECH_CHARS = 4000;

/**
 * Recording formats to try, best first.
 *
 * Opus-in-WebM is the only choice that is both widely supported *and*
 * compressed — around 24 kbps against ~1.5 Mbps for a browser's default WAV —
 * which is what makes the 25 MB ceiling and the ~60s upstream timeout survivable
 * for a normal voice memo. The mp4/m4a entry is what Safari and iOS produce.
 *
 * Checked with `isTypeSupported` rather than assumed: passing an unsupported
 * mimeType to the MediaRecorder constructor throws on some browsers and is
 * silently ignored on others.
 */
const RECORDER_MIME_PREFERENCE = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

/** Pick a recording mimeType this browser actually supports. */
export function pickRecorderMimeType(): string | undefined {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
    return undefined;
  }
  for (const candidate of RECORDER_MIME_PREFERENCE) {
    try {
      if (MediaRecorder.isTypeSupported(candidate)) return candidate;
    } catch {
      // Older implementations throw instead of returning false.
    }
  }
  // Undefined lets the browser pick its own default, which is better than
  // refusing to record at all.
  return undefined;
}

/**
 * The filename extension that matches a recording mimeType.
 *
 * Sent as the multipart part's filename because the backend derives the audio
 * format from it, and a `MediaRecorder` Blob has no name of its own. Getting
 * this wrong is what produces an upstream "unsupported audio format" 400.
 */
function extensionForMimeType(mimeType?: string): string {
  if (!mimeType) return "webm";
  const base = mimeType.split(";")[0].trim().toLowerCase();
  if (base === "audio/webm") return "webm";
  if (base === "audio/mp4") return "m4a";
  if (base === "audio/mpeg") return "mp3";
  if (base === "audio/ogg") return "ogg";
  if (base === "audio/wav" || base === "audio/x-wav") return "wav";
  if (base === "audio/flac") return "flac";
  if (base === "audio/aac") return "aac";
  return "webm";
}

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...(extra || {}) };
  const token = getToken();
  // Same reason streamChatResponse omits it: an empty Authorization header is
  // forwarded verbatim by the /api/backend proxy, and some gateways reject ""
  // as a malformed credential with a 400 that reads as a network fault.
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function readError(response: Response, fallback: string): Promise<ApiError> {
  let detail = fallback;
  try {
    const raw = await response.text();
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        detail = parsed?.detail || parsed?.message || raw;
      } catch {
        detail = raw;
      }
    }
  } catch {
    // Body already consumed or unreadable; the fallback stands.
  }
  return new ApiError(detail, response.status);
}

export interface TranscribeOptions {
  /** ISO-639-1. Omitted means the backend auto-detects. */
  language?: string;
  /** Vocabulary hint that biases the decoder toward proper nouns. */
  prompt?: string;
  signal?: AbortSignal;
}

export interface TranscriptionResult {
  text: string;
  model: string;
  language?: string | null;
  duration?: number | null;
  usage?: Record<string, unknown>;
}

/**
 * Transcribe recorded or uploaded audio.
 *
 * Sent as multipart/form-data rather than base64: the payload is already binary
 * and base64 would cost an extra third of the bandwidth on a file that is
 * already the largest thing in the request.
 *
 * There is deliberately no `model` option. The transcription model is the
 * account's own setting, chosen in the settings page and resolved server-side;
 * letting the caller name one would be an unauthenticated way to route traffic
 * at an arbitrary, possibly unentitled, model.
 */
export async function transcribeAudio(
  blob: Blob,
  opts: TranscribeOptions & { filename?: string } = {}
): Promise<TranscriptionResult> {
  if (!blob || blob.size === 0) {
    throw new ApiError(tr("common.speech.transcribeEmpty"), 400);
  }
  if (blob.size > MAX_AUDIO_BYTES) {
    throw new ApiError(
      tr("common.speech.transcribeTooLarge", {
        size: (blob.size / (1024 * 1024)).toFixed(1),
        max: MAX_AUDIO_BYTES / (1024 * 1024),
      }),
      413
    );
  }

  const form = new FormData();
  const mimeType = blob.type || "audio/webm";
  const filename =
    opts.filename || `recording-${Date.now()}.${extensionForMimeType(mimeType)}`;
  form.append("file", blob, filename);
  if (opts.language) form.append("language", opts.language);
  if (opts.prompt) form.append("prompt", opts.prompt);

  // No Content-Type header here on purpose: the browser has to set it itself
  // so it can append the multipart boundary. Setting it to "multipart/form-data"
  // without a boundary produces a body the backend cannot parse.
  const response = await fetch(`${getApiBase()}/speech/transcribe`, {
    method: "POST",
    headers: authHeaders(),
    body: form,
    signal: opts.signal,
  });

  if (!response.ok) {
    throw await readError(response, tr("common.speech.transcribeFailed"));
  }
  return (await response.json()) as TranscriptionResult;
}

export interface SpeakOptions {
  voice?: string;
  speed?: number;
  instructions?: string;
  responseFormat?: "mp3" | "pcm";
  signal?: AbortSignal;
}

/**
 * Synthesize speech and return the audio as a Blob.
 *
 * The response is a raw audio stream, so this cannot go through `apiRequest`:
 * that parses every success as JSON and would throw on the binary body.
 *
 * Like transcription, the model is not caller-chosen — it comes from the
 * account's `tts_model` setting. `voice` is the one thing that stays per-call,
 * because it is a presentation preference within that model, and the server
 * validates it against the model's synced voice list.
 */
export async function speakText(text: string, opts: SpeakOptions = {}): Promise<Blob> {
  const trimmed = (text || "").trim();
  if (!trimmed) {
    throw new ApiError(tr("common.speech.speakEmptyText"), 400);
  }
  if (trimmed.length > MAX_SPEECH_CHARS) {
    throw new ApiError(
      tr("common.speech.speakTextTooLong", {
        count: trimmed.length,
        max: MAX_SPEECH_CHARS,
      }),
      400
    );
  }

  const response = await fetch(`${getApiBase()}/speech/speak`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      text: trimmed,
      voice: opts.voice,
      speed: opts.speed,
      instructions: opts.instructions,
      // mp3 is a *preference*, not a guarantee. Gemini TTS accepts only pcm and
      // Mistral Voxtral only mp3, so the backend negotiates and returns whatever
      // is actually playable — audio/mpeg, or audio/wav when it had to wrap raw
      // pcm in a container. Either way this receives a blob an <audio> element
      // can play, so there is nothing to handle here.
      response_format: "mp3",
    }),
    signal: opts.signal,
  });

  if (!response.ok) {
    throw await readError(response, tr("common.speech.speakFailed"));
  }
  return response.blob();
}

/**
 * Reduce a markdown reply to prose worth speaking.
 *
 * A TTS model reads its input verbatim, so handing it raw assistant markdown
 * means it pronounces code fences, table pipes, LaTeX and image URLs out loud.
 * That is worse than useless — it is several seconds of noise per answer — so
 * the structural markup is stripped first.
 *
 * This is a cheap regex pass, not a markdown parse: the goal is "remove things
 * that should not be spoken", and a real parse would cost a full render per
 * message just to throw it away.
 */
export function textForSpeech(markdown: string): string {
  if (!markdown) return "";
  return markdown
    // Reasoning blocks are internal scaffolding, never part of the answer.
    .replace(/<think>[\s\S]*?<\/think>/gi, " ")
    // Code fences, then any unterminated tail of one.
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/```[\s\S]*$/g, " ")
    // Inline code, keeping the words inside it.
    .replace(/`([^`]*)`/g, "$1")
    // Images carry no spoken content; links keep their label, not their URL.
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    // Headings, quotes, list bullets and table pipes are all structure.
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\|/g, " ")
    // Horizontal rules and bare HTML tags left by the markdown renderer.
    .replace(/^\s*([-*_]\s*){3,}$/gm, " ")
    .replace(/<\/?[a-zA-Z][^>]*>/g, " ")
    // LaTeX, inline and display.
    .replace(/\$\$[\s\S]*?\$\$/g, " ")
    .replace(/\$[^$\n]*\$/g, " ")
    // Collapse the whitespace all of the above left behind.
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/**
 * 把长文本切成不超过上限的若干段，尽量切在句末。
 *
 * Providers cap a single synthesis request (the backend caps it at
 * MAX_SPEECH_CHARS), and a long answer would otherwise either fail outright or be
 * read in one breathless rush. Cutting at a sentence boundary keeps the seams
 * inaudible; the 40% floor stops a single long clause from producing a tiny first
 * chunk followed by one enormous remainder.
 */
export function splitForSpeech(
  text: string,
  maxChars: number = MAX_SPEECH_CHARS
): string[] {
  if (!text) return [];
  if (text.length <= maxChars) return [text];

  const chunks: string[] = [];
  let rest = text;
  while (rest.length > maxChars) {
    const window = rest.slice(0, maxChars);
    let cut = -1;
    // Strongest break available first: full stop, then clause punctuation, then a
    // hard cut at the limit as the last resort.
    const patterns = [/[。！？.!?]\s*/g, /[，,、；;：:]\s*/g];
    for (const pattern of patterns) {
      let last = -1;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(window)) !== null) {
        last = match.index + match[0].length;
      }
      if (last > maxChars * 0.4) {
        cut = last;
        break;
      }
    }
    if (cut <= 0) cut = maxChars;
    const piece = rest.slice(0, cut).trim();
    if (piece) chunks.push(piece);
    rest = rest.slice(cut);
  }
  const tail = rest.trim();
  if (tail) chunks.push(tail);
  return chunks;
}