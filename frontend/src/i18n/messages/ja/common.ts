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
    close: "閉じる",
    retry: "再試行",
    processing: "処理中…",
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
  },

  /** スクリーンリーダー用のラベル。読み上げられるため、画面上の省略形は使わない。 */
  a11y: {
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
    system: "システム",
    light: "ライト",
    dark: "ダーク",
  },

  /** 言語設定そのもの。設定ページとログイン画面の双方で使う。 */
  language: {
    label: "表示言語",
    description: "インターフェース言語を選択します。AI の応答言語もこれに追従します。",
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