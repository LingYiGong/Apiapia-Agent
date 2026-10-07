"use client";

import React from "react";
import { useTheme, type Theme } from "@/lib/theme";
import { THEME_LABELS_LONG } from "@/components/common/ThemeSegments";
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
 * THEME_LABELS_LONG，档位定义不再各写一份。
 */
export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  className,
  variant = "outline",
}) => {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const currentLabel = THEME_LABELS_LONG[theme] ?? "跟随系统";
  const triggerLabel = `切换外观（当前：${currentLabel}）`;

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
        <span className="sr-only">切换外观主题</span>
      </button>
    ) : (
      <Button
        variant={variant === "ghost" ? "ghost" : "outline"}
        size="icon"
        className={cn(className)}
      >
        {icon}
        <span className="sr-only">切换主题</span>
      </Button>
    );

  return (
    <DropdownMenu>
      <ActionTooltip label={triggerLabel}>
        <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      </ActionTooltip>
      <DropdownMenuContent
        align="end"
        className="w-36 rounded-2xl border border-border/60 bg-background/90 p-1 shadow-xl backdrop-blur-2xl"
      >
        <DropdownMenuLabel className="px-2 py-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          界面外观
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="my-1 opacity-60" />
        {(Object.keys(THEME_ICON) as Theme[]).map((value) => {
          const Icon = THEME_ICON[value];
          const isSelected = theme === value;
          return (
            <DropdownMenuItem
              key={value}
              onClick={() => setTheme(value)}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-medium transition-colors",
                isSelected
                  ? "bg-primary/10 font-semibold text-primary"
                  : "text-foreground/80 hover:bg-surface-3/60"
              )}
            >
              <Icon
                className={cn(
                  "h-3.5 w-3.5",
                  value === "light" && "text-amber-500",
                  value === "dark" && "text-indigo-400"
                )}
              />
              <span>{THEME_LABELS_LONG[value]}</span>
              {isSelected && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
