/**
 * 按时间把列表切成 Apple HIG 的分组小标。
 *
 * 此前同一套「置顶 / 今天 / 过去 7 天 / 更早」逻辑有**四条**独立实现处理同一份
 * 数据，各自的边界与排序还不完全一致：
 *   - components/chat/MobileHistoryView.tsx:535   （置顶 + 三段，倒序）
 *   - components/memory/MemoryView.tsx:103        （三段，倒序）
 *   - app/chat/page.tsx:488  getPinnedSorted     （只排置顶）
 *   - components/chat/Sidebar.tsx:37 sortConversations（置顶优先 + 时间倒序的
 *     扁平排序，没有小标）
 *
 * 其中「过去 7 天」的起点各处都写作 `startOfToday - 6 * 24h`，即**含今天在内的
 * 7 天**；而小标写的是「过去 7 天」，字面上容易被读成「不含今天的前 7 天」。
 * 这里统一成含今天的 7 天，并把该语义写进常量名，避免下次再各算各的。
 */

/** 分组内的时间键（不含置顶）。 */
export type TimeBucketKey = "today" | "pastWeek" | "earlier";

/** 完整分组键：置顶组 + 三个时间桶。 */
export type GroupKey = "pinned" | TimeBucketKey;

export interface TimeSection<T> {
  key: GroupKey;
  title: string;
  items: T[];
}

/** 「过去 7 天」含今天在内的天数。与各处 `6 * 24h` 的写法对应。 */
export const PAST_WEEK_SPAN_INCLUSIVE_DAYS = 7;

/**
 * 把时间戳换算成「今天 00:00」的毫秒数。
 *
 * 必须用本地时区的构造器（`new Date(y, m, d)`），不能用 `setHours(0,0,0,0)` 之外的
 * 任何 UTC 换算 —— 否则东八区用户的「今天」会被算成 UTC 的今天，凌晨那几个小时
 * 内的消息会掉进「过去 7 天」组。
 */
export function startOfTodayMs(now: Date = new Date()): number {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

export interface GroupOptions<T> {
  /** 取每项的时间戳（毫秒）。无法解析时返回 0，会落进「更早之前」。 */
  getTime: (item: T) => number;
  /** 可选的置顶判定。传入后才会在最前面产出 pinned 组。 */
  isPinned?: (item: T) => boolean;
  /** 置顶项内部的排序键（通常是 pin_order）。不传则沿用传入顺序。 */
  getPinOrder?: (item: T) => number;
  /** 置顶组的小标文案，默认「置顶对话」。 */
  pinnedTitle?: string;
}

const BUCKET_TITLES: Record<TimeBucketKey, string> = {
  today: "今天",
  pastWeek: "过去 7 天",
  earlier: "更早之前",
};

/**
 * 分组并按时间倒序排列（置顶组按 pinOrder 升序）。
 * 空分组不产出，因此返回值可以直接 map 渲染，无需再判长度。
 */
export function groupByTimeBuckets<T>(
  items: readonly T[],
  { getTime, isPinned, getPinOrder, pinnedTitle = "置顶对话" }: GroupOptions<T>
): TimeSection<T>[] {
  const pinned: T[] = [];
  const buckets: Record<TimeBucketKey, T[]> = { today: [], pastWeek: [], earlier: [] };

  const todayStart = startOfTodayMs();
  const weekStart = todayStart - (PAST_WEEK_SPAN_INCLUSIVE_DAYS - 1) * 24 * 60 * 60 * 1000;

  for (const item of items) {
    if (isPinned?.(item)) {
      pinned.push(item);
      continue;
    }
    const t = getTime(item);
    if (t >= todayStart) buckets.today.push(item);
    else if (t >= weekStart) buckets.pastWeek.push(item);
    else buckets.earlier.push(item);
  }

  const byTimeDesc = (a: T, b: T) => getTime(b) - getTime(a);
  buckets.today.sort(byTimeDesc);
  buckets.pastWeek.sort(byTimeDesc);
  buckets.earlier.sort(byTimeDesc);

  if (getPinOrder) {
    pinned.sort((a, b) => getPinOrder(a) - getPinOrder(b));
  } else {
    pinned.sort(byTimeDesc);
  }

  const sections: TimeSection<T>[] = [];
  if (pinned.length > 0) sections.push({ key: "pinned", title: pinnedTitle, items: pinned });
  (Object.keys(BUCKET_TITLES) as TimeBucketKey[]).forEach((key) => {
    const list = buckets[key];
    if (list.length > 0) sections.push({ key, title: BUCKET_TITLES[key], items: list });
  });
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
