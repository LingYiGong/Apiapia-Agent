import type {
  AudioModelItem,
  ImageModelItem,
  VideoModelItem,
  ModelCatalogItem,
} from "@/types";

/**
 * 模型目录的纯逻辑层。
 *
 * 这些函数此前寄生在 ModelSelect.tsx 里（190 行），但它们是纯函数：
 * 既不依赖 React，也与具体模型类型无关。两个模型选择器（语言 / 绘图）
 * 各自实现了一套「是否免费」判定 —— 语言模型用启发式，绘图模型直接读
 * `is_free` 字段 —— 同一份数据因此可能得到两个不同答案。统一到这里后，
 * 判定只有一处，`ModelPicker` 也只依赖 `ModelOption` 这一个归一化形状。
 */

/** 两个 API 返回体共同满足的最小结构。 */
export interface ModelLike {
  id: string;
  name: string;
  provider?: string;
  description?: string;
  is_free?: boolean;
  is_multimodal?: boolean;
}

/**
 * 归一化后的模型选项。`ModelPicker` 只认这个形状，
 * 因此语言模型与绘图模型可以共用同一套渲染与键盘交互。
 */
export interface ModelOption {
  id: string;
  name: string;
  provider: string;
  description?: string;
  isFree: boolean;
  isMultimodal: boolean;
  isFeatured: boolean;
  /** 由适配器算好的展示顺序，越小越靠前。排序责任归适配器，不归 UI。 */
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

/**
 * 识别精选精品模型：
 * 涵盖一线知名大厂的主力旗舰与稳定高品质模型，过滤掉数百个冷门测试/小众微调模型。
 */
export function isFeaturedModel(m: ModelLike): boolean {
  const id = (m.id || "").toLowerCase();
  const name = (m.name || "").toLowerCase();

  // 1. 官方免费聚合模型
  if (id === "openrouter/free" || id.includes("openrouter/free")) return true;

  // 2. OpenAI 核心精品 (GPT-4o, 4o-mini, o1, o3-mini, 4.5)
  if (
    id.startsWith("openai/") ||
    m.provider === "openai" ||
    id.startsWith("gpt-") ||
    id.startsWith("o1") ||
    id.startsWith("o3")
  ) {
    if (
      id.includes("4o") ||
      id.includes("o1") ||
      id.includes("o3") ||
      id.includes("4.5")
    ) {
      if (!id.includes("ft:") && !id.includes("realtime") && !id.includes("audio")) {
        return true;
      }
    }
  }

  // 3. Anthropic Claude 3.5 / 3.7 系列旗舰
  if (id.startsWith("anthropic/") || m.provider === "anthropic" || id.includes("claude")) {
    if (
      id.includes("claude-3-5") ||
      id.includes("claude-3.5") ||
      id.includes("claude-3-7") ||
      id.includes("claude-3.7") ||
      id.includes("claude-3-opus") ||
      id.includes("claude-3-haiku")
    ) {
      return true;
    }
  }

  // 4. Google Gemini 2.5 / 2.0 / 1.5 系列主力
  if (id.startsWith("google/") || m.provider === "gemini" || id.includes("gemini")) {
    if (
      id.includes("gemini-2.5") ||
      id.includes("gemini-2.0") ||
      id.includes("gemini-1.5-pro") ||
      id.includes("gemini-1.5-flash")
    ) {
      return true;
    }
  }

  // 5. DeepSeek 官方主力 (V3 & R1)
  if (id.startsWith("deepseek/") || id.includes("deepseek")) {
    if (
      id.includes("chat") ||
      id.includes("reasoner") ||
      id.includes("v3") ||
      id.includes("r1")
    ) {
      return true;
    }
  }

  // 6. Meta Llama 官方主力 (3.3 70B, 3.1 70B/405B)
  if (id.startsWith("meta-llama/") || id.includes("llama-3.3") || id.includes("llama-3.1-70b")) {
    if (id.includes("instruct") || id.includes("70b") || id.includes("405b")) {
      return true;
    }
  }

  // 7. Qwen 阿里通义千问 2.5 官方主力
  if (id.startsWith("qwen/") || id.includes("qwen-2.5") || id.includes("qwq")) {
    if (id.includes("72b") || id.includes("coder") || id.includes("qwq")) {
      return true;
    }
  }

  // 8. Mistral 官方主力
  if (id.startsWith("mistralai/") && (id.includes("mistral-large") || id.includes("codestral"))) {
    return true;
  }

  return false;
}

/**
 * 尚未分配 rank 的模型选项 —— 排序期间使用。
 *
 * `rank` 由适配器在排序**之后**回填，因此优先级评分拿不到它，
 * 这里用 Omit 表达「评分只需要 flags 与 id」，而不是把 rank 设为可选
 * （可选会让调用方误以为可以不填，从而把真正的顺序漏洞带进类型系统）。
 */
export type UnrankedModelOption = Omit<ModelOption, "rank">;

/**
 * 模型优先级排序评分：越小越靠前。
 *
 * 注意这里接收的是已归一化、并预处理好 isFeatured / isFree 的选项，
 * 而不是原始条目 —— 旧实现在 sort 比较函数里每次比较都要重跑
 * isFeaturedModel 与 isFreeModel 两套多分支启发式，1000 条目录时
 * 单次渲染会产生数万次重复判定。
 */
export function getModelPriorityScore(m: UnrankedModelOption): number {
  const id = m.id.toLowerCase();

  // 1. openrouter/free (新用户首选与免费体验)
  if (id === "openrouter/free" || id.includes("openrouter/free")) return 0;

  // 2. Anthropic Claude 顶级旗舰 (3.7 Sonnet / 3.5 Sonnet)
  if (
    id.includes("claude-3-7-sonnet") ||
    id.includes("claude-3.7-sonnet") ||
    id.includes("claude-3-5-sonnet") ||
    id.includes("claude-3.5-sonnet")
  ) {
    return 1;
  }

  // 3. OpenAI 顶级旗舰 (GPT-4o, o3-mini, o1)
  if (id.includes("gpt-4o") && !id.includes("mini")) return 2;
  if (id.includes("o3-mini") || id.includes("o1")) return 3;
  if (id.includes("gpt-4o-mini")) return 4;

  // 4. DeepSeek 官方主力 (DeepSeek V3 / R1)
  if (
    id.includes("deepseek-chat") ||
    id.includes("deepseek-r1") ||
    id.includes("deepseek-v3") ||
    id.includes("deepseek/deepseek-r1")
  ) {
    return 5;
  }

  // 5. Google Gemini 顶级旗舰 (Gemini 2.5 / 2.0 / 1.5 Pro)
  if (
    id.includes("gemini-2.5") ||
    id.includes("gemini-2.0-pro") ||
    id.includes("gemini-2.0-flash") ||
    id.includes("gemini-1.5-pro")
  ) {
    return 6;
  }

  // 6. 其他精选模型 (Llama 3.3, Qwen 2.5, Mistral Large, etc.)
  if (m.isFeatured) return 10;

  // 7. 其他免费模型
  if (m.isFree) return 20;

  // 8. 其他海量模型
  return 30;
}

/** 语言模型目录适配：启发式判定免费 / 多模态 / 精选，优先级 + 名称排序。 */
export function toChatModelOptions(models: ModelCatalogItem[]): ModelOption[] {
  const decorated = models.map((m) => ({
    id: m.id,
    name: m.name,
    provider: m.provider,
    description: m.description,
    isFree: isFreeModel(m),
    isMultimodal: isMultimodalModel(m),
    isFeatured: isFeaturedModel(m),
  }));

  return decorated
    .map((o) => ({ o, score: getModelPriorityScore(o) }))
    .sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      return a.o.name.localeCompare(b.o.name);
    })
    .map((entry, rank) => ({ ...entry.o, rank }));
}

/**
 * 绘图模型目录适配。
 *
 * 这里刻意**不**套用语言模型的启发式：`is_free` 在绘图目录里是必填布尔值，
 * 属于后端权威判定，启发式反而可能把 `provider: "ollama"` 之类的绘图项
 * 误标成免费。排序同样交给本适配器（免费优先，其次按 id）。
 */
export function toImageModelOptions(models: ImageModelItem[]): ModelOption[] {
  return models
    .map((m) => ({
      id: m.id,
      name: m.name,
      provider: m.provider,
      description: m.description,
      isFree: m.is_free,
      isMultimodal: false,
      isFeatured: false,
    }))
    .sort((a, b) => {
      if (a.isFree !== b.isFree) return a.isFree ? -1 : 1;
      return a.id.localeCompare(b.id);
    })
    .map((o, rank) => ({ ...o, rank }));
}

/**
 * 视频模型目录适配。
 * 同样采信后端下发的 is_free 标记，免费优先，其余按 id 字母序。
 */
export function toVideoModelOptions(models: VideoModelItem[]): ModelOption[] {
  return models
    .map((m) => ({
      id: m.id,
      name: m.name,
      provider: m.provider,
      description: m.description,
      isFree: m.is_free,
      isMultimodal: false,
      isFeatured: false,
    }))
    .sort((a, b) => {
      if (a.isFree !== b.isFree) return a.isFree ? -1 : 1;
      return a.id.localeCompare(b.id);
    })
    .map((o, rank) => ({ ...o, rank }));
}

/**
 * 语音模型目录适配。
 *
 * 与绘图 / 视频一致：采信后端下发的 is_free，不用语言模型那套启发式。
 * 尤其不能用 —— 启发式里的 `name.includes("free")` 会把
 * `openai/gpt-4o-freeform` 这类模型误判成免费。
 *
 * 调用方（AudioModelSelect）会先按 capability 过滤，这里不关心方向。
 */
export function toAudioModelOptions(models: AudioModelItem[]): ModelOption[] {
  return models
    .map((m) => ({
      id: m.id,
      name: m.name,
      provider: m.provider,
      description: m.description,
      isFree: m.is_free,
      isMultimodal: false,
      isFeatured: false,
    }))
    .sort((a, b) => {
      if (a.isFree !== b.isFree) return a.isFree ? -1 : 1;
      return a.id.localeCompare(b.id);
    })
    .map((o, rank) => ({ ...o, rank }));
}
