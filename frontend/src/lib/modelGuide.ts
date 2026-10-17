import type { MessageKey } from "@/i18n";

/**
 * 模型选型推荐清单。
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
 * 命中规则。顺序即匹配顺序：精确 id 先于正则。
 * ⚠️ ids 必须为归一化后的形式。
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

const EXACT = new Map<string, ModelGuide>();
for (const entry of GUIDES) {
  for (const id of entry.ids ?? []) EXACT.set(id, entry.guide);
}

const PATTERNS: ReadonlyArray<{ patterns: readonly RegExp[]; guide: ModelGuide }> = GUIDES.filter(
  (entry) => entry.patterns && entry.patterns.length > 0
).map((entry) => ({ patterns: entry.patterns!, guide: entry.guide }));

const NON_CHAT_SEGMENT =
  /(^|[\/_.-])(image|images|video|audio|speech|tts|stt|lyria|banana|voxtral)([\/_.-]|$)/;

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

/** 场景分类的展示顺序 */
export const USE_CASE_ORDER: readonly UseCaseKey[] = [
  "reasoning",
  "writing",
  "visionDocs",
  "coding",
] as const;