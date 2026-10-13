/** 環境設定画面、モデルセレクター、外観、保存バー。 */
export default {
  title: "環境設定",
  adminBadge: "管理者",

  appearance: {
    label: "外観",
    avatarMenuHeading: "外観",
  },

  themeToggle: {
    tooltip: "外観を変更（現在: {current}）",
    srApple: "外観テーマを変更",
    sr: "テーマを変更",
    heading: "外観",
  },

  modelGroup: {
    default: "既定モデル",
    trialBadge: "体験モード · 無料モデルのみ",
    counts: "言語 {chat} · 画像 {image} · 動画 {video} · 音声 {speech}",
    language: "言語モデル",
    image: "画像生成モデル",
    video: "動画生成モデル",
    speech: "音声モデル",
    sttSub: "音声認識",
    ttsSub: "音声合成",
    sttKind: "音声認識モデル",
    ttsKind: "音声合成モデル",
    sttPlaceholder: "音声認識モデルを選択",
    ttsPlaceholder: "音声合成モデルを選択",
    chatPlaceholder: "既定のチャットモデルを選択",
    imagePlaceholder: "画像生成モデルを選択",
    videoPlaceholder: "動画生成モデルを選択",
    capabilityVision: "画像入力に対応",
    capabilityImage: "画像生成",
    capabilityVideo: "動画生成",
    capabilityStt: "音声からテキスト",
    capabilityTts: "テキストから音声",
    voiceNote: "選択中の音声合成モデルは {count} 種類の音色を対応しています。既定では 1 つ目（{voice}）を使用します。",
    voiceNoteNoList: "このモデルは音色一覧を公開していないため、プロバイダの既定音色を使用します。",
  },

  memoryGroup: {
    label: "記憶システム",
    toggle: "自動抽出とコンテキスト検索",
    toggleAria: "長期記憶を切り替える",
    modelLabel: "抽出モデル (Memory LLM)",
    modelPlaceholder: "記憶の要約に使うモデルを選択",
    modelIdLabel: "記憶抽出モデルの ID",
    modelIdPlaceholder: "例: openai/gpt-4o-mini",
    manualModel: "✍️ 別のモデル ID を入力…",
  },

  about: {
    label: "このアプリについて",
    product: "Apiapia",
    versionLabel: "バージョン",
    versionValue: "v{version}",
    archLabel: "クライアント構成",
    archValue: "Next.js 14 · React 18",
    engineLabel: "記憶検索エンジン",
    engineValue: "PostgreSQL · pgvector",
    policyLabel: "更新ポリシー",
    policyValue: "自動的に確認します",
    checkUpdate: "更新を確認",
  },

  persona: {
    groupLabel: "システムプロンプト",
    groupDesc: "既定の人格と全体的な指針",
    resetDefault: "標準の既定に戻す",
    promptHint:
      "このプロンプトはモデルと対話する際の基本人格として使われます。空欄にすると標準の既定人格が使われます。",
    promptPhCustom: "役割、話し方、指針、准则を入力…",
    temperatureLabel: "サンプリング温度 (Temperature)",
    temperatureAria: "サンプリング温度",
    temperaturePrecise: "厳密",
    temperatureBalanced: "バランス",
    temperatureCreative: "創作的",
    temperatureValueText: "{value}、{label}",
    temperatureTicks: {
      min: "0.0 厳密",
      mid: "1.0 バランス",
      max: "2.0 創作的",
    },
  },

  saveBar: {
    saved: "保存しました",
    dirty: "未保存の変更があります",
    clean: "最新の状態です",
    reset: "元に戻す",
    tip: "環境設定を保存（⌘S / Ctrl+S）",
    save: "設定を保存",
    savingLong: "保存中…",
    savingShort: "保存中",
    mobileNotice: "環境設定に未保存の変更があります",
    resetDone: "前回保存した設定に戻しました",
    savedDone: "環境設定を保存しました",
    saveFailed: "設定を保存できませんでした",
  },

  sync: {
    tooltip: "利用可能な{scope}のリストを同期",
    label: "リストを同期",
    syncing: "同期中…",
    sr: "{scope}のリストを同期",
  },

  modelBadges: {
    freeModel: "無料モデル",
    paidModel: "API 課金",
    textOnly: "テキストモデル",
    idPrefix: "ID: {id}",
    missingId: "モデル ID: {id}",
    notSynced: "同期済みリストにありません",
  },

  picker: {
    placeholder: "モデルを選択",
    loading: "読み込み中…",
    selectAria: "{kind}を選択",
    selectAriaCurrent: "、現在 {name}",
    title: "{kind}を選択",
    current: "現在: {name}",
    searchAria: "{kind}を検索",
    searchPh: "{kind}を検索",
    clearSearch: "検索条件を消去",
    listAria: "{kind}の一覧",
    noMatch: "一致する{kind}がありません",
    searchAll: "{count} 件すべてのモデルから検索",
    featuredBadge: "おすすめ",
    multimodalBadge: "マルチモーダル",
    freeGroup: "無料",
    featuredGroup: "おすすめ",
    allGroup: "すべて",
    freeBadge: "無料",
    trialBadge: "体験モード",
    trialTitle: "体験モードのため、無料の{kind}のみ利用できます",
    genericKind: "モデル",
    languageKind: "言語モデル",
  },

  pickerEmpty: {
    notSynced: "{kind}のリストはまだ同期されていません。上の「リストを同期」ボタンで 1 度同期してください。",
    trialNoFree: "利用可能な無料の{kind}がありません。管理者に {env} への登録を依頼してください。",
    syncedButEmpty: "バックエンドは同期済みですがモデルが見つかりませんでした。.env の資格情報が有効か確認してください。",
  },

  errors: {
    syncLanguageFailed:
      "言語モデルの同期に失敗しました。バックエンドの .env に有効な API キーが設定されているか確認してください",
    syncImageFailed:
      "画像生成モデルの同期に失敗しました。バックエンドの .env に有効な画像生成サービスの資格情報が設定されているか確認してください",
    syncVideoFailed:
      "動画生成モデルの同期に失敗しました。バックエンドの .env に有効な OpenRouter キーが設定されているか確認してください",
    syncAudioFailed:
      "音声モデルの同期に失敗しました。バックエンドの .env に有効な OpenRouter キーが設定されているか確認してください",
  },
} as const;