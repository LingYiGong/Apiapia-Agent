"use client";

import { useCallback, useRef, useState } from "react";
import { apiRequest } from "@/lib/api";
import { toast } from "sonner";
import { getTranslator, resolveStoredLocale } from "@/i18n/runtime";
import type { Translator } from "@/i18n/runtime";

export type WebSearchMode = "auto" | "on" | "off";

const STORAGE_KEY = "apiapia_web_search_mode";
const MODES: WebSearchMode[] = ["auto", "on", "off"];

const NEXT: Record<WebSearchMode, WebSearchMode> = {
  auto: "on",
  on: "off",
  off: "auto",
};

/** 三档模式的 toast 文案键 */
const FEEDBACK_KEYS: Record<WebSearchMode, { title: string; description: string }> = {
  on: { title: "chat.webSearch.toastOnTitle", description: "chat.webSearch.toastOnDesc" },
  off: { title: "chat.webSearch.toastOffTitle", description: "chat.webSearch.toastOffDesc" },
  auto: { title: "chat.webSearch.toastAutoTitle", description: "chat.webSearch.toastAutoDesc" },
};

function feedbackFor(mode: WebSearchMode, t: Translator) {
  const keys = FEEDBACK_KEYS[mode];
  return { title: t(keys.title as never), description: t(keys.description as never) };
}

/** 联网检索模式（auto / on / off）管理 hook */
export function useWebSearchMode() {
  const [mode, setMode] = useState<WebSearchMode>("auto");
  const modeRef = useRef<WebSearchMode>("auto");
  const [ready, setReady] = useState(false);

  /** 服务端值优先，写回本地镜像（设备间同步的来源）。 */
  const applyFromServer = useCallback((serverMode: unknown) => {
    if (typeof serverMode !== "string" || !MODES.includes(serverMode as WebSearchMode)) {
      setReady(true);
      return;
    }
    const next = serverMode as WebSearchMode;
    modeRef.current = next;
    setMode(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* 隐私模式下 localStorage 不可写，忽略 */
    }
    setReady(true);
  }, []);

  /**
   * 挂载后读一次本地镜像，避免首屏闪烁。
   * 服务端值随后由 applyFromServer 覆盖。
   */
  const hydrateFromStorage = useCallback(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && MODES.includes(saved as WebSearchMode)) {
        modeRef.current = saved as WebSearchMode;
        setMode(saved as WebSearchMode);
      }
    } catch {
      /* 读失败就用默认 auto */
    }
    setReady(true);
  }, []);

  const toggle = useCallback(() => {
    const next = NEXT[modeRef.current];
    modeRef.current = next;
    setMode(next);

    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* 忽略 */
    }

    // Persist to the account so it survives a device change.
    void apiRequest("/settings", {
      method: "PATCH",
      body: JSON.stringify({ web_search_mode: next }),
    }).catch(() => {
      /* 偏好已在本机生效，服务端失败不阻断 */
    });

    const t = getTranslator(resolveStoredLocale());
    const feedback = feedbackFor(next, t);
    toast.success(feedback.title, {
      description: feedback.description,
      duration: 2200,
    });
  }, []);

  return { mode, modeRef, ready, toggle, applyFromServer, hydrateFromStorage };
}
