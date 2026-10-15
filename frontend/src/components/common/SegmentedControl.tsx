"use client";

import type { LucideIcon } from "lucide-react";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * 分段控件（iOS segmented control 的语义版）。
 *
 * 为什么不用 Radix <Tabs>：
 * Tabs 渲染的是 `role="tablist"` + `role="tab"`，并**要求**每个 trigger 关联一个
 * `tabpanel`。它的键盘模型是「方向键在标签页之间跳」，读屏也会 announced 成
 * 「选项卡」。而全站有多处根本不是选项卡：
 *   - UsageView：时间区间筛选（今天 / 本月 / 今年 / 全部）
 *   - UsageView：模型分布排序（按花费 / 按 Token）
 *   - UsageView：审计状态筛选（全部 / 正常 / 已删除）
 *   - SettingsView：外观三档（跟随系统 / 浅色 / 深色）
 *
 * 这些是「一组选项里选一个」，正确的角色是 radio。滥用 Tabs 会让读屏用户听到
 * 「选项卡」，并且方向键会把焦点移到视野之外没有对应内容的选项上。
 *
 * 现在统一为 `role="radiogroup"` + `role="radio"` + roving tabindex，
 * 方向键在组内移动并即时选中，与原生 radio group 的行为一致。
 * 真正需要 tab/panel 语义的地方（全站仅管理员 / 我的用量切换）继续用 <Tabs>。
 */

export interface SegmentedOption<T extends string> {
  value: T;
  label: React.ReactNode;
  icon?: LucideIcon;
  /** 图标单独染色（例如主题档位里的琥珀色太阳 / 靛蓝月亮） */
  iconClassName?: string;
  /** 选中时整块的强调色，默认 primary */
  activeClassName?: string;
}

export interface SegmentedControlProps<T extends string> {
  value: T;
  onValueChange: (value: T) => void;
  options: readonly SegmentedOption<T>[];
  /** 分组名称，读屏进入时会念出 */
  ariaLabel: string;
  size?: "sm" | "md";
  className?: string;
  /** 轨道（外层容器）的额外 class */
  listClassName?: string;
}

export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  ariaLabel,
  size = "md",
  className,
  listClassName,
}: SegmentedControlProps<T>) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const activeIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value)
  );

  const select = React.useCallback(
    (index: number) => {
      const next = options[index];
      if (!next) return;
      onValueChange(next.value);
      refs.current[index]?.focus();
    },
    [onValueChange, options]
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    const last = options.length - 1;
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = activeIndex >= last ? 0 : activeIndex + 1;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = activeIndex <= 0 ? last : activeIndex - 1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = last;
    if (next === null) return;
    e.preventDefault();
    select(next);
  };

  const isSm = size === "sm";

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={cn(
        "inline-flex items-center gap-1 rounded-xl border border-border/40 bg-surface-3/60 p-1 backdrop-blur-sm",
        isSm ? "h-8" : "h-9",
        listClassName
      )}
    >
      {options.map((opt, idx) => {
        const Icon = opt.icon;
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            // roving tabindex：组内只有一个可 Tab 到的元素，其余靠方向键抵达
            tabIndex={idx === activeIndex ? 0 : -1}
            ref={(el) => {
              refs.current[idx] = el;
            }}
            onClick={() => onValueChange(opt.value)}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-all",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-surface-3",
              // 轨道外层已设 h-8（32px）/ h-9（36px）并带 p-1（4px 内边距），
              // 内部按钮对应应为 h-6（24px）/ h-7（28px），避免高度溢出导致超出轨道边框错乱。
              isSm ? "h-6 px-2.5 text-xs" : "h-7 px-3 text-xs",
              active
                ? opt.activeClassName ??
                  "bg-background text-foreground font-semibold shadow-2xs"
                : "text-muted-foreground hover:text-foreground",
              className
            )}
          >
            {Icon && (
              <Icon
                className={cn(
                  "shrink-0",
                  isSm ? "h-3 w-3" : "h-3.5 w-3.5",
                  opt.iconClassName
                )}
              />
            )}
            <span className="truncate">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
