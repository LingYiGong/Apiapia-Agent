"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { getTranslator, resolveStoredLocale } from "@/i18n/runtime";

export interface UseAsyncActionResult {
  /** 最近一次发起、且仍未结束的操作 key。null 表示当前无在途操作 */
  pendingKey: string | null;
  isPending: (key: string) => boolean;
  /** 当前在途操作总数 */
  pendingCount: number;
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
 * 统一管理异步写操作的 pending 状态、并发控制与异常兜底。
 */
export function useAsyncAction(): UseAsyncActionResult {
  const pendingRef = useRef<Set<string>>(new Set());
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const commit = useCallback((next: Set<string>) => {
    pendingRef.current = next;
    setPending(new Set(next));
  }, []);

  const isPending = useCallback((key: string) => pendingRef.current.has(key), []);

  const reset = useCallback(() => {
    commit(new Set());
    setPendingKey(null);
  }, [commit]);

  const run = useCallback(
    async <T,>(
      key: string,
      fn: () => Promise<T>,
      messages: { success?: string; error?: string } = {}
    ): Promise<T | undefined> => {
      // 按 key 单飞：同一个 key 上重复触发直接忽略，防止用户连点同一行发出两次写请求。
      // 不同 key 之间仍然允许并发 —— 这正是必须用 Set 的原因。
      if (pendingRef.current.has(key)) return undefined;
      commit(new Set(pendingRef.current).add(key));
      setPendingKey(key);
      try {
        const result = await fn();
        if (messages.success) toast.success(messages.success);
        return result;
      } catch (err) {
        const message =
          err instanceof Error && err.message
            ? err.message
            : messages.error || getTranslator(resolveStoredLocale())("common.error.operationFailed");
        toast.error(message);
        return undefined;
      } finally {
        // 只摘掉自己这一个 key，别的在途操作不受影响。
        const rest = new Set(pendingRef.current);
        rest.delete(key);
        commit(rest);
        if (rest.size === 0) setPendingKey(null);
      }
    },
    [commit]
  );

  return { pendingKey, isPending, run, reset, pendingCount: pending.size };
}
