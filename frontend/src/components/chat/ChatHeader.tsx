"use client";

import React from "react";
import { ModelCatalogItem } from "@/types";
import { ModelSelect } from "@/components/common/ModelSelect";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ActionTooltip } from "@/components/common/ActionTooltip";
import { UserAvatarDropdown, MobileTab } from "@/components/layout/UserAvatarDropdown";
import { BrandLogo } from "@/components/common/BrandLogo";
import { Brain, Plus, RotateCw, Menu } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MobileChatHeaderProps {
  currentModel: string;
  onModelChange: (model: string) => void;
  availableModels: ModelCatalogItem[];
  onRefreshModels?: () => void;
  isRefreshingModels?: boolean;
  onToggleMemory?: () => void;
  memoriesCount?: number;
  onNewChat?: () => void;
  hasMessages?: boolean;
  onSelectMobileTab?: (tab: MobileTab) => void;
  className?: string;
}

/**
 * ── Mobile Chat Navigation Bar (44pt + Safe Area Top) ──
 * Standalone top-level mobile header, completely isolated outside the chat container div.
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
  const hasActiveMemories = typeof memoriesCount === "number" && memoriesCount > 0;

  return (
    <header
      className={cn(
        "md:hidden shrink-0 w-full bg-background/85 backdrop-blur-xl border-b border-border/40 pt-[env(safe-area-inset-top,0px)] select-none z-30",
        className
      )}
    >
      <div className="h-11 px-3 sm:px-4 flex items-center justify-between gap-2 min-w-0">
        {/* Left: Brand Logo (tap to new chat) + Compact ModelSelect */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button
            type="button"
            onClick={onNewChat}
            className="flex items-center shrink-0 active:scale-95 transition-transform cursor-pointer"
            title="Apiapia 助理 / 新建对话"
          >
            <BrandLogo size={28} className="shadow-xs" />
          </button>

          <div className="min-w-0 max-w-[calc(100%-8px)]">
            <ModelSelect
              value={currentModel}
              onChange={onModelChange}
              models={availableModels}
              variant="compact"
            />
          </div>
        </div>

        {/* Right: Actions & User Avatar */}
        <div className="flex items-center gap-1 shrink-0">
          {hasActiveMemories ? (
            <ActionTooltip label={`查看当前对话使用的 ${memoriesCount} 条关联记忆`}>
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleMemory}
                className="h-8 px-2.5 rounded-full shrink-0 text-primary bg-primary/10 hover:bg-primary/15 active:scale-95 transition-all gap-1.5 font-medium text-xs border border-primary/20 cursor-pointer"
              >
                <Brain className="h-4 w-4 text-primary shrink-0" />
                <span className="text-[11px] font-semibold font-mono">{memoriesCount}</span>
                <span className="sr-only">当前使用的记忆</span>
              </Button>
            </ActionTooltip>
          ) : onRefreshModels ? (
            <ActionTooltip label="向配置的提供商 API 手动同步最新模型">
              <Button
                variant="ghost"
                size="icon"
                onClick={onRefreshModels}
                disabled={isRefreshingModels}
                title="向配置的提供商 API 手动同步最新模型"
                className="h-8 w-8 rounded-full shrink-0 text-muted-foreground hover:text-foreground active:scale-95 transition-all cursor-pointer"
              >
                <RotateCw className={cn("h-3.5 w-3.5", isRefreshingModels && "animate-spin text-primary")} />
                <span className="sr-only">同步模型</span>
              </Button>
            </ActionTooltip>
          ) : null}

          {onNewChat && hasMessages && (
            <ActionTooltip label="新建对话">
              <Button
                variant="ghost"
                size="icon"
                onClick={onNewChat}
                className="h-8 w-8 rounded-full shrink-0 text-muted-foreground hover:text-foreground active:scale-95 transition-all cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span className="sr-only">新建对话</span>
              </Button>
            </ActionTooltip>
          )}

          <UserAvatarDropdown onSelectMobileTab={onSelectMobileTab} />
        </div>
      </div>
    </header>
  );
};

export interface DesktopChatHeaderProps {
  currentModel: string;
  onModelChange: (model: string) => void;
  availableModels: ModelCatalogItem[];
  onRefreshModels?: () => void;
  isRefreshingModels?: boolean;
  onToggleSidebar?: () => void;
  onToggleMemory?: () => void;
  memoriesCount?: number;
  onNewChat?: () => void;
  className?: string;
}

/**
 * ── Desktop Chat Toolbar (48px) ──
 * Dedicated toolbar for desktop / tablet view inside workspace.
 */
export const DesktopChatHeader: React.FC<DesktopChatHeaderProps> = ({
  currentModel,
  onModelChange,
  availableModels,
  onRefreshModels,
  isRefreshingModels = false,
  onToggleSidebar,
  onToggleMemory,
  memoriesCount = 0,
  onNewChat,
  className,
}) => {
  const hasActiveMemories = typeof memoriesCount === "number" && memoriesCount > 0;

  return (
    <header
      className={cn(
        "hidden md:flex border-b border-border/40 bg-background/80 backdrop-blur-xl px-4 items-center justify-between z-20 gap-2 flex-nowrap min-w-0 h-12 shrink-0 select-none",
        className
      )}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {onToggleSidebar && (
          <Button
            variant="outline"
            size="icon"
            onClick={onToggleSidebar}
            title="展开历史对话"
            className="shrink-0"
          >
            <Menu className="h-4 w-4" />
            <span className="sr-only">展开历史对话</span>
          </Button>
        )}

        <span className="hidden lg:inline text-xs text-muted-foreground font-medium shrink-0 whitespace-nowrap">
          当前模型：
        </span>

        <div className="flex items-center min-w-0">
          <ModelSelect
            value={currentModel}
            onChange={onModelChange}
            models={availableModels}
            variant="compact"
          />
        </div>

        {onRefreshModels && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefreshModels}
            disabled={isRefreshingModels}
            title="向配置的提供商 API 手动同步最新模型"
            className="shrink-0 text-primary border-primary/30 bg-primary/5 hover:bg-primary/10 hover:text-primary cursor-pointer"
          >
            <RotateCw className={cn("h-3.5 w-3.5", isRefreshingModels && "animate-spin")} />
            <span className="hidden lg:inline">{isRefreshingModels ? "正在同步..." : "同步模型"}</span>
            <span className="sr-only">同步模型</span>
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <ThemeToggle />

        {onToggleMemory && (
          <Button
            variant="outline"
            size="icon"
            onClick={onToggleMemory}
            title="查看本次对话关联记忆"
            className="lg:hidden relative cursor-pointer"
          >
            <Brain className="h-4 w-4 text-primary" />
            {hasActiveMemories && (
              <Badge className="absolute -top-1.5 -right-1.5 h-4 min-w-4 px-1 items-center justify-center rounded-full text-[9px] font-bold">
                {memoriesCount > 9 ? "9+" : memoriesCount}
              </Badge>
            )}
            <span className="sr-only">查看关联记忆</span>
          </Button>
        )}

        {onNewChat && (
          <Button
            variant="outline"
            size="icon"
            onClick={onNewChat}
            title="新建对话"
            className="cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span className="sr-only">新建对话</span>
          </Button>
        )}
      </div>
    </header>
  );
};
