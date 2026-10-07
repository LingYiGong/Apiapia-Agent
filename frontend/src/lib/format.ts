/**
 * 全站日期/时间/体积格式化。
 *
 * 此前同一件事散在五处：
 *   - lib/format.ts            formatDateTime
 *   - components/memory/MemoryView.tsx:42        formatFullDateTime（另一份实现，
 *     无法解析时返回 String(val) 而不是空串 → 同一条记录在记忆库里显示一整串
 *     ISO 原文，在侧栏里却是空白）
 *   - components/chat/MemorySidebar.tsx:30      formatFullDateTime（只是壳）
 *   - components/chat/MobileHistoryView.tsx:57  formatRelativeTime
 *   - components/chat/ChatMessageItem.tsx:33    formatFileSize / formatTime
 *     （工具函数住在组件里，被 ChatArea 反向 import）
 *
 * 现在全部收在这里，且**统一了无法解析时的行为**：一律返回空串。
 */

const pad = (n: number) => String(n).padStart(2, "0");

/** 解析为时间戳；无法解析返回 null（调用方据此决定显示策略）。 */
function toTime(iso?: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

/**
 * 绝对时间：`YYYY-MM-DD HH:mm:ss`（本地时区）。
 *
 * 空值或无法解析时统一返回空串。刻意**不**回退成原始字符串：那会在一个窄小的
 * 时间戳位置里塞进一整串 ISO 原文，既挤又对用户没有意义。
 */
export function formatDateTime(iso?: string | null): string {
  const t = toTime(iso);
  if (t === null) return "";
  const d = new Date(t);
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  return `${date} ${time}`;
}

/**
 * 时刻：`HH:mm:ss`（消息气泡旁的回复时间）。
 */
export function formatClock(iso?: string | null): string {
  const t = toTime(iso);
  if (t === null) return "";
  return new Date(t).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * 相对时间：`刚刚 / 12分钟前 / 3小时前 / 5天前 / 3月8日`。
 * 超过 30 天退化为「月日」，不再显示「N月N日前」这种冗长形态。
 */
export function formatRelativeTime(iso?: string | null): string {
  const t = toTime(iso);
  if (t === null) return "";
  const d = new Date(t);
  const diffMs = Date.now() - t;
  // 未来时间戳（服务器时钟漂移）按「刚刚」处理，避免出现「-1分钟前」
  if (diffMs < 0) return "刚刚";

  const diffMin = Math.floor(diffMs / 60_000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffDay > 30) return `${d.getMonth() + 1}月${d.getDate()}日`;
  if (diffDay > 0) return `${diffDay}天前`;
  if (diffHour > 0) return `${diffHour}小时前`;
  if (diffMin > 0) return `${diffMin}分钟前`;
  return "刚刚";
}

/**
 * 时长（毫秒 → 秒）。
 * - < 1000ms  保留两位小数，因为思考耗时常常在几百毫秒量级，取整会全变成 0s
 * - >= 1000ms 一位小数
 */
export function formatDuration(ms?: number | null, digits?: number): string {
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms <= 0) return "";
  const d = digits ?? (ms < 1000 ? 2 : 1);
  return `${(ms / 1000).toFixed(d)}s`;
}

/**
 * 文件体积：`0 B / 1.0 KB / 3.4 MB`。
 * 小于 1KB 保留 0 位小数，否则出现「0.5 B」这种噪音。
 */
export function formatFileSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
