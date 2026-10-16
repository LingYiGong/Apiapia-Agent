import type { LucideIcon } from "lucide-react";
import type { ModelOption } from "@/lib/models";

/**
 * ModelPicker 分组筛选的数据契约。
 *
 * ── 为什么独立成文件 ──────────────────────────────────────────────
 * 这些类型原先住在 ModelPicker.tsx 里，但 ModelPicker 要 import
 * ModelFilterChips，而 ModelFilterChips 又需要这个类型 —— 于是形成
 * ModelPicker ↔ ModelFilterChips 的循环依赖。这里只放类型与纯函数，
 * 不 import 任何 React 组件，循环就被切断了。
 *
 * ── 为什么没有「tone / 配色」字段 ──────────────────────────────────
 * 旧实现里每个分组带一个 tone（free 绿 / featured 琥珀 / accent 主色），
 * 选中时整颗胶囊填成对应颜色。这个配色本身是错的：7 个分组里混着三种不同
 * 性质的语义 ——「综合推荐」是**排序地位**、「写作翻译/深度思考/编程开发/
 * 看图识文」是**能力维度**、「极速免费」是**价格约束**、「全部」是兜底。
 * 给它们各配一种醒目颜色，等于在视觉上宣称「这几项是可比的同类选项」，
 * 而用户真正要做的比较（这个模型值不值这个价）恰恰横跨不同性质的分组。
 * 现在取消字段本身，让调用方无法再通过颜色暗示错误的可比性。
 */

/** 一个可选的筛选分组。调用方自己决定按什么维度切，组件只负责筛选与渲染。 */
export interface ModelFilterGroup {
  key: string;
  label: string;
  /**
   * 分类右侧显示的数字。缺省时用 `count`（列表条目数）。
   * 传去重后的模型数会让「编程 (5)」这种数字如实反映有多少个**不同**的模型，
   * 而不是被 `:batch` / `-pro` 变体灌大。列表本身仍按条目渲染。
   */
  count: number;
  /** 见 count。 */
  distinctCount?: number;
  /** 胶囊左侧图标；不传则不显示 */
  icon?: LucideIcon;
  /**
   * 所属区块（如「按场景选型」）。**连续相同的 section 会并成一块**，块与块
   * 之间由组件插一根竖线 —— 分组因此在视觉上是几种不同的东西，而不是一串
   * 同类选项。section 为空的分组各自独立成块，所以排在最前的「推荐」和排在
   * 最后的「全部」不会被并进中间的「按场景选型」。
   */
  section?: string;
  /** 是否命中任何一条选项；为 false 时该分组不渲染 */
  available: boolean;
  match: (o: ModelOption) => boolean;
}

/**
 * 一块筛选胶囊。`section` 相同且相邻的分组会被合并进同一块，块与块之间
 * 由组件插竖线分隔。
 */
export interface ModelFilterBlock {
  /** 用块内第一个分组的 key 作为 React key 与调试标识 */
  id: string;
  /** 块归属；undefined 表示这一块不属于任何语义区块（如「推荐」「全部」） */
  section?: string;
  groups: ModelFilterGroup[];
}

/**
 * 把扁平的分组列表按 `section` 切成若干块。
 *
 * 旧实现是逐行比较 `prev.section !== group.section` 来决定「要不要画分隔线 /
 * 块标题」，逻辑散在渲染函数里。现在一次性算好，渲染层只负责画。
 *
 * 关键点：**section 为 undefined 的分组各自单独成块**，所以排在最前的
 * 「推荐」和排在最后的「全部」不会被并进中间的「按场景选型」，视觉上
 * 也不会被误读成场景之一 —— 它们本来就不是同一类东西。
 */
export function buildFilterBlocks(
  groups: readonly ModelFilterGroup[]
): ModelFilterBlock[] {
  const blocks: ModelFilterBlock[] = [];

  for (const group of groups) {
    const tail = blocks[blocks.length - 1];
    if (tail && tail.section === group.section) {
      tail.groups.push(group);
    } else {
      blocks.push({ id: group.key, section: group.section, groups: [group] });
    }
  }

  return blocks;
}

/** 三个内置筛选谓词，供适配层构建 ModelFilterGroup。 */
export const freeFilterMatch = (o: ModelOption) => o.isFree;
export const featuredFilterMatch = (o: ModelOption) => o.isFeatured;
export const allFilterMatch = () => true;
