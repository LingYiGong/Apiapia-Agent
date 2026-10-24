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
    consolidationModelLabel: "整理統合モデル (Consolidation LLM)",
    consolidationModelPlaceholder: "記憶整理モデルを選択",
    consolidationGuideTitle: "推奨整理モデルと選定理由（カードをクリックして選択）：",
    consolidationCurrentSelected: "選択中",
    manualModel: "✍️ 別のモデル ID を入力…",
    consolidationPresets: {
      tagFreeRecommended: "無料おすすめ",
      tagFreeUltra: "無料上位",
      tagBestValue: "高コスパ",
      tagLongContext: "100万長文",
      tagFastStable: "高速・安定",
      tagHighestAccuracy: "最高精度",
      descGemma4: "Google 31B 密結合モデル。応答が速く、JSON 形式への準拠と事実抽出が厳密",
      descNemotronUltra: "550B パラメータ MoE 構造。複数の履歴を横断したプロファイル抽出と時系列整理に最適",
      descDeepseekFlash: "意味理解と JSON 準拠に優れ、極めて低コストかつ安定して記憶整理を実行可能",
      descGeminiFlash: "100万トークンの長文に対応し、大量の記憶の全体把握と横断的な統合に最適",
      descGptSol61: "OpenAI の主力モデル。推論と指示遵従に優れ、データ整理スキーマに厳格に準拠",
      descSonnet55: "複雑な論理推論フラッグシップ。時系列の変化や暗黙の好みの識別に優れ、高品質な記憶再構築に最適",
    },
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
    defaultPromptValue: "あなたは知的で誠実、洞察力に優れたパーソナル AI アシスタントです。ユーザーの背景情報と長期記憶に基づいて高品質なサポートを提供してください。",
    promptHint:
      "このプロンプトはアシスタントの基盤システム指示として機能します。空欄の場合は標準の既定システム指示が適用されます。",
    promptPhCustom: "役割、話し方、指針、ルールを入力…",
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

  /** カスタム指示 (Custom Instructions) */
  customInstructions: {
    groupLabel: "カスタム指示 (Custom Instructions)",
    aboutUserLabel: "アシスタントに知っておいてほしい背景情報は？（あなたについて）",
    aboutUserDesc: "職業、技術スタック、拠点、関心事などを共有すると、すべての会話でこのコンテキストが参照されます。",
    aboutUserPlaceholder: "例：フルスタックエンジニアで主に Python / TypeScript を使用。簡潔で保守性の高いコードを好みます。",
    responseStyleLabel: "アシスタントにどのような回答を期待しますか？（スタイルと好み）",
    responseStyleDesc: "トーン、詳細度、コード規約、書式の希望などを指定できます。",
    responseStylePlaceholder: "例：前置きは省いて結論から回答してください。コードには TypeScript 型アノテーションを含めてください。",
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
    selectAria: "{kind}を選択{current}",
    selectAriaCurrent: "、現在 {name}",
    title: "{kind}を選択",
    /** モバイル下部のシート用のアクセシビリティ説明（視覚的には非表示） */
    sheetDesc: "等級で{kind}を選ぶか、名前やメーカーで検索できます。",
    current: "現在: {name}",
    searchAria: "{kind}を検索",
    searchPh: "{kind}を検索",
    clearSearch: "検索条件を消去",
    listAria: "{kind}の一覧",
    /** 等級カードのグリッド（role="group"）のアクセシブルな名前 */
    tierGroupAria: "{kind}のティア絞り込み",
    noMatch: "一致する{kind}がありません",
    searchAll: "「カスタム」ですべてのモデルを検索",
    multimodalBadge: "マルチモーダル",
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

  /** モデル選定ガイド：価格帯と推薦理由 */
  modelGuide: {
    /** 「無料」ティア：ピン留めされた 3 つの無料モデル */
    groupFree: "無料",

    /** 「標準」ティア：日常向けの厳選コストパフォーマンスモデル */
    groupNormal: "標準",

    /** 「高性能」ティア：厳選されたフラッグシップモデル */
    groupSmart: "高性能",

    /** 「カスタム」ティア：ティア絞り込みなしで全モデルを閲覧 */
    groupCustom: "カスタム",

    /** 4 枚のティアカードに表示する一行説明 */
    tierDesc: {
      free: "無料の3モデル。コストゼロで試せる",
      normal: "日常向けの厳選モデル。能力と価格のバランス重視",
      smart: "厳選フラッグシップ。複雑なタスクに強く、価格は高め",
      custom: "すべてのモデルを検索・絞り込み",
    },

    /** 価格帯：公開されているリスト価格で大まかに分類 */
    price: {
      free: "無料",
      budget: "低価格",
      standard: "標準",
      premium: "最上位",
      /** 正確な価格バッジの説明：USD / 100万トークン */
      perMillion: "入力 / 出力、100万トークンあたり（USD）",
    },

    /** 推薦候補。キーは lib/modelGuide.ts の定数に対応。 */
    reason: {
      nemotronUltra: "【フラッグシップ推論】総パラメータ550B／アクティブ55BのMoE。長期的なエージェント作業と複雑な論理推論に強く、超長コンテキストに対応します（テキスト専用）。",
      gemma4: "【オープン多モーダル】Google DeepMind の 31B 密結合マルチモーダルモデル。テキスト・画像解析に優れ、安定した推論を提供。",
      freeRouter: "【無料体験ルーティング】公開された無料モデルプールに動的接続し、コストゼロで試用できます。",
      sonnet: "【総合全能 SOTA】総合推論・執筆・プログラミング能力が極めて高く、複雑な専門業務に最適です。",
      gptSol61: "【総合フラッグシップ】最高水準の総合推論能力と高速応答を両立し、複雑な対話や汎用タスクで卓越した性能を発揮します。",
      gemini38: "【高速長文・視覚認識】100万トークンのコンテキストに対応し、図表解析力とコストパフォーマンスに優れます。",
      deepseekFlash: "【高スループット・高指示遵従】超低遅延で構造化 JSON 出力に厳格に準拠し、極めて高い費用対効果を誇ります。",
      qwenMax: "【文章表現・コンテキスト理解】語彙表現が豊かで、長文執筆や複雑なコンテキストの理解に優れています。",
      opus55: "【深層推論フラッグシップ】高度な数学的証明、学術的分析、システム設計に特化した最高峰モデルです。",
      gptAstra: "【複雑タスク解決】最先端の汎用推論とエンドツーエンドのタスク計画・実行能力を備えています。",
      geminiArgon: "【Google 深層推論フラッグシップ】複雑なソフトウェア工学、高度な数理・科学分析向けに設計されたネイティブマルチモーダル対応の最上位モデル。",
      kimiK3: "【超長文コンテキスト分析】超大容量コンテキストに対応し、大規模コードベースや長大な技術文書の分析に優れます。",
    },
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