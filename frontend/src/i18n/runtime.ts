/**
 * 翻译运行时的纯函数部分（不依赖 React）。
 */

import { messages as zhCN } from "./messages/zh-CN";
import { messages as zhTW } from "./messages/zh-TW";
import { messages as en } from "./messages/en";
import { messages as ja } from "./messages/ja";
import type { Locale, LocaleMeta, MessageKeys, PluralKeys, TranslateValues, Widen } from "./types";
import { DEFAULT_LOCALE, LOCALE_STORAGE_KEY, isLocale } from "./types";

/** 文案树的类型基准，取自 zh-CN。 */
export type Messages = Widen<typeof zhCN>;

/** 全部合法的文案键。写错的键在这一层就被 tsc 拦下。 */
export type MessageKey = MessageKeys<Messages>;

/** 带 `_one` / `_other` 复数档的文案，其基键。 */
export type PluralKey = PluralKeys<Messages>;

/** 对外的翻译函数接口 */
export interface Translator {
  (key: MessageKey, values?: TranslateValues): string;
  /** 按 count 选 `_one` / `_other`；缺哪档退回另一档，再退回基键。 */
  plural(key: PluralKey, count: number, values?: TranslateValues): string;
  readonly locale: Locale;
}

/** 构造期的可变形态。挂完属性后再 as 成只读的 Translator。 */
type WritableTranslator = {
  (key: string, values?: TranslateValues): string;
  plural: (key: string, count: number, values?: TranslateValues) => string;
  locale: Locale;
};

const DICTIONARIES: Record<Locale, Messages> = {
  "zh-CN": zhCN,
  "zh-TW": zhTW,
  en,
  ja,
};

export const LOCALE_META: Record<Locale, LocaleMeta> = {
  "zh-CN": {
    nativeName: "简体中文",
    englishName: "Simplified Chinese",
    intlTag: "zh-CN",
    /** 翻译功能里代表本端语言的短代号。用于 "中 ⇋ 日" 这类紧凑排版。 */
    shortName: "中",
    /** ISO 639-1。要发给模型，所以不能是 zh-CN 这种带地区的标签。 */
    isoCode: "zh",
  },
  "zh-TW": {
    nativeName: "繁體中文",
    englishName: "Traditional Chinese",
    intlTag: "zh-TW",
    shortName: "繁中",
    isoCode: "zh",
  },
  en: {
    nativeName: "English",
    englishName: "English",
    intlTag: "en",
    shortName: "EN",
    isoCode: "en",
  },
  ja: {
    nativeName: "日本語",
    englishName: "Japanese",
    intlTag: "ja",
    shortName: "日",
    isoCode: "ja",
  },
};

export function getMessages(locale: Locale): Messages {
  return DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
}

/** 按点分路径在文案树里取值。找不到返回 undefined，交给调用方决定退路。 */
function lookup(tree: Messages, path: string): string | undefined {
  let node: unknown = tree;
  for (const segment of path.split(".")) {
    if (typeof node !== "object" || node === null) return undefined;
    node = (node as Record<string, unknown>)[segment];
  }
  return typeof node === "string" ? node : undefined;
}

/** 替换 `{name}` 占位符 */
function interpolate(template: string, values?: TranslateValues): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = values[name];
    if (value === undefined) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[i18n] 文案「${template}」缺少变量 {${name}}`);
      }
      return whole;
    }
    return String(value);
  });
}

const translatorCache = new Map<Locale, Translator>();

export function getTranslator(locale: Locale): Translator {
  const cached = translatorCache.get(locale);
  if (cached) return cached;

  const dict = getMessages(locale);
  const fallbackDict = getMessages(DEFAULT_LOCALE);

  const resolve = (key: string, values?: TranslateValues): string => {
    const found = lookup(dict, key);
    if (found !== undefined) return interpolate(found, values);
    const fallback = lookup(fallbackDict, key);
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[i18n] ${locale} 缺少文案「${key}」`);
    }
    return fallback === undefined ? key : interpolate(fallback, values);
  };

  const t = ((key: string, values?: TranslateValues) => resolve(key, values)) as WritableTranslator;

  t.plural = (key, count, values) => {
    const merged = { n: count, count, ...values };
    const direct = lookup(dict, `${key}_${count === 1 ? "one" : "other"}`);
    if (direct !== undefined) return interpolate(direct, merged);
    const sibling = lookup(dict, `${key}_${count === 1 ? "other" : "one"}`);
    if (sibling !== undefined) return interpolate(sibling, merged);
    return resolve(key, merged);
  };

  t.locale = locale;

  const bound = t as unknown as Translator;
  translatorCache.set(locale, bound);
  return bound;
}

/** 不依赖 React 的语言解析，读不到时回落到默认语言 */
export function resolveStoredLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isLocale(stored)) return stored;
  } catch {
    /* 隐私模式下 localStorage 不可读，按默认语言走 */
  }
  return DEFAULT_LOCALE;
}

/** 持久化用户选择（写入 localStorage 与 cookie） */
export function persistLocale(locale: Locale): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    /* 不可写不影响本次会话 */
  }
  try {
    document.cookie = `${LOCALE_STORAGE_KEY}=${locale}; path=/; max-age=31536000; SameSite=Lax`;
  } catch {
    /* cookie 被禁用不影响本次会话 */
  }
}

/** 构造发给后端的 Accept-Language 请求头 */
export function acceptLanguageHeader(): string {
  const locale = resolveStoredLocale();
  const base = locale.split("-")[0];
  return base === locale ? locale : `${locale},${base}`;
}