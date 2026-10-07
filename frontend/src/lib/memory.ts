/**
 * 记忆条目的形状归一化。
 *
 * 后端返回的记忆在不同接口下字段名并不统一（记忆库列表、对话内召回、检索结果
 * 各有各的别名），此前每个消费点各自写了一条 `as any` 兜底链：
 *   - MemoryView.tsx:112-120   `(item as any).metadata?.updated_at` 等 4 层兜底
 *   - MemoryView.tsx:457-461   `item.memory || (item as any).data || ...`
 *   - MemorySidebar.tsx:138    `m.memory || m.text || JSON.stringify(m)`
 *
 * 更糟的是时间字段的优先级**互相矛盾**：
 *   - MemoryView 取 `updated_at || metadata.updated_at || created_at || ...`
 *   - MemorySidebar 取 `created_at || metadata.created_at || updated_at || ...`
 * 于是同一条被编辑过的记忆，在记忆库里显示的是「编辑时间」、在对话侧栏里显示的
 * 却是「创建时间」，且两者都标着「已编辑」。
 *
 * 现在统一在这里做一次：调用方拿到的永远是同一份形状。
 */

/** 归一化后的记忆条目。字段非空，渲染层无需再写兜底。 */
export interface NormalizedMemory {
  /** 稳定 key。优先后端 id，退回 hash，再退回兜底串。 */
  id: string;
  /** 记忆正文。 */
  text: string;
  /** 排序与分组统一按「最近一次变化时间」，编辑过的新记忆自然浮到前面。 */
  effectiveAt: string;
  /** 是否被编辑过（编辑时间晚于创建时间）。 */
  isEdited: boolean;
  /** 归一化后的原始条目，供仍需访问 metadata / score 的场景使用。 */
  raw: Record<string, unknown>;
}

function pickString(...candidates: unknown[]): string {
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c;
  }
  return "";
}

function pickTime(...candidates: unknown[]): string {
  for (const c of candidates) {
    if (typeof c === "string" && c) return c;
    if (typeof c === "number" && Number.isFinite(c)) return new Date(c).toISOString();
  }
  return "";
}

/**
 * 归一化单条记忆。
 * `fallbackId` 用于列表里确实没有 id 的条目（例如检索结果按相似度返回裸对象）。
 *
 * 入参刻意是 `unknown`：这个函数存在的意义就是**不信任**后端返回的形状。
 * 签名若写成 `MemoryItem | Record<string, any>`，调用方（MemorySidebar 拿到的
 * 召回列表本身就是 `unknown[]`）就得先自己断言一遍 —— 等于把这份不可信原样
 * 传进来又假装它已经可信。
 */
export function normalizeMemory(
  raw: unknown,
  fallbackId = "memory",
): NormalizedMemory {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, any>;
  const meta = (r.metadata ?? {}) as Record<string, any>;

  const createdAt = pickTime(r.created_at, meta.created_at, meta.timestamp);
  const updatedAt = pickTime(r.updated_at, meta.updated_at);

  // 正文：memory 是主字段，data / text 是历史别名；实在没有就退回整体序列化，
  // 至少让用户看到内容而不是一张空白卡片。
  let text = pickString(r.memory, r.data, r.text);
  if (!text) {
    try {
      text = JSON.stringify(raw);
    } catch {
      text = "";
    }
  }

  const hasTime =
    !!createdAt && !!updatedAt && new Date(updatedAt).getTime() > new Date(createdAt).getTime();

  return {
    id: pickString(r.id, r.hash) || fallbackId,
    text,
    effectiveAt: updatedAt || createdAt,
    isEdited: hasTime,
    raw: r,
  };
}

/** 批量归一化，可选地按「最近变化时间」倒序。入参同理为 `readonly unknown[]`。 */
export function normalizeMemories(
  list: readonly unknown[] | null | undefined,
  { sort = false }: { sort?: boolean } = {},
): NormalizedMemory[] {
  const out = (list ?? []).map((item, i) => normalizeMemory(item, `mem-${i}`));
  if (sort) {
    out.sort(
      (a, b) => new Date(b.effectiveAt || 0).getTime() - new Date(a.effectiveAt || 0).getTime(),
    );
  }
  return out;
}
