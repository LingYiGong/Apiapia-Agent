/** 長期記憶庫頁面文案。 */
export default {
  title: "記憶庫",

  search: {
    label: "搜尋記憶",
    placeholder: "搜尋記憶…",
    clear: "清除搜尋",
    submit: "搜尋",
    submitSr: "搜尋記憶",
  },

  section: {
    searchResults: "搜尋結果",
    all: "全部記憶",
    count: "（{count}）",
  },

  counter: {
    foundPlus: "（已找到 {count}+ 筆）",
    loadedOfTotal: "（已載入 {count} / {total} 筆）",
    total: "（共 {total} 筆）",
  },

  export: {
    tip: "將全部 {count} 筆記憶匯出為 JSON",
    sr: "匯出 JSON",
    inProgress: "正在匯出記憶資料…",
    partial: "已匯出 {exported} 筆（伺服器總數為 {total} 筆，可能未完整）",
    all: "已匯出全部 {exported} 筆記憶",
    failed: "匯出記憶資料失敗",
  },

  showAll: "顯示全部",

  empty: {
    searchTitle: "找不到符合的記憶記錄",
    searchDesc: "換個關鍵字試試，或清除搜尋框。",
    browseTitle: "尚無記憶記錄",
    browseDesc:
      "在與 AI 對話中提及關於您的背景、習慣或關鍵事實，模型會自動萃取並記錄於此。",
    resetSearch: "重設搜尋",
    newChat: "開始新對話",
  },

  loadMore: {
    busy: "正在載入…",
    searching: "載入更多結果",
    browsing: "載入更多",
  },

  endOfList: "已顯示全部 {total} 筆記憶",

  card: {
    edited: "已編輯",
    editTip: "編輯記憶",
    deleteTip: "刪除記憶",
  },

  edit: {
    title: "編輯長期記憶",
    desc: "修改此筆記憶內容，AI 將在全站對話中以修改後的事實作為參考。",
    label: "記憶內容",
    placeholder: "修改記憶內容…",
    /** ⌘ 只有 macOS 才正確，Windows 使用者應看到 Ctrl。 */
    shortcutMac: "⌘ + Enter 完成修改",
    shortcutOther: "Ctrl + Enter 完成修改",
    charCount: "{count} 字",
    cancel: "取消",
    saving: "正在儲存…",
    done: "完成",
    saved: "已更新記憶",
    failed: "修改記憶失敗",
  },

  remove: {
    title: "刪除這筆記憶",
    desc: "確定要從記憶庫中永久移除這筆記錄嗎？刪除後 AI 將不再參考該事實，此操作無法撤銷。",
    confirm: "刪除",
    done: "已刪除記憶",
    failed: "刪除記憶失敗",
  },

  errors: {
    searchFallback: "檢索記憶庫失敗，已返回全部記憶",
    loadFailed: "載入記憶失敗，請重試",
  },
} as const;