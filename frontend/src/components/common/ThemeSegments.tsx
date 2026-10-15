"use client";

import React from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type Theme } from "@/lib/theme";
import { useI18n } from "@/i18n";
import type { MessageKey } from "@/i18n";
import { SegmentedControl, type SegmentedOption } from "@/components/common/SegmentedControl";
import { cn } from "@/lib/utils";

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
 *
 * 选项数组在模块级只存**键**；文案在渲染时经 t() 查。
 * 此前这里直接写死中文，于是换语言时这三处（分段控件 + 下拉菜单 +
 * 头像菜单内联的那份）必然出现两种语言并存。
 */

/** 三档选项的唯一来源。ThemeToggle 与 ThemeSegments 共用。 */
const THEME_OPTIONS: readonly { value: Theme; labelKey: MessageKey; icon: typeof Monitor; iconClassName?: string }[] = [
  { value: "system", labelKey: "common.theme.system", icon: Monitor },
  { value: "light", labelKey: "common.theme.light", icon: Sun, iconClassName: "text-amber-500" },
  { value: "dark", labelKey: "common.theme.dark", icon: Moon, iconClassName: "text-indigo-400" },
];

/** 下拉菜单里的长文案（ThemeToggle 用，与分段控件的短文案区分）。 */
export const THEME_LABEL_KEYS_LONG: Record<Theme, MessageKey> = {
  system: "common.theme.system",
  light: "common.theme.light",
  dark: "common.theme.dark",
};

export function ThemeSegments({ size = "md", className }: { size?: "sm" | "md"; className?: string }) {
  const { theme, setTheme } = useTheme();
  const { t } = useI18n();
  return (
    <SegmentedControl<Theme>
      ariaLabel={t("common.theme.label")}
      value={theme}
      onValueChange={setTheme}
      options={THEME_OPTIONS.map(
        (o): SegmentedOption<Theme> => ({
          value: o.value,
          label: t(o.labelKey),
          icon: o.icon,
          iconClassName: o.iconClassName,
        })
      )}
      size={size}
      listClassName={cn("grid grid-cols-3 w-full", className)}
    />
  );
}