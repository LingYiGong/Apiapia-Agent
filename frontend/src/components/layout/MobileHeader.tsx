"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/common/BrandLogo";
import { UserAvatarMenu } from "@/components/layout/UserAvatarDropdown";
import type { MobileTab } from "@/config/navigation";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";

interface MobileHeaderProps {
  /** 居中标题。与 children 二选一。 */
  title?: string;
  /** 自定义中间内容（例如聊天页的模型选择器） */
  children?: React.ReactNode;
  /** 自定义右侧内容，默认是头像菜单 */
  right?: React.ReactNode;
  className?: string;
  /** SPA 页签切换回调 */
  onSelectMobileTab?: (tab: MobileTab) => void;
  /** 点击 logo 的行为（决定 aria-label 与跳转目标） */
  logoAction?: "go-home" | "new-chat";
  onLogoClick?: () => void;
}

/** 移动端导航栏组件 */
export const MobileHeader: React.FC<MobileHeaderProps> = ({
  title,
  children,
  right,
  className,
  onSelectMobileTab,
  logoAction = "go-home",
  onLogoClick,
}) => {
  const router = useRouter();
  const { t } = useI18n();

  const logoLabel =
    logoAction === "new-chat" ? t("nav.newChat") : t("nav.chat.mobileTitle");

  return (
    <header
      className={cn(
        "z-30 w-full shrink-0 select-none border-b border-border/40 bg-background/90 pt-[var(--sat)] backdrop-blur-xl md:hidden",
        className
      )}
    >
      <div className="flex h-[var(--header-h)] min-w-0 items-center justify-between gap-2.5 pl-[max(0.75rem,var(--sal))] pr-[max(0.75rem,var(--sar))] sm:pl-[max(1rem,var(--sal))] sm:pr-[max(1rem,var(--sar))]">
        <button
          type="button"
          onClick={() => {
            if (onLogoClick) {
              onLogoClick();
            } else if (onSelectMobileTab) {
              onSelectMobileTab("chat");
            } else {
              router.push("/chat");
            }
          }}
          className="flex shrink-0 cursor-pointer items-center transition-transform active:scale-95"
          aria-label={logoLabel}
        >
          <BrandLogo size={28} className="shadow-xs" />
        </button>

        {title ? (
          <h1 className="min-w-0 flex-1 truncate text-center text-body font-semibold text-foreground">
            {title}
          </h1>
        ) : (
          children
        )}

        <div className="flex shrink-0 items-center">
          {right ?? <UserAvatarMenu onSelectMobileTab={onSelectMobileTab} />}
        </div>
      </div>
    </header>
  );
};
