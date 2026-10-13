/**
 * 与语言绑定的日期 / 时间 / 数字格式化。
 *
 * 全站日期时间格式化此前散在五处（lib/format.ts、MemoryView、MemorySidebar、
 * MobileHistoryView、ChatMessageItem 各写一份），且**只有一份是中文化的** ——
 * 「刚刚 / 12分钟前」在时间线里出现频率最高，却也最需要按语言变。
 *
 * 这里收口成 `createFormatters(locale)`：一次性产出一组绑定了语言的函数，
 * 组件通过 `useI18n().fmt` 拿到（已 memo，身份稳定，可以安全进依赖数组）。
 * 保持函数身份稳定很重要 —— 否则每次渲染都换新对象，任何依赖它的
 * useCallback / useMemo 都会被无谓地打散。
 *
 * 无法解析的时间戳一律返回空串（统一口径），而不是原始 ISO 原文 ——
 * 后者会在窄小的时间戳位置里塞进一整串 ISO，既挤又对用户没有意义。
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
      // 格式选项只能在**构造**时传入 —— Intl.NumberFormat.prototype.format
      // 只接受一个值。之前写成 format(value, options) 在 ES5 lib 下直接编译不过，
      // 而且即便某些 lib 放宽了签名，那种写法每次调用都会新建一个 formatter。
      return options ? new Intl.NumberFormat(intlTag, options).format(value) : intl().format(value);
    },

    percent(ratio, digits = 1) {
      if (!Number.isFinite(ratio)) return "—";
      // style: "percent" 本身就会把 0.42 渲染成 42%，不要再手工 ×100 ——
      // 那会让 0.42 变成 4200%。
      return new Intl.NumberFormat(intlTag, {
        style: "percent",
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(ratio);
    },

    /**
     * 美元金额。
     *
     * 刻意硬编码 $ 而不用用户所在地区的 `style: "currency"` —— 后端统一以
     * 美元计价结算，跟随地区显示成日元/欧元会让人误以为账单被换算了。
     */
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