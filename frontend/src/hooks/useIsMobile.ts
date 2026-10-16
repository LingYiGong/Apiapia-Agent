"use client";

import { useEffect, useState } from "react";
import { MD_BREAKPOINT_PX } from "@/lib/mediaQuery";

/**
 * 视口是否窄于 Tailwind 的 `md` 断点（即移动端）。
 *
 * 与 lib/mediaQuery.ts 的 `isBelowMd()` 的区别：**这个是响应式的**。
 * `isBelowMd()` 只在调用那一刻求一次值，适合路由重定向那种「问完就不再问」的场合；
 * 而 ModelPicker 需要在用户旋转手机、或把窗口从一半屏拉到全屏时立刻切换
 * 底部抽屉 / 浮层，固定值做不到。
 *
 * 初值恒为 `false`：SSR 阶段没有 `window`，首帧必须与服务器输出逐字节一致，
 * 否则 Next 会报 hydration mismatch 并丢掉整棵树。移动端是在挂载后的
 * `useEffect` 里补一次 `setState`，那一帧弹层还处于关闭态，用户看不到跳变。
 *
 * 断点常量复用 `MD_BREAKPOINT_PX`，与全站 `md:` 样式和移动端 SPA 分流
 * （见 lib/mediaQuery.ts 顶部的说明）共用同一个数字，不会各自漂移。
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    const mq = window.matchMedia(`(max-width: ${MD_BREAKPOINT_PX - 1}px)`);
    const sync = () => setIsMobile(mq.matches);
    sync();

    // MediaQueryList 在旧版 Safari / iOS 13 的 WKWebView 上只有 addListener。
    // 本项目是 Capacitor 原生壳，打包出去的正是这些 WKWebView，所以留着兼容分支。
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", sync);
      return () => mq.removeEventListener("change", sync);
    }
    mq.addListener(sync);
    return () => mq.removeListener(sync);
  }, []);

  return isMobile;
}
