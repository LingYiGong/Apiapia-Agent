"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { MemoryView } from "@/components/memory/MemoryView";
import { isBelowMd } from "@/lib/mediaQuery";

export default function MemoryPage() {
  const router = useRouter();

  useEffect(() => {
    // If opened on mobile device or small screen, redirect seamlessly to the SPA shell
    if (isBelowMd()) {
      router.replace("/chat?tab=memory");
    }
  }, [router]);

  return <MemoryView />;
}
