import type { MessageKey } from "@/i18n";

/**
 * 模型选型推荐清单。
 *
 * 目录里有 400+ 个模型（且还在滚），用户不可能也不需要逐个研究。这个文件挑出
 * **18 个**覆盖主流用途的模型，界面上给它们挂上「适合什么 + 大概多贵 + 一句话理由」，
 * 其余模型行为完全不变 —— 没有画像就没有标签，不会多出任何噪音。
 *
 * ## 分类为什么是这样分的
 *
 * 业界（OpenRouter 官方 `GetModelsCategory` 枚举，以及 LLMTest / Workstation /
 * Verdeshell / multichats 四家选型指南的共识）都把模型分类当成**两条独立的轴**：
 *
 * - **用途轴**：抽取分类 / 改写转换 / 从零生成 / 多步推理 / 工具调用 / 多模态 /
 *   文档 RAG / 代码 —— 全是「你要用它干什么」
 * - **价格轴**：Frontier 最强 → Mid 主力 → Cheap 快 → 免费 —— 全是「你要花多少」
 *
 * 把这两条轴混进同一个列表是最常见的错误（早期版本就犯过：编程·中文·读图 是能力，
 * 省钱·免费 是价格，混在一起谁也读不懂）。所以 ModelPicker 里分成两个带小标题的
 * 区块，**同区块内才是可比的**。
 *
 * 语言**不作为分类**：中文强不强是模型属性而非用途，挂在模型行的标签上就够了。
 *
 * ## 这 18 个怎么选的
 *
 * 价格均为厂商公开列表价（2026-10 核对），按「用途分组」而非「排行榜」挑：
 *
 * | 用途 | 模型 |
 * |---|---|
 * | 日常对话 | Claude Sonnet 5.5 · GPT-6.1 Sol · Gemini 3.8 Flash · GLM 5.3 · GPT-6 Luna |
 * | 编程开发 | DeepSeek V4 Pro · Grok 4.7 · Qwen3.8 Max · Claude Haiku 5.5 · + 上面前四个 |
 * | 深度推理 | Claude Opus 5.5 · GPT-6 Astra · Kimi K3 · + GLM 5.3 |
 * | 看图多模态 | Gemini 3.8 Flash · GLM 5.3 Flash · MiniMax M3 · MiMo-V2.6-Flash · Qwen3.8 Flash |
 * | 长文档 | GPT-6.1 Sol · Gemini 3.8 Flash · DeepSeek V4.1 Flash · Kimi K3 · Claude Opus 5.5 |
 * | 省钱 | GPT-6 Luna · GLM 5.3 Flash · DeepSeek V4.1 Flash · Claude Haiku 5.5 · + 三个国产低价多模态 |
 *
 * 两条设计约束：
 *
 * 1. **只写文案键，不写文案。** 四个语言各一份 reason/caveat，键名由 zh-CN 文案树
 *    反推（见 i18n/types.ts），少一个语言会在 tsc --noEmit 报错。
 * 2. **价格档是粗分，不是报价。** 只回答「贵不贵」，精确价格去看厂商价格页。
 */

/** 场景标签。既作为模型行上的徽章，也作为 ModelPicker 一级场景分类区的分组依据。 */
export type UseCaseKey = "writing" | "reasoning" | "coding" | "visionDocs" | "fastFree";

/** 价格档：free 免费 / budget 低价 / standard 标准 / premium 旗舰。 */
export type PriceTier = "free" | "budget" | "standard" | "premium";

export interface ModelGuide {
  /** 一句话说明「为什么选它」。 */
  reasonKey: MessageKey;
  priceTier: PriceTier;
  useCases: readonly UseCaseKey[];
  /** 使用避坑提示（定价阶梯、上下文上限、概率不稳等）。没有则不展示。 */
  caveatKey?: MessageKey;
}

/**
 * 把模型 id 归一化成可以跨变体匹配的形式。
 *
 * 目录里同一个模型会出现好几种写法：`anthropic/claude-sonnet-5.5`、
 * `anthropic/claude-sonnet-5.5:batch`、`anthropic/claude-opus-4.5` 之类的历史快照，
 * 以及 `~anthropic/claude-sonnet-latest` 这种「永远指向最新版」的重定向别名。
 * 去掉这些后缀后，一条画像就能覆盖它们全部，**分类计数也不会被变体灌水**。
 *
 * 剥后缀有顺序讲究：`:batch` 会把整个尾巴截掉，所以必须**先把这类后缀剥干净，
 * 再剥 `-pro`**。反过来 `foo-pro:batch` 会因为结尾是 `:batch` 而剥不掉 `-pro`。
 *
 * 只剥 `:batch` / `:free` / `-pro` 这三种「同一个模型的投递方式」差异。
 * `-prime` / `-flashx` / `-ultraspeed` 是厂商自己分的**独立 SKU**（定价和能力
 * 都不同），刻意不归一化 —— 它们拿不到画像，也就不会被套上主线模型的说明。
 */
export function normalizeModelId(id: string): string {
  let s = (id ?? "").trim().toLowerCase();
  if (s.startsWith("~")) s = s.slice(1);
  s = s.replace(/:batch$/, "").replace(/:free$/, "");
  if (s.endsWith("-pro")) s = s.slice(0, -"-pro".length);
  return s;
}

/** 构造一条画像，顺手把四个可选参数压到一行。 */
function guide(
  reasonKey: MessageKey,
  priceTier: PriceTier,
  useCases: readonly UseCaseKey[],
  caveatKey?: MessageKey,
): ModelGuide {
  return { reasonKey, priceTier, useCases, caveatKey };
}

// ── 18 条画像 ─────────────────────────────────────────────────────────────
// 命名成常量，是为了下面的 GUIDES 命中表按名字引用；同一个模型的对象
// 字面量只写一次，不复制粘贴。

const SONNET = guide("settings.modelGuide.reason.sonnet", "standard", ["writing", "coding"]);
const GPT_SOL = guide(
  "settings.modelGuide.reason.gptSol61",
  "standard",
  ["writing", "coding", "visionDocs"],
  "settings.modelGuide.caveat.longPrompt",
);
const GEMINI_FLASH = guide(
  "settings.modelGuide.reason.gemini38",
  "standard",
  ["writing", "visionDocs", "fastFree"],
  "settings.modelGuide.caveat.priceRise",
);
const GLM = guide("settings.modelGuide.reason.glm53", "standard", ["writing", "coding", "reasoning"]);
const GPT_LUNA = guide(
  "settings.modelGuide.reason.gptLuna",
  "budget",
  ["writing", "fastFree"],
  "settings.modelGuide.caveat.longPrompt",
);
const GLM_FLASH = guide(
  "settings.modelGuide.reason.glm53Flash",
  "budget",
  ["visionDocs", "fastFree", "coding"],
);
const OPUS = guide(
  "settings.modelGuide.reason.opus55",
  "premium",
  ["reasoning", "coding", "visionDocs"],
  "settings.modelGuide.caveat.thinking",
);
const FREE_ROUTER = guide(
  "settings.modelGuide.reason.freeRouter",
  "free",
  ["writing", "fastFree"],
  "settings.modelGuide.caveat.freeUnstable",
);

// —— 编程 ——
const DEEPSEEK_PRO = guide(
  "settings.modelGuide.reason.deepseekPro",
  "standard",
  ["coding", "reasoning"],
);
const GROK47 = guide(
  "settings.modelGuide.reason.grok47",
  "standard",
  ["coding", "reasoning"],
  "settings.modelGuide.caveat.shortContext",
);
const QWEN_MAX = guide(
  "settings.modelGuide.reason.qwenMax",
  "standard",
  ["writing", "coding", "visionDocs"],
  "settings.modelGuide.caveat.primeVariant",
);

// —— 推理 ——
const GPT_ASTRA = guide(
  "settings.modelGuide.reason.gptAstra",
  "premium",
  ["reasoning", "coding"],
  "settings.modelGuide.caveat.longPrompt",
);
const KIMI_K3 = guide(
  "settings.modelGuide.reason.kimiK3",
  "premium",
  ["reasoning", "visionDocs"],
  "settings.modelGuide.caveat.kimiPrice",
);

// —— 便宜的多模态 ——
const DEEPSEEK_FLASH = guide(
  "settings.modelGuide.reason.deepseekFlash",
  "budget",
  ["visionDocs", "fastFree", "coding"],
  "settings.modelGuide.caveat.peakPricing",
);
const QWEN_FLASH = guide("settings.modelGuide.reason.qwen38Flash", "budget", ["visionDocs", "fastFree"]);
const MINIMAX_M3 = guide("settings.modelGuide.reason.minimaxM3", "budget", ["visionDocs", "fastFree"]);
const MIMO_FLASH = guide("settings.modelGuide.reason.mimoFlash", "budget", ["visionDocs", "fastFree"]);
const HAIKU = guide(
  "settings.modelGuide.reason.haiku55",
  "budget",
  ["coding", "fastFree"],
  "settings.modelGuide.caveat.haikuLongPrompt",
);

/**
 * 命中规则。**顺序即匹配顺序**：精确 id 先于正则，正则先于更宽的正则。
 *
 * 规则要具体在前、通配在后，否则更宽的那条会先把当前旗舰吃掉
 * （历史上就踩过：只写 `claude-opus-5`，结果上一代 `claude-opus-4.x` 也被算进来）。
 *
 * ⚠️ 写进 `ids` 的键必须是**归一化后**的形式：EXACT 查找不做归一化，
 * 所以以 `-pro` / `:batch` / `:free` 结尾、或带 `~` 前缀的键永远查不到。
 */
const GUIDES: ReadonlyArray<{
  ids?: readonly string[];
  patterns?: readonly RegExp[];
  guide: ModelGuide;
}> = [
  {
    ids: ["openrouter/free"],
    guide: FREE_ROUTER,
  },
  {
    // 刻意要求 `.5`：只写 `claude-opus-5` 会把**上一代** claude-opus-5 也捞进来，
    // 让它挂上「目前的能力天花板」这种时效性文案。上一代没有对应文案，
    // 宁可不匹配（界面上只是少几个标签），也不能给错说明。
    ids: ["anthropic/claude-opus-5.5"],
    patterns: [/claude-opus-5\.5/, /claude-opus-latest/],
    guide: OPUS,
  },
  {
    ids: ["anthropic/claude-sonnet-5.5"],
    patterns: [/claude-sonnet-5\.5/, /claude-sonnet-latest/],
    guide: SONNET,
  },
  {
    ids: ["anthropic/claude-haiku-5.5"],
    patterns: [/claude-haiku-5/],
    guide: HAIKU,
  },
  {
    ids: ["openai/gpt-6.1-sol"],
    // 只认 6.1：同族的 `gpt-6-sol`（6.0 那代）价格与定位都不同，不能共用一条文案。
    // `~openai/gpt-sol-latest` 按「指向 Sol 系当前最强档」处理 —— 目录只写它
    // 「redirects to the latest model in the GPT Sol family」，没明说是哪一档，
    // 这是一个假设。哪天 Sol 出了 6.2，记得同步改这里。
    patterns: [/gpt-6\.1-sol/, /gpt-sol-latest/],
    guide: GPT_SOL,
  },
  {
    ids: ["openai/gpt-6-luna"],
    patterns: [/gpt-6-luna/, /gpt-luna-latest/],
    guide: GPT_LUNA,
  },
  {
    ids: ["openai/gpt-6-astra"],
    patterns: [/gpt-6-astra/, /gpt-astra-latest/],
    guide: GPT_ASTRA,
  },
  {
    ids: ["google/gemini-3.8-flash"],
    // `~google/gemini-flash-latest` 是「永远指向最新版」的重定向别名，
    // 指的就是 3.8 这条主线，不能算上一代。
    patterns: [/gemini-3\.8-flash/, /gemini-flash-latest/],
    guide: GEMINI_FLASH,
  },
  {
    ids: ["z-ai/glm-5.3"],
    patterns: [/z-ai\/glm-latest/],
    guide: GLM,
  },
  {
    ids: ["z-ai/glm-5.3-flash"],
    patterns: [/glm-flash-latest/],
    guide: GLM_FLASH,
  },
  {
    // 同上：`-pro` 结尾的 EXACT 键查不到，必须写归一化后的 `deepseek-v4`。
    ids: ["deepseek/deepseek-v4-pro-0813", "deepseek/deepseek-v4"],
    guide: DEEPSEEK_PRO,
  },
  {
    ids: ["deepseek/deepseek-v4.1-flash"],
    patterns: [/deepseek-flash-latest/],
    guide: DEEPSEEK_FLASH,
  },
  {
    ids: ["x-ai/grok-4.7"],
    patterns: [/grok-4\.7/, /grok-latest/],
    guide: GROK47,
  },
  {
    ids: ["moonshotai/kimi-k3"],
    patterns: [/kimi-latest/],
    guide: KIMI_K3,
  },
  {
    ids: ["qwen/qwen3.8-max-0902", "qwen/qwen3.8-max"],
    patterns: [/qwen3\.8-max/],
    guide: QWEN_MAX,
  },
  {
    ids: ["qwen/qwen3.8-flash"],
    patterns: [/qwen3\.8-flash/],
    guide: QWEN_FLASH,
  },
  {
    ids: ["minimax/minimax-m3"],
    guide: MINIMAX_M3,
  },
  {
    ids: ["xiaomi/mimo-v2.6-flash"],
    patterns: [/mimo-v2\.6$/, /mimo-v2\.5$/],
    guide: MIMO_FLASH,
  },
];

/** 精确 id 索引。400 多个模型每次渲染都要查一次，线性扫十几条正则不划算。 */
const EXACT = new Map<string, ModelGuide>();
for (const entry of GUIDES) {
  for (const id of entry.ids ?? []) EXACT.set(id, entry.guide);
}

const PATTERNS: ReadonlyArray<{ patterns: readonly RegExp[]; guide: ModelGuide }> = GUIDES.filter(
  (entry) => entry.patterns && entry.patterns.length > 0
).map((entry) => ({ patterns: entry.patterns!, guide: entry.guide }));

/**
 * 非对话模型的 id 片段。
 *
 * OpenRouter 把生图 / 音乐 / 语音模型和对话模型混在**同一个** `/models` 列表里下发，
 * 而且 id 高度相似：`gemini-3.1-flash-lite` 是对话模型，
 * `gemini-3.1-flash-lite-image` 是生图模型，差一个后缀。漏配就会给一个生图模型
 * 挂上「看图多模态」的标签。
 *
 * 与其给每条正则都补排除，不如在这里统一挡一次：命中就直接「没有画像」。
 */
const NON_CHAT_SEGMENT =
  /(^|[\/_.-])(image|images|video|audio|speech|tts|stt|lyria|banana|voxtral)([\/_.-]|$)/;

/**
 * 取一个模型的画像。没命中返回 undefined —— 这是正常情况（400 多个模型里
 * 只有这 18 个写了推荐），调用方应当「什么都不显示」，而不是回退到泛泛的默认文案。
 */
export function getModelGuide(id: string): ModelGuide | undefined {
  const key = normalizeModelId(id);
  if (NON_CHAT_SEGMENT.test(key)) return undefined;

  const hit = EXACT.get(key);
  if (hit) return hit;
  for (const entry of PATTERNS) {
    if (entry.patterns.some((re) => re.test(key))) return entry.guide;
  }
  return undefined;
}

/**
 * 场景分类的展示顺序，也就是 ModelPicker 场景筛选那一行的排列顺序。
 *
 * 覆盖普通用户 4 个最核心的日常使用场景。
 *
 * 「免费」不在这张表里：它是**价格维度**而不是使用场景，和「深度思考」
 * 这几个不是同一类东西。混在一张表里排序，就没法表达「先按价格、再按
 * 场景」的两段结构。它由 ModelSelect 作为第一个分组单独提供。
 */
export const USE_CASE_ORDER: readonly UseCaseKey[] = [
  "reasoning",
  "writing",
  "visionDocs",
  "coding",
] as const;