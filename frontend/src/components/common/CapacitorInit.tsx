"use client";

import { useEffect } from "react";
import { useTheme } from "@/lib/theme";
import { initCapacitorApp } from "@/lib/capacitor";

export const CapacitorInit: React.FC = () => {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    initCapacitorApp(resolvedTheme);
  }, [resolvedTheme]);

  return null;
};
