"use client";

import { isNativePlatform } from "@/lib/capacitor";

/** 应用从后台回到前台时广播的自定义事件名 */
export const APP_RESUME_EVENT = "apiapia_app_resume";

let started = false;

/**
 * 监听「应用回到前台」，广播 APP_RESUME_EVENT。
 *
 * 为什么需要：Capacitor 的 WebView 在切后台时不会卸载页面，React state 会原样
 * 保留。如果只在挂载时拉数据，用户在电脑上聊完天、在手机上切回来看到的仍是旧
 * 数据，必须杀掉进程才会重新拉取。
 *
 * 同时覆盖浏览器 / PWA：切标签页和切回窗口都算「回到前台」。
 *
 * `started` 守卫保证重复调用（React StrictMode 会双跑 effect）只注册一次。
 */
export function startAppResumeWatcher() {
  if (started || typeof window === "undefined") return;
  started = true;

  const emit = () => window.dispatchEvent(new CustomEvent(APP_RESUME_EVENT));

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) emit();
  });
  window.addEventListener("focus", emit);

  if (!isNativePlatform()) return;

  import("@capacitor/app")
    .then(({ App }) =>
      App.addListener("appStateChange", ({ isActive }) => {
        if (isActive) emit();
      })
    )
    .catch((err) => {
      console.warn("App lifecycle listener unavailable:", err);
    });
}