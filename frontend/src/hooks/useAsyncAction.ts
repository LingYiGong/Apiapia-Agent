"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { getTranslator, resolveStoredLocale } from "@/i18n/runtime";

export interface UseAsyncActionResult {
  /**
   * 最近一次发起、且**仍未结束**的操作 key。null 表示当前没有任何在途操作。
   *
   * 注意它只保证「自己这一条」的 spinner 语义：多个 key 并发时，较早发起的那个
   * 结束不会把较晚发起的清掉（此前用单个 key 存，最后无条件置 null，于是 A 结束
   * 会顺手抹掉在途的 B，B 的行丢失 spinner 与禁用态，再点一次就真的执行两遍）。
   */
  pendingKey: string | null;
  isPending: (key: string) => boolean;
  /** 当前在途操作总数。0 表示没有任何操作在进行中。 */
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
 * 给「写操作 → 刷新 → 提示」这类动作统一套上 pending 状态与异常兜底。
 *
 * UsageView 里三个管理员操作（启用/停用、授予/取消管理员、开通/限制模型权限）
 * 结构完全同构，只有接口、文案和一个额外的请求体不同，此前是三份逐字复制的
 * 30 行 try/catch/finally。现在收口到这里。
 *
 * pending 用 ref + state 双写：ref 是同步权威，让 run 在闭包外也能判断是否单飞，
 * 不必把 pendingKey 塞进依赖数组引起回调身份抖动；state 只负责触发渲染。
 */
export function useAsyncAction(): UseAsyncActionResult {
  // 在途集合用 Set 而不是单个 key：不同 key 之间允许并发（与「各行互不阻塞」的
  // 既有行为一致），而单个 key 存不下这种并发 —— A 在途时启动 B，A 结束时会把
  // B 的状态一并清掉。
  //
  // 刻意做成「ref 判单飞 + state 驱动渲染」两份：
  // - ref 是同步权威，run 在闭包外也能立刻判断，不依赖 state 提交；
  // - state 是**集合的副本**，每次增删都换一个新 Set，于是每次状态变化都必然
  //   触发一次重渲染。若只靠 ref 供渲染读，A 结束而 B 仍在途时 size 不为 0、
  //   又不需要把 pendingKey 归零，就不会重渲染，A 行的 spinner 会一直卡住。
  const pendingRef = useRef<Set<string>>(new Set());
  const [pending, setPending] = useState<Set<string>>(new Set());
  // 最近一次发起的 key，供「是否有任何操作在途」这一粗粒度判断使用
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
