"use client";

import React from "react";
import { Pin, PinOff, Trash2, Edit2, Clock, MessageSquare, ChevronRight, MoreHorizontal, ChevronUp, ChevronDown, GripVertical } from "lucide-react";
import type { Conversation } from "@/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * 可左右滑动的会话卡片（移动端历史列表）。
 *
 * 从 MobileHistoryView 拆出：该视图有 800 行，其中一半是这张卡片的触摸手势
 * 状态机，混在一起会让「列表怎么分组」和「卡片怎么滑动」互相干扰。
 *
 * 手势规则：
 *   - 部分右滑 → 露出「置顶/取消置顶」
 *   - 部分左滑 → 露出「删除」
 *   - 满阈值 → 直接执行（切换置顶 / 删除）
 *   - 手指按下后先判定横向还是纵向，纵向滚动立刻交还给页面（isHorizontalRef）
 */

const BUTTON_WIDTH = 76;
/** 满滑触发阈值。比 BUTTON_WIDTH 大一截，避免「轻轻一动就误删」。 */
const FULL_SWIPE_THRESHOLD = 135;
/** 部分滑动的吸附阈值。 */
const SNAP_THRESHOLD = 36;

export interface SwipeableConversationCardProps {
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

export const SwipeableConversationCard = ({
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
}: SwipeableConversationCardProps) => {
  const isOpen = activeOpenId === c.id;
  const [offset, setOffset] = React.useState(0);
  const [isDragging, setIsDragging] = React.useState(false);

  const startXRef = React.useRef(0);
  const startYRef = React.useRef(0);
  const currentOffsetRef = React.useRef(0);
  const isHorizontalRef = React.useRef<boolean | null>(null);
  const isSwipingRef = React.useRef(false);
  const swipeTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // 其它项被打开或关闭时复位自己的偏移
  React.useEffect(() => {
    if (!isOpen && offset !== 0) {
      setOffset(0);
      currentOffsetRef.current = 0;
    }
  }, [isOpen, offset]);

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

    // 先判定横向还是纵向；判为纵向就彻底退出，此后不再接管这次手势
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
    // 超出按钮宽度后加阻尼，给出「已经到底了」的物理反馈
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

    // 刚滑完的一小段时间内拦截 click，否则松手会顺带触发「打开会话」
    if (isSwipingRef.current) {
      if (swipeTimeoutRef.current) clearTimeout(swipeTimeoutRef.current);
      swipeTimeoutRef.current = setTimeout(() => {
        isSwipingRef.current = false;
      }, 300);
    }

    if (offset > FULL_SWIPE_THRESHOLD) {
      onTogglePin?.();
      setOffset(0);
      currentOffsetRef.current = 0;
      setActiveOpenId(null);
      return;
    }
    if (offset < -FULL_SWIPE_THRESHOLD) {
      onDelete();
      setOffset(0);
      currentOffsetRef.current = 0;
      setActiveOpenId(null);
      return;
    }

    if (offset > SNAP_THRESHOLD) {
      setOffset(BUTTON_WIDTH);
      currentOffsetRef.current = BUTTON_WIDTH;
      setActiveOpenId(c.id);
    } else if (offset < -SNAP_THRESHOLD) {
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
    // 滑动过程中或卡片还开着时，拦截点击，不进入会话
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
        "relative select-none touch-pan-y rounded-2xl",
        isDraggingThis && "shadow-2xl ring-2 ring-primary/50"
      )}
    >
      {/* Leading action: 右滑 → 置顶 / 取消置顶 */}
      <div
        style={{ width: `${BUTTON_WIDTH}px` }}
        onClick={(e) => {
          e.stopPropagation();
          onTogglePin?.();
          setOffset(0);
          currentOffsetRef.current = 0;
          setActiveOpenId(null);
        }}
        className={cn(
          "absolute inset-y-0 left-0 z-0 flex cursor-pointer flex-col items-center justify-center rounded-l-2xl text-white transition-opacity duration-150 active:brightness-95",
          c.is_pinned ? "bg-slate-600 dark:bg-slate-700" : "bg-amber-500 dark:bg-amber-600",
          offset > 0 ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      >
        {c.is_pinned ? <PinOff className="mb-0.5 h-5 w-5" /> : <Pin className="mb-0.5 h-5 w-5" />}
        <span className="text-2xs font-semibold">
          {c.is_pinned ? "取消置顶" : "置顶"}
        </span>
      </div>

      {/* Trailing action: 左滑 → 删除 */}
      <div
        style={{ width: `${BUTTON_WIDTH}px` }}
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
          setOffset(0);
          currentOffsetRef.current = 0;
          setActiveOpenId(null);
        }}
        className={cn(
          "absolute inset-y-0 right-0 z-0 flex cursor-pointer flex-col items-center justify-center rounded-r-2xl bg-red-500 text-white transition-opacity duration-150 active:brightness-95 dark:bg-red-600",
          offset < 0 ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      >
        <Trash2 className="mb-0.5 h-5 w-5" />
        <span className="text-2xs font-semibold">删除</span>
      </div>

      {/* 前景卡片 */}
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
          "relative z-10 flex cursor-pointer select-none items-center justify-between rounded-2xl border p-3.5 active:scale-[0.995]",
          "bg-card dark:bg-surface-2",
          isSelected
            ? "border-primary/40 shadow-xs"
            : "border-border/50 shadow-2xs hover:border-border",
          isDraggingThis && "border-primary/50 shadow-lg"
        )}
      >
        {/* 选中态蒙层：压在不透明卡片之上，不会穿透到底层按钮 */}
        {isSelected && (
          <div className="pointer-events-none absolute inset-0 z-0 rounded-2xl bg-primary/10" />
        )}

        <div className="flex min-w-0 flex-1 items-center gap-3 pr-2">
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors",
              c.is_pinned
                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                : isSelected
                  ? "bg-primary/20 text-primary"
                  : "bg-surface-3 text-muted-foreground"
            )}
          >
            {c.is_pinned ? <Pin className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
          </div>

          <div className="min-w-0 flex-1">
            {/* 整卡 onClick 只服务鼠标与滑动；这里给标题一个真正的 <button>，
                让 Enter / Space 也能打开会话，并用 aria-current 标记当前会话。 */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleCardClick();
              }}
              aria-current={isSelected ? "true" : undefined}
              className="flex w-full min-w-0 items-center gap-1.5 text-left"
            >
              <span
                className={cn(
                  "truncate text-base font-medium leading-snug sm:text-body",
                  isSelected ? "font-semibold text-primary" : "text-foreground"
                )}
              >
                {c.title || "新建对话"}
              </span>
            </button>
            <div className="mt-1 flex items-center gap-2 font-mono text-2xs text-muted-foreground">
              {timeStr && (
                <span className="flex shrink-0 items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>{timeStr}</span>
                </span>
              )}
              {c.model && (
                <span className="max-w-[120px] truncate rounded bg-surface-3/60 px-1 text-2xs">
                  {c.model}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 操作菜单与拖拽把手 */}
        <div className="flex shrink-0 items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full text-muted-foreground hover:bg-surface-3 hover:text-foreground"
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
                  className="cursor-pointer text-xs disabled:opacity-35"
                >
                  <ChevronUp className="mr-2 h-3.5 w-3.5" />
                  <span>上移一位</span>
                </DropdownMenuItem>
              )}
              {c.is_pinned && onMoveDown && (
                <DropdownMenuItem
                  disabled={isLastPinned}
                  onClick={onMoveDown}
                  className="cursor-pointer text-xs disabled:opacity-35"
                >
                  <ChevronDown className="mr-2 h-3.5 w-3.5" />
                  <span>下移一位</span>
                </DropdownMenuItem>
              )}
              {c.is_pinned && (onMoveUp || onMoveDown) && <DropdownMenuSeparator />}
              {onTogglePin && (
                <DropdownMenuItem onClick={onTogglePin} className="cursor-pointer text-xs">
                  <Pin className="mr-2 h-3.5 w-3.5" />
                  <span>{c.is_pinned ? "取消置顶" : "置顶对话"}</span>
                </DropdownMenuItem>
              )}
              {onRename && (
                <DropdownMenuItem onClick={onRename} className="cursor-pointer text-xs">
                  <Edit2 className="mr-2 h-3.5 w-3.5" />
                  <span>重命名</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onDelete}
                className="cursor-pointer text-xs text-destructive focus:bg-destructive/10 focus:text-destructive"
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                <span>删除对话</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 置顶项的拖拽把手。刻意不包 ActionTooltip：拖拽只支持指针操作，
              让 TooltipTrigger 把它变成可聚焦元素会造出「能 Tab 到、但按不出
              任何效果」的死点（WCAG 2.1.1）。改用原生 title 提示。
              键盘用户用上方菜单里的「上移一位 / 下移一位」完成同样的排序。 */}
          {c.is_pinned && onStartDrag ? (
            <div
              title="按住拖拽排序（键盘请用上移/下移）"
              onTouchStart={(e) => {
                e.stopPropagation();
                onStartDrag(e.touches[0].clientY);
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onStartDrag(e.clientY);
              }}
              className="flex h-8 w-8 shrink-0 cursor-grab touch-none items-center justify-center text-muted-foreground/60 active:cursor-grabbing active:text-primary"
            >
              <GripVertical className="h-4 w-4" />
            </div>
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40" />
          )}
        </div>
      </div>
    </div>
  );
};
