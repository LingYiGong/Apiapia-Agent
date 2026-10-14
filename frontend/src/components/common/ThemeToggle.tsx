"use client";

import React from "react";
import { useTheme, type Theme } from "@/lib/theme";
import { THEME_LABEL_KEYS_LONG } from "@/components/common/ThemeSegments";
import { useI18n } from "@/i18n";
import { type LucideIcon, Sun, Moon, Monitor, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionTooltip } from "@/components/common/ActionTooltip";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  actionMenuContentClass,
  actionMenuItemClass,
  actionMenuSeparatorClass,
} from "@/components/common/actionMenu";

const THEME_ICON: Record<Theme, LucideIcon> = {
  system: Monitor,
  light: Sun,
  dark: Moon,
};

export interface ThemeToggleProps {
  className?: string;
  variant?: "outline" | "ghost" | "apple";
}

/**
 * 紧凑的主题切换入口（下拉列表形态）。
 *
 * 与 <ThemeSegments> 的分工：分段控件放不下窄栏（顶栏、登录页），用这个；
 * 有整行空间的地方（头像菜单、设置页）用分段控件。文案统一取自
 * THEME_LABEL_KEYS_LONG（存的是词典键，不是字符串），档位定义不再各写一份。
 */
export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  className,
  variant = "outline",
}) => {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const { t } = useI18n();
  const currentLabel = t(THEME_LABEL_KEYS_LONG[theme] ?? "common.theme.system");
  const triggerLabel = t("settings.themeToggle.tooltip", { current: currentLabel });

  const icon =
    theme === "system" ? (
      <Monitor className="h-4 w-4" />
    ) : resolvedTheme === "light" ? (
      <Sun className="h-4 w-4 text-amber-500" />
    ) : (
      <Moon className="h-4 w-4 text-indigo-400" />
    );

  // The tooltip wraps the trigger rather than sitting inside it: Radix's
  // `asChild` chain has to reach a real DOM element, and DropdownMenuTrigger
  // already forwards ref/props down to its own child.
  const trigger =
    variant === "apple" ? (
      <button
        type="button"
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-full border border-black/[0.08] bg-white text-foreground/80 shadow-2xs transition-all hover:bg-black/[0.04] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95 dark:border-white/[0.12] dark:bg-surface-2 dark:text-foreground/90 dark:hover:bg-white/[0.16]",
          className
        )}
      >
        {icon}
        <span className="sr-only">{t("settings.themeToggle.srApple")}</span>
      </button>
    ) : (
      <Button
        variant={variant === "ghost" ? "ghost" : "outline"}
        size="icon"
        className={cn(className)}
      >
        {icon}
        <span className="sr-only">{t("settings.themeToggle.sr")}</span>
      </Button>
    );

  return (
    <DropdownMenu>
      <ActionTooltip label={triggerLabel}>
        <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      </ActionTooltip>
      {/* w-36 固定宽在日文下必折行：「システムに合わせる」9 个全角字约 108px，
          容器扣掉内边距和图标后标签只剩 92px。四个问题的根因见
          components/common/actionMenu.ts。 */}
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        collisionPadding={12}
        className={actionMenuContentClass}
      >
        <DropdownMenuLabel className="px-2 py-1 text-2xs font-medium uppercase tracking-wider text-muted-foreground">
          {t("settings.themeToggle.heading")}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className={actionMenuSeparatorClass} />
        {(Object.keys(THEME_ICON) as Theme[]).map((value) => {
          const Icon = THEME_ICON[value];
          const isSelected = theme === value;
          return (
            <DropdownMenuItem
              key={value}
              onClick={() => setTheme(value)}
              className={cn(
                actionMenuItemClass,
                // 选中行必须同时覆盖 hover / data-[highlighted]，否则高亮的灰底
                // 会盖掉下面的 bg-primary/10，主题一变就看不出选中的是哪一项。
                isSelected
                  ? "bg-primary/10 font-semibold text-primary hover:bg-primary/15 data-[highlighted]:bg-primary/15"
                  : "text-foreground/80"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4",
                  value === "light" && "text-amber-500",
                  value === "dark" && "text-indigo-400"
                )}
              />
              <span>{t(THEME_LABEL_KEYS_LONG[value])}</span>
              {isSelected && <Check className="ml-auto h-4 w-4 shrink-0 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
