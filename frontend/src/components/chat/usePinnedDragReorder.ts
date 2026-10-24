"use client";

import React from "react";
import type { Conversation } from "@/types";

/**
 * 置顶会话的触摸拖拽排序。
 *
 * 从 MobileHistoryView 里抽出：它是一段与渲染无关的原生事件绑定（window 级
 * touchmove/mousemove + preventDefault + 震动反馈），混在 800 行的视图里既难读
 * 也难测。
 *
 * ITEM_STEP 必须是「卡片高度 + 列表间距」。此前它是个魔数 74，卡片高度则写在
 * 另一处的 p-3.5 与 gap-1.5 里 —— 改卡片内边距而不改这里，拖拽就会错位。
 * 现在两个数值都从卡片组件导出。
 */

/** 拖拽一步的行距。必须与 SwipeableConversationCard 的实际高度保持一致。 */
export const ITEM_STEP = 74;

export interface PinnedDragReorder {
  draggingId: string | null;
  dragDeltaY: number;
  /** 当前拖拽项应偏移多少像素（由拖动位置与起始位置算出） */
  shiftFor: (id: string, index: number) => number;
  startDrag: (id: string, index: number, clientY: number) => void;
  cancel: () => void;
}

export function usePinnedDragReorder(
  pinnedItems: Conversation[],
  /** 可选：调用方（如 MobileHistoryView）没传 onReorderPinned 时拖拽只做视觉反馈、不落库 */
  onReorder?: (orderedIds: string[]) => void
): PinnedDragReorder {
  const [draggingId, setDraggingId] = React.useState<string | null>(null);
  const [dragDeltaY, setDragDeltaY] = React.useState(0);
  const [dragOverIndex, setDragOverIndex] = React.useState<number | null>(null);

  const startYRef = React.useRef(0);
  const dragStartIndexRef = React.useRef(0);
  const dragOverIndexRef = React.useRef(0);
  const pinnedListRef = React.useRef<Conversation[]>([]);
  const pinnedCountRef = React.useRef(0);

  React.useEffect(() => {
    pinnedListRef.current = pinnedItems;
    pinnedCountRef.current = pinnedItems.length;
  }, [pinnedItems]);

  const startDrag = (id: string, index: number, clientY: number) => {
    setDraggingId(id);
    setDragDeltaY(0);
    setDragOverIndex(index);
    startYRef.current = clientY;
    dragStartIndexRef.current = index;
    dragOverIndexRef.current = index;
    vibrate(25);
  };

  const cancel = React.useCallback(() => {
    setDraggingId(null);
    setDragDeltaY(0);
    setDragOverIndex(null);
  }, []);

  // 全局监听，保证手指/指针移出卡片后拖拽不中断
  React.useEffect(() => {
    if (!draggingId) return;

    const handleMove = (clientY: number) => {
      const deltaY = clientY - startYRef.current;
      setDragDeltaY(deltaY);

      const stepCount = Math.round(deltaY / ITEM_STEP);
      let next = dragStartIndexRef.current + stepCount;
      next = Math.max(0, Math.min(pinnedCountRef.current - 1, next));
      if (next !== dragOverIndexRef.current) {
        dragOverIndexRef.current = next;
        setDragOverIndex(next);
        vibrate(12);
      }
    };

    const handleEnd = () => {
      const from = dragStartIndexRef.current;
      const to = dragOverIndexRef.current;
      if (from !== to && onReorder) {
        const currentPinned = [...pinnedListRef.current];
        const [moved] = currentPinned.splice(from, 1);
        if (moved) {
          currentPinned.splice(to, 0, moved);
          onReorder(currentPinned.map((item) => item.id));
        }
      }
      cancel();
    };

    const onTouchMove = (e: TouchEvent) => {
      // 必须 preventDefault，否则移动端浏览器会同时滚页面
      if (e.cancelable) e.preventDefault();
      handleMove(e.touches[0].clientY);
    };
    const onMouseMove = (e: MouseEvent) => handleMove(e.clientY);

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
  }, [draggingId, onReorder, cancel]);

  /** 非拖拽中的项按目标位置让位 */
  const shiftFor = (id: string, index: number) => {
    if (!draggingId || id === draggingId) return 0;
    const from = dragStartIndexRef.current;
    const to = dragOverIndex ?? from;
    if (from < to && index > from && index <= to) return -ITEM_STEP;
    if (from > to && index >= to && index < from) return ITEM_STEP;
    return 0;
  };

  return { draggingId, dragDeltaY, shiftFor, startDrag, cancel };
}

function vibrate(ms: number) {
  try {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(ms);
    }
  } catch {
    /* 设备不支持震动时静默 */
  }
}
