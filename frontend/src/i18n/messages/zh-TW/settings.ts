/** 偏好設定頁、模型選擇器、外觀與儲存列文案。 */
export default {
  title: "偏好設定",
  adminBadge: "管理員",

  appearance: {
    label: "介面外觀",
    avatarMenuHeading: "外觀風格",
  },

  themeToggle: {
    tooltip: "切換外觀（目前：{current}）",
    srApple: "切換外觀主題",
    sr: "切換主題",
    heading: "介面外觀",
  },

  modelGroup: {
    default: "預設模型設定",
    trialBadge: "體驗模式 · 僅免費",
    counts: "{chat} 語言 · {image} 繪圖 · {video} 影片 · {speech} 語音",
    language: "語言模型",
    image: "繪圖模型",
    video: "影片模型",
    speech: "語音模型",
    sttSub: "語音辨識",
    ttsSub: "語音合成",
    sttKind: "語音辨識模型",
    ttsKind: "語音合成模型",
    sttPlaceholder: "選擇語音辨識模型",
    ttsPlaceholder: "選擇語音合成模型",
    chatPlaceholder: "選擇對話預設模型",
    imagePlaceholder: "選擇繪圖模型",
    videoPlaceholder: "選擇影片模型",
    capabilityVision: "支援圖文視覺",
    capabilityImage: "點陣圖生成",
    capabilityVideo: "影片生成",
    capabilityStt: "語音轉文字",
    capabilityTts: "文字轉語音",
    voiceNote: "目前的合成模型支援 {count} 個音色，預設使用第一個（{voice}）。",
    voiceNoteNoList: "此模型未公布音色清單，將使用供應商預設音色。",
  },

  memoryGroup: {
    label: "記憶系統",
    toggle: "自動萃取與脈絡檢索",
    toggleAria: "長期記憶開關",
    modelLabel: "萃取模型 (Memory LLM)",
    modelPlaceholder: "選擇記憶提煉模型",
    modelIdLabel: "記憶提煉模型 ID",
    modelIdPlaceholder: "例如: openai/gpt-4o-mini",
    consolidationModelLabel: "整理合併模型 (Consolidation LLM)",
    consolidationModelPlaceholder: "選擇記憶整理模型",
    consolidationGuideTitle: "推薦整理模型及選用理由（點擊卡片可快速選用）：",
    consolidationCurrentSelected: "當前選用",
    manualModel: "✍️ 手動輸入其他模型 ID…",
  },

  about: {
    label: "關於系統",
    product: "Apiapia",
    versionLabel: "軟體版本",
    versionValue: "v{version}",
    archLabel: "用戶端架構",
    archValue: "Next.js 14 · React 18",
    engineLabel: "記憶檢索引擎",
    engineValue: "PostgreSQL · pgvector",
    policyLabel: "更新策略",
    policyValue: "自動線上驗證",
    checkUpdate: "檢查更新",
  },

  persona: {
    groupLabel: "系統提示詞 (System Prompt)",
    groupDesc: "預設人設與全域指導原則",
    resetDefault: "恢復通用預設",
    promptHint:
      "該指令將作為所有對話的基礎系統人設。若留空，系統將使用通用預設設定。",
    promptPhCustom: "輸入自訂的人設指令、語氣偏好與準則…",
    temperatureLabel: "取樣溫度 (Temperature)",
    temperatureAria: "取樣溫度",
    temperaturePrecise: "嚴謹精確",
    temperatureBalanced: "日常平衡",
    temperatureCreative: "發散創意",
    temperatureValueText: "{value}，{label}",
    temperatureTicks: {
      min: "0.0 嚴謹精確",
      mid: "1.0 均衡日常",
      max: "2.0 發散創意",
    },
  },

  saveBar: {
    saved: "已儲存",
    dirty: "尚未儲存的變更",
    clean: "已是最新",
    reset: "還原",
    tip: "儲存偏好設定（⌘S / Ctrl+S）",
    save: "儲存設定",
    savingLong: "正在儲存…",
    savingShort: "儲存中",
    mobileNotice: "偏好設定有尚未儲存的變更",
    resetDone: "已還原至上次儲存的設定",
    savedDone: "偏好設定已成功儲存",
    saveFailed: "儲存設定失敗",
  },

  sync: {
    tooltip: "同步可用的{scope}清單",
    label: "同步清單",
    syncing: "同步中…",
    sr: "同步{scope}清單",
  },

  modelBadges: {
    freeModel: "免費模型",
    paidModel: "API 計費",
    textOnly: "文字模型",
    idPrefix: "ID: {id}",
    missingId: "模型 ID: {id}",
    notSynced: "未在已同步清單中",
  },

  picker: {
    placeholder: "請選擇模型",
    loading: "載入中…",
    selectAria: "選擇{kind}",
    selectAriaCurrent: "，目前 {name}",
    title: "選擇{kind}",
    /** 行動版底部抽屜的無障礙描述（視覺隱藏，抽屜沒有可見副標題） */
    sheetDesc: "按場景挑選{kind}，或直接搜尋名稱與廠商。",
    current: "目前: {name}",
    searchAria: "搜尋{kind}",
    searchPh: "搜尋{kind}",
    clearSearch: "清除搜尋",
    listAria: "{kind}清單",
    /** 分類膠囊區（role="group"）的無障礙名稱 */
    filterGroupAria: "{kind}分類篩選",
    noMatch: "找不到符合的{kind}",
    multimodalBadge: "多模態",
    allGroup: "全部",
    freeBadge: "免費",
    trialBadge: "體驗模式",
    trialTitle: "目前處於體驗模式，僅可使用免費{kind}",
    genericKind: "模型",
    languageKind: "語言模型",
  },

  pickerEmpty: {
    notSynced: "{kind}清單尚未同步，請點擊清單上方的「同步清單」按鈕完成一次同步。",
    trialNoFree: "目前沒有可用的免費{kind}，請聯絡管理員在 {env} 中登記免費模型。",
    syncedButEmpty: "後端已同步但沒有可用模型，請檢查 .env 中的服務憑證是否有效。",
  },

  /** 模型選型引導：需求標籤、價格檔、推薦理由與避坑提示 */
  modelGuide: {
    /** ModelPicker 分組篩選裡的「推薦」一檔 */
    groupRecommend: "綜合推薦",

    /** ModelPicker 分組篩選裡的「免費」一檔：目錄裡所有免費模型 */
    groupFree: "免費",

    /** ModelPicker 一級分類區的小標題 */
    sectionUseCase: "按場景選型",

    /** 需求標籤：既作模型行的徽章，也作 ModelPicker 的分類名 */
    useCase: {
      writing: "寫作翻譯",
      reasoning: "深度思考",
      coding: "程式開發",
      visionDocs: "看圖識文",
      fastFree: "極速與免費",
    },

    /** 價格檔：依廠商公開列表價粗分，只回答「貴不貴」 */
    price: {
      free: "免費",
      budget: "低價",
      standard: "標準",
      premium: "旗艦",
    },

    /** 18 條推薦畫像的選型理由。鍵名與 lib/modelGuide.ts 的常數對應。 */
    reason: {
      sonnet: "【綜合旗艦】日常問答、長篇寫作與程式碼除錯表現出色，綜合推理能力領先。",
      gptSol61: "【高能旗艦】頂尖的推理性能與回應速度，適合處理複雜長鏈任務與高頻對話。",
      gemini38: "【長文與多模態】具備超長上下文視窗與強大的多模態解析能力，兼顧性能與呼叫成本。",
      glm53: "【中文理解專家】深諳中文語義與長文組織邏輯，方案撰寫與工程實現紮實穩定。",
      gptLuna: "【日常高性價比】輕快敏捷，適合做為預設模型處理日常提問與高頻輕量任務。",
      glm53Flash: "【高性價比多模態】呼叫成本親民，支援圖文解析與快速程式碼排查，長任務無負擔。",
      opus55: "【深度推理旗艦】專為攻堅複雜前沿難題與長程工程推演設計，邏輯深度行業領先。",
      freeRouter: "【零成本體驗】智慧調度可用免費模型池，適合功能探索與日常基礎對話。",
      deepseekPro: "【程式碼與邏輯專家】擅長演算法實現、系統除錯與複雜邏輯推演，開發工程師首選。",
      grok47: "【理工推導強項】數理邏輯推導與程式能力突出，回應敏捷俐落。",
      qwenMax: "【中文創作與潤色】文字表達細膩，公文策劃與專業長篇寫作能力突出。",
      gptAstra: "【前沿複雜任務】專為複雜長鏈路問題與高難度端到端任務建構的旗艦模型。",
      kimiK3: "【超長上下文攻堅】擅長整部專著研讀、大型工程程式碼庫全景分析與長程規劃。",
      deepseekFlash: "【超高性價比主力】長文本理解透徹，指令遵從度極高，經濟高效。",
      qwen38Flash: "【輕快多模態】圖表辨識、文件解析與日常中文問答綜合表現穩定。",
      minimaxM3: "【均衡多模態】支援圖文與影片多模態分析，兼備百萬字長上下文能力。",
      mimoFlash: "【超輕量多模態】極低呼叫成本，適合日常視覺問答與輕量互動。",
      haiku55: "【極速輕巧】回應極速，適合輕量問答、文本提煉與快速格式轉換。",
    },

    /** 使用提示 */
    caveat: {
      longPrompt: "提示：單次對話輸入超過數十萬字時按階梯費率計費，常規使用不受影響。",
      priceRise: "提示：官方計劃於後續調整價格，長期穩定業務需提前評估成本。",
      thinking: "提示：強制開啟深度思考過程，解答複雜難題更嚴謹，但耗時與消耗會增加。",
      freeUnstable: "提示：公共免費節點可用性可能隨負載波動，正式生產建議選用商用模型。",
      shortContext: "提示：上下文上限為 50 萬字，低於多數 100 萬字模型，分析超大專案時留意字數。",
      primeVariant: "提示：若遇 -prime 加速變体價格較高，追求高性價比建議選用標準版。",
      kimiPrice: "提示：長文本生成單價較高，生成超長回覆時會消耗較多額度。",
      peakPricing: "提示：廠商實行峰谷定價機制，尖峰時段（UTC 01:00-04:00、06:00-10:00）費率會有浮動。",
      haikuLongPrompt: "提示：一次性輸入超過 10 萬字時進入高階費率檔位，超長文件場景請留意。",
    },
  },

  errors: {
    syncLanguageFailed: "同步語言模型失敗，請檢查後端 .env 是否設定了有效的 API 金鑰",
    syncImageFailed: "同步繪圖模型失敗，請檢查後端 .env 是否設定了有效的生圖服務金鑰",
    syncVideoFailed: "同步影片模型失敗，請檢查後端 .env 是否設定了有效的 OpenRouter 金鑰",
    syncAudioFailed: "同步語音模型失敗，請檢查後端 .env 是否設定了有效的 OpenRouter 金鑰",
  },
} as const;