import type {
  AudioModelItem,
  ImageModelItem,
  VideoModelItem,
  ModelCatalogItem,
} from "@/types";
import { getModelGuide, normalizeModelId, type ModelGuide } from "@/lib/modelGuide";

/** 模型目录的纯逻辑层。 */

/** 两个 API 返回体共同满足的最小结构。 */
export interface ModelLike {
  id: string;
  name: string;
  provider?: string;
  description?: string;
  is_free?: boolean;
  is_multimodal?: boolean;
}

/** 归一化后的模型选项。 */
export interface ModelOption {
  id: string;
  name: string;
  provider: string;
  description?: string;
  isFree: boolean;
  isMultimodal: boolean;
  /** 是否命中精选画像（见 lib/modelGuide.ts） */
  isFeatured: boolean;
  /** 选型画像；未命中画像表时为 undefined */
  guide?: ModelGuide;
  /** 由适配器算好的展示顺序，越小越靠前 */
  rank: number;
}

/**
 * 是否免费模型。
 *
 * 优先采用后端下发的 `is_free`（绘图模型目录里它是必填布尔值，权威）；
 * 语言模型目录里它是可选的，缺失时退回 id / 名称 / provider 启发式。
 */
export function isFreeModel(m: ModelLike): boolean {
  if (m.is_free) return true;
  const id = (m.id || "").toLowerCase();
  const name = (m.name || "").toLowerCase();
  return (
    id === "openrouter/free" ||
    id.includes("openrouter/free") ||
    id.endsWith(":free") ||
    id.includes(":free") ||
    id.includes("/free") ||
    name.includes("(free)") ||
    name.includes("free") ||
    name.includes("免费") ||
    m.provider === "ollama"
  );
}

export function isMultimodalModel(m: ModelLike): boolean {
  if (m.is_multimodal !== undefined) return m.is_multimodal;
  const id = (m.id || "").toLowerCase();
  const name = (m.name || "").toLowerCase();
  const desc = (m.description || "").toLowerCase();

  return (
    id.includes("vision") ||
    id.includes("-vl") ||
    id.includes("_vl") ||
    id.includes("vl-") ||
    id.includes("multimodal") ||
    id.includes("4o") ||
    id.includes("gemini") ||
    id.includes("claude-3") ||
    id.includes("pixtral") ||
    id.includes("llava") ||
    id.includes("minicpm-v") ||
    name.includes("vision") ||
    name.includes("多模态") ||
    desc.includes("多模态") ||
    desc.includes("视觉")
  );
}

/** 尚未分配 rank 的模型选项（排序期间使用） */
export type UnrankedModelOption = Omit<ModelOption, "rank">;

/** 模型优先级排序评分：越小越靠前 */
export function getModelPriorityScore(m: UnrankedModelOption, isVocabMode = false): number {
  const id = m.id.toLowerCase();

  // 词汇/翻译模式优先排序：
  // 1. 第一个精准置顶：google/gemini-2.5-flash-lite
  // 2. 第二个精准紧随：openai/gpt-4o-mini
  if (isVocabMode) {
    if (id === "google/gemini-2.5-flash-lite" || id.includes("gemini-2.5-flash-lite")) return -30;
    if (id === "openai/gpt-4o-mini" || id.includes("gpt-4o-mini")) return -20;
    if (id.includes("gemini") && (id.includes("flash") || id.includes("lite"))) return -15;
    if (id.includes("gemini") || id.startsWith("google/")) return -12;
    if (id.includes("gpt-4o") || id.startsWith("openai/")) return -5;
  }

  // 1. openrouter/free
  if (id === "openrouter/free" || id.includes("openrouter/free")) return 0;

  // 2. 有画像的模型按价格档排序：旗舰(1) → 标准(2) → 免费(3) → 低价(4)
  if (m.guide) {
    switch (m.guide.priceTier) {
      case "premium":
        return 1;
      case "standard":
        return 2;
      case "free":
        return 3;
      default:
        return 4;
    }
  }

  // 3. 其他免费模型
  if (m.isFree) return 20;

  // 4. 其他模型
  return 30;
}

/** 计算去重后的真实模型数 */
export function countDistinctModels(
  options: readonly ModelOption[],
  match: (o: ModelOption) => boolean,
): number {
  const seen = new Set<string>();
  for (const o of options) {
    if (match(o)) seen.add(normalizeModelId(o.id));
  }
  return seen.size;
}

/** 语言模型目录适配：启发式判定免费 / 多模态，画像查表，优先级 + 名称排序。 */
export function toChatModelOptions(models: ModelCatalogItem[], isVocabMode = false): ModelOption[] {
  const decorated = models.map((m) => {
    const isFree = isFreeModel(m);
    const base = getModelGuide(m.id);
    // 画像表里的 priceTier 写的是「这条线路付费时的档位」。同一个模型在目录里
    // 往往同时有付费 id 和 `:free` id（gemma-4 / nemotron-3 / inkling 都是），
    // 不按实际条目覆盖的话，付费条目会被标成「免费」。
    const guide = base && isFree ? { ...base, priceTier: "free" as const } : base;
    return {
      id: m.id,
      name: m.name,
      provider: m.provider,
      description: m.description,
      isFree,
      isMultimodal: isMultimodalModel(m),
      // 精选 = 命中画像表；判据见上方 isFeatured 的注释
      isFeatured: guide !== undefined,
      guide,
    };
  });

  return decorated
    .map((o) => ({ o, score: getModelPriorityScore(o, isVocabMode) }))
    .sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      return a.o.name.localeCompare(b.o.name);
    })
    .map((entry, rank) => ({ ...entry.o, rank }));
}

/** 泛型多模态（绘图 / 视频 / 语音）目录项共同形态 */
export interface MediaCatalogItem {
  id: string;
  name: string;
  provider: string;
  description?: string;
  is_free: boolean;
}

/**
 * 多模态（绘图 / 视频 / 语音）模型目录通用适配。
 *
 * 与语言模型的启发式不同，多媒体模型一律采信后端权威下发的 is_free 必填布尔值，
 * 排序规则统一为：免费模型优先，同组按 id 字母序升序排序。
 */
export function toMediaModelOptions<T extends MediaCatalogItem>(models: readonly T[]): ModelOption[] {
  return models
    .map((m) => ({
      id: m.id,
      name: m.name,
      provider: m.provider,
      description: m.description,
      isFree: m.is_free,
      isMultimodal: false,
      // 多媒体目录（绘图 / 视频 / 语音）不参与语言模型的选型画像
      isFeatured: false,
      guide: undefined,
    }))
    .sort((a, b) => {
      if (a.isFree !== b.isFree) return a.isFree ? -1 : 1;
      return a.id.localeCompare(b.id);
    })
    .map((o, rank) => ({ ...o, rank }));
}

/** 绘图模型目录适配 */
export const toImageModelOptions = (models: ImageModelItem[]) => toMediaModelOptions(models);

/** 视频模型目录适配 */
export const toVideoModelOptions = (models: VideoModelItem[]) => toMediaModelOptions(models);

/** 语音模型目录适配 */
export const toAudioModelOptions = (models: AudioModelItem[]) => toMediaModelOptions(models);

