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
    saving: "儲存中…",
    saved: "已儲存",
    delete: "刪除",
    deleting: "刪除中…",
    edit: "編輯",
    rename: "重新命名",
    close: "關閉",
    retry: "重試",
    back: "返回",
    copy: "複製",
    copied: "已複製",
    download: "下載",
    upload: "上傳",
    export: "匯出",
    exportAs: "匯出為 {format}",
    importing: "匯入中…",
    refresh: "重新整理",
    create: "新增",
    add: "新增",
    remove: "移除",
    clear: "清除",
    submit: "送出",
    search: "搜尋",
    reset: "重設",
    select: "選擇",
    selectAll: "全選",
    deselectAll: "取消全選",
    more: "更多",
    expand: "展開",
    collapse: "收合",
    viewAll: "查看全部",
    loadMore: "載入更多",
    send: "傳送",
    stop: "停止",
    regenerate: "重新產生",
    processing: "處理中…",
    loading: "載入中…",
    optional: "選填",
    required: "必填",
    yes: "是",
    no: "否",
    on: "開",
    off: "關",
    default: "預設",
    none: "無",
    unknown: "未知",
    all: "全部",
    copyFailed: "複製失敗，請手動選取後複製",
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
    fullDateTime: "{date} {time}",
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
    requestFailed: "請求失敗（{status}）",
    networkError: "網路連線失敗，請檢查網路後重試",
    unknownError: "未知錯誤",
    notFound: "內容不存在或已被刪除",
    unhandledCode: "操作失敗（{code}）",
  },

  backendError: {
    fallback: "服務暫時無法使用，請稍後再試",
  },

  unit: {
    seconds: "{n} 秒",
    count: "{n} 個",
    token: "{n} tokens",
    times: "{n} 次",
    currencyUsd: "${value}",
  },

  /** 無障礙標籤。這些會被螢幕閱讀器朗讀，因此不得使用視覺上的簡寫。 */
  a11y: {
    openMenu: "開啟選單",
    closeMenu: "關閉選單",
    moreActions: "更多操作",
    loading: "載入中",
    loadingMore: "正在載入更多內容",
    selected: "已選取",
    expandSection: "展開此區塊",
    collapseSection: "收合此區塊",
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
    system: "跟隨系統",
    light: "淺色",
    dark: "深色",
  },

  /** 語言設定本身。設定頁與登入頁都會用到。 */
  language: {
    label: "介面語言",
    description: "選擇介面顯示語言。AI 的回覆語言也會跟隨此設定。",
    current: "目前語言",
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