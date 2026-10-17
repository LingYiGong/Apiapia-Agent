"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

/**
 * 未登录时自动跳转登录页。
 */
export function useRequireAuth(enabled = true) {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!enabled || loading) return;
    if (!user) router.push("/login");
  }, [enabled, user, loading, router]);
}
