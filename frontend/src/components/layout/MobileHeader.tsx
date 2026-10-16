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
  /**
   * 点击 logo 的行为。
   *
   * 此前聊天页把「新建对话」挂在这个 prop 上，于是按钮的无障碍名称仍是硬编码的
   * 「Apiapia 助理首页」—— 读屏用户激活「首页」结果新建了会话。现在显式声明
   * logo 的用途，它同时决定 aria-label，避免文案与行为脱节。
   */
  logoAction?: "go-home" | "new-chat";
  onLogoClick?: () => void;
}

/**
 * Apple HIG Mobile Navigation Bar
 * 行高 48px (h-12) + env(safe-area-inset-top)，引用 --header-h。
 * 仅 md 以下渲染（父级负责隐藏，非本组件）。
 * 结构：[Logo] -> [Title 或 Custom] -> [Avatar Menu]
 *
 * 不使用 sticky：所有使用方的外层都是 `flex flex-col overflow-hidden` 的定高容器，
 * 滚动发生在兄弟节点上，sticky 在这里不会产生任何位移，留着只会误导后来人
 * 以为头部可以跟着内容滚动。
 */
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
      {/* pt-[var(--sat)] 移至外层 header，使顶栏自适应增高（48px + 安全区高度）；
          内部内容行维持 48px 高度并居中对齐，避免在刘海屏/灵动岛机型上因 border-box 导致内容被裁切压缩。
          pl/pr 跟随 --sal/--sar，横屏刘海与 Android edge-to-edge 都不会裁到 logo 或头像。 */}
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
