"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, type NavId } from "@/config/navigation";

/**
 * 当前所在导航项的统一判定。
 *
 * 此前有三套并存的判定规则：
 * - DesktopNavbar：`pathname.startsWith(item.href)`
 * - MobileTabBar：父组件传进来的 `activeMobileTab` 做等值比较
 * - MobileHeader / UserAvatarDropdown：完全没有 active 状态
 *
 * `startsWith` 本身也不安全：`/chat` 会命中 hypothetical 的 `/chats`，
 * `/settings` 会命中 `/settings-admin`。这里改为「完全相等或按路径分段」匹配，
 * 并按 href 长度从长到短尝试。
 *
 * 刻意**不使用 useSearchParams**：它在 App Router 的静态导出（output: "export"，
 * 见 next.config.mjs）下必须包在 <Suspense> 里，否则构建直接失败。移动端 SPA
 * 页签的真实状态本来就由 chat/page.tsx 持有并通过 props 传下来（页签切换用的是
 * history.replaceState，本来就不会更新 usePathname），所以这里只需要 pathname
 * 加一个可选的回落值。
 */
export function useActiveNav(fallbackTab?: NavId) {
  const pathname = usePathname();

  return useMemo(() => {
    const activeTab =
      [...NAV_ITEMS]
        .filter((i) => i.inDesktopNav)
        .sort((a, b) => b.href.length - a.href.length)
        .find((i) => pathname === i.href || pathname.startsWith(`${i.href}/`))?.id ??
      fallbackTab ??
      "chat";

    return {
      activeTab,
      isActive: (id: NavId) => id === activeTab,
      ariaCurrent: (id: NavId) => (id === activeTab ? ("page" as const) : undefined),
    };
  }, [pathname, fallbackTab]);
}
