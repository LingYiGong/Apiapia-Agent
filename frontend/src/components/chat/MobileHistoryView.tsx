"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Conversation } from "@/types";
import { Plus, Pin, X, Search, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionTooltip } from "@/components/common/ActionTooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/common/EmptyState";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { UserAvatarMenu } from "@/components/layout/UserAvatarDropdown";
import { SwipeableConversationCard } from "@/components/chat/SwipeableConversationCard";
import { usePinnedDragReorder } from "@/components/chat/usePinnedDragReorder";
import { useConfirm } from "@/hooks/useConfirm";
import { formatRelativeTime } from "@/lib/format";
import { groupByTimeBuckets } from "@/lib/timeGroups";
import type { MobileTab } from "@/config/navigation";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface MobileHistoryViewProps {
  conversations: Conversation[];
  activeId: string | null;
  isVisible?: boolean;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onDelete: (id: string) => void;
  onTogglePin?: (id: string) => void;
  onRename?: (id: string, newTitle: string) => void;
  onMovePinned?: (id: string, direction: "up" | "down") => void;
  onReorderPinned?: (orderedIds: string[]) => void;
  onSelectMobileTab?: (tab: MobileTab) => void;
}

const activityOf = (c: Conversation) =>
  new Date(c.last_message_at || c.created_at || 0).getTime();

export const MobileHistoryView = ({
  conversations,
  activeId,
  isVisible = true,
  onSelect,
  onNewChat,
  onDelete,
  onTogglePin,
  onRename,
  onMovePinned,
  onReorderPinned,
  onSelectMobileTab,
}: MobileHistoryViewProps) => {
  const [search, setSearch] = useState("");
  const [editingConv, setEditingConv] = useState<Conversation | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [activeOpenId, setActiveOpenId] = useState<string | null>(null);

  const { ask, dialog } = useConfirm();

  const handleSelect = (id: string) => {
    setActiveOpenId(null);
    onSelect(id);
  };

  // 搜索过滤
  const filteredList = useMemo(() => {
    if (!search.trim()) return conversations;
    const query = search.toLowerCase().trim();
    return conversations.filter(
      (c) =>
        (c.title && c.title.toLowerCase().includes(query)) ||
        (c.model && c.model.toLowerCase().includes(query))
    );
  }, [conversations, search]);

  // 置顶 / 今天 / 过去 7 天 / 更早 —— 与桌面侧栏、记忆库共用 lib/timeGroups
  const groupedSections = useMemo(
    () =>
      groupByTimeBuckets<Conversation>(filteredList, {
        getTime: activityOf,
        isPinned: (c) => !!c.is_pinned,
        getPinOrder: (c) => c.pin_order ?? 0,
      }),
    [filteredList]
  );

  const pinnedItems = useMemo(
    () => groupedSections.find((s) => s.key === "pinned")?.items ?? [],
    [groupedSections]
  );

  const {
    draggingId,
    dragDeltaY,
    shiftFor,
    startDrag,
    cancel: cancelDrag,
  } = usePinnedDragReorder(pinnedItems, onReorderPinned);

  // 离开面板时全面复位滑动/拖拽状态，杜绝样式卡死
  useEffect(() => {
    if (!isVisible) {
      setActiveOpenId(null);
      cancelDrag();
    }
  }, [isVisible, cancelDrag]);

  useEffect(() => {
    setActiveOpenId(null);
  }, [activeId]);

  const handleStartRename = (c: Conversation) => {
    setEditingConv(c);
    setNewTitle(c.title || "");
  };

  const handleConfirmRename = () => {
    if (editingConv && onRename && newTitle.trim()) {
      onRename(editingConv.id, newTitle.trim());
    }
    setEditingConv(null);
  };

  const requestDelete = (c: Conversation) =>
    ask({
      title: "删除该历史会话",
      description: `确定要删除对话「${c.title || "新建对话"}」吗？删除后将无法恢复，该操作不可撤销。`,
      confirmText: "删除",
      danger: true,
      onConfirm: () => onDelete(c.id),
    });

  return (
    <div className="relative flex h-full flex-1 flex-col overflow-hidden bg-background">
      <MobileHeader
        title="历史会话"
        onSelectMobileTab={onSelectMobileTab}
        right={
          <div className="flex items-center gap-1">
            <ActionTooltip label="新建对话">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onNewChat}
                className="h-8 w-8 cursor-pointer rounded-full text-foreground transition-colors hover:bg-surface-3/80 active:scale-95"
              >
                <Plus className="h-4 w-4" />
                <span className="sr-only">新建对话</span>
              </Button>
            </ActionTooltip>
            <UserAvatarMenu onSelectMobileTab={onSelectMobileTab} />
          </div>
        }
      />

      {/* 搜索栏 */}
      <div className="shrink-0 border-b border-border/30 bg-background/50 px-3.5 py-2 backdrop-blur-md">
        <div className="relative">
          <Label htmlFor="history-search" className="sr-only">
            搜索历史记录
          </Label>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="history-search"
            type="search"
            placeholder="搜索历史记录..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            // pl-9/pr-9 与图标（left-3，14px）和清除键（right-2.5）对齐；
            // 此前 pl-8/pr-8 配 14px 图标，输入的文字会压到图标上。
            className="h-9 rounded-xl border-border/40 bg-surface-3/50 pl-9 pr-9 text-footnote focus-visible:bg-background"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="清除搜索"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 列表 */}
      <div
        onScroll={() => {
          if (activeOpenId) setActiveOpenId(null);
        }}
        className="flex-1 overflow-y-auto px-4 pb-4 pt-3 overscroll-contain"
      >
        {filteredList.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title={search ? "未找到匹配的历史对话" : "暂无历史对话"}
            description={
              search
                ? "换个关键词试试，或清除搜索框。"
                : "在聊天界面发送一条消息，它将自动保存在这里。"
            }
            actionLabel={search ? undefined : "开启新对话"}
            actionIcon={Plus}
            onAction={search ? undefined : onNewChat}
          />
        ) : (
          <div className="space-y-5">
            {groupedSections.map((sec) => (
              <div key={sec.key} className="space-y-1.5">
                <div className="flex items-center justify-between px-1">
                  <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground select-none">
                    {sec.key === "pinned" && <Pin className="h-3 w-3 text-primary" />}
                    <span>{sec.title}</span>
                    <span className="font-mono text-2xs opacity-60">({sec.items.length})</span>
                  </span>
                </div>

                {/* space-y-1.5（6px）必须与 usePinnedDragReorder 的 ITEM_STEP
                    里扣掉的 LIST_GAP 一致，否则拖拽位移会错位。 */}
                <div className="space-y-1.5">
                  {sec.items.map((c, idx) => (
                    <SwipeableConversationCard
                      key={c.id}
                      conversation={c}
                      isSelected={c.id === activeId}
                      timeStr={formatRelativeTime(c.last_message_at || c.created_at)}
                      onSelect={() => handleSelect(c.id)}
                      onDelete={() => requestDelete(c)}
                      onTogglePin={onTogglePin ? () => onTogglePin(c.id) : undefined}
                      onRename={onRename ? () => handleStartRename(c) : undefined}
                      onMoveUp={
                        sec.key === "pinned" && onMovePinned ? () => onMovePinned(c.id, "up") : undefined
                      }
                      onMoveDown={
                        sec.key === "pinned" && onMovePinned
                          ? () => onMovePinned(c.id, "down")
                          : undefined
                      }
                      isFirstPinned={sec.key === "pinned" && idx === 0}
                      isLastPinned={sec.key === "pinned" && idx === sec.items.length - 1}
                      onStartDrag={
                        sec.key === "pinned" && onReorderPinned && sec.items.length > 1
                          ? (clientY) => startDrag(c.id, idx, clientY)
                          : undefined
                      }
                      isDraggingThis={c.id === draggingId}
                      dragShiftY={sec.key === "pinned" ? shiftFor(c.id, idx) : 0}
                      dragDeltaY={dragDeltaY}
                      activeOpenId={activeOpenId}
                      setActiveOpenId={setActiveOpenId}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 重命名对话框 */}
      {editingConv && (
        <Dialog open onOpenChange={(open) => !open && setEditingConv(null)}>
          <DialogContent className="max-w-sm rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold">重命名对话</DialogTitle>
            </DialogHeader>
            <div className="py-2">
              <Label htmlFor="rename-conversation-input" className="sr-only">
                新标题
              </Label>
              <Input
                id="rename-conversation-input"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="请输入新标题"
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
                onClick={() => setEditingConv(null)}
                className="rounded-xl"
              >
                取消
              </Button>
              <Button type="button" size="sm" onClick={handleConfirmRename} className="rounded-xl">
                保存
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {dialog}
    </div>
  );
};
