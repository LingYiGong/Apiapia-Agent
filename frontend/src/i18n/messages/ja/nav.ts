/** ナビゲーション文言。config/navigation.ts の NAV_ITEMS と 1 対 1。 */
export default {
  newChat: "新しいチャット",
  chat: {
    label: "チャット",
    shortLabel: "チャット",
    menuLabel: "チャット",
    mobileTitle: "チャット",
  },
  history: {
    label: "履歴",
    shortLabel: "履歴",
    menuLabel: "履歴",
    mobileTitle: "会話履歴",
  },
  memory: {
    label: "記憶庫",
    shortLabel: "記憶",
    menuLabel: "長期記憶",
    mobileTitle: "記憶庫",
  },
  usage: {
    label: "使用量",
    shortLabel: "使用量",
    menuLabel: "使用量と請求",
    mobileTitle: "使用量と請求",
  },
  settings: {
    label: "設定",
    shortLabel: "設定",
    menuLabel: "環境設定",
    mobileTitle: "環境設定",
  },
} as const;