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

/** 把标题与描述同步到文档头部 */
function applyDocumentTitle(t: Translator) {
  if (typeof document === "undefined") return;
  document.title = t("meta.appName");
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.setAttribute("content", t("meta.appDescription"));
}

/** 全应用多语言 Provider */
export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useIsomorphicLayoutEffect(() => {
    const stored = resolveStoredLocale();
    if (stored !== DEFAULT_LOCALE) setLocaleState(stored);
    applyDocumentLang(stored);
    applyDocumentTitle(getTranslator(stored));
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