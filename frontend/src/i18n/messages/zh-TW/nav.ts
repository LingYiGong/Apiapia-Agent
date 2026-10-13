/** 導覽文案。與 config/navigation.ts 的 NAV_ITEMS 一一對應。 */
export default {
  newChat: "新增對話",
  chat: {
    label: "對話",
    shortLabel: "對話",
    menuLabel: "對話",
    mobileTitle: "對話",
  },
  history: {
    label: "歷史",
    shortLabel: "歷史",
    menuLabel: "歷史對話",
    mobileTitle: "對話記錄",
  },
  memory: {
    label: "記憶庫",
    shortLabel: "記憶",
    menuLabel: "長期記憶庫",
    mobileTitle: "記憶庫",
  },
  usage: {
    label: "用量",
    shortLabel: "用量",
    menuLabel: "用量與帳單",
    mobileTitle: "用量與帳單",
  },
  settings: {
    label: "設定",
    shortLabel: "設定",
    menuLabel: "偏好設定",
    mobileTitle: "偏好設定",
  },
} as const;