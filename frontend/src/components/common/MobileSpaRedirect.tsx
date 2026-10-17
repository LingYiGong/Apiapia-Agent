"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isBelowMd } from "@/lib/mediaQuery";
import type { MobileTab } from "@/config/navigation";

/** 桌面路由 → 移动端 SPA 页签的统一跳转壳 */
export function MobileSpaRedirect({ tab, children }: { tab: MobileTab; children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    if (isBelowMd()) {
      router.replace(`/chat?tab=${tab}`);
    }
  }, [router, tab]);

  return <>{children}</>;
}
