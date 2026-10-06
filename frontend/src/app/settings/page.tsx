"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SettingsView } from "@/components/settings/SettingsView";
import { isBelowMd } from "@/lib/mediaQuery";

export default function SettingsPage() {
  const router = useRouter();

  useEffect(() => {
    // If opened on mobile device or small screen, redirect seamlessly to the SPA shell
    if (isBelowMd()) {
      router.replace("/chat?tab=settings");
    }
  }, [router]);

  return <SettingsView />;
}
