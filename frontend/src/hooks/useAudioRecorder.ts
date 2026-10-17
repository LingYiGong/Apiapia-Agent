"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { pickRecorderMimeType } from "@/lib/speech";
import { getTranslator, resolveStoredLocale } from "@/i18n/runtime";
import type { MessageKey, TranslateValues } from "@/i18n";

function tr(key: MessageKey, values?: TranslateValues): string {
  return getTranslator(resolveStoredLocale())(key, values);
}

/**
 * Hard cap on one recording.
 *
 * Not a politeness limit: OpenRouter's transcription endpoint times out
 * upstream at ~60 seconds of *processing*, so a recording long enough to
 * approach that returns an error instead of a transcript. Stopping at 60s of
 * wall-clock recording keeps the request comfortably inside it and still gives
 * the user a usable transcript of whatever they managed to say.
 */
export const MAX_RECORDING_SECONDS = 60;

/** How often the level meter samples the analyser. ~20fps is smooth enough. */
const METER_INTERVAL_MS = 50;

export interface RecordedAudio {
  blob: Blob;
  mimeType: string;
}

export interface UseAudioRecorderOptions {
  /**
   * Called when recording stops itself at MAX_RECORDING_SECONDS.
   *
   * This exists because the hook owns the cap but not the transcription: the
   * timer cannot return its blob through `stop()`, whose promise belongs to
   * whoever called it. Without this, hitting the limit would silently discard
   * the recording — the user's microphone was open for a full minute and the
   * result would vanish.
   */
  onAutoStop?: (audio: RecordedAudio) => void;
}

/**
 * Mic recording via MediaRecorder.
 *
 * Browser-only by design: every client of this app is already a browser (or a
 * Capacitor WebView wrapping one), and getUserMedia is the only capture path
 * that needs no system dependency, no audio device passthrough into a
 * container, and no extra port in the compose file.
 *
 * The thing this hook is careful about is not leaking the microphone. Every
 * track opened here is stopped in `release`, and cleanup runs both when
 * recording stops normally and when the component unmounts mid-recording. A
 * held-open stream keeps the browser's recording indicator lit forever and
 * keeps capturing audio long after the user believes they stopped.
 */
export interface AudioRecorder {
  isRecording: boolean;
  /** Seconds elapsed in the current recording. */
  elapsed: number;
  /** Current input amplitude, 0..1. Drives the meter; 0 while idle. */
  level: number;
  /** A user-facing message, or null. Cleared by the next start(). */
  error: string | null;
  /** True when this browser cannot record at all. Disables the mic button. */
  unsupported: boolean;
  start: () => Promise<void>;
  /** Stop and return the audio, or null if nothing usable was captured. */
  stop: () => Promise<RecordedAudio | null>;
  /** Stop and discard. */
  cancel: () => void;
  /** Dismiss the current error. */
  clearError: () => void;
}

export function useAudioRecorder(options: UseAudioRecorderOptions = {}): AudioRecorder {
  const { onAutoStop } = options;

  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const mimeRef = useRef<string | undefined>(undefined);
  const startedAtRef = useRef<number>(0);
  const tickRef = useRef<number | null>(null);
  const meterRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const stopTimerRef = useRef<number | null>(null);

  const stopRef = useRef<(() => Promise<RecordedAudio | null>) | null>(null);
  const onAutoStopRef = useRef<((audio: RecordedAudio) => void) | undefined>(undefined);
  onAutoStopRef.current = onAutoStop;

  const [unsupported] = useState(
    () =>
      typeof window !== "undefined" &&
      (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined")
  );

  /** Release the mic and every derived resource. Safe to call when idle. */
  const release = useCallback(() => {
    if (stopTimerRef.current !== null) {
      window.clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    if (tickRef.current !== null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (meterRef.current !== null) {
      window.clearInterval(meterRef.current);
      meterRef.current = null;
    }
    if (streamRef.current) {
      // Stopping the tracks is what actually turns off the microphone; dropping
      // the MediaStream reference alone does not.
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      // close() rejects if the context never started. The recorder is already
      // dead by this point, so there is nothing useful to report about it.
      void audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
    setLevel(0);
    setIsRecording(false);
    setElapsed(0);
  }, []);

  // Unmount mid-recording must not leave the mic open.
  useEffect(() => release, [release]);

  const stop = useCallback(async (): Promise<RecordedAudio | null> => {
    const recorder = recorderRef.current;
    if (!recorder) return null;

    // Hold the array by reference. release() later rebinds chunksRef.current to
    // a fresh array rather than emptying this one, so the local binding keeps
    // the data.
    const chunks = chunksRef.current;

    const finished = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });
    if (recorder.state !== "inactive") {
      recorder.stop();
    }
    await finished;

    // Read the effective mime type before release() drops the recorder:
    // MediaRecorder normalises whatever it was constructed with, so this is
    // the authoritative answer to "what format is this blob actually in".
    const finalMime = recorder.mimeType || mimeRef.current || "audio/webm";
    release();

    if (chunks.length === 0) {
      setError(tr("chat.speech.noAudioCaptured"));
      return null;
    }
    return { blob: new Blob(chunks, { type: finalMime }), mimeType: finalMime };
  }, [release]);

  stopRef.current = stop;

  const start = useCallback(async () => {
    if (unsupported) {
      setError(tr("chat.speech.unsupportedHint"));
      return;
    }
    // Already rolling: ignore the second tap rather than orphaning the first
    // recorder (and leaving its mic track open).
    if (recorderRef.current) return;

    setError(null);
    setElapsed(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;

      const mimeType = pickRecorderMimeType();
      mimeRef.current = mimeType;
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        // Timeslice slices below ~1KB are the recorder priming itself; keeping
        // them costs nothing but adds empty work to the upload.
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.start();
      setIsRecording(true);
      startedAtRef.current = Date.now();

      tickRef.current = window.setInterval(() => {
        setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }, 250);

      // ── Level meter ──
      // Best-effort: a browser that refuses an AudioContext should still record
      // fine, so every failure here is swallowed and the meter simply sits at 0.
      try {
        const Ctor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (Ctor) {
          const ctx = new Ctor();
          audioCtxRef.current = ctx;
          const source = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 512;
          source.connect(analyser);
          analyserRef.current = analyser;

          const buffer = new Uint8Array(analyser.fftSize);
          meterRef.current = window.setInterval(() => {
            const node = analyserRef.current;
            if (!node) return;
            node.getByteTimeDomainData(buffer);
            let sumSquares = 0;
            for (let i = 0; i < buffer.length; i++) {
              const centred = (buffer[i] - 128) / 128;
              sumSquares += centred * centred;
            }
            // RMS in a quiet room is ~0.02, so the raw value leaves the meter
            // looking dead until someone speaks. Scaling by 4 and clamping puts
            // normal speech across most of the range.
            const rms = Math.sqrt(sumSquares / buffer.length);
            setLevel(Math.min(1, rms * 4));
          }, METER_INTERVAL_MS);
        }
      } catch {
        // Meter unavailable; recording proceeds without it.
      }

      stopTimerRef.current = window.setTimeout(() => {
        void (async () => {
          const audio = await stopRef.current?.();
          if (audio) onAutoStopRef.current?.(audio);
        })();
      }, MAX_RECORDING_SECONDS * 1000);
    } catch (err) {
      release();
      setError(describeMicError(err));
    }
  }, [unsupported, release]);

  const cancel = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      // Clear onstop first: release() already tore the recorder down, and this
      // must not resolve into the stop() path with discarded chunks.
      recorder.onstop = null;
      recorder.stop();
    }
    release();
  }, [release]);

  const clearError = useCallback(() => setError(null), []);

  return {
    isRecording,
    elapsed,
    level,
    error,
    unsupported,
    start,
    stop,
    cancel,
    clearError,
  };
}

/** Turn a getUserMedia rejection into something a user can act on. */
function describeMicError(err: unknown): string {
  const name = (err as { name?: string })?.name || "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return tr("chat.speech.micDenied");
    case "NotFoundError":
    case "DevicesNotFoundError":
      return tr("chat.speech.micNotFound");
    case "NotReadableError":
    case "TrackStartError":
      return tr("chat.speech.micBusy");
    case "OverconstrainedError":
      return tr("chat.speech.micUnsupportedParams");
    default:
      return tr("chat.speech.micStartFailed", {
        reason: (err as Error)?.message || tr("chat.speech.unknownError"),
      });
  }
}