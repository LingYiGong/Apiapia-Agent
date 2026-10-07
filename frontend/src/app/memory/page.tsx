"use client";

import React from "react";
import { MemoryView } from "@/components/memory/MemoryView";
import { MobileSpaRedirect } from "@/components/common/MobileSpaRedirect";

export default function MemoryPage() {
  return (
    <MobileSpaRedirect tab="memory">
      <MemoryView />
    </MobileSpaRedirect>
  );
}
