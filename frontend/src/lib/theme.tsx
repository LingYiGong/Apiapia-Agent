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

/**
 * shadcn/ui 标准主题方案：底层使用 next-themes（attribute="class"），
 * 对外保持本项目原有的 useTheme API（theme / resolvedTheme / setTheme）不变，
 * 存储键仍为 apiapia_theme，浅色/深色/跟随系统三档。
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
