"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

export interface UseAsyncActionResult {
  /**
   * 正在进行中的操作 id。
   * UsageView 用它同时做两件事：显示行内 spinner，以及禁用其它行的操作按钮。
   * 单飞（single-flight）：非 null 时再次调用同一个 key 会被忽略。
   */
  pendingKey: string | null;
  isPending: (key: string) => boolean;
  /** 以 key 包裹一段异步动作，自动接管 loading、成功/失败 toast 与异常兜底 */
  run: <T>(
    key: string,
    fn: () => Promise<T>,
    messages?: { success?: string; error?: string }
  ) => Promise<T | undefined>;
  /** 强制清空 pending（用于组件卸载等场景） */
  reset: () => void;
}

/**
 * 给「写操作 → 刷新 → 提示」这类动作统一套上 pending 状态与异常兜底。
 *
 * UsageView 里三个管理员操作（启用/停用、授予/取消管理员、开通/限制模型权限）
 * 结构完全同构，只有接口、文案和一个额外的请求体不同，此前是三份逐字复制的
 * 30 行 try/catch/finally。现在收口到这里。
 *
 * 注意 pending 用 ref + state 双写：state 供渲染，ref 让 run 在闭包外也能
 * 判断是否单飞，避免依赖数组里多一个 pendingKey 引起回调身份抖动。
 */
export function useAsyncAction(): UseAsyncActionResult {
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const pendingRef = useRef<string | null>(null);

  const isPending = useCallback((key: string) => pendingRef.current === key, []);

  const reset = useCallback(() => {
    pendingRef.current = null;
    setPendingKey(null);
  }, []);

  const run = useCallback(
    async <T,>(
      key: string,
      fn: () => Promise<T>,
      messages: { success?: string; error?: string } = {}
    ): Promise<T | undefined> => {
      // 按 key 单飞：同一个 key 上重复触发直接忽略，防止用户连点同一行发出两次写请求
      //（MemoryView 的删除确认框此前没有 loading 态，双击会真的发两个 DELETE）。
      // 不同 key 之间仍然允许并发，与改动前「actionLoading 只存一个 key、
      // 但各行互不阻塞」的行为保持一致。
      if (pendingRef.current === key) return undefined;
      pendingRef.current = key;
      setPendingKey(key);
      try {
        const result = await fn();
        if (messages.success) toast.success(messages.success);
        return result;
      } catch (err) {
        const message =
          err instanceof Error && err.message ? err.message : messages.error || "操作失败";
        toast.error(message);
        return undefined;
      } finally {
        pendingRef.current = null;
        setPendingKey(null);
      }
    },
    []
  );

  return { pendingKey, isPending, run, reset };
}
