/** 登入 / 註冊頁文案。 */
export default {
  brandSuffix: "助理",
  loginTitle: "登入 Apiapia",
  loginSubtitle: "擁有長期記憶的智慧貓咪助理",
  registerTitle: "建立 Apiapia 帳號",
  registerSubtitle: "一隻擁有長期記憶的智慧貓咪助理，在持續陪伴中理解您的習慣與偏好",
  tabLogin: "登入",
  tabRegister: "註冊",

  field: {
    account: "帳號",
    username: "使用者名稱",
    email: "電子郵件",
    password: "密碼",
    setPassword: "設定密碼",
    confirmPassword: "確認密碼",
    accountPlaceholder: "使用者名稱或電子郵件",
    usernamePlaceholder: "設定使用者名稱 (例如 alex)",
    emailPlaceholder: "your-email@example.com",
    passwordPlaceholder: "請輸入密碼",
    setPasswordPlaceholder: "至少 6 個字元",
    confirmPasswordPlaceholder: "請再次輸入密碼",
    clearUsername: "清除使用者名稱",
    clearEmail: "清除電子郵件",
    showPassword: "顯示密碼",
    hidePassword: "隱藏密碼",
  },

  submit: "立即登入",
  submittingLogin: "正在登入…",
  submitRegister: "建立帳號",
  submittingRegister: "正在建立帳號…",

  validation: {
    usernameRequired: "請輸入使用者名稱",
    emailInvalid: "請輸入有效的電子郵件地址",
    passwordTooShort: "密碼長度至少需包含 6 個字元",
    passwordMismatch: "兩次輸入的密碼不一致，請重新輸入",
    accountRequired: "請輸入使用者名稱或電子郵件",
    passwordRequired: "請輸入密碼",
    submitFailed: "請求失敗，請檢查輸入或稍後重試",
  },

  privacyBadge: "資料安全隔離 · 個人對話與記憶僅歸您所有",
  footer: "Apiapia 助理 · v{version}",
} as const;