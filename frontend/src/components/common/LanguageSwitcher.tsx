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
  actionMenuContentClass,
  actionMenuItemClass,
  actionMenuSeparatorClass,
} from "@/components/common/actionMenu";
import { ActionTooltip } from "@/components/common/ActionTooltip";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * 界面语言切换（简体中文 / 繁體中文 / English / 日本語）。
 *
 * **为什么是下拉而不是分段控件。** 四个分段按钮在 320px 的窄栏里每个只剩
 * ~62px，而「简体中文」四个字加上内边距就已经接近这个宽度了 —— 剩下的三种
 * 语言都会被 truncate 成「简体…」。而且语言数量是可增长的：再加一种语言，
 * 分段控件必须重排，下拉不用。
 *
 * 形态与 ThemeToggle 对齐（同一个项目里两处「外观/语言」入口，一处用分段
 * 一处用下拉会显得是两个产品），但内容比主题多一行副标题 ——
 * 母语名 + 英文名，帮那些认得两种语言的人交叉确认。
 *
 * **选项标签一律用母语自称。** 一个不懂英语的用户在英文界面里看到
 * "Japanese" 未必认得出那是日语，但一定认得出「日本語」。这是语言选择器
 * 与语言列表（`<html lang>`、Accept-Language）最重要的区别。
 */
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
        className={actionMenuContentClass}
      >
        <DropdownMenuLabel className="px-2 py-1 text-2xs font-medium uppercase tracking-wider text-muted-foreground">
          {t("common.language.label")}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className={actionMenuSeparatorClass} />
        {LOCALES.map((value: Locale) => {
          const meta = LOCALE_META[value];
          const isSelected = locale === value;
          return (
            <DropdownMenuItem
              key={value}
              onClick={() => setLocale(value)}
              // 行内容是两行（母语名 + 英文名），所以额外保留 py-2 与居中对齐。
              // 选中行必须同时覆盖 hover / data-[highlighted]，否则高亮的灰底会
              // 盖掉 bg-primary/10。容器宽度交给 w-max 自适应，不再写死 w-52。
              className={cn(
                actionMenuItemClass,
                "items-center py-2",
                isSelected
                  ? "bg-primary/10 font-semibold text-primary hover:bg-primary/15 data-[highlighted]:bg-primary/15"
                  : "text-foreground/80"
              )}
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate leading-tight">{meta.nativeName}</span>
                <span className="truncate text-3xs font-normal text-muted-foreground">
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

/**
 * 设置页里的整行：标题 + 说明 + 触发器。
 *
 * 语言与外观放在同一组是有意的 —— 两者都是「这台设备上的显示偏好」，
 * 都不写服务端、不参与脏检查、不需要点保存。
 */
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