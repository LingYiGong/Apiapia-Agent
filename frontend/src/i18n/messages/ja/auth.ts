/** サインイン / アカウント作成画面。 */
export default {
  brandSuffix: "アシスタント",
  loginTitle: "Apiapia にサインイン",
  loginSubtitle: "長期記憶を備えた個人用 AI スペース",
  registerTitle: "Apiapia のアカウントを作成",
  registerSubtitle: "長期記憶を持つ、完全自律な猫型アシスタント",
  tabLogin: "サインイン",
  tabRegister: "新規登録",

  field: {
    account: "アカウント",
    username: "ユーザー名",
    email: "メールアドレス",
    password: "パスワード",
    setPassword: "パスワードを設定",
    confirmPassword: "パスワードの確認",
    accountPlaceholder: "ユーザー名またはメール",
    usernamePlaceholder: "ユーザー名を入力（例: alex）",
    emailPlaceholder: "your-email@example.com",
    passwordPlaceholder: "パスワードを入力",
    setPasswordPlaceholder: "6 文字以上",
    confirmPasswordPlaceholder: "パスワードをもう一度入力",
    clearUsername: "ユーザー名を消去",
    clearEmail: "メールアドレスを消去",
    showPassword: "パスワードを表示",
    hidePassword: "パスワードを非表示",
  },

  submit: "サインイン",
  submittingLogin: "サインイン中…",
  submitRegister: "アカウントを作成",
  submittingRegister: "アカウント作成中…",

  validation: {
    usernameRequired: "ユーザー名を入力してください",
    emailInvalid: "有効なメールアドレスを入力してください",
    passwordTooShort: "パスワードは 6 文字以上で入力してください",
    passwordMismatch: "パスワードが一致しません。もう一度入力してください。",
    accountRequired: "ユーザー名またはメールアドレスを入力してください",
    passwordRequired: "パスワードを入力してください",
    submitFailed: "リクエストに失敗しました。入力内容を確認してもう一度お試しください。",
  },

  privacyBadge: "エンドツーエンド暗号化 · 会話と記憶はあなただけのものです",
  footer: "Apiapia アシスタント · v{version}",
} as const;