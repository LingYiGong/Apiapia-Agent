/** 登录 / 注册页文案。 */
export default {
  brandSuffix: "助理",
  loginTitle: "登录 Apiapia",
  loginSubtitle: "拥有长期记忆的智能猫咪助理",
  registerTitle: "创建 Apiapia 账户",
  registerSubtitle: "一只有长期记忆的智能猫咪助理，在持续陪伴中理解您的习惯与偏好",
  tabLogin: "登录",
  tabRegister: "注册",

  field: {
    account: "账户",
    username: "用户名",
    email: "电子邮箱",
    password: "密码",
    setPassword: "设置密码",
    confirmPassword: "确认密码",
    accountPlaceholder: "用户名或电子邮箱",
    usernamePlaceholder: "设置用户名 (例如 alex)",
    emailPlaceholder: "your-email@example.com",
    passwordPlaceholder: "请输入密码",
    setPasswordPlaceholder: "至少包含 6 位字符",
    confirmPasswordPlaceholder: "请再次输入密码",
    clearUsername: "清空用户名",
    clearEmail: "清空邮箱",
    showPassword: "显示密码",
    hidePassword: "隐藏密码",
  },

  submit: "立即登录",
  submittingLogin: "正在登录…",
  submitRegister: "创建账户",
  submittingRegister: "正在创建账户…",

  validation: {
    usernameRequired: "请输入用户名",
    emailInvalid: "请输入有效的电子邮箱地址",
    passwordTooShort: "密码长度至少需包含 6 个字符",
    passwordMismatch: "两次输入的密码不一致，请重新输入",
    accountRequired: "请输入用户名或电子邮箱",
    passwordRequired: "请输入密码",
    submitFailed: "请求失败，请检查输入或稍后重试",
  },

  privacyBadge: "数据安全隔离 · 个人对话与记忆仅归您所有",
  footer: "Apiapia 助理 · v{version}",
} as const;