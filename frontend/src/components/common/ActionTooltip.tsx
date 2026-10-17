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

/** 全应用统一的悬浮提示组件 */
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