/**
 * i18n 导出入口。
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