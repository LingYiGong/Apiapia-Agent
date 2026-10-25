"use client";

import React from "react";
import {
  ThemeProvider as NextThemesProvider,
  useTheme as useNextTheme,
} from "next-themes";

export type Theme = "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
}

const ThemeMetaSync: React.FC = () => {
  const { resolvedTheme } = useNextTheme();

  React.useEffect(() => {
    if (!resolvedTheme) return;
    const color = resolvedTheme === "dark" ? "#000000" : "#ffffff";

    // 更新或创建无 media 查询的主 theme-color 标签（Android Chrome 据此动态绘制系统导航栏与状态栏）
    let primaryMeta = document.querySelector(
      'meta[name="theme-color"]:not([media])'
    ) as HTMLMetaElement | null;
    if (!primaryMeta) {
      primaryMeta = document.createElement("meta");
      primaryMeta.name = "theme-color";
      document.head.appendChild(primaryMeta);
    }
    primaryMeta.content = color;

    // 同步带 media 属性的 meta 标签，防止 Chrome 内核媒体查询匹配到旧色值
    document
      .querySelectorAll('meta[name="theme-color"][media]')
      .forEach((el) => {
        el.setAttribute("content", color);
      });
  }, [resolvedTheme]);

  return null;
};

/**
 * shadcn/ui 标准主题方案：底层使用 next-themes（attribute="class"），
 * 对外保持本项目原有的 useTheme API（theme / resolvedTheme / setTheme）不变，
 * 存储键仍为 apiapia_theme，浅色/深色/系统三档。
 */
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="apiapia_theme"
    >
      <ThemeMetaSync />
      {children}
    </NextThemesProvider>
  );
};

export const useTheme = (): ThemeContextType => {
  const { theme, resolvedTheme, setTheme } = useNextTheme();
  return {
    theme: (theme as Theme) ?? "system",
    resolvedTheme: resolvedTheme === "light" ? "light" : "dark",
    setTheme: (t: Theme) => setTheme(t),
  };
};
