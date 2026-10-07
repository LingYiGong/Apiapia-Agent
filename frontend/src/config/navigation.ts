import { AlignLeft, BarChart3, Brain, MessageSquare, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * 全站导航的唯一事实来源。
 *
 * 此前导航项在三处各写一遍，且彼此不一致：
 * - Navbar 桌面导航：4 项（chat / memory / usage / settings）
 * - Navbar 移动底栏：3 项（chat / history / memory）—— **用量与设置在移动端
 *   完全没有入口**，只能从头像菜单二级进入
 * - UserAvatarDropdown：3 项（settings / usage / memory），与桌面导航重复
 * 五个顶层页面因此没有统一定义，移动端还少两个入口。
 *
 * 现在统一到这里：新增/改名/增删入口只改这一处。
 */

export type NavId = "chat" | "history" | "memory" | "usage" | "settings";

/**
 * 移动端 SPA 页签。
 *
 * 定义在此处而非 `components/layout/UserAvatarDropdown.tsx`：
 * 那个文件是叶子 UI 组件，却被 chat 页面、MemoryView / UsageView /
 * SettingsView、MobileHeader、MobileHistoryView、ChatHeader、Navbar 共 7 处
 * 反向 import 只为拿一个类型，而它自己又 import 本文件 —— 布局层之间形成
 * 横向耦合，且方向是反的（上层依赖下层的类型）。
 */
export type MobileTab = NavId;

export interface NavItem {
  id: NavId;
  /** 桌面 <Link> 与深链使用的独立路由 */
  href: string;
  /** 移动端 SPA 页签地址；对话页本身没有子页签 */
  mobileHref: string;
  /** 完整标签，桌面宽屏显示 */
  label: string;
  /** 收窄标签，桌面 lg 以下显示 */
  shortLabel: string;
  /** 头像菜单里的二级文案 */
  menuLabel: string;
  /** MobileHeader 居中标题；不传则该页签用 children 自定义中间内容 */
  mobileTitle?: string;
  Icon: LucideIcon;
  /** 图标底色，avatar 菜单的彩色 squircle */
  tint: string;
  /** 是否出现在桌面顶栏 */
  inDesktopNav: boolean;
  /** 是否出现在移动端底部标签栏 */
  inMobileTabBar: boolean;
}

export const NAV_ITEMS: readonly NavItem[] = [
  {
    id: "chat",
    href: "/chat",
    mobileHref: "/chat",
    label: "对话",
    shortLabel: "对话",
    menuLabel: "对话",
    Icon: MessageSquare,
    tint: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
    inDesktopNav: true,
    inMobileTabBar: true,
  },
  {
    // 历史没有独立路由：它是 /chat 内的全屏页签。
    // 因此不占桌面顶栏位置（桌面侧栏常驻可见），只作为移动端页签存在。
    id: "history",
    href: "/chat",
    mobileHref: "/chat?tab=history",
    label: "历史",
    shortLabel: "历史",
    menuLabel: "历史对话",
    mobileTitle: "历史会话",
    Icon: AlignLeft,
    tint: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
    inDesktopNav: false,
    inMobileTabBar: true,
  },
  {
    id: "memory",
    href: "/memory",
    mobileHref: "/chat?tab=memory",
    label: "记忆库",
    shortLabel: "记忆",
    menuLabel: "长期记忆库",
    mobileTitle: "记忆库",
    Icon: Brain,
    tint: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    inDesktopNav: true,
    inMobileTabBar: true,
  },
  {
    id: "usage",
    href: "/usage",
    mobileHref: "/chat?tab=usage",
    label: "用量",
    shortLabel: "用量",
    menuLabel: "用量与账单",
    mobileTitle: "用量与账单",
    Icon: BarChart3,
    tint: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    inDesktopNav: true,
    inMobileTabBar: true,
  },
  {
    id: "settings",
    href: "/settings",
    mobileHref: "/chat?tab=settings",
    label: "设置",
    shortLabel: "设置",
    menuLabel: "偏好设置",
    mobileTitle: "偏好设置",
    Icon: Settings,
    tint: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
    inDesktopNav: true,
    inMobileTabBar: true,
  },
];

export const DESKTOP_NAV_ITEMS = NAV_ITEMS.filter((i) => i.inDesktopNav);
export const MOBILE_TAB_ITEMS = NAV_ITEMS.filter((i) => i.inMobileTabBar);

/** 头像菜单里的二级入口：除对话与历史外都进得去 */
export const ACCOUNT_MENU_ITEMS = NAV_ITEMS.filter(
  (i) => i.id !== "chat" && i.id !== "history"
);

/** 所有移动端 SPA 页签 id，用于 URL ?tab= 的白名单校验。 */
export const MOBILE_TAB_IDS: readonly MobileTab[] = NAV_ITEMS.map((i) => i.id);

/** 从 URL query 里解析移动端页签；非法值返回 null（交给调用方保持现状）。 */
export function parseMobileTab(raw: string | null): MobileTab | null {
  if (!raw) return null;
  return (MOBILE_TAB_IDS as readonly string[]).includes(raw) ? (raw as MobileTab) : null;
}
