"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { Conversation } from "@/types";
import {
  Search,
  Plus,
  Pin,
  PinOff,
  Trash2,
  Edit2,
  Clock,
  MessageSquare,
  ChevronRight,
  MoreHorizontal,
  X,
  ChevronUp,
  ChevronDown,
  GripVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { MobileHeader } from "@/components/layout/MobileHeader";

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
}

function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffDay > 30) {
      return `${d.getMonth() + 1}月${d.getDate()}日`;
    }
    if (diffDay > 0) return `${diffDay}天前`;
    if (diffHour > 0) return `${diffHour}小时前`;
    if (diffMin > 0) return `${diffMin}分钟前`;
    return "刚刚";
  } catch {
    return "";
  }
}

interface SwipeableCardProps {
  conversation: Conversation;
  isSelected: boolean;
  timeStr: string;
  onSelect: () => void;
  onDelete: () => void;
  onTogglePin?: () => void;
  onRename?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isFirstPinned?: boolean;
  isLastPinned?: boolean;
  onStartDrag?: (clientY: number) => void;
  isDraggingThis?: boolean;
  dragShiftY?: number;
  dragDeltaY?: number;
  activeOpenId: string | null;
  setActiveOpenId: (id: string | null) => void;
}

const BUTTON_WIDTH = 76;
const FULL_SWIPE_THRESHOLD = 135;

const SwipeableConversationCard = ({
  conversation: c,
  isSelected,
  timeStr,
  onSelect,
  onDelete,
  onTogglePin,
  onRename,
  onMoveUp,
  onMoveDown,
  isFirstPinned,
  isLastPinned,
  onStartDrag,
  isDraggingThis = false,
  dragShiftY = 0,
  dragDeltaY = 0,
  activeOpenId,
  setActiveOpenId,
}: SwipeableCardProps) => {
  const isOpen = activeOpenId === c.id;
  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const currentOffsetRef = useRef(0);
  const isHorizontalRef = useRef<boolean | null>(null);
  const isSwipingRef = useRef(false);
  const swipeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // When another item is opened or closed externally, reset offset
  useEffect(() => {
    if (!isOpen && offset !== 0) {
      setOffset(0);
      currentOffsetRef.current = 0;
    }
  }, [isOpen]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isDraggingThis) return;
    startXRef.current = e.touches[0].clientX;
    startYRef.current = e.touches[0].clientY;
    currentOffsetRef.current = offset;
    isHorizontalRef.current = null;
    isSwipingRef.current = false;
    if (swipeTimeoutRef.current) {
      clearTimeout(swipeTimeoutRef.current);
      swipeTimeoutRef.current = null;
    }
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDraggingThis) return;
    const touch = e.touches[0];
    const diffX = touch.clientX - startXRef.current;
    const diffY = touch.clientY - startYRef.current;

    // Disambiguate vertical scroll vs horizontal swipe
    if (isHorizontalRef.current === null) {
      if (Math.abs(diffY) > 8 && Math.abs(diffY) > Math.abs(diffX)) {
        isHorizontalRef.current = false;
        return;
      }
      if (Math.abs(diffX) > 8 && Math.abs(diffX) > Math.abs(diffY)) {
        isHorizontalRef.current = true;
      }
    }

    if (isHorizontalRef.current !== true) return;
    isSwipingRef.current = true;

    let target = currentOffsetRef.current + diffX;
    // Apply smooth resistance beyond BUTTON_WIDTH
    if (target > BUTTON_WIDTH) {
      target = BUTTON_WIDTH + (target - BUTTON_WIDTH) * 0.35;
    } else if (target < -BUTTON_WIDTH) {
      target = -BUTTON_WIDTH + (target + BUTTON_WIDTH) * 0.35;
    }

    setOffset(target);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    if (isHorizontalRef.current !== true) return;

    if (isSwipingRef.current) {
      if (swipeTimeoutRef.current) clearTimeout(swipeTimeoutRef.current);
      swipeTimeoutRef.current = setTimeout(() => {
        isSwipingRef.current = false;
      }, 300);
    }

    // Full swipe right -> toggle pin
    if (offset > FULL_SWIPE_THRESHOLD) {
      onTogglePin?.();
      setOffset(0);
      currentOffsetRef.current = 0;
      setActiveOpenId(null);
      return;
    }

    // Full swipe left -> delete
    if (offset < -FULL_SWIPE_THRESHOLD) {
      onDelete();
      setOffset(0);
      currentOffsetRef.current = 0;
      setActiveOpenId(null);
      return;
    }

    // Partial swipe: snap open button or close
    if (offset > 36) {
      setOffset(BUTTON_WIDTH);
      currentOffsetRef.current = BUTTON_WIDTH;
      setActiveOpenId(c.id);
    } else if (offset < -36) {
      setOffset(-BUTTON_WIDTH);
      currentOffsetRef.current = -BUTTON_WIDTH;
      setActiveOpenId(c.id);
    } else {
      setOffset(0);
      currentOffsetRef.current = 0;
      if (isOpen) setActiveOpenId(null);
    }
  };

  const handleCardClick = () => {
    // 滑动过程中或未复位时，拦截点击，不进入会话
    if (isSwipingRef.current || offset !== 0) {
      if (offset !== 0) {
        setOffset(0);
        currentOffsetRef.current = 0;
        setActiveOpenId(null);
      }
      return;
    }
    onSelect();
  };

  return (
    <div
      style={{
        transform: isDraggingThis
          ? `translateY(${dragDeltaY}px) scale(1.025)`
          : dragShiftY
          ? `translateY(${dragShiftY}px)`
          : undefined,
        transition: isDraggingThis ? "none" : "transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)",
        zIndex: isDraggingThis ? 40 : 1,
      }}
      className={cn(
        "relative rounded-2xl select-none touch-pan-y",
        isDraggingThis && "shadow-2xl ring-2 ring-primary/50"
      )}
    >
      {/* ── Leading Action Behind Card: Swipe Right -> Pin / Unpin ── */}
      <div
        className={cn(
          "absolute inset-y-0 left-0 flex flex-col items-center justify-center text-white cursor-pointer active:brightness-95 transition-opacity duration-150 z-0 rounded-l-2xl",
          c.is_pinned
            ? "bg-slate-600 dark:bg-slate-700"
            : "bg-amber-500 dark:bg-amber-600",
          offset > 0 ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        style={{ width: `${BUTTON_WIDTH}px` }}
        onClick={(e) => {
          e.stopPropagation();
          onTogglePin?.();
          setOffset(0);
          currentOffsetRef.current = 0;
          setActiveOpenId(null);
        }}
      >
        {c.is_pinned ? (
          <PinOff className="h-5 w-5 mb-0.5" />
        ) : (
          <Pin className="h-5 w-5 mb-0.5" />
        )}
        <span className="text-[11px] font-semibold tracking-tight">
          {c.is_pinned ? "取消置顶" : "置顶"}
        </span>
      </div>

      {/* ── Trailing Action Behind Card: Swipe Left -> Delete ── */}
      <div
        className={cn(
          "absolute inset-y-0 right-0 flex flex-col items-center justify-center text-white bg-red-500 dark:bg-red-600 cursor-pointer active:brightness-95 transition-opacity duration-150 z-0 rounded-r-2xl",
          offset < 0 ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        style={{ width: `${BUTTON_WIDTH}px` }}
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
          setOffset(0);
          currentOffsetRef.current = 0;
          setActiveOpenId(null);
        }}
      >
        <Trash2 className="h-5 w-5 mb-0.5" />
        <span className="text-[11px] font-semibold tracking-tight">删除</span>
      </div>

      {/* ── Foreground Conversation Card ── */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onClick={handleCardClick}
        style={{
          transform: `translateX(${offset}px)`,
          transition: isDragging ? "none" : "transform 0.24s cubic-bezier(0.2, 0.8, 0.2, 1)",
        }}
        className={cn(
          "relative z-10 flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer select-none active:scale-[0.995] bg-card dark:bg-[#1c1c1e]",
          isSelected
            ? "border-primary/40 shadow-xs"
            : "border-border/50 shadow-2xs hover:border-border",
          isDraggingThis && "border-primary/50 shadow-lg"
        )}
      >
        {/* 选中态高亮蒙层：位于不透明卡片之上，绝不穿透到底层按钮 */}
        {isSelected && (
          <div className="absolute inset-0 bg-primary/10 rounded-2xl pointer-events-none z-0" />
        )}
        <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
          <div
            className={cn(
              "h-9 w-9 rounded-xl flex items-center justify-center shrink-0 transition-colors",
              c.is_pinned
                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                : isSelected
                ? "bg-primary/20 text-primary"
                : "bg-muted text-muted-foreground"
            )}
          >
            {c.is_pinned ? (
              <Pin className="h-4 w-4" />
            ) : (
              <MessageSquare className="h-4 w-4" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "text-[15px] font-medium truncate leading-snug",
                  isSelected ? "text-primary font-semibold" : "text-foreground"
                )}
              >
                {c.title || "新建对话"}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground font-mono">
              {timeStr && (
                <span className="flex items-center gap-1 shrink-0">
                  <Clock className="h-3 w-3" />
                  <span>{timeStr}</span>
                </span>
              )}
              {c.model && (
                <span className="truncate max-w-[120px] bg-muted/60 px-1 rounded text-[10px]">
                  {c.model}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Actions Menu & Drag Handle */}
        <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">操作菜单</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40 rounded-xl">
              {c.is_pinned && onMoveUp && (
                <DropdownMenuItem
                  disabled={isFirstPinned}
                  onClick={onMoveUp}
                  className="text-xs cursor-pointer disabled:opacity-35"
                >
                  <ChevronUp className="h-3.5 w-3.5 mr-2" />
                  <span>上移一位</span>
                </DropdownMenuItem>
              )}
              {c.is_pinned && onMoveDown && (
                <DropdownMenuItem
                  disabled={isLastPinned}
                  onClick={onMoveDown}
                  className="text-xs cursor-pointer disabled:opacity-35"
                >
                  <ChevronDown className="h-3.5 w-3.5 mr-2" />
                  <span>下移一位</span>
                </DropdownMenuItem>
              )}
              {c.is_pinned && (onMoveUp || onMoveDown) && <DropdownMenuSeparator />}
              {onTogglePin && (
                <DropdownMenuItem onClick={() => onTogglePin()} className="text-xs cursor-pointer">
                  <Pin className="h-3.5 w-3.5 mr-2" />
                  <span>{c.is_pinned ? "取消置顶" : "置顶对话"}</span>
                </DropdownMenuItem>
              )}
              {onRename && (
                <DropdownMenuItem onClick={() => onRename()} className="text-xs cursor-pointer">
                  <Edit2 className="h-3.5 w-3.5 mr-2" />
                  <span>重命名</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete()}
                className="text-xs text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" />
                <span>删除对话</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Direct Touch Drag Handle for Pinned Cards */}
          {c.is_pinned && onStartDrag ? (
            <div
              onTouchStart={(e) => {
                e.stopPropagation();
                onStartDrag(e.touches[0].clientY);
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onStartDrag(e.clientY);
              }}
              className="touch-none flex items-center justify-center h-8 w-7 text-muted-foreground/60 active:text-primary cursor-grab active:cursor-grabbing shrink-0"
              title="按住拖拽排序"
            >
              <GripVertical className="h-4 w-4" />
            </div>
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
          )}
        </div>
      </div>
    </div>
  );
};

const ITEM_STEP = 74; // Card height (~68px) + list gap (6px)

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
}: MobileHistoryViewProps) => {
  const [search, setSearch] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Conversation | null>(null);
  const [editingConv, setEditingConv] = useState<Conversation | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [activeOpenId, setActiveOpenId] = useState<string | null>(null);

  // 当离开历史面板或当前活动会话变化时，全面重置所有滑动和拖拽状态，杜绝任何样式卡死
  useEffect(() => {
    if (!isVisible) {
      setActiveOpenId(null);
      setDraggingId(null);
      setDragDeltaY(0);
      setDragOverIndex(null);
    }
  }, [isVisible]);

  useEffect(() => {
    setActiveOpenId(null);
  }, [activeId]);

  const handleSelect = (id: string) => {
    setActiveOpenId(null);
    onSelect(id);
  };

  // Direct touch & pointer drag state for pinned cards
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragDeltaY, setDragDeltaY] = useState(0);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const startYRef = useRef(0);
  const dragStartIndexRef = useRef(0);
  const dragOverIndexRef = useRef(0);
  const pinnedListRef = useRef<Conversation[]>([]);
  const pinnedCountRef = useRef(0);

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

  // 按 Apple 规范对对话进行时间分段（置顶、今天、过去 7 天、更早）
  const groupedSections = useMemo(() => {
    const pinned: Conversation[] = [];
    const today: Conversation[] = [];
    const pastWeek: Conversation[] = [];
    const earlier: Conversation[] = [];

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const sevenDaysAgo = startOfToday - 6 * 24 * 60 * 60 * 1000;

    filteredList.forEach((c) => {
      if (c.is_pinned) {
        pinned.push(c);
        return;
      }
      const t = new Date(c.last_message_at || c.created_at || 0).getTime();
      if (t >= startOfToday) {
        today.push(c);
      } else if (t >= sevenDaysAgo) {
        pastWeek.push(c);
      } else {
        earlier.push(c);
      }
    });

    // 置顶会话严格按照 pin_order 升序排序
    pinned.sort((a, b) => (a.pin_order ?? 0) - (b.pin_order ?? 0));

    // 各未置顶时间分组内部严格按照最后发送消息时间倒序排列
    const sortByLastMsg = (a: Conversation, b: Conversation) => {
      const timeA = new Date(a.last_message_at || a.created_at || 0).getTime();
      const timeB = new Date(b.last_message_at || b.created_at || 0).getTime();
      return timeB - timeA;
    };
    today.sort(sortByLastMsg);
    pastWeek.sort(sortByLastMsg);
    earlier.sort(sortByLastMsg);

    const sections = [];
    if (pinned.length > 0) sections.push({ key: "pinned", title: "置顶对话", items: pinned });
    if (today.length > 0) sections.push({ key: "today", title: "今天", items: today });
    if (pastWeek.length > 0) sections.push({ key: "pastWeek", title: "过去 7 天", items: pastWeek });
    if (earlier.length > 0) sections.push({ key: "earlier", title: "更早之前", items: earlier });

    return sections;
  }, [filteredList]);

  // 同步置顶列表引用供实时拖动逻辑使用
  const pinnedItems = useMemo(() => {
    const sec = groupedSections.find((s) => s.key === "pinned");
    return sec ? sec.items : [];
  }, [groupedSections]);

  useEffect(() => {
    pinnedListRef.current = pinnedItems;
    pinnedCountRef.current = pinnedItems.length;
  }, [pinnedItems]);

  const handleStartDrag = (id: string, index: number, clientY: number) => {
    setDraggingId(id);
    setDragDeltaY(0);
    setDragOverIndex(index);
    startYRef.current = clientY;
    dragStartIndexRef.current = index;
    dragOverIndexRef.current = index;
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      try {
        navigator.vibrate(25);
      } catch {}
    }
  };

  // 全局 touchmove & mousemove 监听以保证手势流畅且不触发页面滚动手势
  useEffect(() => {
    if (!draggingId) return;

    const handleMove = (clientY: number) => {
      const deltaY = clientY - startYRef.current;
      setDragDeltaY(deltaY);

      const stepCount = Math.round(deltaY / ITEM_STEP);
      let newOverIndex = dragStartIndexRef.current + stepCount;
      newOverIndex = Math.max(0, Math.min(pinnedCountRef.current - 1, newOverIndex));
      if (newOverIndex !== dragOverIndexRef.current) {
        dragOverIndexRef.current = newOverIndex;
        setDragOverIndex(newOverIndex);
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          try {
            navigator.vibrate(12);
          } catch {}
        }
      }
    };

    const handleEnd = () => {
      const from = dragStartIndexRef.current;
      const to = dragOverIndexRef.current;
      if (from !== to && onReorderPinned) {
        const currentPinned = [...pinnedListRef.current];
        const [moved] = currentPinned.splice(from, 1);
        if (moved) {
          currentPinned.splice(to, 0, moved);
          onReorderPinned(currentPinned.map((item) => item.id));
        }
      }
      setDraggingId(null);
      setDragDeltaY(0);
      setDragOverIndex(null);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();
      handleMove(e.touches[0].clientY);
    };
    const onMouseMove = (e: MouseEvent) => {
      handleMove(e.clientY);
    };

    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", handleEnd);
    window.addEventListener("touchcancel", handleEnd);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", handleEnd);

    return () => {
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", handleEnd);
      window.removeEventListener("touchcancel", handleEnd);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", handleEnd);
    };
  }, [draggingId, onReorderPinned]);

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

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden relative">
      {/* ── Apple HIG Standard Navigation Header (44pt) ── */}
      <MobileHeader title="历史会话" />

      {/* ── Apple Style Search Bar ── */}
      <div className="px-3.5 py-2 border-b border-border/30 bg-background/50 backdrop-blur-md shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            type="search"
            placeholder="搜索历史记录..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-8 h-8 text-[13px] rounded-lg bg-muted/60 border-border/40 focus-visible:bg-background"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-2 p-0.5 rounded-full text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Fullscreen Conversation List Area ── */}
      <div
        onScroll={() => {
          if (activeOpenId) setActiveOpenId(null);
        }}
        className="flex-1 overflow-y-auto px-4 pt-3 pb-[calc(49px+env(safe-area-inset-bottom,0px)+1.5rem)] overscroll-contain"
      >
        {filteredList.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-16 text-center select-none">
            <div className="h-14 w-14 rounded-2xl bg-muted/50 flex items-center justify-center text-muted-foreground mb-3">
              <MessageSquare className="h-7 w-7" />
            </div>
            <h3 className="text-base font-semibold text-foreground">
              {search ? "未找到匹配的历史对话" : "暂无历史对话"}
            </h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              {search ? "换个关键词试试，或清除搜索框。" : "在聊天界面发送一条消息，它将自动保存在这里。"}
            </p>
            {!search && (
              <Button onClick={onNewChat} className="mt-4 rounded-xl px-4 text-xs font-medium">
                <Plus className="h-3.5 w-3.5 mr-1" />
                <span>开启新对话</span>
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            {groupedSections.map((sec) => (
              <div key={sec.key} className="space-y-1.5">
                {/* Section Header */}
                <div className="flex items-center justify-between px-1 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground select-none">
                  <div className="flex items-center gap-1.5">
                    {sec.key === "pinned" && <Pin className="h-3 w-3 text-primary" />}
                    <span>{sec.title}</span>
                    <span className="text-[10px] font-mono opacity-60">({sec.items.length})</span>
                  </div>
                </div>

                {/* Section Cards List with iOS Swipe & Touch Drag Reorder Support */}
                <div className="space-y-1.5">
                  {sec.items.map((c, idx) => {
                    const isDraggingThis = c.id === draggingId;
                    let dragShiftY = 0;
                    if (draggingId && !isDraggingThis && sec.key === "pinned") {
                      const from = dragStartIndexRef.current;
                      const to = dragOverIndex ?? from;
                      if (from < to && idx > from && idx <= to) {
                        dragShiftY = -ITEM_STEP;
                      } else if (from > to && idx >= to && idx < from) {
                        dragShiftY = ITEM_STEP;
                      }
                    }

                    return (
                      <SwipeableConversationCard
                        key={c.id}
                        conversation={c}
                        isSelected={c.id === activeId}
                        timeStr={formatRelativeTime(c.last_message_at || c.created_at)}
                        onSelect={() => handleSelect(c.id)}
                        onDelete={() => setPendingDelete(c)}
                        onTogglePin={onTogglePin ? () => onTogglePin(c.id) : undefined}
                        onRename={onRename ? () => handleStartRename(c) : undefined}
                        onMoveUp={sec.key === "pinned" && onMovePinned ? () => onMovePinned(c.id, "up") : undefined}
                        onMoveDown={sec.key === "pinned" && onMovePinned ? () => onMovePinned(c.id, "down") : undefined}
                        isFirstPinned={sec.key === "pinned" && idx === 0}
                        isLastPinned={sec.key === "pinned" && idx === sec.items.length - 1}
                        onStartDrag={
                          sec.key === "pinned" && onReorderPinned && sec.items.length > 1
                            ? (clientY) => handleStartDrag(c.id, idx, clientY)
                            : undefined
                        }
                        isDraggingThis={isDraggingThis}
                        dragShiftY={dragShiftY}
                        dragDeltaY={dragDeltaY}
                        activeOpenId={activeOpenId}
                        setActiveOpenId={setActiveOpenId}
                      />
                    );
                  })}
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
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="请输入新标题"
                className="h-10 text-sm rounded-xl"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleConfirmRename();
                }}
              />
            </div>
            <DialogFooter className="flex-row gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setEditingConv(null)} className="rounded-xl">
                取消
              </Button>
              <Button size="sm" onClick={handleConfirmRename} className="rounded-xl">
                保存
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* 删除二次确认弹窗 */}
      {pendingDelete && (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setPendingDelete(null);
          }}
          title="删除该历史会话"
          description={`确定要删除对话「${pendingDelete.title || "新建对话"}」吗？删除后将无法恢复。`}
          confirmText="删除"
          danger
          onConfirm={() => {
            onDelete(pendingDelete.id);
            setPendingDelete(null);
          }}
        />
      )}
    </div>
  );
};
