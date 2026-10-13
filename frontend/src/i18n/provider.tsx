"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { DEFAULT_LOCALE } from "./types";
import type { Locale } from "./types";
import { getTranslator, persistLocale, resolveStoredLocale } from "./runtime";
import type { Translator } from "./runtime";
import { createFormatters } from "./format";
import type { Formatters } from "./format";

export interface I18nContextValue {
  locale: Locale;
  t: Translator;
  /** 绑定了当前语言的格式化函数集合，身份随 locale 变化而稳定。 */
  fmt: Formatters;
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

/**
 * 服务端没有「绘制」这回事，useLayoutEffect 在 SSR 会告警，因此服务端退化成
 * useEffect；浏览器里仍然是 layout effect —— 这是首屏不闪的关键。
 */
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** 把语言写到 <html lang> 上，读屏软件据此选择朗读发音。 */
function applyDocumentLang(locale: Locale) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = locale;
  document.documentElement.dataset.locale = locale;
}

/**
 * 把标题与描述同步到文档头部。
 *
 * 为什么不放在 layout.tsx 的 `generateMetadata()` 里读 cookie：静态导出
 * （Cloudflare Pages，`output: "export"`）没有请求，任何服务端 API 都会让
 * 整批路由预渲染失败：
 *
 *     Route /login with `dynamic = "error"` couldn't be rendered statically
 *     because it used `cookies`
 *
 * 改到客户端后两种部署形态共用同一条路径。代价是首屏那一瞬的标题是
 * 默认语言（烘进 HTML 的那个）—— 用 layout effect 在绘制前改掉，用户看不到。
 */
function applyDocumentTitle(t: Translator) {
  if (typeof document === "undefined") return;
  document.title = t("meta.appName");
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.setAttribute("content", t("meta.appDescription"));
}

/**
 * 全应用唯一的语言来源，挂在 app/layout.tsx 的最外层。
 *
 * **为什么首帧不做语言探测。** 服务端渲染出的 HTML 里语言是默认语言，
 * 首次客户端渲染必须与它逐字一致，否则 React 报 hydration mismatch，
 * 严重时整棵子树会被丢弃重建 —— 于是反而更糟：既闪，又慢，还丢状态。
 * 所以探测放进 layout effect：它在浏览器绘制之前执行完毕，用户看不到
 * 「先闪一下默认语言再跳变」这个中间态。
 *
 * 同类坑本项目已经踩过一次：hooks/useWebSearchMode.ts 早期把 localStorage
 * 读在 useState 的初始化函数里，那才会真正造成首屏不一致，所以那个 hook
 * 至今保持「挂载后再读」的写法。
 *
 * 放在 ThemeProvider 内层还是外层：无依赖，两边都行。放最外层是因为
 * Toaster 的提示文案、404/错误边界也要能取到 t。
 */
export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useIsomorphicLayoutEffect(() => {
    const stored = resolveStoredLocale();
    if (stored !== DEFAULT_LOCALE) setLocaleState(stored);
    applyDocumentLang(stored);
    // 标题按**实际读到的**语言写，而不是 state 里的默认语言：首屏可能直接从
    // localStorage 恢复成英文，而 state 要等下一次渲染才同步。
    applyDocumentTitle(getTranslator(stored));
    // 只在挂载时跑一次。语言只在用户主动切换时改变；刻意**不**监听 storage
    // 事件做多标签页同步 —— 那会让「A 标签页正在编辑的文案」在 B 标签页
    // 切语言时突然变形，与主题的行为保持一致。
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    persistLocale(next);
    applyDocumentLang(next);
    applyDocumentTitle(getTranslator(next));
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      t: getTranslator(locale),
      fmt: createFormatters(locale),
      setLocale,
    }),
    [locale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n 必须在 <I18nProvider> 内使用");
  }
  return ctx;
}