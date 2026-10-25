"use client";

import React from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type Theme } from "@/lib/theme";
import { useI18n } from "@/i18n";
import type { MessageKey } from "@/i18n";
import { SegmentedControl, type SegmentedOption } from "@/components/common/SegmentedControl";
import { cn } from "@/lib/utils";

/** 外观三档（系统 / 浅色 / 深色）分段控件 */

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