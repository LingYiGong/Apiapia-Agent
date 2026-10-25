/** 偏好设置页、模型选择器、主题与保存条文案。 */
export default {
  title: "偏好设置",
  adminBadge: "管理员",

  appearance: {
    label: "界面外观",
    avatarMenuHeading: "外观风格",
  },

  /** 主题三档，与 components/common/ThemeSegments.tsx 共用 */
  themeToggle: {
    tooltip: "切换外观（当前：{current}）",
    srApple: "切换外观主题",
    sr: "切换主题",
    heading: "界面外观",
  },

  modelGroup: {
    default: "默认模型设置",
    trialBadge: "体验模式 · 仅免费",
    counts: "{chat} 语言 · {image} 绘图 · {video} 视频 · {speech} 语音",
    language: "语言模型",
    image: "绘图模型",
    video: "视频模型",
    speech: "语音模型",
    sttSub: "语音识别",
    ttsSub: "语音合成",
    sttKind: "语音识别模型",
    ttsKind: "语音合成模型",
    sttPlaceholder: "选择语音识别模型",
    ttsPlaceholder: "选择语音合成模型",
    chatPlaceholder: "选择会话初始模型",
    imagePlaceholder: "选择绘图模型",
    videoPlaceholder: "选择视频模型",
    capabilityVision: "支持图文视觉",
    capabilityImage: "位图生成",
    capabilityVideo: "视频生成",
    capabilityStt: "语音转文字",
    capabilityTts: "文字转语音",
    voiceNote:
      "当前合成模型支持 {count} 个音色，默认使用第一个（{voice}）。",
    voiceNoteNoList: "该模型未公布音色列表，将使用供应商默认音色。",
  },

  memoryGroup: {
    label: "记忆系统",
    toggle: "自动提取与上下文检索",
    toggleAria: "长期记忆开关",
    modelLabel: "提取模型 (Memory LLM)",
    modelPlaceholder: "选择记忆提炼模型",
    modelIdLabel: "记忆提炼模型 ID",
    modelIdPlaceholder: "例如: openai/gpt-4o-mini",
    consolidationModelLabel: "整理合并模型 (Consolidation LLM)",
    consolidationModelPlaceholder: "选择记忆整理模型",
    consolidationGuideTitle: "推荐整理模型及选用理由（点击卡片可快速选用）：",
    consolidationCurrentSelected: "当前选用",
    manualModel: "✍️ 手动输入其它模型 ID…",
    consolidationPresets: {
      tagFreeUltra: "免费旗舰",
      tagBestValue: "超高性价比",
      tagLongContext: "百万长窗口",
      tagFastStable: "旗舰级稳定",
      tagHighestAccuracy: "最高精度",
      descNemotronUltra: "550B 参数顶尖 MoE 架构，擅长跨多条历史记录综合推演高维画像与时序消歧",
      descDeepseekFlash: "中文语义理解顶尖，严格遵循 JSON 结构化规范，极低推理延迟与单次整理成本",
      descGeminiFlash: "支持百万级超长上下文，适合海量零散记忆全景纵览、跨领域深度交叉整合",
      descGptSol61: "OpenAI 旗舰主力，综合推演与指令遵循表现卓越，严格遵循数据整理脱水规范",
      descSonnet55: "复杂逻辑推理旗舰，对细微时序更迭、条件变更与隐含偏好辨析严谨，适合高质量记忆库重构",
    },
  },

  about: {
    label: "关于系统",
    product: "Apiapia",
    versionLabel: "软件版本",
    versionValue: "v{version}",
    archLabel: "客户端架构",
    archValue: "Next.js 14 · React 18",
    engineLabel: "记忆检索引擎",
    engineValue: "PostgreSQL · pgvector",
    policyLabel: "更新策略",
    policyValue: "自动在线校验",
    checkUpdate: "检查更新",
  },

  /** 系统人设与采样温度 */
  persona: {
    groupLabel: "系统提示词 (System Prompt)",
    groupDesc: "默认人设与全局指导原则",
    resetDefault: "恢复通用默认",
    defaultPromptValue: "你是一个智能、真诚、有洞察力的个人智能助理。请根据用户提供的历史背景和长期记忆为用户提供高质量服务。",
    promptHint:
      "该指令将作为所有对话的基础系统人设。若留空，系统将使用通用默认设定。",
    promptPhCustom: "输入自定义的人设指令、口吻偏好与准则…",
    temperatureLabel: "采样温度 (Temperature)",
    temperatureAria: "采样温度",
    temperaturePrecise: "严谨精确",
    temperatureBalanced: "日常平衡",
    temperatureCreative: "发散创意",
    temperatureValueText: "{value}，{label}",
    temperatureTicks: {
      min: "0.0 严谨精确",
      mid: "1.0 均衡日常",
      max: "2.0 发散创意",
    },
  },

  /** 自定义指令 (Custom Instructions) */
  customInstructions: {
    groupLabel: "自定义指令 (Custom Instructions)",
    aboutUserLabel: "希望助理了解您的哪些背景信息？（关于您）",
    aboutUserDesc: "分享您的职业、技术栈、常驻地或兴趣等。无论开启哪轮新对话，助理都会参考这些上下文。",
    aboutUserPlaceholder: "例如：我是一名全栈工程师，主要使用 Python / TypeScript 开发；常驻上海；喜欢简洁高效的代码。",
    responseStyleLabel: "希望助理如何进行回复？（回答风格与偏好）",
    responseStyleDesc: "指定助理的口吻偏好、详细程度、代码风格及格式要求等。",
    responseStylePlaceholder: "例如：请开门见山，避免冗余客套；写代码时请包含完整的 TypeScript 类型标注；复杂方案请分步骤阐述。",
  },

  /** 保存条（桌面固定条 + 移动悬浮条） */
  saveBar: {
    saved: "已保存",
    dirty: "未保存更改",
    clean: "已是最新",
    reset: "还原",
    tip: "保存偏好设置（⌘S / Ctrl+S）",
    save: "保存设置",
    savingLong: "正在保存…",
    savingShort: "保存中",
    mobileNotice: "偏好设置有未保存更改",
    resetDone: "已还原至上次保存的配置",
    savedDone: "偏好设置已成功保存",
    saveFailed: "保存设置失败",
  },

  /** 模型目录同步按钮 */
  sync: {
    tooltip: "同步可用{scope}列表",
    label: "同步列表",
    syncing: "同步中…",
    sr: "同步{scope}列表",
  },

  /** 模型条目上的能力 / 计费徽章 */
  modelBadges: {
    freeModel: "免费模型",
    paidModel: "API 计费",
    textOnly: "文本模型",
    idPrefix: "ID: {id}",
    missingId: "模型 ID: {id}",
    notSynced: "未在已同步列表中",
  },

  /** 通用 ModelPicker */
  picker: {
    placeholder: "请选择模型",
    loading: "加载中…",
    selectAria: "选择{kind}{current}",
    selectAriaCurrent: "，当前 {name}",
    title: "选择{kind}",
    /** 移动端底部抽屉的无障碍描述（视觉隐藏，抽屉没有可见副标题） */
    sheetDesc: "按等级挑选{kind}，或直接搜索名称与厂商。",
    current: "当前: {name}",
    searchAria: "搜索{kind}",
    searchPh: "搜索{kind}",
    clearSearch: "清除搜索",
    listAria: "{kind}列表",
    /** 等级卡片区（role="group"）的无障碍名称 */
    tierGroupAria: "{kind}等级筛选",
    noMatch: "未找到匹配的{kind}",
    searchAll: "在「自定义」中搜索全部模型",
    multimodalBadge: "多模态",
    freeBadge: "免费",
    trialBadge: "体验模式",
    trialTitle: "当前处于体验模式，仅可使用免费{kind}",
    genericKind: "模型",
    languageKind: "语言模型",
  },

  /** 各类模型选择器的空状态 */
  pickerEmpty: {
    notSynced: "{kind}列表尚未同步，请点击列表上方的「同步列表」按钮完成一次同步。",
    trialNoFree:
      "当前无可用免费{kind}，请联系管理员在 {env} 中登记免费模型。",
    syncedButEmpty: "后端已同步但无可用模型，请检查 .env 中的服务凭证是否有效。",
  },

  /** 推荐模型的选型引导：价格档与推荐理由 */
  modelGuide: {
    /** 等级卡片里的「免费」一档：置顶的三个免费入口 */
    groupFree: "免费",

    /** 等级卡片里的「正常」一档：精选的日常性价比模型 */
    groupNormal: "正常",

    /** 等级卡片里的「聪明」一档：精选的旗舰模型 */
    groupSmart: "聪明",

    /** 等级卡片里的「自定义」一档：不做等级筛选，浏览全部 */
    groupCustom: "自定义",

    /** 四个等级卡片的一行说明 */
    tierDesc: {
      free: "三个免费首选，零成本体验",
      normal: "精选日常主力，兼顾能力与价格",
      smart: "精选旗舰，复杂任务更强，价格更高",
      custom: "搜索并筛选全部模型",
    },

    /** 价格档：按厂商公开列表价粗分，只回答「贵不贵」 */
    price: {
      free: "免费",
      budget: "低价",
      standard: "标准",
      premium: "旗舰",
      /** 精确价格徽章的提示：单位是美元 / 百万 tokens */
      perMillion: "输入 / 输出，每百万 tokens（USD）",
    },

    /** 精选画像的选型理由。键名与 lib/modelGuide.ts 的常量对应。 */
    reason: {
      nemotronUltra: "【旗舰级推理】550B 总参 / 55B 激活的 MoE，长程 Agent 与复杂逻辑推演能力突出，超长上下文、纯文本输入。",
      nemotron35Vl: "【免费多模态旗舰】NVIDIA 3.5 Super VL，12B 激活的 MoE，原生多模态，免费档里的视觉与长文本首选。",
      freeRouter: "【零成本体验】智能调度可用免费模型池，适合功能探索与日常基础对话。",
      sonnet: "【综合旗舰】日常问答、长篇写作与代码调试表现出色，综合推理能力领先。",
      gptSol61: "【高能旗舰】顶尖的推理性能与响应速度，适合处理复杂长链任务与高频对话。",
      gemini38: "【长文与多模态】具备超长上下文窗口与强大的多模态解析能力，兼顾性能与调用成本。",
      deepseekFlash: "【超高性价比主力】长文本理解透彻，指令遵从度极高，经济高效。",
      qwenMax: "【中文创作与润色】文字表达细腻，公文策划与专业长篇写作能力突出。",
      gpt6Luna: "【超低价高频】OpenAI GPT-6 Luna，约 $0.1/$0.5 每百万 tokens，适合摘要、分类、批量处理等高频率轻量任务。",
      opus55: "【深度推理旗舰】专为攻坚复杂前沿难题与长程工程推演设计，逻辑深度行业领先。",
      gptAstra: "【前沿复杂任务】专为复杂长链路问题与高难度端到端任务构建的旗舰模型。",
      geminiArgon: "【谷歌深度推理旗舰】专为复杂软件工程、深度数理与科学推演设计，兼具原生多模态与超长上下文。",
      kimiK3: "【超长上下文攻坚】擅长整部专著研读、大型工程代码库全景分析与长程规划。",
      fable51: "【Mythos 级自主工作】Anthropic Claude Fable 5.1，专为自主知识工作与长程 agentic coding 设计，适合复杂端到端任务。",
    },
  },

  errors: {
    syncLanguageFailed: "同步语言模型失败，请检查后台 .env 是否配置了有效 API 密钥",
    syncImageFailed: "同步绘图模型失败，请检查后台 .env 是否配置了有效的生图服务密钥",
    syncVideoFailed: "同步视频模型失败，请检查后台 .env 是否配置了有效 OpenRouter 密钥",
    syncAudioFailed: "同步语音模型失败，请检查后台 .env 是否配置了有效 OpenRouter 密钥",
  },
} as const;
