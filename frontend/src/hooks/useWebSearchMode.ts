"use client";

import { useCallback, useRef, useState } from "react";
import { apiRequest } from "@/lib/api";
import { toast } from "sonner";

export type WebSearchMode = "auto" | "on" | "off";

const STORAGE_KEY = "apiapia_web_search_mode";
const MODES: WebSearchMode[] = ["auto", "on", "off"];

const NEXT: Record<WebSearchMode, WebSearchMode> = {
  auto: "on",
  on: "off",
  off: "auto",
};

const FEEDBACK: Record<WebSearchMode, { title: string; description: string }> = {
  on: { title: "🌐 联网检索：强制开启", description: "每次提问都将强制检索互联网最新信息" },
  off: { title: "🌐 联网检索：已关闭", description: "仅使用模型自身知识回答，不联网搜索" },
  auto: { title: "🌐 联网检索：智能自动", description: "系统将根据问题自动判断是否全网搜索" },
};

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

    toast.success(FEEDBACK[next].title, {
      description: FEEDBACK[next].description,
      duration: 2200,
    });
  }, []);

  return { mode, modeRef, ready, toggle, applyFromServer, hydrateFromStorage };
}
