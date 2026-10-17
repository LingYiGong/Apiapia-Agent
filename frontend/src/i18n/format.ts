/**
 * 与语言绑定的日期 / 时间 / 数字格式化。
 */

import { LOCALE_META, getTranslator } from "./runtime";
import type { Translator } from "./runtime";
import type { Locale } from "./types";

const pad = (n: number) => String(n).padStart(2, "0");

/** 解析为时间戳；无法解析返回 null（调用方据此决定显示策略）。 */
function toTime(iso?: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

export interface Formatters {
  /** 绝对时间 `YYYY-MM-DD HH:mm:ss`（本地时区，四种语言同形）。 */
  dateTime: (iso?: string | null) => string;
  /** 时刻 `HH:mm:ss`（消息气泡旁的回复时间）。12/24 小时制跟随语言。 */
  clock: (iso?: string | null) => string;
  /** 长日期，用于用量统计的日期轴。 */
  longDate: (iso?: string | null) => string;
  /** 月日，超过 30 天的相对时间退化为此形态。 */
  monthDay: (iso?: string | null) => string;
  /** 相对时间：刚刚 / 12 分钟前 / 3 小时前 / 5 天前 / 月日。 */
  relativeTime: (iso?: string | null) => string;
  /** 时长（毫秒 → 秒）。 */
  duration: (ms?: number | null, digits?: number) => string;
  /** 文件体积 `0 B / 1.0 KB / 3.4 MB`（四种语言同形）。 */
  fileSize: (bytes?: number | null) => string;
  /** 千分位分隔的整数，用于 token 数与调用次数。 */
  number: (value: number, options?: Intl.NumberFormatOptions) => string;
  /** 百分比。传入 0..1 的比值。 */
  percent: (ratio: number, digits?: number) => string;
  /** 美元金额。用量页的花费列。 */
  currency: (value: number, maxDigits?: number) => string;
  /** 带语言的自称，注入 AI 提示词时用（见后端 prompt/builder.py）。 */
  languageName: () => string;
}

export function createFormatters(locale: Locale): Formatters {
  const t: Translator = getTranslator(locale);
  const intlTag = LOCALE_META[locale].intlTag;

  // NumberFormat 构造不便宜，而本函数每种语言只在 provider 里真正构造一次，
  // 这里再缓存一次纯粹是为了让外部（非 React 调用方）重复调用时也不重复付代价。
  let intlCache: Intl.NumberFormat | null = null;
  const intl = () => (intlCache ??= new Intl.NumberFormat(intlTag));

  const clockFmt = new Intl.DateTimeFormat(intlTag, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const longDateFmt = new Intl.DateTimeFormat(intlTag, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return {
    dateTime(iso) {
      const t0 = toTime(iso);
      if (t0 === null) return "";
      const d = new Date(t0);
      const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
      return `${date} ${time}`;
    },

    clock(iso) {
      const t0 = toTime(iso);
      if (t0 === null) return "";
      return clockFmt.format(new Date(t0));
    },

    longDate(iso) {
      const t0 = toTime(iso);
      if (t0 === null) return "";
      return longDateFmt.format(new Date(t0));
    },

    monthDay(iso) {
      const t0 = toTime(iso);
      if (t0 === null) return "";
      const d = new Date(t0);
      return t("common.time.monthDay", { month: d.getMonth() + 1, day: d.getDate() });
    },

    relativeTime(iso) {
      const t0 = toTime(iso);
      if (t0 === null) return "";
      const diffMs = Date.now() - t0;
      // 未来时间戳（服务器时钟漂移）按「刚刚」处理，避免出现「-1分钟前」
      if (diffMs < 0) return t("common.time.justNow");

      const diffMin = Math.floor(diffMs / 60_000);
      const diffHour = Math.floor(diffMin / 60);
      const diffDay = Math.floor(diffHour / 24);

      // 超过 30 天退化为「月日」，不再显示「N月N日前」这种冗长形态
      if (diffDay > 30) return t("common.time.monthDay", {
        month: new Date(t0).getMonth() + 1,
        day: new Date(t0).getDate(),
      });
      if (diffDay > 0) return t.plural("common.time.daysAgo", diffDay);
      if (diffHour > 0) return t.plural("common.time.hoursAgo", diffHour);
      if (diffMin > 0) return t.plural("common.time.minutesAgo", diffMin);
      return t("common.time.justNow");
    },

    /**
     * 时长（毫秒 → 秒）。
     * - < 1000ms  保留两位小数，因为思考耗时常常在几百毫秒量级，取整会全变成 0s
     * - >= 1000ms 一位小数
     */
    duration(ms, digits) {
      if (typeof ms !== "number" || !Number.isFinite(ms) || ms <= 0) return "";
      const d = digits ?? (ms < 1000 ? 2 : 1);
      return `${(ms / 1000).toFixed(d)}s`;
    },

    /**
     * 文件体积。小于 1KB 保留 0 位小数，否则出现「0.5 B」这种噪音。
     */
    fileSize(bytes) {
      if (!bytes || bytes <= 0) return "";
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    },

    number(value, options) {
      if (!Number.isFinite(value)) return "—";
      return options ? new Intl.NumberFormat(intlTag, options).format(value) : intl().format(value);
    },

    percent(ratio, digits = 1) {
      if (!Number.isFinite(ratio)) return "—";
      return new Intl.NumberFormat(intlTag, {
        style: "percent",
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(ratio);
    },

    /** 美元金额 */
    currency(value, maxDigits = 4) {
      if (!Number.isFinite(value)) return "—";
      // 小额花费（单次调用可能只有 0.00002 美元）四舍五入成 0 会让整列看着都是 0，
      // 所以动态放宽小数位：至少两位，最多到 maxDigits。
      const needed = Math.min(Math.max(maxDigits, 2), 6);
      return `$${new Intl.NumberFormat(intlTag, {
        minimumFractionDigits: 2,
        maximumFractionDigits: needed,
      }).format(value)}`;
    },

    languageName() {
      return LOCALE_META[locale].nativeName;
    },
  };
}