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
    /** モバイル下部のシート用のアクセシビリティ説明（視覚的には非表示） */
    sheetDesc: "用途で{kind}を選ぶか、名前やメーカーで検索できます。",
    current: "現在: {name}",
    searchAria: "{kind}を検索",
    searchPh: "{kind}を検索",
    clearSearch: "検索条件を消去",
    listAria: "{kind}の一覧",
    /** 絞り込みチップの列（role="group"）のアクセシブルな名前 */
    filterGroupAria: "{kind}のカテゴリ絞り込み",
    noMatch: "一致する{kind}がありません",
    multimodalBadge: "マルチモーダル",
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

  /** モデル選定ガイド：用途タグ、価格帯、推薦理由、注意点 */
  modelGuide: {
    /** ModelPicker の絞り込み行にある「おすすめ」タブ */
    groupRecommend: "おすすめ",

    /** ModelPicker の「無料」チップ：カタログ内のすべての無料モデル */
    groupFree: "無料",

    /** ModelPicker の分類リストの区分見出し */
    sectionUseCase: "利用シーン別",

    /** 用途タグ。ModelPicker の分類名としても使う */
    useCase: {
      writing: "執筆・翻訳",
      reasoning: "深い推論・思考",
      coding: "プログラミング",
      visionDocs: "画像・文書読解",
      fastFree: "高速・無料",
    },

    /** 価格帯：公開されているリスト価格で大まかに分類 */
    price: {
      free: "無料",
      budget: "低価格",
      standard: "標準",
      premium: "最上位",
    },

    /** 18 件の候補。キーは lib/modelGuide.ts の定数に対応。 */
    reason: {
      sonnet: "【万能の筆頭】日常会話、長文執筆、コード修正まで最高峰の知能でこなします。",
      gptSol61: "【最高峰クラス】最高水準の知能と圧倒的な応答速度を両立。重いタスクにも最適です。",
      gemini38: "【高速・画像と長文】複雑な画像や表の読解、100万字の長文分析を超高速・高コスパで実現。",
      glm53: "【確かな総合力】優れた文章表現力と安定したコード生成能力を備えた実力派です。",
      gptLuna: "【日常の定番】軽快で非常に安価。普段使いのデフォルトモデルとして重宝します。",
      glm53Flash: "【高速マルチモーダル】圧倒的な低価格で画像入力とコード確認に対応。長時間の作業も安心。",
      opus55: "【知能の到達点】最高難度の論理・学術的推論や大規模な設計変更に特化した最高峰モデル。",
      freeRouter: "【完全無料】利用可能な無料モデルに自動接続。コストゼロで気軽に試せます。",
      deepseekPro: "【コードと論理の達人】アルゴリズム実装や複雑なバグ調査、数理推論で頼れる開発主力。",
      grok47: "【高速な理系スペシャリスト】高度な数理・科学推論とプログラミングを迅速に処理。",
      qwenMax: "【執筆・長文の精鋭】豊かな語彙力と文章構成力。精密な長文作成や文書推敲に最適。",
      gptAstra: "【最難関タスク専用】OpenAI最高峰。複雑なエンドツーエンドの難問を解き明かします。",
      kimiK3: "【超長文のスペシャリスト】専門書一冊や巨大リポジトリの徹底分析と長期計画に。",
      deepseekFlash: "【大人気主力モデル】超長文を的確に把握し、指示通り忠実に出力。しかも圧倒的に低コスト。",
      qwen38Flash: "【手軽な画像対応】画像や図表の認識、日常の素早い質問応答を快適にこなします。",
      minimaxM3: "【お得なマルチモーダル】画像・動画の両方に対応し、100万字コンテキストを安価に提供。",
      mimoFlash: "【軽量マルチモーダル】超低価格ながら、日々の画像認識やテキスト処理を堅実にこなします。",
      haiku55: "【俊敏で軽快】ミリ秒級の高速レスポンス。要約や分類、簡単な手直しなどの軽作業に最適。",
    },

    /** 実際に注意書きが必要なものだけ記載。caveatKey のないモデルには表示しない。 */
    caveat: {
      longPrompt: "注意：数十万字を超える極端に長い入力時は料金段階が上がります（通常時は影響ありません）。",
      priceRise: "注意：2027年に公式の価格改定が予定されています。長期運用時はご注意ください。",
      thinking: "注意：深い思考ステップを実行するため、回答の精度は上がりますが所要時間と費用が増加します。",
      freeUnstable: "注意：共有の無料プールを利用するため、品質や速度に波が生じる場合があります。",
      shortContext: "注意：コンテキスト上限は50万字です。100万字モデルと比べ巨大文書の扱いに注意が必要です。",
      primeVariant: "注意：-prime などの高速版は価格が高くなります。コスパ重視なら通常版をご利用ください。",
      kimiPrice: "注意：長文出力の単価が高めです。極端に長い回答を生成する際は利用量にご注意ください。",
      peakPricing: "注意：ピーク時間帯（UTC 01:00〜04:00、06:00〜10:00）は料金が変動する場合があります。",
      haikuLongPrompt: "注意：1回のプロンプトが10万字を超えると上位の価格帯に切り替わります。",
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