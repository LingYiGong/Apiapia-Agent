"use client";

import React from "react";
import { ModelCatalogItem } from "@/types";
import { ModelSelect } from "@/components/common/ModelSelect";
import { Button } from "@/components/ui/button";
import { ActionTooltip } from "@/components/common/ActionTooltip";
import { UserAvatarMenu } from "@/components/layout/UserAvatarDropdown";
import {
  Brain,
  Pin,
  PinOff,
  Pencil,
  Trash2,
  MoreHorizontal,
  Edit2,
  RefreshCw,
  PanelLeftOpen,
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
  overlaySurfaceClass,
  menuItemDangerClass,
  menuItemClass,
  menuSeparatorClass,
} from "@/components/common/surfaces";

/** 聊天页头部共用 props */
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

/** 桌面端会话操作：置顶、重命名、删除、侧栏收起/展开、记忆库折叠 */
export interface DesktopChatHeaderProps extends ChatHeaderBaseProps {
  activeConversation?: Conversation | null;
  onTogglePin?: (id: string, nextPinned: boolean) => void;
  onRename?: (id: string, newTitle: string) => void;
  onDelete?: (id: string) => void;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  isMemoryOpen?: boolean;
  onToggleMemory?: () => void;
  memoriesCount?: number;
}

/** 移动端聊天顶栏 */
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
        logoAction="new-chat"
        onLogoClick={onNewChat}
        right={
          <div className="flex shrink-0 items-center gap-1">
            {onRefreshModels && (
              <ActionTooltip
                label={
                  isRefreshingModels
                    ? t("settings.sync.syncing")
                    : t("settings.sync.tooltip", { scope: t("settings.modelGroup.language") })
                }
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={isRefreshingModels}
                  onClick={onRefreshModels}
                  className="h-8 w-8 shrink-0 cursor-pointer rounded-full text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground active:scale-95"
                  aria-label={t("settings.sync.sr", { scope: t("settings.modelGroup.language") })}
                >
                  <RefreshCw
                    className={cn(
                      "h-3.5 w-3.5",
                      isRefreshingModels && "animate-spin text-primary"
                    )}
                  />
                </Button>
              </ActionTooltip>
            )}
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
                  <span className="font-mono text-xs font-semibold">{memoriesCount}</span>
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
                <DropdownMenuContent
                  align="end"
                  sideOffset={8}
                  collisionPadding={12}
                  className={overlaySurfaceClass}
                >
                  {onTogglePin && (
                    <DropdownMenuItem
                      onClick={() => onTogglePin(activeConversation.id, !isPinned)}
                      className={menuItemClass}
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
                      className={menuItemClass}
                    >
                      <Edit2 className="h-4 w-4 text-muted-foreground" />
                      <span>{t("chat.history.rename")}</span>
                    </DropdownMenuItem>
                  )}
                  {onDelete && (
                    <>
                      <DropdownMenuSeparator className={menuSeparatorClass} />
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
                        className={menuItemDangerClass}
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

/** 桌面端聊天工具栏 */
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
  isSidebarOpen = true,
  onToggleSidebar,
  isMemoryOpen = false,
  onToggleMemory,
  memoriesCount = 0,
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
          "z-20 hidden h-[var(--toolbar-h)] shrink-0 select-none flex-nowrap items-center justify-between gap-2 border-b border-border/40 bg-background/80 px-3.5 backdrop-blur-xl md:flex md:min-w-0",
          className
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {onToggleSidebar && !isSidebarOpen && (
            <ActionTooltip
              label={t("chat.sidebar.expand")}
              shortcut="⌘B"
            >
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onToggleSidebar}
                className="h-8 w-8 shrink-0 rounded-lg text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground active:scale-95"
                aria-label={t("chat.sidebar.expand")}
              >
                <PanelLeftOpen className="h-4 w-4" />
              </Button>
            </ActionTooltip>
          )}

          <span className="hidden shrink-0 whitespace-nowrap text-xs font-medium text-muted-foreground lg:inline">
            {t("chat.header.currentModel")}
          </span>

          <div className="flex min-w-0 items-center gap-1.5">
            <ModelSelect
              value={currentModel}
              onChange={onModelChange}
              models={availableModels}
              variant="compact"
              isVocabMode={isVocabMode}
            />
            {onRefreshModels && (
              <ActionTooltip
                label={
                  isRefreshingModels
                    ? t("settings.sync.syncing")
                    : t("settings.sync.tooltip", { scope: t("settings.modelGroup.language") })
                }
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={isRefreshingModels}
                  onClick={onRefreshModels}
                  className="h-8 w-8 shrink-0 rounded-lg text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground active:scale-95"
                  aria-label={t("settings.sync.sr", { scope: t("settings.modelGroup.language") })}
                >
                  <RefreshCw
                    className={cn(
                      "h-3.5 w-3.5",
                      isRefreshingModels && "animate-spin text-primary"
                    )}
                  />
                </Button>
              </ActionTooltip>
            )}
          </div>
        </div>

        {/* 右上角操作区：记忆侧栏开关 + 会话操作（置顶、重命名、删除） */}
        <div className="flex shrink-0 items-center gap-1.5">
          {onToggleMemory && (
            <ActionTooltip
              label={isMemoryOpen ? t("chat.recall.collapse") : t("chat.recall.expand")}
            >
              <Button
                type="button"
                variant={isMemoryOpen ? "secondary" : "ghost"}
                size="sm"
                onClick={onToggleMemory}
                className={cn(
                  "h-8 gap-1.5 rounded-lg px-2.5 text-xs text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground active:scale-95",
                  isMemoryOpen && "bg-surface-3 font-semibold text-primary"
                )}
              >
                <Brain className="h-3.5 w-3.5 text-primary" />
                <span className="hidden lg:inline">{t("chat.recall.title")}</span>
                {memoriesCount > 0 && (
                  <span className="font-mono text-2xs rounded-full bg-primary/15 text-primary px-1.5 py-0.5 leading-none font-semibold">
                    {memoriesCount}
                  </span>
                )}
              </Button>
            </ActionTooltip>
          )}

          {activeConversation && (
            <>
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
          </>
        )}
      </div>
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
