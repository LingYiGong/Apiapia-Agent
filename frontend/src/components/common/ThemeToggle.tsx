"use client";

import React from "react";
import { useTheme, type Theme } from "@/lib/theme";
import { Sun, Moon, Monitor, Check } from "lucide-react";
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

const options: { value: Theme; label: string; icon: React.FC<{ className?: string }> }[] = [
  { value: "system", label: "跟随系统", icon: Monitor },
  { value: "light", label: "浅色模式", icon: Sun },
  { value: "dark", label: "深色模式", icon: Moon },
];

export interface ThemeToggleProps {
  className?: string;
  variant?: "outline" | "ghost" | "apple";
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  className,
  variant = "outline",
}) => {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const currentLabel =
    theme === "system" ? "跟随系统" : theme === "light" ? "浅色模式" : "深色模式";
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
          "flex h-9 w-9 items-center justify-center rounded-full border border-black/[0.08] bg-white text-foreground/80 shadow-2xs transition-all hover:bg-black/[0.04] hover:text-foreground active:scale-95 dark:border-white/[0.12] dark:bg-[#1c1c1e] dark:text-foreground/90 dark:hover:bg-white/[0.16]",
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
        className="w-36 rounded-2xl border border-black/[0.08] bg-white/90 p-1 shadow-xl backdrop-blur-2xl dark:border-white/[0.1] dark:bg-[#1c1c1e]/90"
      >
        <DropdownMenuLabel className="px-2 py-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          界面外观
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="my-1 opacity-60" />
        {options.map((opt) => {
          const Icon = opt.icon;
          const isSelected = theme === opt.value;
          return (
            <DropdownMenuItem
              key={opt.value}
              onClick={() => setTheme(opt.value)}
              className={cn(
                "flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-medium cursor-pointer transition-colors",
                isSelected
                  ? "bg-primary/10 text-primary font-semibold dark:bg-primary/20"
                  : "text-foreground/80 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{opt.label}</span>
              {isSelected && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

