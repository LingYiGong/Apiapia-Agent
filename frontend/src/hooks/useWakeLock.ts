"use client";

import { useEffect, useRef, useCallback } from "react";
import { isWakeLockSupported } from "@/lib/wakeLock";
import { APP_RESUME_EVENT } from "@/lib/appResume";

interface UseWakeLockOptions {
  /**
   * 是否处于模型回复状态（等待响应、流式生成或重新生成）。
   * 为 true 时自动申请屏幕常亮；为 false 时立即释放，恢复手机系统默认息屏逻辑。
   */
  active: boolean;
}

/**
 * 屏幕常亮生命周期 Hook。
 *
 * 行为机制：
 * 1. 静默默认开启，不向用户弹窗或提示；
 * 2. 当模型正在回复（active 为 true）时，向系统申请屏幕常亮锁（Wake Lock），防止手机息屏黑屏；
 * 3. 当回复完毕、停止生成或出错中断（active 变为 false）时，立即释放锁，完全恢复手机原本的息屏时间；
 * 4. 解决切后台场景：切换应用会导致系统自动释放锁，当用户切回前台且模型仍在生成时，自动重新锁定常亮；
 * 5. 安全静默降级：对于不支持的浏览器或低电量模式系统拒绝，静默处理，不干扰正常对话。
 */
export function useWakeLock({ active }: UseWakeLockOptions) {
  const sentinelRef = useRef<WakeLockSentinel | null>(null);
  const isAcquiringRef = useRef(false);
  const activeRef = useRef(active);
  activeRef.current = active;

  const requestLock = useCallback(async () => {
    if (!isWakeLockSupported()) return;
    if (!activeRef.current) return;
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;

    if (sentinelRef.current && !sentinelRef.current.released) {
      return;
    }
    if (isAcquiringRef.current) return;

    try {
      isAcquiringRef.current = true;
      const sentinel = await navigator.wakeLock.request("screen");
      sentinelRef.current = sentinel;

      sentinel.addEventListener("release", () => {
        if (sentinelRef.current === sentinel) {
          sentinelRef.current = null;
        }
      });
    } catch {
      // 省电模式或系统策略拒绝时静默降级
    } finally {
      isAcquiringRef.current = false;
    }
  }, []);

  const releaseLock = useCallback(async () => {
    try {
      if (sentinelRef.current && !sentinelRef.current.released) {
        await sentinelRef.current.release();
      }
    } catch {
      // 静默处理释放异常
    } finally {
      sentinelRef.current = null;
    }
  }, []);

  // 当处于回复状态时申请屏幕常亮，回复结束立即释放锁
  useEffect(() => {
    if (active) {
      void requestLock();
    } else {
      void releaseLock();
    }
  }, [active, requestLock, releaseLock]);

  // 当用户在回复过程中切出再切回时，若仍在回复则重新申请常亮锁
  useEffect(() => {
    const handleResume = () => {
      if (activeRef.current) {
        void requestLock();
      }
    };

    window.addEventListener(APP_RESUME_EVENT, handleResume);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && activeRef.current) {
        void requestLock();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener(APP_RESUME_EVENT, handleResume);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      void releaseLock();
    };
  }, [requestLock, releaseLock]);
}
