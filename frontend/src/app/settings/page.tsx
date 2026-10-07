"use client";

import React from "react";
import { SettingsView } from "@/components/settings/SettingsView";
import { MobileSpaRedirect } from "@/components/common/MobileSpaRedirect";

export default function SettingsPage() {
  return (
    <MobileSpaRedirect tab="settings">
      <SettingsView />
    </MobileSpaRedirect>
  );
}
