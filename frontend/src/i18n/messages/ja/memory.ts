/** 長期記憶ライブラリ画面。 */
export default {
  title: "記憶庫",

  search: {
    label: "記憶を検索",
    placeholder: "記憶を検索…",
    clear: "検索条件を消去",
    submit: "検索",
    submitSr: "記憶を検索",
  },

  section: {
    searchResults: "検索結果",
    all: "すべての記憶",
    count: "（{count}）",
  },

  counter: {
    foundPlus: "（{count}+ 件）",
    loadedOfTotal: "（{count} / {total} 件を読み込み済み）",
    total: "（全 {total} 件）",
  },

  export: {
    tip: "すべての記憶 {count} 件を JSON でエクスポート",
    sr: "JSON をエクスポート",
    inProgress: "記憶データをエクスポート中…",
    partial: "{exported} 件をエクスポートしました（サーバー上の合計は {total} 件のため、完全ではない可能性があります）",
    all: "すべての記憶 {exported} 件をエクスポートしました",
    failed: "記憶データをエクスポートできませんでした",
  },

  showAll: "すべて表示",

  empty: {
    searchTitle: "一致する記憶がありません",
    searchDesc: "別のキーワードを試すか、検索条件を消去してください。",
    browseTitle: "まだ記憶がありません",
    browseDesc:
      "チャットの中で自分の背景、習慣、重要な事実に触れると、モデルが自動的に抽出してここへ記録します。",
    resetSearch: "検索条件をリセット",
    newChat: "会話を始める",
  },

  loadMore: {
    busy: "読み込み中…",
    searching: "結果をさらに読み込む",
    browsing: "さらに読み込む",
  },

  endOfList: "すべての {total} 件の記憶を表示しています",

  card: {
    edited: "編集済み",
    editTip: "記憶を編集",
    deleteTip: "記憶を削除",
  },

  edit: {
    title: "長期記憶を編集",
    desc: "この記憶の内容を変更します。以後、アシスタントは変更後の事実を参照します。",
    label: "記憶の内容",
    placeholder: "記憶の内容を編集…",
    /** ⌘ は macOS でのみ正しい。Windows 利用者には Ctrl を見せる必要がある。 */
    shortcutMac: "⌘ + Enter で保存",
    shortcutOther: "Ctrl + Enter で保存",
    charCount: "{count} 文字",
    cancel: "キャンセル",
    saving: "保存中…",
    done: "完了",
    saved: "記憶を更新しました",
    failed: "記憶を更新できませんでした",
  },

  remove: {
    title: "この記憶を削除",
    desc: "この記録を記憶庫から完全に削除しますか？アシスタントは以後この事実を参照しなくなります。取り消せません。",
    confirm: "削除",
    done: "記憶を削除しました",
    failed: "記憶を削除できませんでした",
  },

  errors: {
    searchFallback: "記憶の検索に失敗したため、すべての記憶を表示しています",
    loadFailed: "記憶を読み込めませんでした。再試行してください。",
  },
} as const;