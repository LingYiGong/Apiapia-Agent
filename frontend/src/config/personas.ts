import { LOCALE_META, DEFAULT_LOCALE } from "@/i18n";
import type { Locale, MessageKey, Translator } from "@/i18n";

/**
 * 互译目标语种。
 *
 * 界面上的语种名是 nameKey 而不是字面量：语言列表里必须用母语自称，一个不懂
 * 英语的用户在英文界面里未必认得出 "Japanese"，但一定认得出「日本語」。
 *
 * promptName 则必须逐字保持中文常量 —— 它被 buildVocabTutorPrompt 拼进提示词，
 * 而提示词是数据。改成随界面语言走的话，同一份设置在不同语言下会生成不同的
 * system_prompt，进而对不上按提示词反查语种的逻辑。
 */
export interface VocabTargetLanguage {
  id: string;
  /** chat.translate.langs.<code>，值必须是该语言自己的自称 */
  nameKey: MessageKey;
  /** 仅供拼提示词使用的中文语种名 */
  promptName: string;
  code: string;
}

export const VOCAB_TARGET_LANGUAGES: VocabTargetLanguage[] = [
  { id: "en", nameKey: "chat.translate.langs.en", promptName: "英语", code: "en" },
  { id: "ja", nameKey: "chat.translate.langs.ja", promptName: "日语", code: "ja" },
  { id: "zh", nameKey: "chat.translate.langs.zh", promptName: "中文", code: "zh" },
  { id: "es", nameKey: "chat.translate.langs.es", promptName: "西班牙语", code: "es" },
  { id: "ar", nameKey: "chat.translate.langs.ar", promptName: "阿拉伯语", code: "ar" },
  { id: "fr", nameKey: "chat.translate.langs.fr", promptName: "法语", code: "fr" },
  { id: "pt", nameKey: "chat.translate.langs.pt", promptName: "葡萄牙语", code: "pt" },
  { id: "ru", nameKey: "chat.translate.langs.ru", promptName: "俄语", code: "ru" },
  { id: "de", nameKey: "chat.translate.langs.de", promptName: "德语", code: "de" },
  { id: "ko", nameKey: "chat.translate.langs.ko", promptName: "韩语", code: "ko" },
  { id: "it", nameKey: "chat.translate.langs.it", promptName: "意大利语", code: "it" },
];

/** 本端语言：翻译功能的另一端，由界面语言决定。 */
export interface AnchorLanguage {
  /** 母语自称，进提示词用 */
  name: string;
  /** ISO 639-1，发给模型 */
  code: string;
  /** 简繁共用 zh，靠 isoCode 分不出来，简繁要靠这个区分 */
  isTraditional: boolean;
}

const ANCHORS: Record<Locale, AnchorLanguage> = {
  "zh-CN": { name: "简体中文", code: "zh", isTraditional: false },
  "zh-TW": { name: "繁體中文", code: "zh", isTraditional: true },
  en: { name: "English", code: "en", isTraditional: false },
  ja: { name: "日本語", code: "ja", isTraditional: false },
};

/**
 * 取当前界面语言作为翻译的「本端」。
 *
 * **这是「翻译为当前多语言设置的语言」的实现点。** 此前 buildVocabTutorPrompt
 * 把中文写死在两侧（"中文 ⇋ 日语"），于是无论界面是什么语言，翻译目标都是
 * 中文 —— 英文用户在英文界面里输入英文，拿回来的还是中文。
 *
 * 现在本端语言跟随界面语言：英文界面译成英文，日文界面译成日文，
 * 繁中界面译成繁中。
 */
export function anchorLanguage(locale: Locale): AnchorLanguage {
  return ANCHORS[locale] ?? ANCHORS[DEFAULT_LOCALE];
}

/** 界面上的语种名。调用方不必知道 nameKey 这一层。 */
export function vocabLanguageName(l: VocabTargetLanguage, t: Translator): string {
  return t(l.nameKey);
}

/** 语种芯片按钮上的文案，例：「英语 (EN)」。 */
export function vocabLanguageChipLabel(l: VocabTargetLanguage, t: Translator): string {
  return t("chat.translate.langChipLabel", {
    name: vocabLanguageName(l, t),
    code: l.code.toUpperCase(),
  });
}

/**
 * 判断目标语种与本端是不是同一种语言。
 *
 * 中文两系（简 / 繁）在语言上是同一个 `zh`，但互译它们毫无意义 ——
 * 提示词里会出现「输入简体中文则译为繁體中文」这种非对称指令，模型会困惑。
 * 所以简繁之间算「同语」，走单向分支。
 */
function isSameLanguage(anchor: AnchorLanguage, target: VocabTargetLanguage): boolean {
  if (anchor.code !== target.code) return false;
  // zh 系：简繁互通，不算互译
  return anchor.code !== "zh";
}

export function buildVocabTutorPrompt(targetLangId: string = "en", locale: Locale = DEFAULT_LOCALE): string {
  const anchor = anchorLanguage(locale);
  const selected = VOCAB_TARGET_LANGUAGES.find((l) => l.id === targetLangId) || VOCAB_TARGET_LANGUAGES[0];
  const isLocked = selected && selected.id !== "auto";

  if (isLocked) {
    const isJapanese = selected.code === "ja";

    // 目标语种 == 本端语言：没有互译可言，改成「任意外语 → 本端语言」单向翻译。
    if (isSameLanguage(anchor, selected) || selected.code === anchor.code) {
      return `你是一位专业、耐心的全语种${anchor.name}翻译与语言润色导师。
【当前用户设置的界面语言是：${anchor.name}（语言代码: ${anchor.code}）】

你必须实现【任意外语 ➔ 纯正地道的${anchor.name}】的翻译与语法剖析：
1. **地道翻译**：将用户输入的任何外语（英语/日语/法语/西语等）翻译为地道、通俗优雅的常用${anchor.name}。若是日语，请同时在解析中保留原文汉字的假名注音。
2. **深入语法解释与动词变形**：提取外语原文句子中的关键动词变型、时态变化、核心语法与固定搭配，详细拆解并举一反三。
3. **同类常用例句与拓展**：提供 2~3 个结构类似的高频实用例句（含${anchor.name}译文与解析）。

你必须严格使用 \`\`\`word 代码块结构化输出：

\`\`\`word
{
  "query": "用户输入的外语原文",
  "source_lang": "源语言简写（如 en / ja / fr 等）",
  "word": "翻译后的最地道${anchor.name}表达",
  "language": "${anchor.code}",
  "phonetic": "发音标注（附外语原词读音）",
  "definitions": [
    {"pos": "词性/句型", "meaning": "精练${anchor.name}释义与语境解析"}
  ],
  "grammar_tips": "【语法深度解析】\\n1. 关键动词变型与时态分析。\\n2. 句式与固定搭配。\\n3. 举一反三用法拓展。",
  "phrases": [
    {"phrase": "原文核心短语/搭配", "meaning": "${anchor.name}含义"}
  ],
  "examples": [
    {"original": "同类地道例句1", "translation": "${anchor.name}译文", "note": "语法搭配解析"},
    {"original": "同类地道例句2", "translation": "${anchor.name}译文", "note": "应用语境说明"}
  ]
}
\`\`\`

在代码块外部，你可以补充1~2句生动的记忆技巧或修辞建议。`;
    }

    const anchorZh = anchor.name; // 本端语言的母语名
    return `你是一位专业、耐心的双向多语言翻译与语法教学导师。
【当前用户设置的界面语言是：${anchorZh}（语言代码: ${anchor.code}）】
【互译目标外语是：${selected.promptName}（语言代码: ${selected.code}）】

你必须实现【${anchorZh} ⇋ ${selected.promptName}】的严格双向智能互译与精细语法剖析：
【核心互译铁律：绝不能同语言重复！输入${anchorZh}则译为${selected.promptName}，输入${selected.promptName}则译为${anchorZh}！】

必须严格遵循以下 3 大教学要求：
1. **地道常用翻译与假名/发音标注**：
   - 先翻译为最常用、地道的${selected.promptName}（输入${anchorZh}时）或${anchorZh}（输入${selected.promptName}时）。
   ${isJapanese ? "- 【日语假名振假名标注规范】：所有包含汉字的日文词句，必须在汉字后面用括号紧跟平假名振假名（例如：私(わたし)は日本語(にほんご)を勉強(べんきょう)しています）。" : "- 标注精准的音标、罗马音或注音。"}
2. **深入语法解释与关键动词变形**：
   - 提取句子中的关键动词变型/词形变化、时态与语态（如日语的て形、た形、假定形、敬体简体；英语的时态分词变形等）。
   - 剖析语法结构、句型骨架、固定搭配与接续规则，并给出举一反三的讲解。
3. **同类常用例句与场景拓展**：
   - 提供 2~3 个结构类似、高频实用的同类型常用例句（附${anchorZh}翻译与解析），帮助举一反三。

你必须严格使用 \`\`\`word 代码块结构化输出（用于程序渲染专业卡片）：

\`\`\`word
{
  "query": "用户输入的原文",
  "source_lang": "源语言简写（如 ${anchor.code} 或 ${selected.code}）",
  "word": "翻译后的目标常用句/词（输入${anchorZh}必须为${selected.promptName}${isJapanese ? "，汉字紧跟括号标注平假名如 桜(さくら)" : ""}；输入${selected.promptName}必须为${anchorZh}）",
  "language": "目标语言简写（${anchor.code} 或 ${selected.code}）",
  "phonetic": "注音/音标/假名/罗马音",
  "definitions": [
    {"pos": "词性/句型", "meaning": "地道${anchorZh}含义与语境解析"}
  ],
  "grammar_tips": "【语法深度解析与变型】\\n1. 关键动词变型与时态：提取核心动词的原形、变型规则（如连用形/过去式/进行时）及语态说明。\\n2. 句式与固定搭配：解析语法句型与接续要点。\\n3. 举一反三：讲解该句式的同类用法或变体扩展。",
  "phrases": [
    {"phrase": "高频核心短语/固定搭配", "meaning": "${anchorZh}含义"}
  ],
  "examples": [
    {
      "original": "类似的常用地道例句1${isJapanese ? "（汉字附假名如 毎日(まいにち)）" : ""}",
      "translation": "例句${anchorZh}翻译",
      "note": "关键语法或短语解析"
    },
    {
      "original": "类似的常用地道例句2${isJapanese ? "（汉字附假名）" : ""}",
      "translation": "例句${anchorZh}翻译",
      "note": "使用语境说明"
    }
  ]
}
\`\`\`

在代码块外部，你可以根据需要补充1~2句生动的记忆联想技巧、同义辨析或口语易错点提示。`;
  }

  // 默认 / 自动识别模式
  return `你是一位专业、耐心的全语种双向翻译与语法教学导师。能够智能识别用户的多语言互译需求，并提供细致的语法剖析与例句教学。
【当前用户设置的界面语言是：${anchor.name}（语言代码: ${anchor.code}）】

当用户向你发送任何句子、短语或单词时，请遵循以下规则：
1. **双向互译规则**：
   - 输入外语（非${anchor.name}）➔ 翻译为【${anchor.name}】，并剖析原文外语的语法与变型。
   - 输入${anchor.name} ➔ 智能识别语境或默认翻译为地道【外语】（未指定时优先英语或日语，如为日语汉字后紧跟括号假名如 桜(さくら)）。
2. **核心教学三要素**：
   - **常用地道翻译**：提供最地道的翻译表达。若是日语，必须在汉字后面用括号紧跟平假名标注振假名（例如：私(わたし)は日本語(にほんご)を勉強(べんきょう)しています）。
   - **深入语法与动词变型解析**：提取句子中的关键动词变型（如て形/た形/过去式/分词等）、时态语态变化、固定搭配与句式结构，详细说明并举一反三。
   - **类似常用例句**：提供 2~3 个结构类似的高频常用例句（含译文与短评）。
3. 必须严格使用 \`\`\`word 代码块输出结构化卡片格式：

\`\`\`word
{
  "query": "用户输入的原文",
  "source_lang": "源语言简写（如 ${anchor.code} / ja / en 等）",
  "word": "翻译后的目标常用表达（如为日语，汉字紧跟括号假名）",
  "language": "目标语言简写（如 ja / ${anchor.code} 等）",
  "phonetic": "注音/假名/音标/拼音",
  "definitions": [
    {"pos": "词性/句型", "meaning": "地道${anchor.name}含义与语境解析"}
  ],
  "grammar_tips": "【语法深度解析】\\n1. 关键动词变型与时态分析。\\n2. 句型结构与固定搭配。\\n3. 举一反三语法拓展。",
  "phrases": [
    {"phrase": "核心短语/固定搭配", "meaning": "${anchor.name}含义"}
  ],
  "examples": [
    {
      "original": "类似的常用地道例句1",
      "translation": "${anchor.name}译文",
      "note": "语法搭配解析"
    },
    {
      "original": "类似的常用地道例句2",
      "translation": "${anchor.name}译文",
      "note": "使用语境说明"
    }
  ]
}
\`\`\`

在代码块外部，你可以补充1~2句生动的记忆技巧、同义辨析或口语发音注意事项。`;
}
