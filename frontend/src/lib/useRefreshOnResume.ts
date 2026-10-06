"use client";

import { useEffect, useRef } from "react";
import { APP_RESUME_EVENT } from "@/lib/appResume";

interface RefreshOnResumeOptions {
  /**
   * 刷新期间是否允许执行。用于保护那些「刷新会打断用户当前操作」的场景，
   * 例如：正在流式输出、正在重新生成、正在编辑记忆、偏好设置有未保存改动。
   */
  enabled?: boolean;
  /**
   * 该视图当前是否可见。移动端 SPA 里四个页签是同时挂载、只切换 CSS 显隐的，
   * 传进来才能在切回该页签时补一次刷新。默认 true（独立路由页面始终可见）。
   */
  visible?: boolean;
  /** 两次刷新之间的最小间隔，兜住「原生事件 + visibilitychange」重复触发 */
  minIntervalMs?: number;
}

/**
 * 数据刷新时机统一入口，两个触发点：
 * 1. 应用从后台回到前台（APP_RESUME_EVENT）
 * 2. 视图从隐藏变可见（移动端 SPA 切页签）
 *
 * 首次挂载**不会**触发：各视图自己的 mount effect 已经拉过一次，避免多打一遍请求。
 */
export function useRefreshOnResume(
  refresh: () => void | Promise<void>,
  { enabled = true, visible = true, minIntervalMs = 2000 }: RefreshOnResumeOptions = {}
) {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const lastRunRef = useRef(0);

  const run = () => {
    const now = Date.now();
    if (now - lastRunRef.current < minIntervalMs) return;
    lastRunRef.current = now;
    void refreshRef.current();
  };
  const runRef = useRef(run);
  runRef.current = run;

  useEffect(() => {
    if (!enabled) return;
    const handler = () => runRef.current();
    window.addEventListener(APP_RESUME_EVENT, handler);
    return () => window.removeEventListener(APP_RESUME_EVENT, handler);
  }, [enabled]);

  const seenVisibleRef = useRef(false);
  useEffect(() => {
    if (!visible) return;
    // 首帧交给各视图自己的 mount effect，这里只负责「再次可见」。
    if (seenVisibleRef.current) runRef.current();
    else seenVisibleRef.current = true;
  }, [visible]);
}