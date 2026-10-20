import type { LucideIcon } from "lucide-react";
import type { ModelOption } from "@/lib/models";

/**
 * ModelTierCards 的分组数据契约。
 *
 * 语言模型选择器用四张等级卡片（免费 / 正常 / 聪明 / 自定义）做第一层筛选；
 * 组件只负责渲染与过滤，具体分档由调用方决定。
 */

export interface ModelFilterGroup {
  key: string;
  label: string;
  /** 一句话说明这一档是什么（等级卡片用）。不传时只显示标题与数量。 */
  description?: string;
  /** 分类右侧显示的数字。缺省时用 `count`（列表条目数）。 */
  count: number;
  /** 去重后的模型数，避免 `:batch` / `-pro` 变体把数字灌大。 */
  distinctCount?: number;
  /** 卡片左侧图标；不传则不显示 */
  icon?: LucideIcon;
  /** 是否命中任何一条选项；为 false 时该分组不渲染 */
  available: boolean;
  match: (o: ModelOption) => boolean;
}

/** 「自定义」档的匹配谓词：不做等级限制，搜索全量目录。 */
export const allFilterMatch = () => true;
