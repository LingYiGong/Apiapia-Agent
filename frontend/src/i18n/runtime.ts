/**
 * 翻译运行时的纯函数部分（不依赖 React）。
 *
 * 与 provider.tsx 分开，是因为**组件之外的代码同样需要查文案**：toast 工具、
 * 格式化函数、SSE 事件回调、乃至根布局崩溃时的 global-error.tsx。这些地方拿不到
 * hook，必须能直接用 `getTranslator(locale)` 拿一个纯函数式翻译器。
 * React 组件则通过 provider.tsx 的 useI18n() 取 t —— 那份是带 locale 依赖的，
 * 切换语言会触发重渲染；这里的不会，因为它本来就是一次性的取值。
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

/**
 * 对外的翻译函数。
 *
 * 键参数刻意收窄成 MessageKey / PluralKey：组件里 `t("setings.xxx")` 这种
 * 手误会在 `tsc --noEmit` 时直接失败，而不是上线后渲染出一串裸键名。
 */
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

/**
 * 替换 `{name}` 占位符。
 *
 * 刻意用占位符而不是字符串拼接：中文和日语里变量嵌在句子中间，拼接出来的语序
 * 无法调整；英语更是必须靠占位符才能处理「{n} minute(s) ago」这类前后缀随参数
 * 变化的情况 —— 所以四种语言的占位符名必须保持一致，翻译时不能改。
 */
function interpolate(template: string, values?: TranslateValues): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = values[name];
    if (value === undefined) {
      // 留原文比渲染成 "undefined" 好，但要在开发期吵一下 ——
      // 漏传变量在四种语言下的表现并不相同，中文常常看不出问题。
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
    // 缺键退回默认语言，而不是渲染出 "settings.foo.bar" 这种裸键名。
    // 漏译在编译期就该被抓住，走到这里说明是运行期拼出来的动态键。
    const fallback = lookup(fallbackDict, key);
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[i18n] ${locale} 缺少文案「${key}」`);
    }
    return fallback === undefined ? key : interpolate(fallback, values);
  };

  const t = ((key: string, values?: TranslateValues) => resolve(key, values)) as WritableTranslator;

  t.plural = (key, count, values) => {
    // count / n 都注入：中文文案习惯写 {n}，有些语言写 {count} 更自然，
    // 让译者不必为了迎合中式的 {n} 而硬凑别扭的句子。
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

/**
 * 不依赖 React 的语言解析。
 *
 * 两处必须用它而不能用 provider：global-error.tsx（根布局崩溃时 provider 根本
 * 没挂上），以及任何在 provider 初始化完成之前就要出字的场合。
 * 读不到（SSR / 隐私模式）时一律回落到默认语言。
 */
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

/**
 * 持久化用户选择。
 *
 * 同时写 cookie 是给未来的服务端渲染留的余地：静态导出下 HTML 是构建期产物，
 * cookie 此刻还没用上，但一旦改成 SSR / 动态部署，读 cookie 就能在首屏就出对语言，
 * 不必等 hydration 之后闪一下。
 */
export function persistLocale(locale: Locale): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    /* 不可写不影响本次会话 */
  }
  try {
    // 一年有效期；SameSite=Lax 让它不会随跨站请求外泄。
    document.cookie = `${LOCALE_STORAGE_KEY}=${locale}; path=/; max-age=31536000; SameSite=Lax`;
  } catch {
    /* cookie 被禁用不影响本次会话 */
  }
}

/**
 * 构造发给后端的 Accept-Language。
 *
 * 后端靠这个头做两件事：把错误消息与 AI 回复切到用户所选语言、以及决定
 * DuckDuckGo 抓取结果的语种（此前那里硬编码 `zh-CN,zh;q=0.9,en-US;q=0.8`）。
 * 因此它必须**只反映用户显式选择**，不能混入浏览器自身的语言列表 ——
 * 混进来之后，英文界面下的用户可能因为浏览器排在前面的 ja-JP 而收到日语错误。
 *
 * 末尾补一个裸语种标签（`ja` / `en`），让后端即使遇到未精确匹配的地区变体
 * （ja-JP、en-GB）也能落到正确语言。
 *
 * 解析 Accept-Language 的逻辑在**后端**（app/core/i18n.py），不在这里重复一份：
 * 两处各实现一次必然漂移，而漂移出来的表现是「前端认为自己发的是 en，
 * 后端却按 zh-CN 渲染了错误消息」。
 */
export function acceptLanguageHeader(): string {
  const locale = resolveStoredLocale();
  const base = locale.split("-")[0];
  return base === locale ? locale : `${locale},${base}`;
}