/** Sign-in / registration page. */
export default {
  brandSuffix: "Assistant",
  loginTitle: "Sign in to Apiapia",
  loginSubtitle: "Your personal AI space with long-term memory",
  registerTitle: "Create an Apiapia account",
  registerSubtitle: "A personal cat assistant that remembers you long term",
  tabLogin: "Sign in",
  tabRegister: "Sign up",

  field: {
    account: "Account",
    username: "Username",
    email: "Email",
    password: "Password",
    setPassword: "Choose a password",
    confirmPassword: "Confirm password",
    accountPlaceholder: "Username or email",
    usernamePlaceholder: "Pick a username (e.g. alex)",
    emailPlaceholder: "your-email@example.com",
    passwordPlaceholder: "Enter your password",
    setPasswordPlaceholder: "At least 6 characters",
    confirmPasswordPlaceholder: "Re-enter your password",
    clearUsername: "Clear username",
    clearEmail: "Clear email",
    showPassword: "Show password",
    hidePassword: "Hide password",
  },

  submit: "Sign in",
  submittingLogin: "Signing in…",
  submitRegister: "Create account",
  submittingRegister: "Creating account…",

  validation: {
    usernameRequired: "Enter a username",
    emailInvalid: "Enter a valid email address",
    passwordTooShort: "Your password must be at least 6 characters",
    passwordMismatch: "The two passwords do not match. Please try again.",
    accountRequired: "Enter your username or email",
    passwordRequired: "Enter your password",
    submitFailed: "Request failed. Check your details and try again.",
  },

  privacyBadge: "End-to-end encrypted · Your conversations and memories belong to you",
  footer: "Apiapia Assistant · v{version}",
} as const;