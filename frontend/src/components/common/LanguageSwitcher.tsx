"use client";

import React from "react";
import { Check, Languages } from "lucide-react";
import { LOCALES, LOCALE_META, useI18n } from "@/i18n";
import type { Locale } from "@/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  overlaySurfaceClass,
  menuItemClass,
  menuSeparatorClass,
} from "@/components/common/surfaces";
import { ActionTooltip } from "@/components/common/ActionTooltip";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** 界面语言切换下拉菜单 */
export function LanguageDropdown({
  className,
  showLabel = false,
}: {
  className?: string;
  /** true 时触发器显示「图标 + 标签 + 当前语言」，false 时只显示图标 */
  showLabel?: boolean;
}) {
  const { locale, setLocale, t } = useI18n();
  const current = LOCALE_META[locale];

  const trigger = (
    <Button
      variant="outline"
      size={showLabel ? "sm" : "icon"}
      className={cn(
        showLabel && "gap-2 rounded-xl px-2.5 text-xs font-medium",
        className
      )}
    >
      <Languages className="h-4 w-4 shrink-0 text-muted-foreground" />
      {showLabel && (
        <span className="truncate text-foreground">{current.nativeName}</span>
      )}
      <span className="sr-only">
        {t("common.language.label")}: {current.nativeName}
      </span>
    </Button>
  );

  return (
    <DropdownMenu>
      {showLabel ? (
        <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      ) : (
        // The tooltip wraps the trigger rather than sitting inside it: Radix's
        // `asChild` chain has to reach a real DOM element, and DropdownMenuTrigger
        // already forwards ref/props down to its own child.
        <ActionTooltip label={`${t("common.language.label")}: ${current.nativeName}`}>
          <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
        </ActionTooltip>
      )}
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        collisionPadding={12}
        className={overlaySurfaceClass}
      >
        <DropdownMenuLabel className="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("common.language.label")}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className={menuSeparatorClass} />
        {LOCALES.map((value: Locale) => {
          const meta = LOCALE_META[value];
          const isSelected = locale === value;
          return (
            <DropdownMenuItem
              key={value}
              onClick={() => setLocale(value)}
              className={cn(
                menuItemClass,
                "items-center py-2",
                isSelected
                  ? "bg-primary/10 font-semibold text-primary hover:bg-primary/15 data-[highlighted]:bg-primary/15"
                  : "text-foreground/80"
              )}
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate leading-tight">{meta.nativeName}</span>
                <span className="truncate text-xs font-normal text-muted-foreground">
                  {meta.englishName}
                </span>
              </span>
              {isSelected && <Check className="ml-auto h-4 w-4 shrink-0 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * 登录页顶栏用的紧凑入口：只有图标，与旁边的 ThemeToggle 并排。
 */
export function LanguageButton({ className }: { className?: string }) {
  return <LanguageDropdown className={className} />;
}

/** 设置页语言配置行 */
export function LanguageRow({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-foreground">
          <Languages className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span>{t("common.language.label")}</span>
        </div>
        <LanguageDropdown showLabel />
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {t("common.language.description")}
      </p>
    </div>
  );
}