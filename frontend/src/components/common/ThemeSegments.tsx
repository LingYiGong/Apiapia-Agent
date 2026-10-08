"use client";

import React from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type Theme } from "@/lib/theme";
import { SegmentedControl, type SegmentedOption } from "@/components/common/SegmentedControl";

/**
 * 外观三档（跟随系统 / 浅色 / 深色）。
 *
 * 此前这同一件事有三套实现：
 *   - components/common/ThemeToggle.tsx          DropdownMenu 列表项
 *   - components/layout/UserAvatarDropdown.tsx   内联 grid-cols-3 分段按钮
 *   - components/settings/SettingsView.tsx       Radix <Tabs> 三档
 * 三个文件各自维护选项数组与文案，改一次主题档位要动三处；而且桌面导航栏上
 * 同时存在一个 ThemeToggle 按钮和头像菜单里的第二套主题控件。
 *
 * 现在档位定义只有这一份（THEME_OPTIONS），分段形态只有 SegmentedControl 一种。
 * ThemeToggle 作为紧凑入口（下拉列表）保留，因为窄栏放不下三段。
 */

/** 三档选项的唯一来源。ThemeToggle 与 ThemeSegments 共用。 */
const THEME_OPTIONS: readonly SegmentedOption<Theme>[] = [
  { value: "system", label: "跟随系统", icon: Monitor },
  { value: "light", label: "浅色", icon: Sun, iconClassName: "text-amber-500" },
  { value: "dark", label: "深色", icon: Moon, iconClassName: "text-indigo-400" },
];

/** 下拉菜单里的长文案（ThemeToggle 用，与分段控件的短文案区分）。 */
export const THEME_LABELS_LONG: Record<Theme, string> = {
  system: "跟随系统",
  light: "浅色模式",
  dark: "深色模式",
};

export function ThemeSegments({ size = "md", className }: { size?: "sm" | "md"; className?: string }) {
  const { theme, setTheme } = useTheme();
  return (
    <SegmentedControl<Theme>
      ariaLabel="界面外观"
      value={theme}
      onValueChange={setTheme}
      options={THEME_OPTIONS}
      size={size}
      className={className}
      listClassName="grid grid-cols-3 w-full"
    />
  );
}
