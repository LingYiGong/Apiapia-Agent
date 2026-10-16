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
      "該提示詞將作為與大型語言模型交流的基礎人設指令。若留空，系統將使用通用標準人設。",
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

    /** 18 條推薦畫像的「為什麼選它」。鍵名與 lib/modelGuide.ts 的常數對應。 */
    reason: {
      sonnet: "【全能首選】日常問答、長篇寫作、程式碼除錯樣樣精通，綜合智商極高。",
      gptSol61: "【旗艦級實力】接近頂配智商且速度飛快，超適合複雜多步驟對話與重度使用。",
      gemini38: "【極速看圖與長文】看複雜圖片、圖表分析、讀百萬字超長資料飛快，全能實惠。",
      glm53: "【中文全能實力】中文理解與長文表達功底深厚，方案撰寫與程式碼實現很紮實。",
      gptLuna: "【日常高性價比】輕巧實惠，適合做為預設模型處理日常提問與高頻對話。",
      glm53Flash: "【極速多模態】價格極其實惠，同時支援圖片解析與快速程式碼排查，長任務無負擔。",
      opus55: "【智商天花板】專攻頂級難題、深度學術推演與複雜長程改造，最聰明也最昂貴。",
      freeRouter: "【完全免費】官方智慧調度可用免費模型，零成本開箱即用，適合隨心探索。",
      deepseekPro: "【程式碼與邏輯專家】演算法編寫、複雜工程除錯與數理推導極紮實，開發主力推薦。",
      grok47: "【極速理工強手】數理邏輯推導與程式能力頂尖，回應迅捷凌厲。",
      qwenMax: "【中文公文與寫作】中文文學潤色、方案策劃、公文撰寫能力拔尖，文字底蘊深厚。",
      gptAstra: "【頂級複雜任務】OpenAI 性能最強的全能模型，專為攻堅棘手的長鏈端到端任務設計。",
      kimiK3: "【超長文本攻堅】整本專著、海量程式碼庫深入分析與長程規劃的利器。",
      deepseekFlash: "【超高人氣主力】超長文件理解透徹、指令遵循極為聽話，且成本極其親民。",
      qwen38Flash: "【高性價比多模態】輕鬆看圖辨識、解析表格與日常中文問答，輕快好用。",
      minimaxM3: "【實惠多模態】支援圖片與影片多模態分析，百萬字大上下文，表現均衡。",
      mimoFlash: "【輕量多模態】超低呼叫成本，看圖識物與日常問答表現穩定。",
      haiku55: "【極速輕巧】回應毫秒級飛快，超適合日常閒聊、提取摘要、簡單修改等輕量任務。",
    },

    /** 有坑才寫。沒有 caveatKey 的模型不顯示這一段。 */
    caveat: {
      longPrompt: "提示：單次對話文字量極其龐大（超數十萬字）時單價會有階梯上浮，常規使用不受影響。",
      priceRise: "提示：官方計劃於 2027 年上調價格，長期穩定業務需提前評估。",
      thinking: "提示：強制開啟深度思考過程，解答複雜難題更嚴謹，但耗時與消耗會增加。",
      freeUnstable: "提示：隨機調度公共免費池，品質與速度可能波動，重要產出建議選用正式模型。",
      shortContext: "提示：上下文上限為 50 萬字，低於多數 100 萬字模型，分析超大專案時留意字數。",
      primeVariant: "提示：若遇 -prime 加速變體價格較高，追求高性價比建議選用標準版。",
      kimiPrice: "提示：長文本生成單價較高，生成超長回覆時會消耗較多額度。",
      peakPricing: "提示：廠商實行峰谷定價機制，尖峰時段（UTC 01:00-04:00、06:00-10:00）費率會有浮動。",
      haikuLongPrompt: "提示：一次性輸入超過 10 萬字時單價會進入高階檔位，超長文件場景請留意。",
    },
  },

  errors: {
    syncLanguageFailed: "同步語言模型失敗，請檢查後端 .env 是否設定了有效的 API 金鑰",
    syncImageFailed: "同步繪圖模型失敗，請檢查後端 .env 是否設定了有效的生圖服務金鑰",
    syncVideoFailed: "同步影片模型失敗，請檢查後端 .env 是否設定了有效的 OpenRouter 金鑰",
    syncAudioFailed: "同步語音模型失敗，請檢查後端 .env 是否設定了有效的 OpenRouter 金鑰",
  },
} as const;