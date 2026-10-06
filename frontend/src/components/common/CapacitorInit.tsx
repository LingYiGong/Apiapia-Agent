"use client";

import { useEffect } from "react";
import { useTheme } from "@/lib/theme";
import { initCapacitorApp } from "@/lib/capacitor";
import { startAppResumeWatcher } from "@/lib/appResume";

export const CapacitorInit: React.FC = () => {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    initCapacitorApp(resolvedTheme);
  }, [resolvedTheme]);

  // 让「切后台再回来」能刷新数据；纯 Web / PWA 场景同样有效
  useEffect(() => {
    startAppResumeWatcher();
  }, []);

  return null;
};
