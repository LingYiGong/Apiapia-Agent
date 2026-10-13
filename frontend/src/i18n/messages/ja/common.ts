/**
 * 共通文案：ボタン、ダイアログ、フィードバック、相対表示時刻、期間グループ、汎用エラー。
 *
 * `messages/zh-CN/common.ts` とキー単位で一致させること。メッセージの型は
 * runtime.ts で zh-CN から逆算しているため、キー漏れは `tsc --noEmit` で落ちる。
 *
 * 単数・複数の扱い：1 件、複数で語形が変わる語句は `_one` / `_other` の
 * 2 段を持つ。英語は実際に区別が要る（1 minute ago / 2 minutes ago）が、
 * 日本語は両方に同じ語句を置く。呼び出し側で分岐させる必要がない。
 */
export default {
  action: {
    confirm: "確認",
    cancel: "キャンセル",
    save: "保存",
    saving: "保存中…",
    saved: "保存しました",
    delete: "削除",
    deleting: "削除中…",
    edit: "編集",
    rename: "名前を変更",
    close: "閉じる",
    retry: "再試行",
    back: "戻る",
    copy: "コピー",
    copied: "コピーしました",
    download: "ダウンロード",
    upload: "アップロード",
    export: "エクスポート",
    exportAs: "{format} でエクスポート",
    importing: "インポート中…",
    refresh: "更新",
    create: "新規作成",
    add: "追加",
    remove: "削除",
    clear: "クリア",
    submit: "送信",
    search: "検索",
    reset: "リセット",
    select: "選択",
    selectAll: "すべて選択",
    deselectAll: "選択を解除",
    more: "その他",
    expand: "展開",
    collapse: "折りたたむ",
    viewAll: "すべて表示",
    loadMore: "さらに読み込む",
    send: "送信",
    stop: "停止",
    regenerate: "再生成",
    processing: "処理中…",
    loading: "読み込み中…",
    optional: "任意",
    required: "必須",
    yes: "はい",
    no: "いいえ",
    on: "オン",
    off: "オフ",
    default: "デフォルト",
    none: "なし",
    unknown: "不明",
    all: "すべて",
    copyFailed: "コピーできませんでした。テキストを選択して手動でコピーしてください。",
  },

  /**
   * 相対表示時刻。30 日を超える場合は「何月何日」に落とす。
   * 「23 日前」のような冗長な形を避けるため。
   */
  time: {
    justNow: "たった今",
    minutesAgo_one: "{n} 分前",
    minutesAgo_other: "{n} 分前",
    hoursAgo_one: "{n} 時間前",
    hoursAgo_other: "{n} 時間前",
    daysAgo_one: "{n} 日前",
    daysAgo_other: "{n} 日前",
    monthDay: "{month} 月 {day} 日",
    fullDateTime: "{date} {time}",
  },

  /**
   * リストの期間グループ。会話一覧と記憶庫が同じローリングウィンドウ
   * （lib/timeGroups.ts を参照）を使うため、文言もここにまとめている。
   */
  timeGroups: {
    last24h: "過去 24 時間",
    last3d: "過去 3 日",
    last7d: "過去 7 日",
    earlier: "それ以前",
    pinnedConversations: "ピン留め",
    pinnedMemories: "ピン留め",
  },

  /** 汎用のフォールバックエラー。業務固有の意味を持つものは各領域へ。 */
  error: {
    operationFailed: "操作に失敗しました",
    requestFailed: "リクエストに失敗しました（{status}）",
    networkError: "ネットワークに接続できませんでした。接続を確認して再試行してください。",
    unknownError: "不明なエラー",
    notFound: "この内容は存在しないか、削除されました",
    unhandledCode: "操作に失敗しました（{code}）",
  },

  backendError: {
    fallback: "サービスが一時的に利用できません。しばらくしてからもう一度お試しください。",
  },

  unit: {
    seconds: "{n} 秒",
    count: "{n} 件",
    token: "{n} トークン",
    times: "{n} 回",
    currencyUsd: "${value}",
  },

  /** スクリーンリーダー用のラベル。読み上げられるため、画面上の省略形は使わない。 */
  a11y: {
    openMenu: "メニューを開く",
    closeMenu: "メニューを閉じる",
    moreActions: "その他の操作",
    loading: "読み込み中",
    loadingMore: "さらに読み込んでいます",
    selected: "選択中",
    expandSection: "このセクションを展開",
    collapseSection: "このセクションを折りたたむ",
    mobileTabBar: "モバイルの下部タブバー",
  },

  /** アバターメニューとアカウントのバッジ */
  account: {
    menu: "{username} のアカウントメニュー",
    adminReady: "スーパー管理者権限が有効",
    standardUser: "一般ユーザーとしてログイン中",
    adminBadge: "管理者",
    standardBadge: "一般",
    logout: "ログアウト",
  },

/** 音声クライアントのローカル検証とネットワーク失敗時の文言（lib/speech.ts）。 */
  speech: {
    transcribeEmpty: "録音内容が空です",
    transcribeTooLarge: "音声ファイルは約 {size}MB で、上限 {max}MB を超えています",
    transcribeFailed: "文字起こしに失敗しました",
    speakEmptyText: "読み上げるテキストが空です",
    speakTextTooLong: "読み上げるテキストが {count} 文字で、1 回の上限 {max} 文字を超えています",
    speakFailed: "音声合成に失敗しました",
  },
  theme: {
    label: "外観",
    system: "システムに合わせる",
    light: "ライト",
    dark: "ダーク",
  },

  /** 言語設定そのもの。設定ページとログイン画面の双方で使う。 */
  language: {
    label: "表示言語",
    description: "インターフェース言語を選択します。AI の応答言語もこれに追従します。",
    current: "現在の言語",
  },

  /** 4 つの「リスト同期」ボタンで共有する結果フィードバック。 */
  modelSync: {
    emptyTitle: "{scope} の同期後、リストが空です",
    emptyDescription:
      "モデルが 1 つも取得できませんでした。バックエンドの .env にあるサービス資格情報が有効か確認してください。",
    foundNew: "{scope} を {count} 件新たに検出しました",
    updatedDescription: "{scope} のリストを更新しました。セレクターで確認できます。",
    upToDate: "{scope} のリストは最新のです。新規追加はありません。",
    scope: {
      language: "言語モデル",
      image: "画像生成モデル",
      video: "動画生成モデル",
      speech: "音声モデル",
    },
  },
} as const;