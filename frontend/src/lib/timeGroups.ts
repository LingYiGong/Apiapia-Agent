/**
 * 按时间把列表切成 Apple HIG 的分组小标。
 *
 * 此前同一套分组逻辑有**四条**独立实现处理同一份数据，各自的边界与排序还不完全
 * 一致：
 *   - components/chat/MobileHistoryView.tsx   （置顶 + 三段，倒序）
 *   - components/memory/MemoryView.tsx         （三段，倒序）
 *   - app/chat/page.tsx  getPinnedSorted       （只排置顶）
 *   - components/chat/Sidebar.tsx              （置顶优先 + 时间倒序的扁平排序，
 *                                               没有小标）
 *
 * 口径统一为四段：**最近 24 小时 / 最近 3 天 / 最近 7 天 / 更早**。
 *
 * 两个关键设计：
 *
 * 1. **以「此刻」为基准的滚动窗口，不是自然日。**
 *    早上一条 08:00 的记忆、下午两点看时只有 6 小时，它属于「最近 24 小时」；
 *    而按自然日（今天 00:00 起算）的旧口径它在「今天」—— 但同一句话在
 *    昨晚 23:00 看又落在「昨天」。会话/记忆这类高频时间线用滚动窗口更符合
 *    直觉：用户关心的是「多久之前」，不是「跨过了哪个零点」。
 *
 * 2. **每条记忆只落进一个桶。** 判定自新到旧短路，命中即停。所以
 *    「最近 24 小时」里不会出现同时满足 3 天窗口的条目，各段互斥、条数之和
 *    等于总数（此前「过去 7 天」与「今天」存在重叠，需要靠文案解释才不歧义）。
 */

/** 分组内的时间键（不含置顶）。按新→旧排列。 */
export type TimeBucketKey = "last24h" | "last3d" | "last7d" | "earlier";

/** 完整分组键：置顶组 + 四个时间桶。 */
export type GroupKey = "pinned" | TimeBucketKey;

export interface TimeSection<T> {
  key: GroupKey;
  title: string;
  items: T[];
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * 各桶的跨度（毫秒），按新→旧排列。
 *
 * 这里是**滚动窗口**的长度，不是「含今天在内的天数」—— 那种按自然日对齐的
 * 写法无法表达「最近 24 小时」这种非零点对齐的窗口。
 */
export const TIME_BUCKET_SPANS: { key: TimeBucketKey; spanMs: number }[] = [
  { key: "last24h", spanMs: 1 * DAY_MS },
  { key: "last3d", spanMs: 3 * DAY_MS },
  { key: "last7d", spanMs: 7 * DAY_MS },
];

/** 分组小标文案。与滚动窗口语义一一对应，用户可自行推算边界。 */
const BUCKET_TITLES: Record<TimeBucketKey, string> = {
  last24h: "最近 24 小时",
  last3d: "最近 3 天",
  last7d: "最近 7 天",
  earlier: "更早",
};

export interface GroupOptions<T> {
  /** 取每项的时间戳（毫秒）。无法解析时返回 0，会落进「更早」。 */
  getTime: (item: T) => number;
  /** 可选的置顶判定。传入后才会在最前面产出 pinned 组。 */
  isPinned?: (item: T) => boolean;
  /** 置顶项内部的排序键（通常是 pin_order）。不传则沿用传入顺序。 */
  getPinOrder?: (item: T) => number;
  /** 置顶组的小标文案，默认「置顶对话」。 */
  pinnedTitle?: string;
}

/**
 * 判定一条时间戳落进哪个桶。
 *
 * 暴露出来是为了让调用方（以及将来的测试）能复用同一套判定，而不必各自重写
 * 一遍 `if (t >= x) ... else if (t >= y)` 的链。
 */
export function bucketOf(timestampMs: number, now: number = Date.now()): TimeBucketKey {
  for (const { key, spanMs } of TIME_BUCKET_SPANS) {
    if (timestampMs >= now - spanMs) return key;
  }
  return "earlier";
}

/**
 * 分组并按时间倒序排列（置顶组按 pinOrder 升序）。
 * 空分组不产出，因此返回值可以直接 map 渲染，无需再判长度。
 *
 * 产出顺序：置顶（若有）→ 最近 24 小时 → 最近 3 天 → 最近 7 天 → 更早。
 */
export function groupByTimeBuckets<T>(
  items: readonly T[],
  { getTime, isPinned, getPinOrder, pinnedTitle = "置顶对话" }: GroupOptions<T>
): TimeSection<T>[] {
  const pinned: T[] = [];
  const buckets: Record<TimeBucketKey, T[]> = {
    last24h: [],
    last3d: [],
    last7d: [],
    earlier: [],
  };

  // 单次取用：一次分组只用同一个「此刻」，否则跨零点的长列表会在同一次
  // 渲染里把某些条目算进 24h、另一些算进 3d，边界看起来毫无规律。
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
  if (pinned.length > 0) sections.push({ key: "pinned", title: pinnedTitle, items: pinned });
  for (const { key } of [...TIME_BUCKET_SPANS, { key: "earlier" as TimeBucketKey }]) {
    const list = buckets[key];
    if (list.length > 0) sections.push({ key, title: BUCKET_TITLES[key], items: list });
  }
  return sections;
}

/**
 * 扁平的会话排序：置顶优先 → 置顶内按 pinOrder → 其余按最后活跃时间倒序。
 * 供没有分组小标、只有一列的场景使用（桌面侧栏）。
 */
export function sortByPinnedThenActivity<T>(
  items: readonly T[],
  getTime: (item: T) => number,
  isPinned: (item: T) => boolean,
  getPinOrder: (item: T) => number
): T[] {
  return [...items].sort((a, b) => {
    const aPinned = isPinned(a);
    const bPinned = isPinned(b);
    if (aPinned !== bPinned) return aPinned ? -1 : 1;
    if (aPinned && bPinned) {
      const diff = getPinOrder(a) - getPinOrder(b);
      if (diff !== 0) return diff;
    }
    return getTime(b) - getTime(a);
  });
}