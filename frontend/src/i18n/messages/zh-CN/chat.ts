/**
 * 聊天模块文案：输入区、会话侧栏、消息气泡、记忆侧栏、Markdown 渲染器、
 * 助手人设与快捷指令。
 */
export default {
  /** 空对话与无障碍播报 */
  empty: {
    title: "Apiapia 已就绪，开始新的对话吧",
    description: "一只有长期记忆的智能猫咪助理，在持续交流中理解您的习惯与偏好。",
    a11yThinking: "正在思考…",
    a11yGenerating: "正在生成回答…",
    a11yDone: "回答已完成",
    logLabel: "对话消息",
  },

  /** 输入区 */
  composer: {
    placeholderChat: "询问 Apiapia",
    placeholderImage: "描述你的图片",
    placeholderVideo: "描述你的视频",
    ariaLabel: "向 Apiapia 发送消息",
    send: "发送消息",
    sendWithEnter: "发送消息（Enter）",
    stop: "停止生成",
    removeAttachment: "移除附件",
    processing: "处理中…",
    fileTooLarge: "文件 {name} 超过 20MB 上传限制",
    tooManyAttachments: "每条消息最多附加 {count} 个文件",
    attachmentsTooLarge: "附件总大小超过 40MB 上限",
    quoteLabel: "正在引用回复：",
    cancelQuote: "取消引用",
    scrollToLatest: "回到最新",
    scrollToLatestTip: "回到最新内容",
    lightboxTitle: "图片预览",
    lightboxAlt: "大图预览",
    lightboxDownload: "下载",
    lightboxDownloadTip: "下载原图",
    lightboxHint: "按 Esc 或点击遮罩空白区域关闭",
    lightboxHintTouch: "双指可缩放，点击空白处关闭",
  },

  /** 「+」创作菜单 */
  creation: {
    menuLabel: "功能与创作菜单",
    sectionTitle: "创作与能力扩展",
    sheetDesc: "选择要上传的内容，或切换创作模式",
    restoreChat: "恢复默认对话",
    gallery: "相册",
    camera: "相机",
    file: "文件",
    imageGen: "生成图片",
    /* 窄屏抽屉里这几行说明文字必须单行（≤20 汉字），否则行高翻倍、
       抽屉超出一屏、最后一行被安全区压住。改文案前先看 ChatArea 的
       CreationMenuRow 注释。 */
    imageGenDesc: "输入描述，生成高品质创意图像",
    videoGen: "生成视频",
    videoGenDesc: "输入场景描述，生成动态视频内容",
    activeMode: "当前模式",
    trialRestricted: "体验账号受限",
    videoBlockedTitle: "当前账号处于体验模式，暂不支持使用 AI 视频生成功能。如需开通，请联系管理员获取完整权限。",
  },

  /** 联网检索模式（与 hooks/useWebSearchMode.ts 共用同一套文案） */
  webSearch: {
    title: "联网检索",
    modeAuto: "自动判断",
    modeOn: "强制开启",
    modeOff: "已关闭",
    descAuto: "根据提问内容自动判断是否联网检索",
    descOn: "每次提问均强制联网检索最新信息",
    descOff: "仅使用模型自身知识，不访问外部网络",
    toastAutoTitle: "🌐 联网检索：自动判断",
    toastAutoDesc: "系统将根据问题类型智能决定是否检索全网",
    toastOnTitle: "🌐 联网检索：始终开启",
    toastOnDesc: "所有提问均将检索互联网最新数据",
    toastOffTitle: "🌐 联网检索：已关闭",
    toastOffDesc: "仅基于模型自身知识库回答",
  },

  /** 语音输入 */
  speech: {
    voiceInput: "语音输入",
    stopRecording: "停止录音",
    stopAndTranscribe: "停止录音并转写",
    recognizing: "识别中…",
    transcribing: "转写中",
    unsupported: "当前浏览器不支持录音",
    unsupportedHint: "当前浏览器不支持语音录音，建议使用现代浏览器或直接输入文字",
    audioToText: "音频转文字",
    audioToTextDesc: "上传录音，转写文字填入输入框",
    noAudioCaptured: "未采集到声音信号，请检查麦克风权限与连接状态",
    noSpeechRecognized: "未能识别到有效语音内容，请重试或改用文字输入",
    transcribeFailed: "语音识别失败，请检查网络后重试",
    limitReached: "已达 {seconds} 秒上限，正在转写",
    meterLabel: "麦克风音量",
    /** 浏览器拒绝麦克风时按 DOMException 分类给出的可执行建议 */
    micDenied: "麦克风权限被拒绝，请在浏览器设置中允许本站使用麦克风",
    micNotFound: "未检测到麦克风设备，请检查设备连接",
    micBusy: "麦克风被其他程序占用，请关闭占用程序后重试",
    micUnsupportedParams: "麦克风不支持当前的采集参数，请尝试更换设备",
    micStartFailed: "无法开始录音：{reason}",
    unknownError: "未知错误",
  },

  /** 会话侧栏 / 历史页 */
  history: {
    newChat: "新建对话",
    /** 底栏图标下的四字短标签，与「新建对话」区分以适配 320px 宽度 */
    newChatShort: "新建",
    /** 404 / 错误边界里「回对话页」按钮的文案。与 newChat 区分：
     *  那是「开一个空白会话」，这里是「离开当前页面回到会话」。 */
    backToChat: "返回对话",
    untitled: "新建对话",
    search: "搜索历史对话",
    searchMobile: "搜索历史记录",
    searchMobilePh: "搜索历史记录…",
    clearSearch: "清除搜索",
    noResultsTitle: "未找到匹配会话",
    noResultsDesc: "换个关键词试试。",
    emptyTitle: "暂无历史对话",
    emptyDesc: "发送一条消息，它就会出现在这里。",
    emptyTitleMobile: "暂无历史对话",
    emptyDescMobile: "在聊天界面发送一条消息，它将自动保存在这里。",
    startNew: "开启新对话",
    pinned: "置顶",
    pinnedDraggable: "置顶（{count}，可拖拽排序）",
    dragHint: "拖拽排序",
    dragHintKeyboard: "按住拖拽排序（键盘请用上移/下移）",
    moveUp: "上移",
    moveDown: "下移",
    moveUpOne: "上移一位",
    moveDownOne: "下移一位",
    actions: "会话操作",
    actionMenu: "操作菜单",
    rename: "重命名",
    delete: "删除",
    deleteConversation: "删除对话",
    deleteTitle: "删除该历史会话",
    deleteDesc: "确定要删除对话「{title}」吗？删除后将无法恢复，该操作不可撤销。",
    pin: "置顶会话",
    unpin: "取消置顶",
    renameTitle: "重命名对话",
    renameLabel: "新标题",
    renamePh: "请输入新标题",
  },

  /** 侧栏折叠与控制 */
  sidebar: {
    collapse: "收起侧栏",
    expand: "展开侧栏",
  },

  /** 移动端头部 */
  header: {
    currentModel: "当前模型：",
    memoryCountTip: "查看当前对话使用的 {count} 条关联记忆",
    memoryCountLabel: "条关联记忆，点击查看",
  },

  /** 消息气泡内的操作与元信息 */
  message: {
    copy: "复制",
    copied: "已复制",
    copiedTip: "已复制到剪贴板",
    copyAnswer: "复制回答",
    copyQuestion: "复制提问",
    quote: "引用",
    quoteAnswer: "引用此回答并继续提问",
    quoteQuestion: "引用此提问",
    regenerate: "重新生成",
    regenerateTip: "用相同提问重新生成回答",
    continue: "继续生成",
    continueTip: "从被截断处继续输出后续内容",
    continuePrompt: "请从上述被截断的地方继续写下去，无需重复前面的内容。",
    edit: "编辑",
    editTip: "编辑这条提问并重新发送",
    editAria: "编辑这条提问",
    editSend: "发送",
    editCancel: "取消",
    speak: "朗读",
    speakQuestion: "朗读此提问",
    speakAnswer: "朗读此回答",
    speakStop: "停止",
    speakStopTip: "停止朗读",
    speakFailedTip: "朗读失败，点击重试",
    speakSynthesizing: "合成中",
    speakingUnavailable: "没有可朗读的内容",
    speakFailed: "语音合成失败，请稍后重试",
    audioPlaybackFailed: "音频播放失败",
    errorHeading: "生成出错：",
    aborted: "已停止",
    abortedTip: "已停止生成，保留当前已输出内容",
    truncated: "长度截断",
    truncatedTip: "达到单次最大生成长度限制，回答已截断",
    replyTime: "回复时间",
    replyModel: "回复模型",
    thinkingDuration: "思考 {duration}",
    thinkingDurationTip: "思考耗时（首字生成响应时间）",
    totalDuration: "总生成耗时",
    tokenUsage: "Tokens: {count}",
    tokenUsageTip: "Token 消耗（输入+输出）",
    toolCalls: "工具调用与检索记录（{count} 项）",
    toolSearch: "执行联网检索",
    toolImage: "执行 AI 图像绘制",
    toolVideo: "执行 AI 视频生成",
    toolOther: "调用工具: {name}",
    toolRunning: "运行中…",
    toolDone: "已完成",
    searching: "正在检索：“{query}”",
    thinkingLive: "思考中…",
    networkFailed: "网络连接失败: {reason}",
    backendUnknownError: "❌ 服务端响应异常，请检查服务日志",
    streamInterrupted: "模型连接在完成事件前中断，回答可能不完整。",
    streamUnsupported: "当前浏览器不支持流式响应（ReadableStream 不可用）",
    modelStreamFailed: "模型流式响应异常终止。",
  },

  /** 聊天气泡里的动作失败反馈 */
  errors: {
    emptyEdit: "消息内容不能为空",
    editFailed: "编辑消息失败",
    regenerateFailed: "重新生成失败",
    regenerateNoSource: "未找到对应的提问记录，无法重新生成",
    resendFailedTitle: "重发失败，对话已按新提问裁剪",
    resendFailedDesc:
      "{reason}。该消息后续内容已移除，您可以重新发送或刷新页面。",
    networkReason: "网络异常",
    memoryTogglePersistFailed: "记忆开关未能保存到服务器，刷新后会恢复原状态",
    syncModelsFailed: "同步模型失败，请检查后台 .env 配置",
  },

  /** 本轮对话召回的记忆 */
  recall: {
    title: "本次关联记忆",
    sheetTitle: "本次关联记忆",
    sheetDesc: "展示系统为本次对话检索到的长期记忆事实",
    disabledTitle: "长期记忆检索已暂停",
    disabledDesc: "开启后，系统将在对话中自动参考并沉淀您的偏好事实。",
    emptyTitle: "暂无关联记忆召回",
    emptyDesc:
      "在对话中提及关于您的个人偏好、工作背景或习惯，系统提炼的事实将实时展示于此。",
    disclaimer: "以下为本次对话中自动命中的长期记忆：",
    vectorized: "已向量化",
    toggleLabel: "长期记忆检索",
    toggleAria: "长期记忆开关",
    gotoLibrary: "前往长期记忆库",
    collapse: "收起记忆",
    expand: "查看记忆",
  },


  /** 「/」快捷指令。key 与 config/promptCommands.ts 一一对应 */
  commands: {
    hint: "快捷提示词指令（方向键选择，Enter / Tab 采纳）",
    count: "{count} 个指令",
    translate: {
      title: "翻译为中文",
      description: "将输入的内容翻译为自然、优美、地道的中文",
    },
    translate_en: {
      title: "翻译为英文",
      description: "将输入的内容翻译为专业、精准的英文 (English)",
    },
    code: {
      title: "代码审查与重构",
      description: "分析代码质量、潜在 Bug、性能瓶颈与最佳实践建议",
    },
    summary: {
      title: "提炼要点与摘要",
      description: "提取核心观点、关键结论与行动项",
    },
    explain: {
      title: "深入浅出解释概念",
      description: "用生活化生动比喻通俗易懂地阐释复杂术语与底层原理",
    },
    polish: {
      title: "文本润色与精简",
      description: "提升表达质感，精简冗余文字，优化行文结构与专业度",
    },
    interview: {
      title: "专业模拟面试",
      description: "针对目标岗位进行深度追问和结构化模拟面试演练",
    },
  },

  /** Markdown 渲染器 */
  markdown: {
    imageAlt: "图片",
    imageZoom: "点击放大查看原图",
    imageLoading: "图片加载中…",
    imageFailed: "图片加载失败，请尝试下载查看",
    download: "下载",
    clickToDownload: "点击下载",
    clickToDownloadVideo: "点击下载视频文件",
    videoLoading: "视频加载中…",
    videoFailed: "视频播放或解析失败，请尝试直接下载查看",
    codeFallback: "code",
    mermaid: "架构图",
    svgTitle: "SVG 矢量图形",
    svgPreview: "SVG 矢量图形预览",
    svgPreviewToggle: "预览图形",
    svgCodeToggle: "查看代码",
    downloadSvg: "下载 SVG",
    thinkingTitle: "思考过程",
    emptyAnswer:
      "（模型已完成思考推演，未输出正文内容。可能由于推理链较长触发单次 Token 截断，或上游服务提前中断。）",
    sourcesSummary: "参考了 {count} 个网页来源",
    aiImageTitle: "AI 生成图像",
    aiVideoTitle: "AI 生成视频",
  },

  /** 单词卡 */
  wordCard: {
    generating: "单词卡生成中…",
    copyWord: "复制单词",
    pronounce: "发音",
    synthesizing: "合成中",
    playing: "播放中",
    pronounceTitle: "点击朗读单词",
    sentencePronounceTitle: "点击发音该例句",
    definitions: "核心释义",
    examples: "经典例句",
    phrases: "常用短语 & 搭配",
    grammar: "语法要点 & 提示",
    cardView: "卡片视图",
    codeView: "代码",
    sourceLabel: "原文:",
    translationLabel: "译文:",
    pronounceSource: "朗读原文",
    /** 卡片名整体。{lang} 由 ISO 语言码查出的语言名填入（见 WordCard.tsx）。 */
    cardLabel: "{lang}卡片",
    ttsReady: "点读发音已就绪",
    /** 音标前面的英/美缩写标 */
    phoneticUk: "英",
    phoneticUs: "美",
    /** 单词卡语言标签。key 为 ISO 639-1 语言码，未收录时回退大写语言码。 */
    langEn: "英语",
    langJa: "日语",
    langFr: "法语",
    langDe: "德语",
    langEs: "西班牙语",
    langKo: "韩语",
    langRu: "俄语",
    langIt: "意大利语",
    langPt: "葡萄牙语",
    langZh: "中文",
    langAr: "阿拉伯语",
  },

  /** 附件缩略图 */
  media: {
    zoomAlt: "放大查看 {alt}",
  },
  /**
   * 智能翻译模式（vocab_tutor / 双向互译）。
   *
   * 单独成组而不是并进 persona：这一组描述的是**翻译模式**的横幅与语种芯片，
   * 与「词汇导师」这个人设是两件事 —— 早期把它们混用，导致界面上渲染出
   * 「点读卡片」当字段标签这种明显不对的东西。
   */
  translate: {
    bannerLabel: "当前模式：智能翻译",
      bannerPair: "（{src} ⇋ {lang} 双向互译）",
    bannerDesc: "— 智能互译、语法解析、动词变形与例句拓展",
    exitTip: "退出翻译模式，恢复默认对话",
    autoSwitchModel: "已自动切换至极速翻译模型：{model}",
    restoreModel: "已恢复默认模型：{model}",
    exitLabel: "退出翻译",
    targetLabel: "互译目标:",
      langChipTip: "开启{src} ⇋ {lang} 双向互译",
    langChipLabel: "{name} ({code})",
    menuTitle: "智能翻译",
    menuDesc: "全语种双向互译，附语法讲解",
    placeholder: "输入需要翻译的单词、短语或句子…",
    /** 语种名。键为 ISO 639-1，值必须是该语言自己的自称 */
    langs: {
      en: "英语",
      ja: "日语",
      zh: "中文",
      es: "西班牙语",
      ar: "阿拉伯语",
      fr: "法语",
      pt: "葡萄牙语",
      ru: "俄语",
      de: "德语",
      ko: "韩语",
      it: "意大利语",
    },
  },
} as const;