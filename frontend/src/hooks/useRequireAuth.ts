"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

/**
 * 未登录时跳回登录页。
 *
 * 此前 UsageView / SettingsView / MemoryView 三处各自写了一份
 * `if (!loading && !user) router.push("/login")`，逐字相同；
 * 而且守卫放在**视图内部**，导致未登录访客会先把视图的取数 effect 跑起来，
 * 白白发出一批注定 401 的请求。
 *
 * 注意：仅收敛逻辑，不改变调用位置 —— 守卫移进路由层是更大的重构，
 * 留待后续。`enabled` 用于 SPA 内按页签惰性取数的场景。
 */
export function useRequireAuth(enabled = true) {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!enabled || loading) return;
    if (!user) router.push("/login");
  }, [enabled, user, loading, router]);
}
