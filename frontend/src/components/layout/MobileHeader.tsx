"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/common/BrandLogo";
import { UserAvatarDropdown, MobileTab } from "@/components/layout/UserAvatarDropdown";
import { cn } from "@/lib/utils";

interface MobileHeaderProps {
  /** If provided, displays standard iOS navigation bar title in center */
  title?: string;
  /** Custom intermediate content (e.g. Model Selector & Refresh button in chat) */
  children?: React.ReactNode;
  /** Custom right component (defaults to UserAvatarDropdown) */
  right?: React.ReactNode;
  /** Optional extra classes */
  className?: string;
  /** SPA tab navigation callback */
  onSelectMobileTab?: (tab: MobileTab) => void;
}

/**
 * Apple HIG Mobile Navigation Bar Standard
 * Standard iPhone portrait navigation bar height: 44pt (44px) + env(safe-area-inset-top).
 * Standard typography: text-[17px] font-semibold.
 * Structure: [Logo] -> [Title or Custom] -> [User Avatar Dropdown]
 */
export const MobileHeader: React.FC<MobileHeaderProps> = ({
  title,
  children,
  right,
  className,
  onSelectMobileTab,
}) => {
  const router = useRouter();

  return (
    <header
      className={cn(
        "sticky top-0 z-30 w-full bg-background/85 backdrop-blur-xl border-b border-border/40 pt-[env(safe-area-inset-top,0px)] shrink-0 select-none md:hidden",
        className
      )}
    >
      <div className="h-11 px-3 sm:px-4 flex items-center justify-between gap-2.5 min-w-0">
        {/* Left: App Cat Logo (Tapping switches to chat tab in SPA) */}
        <button
          type="button"
          onClick={() => {
            if (onSelectMobileTab) {
              onSelectMobileTab("chat");
            } else {
              router.push("/chat");
            }
          }}
          className="flex items-center shrink-0 active:scale-95 transition-transform cursor-pointer"
          title="Apiapia 助理"
        >
          <BrandLogo size={28} className="shadow-xs" />
        </button>

        {/* Center / Content: Title or Custom elements */}
        {title ? (
          <h1 className="text-[17px] font-semibold text-foreground tracking-tight truncate flex-1 min-w-0 text-center">
            {title}
          </h1>
        ) : (
          children
        )}

        {/* Right: Personal Settings Avatar Dropdown */}
        <div className="shrink-0 flex items-center">
          {right ?? <UserAvatarDropdown onSelectMobileTab={onSelectMobileTab} />}
        </div>
      </div>
    </header>
  );
};
