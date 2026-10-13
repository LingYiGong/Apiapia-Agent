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

/**
 * 三档模式的 toast 文案。存的是**键**，不是字符串 ——
 * 此前这里写死中文，于是切到英文界面点一下联网检索开关，
 * 弹出来的还是一句中文，而它在同一个 hook 里、和界面上其他文案挨着。
 *
 * 读取走 getTranslator(resolveStoredLocale()) 而不是 hook：这个 hook 的
 * toggle 是事件回调，拿不到 React 上下文，而这两条文案不在渲染期，
 * 因此不需要订阅语言变化。
 */
const FEEDBACK_KEYS: Record<WebSearchMode, { title: string; description: string }> = {
  on: { title: "chat.webSearch.toastOnTitle", description: "chat.webSearch.toastOnDesc" },
  off: { title: "chat.webSearch.toastOffTitle", description: "chat.webSearch.toastOffDesc" },
  auto: { title: "chat.webSearch.toastAutoTitle", description: "chat.webSearch.toastAutoDesc" },
};

function feedbackFor(mode: WebSearchMode, t: Translator) {
  const keys = FEEDBACK_KEYS[mode];
  return { title: t(keys.title as never), description: t(keys.description as never) };
}

/**
 * 联网检索模式（auto / on / off）。
 *
 * 此前这段逻辑内联在 chat/page.tsx 里，含 localStorage 读写、服务端 PATCH 与
 * 三段 toast 文案。抽出来后有两处实质收益：
 *   1. **首屏不再有 hydration 风险**：原来用 useState 的初始化函数读
 *      localStorage，服务端渲染时它返回默认值、客户端首帧返回本地值，
 *      同一个按钮在不同环境下渲染出不同字样。
 *   2. updater 保持纯函数：React StrictMode 会把 updater 调两次，
 *      副作用（写 localStorage、发 PATCH、弹 toast）必须留在 handler 里。
 */
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
