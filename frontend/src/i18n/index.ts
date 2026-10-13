/**
 * i18n 对外出口。
 *
 * 组件里只需要 `import { useI18n } from "@/i18n"`；
 * 非 React 场景（toast 工具、格式化函数、事件回调）用
 * `import { getTranslator, resolveStoredLocale } from "@/i18n"`。
 *
 * 不提供默认导出是有意的：默认导出会让「忘了 use 客户端 hook」的错误
 * 静默变成「拿不到文案」，而具名导入在编辑器里一眼能看出用错了层。
 */

export type { Locale, LocaleMeta, TranslateValues } from "./types";
export { LOCALES, DEFAULT_LOCALE, LOCALE_STORAGE_KEY, isLocale } from "./types";

export type { Messages, MessageKey, PluralKey, Translator } from "./runtime";
export {
  getMessages,
  getTranslator,
  LOCALE_META,
  resolveStoredLocale,
  persistLocale,
  acceptLanguageHeader,
} from "./runtime";

export type { Formatters } from "./format";
export { createFormatters } from "./format";

export type { I18nContextValue } from "./provider";
export { I18nProvider, useI18n } from "./provider";