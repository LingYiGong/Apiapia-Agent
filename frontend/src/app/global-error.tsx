"use client";

import { useEffect } from "react";
import { getTranslator, resolveStoredLocale } from "@/i18n";

function resolveDark(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const stored = localStorage.getItem("apiapia_theme");
    if (stored === "dark") return true;
    if (stored === "light") return false;
  } catch {}
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
            '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "SF Pro", system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", sans-serif',
          padding: "1.5rem",
        }}
      >
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
