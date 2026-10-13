import type { MessageKey } from "@/i18n";

export interface PromptCommand {
  key: string;
  /**
   * 文案存**键**而不是字符串。
   *
   * 此前 title / description 直接写死中文，于是"界面语言"改不动这里 ——
   * 而这两行就显示在输入框上方的 `/` 指令菜单里，是最显眼的位置之一。
   */
  titleKey: MessageKey;
  descriptionKey: MessageKey;
  icon?: string;
  /**
   * 填进输入框的提示词文本。
   *
   * **刻意保持不本地化。** 它不是界面文案，而是发给模型的任务指令：
   * 模型见过中英文任务指令的表现没有可测量的差异，而一旦跟着界面语言变，
   * 用户就再也无法确定"我按回车之后到底会给模型发什么"。
   * 需要换语言时，用户自己输入目标语言即可 ——
   * 而这恰好就是「翻译为英文」这条指令存在的意义。
   */
  template: string;
}

export const DEFAULT_PROMPT_COMMANDS: PromptCommand[] = [
  {
    key: "translate",
    titleKey: "chat.commands.translate.title",
    descriptionKey: "chat.commands.translate.description",
    template: "请将以下内容翻译成自然地道的中文，保持原文语气与格式：\n\n",
  },
  {
    key: "en",
    titleKey: "chat.commands.translate_en.title",
    descriptionKey: "chat.commands.translate_en.description",
    template: "Please translate the following content into fluent, native-level English:\n\n",
  },
  {
    key: "code",
    titleKey: "chat.commands.code.title",
    descriptionKey: "chat.commands.code.description",
    template: "请作为资深技术专家审查以下代码，指出潜在隐患、逻辑漏洞并给出优雅重构方案：\n\n```\n\n```",
  },
  {
    key: "summary",
    titleKey: "chat.commands.summary.title",
    descriptionKey: "chat.commands.summary.description",
    template: "请提炼以下内容的核心关键点与结论摘要，按条目清晰列出：\n\n",
  },
  {
    key: "explain",
    titleKey: "chat.commands.explain.title",
    descriptionKey: "chat.commands.explain.description",
    template: "请用生动形象的比喻和通俗易懂的语言，解释以下概念，不要使用生涩套话：\n\n",
  },
  {
    key: "polish",
    titleKey: "chat.commands.polish.title",
    descriptionKey: "chat.commands.polish.description",
    template: "请帮我润色优化以下文案，使其表达更加干练得体、逻辑清晰：\n\n",
  },
  {
    key: "interview",
    titleKey: "chat.commands.interview.title",
    descriptionKey: "chat.commands.interview.description",
    template: "请你扮演一位严谨的技术面试官，针对以下岗位/主题对我进行模拟面试，一次只问一个问题：\n\n",
  },
];