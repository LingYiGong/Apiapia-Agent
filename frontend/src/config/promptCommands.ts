export interface PromptCommand {
  key: string;
  title: string;
  description: string;
  icon?: string;
  template: string;
}

export const DEFAULT_PROMPT_COMMANDS: PromptCommand[] = [
  {
    key: "translate",
    title: "翻译为中文",
    description: "将输入的内容翻译为自然、优美、地道的中文",
    template: "请将以下内容翻译成自然地道的中文，保持原文语气与格式：\n\n",
  },
  {
    key: "en",
    title: "翻译为英文",
    description: "将输入的内容翻译为专业、精准的英文 (English)",
    template: "Please translate the following content into fluent, native-level English:\n\n",
  },
  {
    key: "code",
    title: "代码审查与重构",
    description: "分析代码质量、潜在 Bug、性能瓶颈与最佳实践建议",
    template: "请作为资深技术专家审查以下代码，指出潜在隐患、逻辑漏洞并给出优雅重构方案：\n\n```\n\n```",
  },
  {
    key: "summary",
    title: "提炼要点与摘要",
    description: "提取核心观点、关键结论与行动项",
    template: "请提炼以下内容的核心关键点与结论摘要，按条目清晰列出：\n\n",
  },
  {
    key: "explain",
    title: "通俗易懂解释概念",
    description: "用小学生都能听懂的生活化比喻解释复杂术语",
    template: "请用生动形象的比喻和通俗易懂的语言，解释以下概念，不要使用生涩套话：\n\n",
  },
  {
    key: "polish",
    title: "文字润色与修改",
    description: "提升文案质感，去除口语化与赘字，优化行文结构",
    template: "请帮我润色优化以下文案，使其表达更加干练得体、逻辑清晰：\n\n",
  },
  {
    key: "interview",
    title: "模拟面试官",
    description: "针对特定岗位进行深度追问和模拟技术面试",
    template: "请你扮演一位严谨的技术面试官，针对以下岗位/主题对我进行模拟面试，一次只问一个问题：\n\n",
  },
];
