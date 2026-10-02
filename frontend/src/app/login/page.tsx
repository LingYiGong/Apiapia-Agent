"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";
import { CURRENT_VERSION } from "@/lib/version";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import {
  Cat,
  KeyRound,
  Mail,
  User as UserIcon,
  ArrowRight,
  Eye,
  EyeOff,
  X,
  ShieldCheck,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { login } = useAuth();
  const router = useRouter();

  const handleTabChange = (registerMode: boolean) => {
    setIsRegister(registerMode);
    setError("");
    setConfirmPassword("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (isRegister) {
      if (!username.trim()) {
        setError("请输入用户名");
        return;
      }
      if (!email.trim() || !email.includes("@")) {
        setError("请输入有效的电子邮箱地址");
        return;
      }
      if (password.length < 6) {
        setError("密码长度至少需包含 6 个字符");
        return;
      }
      if (password !== confirmPassword) {
        setError("两次输入的密码不一致，请重新输入");
        return;
      }
    } else {
      if (!username.trim() && !email.trim()) {
        setError("请输入用户名或电子邮箱");
        return;
      }
      if (!password) {
        setError("请输入密码");
        return;
      }
    }

    setSubmitting(true);

    try {
      if (isRegister) {
        const res = await apiRequest("/auth/register", {
          method: "POST",
          body: JSON.stringify({
            username: username.trim(),
            email: email.trim(),
            password,
          }),
        });
        login(res.access_token, res.user);
      } else {
        const res = await apiRequest("/auth/login", {
          method: "POST",
          body: JSON.stringify({
            username_or_email: (username || email).trim(),
            password,
          }),
        });
        login(res.access_token, res.user);
      }
      router.push("/chat");
    } catch (err: any) {
      setError(err.message || "请求失败，请检查输入或稍后重试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 flex h-dvh w-full flex-col justify-between overflow-hidden overscroll-none select-none touch-none bg-[#fbfbfd] p-3 sm:p-6 text-foreground selection:bg-primary/20 selection:text-primary dark:bg-black">
      {/* Apple Subtle Ambient Lighting */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-36 left-1/2 -translate-x-1/2 w-[540px] sm:w-[680px] h-[360px] bg-gradient-to-b from-indigo-500/15 via-primary/10 to-transparent blur-[120px] rounded-full opacity-80"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 -right-24 w-[360px] h-[360px] bg-gradient-to-t from-violet-500/10 via-purple-500/5 to-transparent blur-[100px] rounded-full opacity-60"
      />

      {/* Top Floating Bar */}
      <header className="relative z-10 flex w-full max-w-5xl items-center justify-between mx-auto pt-1 pb-2 sm:pt-2 sm:pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Cat className="h-4 w-4" />
          </div>
          <span className="text-[14px] font-medium tracking-tight text-foreground/85">
            Apiapia
          </span>
        </div>

        {/* Single-layer Apple Frosted Glass Theme Toggle */}
        <ThemeToggle variant="apple" />
      </header>

      {/* Apple Frosted Glass Sign-in Card */}
      <main className="relative z-10 flex-1 w-full flex items-center justify-center overflow-y-auto overscroll-contain touch-pan-y no-scrollbar py-1 sm:py-3">
        <div className="relative w-full max-w-[390px] sm:max-w-[420px] rounded-[26px] sm:rounded-[28px] border border-black/[0.06] bg-white/80 p-5 sm:p-7 shadow-[0_16px_40px_rgba(0,0,0,0.05)] backdrop-blur-2xl dark:border-white/[0.09] dark:bg-[#1c1c1e]/85 dark:shadow-[0_24px_64px_rgba(0,0,0,0.65)] transition-all">
          {/* Brand Header */}
          <div className="flex flex-col items-center text-center mb-4 sm:mb-5">
            <div className="relative mb-2.5 flex h-13 w-13 sm:h-15 sm:w-15 items-center justify-center rounded-[18px] sm:rounded-[20px] bg-gradient-to-b from-indigo-500 to-indigo-600 shadow-md shadow-indigo-500/25 ring-1 ring-inset ring-white/30 dark:ring-white/20 p-3">
              <Cat className="h-full w-full text-white" />
            </div>
            <h1 className="text-[21px] sm:text-[24px] font-semibold tracking-[-0.025em] text-foreground">
              {isRegister ? "创建 Apiapia 账户" : "登录 Apiapia"}
            </h1>
            <p className="mt-0.5 text-[12.5px] sm:text-[13.5px] text-muted-foreground font-normal">
              {isRegister
                ? "开启拥有长期记忆的私人猫咪助理"
                : "探索拥有长期记忆的个人 AI 空间"}
            </p>
          </div>

          {/* Apple Segmented Control */}
          <div className="mb-4 sm:mb-5 flex rounded-full bg-black/[0.04] p-1 dark:bg-white/[0.08] relative">
            <button
              type="button"
              onClick={() => handleTabChange(false)}
              className={`flex-1 rounded-full py-1.5 text-[13px] font-medium transition-all duration-200 ${
                !isRegister
                  ? "bg-white text-foreground shadow-[0_1px_4px_rgba(0,0,0,0.08)] dark:bg-[#636366]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              登录
            </button>
            <button
              type="button"
              onClick={() => handleTabChange(true)}
              className={`flex-1 rounded-full py-1.5 text-[13px] font-medium transition-all duration-200 ${
                isRegister
                  ? "bg-white text-foreground shadow-[0_1px_4px_rgba(0,0,0,0.08)] dark:bg-[#636366]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              注册
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-destructive/20 bg-destructive/10 p-2.5 text-[12.5px] text-destructive animate-in fade-in slide-in-from-top-1 duration-200">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span className="leading-snug">{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-3.5">
            {/* Username / Account */}
            <div className="space-y-1">
              <label
                htmlFor="account-input"
                className="ml-1 text-[12px] font-medium text-foreground/80"
              >
                {isRegister ? "用户名" : "账户"}
              </label>
              <div className="group relative flex h-11 sm:h-12 items-center rounded-2xl border border-black/[0.06] bg-black/[0.03] px-3 transition-all duration-200 focus-within:border-primary/80 focus-within:ring-4 focus-within:ring-primary/15 dark:border-white/[0.08] dark:bg-white/[0.06]">
                <UserIcon className="h-4 w-4 shrink-0 text-muted-foreground/60 transition-colors group-focus-within:text-primary mr-2.5" />
                <input
                  id="account-input"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={
                    isRegister ? "设置用户名 (例如 alex)" : "用户名或电子邮箱"
                  }
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  className="w-full bg-transparent text-[14px] text-foreground outline-none placeholder:text-muted-foreground/40"
                />
                {username && (
                  <button
                    type="button"
                    onClick={() => setUsername("")}
                    className="ml-1 rounded-full p-1 text-muted-foreground/50 hover:bg-black/5 hover:text-muted-foreground dark:hover:bg-white/10"
                    title="清空"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Email (Register Only) */}
            {isRegister && (
              <div className="space-y-1 animate-in fade-in slide-in-from-top-1 duration-200">
                <label
                  htmlFor="email-input"
                  className="ml-1 text-[12px] font-medium text-foreground/80"
                >
                  电子邮箱
                </label>
                <div className="group relative flex h-11 sm:h-12 items-center rounded-2xl border border-black/[0.06] bg-black/[0.03] px-3 transition-all duration-200 focus-within:border-primary/80 focus-within:ring-4 focus-within:ring-primary/15 dark:border-white/[0.08] dark:bg-white/[0.06]">
                  <Mail className="h-4 w-4 shrink-0 text-muted-foreground/60 transition-colors group-focus-within:text-primary mr-2.5" />
                  <input
                    id="email-input"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your-email@example.com"
                    autoComplete="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    className="w-full bg-transparent text-[14px] text-foreground outline-none placeholder:text-muted-foreground/40"
                  />
                  {email && (
                    <button
                      type="button"
                      onClick={() => setEmail("")}
                      className="ml-1 rounded-full p-1 text-muted-foreground/50 hover:bg-black/5 hover:text-muted-foreground dark:hover:bg-white/10"
                      title="清空"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Password */}
            <div className="space-y-1">
              <label
                htmlFor="password-input"
                className="ml-1 text-[12px] font-medium text-foreground/80"
              >
                {isRegister ? "设置密码" : "密码"}
              </label>
              <div className="group relative flex h-11 sm:h-12 items-center rounded-2xl border border-black/[0.06] bg-black/[0.03] px-3 transition-all duration-200 focus-within:border-primary/80 focus-within:ring-4 focus-within:ring-primary/15 dark:border-white/[0.08] dark:bg-white/[0.06]">
                <KeyRound className="h-4 w-4 shrink-0 text-muted-foreground/60 transition-colors group-focus-within:text-primary mr-2.5" />
                <input
                  id="password-input"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isRegister ? "至少包含 6 位字符" : "请输入密码"}
                  autoComplete={isRegister ? "new-password" : "current-password"}
                  className="w-full bg-transparent text-[14px] text-foreground outline-none placeholder:text-muted-foreground/40"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="ml-1 rounded-lg p-1.5 text-muted-foreground/50 hover:bg-black/5 hover:text-muted-foreground dark:hover:bg-white/10"
                  title={showPassword ? "隐藏密码" : "显示密码"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Confirm Password (Register Only) */}
            {isRegister && (
              <div className="space-y-1 animate-in fade-in slide-in-from-top-1 duration-200">
                <label
                  htmlFor="confirm-password-input"
                  className="ml-1 text-[12px] font-medium text-foreground/80"
                >
                  确认密码
                </label>
                <div className="group relative flex h-11 sm:h-12 items-center rounded-2xl border border-black/[0.06] bg-black/[0.03] px-3 transition-all duration-200 focus-within:border-primary/80 focus-within:ring-4 focus-within:ring-primary/15 dark:border-white/[0.08] dark:bg-white/[0.06]">
                  <KeyRound className="h-4 w-4 shrink-0 text-muted-foreground/60 transition-colors group-focus-within:text-primary mr-2.5" />
                  <input
                    id="confirm-password-input"
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="请再次输入密码"
                    autoComplete="new-password"
                    className="w-full bg-transparent text-[14px] text-foreground outline-none placeholder:text-muted-foreground/40"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="ml-1 rounded-lg p-1.5 text-muted-foreground/50 hover:bg-black/5 hover:text-muted-foreground dark:hover:bg-white/10"
                    title={showConfirmPassword ? "隐藏密码" : "显示密码"}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={submitting}
              className="mt-4 sm:mt-5 flex h-11 sm:h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[14.5px] font-medium text-primary-foreground shadow-sm shadow-primary/25 transition-all duration-200 hover:opacity-95 active:scale-[0.985] disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{isRegister ? "正在创建账户..." : "正在登录..."}</span>
                </>
              ) : (
                <>
                  <span>{isRegister ? "创建账户" : "立即登录"}</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          {/* Privacy & Trust Badge */}
          <div className="mt-5 border-t border-black/[0.05] pt-3 text-center dark:border-white/[0.06]">
            <div className="flex items-center justify-center gap-1.5 text-[11.5px] text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-primary/70 shrink-0" />
              <span>端到端加密 · 个人对话与记忆仅归您所有</span>
            </div>
          </div>
        </div>
      </main>

      {/* Apple Minimalist Footer */}
      <footer className="relative z-10 w-full max-w-5xl py-1 sm:py-2 text-center mx-auto">
        <p className="text-[11px] sm:text-[12px] text-muted-foreground/60 tracking-tight">
          Apiapia 助理 · v{CURRENT_VERSION}
        </p>
      </footer>
    </div>
  );
}

