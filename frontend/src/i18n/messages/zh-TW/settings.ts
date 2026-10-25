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
    consolidationPresets: {
      tagFreeUltra: "免費旗艦",
      tagBestValue: "超高性價比",
      tagLongContext: "百萬長視窗",
      tagFastStable: "旗艦級穩定",
      tagHighestAccuracy: "最高精度",
      descNemotronUltra: "550B 參數頂尖 MoE 架構，擅長跨多條歷史記錄綜合推演高維畫像與時序消歧",
      descDeepseekFlash: "中文語義理解頂尖，嚴格遵循 JSON 結構化規範，極低推理延遲與單次整理成本",
      descGeminiFlash: "支援百萬級超長上下文，適合海量零散記憶全景縱覽、跨領域深度交叉整合",
      descGptSol61: "OpenAI 旗艦主力，綜合推演與指令遵循表現卓越，嚴格遵循資料整理脫水規範",
      descSonnet55: "複雜邏輯推理旗艦，對細微時序更迭、條件變更與隱含偏好辨析嚴謹，適合高品質記憶庫重構",
    },
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
    defaultPromptValue: "你是一個智能、真誠、有洞察力的個人智能助理。請根據使用者提供的歷史背景和長期記憶為使用者提供高品質服務。",
    promptHint:
      "該指令將作為所有對話的基礎系統人设。若留空，系統將使用通用預設設定。",
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

  /** 自訂指令 (Custom Instructions) */
  customInstructions: {
    groupLabel: "自訂指令 (Custom Instructions)",
    aboutUserLabel: "希望助理了解您的哪些背景資訊？（關於您）",
    aboutUserDesc: "分享您的職業、技術棧、常駐地或興趣等。無論開啟哪輪新對話，助理都會參考這些上下文。",
    aboutUserPlaceholder: "例如：我是一名全端工程師，主要使用 Python / TypeScript 開發；常駐台北；喜歡簡潔高效的程式碼。",
    responseStyleLabel: "希望助理如何進行回覆？（回答風格與偏好）",
    responseStyleDesc: "指定助理的語氣偏好、詳細程度、程式碼風格及格式要求等。",
    responseStylePlaceholder: "例如：請開門見山，避免冗餘客套；寫程式碼時請包含完整的 TypeScript 型別標註；複雜方案請分步驟闡述。",
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
    selectAria: "選擇{kind}{current}",
    selectAriaCurrent: "，目前 {name}",
    title: "選擇{kind}",
    /** 行動版底部抽屜的無障礙描述（視覺隱藏，抽屜沒有可見副標題） */
    sheetDesc: "按等級挑選{kind}，或直接搜尋名稱與廠商。",
    current: "目前: {name}",
    searchAria: "搜尋{kind}",
    searchPh: "搜尋{kind}",
    clearSearch: "清除搜尋",
    listAria: "{kind}清單",
    /** 等級卡片區（role="group"）的無障礙名稱 */
    tierGroupAria: "{kind}等級篩選",
    noMatch: "找不到符合的{kind}",
    searchAll: "在「自訂」中搜尋全部模型",
    multimodalBadge: "多模態",
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

  /** 模型選型引導：價格檔與推薦理由 */
  modelGuide: {
    /** 等級卡片裡的「免費」一檔：置頂的三個免費入口 */
    groupFree: "免費",

    /** 等級卡片裡的「正常」一檔：精選的日常性價比模型 */
    groupNormal: "正常",

    /** 等級卡片裡的「聰明」一檔：精選的旗艦模型 */
    groupSmart: "聰明",

    /** 等級卡片裡的「自訂」一檔：不做等級篩選，瀏覽全部 */
    groupCustom: "自訂",

    /** 四張等級卡片的一行說明 */
    tierDesc: {
      free: "三個免費首選，零成本體驗",
      normal: "精選日常主力，兼顧能力與價格",
      smart: "精選旗艦，複雜任務更強，價格更高",
      custom: "搜尋並篩選全部模型",
    },

    /** 價格檔：依廠商公開列表價粗分，只回答「貴不貴」 */
    price: {
      free: "免費",
      budget: "低價",
      standard: "標準",
      premium: "旗艦",
      /** 精確價格徽章的提示：單位是美元 / 百萬 tokens */
      perMillion: "輸入 / 輸出，每百萬 tokens（USD）",
    },

    /** 精選畫像的選型理由。鍵名與 lib/modelGuide.ts 的常數對應。 */
    reason: {
      nemotronUltra: "【旗艦級推理】550B 總參 / 55B 啟用的 MoE，長程 Agent 與複雜邏輯推演能力突出，超長上下文、純文字輸入。",
      nemotron35Vl: "【免費多模態旗艦】NVIDIA 3.5 Super VL，12B 啟用的 MoE，原生多模態，免費檔裡的視覺與長文本首選。",
      freeRouter: "【零成本體驗】智慧調度可用免費模型池，適合功能探索與日常基礎對話。",
      sonnet: "【綜合旗艦】日常問答、長篇寫作與程式碼除錯表現出色，綜合推理能力領先。",
      gptSol61: "【高能旗艦】頂尖的推理性能與回應速度，適合處理複雜長鏈任務與高頻對話。",
      gemini38: "【長文與多模態】具備超長上下文視窗與強大的多模態解析能力，兼顧性能與呼叫成本。",
      deepseekFlash: "【超高性價比主力】長文本理解透徹，指令遵從度極高，經濟高效。",
      qwenMax: "【中文創作與潤色】文字表達細膩，公文策劃與專業長篇寫作能力突出。",
      gpt6Luna: "【超低價高頻】OpenAI GPT-6 Luna，約 $0.1/$0.5 每百萬 tokens，適合摘要、分類、批次處理等高頻率輕量任務。",
      opus55: "【深度推理旗艦】專為攻堅複雜前沿難題與長程工程推演設計，邏輯深度行業領先。",
      gptAstra: "【前沿複雜任務】專為複雜長鏈路問題與高難度端到端任務建構的旗艦模型。",
      geminiArgon: "【Google 深度推理旗艦】專為複雜軟體工程、深度數理與科學推演設計，兼具原生多模態與超長上下文。",
      kimiK3: "【超長上下文攻堅】擅長整部專著研讀、大型工程程式碼庫全景分析與長程規劃。",
      fable51: "【Mythos 級自主工作】Anthropic Claude Fable 5.1，專為自主知識工作與長程 agentic coding 設計，適合複雜端到端任務。",
    },
  },

  errors: {
    syncLanguageFailed: "同步語言模型失敗，請檢查後端 .env 是否設定了有效的 API 金鑰",
    syncImageFailed: "同步繪圖模型失敗，請檢查後端 .env 是否設定了有效的生圖服務金鑰",
    syncVideoFailed: "同步影片模型失敗，請檢查後端 .env 是否設定了有效的 OpenRouter 金鑰",
    syncAudioFailed: "同步語音模型失敗，請檢查後端 .env 是否設定了有效的 OpenRouter 金鑰",
  },
} as const;
