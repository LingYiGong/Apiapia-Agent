"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isBelowMd } from "@/lib/mediaQuery";
import type { MobileTab } from "@/config/navigation";

/**
 * 桌面路由 → 移动端 SPA 页签 的统一跳转壳。
 *
 * memory / usage / settings 三个 route 文件此前是同一个 19 行文件的副本，
 * 只有组件名与 tab 名不同。现在三处共用本组件。
 *
 * 为什么需要它：这三个页面在移动端已经作为 /chat?tab=xxx 的全屏页签存在，
 * 独立路由只服务 md 以上。若不做重定向，手机上直接访问 /settings 会得到一个
 * 既没有顶栏也没有底栏的孤立页面（MobileHeader 虽渲染但 md:hidden，
 * 底栏更是不在这里），用户将无法导航离开。
 */
export function MobileSpaRedirect({ tab, children }: { tab: MobileTab; children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    if (isBelowMd()) {
      router.replace(`/chat?tab=${tab}`);
    }
  }, [router, tab]);

  return <>{children}</>;
}
