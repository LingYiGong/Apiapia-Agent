/**
 * アプリシェルの文言：ドキュメントタイトル、404、エラーバウンダリー、更新通知。
 *
 * `metadata.title` 自体は app/layout.tsx のまま中国語のまま。Next.js の
 * metadata はサーバー側のビルド時にしか出力できず、ハイドレーション後に
 * クライアントが選んだ言語を追従できないため。
 */
export default {
  appName: "Apiapia アシスタント",
  entering: "{app} を起動しています…",
  appDescription: "Apiapia アシスタント — 長期記憶を持つ猫型アシスタント",

  notFound: {
    title: "ページが見つかりません",
    description: "このアドレスは削除されたか、リンクが間違っている可能性があります。",
  },

  routeError: {
    title: "問題が発生しました",
    description:
      "このページでエラーが発生しました。再試行できます。繰り返し発生する場合はチャットに戻ってください。",
    digest: "エラー ID: {digest}",
  },

  globalError: {
    title: "アプリを起動できませんでした",
    description:
      "初期化中にエラーが発生しました。再読み込みしてください。解決しない場合はこのサイトのデータを消去してからお試しください。",
    reload: "再読み込み",
  },

  update: {
    availableTitle: "バージョン {version} が利用可能です",
    availableDescription: "更新すると最新機能をすぐに使えます。",
    currentTitle: "最新バージョンです",
    currentDescription: "バージョン {version} が最新版です。",
    changelog: "更新内容",
    changelogHint: "更新内容は設定で確認できます。タップして詳細をご覧ください",
    dismiss: "閉じる",
    later: "あとで",
    updateNow: "今すぐ更新",
    checking: "更新を確認中…",
    noChangelog: "このリリースに更新内容は記載されていません。",
    cacheWarning: "更新するとブラウザの古いキャッシュが消え、UI が再読み込みされます。会話の途中で更新しないことを推奨します。",
  },
} as const;