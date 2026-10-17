"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";
import { CURRENT_VERSION } from "@/lib/version";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { BrandLogo } from "@/components/common/BrandLogo";
import { LanguageButton } from "@/components/common/LanguageSwitcher";
import {
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useI18n } from "@/i18n";

export default function LoginPage() {
  const { t } = useI18n();
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const passwordInputRef = useRef<HTMLInputElement>(null);

  const { login } = useAuth();
  const router = useRouter();

  const handleAccountKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Tab" && !e.shiftKey) {
      if (!isRegister) {
        e.preventDefault();
        passwordInputRef.current?.focus();
      }
    }
  };

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
        setError(t("auth.validation.usernameRequired"));
        return;
      }
      if (!email.trim() || !email.includes("@")) {
        setError(t("auth.validation.emailInvalid"));
        return;
      }
      if (password.length < 6) {
        setError(t("auth.validation.passwordTooShort"));
        return;
      }
      if (password !== confirmPassword) {
        setError(t("auth.validation.passwordMismatch"));
        return;
      }
    } else {
      if (!username.trim() && !email.trim()) {
        setError(t("auth.validation.accountRequired"));
        return;
      }
      if (!password) {
        setError(t("auth.validation.passwordRequired"));
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
      setError(err.message || t("auth.validation.submitFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex-1 flex h-full min-h-full w-full flex-col justify-between overflow-x-hidden overflow-y-auto overscroll-contain bg-surface-1 px-4 pb-4 text-foreground selection:bg-primary/20 selection:text-primary sm:px-6 sm:pb-6">
      <header className="relative z-10 flex w-full max-w-5xl items-center justify-between mx-auto pt-[max(0.75rem,env(safe-area-inset-top,0px))] pb-2 sm:pt-4 sm:pb-3 shrink-0">
        <div className="flex items-center gap-2">
          <BrandLogo size={28} className="shadow-xs" />
          <span className="text-sm font-medium text-foreground/85">
            Apiapia
          </span>
        </div>

        <div className="flex items-center gap-2">
          <LanguageButton />
          <ThemeToggle variant="apple" />
        </div>
      </header>

      <main className="relative z-10 flex-1 w-full flex items-center justify-center py-4 sm:py-8 my-auto shrink-0">
        <div className="relative w-full max-w-[390px] sm:max-w-[420px] rounded-[26px] sm:rounded-[28px] border border-border/60 bg-card/80 p-5 shadow-[0_16px_40px_rgba(0,0,0,0.05)] backdrop-blur-2xl sm:p-7 dark:shadow-[0_24px_64px_rgba(0,0,0,0.65)] transition-all">
          <div className="flex flex-col items-center text-center mb-4 sm:mb-5">
            <BrandLogo size={64} className="mb-2.5 drop-shadow-md transition-transform hover:scale-105" />
            <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">
              {isRegister ? t("auth.registerTitle") : t("auth.loginTitle")}
            </h1>
            <p className="mt-0.5 text-xs sm:text-footnote text-muted-foreground font-normal">
              {isRegister ? t("auth.registerSubtitle") : t("auth.loginSubtitle")}
            </p>
          </div>

          <div className="mb-4 sm:mb-5 flex rounded-full bg-surface-3/60 p-1 relative">
            <button
              type="button"
              onClick={() => handleTabChange(false)}
              className={`flex-1 rounded-full py-1.5 text-footnote font-medium transition-all duration-200 ${
                !isRegister
                  ? "bg-card text-foreground shadow-[0_1px_4px_rgba(0,0,0,0.08)]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("auth.tabLogin")}
            </button>
            <button
              type="button"
              onClick={() => handleTabChange(true)}
              className={`flex-1 rounded-full py-1.5 text-footnote font-medium transition-all duration-200 ${
                isRegister
                  ? "bg-card text-foreground shadow-[0_1px_4px_rgba(0,0,0,0.08)]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("auth.tabRegister")}
            </button>
          </div>

          {error && (
            <Alert
              variant="destructive"
              className="mb-4 items-start gap-2.5 rounded-2xl border-destructive/20 bg-destructive/10 p-2.5 text-xs text-destructive animate-in fade-in slide-in-from-top-1 duration-200 [&>svg+div]:translate-y-0 [&>svg]:static [&>svg~*]:pl-0"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <AlertDescription className="leading-snug text-destructive [&_p]:leading-snug">
                {error}
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-3.5">
            <div className="space-y-1">
              <label
                htmlFor="account-input"
                className="ml-1 text-xs font-medium text-foreground/80"
              >
                {isRegister ? t("auth.field.username") : t("auth.field.account")}
              </label>
              <div className="group relative flex h-11 sm:h-12 items-center rounded-2xl border border-border/60 bg-surface-3/40 px-3 transition-all duration-200 focus-within:border-primary/80 focus-within:ring-4 focus-within:ring-primary/15 dark:bg-surface-3/30">
                <UserIcon className="h-4 w-4 shrink-0 text-muted-foreground/60 transition-colors group-focus-within:text-primary mr-2.5" />
                <input
                  id="account-input"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={handleAccountKeyDown}
                  placeholder={
                    isRegister
                      ? t("auth.field.usernamePlaceholder")
                      : t("auth.field.accountPlaceholder")
                  }
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  className="w-full bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground/40"
                />
                {username && (
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setUsername("")}
                    className="ml-1 rounded-full p-1 text-muted-foreground/50 hover:bg-surface-3 hover:text-muted-foreground"
                    title={t("auth.field.clearUsername")}
                    aria-label={t("auth.field.clearUsername")}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {isRegister && (
              <div className="space-y-1 animate-in fade-in slide-in-from-top-1 duration-200">
                <label
                  htmlFor="email-input"
                  className="ml-1 text-xs font-medium text-foreground/80"
                >
                  {t("auth.field.email")}
                </label>
                <div className="group relative flex h-11 sm:h-12 items-center rounded-2xl border border-border/60 bg-surface-3/40 px-3 transition-all duration-200 focus-within:border-primary/80 focus-within:ring-4 focus-within:ring-primary/15 dark:bg-surface-3/30">
                  <Mail className="h-4 w-4 shrink-0 text-muted-foreground/60 transition-colors group-focus-within:text-primary mr-2.5" />
                  <input
                    id="email-input"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t("auth.field.emailPlaceholder")}
                    autoComplete="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    className="w-full bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground/40"
                  />
                  {email && (
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setEmail("")}
                      className="ml-1 rounded-full p-1 text-muted-foreground/50 hover:bg-surface-3 hover:text-muted-foreground"
                      title={t("auth.field.clearEmail")}
                      aria-label={t("auth.field.clearEmail")}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label
                htmlFor="password-input"
                className="ml-1 text-xs font-medium text-foreground/80"
              >
                {isRegister ? t("auth.field.setPassword") : t("auth.field.password")}
              </label>
              <div className="group relative flex h-11 sm:h-12 items-center rounded-2xl border border-border/60 bg-surface-3/40 px-3 transition-all duration-200 focus-within:border-primary/80 focus-within:ring-4 focus-within:ring-primary/15 dark:bg-surface-3/30">
                <KeyRound className="h-4 w-4 shrink-0 text-muted-foreground/60 transition-colors group-focus-within:text-primary mr-2.5" />
                <input
                  id="password-input"
                  ref={passwordInputRef}
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={
                    isRegister
                      ? t("auth.field.setPasswordPlaceholder")
                      : t("auth.field.passwordPlaceholder")
                  }
                  autoComplete={isRegister ? "new-password" : "current-password"}
                  className="w-full bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground/40"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(!showPassword)}
                  className="ml-1 rounded-lg p-1.5 text-muted-foreground/50 hover:bg-surface-3 hover:text-muted-foreground"
                  title={showPassword ? t("auth.field.hidePassword") : t("auth.field.showPassword")}
                  aria-label={showPassword ? t("auth.field.hidePassword") : t("auth.field.showPassword")}
                  aria-pressed={showPassword}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {isRegister && (
              <div className="space-y-1 animate-in fade-in slide-in-from-top-1 duration-200">
                <label
                  htmlFor="confirm-password-input"
                  className="ml-1 text-xs font-medium text-foreground/80"
                >
                  {t("auth.field.confirmPassword")}
                </label>
                <div className="group relative flex h-11 sm:h-12 items-center rounded-2xl border border-border/60 bg-surface-3/40 px-3 transition-all duration-200 focus-within:border-primary/80 focus-within:ring-4 focus-within:ring-primary/15 dark:bg-surface-3/30">
                  <KeyRound className="h-4 w-4 shrink-0 text-muted-foreground/60 transition-colors group-focus-within:text-primary mr-2.5" />
                  <input
                    id="confirm-password-input"
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={t("auth.field.confirmPasswordPlaceholder")}
                    autoComplete="new-password"
                    className="w-full bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground/40"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="ml-1 rounded-lg p-1.5 text-muted-foreground/50 hover:bg-surface-3 hover:text-muted-foreground"
                    title={showConfirmPassword ? t("auth.field.hidePassword") : t("auth.field.showPassword")}
                    aria-label={showConfirmPassword ? t("auth.field.hidePassword") : t("auth.field.showPassword")}
                    aria-pressed={showConfirmPassword}
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

            <Button
              type="submit"
              disabled={submitting}
              className="mt-4 sm:mt-5 flex h-11 sm:h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-medium text-primary-foreground shadow-sm shadow-primary/25 transition-all duration-200 hover:opacity-95 active:scale-[0.985] disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>
                    {isRegister ? t("auth.submittingRegister") : t("auth.submittingLogin")}
                  </span>
                </>
              ) : (
                <>
                  <span>{isRegister ? t("auth.submitRegister") : t("auth.submit")}</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-5 border-t border-border/60 pt-3 text-center">
            <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-primary/70 shrink-0" />
              <span>{t("auth.privacyBadge")}</span>
            </div>
          </div>
        </div>
      </main>

      <footer className="relative z-10 w-full max-w-5xl py-1 sm:py-2 text-center mx-auto">
        <p className="text-xs text-muted-foreground/60">
          {t("auth.footer", { version: CURRENT_VERSION })}
        </p>
      </footer>
    </div>
  );
}

