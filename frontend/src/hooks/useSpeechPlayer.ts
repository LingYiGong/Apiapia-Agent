"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api";
import { speakText, splitForSpeech, textForSpeech } from "@/lib/speech";

export type SpeechPlayerState = "idle" | "loading" | "playing" | "error";

// ── Global playback slot ──
// Voice mode's automatic read-aloud and the per-message 朗读 button are separate
// hook instances, each with its own <audio> element. Without coordination they
// happily talk over each other the moment a user clicks 朗读 while a reply is
// still being read. One module-level slot makes starting a playback cancel
// whichever one was running, whichever component it belonged to.
let playerSeq = 0;
let activePlayerId: number | null = null;
let activeStopFn: (() => void) | null = null;

export interface SpeechPlayer {
  state: SpeechPlayerState;
  isBusy: boolean;
  /** A user-facing failure message, or null. */
  error: string | null;
  /**
   * Speak `text`, queueing it if something is already playing.
   *
   * Markdown is stripped first (see textForSpeech), and long text is synthesized
   * and played in sentence-aligned chunks so a 2000-word answer does not hit the
   * per-request character cap.
   *
   * Returns false when there was nothing to say.
   */
  speak: (text: string) => Promise<boolean>;
  /** Stop immediately and drop anything queued. */
  stop: () => void;
  clearError: () => void;
}

/**
 * Sequentially synthesizes and plays text through the account's TTS model.
 *
 * Shared rather than written per-caller because the non-obvious parts all live
 * here: chunked synthesis, an <audio> element that has to be reused across
 * chunks, revoking object URLs on every path including failure, and tearing the
 * whole thing down on unmount so a bubble that unmounts mid-playback does not
 * leave audio running. Two copies of this is how one of them ends up leaking a
 * blob per replay.
 *
 * Used by the per-message read-aloud button and by voice mode's automatic
 * read-aloud after a reply finishes.
 */
export function useSpeechPlayer(): SpeechPlayer {
  const [state, setState] = useState<SpeechPlayerState>("idle");
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  // Stable identity for this instance, for the global slot above. -1 means
  // "not assigned yet"; player ids start at 1 so the sentinel is unambiguous.
  const idRef = useRef<number>(-1);
  if (idRef.current === -1) {
    playerSeq += 1;
    idRef.current = playerSeq;
  }
  const myId = idRef.current;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Explicit teardown: an <audio> left playing keeps fetching, and the
      // object URL keeps the whole blob alive for the tab's lifetime.
      abortRef.current?.abort();
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
      }
      // Release the slot only if we still hold it — otherwise unmounting a
      // finished player would cancel whoever took over from us.
      if (activePlayerId === myId) {
        activePlayerId = null;
        activeStopFn = null;
      }
    };
  }, [myId]);

  const stop = useCallback(() => {
    // The abort cancels any in-flight synthesis for a later chunk; the pause is
    // what actually silences audio already handed to the element.
    abortRef.current?.abort();
    abortRef.current = null;
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
    }
    setState("idle");
  }, []);

  /**
   * Play one already-synthesized blob, resolving when it finishes.
   *
   * `onStart` fires only once `play()` has actually resolved, so callers do not
   * report "playing" before anything is audible — and so a play() rejected for
   * lack of a user gesture surfaces as a failure instead of a silent hang.
   */
  const playUrl = useCallback(
    (url: string, signal: AbortSignal, onStart: () => void): Promise<void> => {
      return new Promise<void>((resolve, reject) => {
        let audio = audioRef.current;
        if (!audio) {
          audio = new Audio();
          audio.preload = "auto";
          audioRef.current = audio;
        }
        const el = audio;

        const cleanup = () => {
          el.removeEventListener("ended", onEnded);
          el.removeEventListener("error", onFailed);
        };
        const onEnded = () => {
          cleanup();
          resolve();
        };
        const onFailed = () => {
          cleanup();
          reject(new Error("音频播放失败"));
        };
        el.addEventListener("ended", onEnded);
        el.addEventListener("error", onFailed);
        el.src = url;
        el.play()
          .then(() => {
            if (!signal.aborted) onStart();
          })
          .catch((err) => {
            cleanup();
            reject(err);
          });

        signal.addEventListener(
          "abort",
          () => {
            cleanup();
            // Rejecting rather than resolving is what stops the caller's loop
            // from advancing to the next chunk after a stop.
            reject(new DOMException("Aborted", "AbortError"));
          },
          { once: true }
        );
      });
    },
    []
  );

  const speak = useCallback(
    async (rawText: string): Promise<boolean> => {
      const speakable = textForSpeech(rawText);
      if (!speakable) {
        setError("没有可朗读的内容");
        return false;
      }

      // A new request supersedes whatever is playing — including a player owned
      // by a different component. This is a toggle-style button, so replacement
      // is the common case and overlapping audio never is.
      if (activeStopFn && activePlayerId !== myId) {
        activeStopFn();
      }
      activePlayerId = myId;
      activeStopFn = stop;
      stop();

      const controller = new AbortController();
      abortRef.current = controller;
      setState("loading");

      try {
        const chunks = splitForSpeech(speakable);
        for (const chunk of chunks) {
          if (controller.signal.aborted) return false;

          const blob = await speakText(chunk, { signal: controller.signal });
          if (controller.signal.aborted || !mountedRef.current) return false;

          const url = URL.createObjectURL(blob);
          try {
            await playUrl(url, controller.signal, () => setState("playing"));
          } finally {
            // Revoke on every path including failure, or each retry leaks a
            // whole audio file for as long as the tab is open.
            URL.revokeObjectURL(url);
          }
        }
        if (mountedRef.current && !controller.signal.aborted) setState("idle");
        return true;
      } catch (err) {
        if (controller.signal.aborted || !mountedRef.current) return false;
        console.error("Speech playback failed:", err);
        setState("error");
        setError(
          err instanceof ApiError ? err.message : "语音合成失败，请稍后重试"
        );
        return false;
      }
    },
    [playUrl, stop, myId]
  );

  const clearError = useCallback(() => setError(null), []);

  return {
    state,
    isBusy: state === "loading" || state === "playing",
    error,
    speak,
    stop,
    clearError,
  };
}