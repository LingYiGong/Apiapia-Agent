"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SettingsView } from "@/components/settings/SettingsView";

export default function SettingsPage() {
  const router = useRouter();

  useEffect(() => {
    // If opened on mobile device or small screen, redirect seamlessly to the SPA shell
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      router.replace("/chat?tab=settings");
    }
  }, [router]);

  return <SettingsView />;
}
