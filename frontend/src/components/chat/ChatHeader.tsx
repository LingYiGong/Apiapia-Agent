"use client";

import React from "react";
import { ModelCatalogItem } from "@/types";
import { ModelSelect } from "@/components/common/ModelSelect";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { Button } from "@/components/ui/button";
import { ActionTooltip } from "@/components/common/ActionTooltip";
import { UserAvatarMenu } from "@/components/layout/UserAvatarDropdown";
import {
  Brain,
  Plus,
  RotateCw,
  Pin,
  PinOff,
  Pencil,
  Trash2,
  MoreHorizontal,
  Edit2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useConfirm } from "@/hooks/useConfirm";
import type { MobileTab } from "@/config/navigation";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import type { Conversation } from "@/types";

import { MobileHeader } from "@/components/layout/MobileHeader";
import {
  actionMenuContentClass,
  actionMenuDangerItemClass,
  actionMenuItemClass,
  actionMenuSeparatorClass,
} from "@/components/common/actionMenu";

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
  isVocabMode?: boolean;
}

export interface MobileChatHeaderProps extends ChatHeaderBaseProps {
  /** 打开底部 Sheet（移动端） */
  onToggleMemory?: () => void;
  /** Sheet 按钮上的记忆条数 */
  memoriesCount?: number;
  hasMessages?: boolean;
  onSelectMobileTab?: (tab: MobileTab) => void;
  activeConversation?: Conversation | null;
  onTogglePin?: (id: string, nextPinned: boolean) => void;
  onRename?: (id: string, newTitle: string) => void;
  onDelete?: (id: string) => void;
}

/** 桌面端会话操作：置顶、重命名、删除 */
export interface DesktopChatHeaderProps extends ChatHeaderBaseProps {
  activeConversation?: Conversation | null;
  onTogglePin?: (id: string, nextPinned: boolean) => void;
  onRename?: (id: string, newTitle: string) => void;
  onDelete?: (id: string) => void;
}

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
  activeConversation,
  onTogglePin,
  onRename,
  onDelete,
  className,
  isVocabMode = false,
}) => {
  const { t } = useI18n();
  const hasActiveMemories = memoriesCount > 0;
  const isPinned = !!activeConversation?.is_pinned;

  const [isRenaming, setIsRenaming] = React.useState(false);
  const [newTitle, setNewTitle] = React.useState("");
  const { ask, dialog } = useConfirm();

  const handleStartRename = () => {
    if (!activeConversation) return;
    setNewTitle(activeConversation.title || "");
    setIsRenaming(true);
  };

  const handleConfirmRename = () => {
    if (activeConversation && onRename && newTitle.trim()) {
      onRename(activeConversation.id, newTitle.trim());
    }
    setIsRenaming(false);
  };

  return (
    <>
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
              <ActionTooltip label={t("chat.header.memoryCountTip", { count: memoriesCount })}>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onToggleMemory}
                  className="h-8 shrink-0 cursor-pointer gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 text-xs font-medium text-primary transition-colors hover:bg-primary/15 active:scale-95"
                >
                  <Brain className="h-4 w-4 shrink-0 text-primary" />
                  <span className="font-mono text-2xs font-semibold">{memoriesCount}</span>
                  <span className="sr-only">{t("chat.header.memoryCountLabel")}</span>
                </Button>
              </ActionTooltip>
            ) : null}

            {activeConversation && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 cursor-pointer rounded-full text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 active:scale-95"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">{t("chat.history.actionMenu")}</span>
                  </Button>
                </DropdownMenuTrigger>
                {/* 样式收敛到 components/common/actionMenu.ts —— 与下方相邻的头像
                    菜单同一套刻度，四个问题的根因见那里的注释。 */}
                <DropdownMenuContent
                  align="end"
                  sideOffset={8}
                  collisionPadding={12}
                  className={actionMenuContentClass}
                >
                  {onTogglePin && (
                    <DropdownMenuItem
                      onClick={() => onTogglePin(activeConversation.id, !isPinned)}
                      className={actionMenuItemClass}
                    >
                      {isPinned ? (
                        <>
                          <PinOff className="h-4 w-4 text-muted-foreground" />
                          <span>{t("chat.history.unpin")}</span>
                        </>
                      ) : (
                        <>
                          <Pin className="h-4 w-4 text-muted-foreground" />
                          <span>{t("chat.history.pin")}</span>
                        </>
                      )}
                    </DropdownMenuItem>
                  )}
                  {onRename && (
                    <DropdownMenuItem
                      onClick={handleStartRename}
                      className={actionMenuItemClass}
                    >
                      <Edit2 className="h-4 w-4 text-muted-foreground" />
                      <span>{t("chat.history.rename")}</span>
                    </DropdownMenuItem>
                  )}
                  {onDelete && (
                    <>
                      <DropdownMenuSeparator className={actionMenuSeparatorClass} />
                      <DropdownMenuItem
                        onClick={() =>
                          ask({
                            title: t("chat.history.deleteTitle"),
                            description: t("chat.history.deleteDesc", {
                              title: activeConversation.title || t("chat.history.untitled"),
                            }),
                            confirmText: t("chat.history.delete"),
                            danger: true,
                            onConfirm: () => onDelete(activeConversation.id),
                          })
                        }
                        className={actionMenuDangerItemClass}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span>{t("chat.history.deleteConversation")}</span>
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
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
            isVocabMode={isVocabMode}
          />
        </div>
      </MobileHeader>

      {/* 移动端重命名弹窗 */}
      {isRenaming && (
        <Dialog open onOpenChange={(open) => !open && setIsRenaming(false)}>
          <DialogContent className="max-w-sm rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold">
                {t("chat.history.renameTitle")}
              </DialogTitle>
            </DialogHeader>
            <div className="py-2">
              <Label htmlFor="mobile-rename-input" className="sr-only">
                {t("chat.history.renameLabel")}
              </Label>
              <Input
                id="mobile-rename-input"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder={t("chat.history.renamePh")}
                className="h-10 rounded-xl text-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleConfirmRename();
                }}
              />
            </div>
            <DialogFooter className="flex-row justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsRenaming(false)}
                className="rounded-xl"
              >
                {t("common.action.cancel")}
              </Button>
              <Button type="button" size="sm" onClick={handleConfirmRename} className="rounded-xl">
                {t("common.action.save")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {dialog}
    </>
  );
};

/**
 * ── Desktop Chat Toolbar (48px) ──
 * Dedicated toolbar for desktop / tablet view inside workspace.
 *
 * 右上角提供当前会话的操作：置顶、重命名、删除。
 */
export const DesktopChatHeader: React.FC<DesktopChatHeaderProps> = ({
  currentModel,
  onModelChange,
  availableModels,
  onRefreshModels,
  isRefreshingModels = false,
  activeConversation,
  onTogglePin,
  onRename,
  onDelete,
  className,
  isVocabMode = false,
}) => {
  const { t } = useI18n();
  const [isRenaming, setIsRenaming] = React.useState(false);
  const [newTitle, setNewTitle] = React.useState("");
  const { ask, dialog } = useConfirm();

  const handleStartRename = () => {
    if (!activeConversation) return;
    setNewTitle(activeConversation.title || "");
    setIsRenaming(true);
  };

  const handleConfirmRename = () => {
    if (activeConversation && onRename && newTitle.trim()) {
      onRename(activeConversation.id, newTitle.trim());
    }
    setIsRenaming(false);
  };

  const isPinned = !!activeConversation?.is_pinned;

  return (
    <>
      <header
        className={cn(
          "z-20 hidden h-[var(--toolbar-h)] shrink-0 select-none flex-nowrap items-center justify-between gap-2 border-b border-border/40 bg-background/80 px-4 backdrop-blur-xl md:flex md:min-w-0",
          className
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="hidden shrink-0 whitespace-nowrap text-xs font-medium text-muted-foreground lg:inline">
            {t("chat.header.currentModel")}
          </span>

          <div className="flex min-w-0 items-center">
            <ModelSelect
              value={currentModel}
              onChange={onModelChange}
              models={availableModels}
              variant="compact"
              isVocabMode={isVocabMode}
            />
          </div>
        </div>

        {/* 右上角操作区：置顶、重命名、删除 */}
        {activeConversation && (
          <div className="flex shrink-0 items-center gap-1.5">
            {onTogglePin && (
              <ActionTooltip label={isPinned ? t("chat.history.unpin") : t("chat.history.pin")}>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => onTogglePin(activeConversation.id, !isPinned)}
                  className={cn(
                    "h-8 w-8 cursor-pointer transition-colors",
                    isPinned
                      ? "border-primary/40 text-primary hover:bg-primary/10"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                  <span className="sr-only">
                    {isPinned ? t("chat.history.unpin") : t("chat.history.pin")}
                  </span>
                </Button>
              </ActionTooltip>
            )}

            {onRename && (
<ActionTooltip label={t("chat.history.renameTitle")}>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleStartRename}
                  className="h-8 w-8 cursor-pointer text-muted-foreground hover:bg-surface-3 hover:text-foreground"
                >
                  <Pencil className="h-4 w-4" />
                  <span className="sr-only">{t("chat.history.renameTitle")}</span>
                </Button>
              </ActionTooltip>
            )}

            {onDelete && (
              <ActionTooltip label={t("chat.history.deleteConversation")}>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    ask({
                      title: t("chat.history.deleteTitle"),
                      description: t("chat.history.deleteDesc", {
                        title: activeConversation.title || t("chat.history.untitled"),
                      }),
                      confirmText: t("chat.history.delete"),
                      danger: true,
                      onConfirm: () => onDelete(activeConversation.id),
                    })
                  }
                  className="h-8 w-8 cursor-pointer text-muted-foreground hover:border-destructive/40 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">{t("chat.history.deleteConversation")}</span>
                </Button>
              </ActionTooltip>
            )}
          </div>
        )}
      </header>

      {/* 重命名弹窗 */}
      {isRenaming && (
        <Dialog open onOpenChange={(open) => !open && setIsRenaming(false)}>
          <DialogContent className="max-w-sm rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold">
                {t("chat.history.renameTitle")}
              </DialogTitle>
            </DialogHeader>
            <div className="py-2">
              <Label htmlFor="desktop-rename-input" className="sr-only">
                {t("chat.history.renameLabel")}
              </Label>
              <Input
                id="desktop-rename-input"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder={t("chat.history.renamePh")}
                className="h-10 rounded-xl text-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleConfirmRename();
                }}
              />
            </div>
            <DialogFooter className="flex-row justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsRenaming(false)}
                className="rounded-xl"
              >
                {t("common.action.cancel")}
              </Button>
              <Button type="button" size="sm" onClick={handleConfirmRename} className="rounded-xl">
                {t("common.action.save")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {dialog}
    </>
  );
};
