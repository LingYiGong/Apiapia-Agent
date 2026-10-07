"use client";

import { useEffect } from "react";

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

  useEffect(() => {
    console.error("Root layout error:", error);
  }, [error]);

  return (
    <html lang="zh-CN">
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
            '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif',
          padding: "1.5rem",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: "24rem" }}>
          <h1 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "0.5rem" }}>
            应用无法启动
          </h1>
          <p style={{ fontSize: "0.875rem", lineHeight: 1.6, opacity: 0.7, marginBottom: "1.25rem" }}>
            初始化时发生错误。可以尝试重新加载；若持续失败，请清除本站数据后重试。
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
              cursor: "pointer",
            }}
          >
            重新加载
          </button>
        </div>
      </body>
    </html>
  );
}
