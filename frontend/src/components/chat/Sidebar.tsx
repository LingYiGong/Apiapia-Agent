"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Conversation } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ConversationListSkeleton } from "@/components/common/PageSkeleton";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { ActionTooltip } from "@/components/common/ActionTooltip";
import { cn } from "@/lib/utils";
import {
  Plus,
  Trash2,
  Search,
  X,
  Brain,
  Settings,
  BarChart3,
  Pin,
  PinOff,
  ChevronUp,
  ChevronDown,
  GripVertical,
} from "lucide-react";

interface SidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string, nextPinned: boolean) => void;
  onMovePinned: (id: string, direction: "up" | "down") => void;
  onReorderPinned: (orderedIds: string[]) => void;
  isOpen?: boolean;
  onClose?: () => void;
  loading?: boolean;
}

function formatFullDateTime(isoStr?: string) {
  if (!isoStr) return "";
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return "";
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const seconds = String(d.getSeconds()).padStart(2, "0");
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  } catch {
    return "";
  }
}

function sortConversations(list: Conversation[]): Conversation[] {
  return [...list].sort((a, b) => {
    const aPinned = !!a.is_pinned;
    const bPinned = !!b.is_pinned;
    if (aPinned !== bPinned) return aPinned ? -1 : 1;
    if (aPinned && bPinned) {
      const orderDiff = (a.pin_order ?? 0) - (b.pin_order ?? 0);
      if (orderDiff !== 0) return orderDiff;
    }
    const timeA = new Date(a.updated_at || a.created_at || 0).getTime();
    const timeB = new Date(b.updated_at || b.created_at || 0).getTime();
    return timeB - timeA;
  });
}

export const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  activeId,
  onSelect,
  onNewChat,
  onDelete,
  onTogglePin,
  onMovePinned,
  onReorderPinned,
  isOpen = false,
  onClose,
  loading = false,
}) => {
  const [search, setSearch] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);
  // 待删除会话（二次确认框状态，点击删除按钮后先弹窗，不直接删除）
  const [pendingDelete, setPendingDelete] = useState<Conversation | null>(null);

  const sorted = sortConversations(conversations);

  const filtered = sorted.filter((c) =>
    (c.title || "").toLowerCase().includes(search.toLowerCase())
  );

  const isSearching = search.trim().length > 0;
  const pinned = filtered.filter((c) => c.is_pinned);
  const unpinned = filtered.filter((c) => !c.is_pinned);

  const handleSelectConv = (id: string) => {
    onSelect(id);
    onClose?.();
  };

  const handleNewChatClick = () => {
    onNewChat();
    onClose?.();
  };

  const handleDropOnPinned = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const ids = pinned.map((c) => c.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    onReorderPinned(ids);
  };

  const renderRow = (
    c: Conversation,
    opts: { showSortControls: boolean; isFirst: boolean; isLast: boolean }
  ) => {
    const isSelected = c.id === activeId;
    const timeDisplay = formatFullDateTime(c.updated_at || c.created_at);
    const pinnedActive = !!c.is_pinned;
    return (
      <div
        key={c.id}
        draggable={opts.showSortControls}
        onDragStart={(e) => {
          if (!opts.showSortControls) return;
          setDragId(c.id);
          e.dataTransfer.effectAllowed = "move";
        }}
        onDragEnd={() => {
          setDragId(null);
          setDropId(null);
        }}
        onDragOver={(e) => {
          if (!opts.showSortControls || !dragId) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          setDropId(c.id);
        }}
        onDragLeave={() => {
          setDropId((prev) => (prev === c.id ? null : prev));
        }}
        onDrop={(e) => {
          if (!opts.showSortControls) return;
          e.preventDefault();
          handleDropOnPinned(c.id);
          setDragId(null);
          setDropId(null);
        }}
        onClick={() => handleSelectConv(c.id)}
        className={cn(
          "group flex items-center gap-1 px-2.5 py-2 rounded-xl cursor-pointer text-xs transition-all border",
          isSelected
            ? "bg-card dark:bg-[#2c2c2e] text-foreground font-medium shadow-xs border-border/70"
            : "text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 border-transparent",
          dragId === c.id && "opacity-50",
          dropId === c.id && dragId !== c.id && "ring-1 ring-primary"
        )}
      >
        {opts.showSortControls && (
          <ActionTooltip label="拖拽排序" side="top">
            <span
              className="cursor-grab active:cursor-grabbing text-muted-foreground/60 hover:text-foreground shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="h-3.5 w-3.5" />
            </span>
          </ActionTooltip>
        )}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <span
            className="flex min-w-0 items-center gap-1.5 leading-snug"
            title={c.title || "新建对话"}
          >
            {pinnedActive && <Pin className="h-3 w-3 shrink-0 text-primary" />}
            <span className="min-w-0 flex-1 truncate">{c.title || "新建对话"}</span>
          </span>
          {timeDisplay && (
            <span className="text-[10px] text-muted-foreground font-mono mt-0.5 select-none truncate">
              {timeDisplay}
            </span>
          )}
        </div>

        {/* 右侧操作区：常驻可见，relative + z-10 确保盖住滚动条等 overlay，不被遮挡 */}
        <div className="relative z-10 flex items-center gap-0.5 ml-1 shrink-0">
          {opts.showSortControls ? (
            <span className="flex items-center shrink-0" onClick={(e) => e.stopPropagation()}>
              <ActionTooltip label="上移" side="top">
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={opts.isFirst}
                  onClick={() => onMovePinned(c.id, "up")}
                  className="h-7 w-6 shrink-0 hover:text-primary disabled:opacity-30"
                >
                  <ChevronUp className="h-4 w-4" />
                  <span className="sr-only">上移</span>
                </Button>
              </ActionTooltip>
              <ActionTooltip label="下移" side="top">
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={opts.isLast}
                  onClick={() => onMovePinned(c.id, "down")}
                  className="h-7 w-6 shrink-0 hover:text-primary disabled:opacity-30"
                >
                  <ChevronDown className="h-4 w-4" />
                  <span className="sr-only">下移</span>
                </Button>
              </ActionTooltip>
            </span>
          ) : null}
          <ActionTooltip label={pinnedActive ? "取消置顶" : "置顶"} side="top">
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin(c.id, !pinnedActive);
              }}
              className={cn(
                "h-7 w-7 shrink-0 hover:text-primary",
                pinnedActive ? "opacity-100 text-primary" : "opacity-60 hover:opacity-100"
              )}
            >
              {pinnedActive ? (
                <PinOff className="h-4 w-4" />
              ) : (
                <Pin className="h-4 w-4" />
              )}
              <span className="sr-only">{pinnedActive ? "取消置顶" : "置顶"}</span>
            </Button>
          </ActionTooltip>
          <ActionTooltip label="删除对话" side="top">
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                setPendingDelete(c);
              }}
              className="h-7 w-7 shrink-0 opacity-60 hover:opacity-100 hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              <span className="sr-only">删除对话</span>
            </Button>
          </ActionTooltip>
        </div>
      </div>
    );
  };

  const sidebarBody = (isMobile: boolean) => (
    <>
      {/* Header with Quick Jump & Search */}
      <div className="p-3 pt-[max(0.75rem,env(safe-area-inset-top))] md:pt-3 border-b flex flex-col gap-2">
        {isMobile && (
          <div className="flex items-center justify-between pb-1 border-b">
            <span className="text-xs font-bold">
              历史对话
            </span>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
              <X className="h-4 w-4" />
              <span className="sr-only">关闭</span>
            </Button>
          </div>
        )}

        {/* Quick Page Jump for Mobile */}
        {isMobile && (
          <div className="grid grid-cols-3 gap-1 pb-2 border-b">
            <Link
              href="/memory"
              onClick={onClose}
              className="flex flex-col items-center py-1.5 px-1 rounded-lg text-[10px] font-medium text-muted-foreground hover:text-primary hover:bg-accent transition-colors"
            >
              <Brain className="h-4 w-4 mb-0.5 text-primary" />
              <span>记忆库</span>
            </Link>
            <Link
              href="/usage"
              onClick={onClose}
              className="flex flex-col items-center py-1.5 px-1 rounded-lg text-[10px] font-medium text-muted-foreground hover:text-primary hover:bg-accent transition-colors"
            >
              <BarChart3 className="h-4 w-4 mb-0.5 text-primary" />
              <span>用量</span>
            </Link>
            <Link
              href="/settings"
              onClick={onClose}
              className="flex flex-col items-center py-1.5 px-1 rounded-lg text-[10px] font-medium text-muted-foreground hover:text-primary hover:bg-accent transition-colors"
            >
              <Settings className="h-4 w-4 mb-0.5 text-primary" />
              <span>设置</span>
            </Link>
          </div>
        )}

        <Button onClick={handleNewChatClick} className="w-full">
          <Plus className="h-4 w-4" />
          <span>新建对话</span>
        </Button>

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            type="search"
            placeholder="搜索历史对话..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 text-xs bg-background dark:bg-[#1c1c1e] border-border/60"
          />
        </div>
      </div>

      {/* 历史列表：原生滚动容器 */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain p-2">
        <div className="space-y-1">
          {loading ? (
            <ConversationListSkeleton rows={8} />
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground">
              {search ? "未找到匹配会话" : "暂无历史对话"}
            </div>
          ) : isSearching ? (
            filtered.map((c) =>
              renderRow(c, { showSortControls: false, isFirst: true, isLast: true })
            )
          ) : (
            <>
              {pinned.length > 0 && (
                <div className="space-y-1">
                  <div className="px-3 pt-1 pb-0.5 text-[10px] font-semibold tracking-wider text-muted-foreground select-none">
                    置顶（{pinned.length}，可拖拽排序）
                  </div>
                  {pinned.map((c, idx) =>
                    renderRow(c, {
                      showSortControls: true,
                      isFirst: idx === 0,
                      isLast: idx === pinned.length - 1,
                    })
                  )}
                  {unpinned.length > 0 && (
                    <div className="px-3 pt-2 pb-0.5 text-[10px] font-semibold tracking-wider text-muted-foreground select-none border-t border-border/60 mt-2">
                      全部对话
                    </div>
                  )}
                </div>
              )}
              {unpinned.map((c) =>
                renderRow(c, { showSortControls: false, isFirst: true, isLast: true })
              )}
            </>
          )}
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:flex md:w-64 lg:w-72 flex-col border-r border-border/70 bg-muted/30 dark:bg-[#121214] h-full shrink-0">
        {sidebarBody(false)}
      </aside>

      {/* Mobile Drawer via standard shadcn Sheet */}
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose?.()}>
        <SheetContent side="left" className="p-0 w-[84vw] max-w-xs flex flex-col h-full bg-background dark:bg-[#121214] border-r border-border/70 [&>button]:hidden">
          {sidebarBody(true)}
        </SheetContent>
      </Sheet>

      {/* 删除历史会话二次确认 */}
      {pendingDelete && (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setPendingDelete(null);
          }}
          title="删除该历史会话"
          description={`确定要删除对话「${pendingDelete.title || "新建对话"}」吗？删除后将无法恢复，该操作不可撤销。`}
          confirmText="删除"
          danger
          onConfirm={() => {
            onDelete(pendingDelete.id);
            setPendingDelete(null);
          }}
        />
      )}
    </>
  );
};
