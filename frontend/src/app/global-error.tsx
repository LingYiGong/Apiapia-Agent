"use client";

import { useEffect } from "react";
import { getTranslator, resolveStoredLocale } from "@/i18n";

/**
 * 根布局级错误边界。
 *
 * 与 `error.tsx` 的区别：这里捕获的是**根 layout 本身**的异常，包括
 * AuthProvider / ThemeProvider / CapacitorInit / Toaster 这些挂在 layout 上
 * 的全局 provider。它们抛错时 `error.tsx` 也救不了，必须由本文件兜底，
 * 否则只剩一个纯白的 <body>。
 *
 * 注意：本文件必须自带 <html> / <body>，且不能依赖任何会再次抛错的组件
 * —— 所以这里只用内联样式，不引入 Button 等 UI 组件。
 *
 * 配色：此前硬编码白底黑字，深色模式用户在根布局崩溃时会先闪一屏白。
 * 现在启动时同步读一次 localStorage 里的主题与系统偏好（本文件跑在
 * ThemeProvider 之外，拿不到 useTheme，只能自己解析）。
 */
function resolveDark(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const stored = localStorage.getItem("apiapia_theme");
    if (stored === "dark") return true;
    if (stored === "light") return false;
  } catch {
    /* 读不到就按系统偏好 */
  }
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const dark = resolveDark();
  // 刻意用 getTranslator(resolveStoredLocale()) 而不是 useI18n()：
  // 本文件替代的就是 root layout，而 I18nProvider 正挂在 root layout 内部 ——
  // 走到这里时它压根没挂上，useI18n() 会直接抛错，把一次崩溃变成两次。
  const t = getTranslator(resolveStoredLocale());

  useEffect(() => {
    console.error("Root layout error:", error);
  }, [error]);

  return (
    <html lang={resolveStoredLocale()}>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: dark ? "#000000" : "#ffffff",
          color: dark ? "#ffffff" : "#000000",
fontFamily:
            /* 与 globals.css 的 --font-sans 同栈同序：拉丁字体在前、CJK 在后。
               此前此处漏了 system-ui / Segoe UI，Windows 上 `-apple-system`
               与 `BlinkMacSystemFont` 双双失效后，拉丁文字会直接落到
               Microsoft YaHei。本文件刻意不引 globals.css（根布局崩溃时任何
               可能再抛错的依赖都不能引入），只能内联抄一份 —— 因此修改
               globals.css 的 --font-sans 时必须同步这里。 */
            '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "SF Pro", system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", sans-serif',
          padding: "1.5rem",
        }}
      >
        {/* 18px / 14px 对应 tailwind.config.ts 的 text-lg 与 text-sm；
            letterSpacing 同步取 Apple SF Pro tracking 表对应值换算成的 em
            （18pt -0.44px → -0.0244em，14pt -0.15px → -0.0107em）。 */}
        <div style={{ textAlign: "center", maxWidth: "24rem" }}>
          <h1
            style={{
              fontSize: "1.125rem",
              letterSpacing: "-0.0244em",
              fontWeight: 600,
              marginBottom: "0.5rem",
            }}
          >
            {t("meta.globalError.title")}
          </h1>
          <p
            style={{
              fontSize: "0.875rem",
              letterSpacing: "-0.0107em",
              lineHeight: 1.6,
              opacity: 0.7,
              marginBottom: "1.25rem",
            }}
          >
            {t("meta.globalError.description")}
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.5rem",
              border: `1px solid ${dark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)"}`,
              background: "transparent",
              color: "inherit",
              font: "inherit",
              fontSize: "0.875rem",
              letterSpacing: "-0.0107em",
              cursor: "pointer",
            }}
          >
            {t("meta.globalError.reload")}
          </button>
        </div>
      </body>
    </html>
  );
}
