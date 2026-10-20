/**
 * 模型选择器的三个推荐档位。
 *
 * 这里刻意**不是**把整个目录分成三份：目录里有 400+ 个模型，包含大量旧版本、
 * 快照、专用模型和投递变体，全部铺开会把真正的选择埋掉。三个档位只列精选：
 * 免费 3 个、正常 8 个、聪明 6 个；不在清单里的模型只在「自定义」里出现。
 *
 * 用原始 id 精确匹配，不做 `normalizeModelId`：
 * - `:batch` / `-pro` 等变体不会再生成一行，精选列表保持短小；
 * - 免费档只保留置顶的三个 `:free` 入口，其他免费线路交给「自定义」。
 */
export type ModelTier = "free" | "normal" | "smart";

export interface TieredModel {
  id: string;
}

/** 「免费」档：只展示置顶的三个免费入口，顺序由 lib/models.ts 的置顶分数决定。 */
const FREE_IDS: ReadonlySet<string> = new Set([
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "minimax/minimax-m3.1-flash:free",
  "openrouter/free",
]);

/**
 * 「正常」档：精选的日常性价比模型。
 *
 * 覆盖写作、编程、长上下文、视觉和低价高频几个方向；不追求穷举，
 * 也不把每个厂商的所有快照都塞进来。
 */
const NORMAL_IDS: ReadonlySet<string> = new Set([
  "anthropic/claude-sonnet-5.5",
  "openai/gpt-6.1-sol",
  "openai/gpt-6-luna",
  "google/gemini-3.8-flash",
  "z-ai/glm-5.3",
  "deepseek/deepseek-v4-pro-0813",
  "qwen/qwen3.8-max-0902",
  "x-ai/grok-4.7",
]);

/**
 * 「聪明」档：精选的旗舰模型。
 *
 * 只保留当前第一梯队的代表；同系列的普通版、旧快照和 `:batch` 变体
 * 不重复列出。
 */
const SMART_IDS: ReadonlySet<string> = new Set([
  "anthropic/claude-opus-5.5",
  "anthropic/claude-fable-5.1",
  "openai/gpt-6-astra",
  "google/gemini-4-argon",
  "meta/muse-wonder",
  "moonshotai/kimi-k3",
]);

/** 当前 id 属于哪个推荐档；不在任何精选清单里时返回 null（只在自定义里出现）。 */
export function getModelTier(model: TieredModel): ModelTier | null {
  const id = model.id.trim().toLowerCase();
  if (FREE_IDS.has(id)) return "free";
  if (SMART_IDS.has(id)) return "smart";
  if (NORMAL_IDS.has(id)) return "normal";
  return null;
}
