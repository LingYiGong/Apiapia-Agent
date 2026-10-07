"use client";

import React from "react";
import { DesktopNavbar, MobileTabBar } from "@/components/layout/Navbar";
import { MobileHeader } from "@/components/layout/MobileHeader";
import type { MobileTab } from "@/config/navigation";
import { cn } from "@/lib/utils";

/**
 * 顶层视图的统一外壳。
 *
 * MemoryView / UsageView / SettingsView 三个文件开头是逐字相同的一段：
 *
 *   <div className="flex flex-col h-full overflow-hidden bg-background w-full
 *                  {h-full | h-dvh}">
 *     {!isMobileSpa && <Navbar />}
 *     <MobileHeader title="…" onSelectMobileTab={…} />
 *     <div className="flex-1 overflow-y-auto overscroll-contain">
 *       <main className="max-w-… p-4 sm:p-6 md:p-8 pb-…">
 *
 * 三份各自维护，而 `max-w-3xl` / `max-w-6xl`、底部留白（为了给浮动保存条 /
 * 移动底栏让位）等数值又各不相同。现在由本组件统一。
 *
 * 另一处收益：移动端 **MobileHeader 只在需要时渲染**。此前它虽然带 `md:hidden`，
 * 但在桌面路由下依然会挂载 —— 连带把 UserAvatarMenu（Radix Menu + Portal）也
 * 挂上，白白多一份 DOM 与一层浮层容器。
 */

export interface ViewShellProps {
  /** 移动端头部标题 */
  title: string;
  /** true = 运行在 /chat 的移动端 SPA 里（不自带顶栏与底栏） */
  isMobileSpa?: boolean;
  onSelectMobileTab?: (tab: MobileTab) => void;
  /** 移动端头部右侧的自定义内容 */
  headerRight?: React.ReactNode;
  /** 内容最大宽度 */
  maxWidth?: "3xl" | "6xl";
  /** 主内容底部留白（px） */
  contentClassName?: string;
  className?: string;
  children: React.ReactNode;
}

export function ViewShell({
  title,
  isMobileSpa = false,
  onSelectMobileTab,
  headerRight,
  maxWidth = "3xl",
  contentClassName,
  className,
  children,
}: ViewShellProps) {
  const showDesktopChrome = !isMobileSpa;

  return (
    <div
      className={cn(
        // relative：SaveActionBar 用 absolute 定位在容器底部居中
        "relative flex h-full w-full flex-col overflow-hidden bg-background text-foreground",
        className
      )}
    >
      {showDesktopChrome && <DesktopNavbar />}

      {/* MobileHeader 自带 md:hidden，但这里在桌面路由下干脆不渲染 */}
      {!showDesktopChrome && (
        <MobileHeader
          title={title}
          onSelectMobileTab={onSelectMobileTab}
          right={headerRight}
        />
      )}

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <main
          className={cn(
            "mx-auto w-full space-y-5 p-4 sm:p-6 md:p-8",
            // 独立路由底部要让开 MobileTabBar；SPA 模式下底栏由 chat 页面负责，
            // 视图内部还要避开自己的浮动保存条，故留出更大内边距。
            isMobileSpa ? "pb-24 md:pb-28" : "pb-24 md:pb-12",
            maxWidth === "6xl" ? "max-w-6xl" : "max-w-3xl",
            contentClassName
          )}
        >
          {children}
        </main>
      </div>

      {showDesktopChrome && <MobileTabBar />}
    </div>
  );
}
