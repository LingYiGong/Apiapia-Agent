"use client";

import * as React from "react";

/**
 * 哨兵元素进入视口时调用 `onEnter`，并**持续保持观察**。
 *
 * 与「一次性」的 `useInViewOnce` 不同：加载更多需要每加载完一页、hasMore
 * 重新变 true 后能再次触发。所以这里不 disconnect，而是把回调放进 ref 里
 * 每次渲染都刷新 —— 观察器只创建一次，回调却是最新的。
 *
 * 为什么记忆列表不能用 onScroll：`MemoryView` 跑在 `ViewShell` 里，滚动
 * 容器是 ViewShell 自己的 `overflow-y-auto` div（ViewShell.tsx:76），并不
 * 透传 ref —— 子组件拿不到它，只能靠哨兵元素 + 观察器。
 *
 * rootMargin 给 240px 提前量：等哨兵真正露头才请求，用户会看到明显的空白。
 *
 * 防重复由调用方负责（MemoryView 用 loadingMoreRef 单飞闸门）。
 * 环境不支持时退回「挂载即触发一次」，功能不中断，只是少一次预取。
 */
export function useLoadMoreTrigger(
  onEnter: () => void,
  options?: { rootMargin?: string; enabled?: boolean }
): React.RefObject<HTMLDivElement> {
  const ref = React.useRef<HTMLDivElement>(null);
  const enabled = options?.enabled ?? true;
  const rootMargin = options?.rootMargin ?? "240px 0px";

  const onEnterRef = React.useRef(onEnter);
  React.useEffect(() => {
    onEnterRef.current = onEnter;
  });

  React.useEffect(() => {
    if (!enabled) return;
    const node = ref.current;
    if (!node) return;

    if (typeof IntersectionObserver === "undefined") {
      onEnterRef.current();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) onEnterRef.current();
      },
      { rootMargin }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, rootMargin]);

  return ref;
}