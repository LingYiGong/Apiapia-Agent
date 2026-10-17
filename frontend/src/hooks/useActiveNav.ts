"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, type NavId } from "@/config/navigation";

/** 当前所在导航项的统一判定 */
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
