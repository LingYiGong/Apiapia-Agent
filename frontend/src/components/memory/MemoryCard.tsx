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
 *     - 时间在卡片**底部**，带一条border-t 分隔线，右侧挂「已向量化」
 *
 *   /memory 记忆库列表
 *     - Panel 默认 tone（bg-card/80），正文 15px
 *     - 时间在卡片**顶部**，和「记忆 #3」标签并排，右侧挂「已编辑」
 *
 * 用户在两个界面看到的是同一份数据，却像是两种卡片 —— 这正是「记忆窗口和
 * 整体样式不统一」的主要来源。现在两处共用本组件，只通过 size / actions
 * 表达差异，元信息行（时间 + 徽章）的位置与样式由这里统一。
 *
 * 元信息统一放在**底部**，横向对齐，便于在列表里逐条比较时间。
 */

export interface MemoryCardProps {
  text: string;
  /**
   * 正文尺寸。侧栏 / 移动抽屉只有 256–288px 宽，用 sm；
   * 记忆库有 max-w-3xl，用 md。
   */
  size?: "sm" | "md";
  /** 左侧图标方块 */
  icon?: React.ReactNode;
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

/**
 * 正文直接跟在图标后面，同一行起排 —— 不再单独占一行。
 *
 * 此前结构是「图标 + 「记忆 #6」标签」一行，正文另起一行。标签本身没有信息量
 * （序号既不是 id 也不是时间，分页后还会随加载顺序漂移），却让每张卡片多出一行
 * 纯装饰的高度；现在图标右侧直接就是记忆正文，行数更少、扫读更快。
 */
export function MemoryCard({
  text,
  size = "sm",
  icon,
  actions,
  time,
  badge,
  interactive = false,
  className,
}: MemoryCardProps) {
  const isWide = size === "md";
  const hasActions = Boolean(actions);

  return (
    <Panel
      interactive={interactive}
      className={cn(
        "group",
        isWide ? "p-4 hover:bg-card sm:p-[18px]" : "space-y-2 p-3.5",
        className
      )}
    >
      <div className="flex items-start gap-3">
        {icon}

        {/* 正文：flex-1 让它吃掉剩余宽度，操作按钮才能稳定贴在右侧。
            min-w-0 是必要的 —— 没有它，长英文单词/URL 会把 flex 容器撑宽，
            顶掉右侧按钮。 */}
        <p
          className={cn(
            "min-w-0 flex-1 whitespace-pre-wrap break-words font-normal leading-relaxed text-foreground/90 select-text",
            // 正文在窄栏与宽列表之间差 2px，这个差异是有意的；
            // 但行高、字重、颜色、换行策略必须一致，否则两边观感会分叉。
            isWide ? "text-subhead sm:text-base" : "text-footnote"
          )}
        >
          {text}
        </p>

        {hasActions && (
          <div className="flex shrink-0 items-center gap-1 opacity-80 transition-opacity group-hover:opacity-100">
            {actions}
          </div>
        )}
      </div>

      {(time || badge) && (
        /*
         * 有图标时给 pl-11，让时间戳与上方的正文左边缘对齐（图标 32px + gap 12px）；
         * 侧栏不传图标，此时不加缩进，否则时间戳会比正文凭空右移一截。
         */
        <div
          className={cn(
            "flex flex-wrap items-center gap-1.5 border-t border-border/40 pt-2 text-2xs text-muted-foreground/70",
            icon && "pl-11"
          )}
        >
          {time && (
            <span className="inline-flex items-center gap-1 font-mono">
              <Clock className="h-3 w-3 shrink-0 opacity-70" />
              <span>{time}</span>
            </span>
          )}
          {badge && (
            <span className="shrink-0 select-none rounded-md bg-surface-3/60 px-1.5 py-0.5 font-normal text-2xs text-muted-foreground/80">
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