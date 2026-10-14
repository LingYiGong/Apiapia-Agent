"use client";

import React, { useState, useMemo } from "react";
import { Conversation } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConversationListSkeleton } from "@/components/common/PageSkeleton";
import { ActionTooltip } from "@/components/common/ActionTooltip";
import { EmptyState } from "@/components/common/EmptyState";
import { useConfirm } from "@/hooks/useConfirm";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { groupByTimeBuckets } from "@/lib/timeGroups";
import {
  Plus,
  Trash2,
  Search,
  Pin,
  PinOff,
  ChevronUp,
  ChevronDown,
  GripVertical,
  Pencil,
  MessageSquare,
  MoreHorizontal,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  overlaySurfaceClass,
  menuItemDangerClass,
  menuItemClass,
  menuSeparatorClass,
} from "@/components/common/surfaces";

interface SidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string, nextPinned: boolean) => void;
  onMovePinned: (id: string, direction: "up" | "down") => void;
  onReorderPinned: (orderedIds: string[]) => void;
  onRename: (id: string, newTitle: string) => void;
  loading?: boolean;
}

/** 会话的最后活跃时间（排序与分组的唯一时间口径）。 */
const activityOf = (c: Conversation) =>
  new Date(c.last_message_at || c.created_at || 0).getTime();

export const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  activeId,
  onSelect,
  onNewChat,
  onDelete,
  onTogglePin,
  onMovePinned,
  onReorderPinned,
  onRename,
  loading = false,
}) => {
  const [search, setSearch] = useState("");
  const { t, fmt } = useI18n();
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);
  // 行内重命名的目标 id
  const [renamingId, setRenamingId] = useState<string | null>(null);

  // 删除确认走统一的 useConfirm —— 此前这里是内联的一段 pendingDelete +
  // <ConfirmDialog> 样板，与 MobileHistoryView 的那份逐字相同。
  const { ask, dialog } = useConfirm();

  const query = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!query) return conversations;
    return conversations.filter((c) => (c.title || "").toLowerCase().includes(query));
  }, [conversations, query]);

  const isSearching = query.length > 0;

  const groupedSections = useMemo(
    () =>
      groupByTimeBuckets<Conversation>(filtered, {
        t,
        getTime: activityOf,
        isPinned: (c) => !!c.is_pinned,
        getPinOrder: (c) => c.pin_order ?? 0,
        pinnedTitleKey: "chat.history.pinned",
      }),
    [filtered, t]
  );

  const pinnedItems = useMemo(
    () => groupedSections.find((s) => s.key === "pinned")?.items ?? [],
    [groupedSections]
  );

  const handleDropOnPinned = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const ids = pinnedItems.map((c) => c.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    onReorderPinned(ids);
  };

  /**
   * 键盘可达性：整行的 onClick 只服务鼠标，此前键盘用户**完全无法打开任何会话**。
   * 所以重命名态之外，标题渲染成一个真正的 <button>：Enter / Space 由原生行为处理，
   * aria-current 标记当前会话。外层 div 仍保留 onClick 以维持「点行内任意处都能
   * 打开」的手感；button 侧 stopPropagation 避免同一次点击触发两次。
   *
   * 不给外层加 role="button"：行内还嵌着 4 个操作按钮，而 button 角色不允许
   * 交互后代，那样会破坏 a11y 树。
   */
  const renderRow = (
    c: Conversation,
    opts: { showSortControls: boolean; isFirst: boolean; isLast: boolean }
  ) => {
    const isSelected = c.id === activeId;
    const timeDisplay = fmt.dateTime(c.last_message_at || c.created_at);
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
        onClick={() => onSelect(c.id)}
        className={cn(
          "group flex items-center gap-1 rounded-xl border px-2.5 py-2 text-footnote transition-colors",
          isSelected
            ? "border-border/70 bg-card text-foreground shadow-xs dark:bg-surface-3"
            : "border-transparent text-muted-foreground hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10",
          dragId === c.id && "opacity-50",
          dropId === c.id && dragId !== c.id && "ring-1 ring-primary"
        )}
      >
        {opts.showSortControls && (
          // 不包 ActionTooltip：TooltipTrigger asChild 会给这个 span 加上
          // tabindex，于是产生一个可聚焦却没有任何键盘行为的元素（违反 WCAG 2.1.1），
          // 键盘用户会 Tab 到这里然后不知道该按什么。装饰性元素改用原生 title。
          <span
            title={t("chat.history.dragHint")}
            onClick={(e) => e.stopPropagation()}
            className="shrink-0 cursor-grab text-muted-foreground/60 hover:text-foreground active:cursor-grabbing"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </span>
        )}

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {renamingId === c.id ? (
            <input
              autoFocus
              defaultValue={c.title || ""}
              onClick={(e) => e.stopPropagation()}
              onBlur={(e) => {
                const next = e.target.value.trim();
                setRenamingId(null);
                if (next && next !== c.title) onRename(c.id, next);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") setRenamingId(null);
              }}
aria-label={t("chat.history.renameTitle")}
               className="w-full border-b border-primary/50 bg-transparent px-0 py-0.5 text-footnote text-foreground outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(c.id);
              }}
              aria-current={isSelected ? "true" : undefined}
title={c.title || t("chat.history.untitled")}
               className="flex w-full min-w-0 items-center gap-1.5 text-left leading-snug"
             >
              {pinnedActive && <Pin className="h-3 w-3 shrink-0 text-primary" />}
              <span className="min-w-0 flex-1 truncate font-normal">
                {c.title || t("chat.history.untitled")}
              </span>
            </button>
          )}
          {timeDisplay && (
            <span className="mt-0.5 truncate font-mono text-2xs text-muted-foreground select-none">
              {timeDisplay}
            </span>
          )}
        </div>

        {/* 右侧操作区：三点菜单，仅在鼠标悬停当前行或菜单展开时显示 */}
        <div className="relative z-10 ml-1 flex shrink-0 items-center gap-0.5">
          {opts.showSortControls && (
            <span
              className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100"
              onClick={(e) => e.stopPropagation()}
            >
              <ActionTooltip label={t("chat.history.moveUp")} side="top">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={opts.isFirst}
                  onClick={() => onMovePinned(c.id, "up")}
                  className="h-7 w-6 shrink-0 hover:text-primary disabled:opacity-30"
                >
                  <ChevronUp className="h-4 w-4" />
                  <span className="sr-only">{t("chat.history.moveUp")}</span>
                </Button>
              </ActionTooltip>
              <ActionTooltip label={t("chat.history.moveDown")} side="top">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={opts.isLast}
                  onClick={() => onMovePinned(c.id, "down")}
                  className="h-7 w-6 shrink-0 hover:text-primary disabled:opacity-30"
                >
                  <ChevronDown className="h-4 w-4" />
                  <span className="sr-only">{t("chat.history.moveDown")}</span>
                </Button>
              </ActionTooltip>
            </span>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={(e) => e.stopPropagation()}
                aria-label={t("chat.history.actions")}
                className="h-7 w-7 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:bg-muted/60 hover:text-foreground group-hover:opacity-100 data-[state=open]:opacity-100"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={8}
              collisionPadding={12}
              onClick={(e) => e.stopPropagation()}
              className={overlaySurfaceClass}
            >
              <DropdownMenuItem
                onClick={() => onTogglePin(c.id, !pinnedActive)}
                className={menuItemClass}
              >
                {pinnedActive ? (
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

              <DropdownMenuItem
                onClick={() => setRenamingId(c.id)}
                className={menuItemClass}
              >
                <Pencil className="h-4 w-4 text-muted-foreground" />
                <span>{t("chat.history.rename")}</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator className={menuSeparatorClass} />

              <DropdownMenuItem
                onClick={() =>
                  ask({
                    title: t("chat.history.deleteTitle"),
                    description: t("chat.history.deleteDesc", {
                      title: c.title || t("chat.history.untitled"),
                    }),
                    confirmText: t("chat.history.delete"),
                    danger: true,
                    onConfirm: () => onDelete(c.id),
                  })
                }
                className={menuItemDangerClass}
              >
                <Trash2 className="h-4 w-4" />
                <span>{t("chat.history.deleteConversation")}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Desktop Persistent Sidebar.
          移动端历史是独立的全屏页签（MobileHistoryView），不再走 Sheet 抽屉 ——
          之前那条分支的 isOpen 被 chat/page.tsx 硬编码成 false，永远打不开，
          连同里面的抓手与关闭按钮一起都是不可达代码。 */}
      <aside className="hidden h-full w-[var(--sidebar-w)] shrink-0 flex-col border-r border-border/70 bg-surface-1 md:flex lg:w-[var(--sidebar-w-lg)]">
        {/* Header with Search */}
        <div className="flex flex-col gap-2 border-b border-border/50 p-3">
          <Button type="button" onClick={onNewChat} className="w-full">
            <Plus className="h-4 w-4" />
            <span>{t("chat.history.newChat")}</span>
          </Button>

          <div className="relative">
            <Label htmlFor="sidebar-search" className="sr-only">
              {t("chat.history.search")}
            </Label>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="sidebar-search"
              type="search"
              placeholder={t("chat.history.searchMobilePh")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              // pr-9：给浏览器内置清除按钮（本项目已在 globals.css 隐藏）
              // 留位。桌面侧栏此前没有自绘清除键，输入后无法一键清空。
              className="border-border/60 bg-background pl-9 text-xs dark:bg-surface-2"
            />
          </div>
        </div>

        {/* 历史列表：原生滚动容器 */}
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain p-2">
          {loading ? (
            <ConversationListSkeleton rows={8} />
          ) : filtered.length === 0 ? (
            <EmptyState
              className="py-10"
              icon={MessageSquare}
              iconClassName="h-11 w-11"
              title={isSearching ? t("chat.history.noResultsTitle") : t("chat.history.emptyTitle")}
              description={
                isSearching ? t("chat.history.noResultsDesc") : t("chat.history.emptyDesc")
              }
            />
          ) : (
            <div className="space-y-4">
              {groupedSections.map((sec, secIdx) => (
                <div key={sec.key} className={cn("space-y-1", secIdx > 0 && "pt-3")}>
                  <div className="flex items-center justify-between px-3 pb-1 text-2xs font-semibold tracking-wider text-muted-foreground select-none">
                    <span className="flex items-center gap-1">
                      {sec.key === "pinned" && <Pin className="h-3 w-3 text-primary" />}
                      <span>
                        {sec.key === "pinned"
                          ? isSearching
                            ? t("chat.history.pinned")
                            : t("chat.history.pinnedDraggable", { count: sec.items.length })
                          : sec.title}
                      </span>
                    </span>
                    {(sec.key !== "pinned" || isSearching) && (
                      <span className="font-mono text-2xs opacity-60">({sec.items.length})</span>
                    )}
                  </div>
                  {sec.items.map((c, idx) =>
                    renderRow(c, {
                      showSortControls: sec.key === "pinned" && !isSearching,
                      isFirst: idx === 0,
                      isLast: idx === sec.items.length - 1,
                    })
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>

      {dialog}
    </>
  );
};
