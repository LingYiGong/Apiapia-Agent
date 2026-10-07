"use client";

import React from "react";
import { ModelCatalogItem } from "@/types";
import { ModelSelect } from "@/components/common/ModelSelect";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { Button } from "@/components/ui/button";
import { ActionTooltip } from "@/components/common/ActionTooltip";
import { UserAvatarMenu } from "@/components/layout/UserAvatarDropdown";
import { Brain, Plus, RotateCw } from "lucide-react";
import type { MobileTab } from "@/config/navigation";
import { cn } from "@/lib/utils";

import { MobileHeader } from "@/components/layout/MobileHeader";

/**
 * 聊天页两个头部真正共有的 props：模型选择 + 同步 + 新建对话。
 *
 * 「关联记忆」相关的两个字段（onToggleMemory / memoriesCount）只属于移动端 ——
 * 桌面端右侧记忆侧栏常驻，没有开关也没有角标，所以不放进这个共用接口。
 */
export interface ChatHeaderBaseProps {
  currentModel: string;
  onModelChange: (model: string) => void;
  availableModels: ModelCatalogItem[];
  onRefreshModels?: () => void;
  isRefreshingModels?: boolean;
  onNewChat?: () => void;
  className?: string;
}

export interface MobileChatHeaderProps extends ChatHeaderBaseProps {
  /** 打开底部 Sheet（移动端） */
  onToggleMemory?: () => void;
  /** Sheet 按钮上的记忆条数 */
  memoriesCount?: number;
  hasMessages?: boolean;
  onSelectMobileTab?: (tab: MobileTab) => void;
}

/** 桌面端没有额外字段：记忆侧栏常驻，无需开关 */
export interface DesktopChatHeaderProps extends ChatHeaderBaseProps {}

/**
 * ── Mobile Chat Navigation Bar (48px + Safe Area Top) ──
 * Unified with standard MobileHeader across all SPA tabs.
 */
export const MobileChatHeader: React.FC<MobileChatHeaderProps> = ({
  currentModel,
  onModelChange,
  availableModels,
  onRefreshModels,
  isRefreshingModels = false,
  onToggleMemory,
  memoriesCount = 0,
  onNewChat,
  hasMessages = false,
  onSelectMobileTab,
  className,
}) => {
  const hasActiveMemories = memoriesCount > 0;

  return (
    <MobileHeader
      className={className}
      onSelectMobileTab={onSelectMobileTab}
      // logo 在聊天页的语义是「新建对话」，而不是「回首页」——
      // MobileHeader 据此生成正确的 aria-label。
      logoAction="new-chat"
      onLogoClick={onNewChat}
      right={
        <div className="flex shrink-0 items-center gap-1">
          {hasActiveMemories ? (
            <ActionTooltip label={`查看当前对话使用的 ${memoriesCount} 条关联记忆`}>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onToggleMemory}
                className="h-8 shrink-0 cursor-pointer gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 text-xs font-medium text-primary transition-colors hover:bg-primary/15 active:scale-95"
              >
                <Brain className="h-4 w-4 shrink-0 text-primary" />
                <span className="font-mono text-[11px] font-semibold">{memoriesCount}</span>
                <span className="sr-only">条关联记忆，点击查看</span>
              </Button>
            </ActionTooltip>
          ) : onRefreshModels ? (
            <ActionTooltip label="同步模型">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onRefreshModels}
                disabled={isRefreshingModels}
                className="h-8 w-8 shrink-0 cursor-pointer rounded-full text-muted-foreground transition-colors hover:text-foreground active:scale-95"
              >
                <RotateCw
                  className={cn("h-3.5 w-3.5", isRefreshingModels && "animate-spin text-primary")}
                />
                <span className="sr-only">同步模型</span>
              </Button>
            </ActionTooltip>
          ) : null}

          {onNewChat && hasMessages && (
            <ActionTooltip label="新建对话">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onNewChat}
                className="h-8 w-8 shrink-0 cursor-pointer rounded-full text-muted-foreground transition-colors hover:text-foreground active:scale-95"
              >
                <Plus className="h-4 w-4" />
                <span className="sr-only">新建对话</span>
              </Button>
            </ActionTooltip>
          )}

          <UserAvatarMenu onSelectMobileTab={onSelectMobileTab} />
        </div>
      }
    >
      <div className="min-w-0 max-w-[calc(100%-8px)]">
        <ModelSelect
          value={currentModel}
          onChange={onModelChange}
          models={availableModels}
          variant="compact"
        />
      </div>
    </MobileHeader>
  );
};

/**
 * ── Desktop Chat Toolbar (48px) ──
 * Dedicated toolbar for desktop / tablet view inside workspace.
 *
 * 桌面端**没有**「关联记忆」按钮：右侧记忆侧栏与左侧会话侧栏一样是常驻的，
 * 不存在打开/关闭的概念，留一个按钮只能控制一个不存在的东西。移动端的
 * Brain 按钮仍然存在，它开的是底部 Sheet（见 MobileChatHeader）。
 */
export const DesktopChatHeader: React.FC<DesktopChatHeaderProps> = ({
  currentModel,
  onModelChange,
  availableModels,
  onRefreshModels,
  isRefreshingModels = false,
  onNewChat,
  className,
}) => {
  return (
    <header
      className={cn(
        "z-20 hidden h-[var(--toolbar-h)] shrink-0 select-none flex-nowrap items-center justify-between gap-2 border-b border-border/40 bg-background/80 px-4 backdrop-blur-xl md:flex md:min-w-0",
        className
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {/* 此前这里有一个汉堡按钮调用 onToggleSidebar → handleSelectMobileTab("history")，
            而目标容器是 `md:hidden` —— 这个按钮只存在于 `hidden md:flex` 的桌面头部里，
            于是桌面上可见、可聚焦、点了毫无反应，还会顺手改写 URL。
            桌面侧栏本身就是常驻的（Sidebar 的 `hidden md:flex`），没有可折叠的状态，
            所以正确做法是把按钮和 onToggleSidebar 整条链路一起删掉。 */}

        <span className="hidden shrink-0 whitespace-nowrap text-xs font-medium text-muted-foreground lg:inline">
          当前模型：
        </span>

        <div className="flex min-w-0 items-center">
          <ModelSelect
            value={currentModel}
            onChange={onModelChange}
            models={availableModels}
            variant="compact"
          />
        </div>

        {onRefreshModels && (
          <ActionTooltip label="同步模型">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRefreshModels}
              disabled={isRefreshingModels}
              className="shrink-0 cursor-pointer border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary"
            >
              <RotateCw className={cn("h-3.5 w-3.5", isRefreshingModels && "animate-spin")} />
              <span className="hidden lg:inline">
                {isRefreshingModels ? "正在同步..." : "同步模型"}
              </span>
              <span className="sr-only">同步模型</span>
            </Button>
          </ActionTooltip>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <ThemeToggle />

        {onNewChat && (
          <ActionTooltip label="新建对话">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={onNewChat}
              className="cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span className="sr-only">新建对话</span>
            </Button>
          </ActionTooltip>
        )}
      </div>
    </header>
  );
};
