"use client";

import React from "react";
import { Clock } from "lucide-react";
import { Panel } from "@/components/common/Panel";
import { cn } from "@/lib/utils";

/**
 * 一条长期记忆的卡片外观 —— 全应用唯一定义。
 *
 * 同一条记忆此前在两个地方各写了一遍，且**两遍都不一样**：
 *
 *   聊天页右侧「本次关联记忆」侧栏
 *     - Panel tone="muted"（灰底），正文 13px
 *     - 时间在卡片**底部**，带一条 border-t 分隔线，右侧挂「已向量化」
 *
 *   /memory 记忆库列表
 *     - Panel 默认 tone（bg-card/80），正文 15px
 *     - 时间在卡片**顶部**，和「记忆 #3」标签并排，右侧挂「已编辑」
 *
 * 用户在两个界面看到的是同一份数据，却像是两种卡片 —— 这正是「记忆窗口和
 * 整体样式不统一」的主要来源。现在两处共用本组件，只通过 size / label /
 * actions 表达差异，元信息行（时间 + 徽章）的位置与样式由这里统一。
 *
 * 元信息统一放在**底部**：顶部留给「标签 + 操作按钮」，符合常规卡片的
 * 操作位；底部是元数据，在列表里横向对齐，便于逐条比较时间。
 */

export interface MemoryCardProps {
  text: string;
  /**
   * 正文尺寸。侧栏 / 移动抽屉只有 256–288px 宽，用 sm；
   * 记忆库有 max-w-3xl，用 md。
   */
  size?: "sm" | "md";
  /** 顶部标签行左侧的图标方块 */
  icon?: React.ReactNode;
  /** 顶部标签文字，如「记忆 #3」。不传则不渲染标签行（侧栏即如此） */
  label?: React.ReactNode;
  /** 顶部右侧操作区（记忆库的编辑 / 删除） */
  actions?: React.ReactNode;
  /** 时间。传了才渲染底部元信息行 */
  time?: string;
  /** 时间右侧的状态徽章，如「已编辑」「已向量化」 */
  badge?: string;
  /** hover 时给一个边框反馈 */
  interactive?: boolean;
  className?: string;
}

export function MemoryCard({
  text,
  size = "sm",
  icon,
  label,
  actions,
  time,
  badge,
  interactive = false,
  className,
}: MemoryCardProps) {
  const isWide = size === "md";
  const hasTopRow = Boolean(icon || label || actions);

  return (
    <Panel
      interactive={interactive}
      className={cn(
        "group",
        isWide ? "p-4 hover:bg-card sm:p-[18px]" : "space-y-2 p-3.5",
        className
      )}
    >
      {hasTopRow && (
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {icon}
            {label && (
              <span className="shrink-0 text-[12px] font-semibold tracking-tight text-foreground/80">
                {label}
              </span>
            )}
          </div>
          {actions && (
            <div className="flex shrink-0 items-center gap-1 opacity-80 transition-opacity group-hover:opacity-100">
              {actions}
            </div>
          )}
        </div>
      )}

      <p
        className={cn(
          "whitespace-pre-wrap break-words font-normal leading-relaxed text-foreground/90 select-text",
          // 正文在窄栏与宽列表之间差 2px，这个差异是有意的；
          // 但行高、字重、颜色、换行策略必须一致，否则两边观感会分叉。
          isWide ? "mt-2.5 text-[15px]" : "text-[13px]"
        )}
      >
        {text}
      </p>

      {(time || badge) && (
        <div
          className={cn(
            "flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground/70",
            hasTopRow ? "mt-2.5 border-t border-border/40 pt-2.5" : "border-t border-border/40 pt-2"
          )}
        >
          {time && (
            <span className="inline-flex items-center gap-1 font-mono">
              <Clock className="h-3 w-3 shrink-0 opacity-70" />
              <span>{time}</span>
            </span>
          )}
          {badge && (
            <span className="shrink-0 select-none rounded-md bg-surface-3/60 px-1.5 py-0.5 font-normal text-[10px] text-muted-foreground/80">
              {badge}
            </span>
          )}
        </div>
      )}
    </Panel>
  );
}

/** 记忆卡片的标签图标方块。尺寸与 Panel.SectionHeader 一致（h-8 rounded-xl）。 */
export function MemoryCardIcon({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
      {children}
    </div>
  );
}