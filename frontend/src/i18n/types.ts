/**
 * 多语言基础设施类型定义。
 */

/** 全站支持的语言。顺序即语言选择器里的展示顺序。 */
export const LOCALES = ["zh-CN", "zh-TW", "en", "ja"] as const;

export type Locale = (typeof LOCALES)[number];

/** 未选择过语言时的兜底。与后端 core/config.py 的 DEFAULT_LOCALE 保持一致。 */
export const DEFAULT_LOCALE: Locale = "zh-CN";

export const LOCALE_STORAGE_KEY = "apiapia_locale";

/** 窄化未知值，供 localStorage / cookie / Accept-Language 的解析复用。 */
export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** 插入变量，值会被替换进文案里的 `{name}` 占位符。 */
export type TranslateValues = Record<string, string | number | undefined>;

/** 把文案树展开为点分键联合，如 `nav.chat` / `time.minutesAgo_one`。 */
export type MessageKeys<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${MessageKeys<T[K]>}`;
}[keyof T & string];

/** 复数形式的基键（带 `_one` / `_other`）。 */
export type PluralKeys<T> = MessageKeys<T> extends infer K
  ? K extends `${infer Base}_one`
    ? Base
    : never
  : never;

/** 把字面量类型放宽成字符串类型。 */
export type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> };

/** 语言元数据 */
export interface LocaleMeta {
  /** 语言母语自称 */
  nativeName: string;
  /** 英文名 */
  englishName: string;
  /** BCP-47 标签 */
  intlTag: string;
  /** 语言短代号 */
  shortName: string;
  /** ISO 639-1 语言码 */
  isoCode: string;
}