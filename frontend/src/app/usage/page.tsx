"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { UsageView } from "@/components/usage/UsageView";
import { isBelowMd } from "@/lib/mediaQuery";

export default function UsagePage() {
  const router = useRouter();

  useEffect(() => {
    // If opened on mobile device or small screen, redirect seamlessly to the SPA shell
    if (isBelowMd()) {
      router.replace("/chat?tab=usage");
    }
  }, [router]);

  return <UsageView />;
}
