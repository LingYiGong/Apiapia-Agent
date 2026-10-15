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
    manualModel: "✍️ 手动输入其它模型 ID…",
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
    promptHint:
      "该提示词将作为与大模型交流的基础人设指令。若留空，系统将使用通用标准人设。",
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
    current: "当前: {name}",
    searchAria: "搜索{kind}",
    searchPh: "搜索{kind}",
    clearSearch: "清除搜索",
    listAria: "{kind}列表",
    noMatch: "未找到匹配的{kind}",
    multimodalBadge: "多模态",
    allGroup: "全部",
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

  /** 推荐模型的选型引导：需求标签、价格档、推荐理由与避坑提示 */
  modelGuide: {
    /** ModelPicker 分组筛选里的「推荐」一档 */
    groupRecommend: "综合推荐",

    /** ModelPicker 一级分类区的小标题 */
    sectionUseCase: "按场景选型",

    /** 场景标签：既作模型行的徽章，也作 ModelPicker 的分类名 */
    useCase: {
      writing: "写作与翻译",
      reasoning: "深度思考",
      coding: "编程开发",
      visionDocs: "看图与识文",
      fastFree: "极速与免费",
    },

    /** 价格档：按厂商公开列表价粗分，只回答「贵不贵」 */
    price: {
      free: "免费",
      budget: "低价",
      standard: "标准",
      premium: "旗舰",
    },

    /** 18 条推荐画像的「为什么选它」。键名与 lib/modelGuide.ts 的常量对应。 */
    reason: {
      sonnet: "【全能首选】日常问答、长篇写作、代码调试样样精通，综合智商极高。",
      gptSol61: "【旗舰级实力】接近顶配智商且速度飞快，超适合复杂多步对话与重度使用。",
      gemini38: "【极速看图与长文】看复杂图片、图表分析、读百万字超长资料飞快，全能实惠。",
      glm53: "【中文全能实力】中文理解与长文表达功底深厚，方案撰写与代码实现很扎实。",
      gptLuna: "【日常高性价比】轻巧实惠，适合作为默认模型处理日常提问与高频对话。",
      glm53Flash: "【极速多模态】价格极其实惠，同时支持图片解析与快速代码排查，长任务无负担。",
      opus55: "【智商天花板】专攻顶级难题、深度学术推演与复杂长程改造，最聪明也最昂贵。",
      freeRouter: "【完全免费】官方智能调度可用免费模型，零成本开箱即用，适合随心探索。",
      deepseekPro: "【代码与逻辑专家】算法编写、复杂工程排错与数理推导极扎实，开发主力推荐。",
      grok47: "【极速理工强手】数理逻辑推导与编程能力顶尖，响应迅捷凌厉。",
      qwenMax: "【中文公文与写作】中文文学润色、方案策划、公文撰写能力拔尖，文字底蕴深厚。",
      gptAstra: "【顶级复杂任务】OpenAI 性能最强的全能模型，专为攻坚棘手的长链端到端任务设计。",
      kimiK3: "【超长文本攻坚】整本专著、海量代码库深入分析与长程规划的利器。",
      deepseekFlash: "【超高人气主力】超长文档理解透彻、指令遵循极为听话，且成本极其亲民。",
      qwen38Flash: "【高性价比多模态】轻松看图识别、解析表格与日常中文问答，轻快好用。",
      minimaxM3: "【实惠多模态】支持图片与视频多模态分析，百万字大上下文，表现均衡。",
      mimoFlash: "【轻量多模态】超低调用成本，看图识物与日常问答表现稳定。",
      haiku55: "【极速轻巧】响应毫秒级飞快，超适合日常闲聊、提取摘要、简单修改等轻量任务。",
    },

    /** 有坑才写。没有 caveatKey 的模型不显示这一段。 */
    caveat: {
      longPrompt: "提示：单次对话文字量极其庞大（超数十万字）时单价会有阶梯上浮，常规使用不受影响。",
      priceRise: "提示：官方计划于 2027 年上调价格，长期稳定业务需提前评估。",
      thinking: "提示：强制开启深度思考过程，解答复杂难题更严谨，但耗时与消耗会增加。",
      freeUnstable: "提示：随机调度公共免费池，质量与速度可能波动，重要产出建议选用正式模型。",
      shortContext: "提示：上下文上限为 50 万字，低于多数 100 万字模型，分析超大项目时留意字数。",
      primeVariant: "提示：若遇 -prime 加速变体价格较高，追求高性价比建议选用标准版。",
      kimiPrice: "提示：长文本生成单价较高，生成超长回复时会消耗较多额度。",
      peakPricing: "提示：厂商实行峰谷定价机制，高峰时段（UTC 01:00-04:00、06:00-10:00）费率会有浮动。",
      haikuLongPrompt: "提示：一次性输入超过 10 万字时单价会进入高阶档位，超长文档场景请留意。",
    },
  },

  errors: {
    syncLanguageFailed: "同步语言模型失败，请检查后台 .env 是否配置了有效 API 密钥",
    syncImageFailed: "同步绘图模型失败，请检查后台 .env 是否配置了有效的生图服务密钥",
    syncVideoFailed: "同步视频模型失败，请检查后台 .env 是否配置了有效 OpenRouter 密钥",
    syncAudioFailed: "同步语音模型失败，请检查后台 .env 是否配置了有效 OpenRouter 密钥",
  },
} as const;