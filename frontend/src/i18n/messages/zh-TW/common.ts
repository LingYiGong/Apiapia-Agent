/**
 * 共用文案：按鈕、對話框、回饋、相對時間、時間分組、通用錯誤。
 *
 * 鍵必須與 `messages/zh-CN/common.ts` 完全一致 —— 訊息型別由 runtime.ts
 * 從 zh-CN 反推，少一個鍵就會在 `tsc --noEmit` 報錯。
 *
 * 用詞採台灣慣用術語（影片／資料／預設／網路），不是單純的簡繁轉換：
 * 只換字不換詞的話，台灣讀者會看到一整頁讀起來像翻譯腔的中文。
 *
 * 單複數：`_one` / `_other` 兩檔。中繁中文兩者字面相同，但仍照約定補齊，
 * 讓讀取端不必為它們寫特例。
 */
export default {
  action: {
    confirm: "確認",
    cancel: "取消",
    save: "儲存",
    close: "關閉",
    retry: "重試",
    processing: "處理中…",
  },

  /**
   * 相對時間。超過 30 天改用「月日」，避免「23 天前」這種累贅的形態。
   */
  time: {
    justNow: "剛剛",
    minutesAgo_one: "{n} 分鐘前",
    minutesAgo_other: "{n} 分鐘前",
    hoursAgo_one: "{n} 小時前",
    hoursAgo_other: "{n} 小時前",
    daysAgo_one: "{n} 天前",
    daysAgo_other: "{n} 天前",
    monthDay: "{month} 月 {day} 日",
  },

  /**
   * 清單的時間分組。對話清單與記憶庫共用同一組滾動視窗
   * （見 lib/timeGroups.ts），所以文案也放在這裡。
   */
  timeGroups: {
    last24h: "最近 24 小時",
    last3d: "最近 3 天",
    last7d: "最近 7 天",
    earlier: "更早",
    pinnedConversations: "置頂對話",
    pinnedMemories: "置頂記憶",
  },

  /** 通用 fallback 錯誤。帶業務語意的錯誤留在各自區域。 */
  error: {
    operationFailed: "操作失敗",
  },

  /** 無障礙標籤。這些會被螢幕閱讀器朗讀，因此不得使用視覺上的簡寫。 */
  a11y: {
    mobileTabBar: "行動裝置底部標籤列",
  },

  /** 頭像選單與帳號徽章 */
  account: {
    menu: "{username} 的帳戶選單",
    adminReady: "超級管理員權限已就緒",
    standardUser: "已登入標準使用者",
    adminBadge: "管理員",
    standardBadge: "標準",
    logout: "登出",
  },

/** 語音用戶端的本地驗證與網路 fallback 文案（lib/speech.ts）。 */
  speech: {
    transcribeEmpty: "錄音內容為空",
    transcribeTooLarge: "音訊檔案約 {size}MB，超過 {max}MB 上限",
    transcribeFailed: "語音辨識失敗",
    speakEmptyText: "待朗讀的文字為空",
    speakTextTooLong: "待朗讀文字 {count} 字，超過單次 {max} 字上限",
    speakFailed: "語音合成失敗",
  },
  theme: {
    label: "主題",
    system: "系統",
    light: "淺色",
    dark: "深色",
  },

  /** 語言設定本身。設定頁與登入頁都會用到。 */
  language: {
    label: "介面語言",
    description: "選擇介面顯示語言。AI 的回覆語言也會跟隨此設定。",
  },

  /** 四種模型清單「同步」的共用結果回饋。 */
  modelSync: {
    emptyTitle: "{scope}同步後清單為空",
    emptyDescription: "未取得任何模型，請檢查後端 .env 中的服務憑證是否有效。",
    foundNew: "發現 {count} 個新的{scope}",
    updatedDescription: "{scope}清單已更新，可在選擇器中檢視",
    upToDate: "{scope}清單已是最新，沒有新增項目",
    scope: {
      language: "語言模型",
      image: "繪圖模型",
      video: "影片模型",
      speech: "語音模型",
    },
  },
} as const;