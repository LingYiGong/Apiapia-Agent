import type { MessageKey } from "@/i18n";

/**
 * 模型选型推荐清单。
 */

/** 价格档：free 免费 / budget 低价 / standard 标准 / premium 旗舰。 */
export type PriceTier = "free" | "budget" | "standard" | "premium";

export interface ModelGuide {
  /** 一句话说明「为什么选它」。 */
  reasonKey: MessageKey;
  priceTier: PriceTier;
}

/**
 * 把模型 id 归一化成可以跨变体匹配的形式。
 *
 * 目录里同一个模型会出现好几种写法：`anthropic/claude-sonnet-5.5`、
 * `anthropic/claude-sonnet-5.5:batch` 之类的历史快照，
 * 以及 `~anthropic/claude-sonnet-latest` 这种「永远指向最新版」的重定向别名。
 * 去掉这些后缀后，一条画像就能覆盖它们全部，分类计数也不会被变体灌水。
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

/** 构造一条画像。 */
function guide(reasonKey: MessageKey, priceTier: PriceTier): ModelGuide {
  return { reasonKey, priceTier };
}

// 免费档 3 款
const NEMOTRON_ULTRA = guide("settings.modelGuide.reason.nemotronUltra", "standard");
const GEMMA_4 = guide("settings.modelGuide.reason.gemma4", "standard");
const FREE_ROUTER = guide("settings.modelGuide.reason.freeRouter", "free");

// 正常档 5 款
const SONNET = guide("settings.modelGuide.reason.sonnet", "standard");
const GPT_SOL = guide("settings.modelGuide.reason.gptSol61", "standard");
const GEMINI_FLASH = guide("settings.modelGuide.reason.gemini38", "standard");
const DEEPSEEK_FLASH = guide("settings.modelGuide.reason.deepseekFlash", "budget");
const QWEN_MAX = guide("settings.modelGuide.reason.qwenMax", "standard");

// 聪明档 4 款
const OPUS = guide("settings.modelGuide.reason.opus55", "premium");
const GPT_ASTRA = guide("settings.modelGuide.reason.gptAstra", "premium");
const GEMINI_ARGON = guide("settings.modelGuide.reason.geminiArgon", "premium");
const KIMI_K3 = guide("settings.modelGuide.reason.kimiK3", "premium");

/**
 * 命中规则。顺序即匹配顺序：精确 id 先于正则。
 * ⚠️ ids 必须为归一化后的形式。
 */
const GUIDES: ReadonlyArray<{
  ids?: readonly string[];
  patterns?: readonly RegExp[];
  guide: ModelGuide;
}> = [
  // 「免费」档置顶的三个模型，顺序与 lib/models.ts 的 FEATURED_PIN_ORDER 保持一致。
  {
    ids: ["nvidia/nemotron-3-ultra-550b-a55b"],
    guide: NEMOTRON_ULTRA,
  },
  {
    ids: ["google/gemma-4-31b-it", "google/gemma-4-26b-a4b-it"],
    patterns: [/gemma-4/],
    guide: GEMMA_4,
  },
  {
    ids: ["openrouter/free"],
    guide: FREE_ROUTER,
  },

  // 「正常」档主力模型
  {
    ids: ["anthropic/claude-sonnet-5.5"],
    patterns: [/claude-sonnet-5\.5/, /claude-sonnet-latest/],
    guide: SONNET,
  },
  {
    ids: ["openai/gpt-6.1-sol"],
    patterns: [/gpt-6\.1-sol/, /gpt-sol-latest/],
    guide: GPT_SOL,
  },
  {
    ids: ["google/gemini-3.8-flash"],
    patterns: [/gemini-3\.8-flash/, /gemini-flash-latest/],
    guide: GEMINI_FLASH,
  },
  {
    ids: ["deepseek/deepseek-v4.1-flash"],
    patterns: [/deepseek-flash-latest/],
    guide: DEEPSEEK_FLASH,
  },
  {
    ids: ["qwen/qwen3.8-max-0902", "qwen/qwen3.8-max"],
    patterns: [/qwen3\.8-max/],
    guide: QWEN_MAX,
  },

  // 「聪明」档旗舰模型
  {
    ids: ["anthropic/claude-opus-5.5"],
    patterns: [/claude-opus-5\.5/, /claude-opus-latest/],
    guide: OPUS,
  },
  {
    ids: ["openai/gpt-6-astra"],
    patterns: [/gpt-6-astra/, /gpt-astra-latest/],
    guide: GPT_ASTRA,
  },
  {
    ids: ["google/gemini-4-argon"],
    patterns: [/gemini-4-argon/, /gemini-argon-latest/],
    guide: GEMINI_ARGON,
  },
  {
    ids: ["moonshotai/kimi-k3.1", "moonshotai/kimi-k3"],
    patterns: [/kimi-latest/],
    guide: KIMI_K3,
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
