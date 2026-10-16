"use client";

import React from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface ActionTooltipProps {
  label: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  className?: string;
  shortcut?: string;
}

/**
 * 全应用统一的悬浮提示。
 *
 * `TooltipProvider` 挂在根布局上，这里只做单条提示的包装，因此：
 * - 共享同一份 open/skip-delay 状态，鼠标横扫一排图标时气泡会接力而不是逐个重新计时
 * - 不需要每个调用点都记得自己包一层 Provider
 *
 * 用法约定：
 * - 只给**图标按钮**等无可见文字的控件加；本身已有可见文字的不要加
 * - 触发元素需可聚焦（原生 button 天然满足；独立使用的 div/span 需自行加 `tabIndex`；
 *   但嵌在另一个 button 里的装饰元素不要加，否则会产生非法的嵌套交互内容）
 * - 触发元素内部仍需保留 `<span className="sr-only">`，供读屏使用
 * - 文案用简短动宾短语；括号补充参数时统一用全角「（）」，冒号统一用全角「：」
 *
 * 注意：需要和 DropdownMenu / Popover 等 `asChild` 触发器组合时，把本组件放在
 * 触发器**外面**（`<ActionTooltip><DropdownMenuTrigger asChild>`），不要放在里面。
 */
export function ActionTooltip({
  label,
  children,
  side = "top",
  align = "center",
  className,
  shortcut,
}: ActionTooltipProps) {
  if (!label) return <>{children}</>;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} align={align} className={className}>
        {label}
        {shortcut ? ` (${shortcut})` : null}
      </TooltipContent>
    </Tooltip>
  );
}