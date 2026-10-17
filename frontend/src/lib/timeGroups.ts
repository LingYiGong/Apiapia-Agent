/**
 * 时间分组工具函数与类型定义。
 */

/**
 * 分组内的时间键（不含置顶）。按新→旧排列。
 */
export type TimeBucketKey = "last24h" | "last3d" | "last7d" | "earlier";

/** 完整分组键：置顶组 + 四个时间桶。 */
export type GroupKey = "pinned" | TimeBucketKey;

/** 每个桶的小标文案键。文案本身在词典里。 */
export const BUCKET_TITLE_KEYS: Record<TimeBucketKey, MessageKey> = {
  last24h: "common.timeGroups.last24h",
  last3d: "common.timeGroups.last3d",
  last7d: "common.timeGroups.last7d",
  earlier: "common.timeGroups.earlier",
};

export interface TimeSection<T> {
  key: GroupKey;
  title: string;
  items: T[];
}

import type { MessageKey, Translator } from "@/i18n";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** 各桶的跨度（毫秒），按新→旧排列 */
export const TIME_BUCKET_SPANS: { key: TimeBucketKey; spanMs: number }[] = [
  { key: "last24h", spanMs: 1 * DAY_MS },
  { key: "last3d", spanMs: 3 * DAY_MS },
  { key: "last7d", spanMs: 7 * DAY_MS },
];

/** 分组配置参数 */
export interface GroupOptions<T> {
  t: Translator;
  /** 取每项的时间戳（毫秒） */
  getTime: (item: T) => number;
  /** 可选的置顶判定 */
  isPinned?: (item: T) => boolean;
  /** 置顶项内部的排序键 */
  getPinOrder?: (item: T) => number;
  /** 置顶组的小标文案键，默认「置顶对话」 */
  pinnedTitleKey?: MessageKey;
}

/** 判定一条时间戳落进哪个桶 */
export function bucketOf(timestampMs: number, now: number = Date.now()): TimeBucketKey {
  for (const { key, spanMs } of TIME_BUCKET_SPANS) {
    if (timestampMs >= now - spanMs) return key;
  }
  return "earlier";
}

/**
 * 分组并按时间倒序排列（置顶组按 pinOrder 升序）。
 * 空分组不产出。
 */
export function groupByTimeBuckets<T>(
  items: readonly T[],
  {
    t,
    getTime,
    isPinned,
    getPinOrder,
    pinnedTitleKey = "common.timeGroups.pinnedConversations",
  }: GroupOptions<T>
): TimeSection<T>[] {
  const pinned: T[] = [];
  const buckets: Record<TimeBucketKey, T[]> = {
    last24h: [],
    last3d: [],
    last7d: [],
    earlier: [],
  };

  const now = Date.now();

  for (const item of items) {
    if (isPinned?.(item)) {
      pinned.push(item);
      continue;
    }
    buckets[bucketOf(getTime(item), now)].push(item);
  }

  const byTimeDesc = (a: T, b: T) => getTime(b) - getTime(a);
  for (const { key } of TIME_BUCKET_SPANS) buckets[key].sort(byTimeDesc);
  buckets.earlier.sort(byTimeDesc);

  if (getPinOrder) {
    pinned.sort((a, b) => getPinOrder(a) - getPinOrder(b));
  } else {
    pinned.sort(byTimeDesc);
  }

  const sections: TimeSection<T>[] = [];
  if (pinned.length > 0) sections.push({ key: "pinned", title: t(pinnedTitleKey), items: pinned });
  for (const { key } of [...TIME_BUCKET_SPANS, { key: "earlier" as TimeBucketKey }]) {
    const list = buckets[key];
    if (list.length > 0) sections.push({ key, title: t(BUCKET_TITLE_KEYS[key]), items: list });
  }
  return sections;
}