"use client";

import React from "react";
import { UsageView } from "@/components/usage/UsageView";
import { MobileSpaRedirect } from "@/components/common/MobileSpaRedirect";

export default function UsagePage() {
  return (
    <MobileSpaRedirect tab="usage">
      <UsageView />
    </MobileSpaRedirect>
  );
}
