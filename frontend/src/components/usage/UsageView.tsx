"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";
import { Navbar } from "@/components/layout/Navbar";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { MyUsageStats, AdminOverviewStats } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ActionTooltip } from "@/components/common/ActionTooltip";
import { useRefreshOnResume } from "@/lib/useRefreshOnResume";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { FullPageSkeleton, StatCardsSkeleton } from "@/components/common/PageSkeleton";
import {
  BarChart3,
  Users,
  Coins,
  Cpu,
  Calendar,
  MessageSquare,
  TrendingUp,
  RefreshCw,
  UserCheck,
  UserX,
  Shield,
  MoreHorizontal,
  Zap,
  DollarSign,
  Clock,
  Eye,
  RotateCcw,
  FileText,
  CheckCircle2,
  Trash2,
  Activity,
  Sparkles,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";

import { MobileTab } from "@/components/layout/UserAvatarDropdown";

type PeriodType = "today" | "month" | "year" | "all";

export interface UsageViewProps {
  isMobileSpa?: boolean;
  onSelectMobileTab?: (tab: MobileTab) => void;
  /** 移动端 SPA 里该页签当前是否可见；用于切回时补一次刷新 */
  active?: boolean;
}

export const UsageView: React.FC<UsageViewProps> = ({
  isMobileSpa = false,
  onSelectMobileTab,
  active = true,
}) => {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"overview" | "my">("overview");
  const [period, setPeriod] = useState<PeriodType>("all");
  const [adminStats, setAdminStats] = useState<AdminOverviewStats | null>(null);
  const [myStats, setMyStats] = useState<MyUsageStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Admin Audit Modal State
  const [auditUser, setAuditUser] = useState<{ id: string; username: string } | null>(null);
  const [auditConversations, setAuditConversations] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditFilter, setAuditFilter] = useState<"all" | "active" | "deleted">("all");
  const [inspectData, setInspectData] = useState<{ conversation: any; messages: any[] } | null>(null);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState<string | null>(null);
  const [modelSortKey, setModelSortKey] = useState<"cost" | "tokens">("cost");

  // 统一确认框状态（替代原生 confirm）
  const [pendingConfirm, setPendingConfirm] = useState<{
    title: string;
    description: string;
    confirmText: string;
    danger: boolean;
    onConfirm: () => void;
  } | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  const fetchStats = async (pOverride?: PeriodType) => {
    const targetPeriod = pOverride || period;
    setIsLoading(true);
    const tzOffset = new Date().getTimezoneOffset();
    try {
      if (user?.is_superuser) {
        const [admData, myData] = await Promise.all([
          apiRequest<AdminOverviewStats>(`/stats/admin/overview?period=${targetPeriod}&tz_offset=${tzOffset}`),
          apiRequest<MyUsageStats>(`/stats/my?period=${targetPeriod}&tz_offset=${tzOffset}`),
        ]);
        setAdminStats(admData);
        setMyStats(myData);
      } else {
        const myData = await apiRequest<MyUsageStats>(`/stats/my?period=${targetPeriod}&tz_offset=${tzOffset}`);
        setMyStats(myData);
        setActiveTab("my");
      }
    } catch (err: any) {
      console.error("Failed to fetch stats:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // 移动端 SPA 里五个页签是同时挂载、只切换 CSS 显隐的。若这里不按 active 收口，
    // 桌面端打开 /chat 时用量统计也会跟着请求一遍（此时它被 `md:hidden` 完全盖住）。
    // 把 active 放进依赖后，用户切到本标签时会自动补上首次加载。
    if (isMobileSpa && !active) return;
    if (user) {
      fetchStats();
    }
  }, [user, isMobileSpa, active]);

  // 切后台 / 切回本页签时刷新，让用量数字跟上别的设备产生的新消耗。
  // 正在执行管理操作时跳过，避免和操作反馈抢状态。
  useRefreshOnResume(() => fetchStats(), {
    enabled: !!user && actionLoading === null,
    visible: active,
  });

  const handlePeriodChange = (newPeriod: PeriodType) => {
    setPeriod(newPeriod);
    fetchStats(newPeriod);
  };

  const handleToggleActive = (userId: string, currentStatus: boolean, username: string) => {
    setPendingConfirm({
      title: `${currentStatus ? "停用" : "启用"}用户`,
      description: `确定要${currentStatus ? "停用" : "启用"}用户「${username}」吗？${
        currentStatus ? "停用后该用户将无法登录使用。" : ""
      }`,
      confirmText: currentStatus ? "停用" : "启用",
      danger: currentStatus,
      onConfirm: async () => {
        setPendingConfirm(null);
        setActionLoading(userId);
        try {
          await apiRequest(`/stats/admin/users/${userId}/toggle-active`, { method: "POST" });
          await fetchStats();
          toast.success(`已${currentStatus ? "停用" : "启用"}用户「${username}」`);
        } catch (err: any) {
          toast.error(err.message || `${currentStatus ? "停用" : "启用"}用户失败`);
        } finally {
          setActionLoading(null);
        }
      },
    });
  };

  const handleToggleAdmin = (userId: string, currentAdmin: boolean, username: string) => {
    setPendingConfirm({
      title: `${currentAdmin ? "取消" : "授予"}管理员权限`,
      description: `确定要${currentAdmin ? "取消" : "设置"}用户「${username}」的超级管理员权限吗？`,
      confirmText: currentAdmin ? "取消权限" : "设为管理员",
      danger: currentAdmin,
      onConfirm: async () => {
        setPendingConfirm(null);
        setActionLoading(userId);
        try {
          await apiRequest(`/stats/admin/users/${userId}/toggle-admin`, { method: "POST" });
          await fetchStats();
          toast.success(`已${currentAdmin ? "取消" : "授予"}用户「${username}」的管理员权限`);
        } catch (err: any) {
          toast.error(err.message || "修改管理员权限失败");
        } finally {
          setActionLoading(null);
        }
      },
    });
  };

  const handleToggleAllModels = (userId: string, currentAccessAll: boolean, username: string) => {
    const nextStatus = !currentAccessAll;
    setPendingConfirm({
      title: `${nextStatus ? "开通" : "限制"}模型访问权限`,
      description: nextStatus
        ? `确定为用户「${username}」开通完整体验权限吗？开通后该用户可使用系统内包括所有高级付费模型在内的全部可用模型。`
        : `确定将用户「${username}」切换为体验模式吗？切换后该用户将只能访问和调用免费模型。`,
      confirmText: nextStatus ? "开通完整体验" : "切换为体验模式",
      danger: !nextStatus,
      onConfirm: async () => {
        setPendingConfirm(null);
        setActionLoading(`model-${userId}`);
        try {
          await apiRequest(`/stats/admin/users/${userId}/toggle-all-models`, {
            method: "POST",
            body: JSON.stringify({ can_access_all_models: nextStatus }),
          });
          await fetchStats();
          toast.success(`已为用户「${username}」${nextStatus ? "开通完整体验" : "切换为体验模式"}`);
        } catch (err: any) {
          toast.error(err.message || "修改模型访问权限失败");
        } finally {
          setActionLoading(null);
        }
      },
    });
  };

  const fetchAuditList = async (userId: string) => {
    setAuditLoading(true);
    try {
      const data = await apiRequest<any[]>(`/stats/admin/users/${userId}/conversations`);
      setAuditConversations(data || []);
    } catch (err: any) {
      toast.error(err.message || "获取对话列表失败");
    } finally {
      setAuditLoading(false);
    }
  };

  const handleOpenAudit = (userId: string, username: string) => {
    setAuditUser({ id: userId, username });
    setAuditFilter("all");
    setInspectData(null);
    fetchAuditList(userId);
  };

  const handleInspectMessages = async (conversationId: string) => {
    setInspectLoading(true);
    try {
      const res = await apiRequest<{ conversation: any; messages: any[] }>(
        `/stats/admin/conversations/${conversationId}/messages`
      );
      setInspectData(res);
    } catch (err: any) {
      toast.error(err.message || "获取对话消息失败");
    } finally {
      setInspectLoading(false);
    }
  };

  const handleAdminRestore = async (convId: string, title: string) => {
    if (!auditUser) return;
    setRestoreLoading(convId);
    try {
      await apiRequest(`/stats/admin/conversations/${convId}/restore`, { method: "POST" });
      await fetchAuditList(auditUser.id);
      await fetchStats();
      toast.success(`已恢复对话「${title}」`);
    } catch (err: any) {
      toast.error(err.message || "恢复对话失败");
    } finally {
      setRestoreLoading(null);
    }
  };

  if (loading || !user) return <FullPageSkeleton variant="list" />;

  const isSuperuser = !!user.is_superuser;

  const periodLabels: Record<PeriodType, string> = {
    today: "今天",
    month: "本月",
    year: "今年",
    all: "全部累计",
  };

  const currentPeriodName = periodLabels[period];

  return (
    <div className={cn("flex flex-col h-full overflow-hidden bg-background w-full", !isMobileSpa && "h-dvh")}>
      {!isMobileSpa && <Navbar />}
      {/* ── Apple HIG Standard Mobile Navigation Bar ── */}
      <MobileHeader title="用量与账单" onSelectMobileTab={onSelectMobileTab} />

      <div className="flex-1 overflow-y-auto overscroll-contain">
        <main className="max-w-6xl w-full mx-auto p-4 sm:p-6 md:p-8 space-y-5 pb-6 md:pb-12">
          {/* ── Desktop Header ── */}
          <div className="hidden md:flex flex-row items-center justify-between gap-4 pb-5 border-b border-border/40">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-medium text-primary tracking-tight flex items-center gap-1.5">
                  <BarChart3 className="h-4 w-4 shrink-0" />
                  <span>{isSuperuser ? "平台用量监控" : "个人用量统计"}</span>
                </span>
                {isSuperuser && (
                  <Badge className="text-[10px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded-full px-2 py-0.5 shadow-none">
                    管理员
                  </Badge>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
                {isSuperuser ? "平台用量与成本核算" : "我的用量总览"}
              </h1>
              <p className="text-[13px] text-muted-foreground leading-relaxed max-w-2xl">
                {isSuperuser
                  ? "统计所有注册用户的 Token 消耗、调用轮次与模型定价折算费用，支持时间区间筛选与账号权限管控。"
                  : "查看你在本平台产生的全部对话轮次、输入/输出 Token 消耗及模型调用明细。"}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchStats()}
                disabled={isLoading}
                className="h-8 px-3.5 rounded-full text-xs font-medium gap-1.5 border-border/50 bg-card/80 hover:bg-muted active:scale-95 transition-all shadow-2xs"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin text-primary")} />
                <span>刷新数据</span>
              </Button>
            </div>
          </div>

          {/* ── Mobile Quick Action Sub-bar ── */}
          <div className="flex md:hidden items-center justify-between gap-2 pb-0.5">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                {isSuperuser ? "平台管理员控制台" : "个人用量统计"}
              </span>
              {isSuperuser && (
                <Badge className="text-[9px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded-full px-1.5 py-0 shadow-none">
                  ADMIN
                </Badge>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchStats()}
              disabled={isLoading}
              className="h-7 px-3 rounded-full text-[11px] font-medium gap-1.5 border-border/50 bg-card/80 hover:bg-muted active:scale-95 transition-all shadow-2xs"
            >
              <RefreshCw className={cn("h-3 w-3", isLoading && "animate-spin text-primary")} />
              <span>刷新</span>
            </Button>
          </div>

          {/* ── Apple HIG Segmented Control: Time Period Filter ── */}
          <div className="p-2 sm:p-2.5 rounded-2xl border border-border/50 bg-card/80 dark:bg-[#1C1C1E]/80 backdrop-blur-md shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 shrink-0">
              <span className="text-xs font-medium text-muted-foreground pl-1 shrink-0 whitespace-nowrap">
                统计区间:
              </span>
              <Tabs
                value={period}
                onValueChange={(v) => handlePeriodChange(v as PeriodType)}
                className="shrink-0"
              >
                <TabsList className="h-8 p-1 rounded-xl bg-muted/60 dark:bg-muted/40 backdrop-blur-sm border border-border/40 gap-1">
                  <TabsTrigger
                    value="today"
                    className="h-6 px-2.5 rounded-lg text-xs font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-2xs transition-all"
                  >
                    <Zap className="h-3 w-3 mr-1 text-amber-500" />
                    <span>今天</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="month"
                    className="h-6 px-2.5 rounded-lg text-xs font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-2xs transition-all"
                  >
                    <Calendar className="h-3 w-3 mr-1 text-blue-500" />
                    <span>本月</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="year"
                    className="h-6 px-2.5 rounded-lg text-xs font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-2xs transition-all"
                  >
                    <TrendingUp className="h-3 w-3 mr-1 text-indigo-500" />
                    <span>今年</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="all"
                    className="h-6 px-2.5 rounded-lg text-xs font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-2xs transition-all"
                  >
                    <Coins className="h-3 w-3 mr-1 text-emerald-500" />
                    <span>全部累计</span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="text-[11px] text-muted-foreground/80 font-mono px-2 py-0.5 rounded-md bg-muted/30 border border-border/20 shrink-0 self-start sm:self-auto">
              {period === "today" && "⚡ 今日 00:00 至今"}
              {period === "month" && "📅 本月 1 日 00:00 至今"}
              {period === "year" && "📆 本年 1 月 1 日至今"}
              {period === "all" && "🌐 历史全部数据汇总"}
            </div>
          </div>

          {/* ── Tab Switcher for Super Admin ── */}
          {isSuperuser && (
            <div className="flex items-center">
              <Tabs
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as "overview" | "my")}
              >
                <TabsList className="h-9 p-1 rounded-xl bg-muted/60 dark:bg-muted/40 backdrop-blur-sm border border-border/40 gap-1 inline-flex">
                  <TabsTrigger
                    value="overview"
                    className="h-7 px-3.5 rounded-lg text-xs sm:text-sm font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-2xs transition-all flex items-center gap-1.5"
                  >
                    <Users className="h-3.5 w-3.5 text-indigo-500" />
                    <span>全部用户</span>
                    {adminStats && (
                      <span className="text-[10px] font-mono px-1.5 py-px rounded-full bg-primary/10 text-primary font-semibold">
                        {adminStats.total_users}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger
                    value="my"
                    className="h-7 px-3.5 rounded-lg text-xs sm:text-sm font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-2xs transition-all flex items-center gap-1.5"
                  >
                    <UserCheck className="h-3.5 w-3.5 text-emerald-500" />
                    <span>我的用量</span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          )}

          {/* Loading Skeletons */}
          {isLoading && !adminStats && !myStats && <StatCardsSkeleton />}

          {/* ===================== TAB 1: ALL USERS OVERVIEW (SUPER ADMIN ONLY) ===================== */}
          {isSuperuser && activeTab === "overview" && adminStats && (
            <div className="space-y-6">
              {/* ── KPI Metric Cards (Apple HIG 4-Column Grid) ── */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {/* Card 1: Users */}
                <div className="p-4 sm:p-5 rounded-2xl border border-border/50 bg-card/80 dark:bg-[#1C1C1E]/80 backdrop-blur-md shadow-2xs space-y-3 hover:border-border/80 transition-all duration-200">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-medium text-muted-foreground tracking-tight">
                      注册总用户
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 flex items-center justify-center shrink-0">
                      <Users className="h-4 w-4" />
                    </div>
                  </div>
                  <div>
                    <div className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground tabular-nums">
                      {adminStats.total_users}
                      <span className="text-xs font-normal text-muted-foreground ml-1">位</span>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-border/30 flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>活跃账号: {adminStats.active_users} 位</span>
                  </div>
                </div>

                {/* Card 2: Messages */}
                <div className="p-4 sm:p-5 rounded-2xl border border-border/50 bg-card/80 dark:bg-[#1C1C1E]/80 backdrop-blur-md shadow-2xs space-y-3 hover:border-border/80 transition-all duration-200">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-medium text-muted-foreground tracking-tight">
                      对话轮次
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 dark:text-blue-400 flex items-center justify-center shrink-0">
                      <MessageSquare className="h-4 w-4" />
                    </div>
                  </div>
                  <div>
                    <div className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground tabular-nums">
                      {adminStats.total_messages.toLocaleString()}
                      <span className="text-xs font-normal text-muted-foreground ml-1">次</span>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-border/30 text-[11px] text-muted-foreground/90 font-mono truncate">
                    共涉及 {adminStats.total_conversations} 个对话会话
                  </div>
                </div>

                {/* Card 3: Tokens */}
                <div className="p-4 sm:p-5 rounded-2xl border border-border/50 bg-card/80 dark:bg-[#1C1C1E]/80 backdrop-blur-md shadow-2xs space-y-3 hover:border-border/80 transition-all duration-200">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-medium text-muted-foreground tracking-tight">
                      Token 消耗
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 dark:text-amber-400 flex items-center justify-center shrink-0">
                      <Coins className="h-4 w-4" />
                    </div>
                  </div>
                  <div>
                    <div className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground tabular-nums truncate">
                      {adminStats.total_tokens.toLocaleString()}
                    </div>
                  </div>
                  <div className="pt-2 border-t border-border/30 text-[11px] text-muted-foreground/90 font-mono truncate">
                    入: {adminStats.total_prompt_tokens.toLocaleString()} · 出: {adminStats.total_completion_tokens.toLocaleString()}
                  </div>
                </div>

                {/* Card 4: Estimated Cost */}
                <div className="p-4 sm:p-5 rounded-2xl border border-border/50 bg-card/80 dark:bg-[#1C1C1E]/80 backdrop-blur-md shadow-2xs space-y-3 hover:border-border/80 transition-all duration-200">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-medium text-muted-foreground tracking-tight">
                      预估费用支出
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <DollarSign className="h-4 w-4" />
                    </div>
                  </div>
                  <div>
                    <div className="text-2xl sm:text-3xl font-semibold tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums truncate">
                      ¥{adminStats.total_cost_cny.toFixed(2)}
                    </div>
                  </div>
                  <div className="pt-2 border-t border-border/30 text-[11px] text-muted-foreground/90 font-mono truncate">
                    约 ${adminStats.total_cost_usd.toFixed(4)} USD (汇率 7.25)
                  </div>
                </div>
              </div>

              {/* ── User Breakdown Table (Apple HIG Table View) ── */}
              <div className="rounded-2xl border border-border/50 bg-card/80 dark:bg-[#1C1C1E]/80 backdrop-blur-md shadow-2xs overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-border/40 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 flex items-center justify-center shrink-0">
                      <Activity className="h-4 w-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold tracking-tight text-foreground">
                        各用户消耗明细 ({currentPeriodName})
                      </h2>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        按当前时间区间总 Token 排序，支持查看审计明细与账号权限管理。
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono bg-muted/60 px-2.5 py-0.5 rounded-full border border-border/40 shrink-0 self-start sm:self-auto">
                    共 {adminStats.users.length} 位用户
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <Table className="text-xs">
                    <TableHeader className="bg-muted/30">
                      <TableRow className="border-b border-border/40">
                        <TableHead className="py-3 px-4 whitespace-nowrap text-[11px] font-medium text-muted-foreground">用户</TableHead>
                        <TableHead className="py-3 px-4 whitespace-nowrap text-[11px] font-medium text-muted-foreground">对话轮次</TableHead>
                        <TableHead className="py-3 px-4 whitespace-nowrap text-[11px] font-medium text-muted-foreground">总 Token 消耗</TableHead>
                        <TableHead className="py-3 px-4 whitespace-nowrap text-[11px] font-medium text-muted-foreground">输入 / 输出明细</TableHead>
                        <TableHead className="py-3 px-4 whitespace-nowrap text-[11px] font-medium text-muted-foreground">折算花费 (CNY / USD)</TableHead>
                        <TableHead className="py-3 px-4 whitespace-nowrap text-[11px] font-medium text-muted-foreground">常用模型</TableHead>
                        <TableHead className="py-3 px-4 whitespace-nowrap text-[11px] font-medium text-muted-foreground">状态</TableHead>
                        <TableHead className="py-3 px-4 whitespace-nowrap text-[11px] font-medium text-muted-foreground">模型权限开关</TableHead>
                        <TableHead className="py-3 px-4 whitespace-nowrap text-[11px] font-medium text-muted-foreground text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {adminStats.users.map((u) => {
                        const isMe = u.user_id === user.id;
                        return (
                          <TableRow
                            key={u.user_id}
                            className="hover:bg-muted/40 transition-colors border-b border-border/30 last:border-0"
                          >
                            <TableCell className="py-3.5 px-4 whitespace-nowrap">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-full bg-primary/10 text-primary font-semibold text-xs flex items-center justify-center shrink-0 uppercase select-none">
                                  {u.username.slice(0, 1)}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-semibold text-foreground">
                                      {u.username}
                                    </span>
                                    {isMe && (
                                      <Badge variant="secondary" className="text-[10px] font-medium rounded-full px-1.5 py-0">
                                        我
                                      </Badge>
                                    )}
                                    {u.is_superuser && (
                                      <Badge className="text-[10px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded-full px-1.5 py-0 shadow-none">
                                        管理员
                                      </Badge>
                                    )}
                                  </div>
                                  <span
                                    className="block max-w-[200px] truncate text-[11px] text-muted-foreground font-mono mt-0.5"
                                    title={u.email}
                                  >
                                    {u.email}
                                  </span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="py-3.5 px-4 font-mono whitespace-nowrap tabular-nums">
                              <span className="font-semibold text-foreground">{u.messages_count}</span>
                              <span className="text-muted-foreground text-[11px]"> 轮 ({u.conversations_count} 会话)</span>
                            </TableCell>
                            <TableCell className="py-3.5 px-4 font-mono font-semibold whitespace-nowrap tabular-nums">
                              {u.total_tokens.toLocaleString()}
                            </TableCell>
                            <TableCell className="py-3.5 px-4 font-mono text-[11px] text-muted-foreground whitespace-nowrap tabular-nums">
                              <div>↓ 入: {u.prompt_tokens.toLocaleString()}</div>
                              <div>↑ 出: {u.completion_tokens.toLocaleString()}</div>
                            </TableCell>
                            <TableCell className="py-3.5 px-4 font-mono whitespace-nowrap tabular-nums">
                              <div className="font-semibold text-emerald-600 dark:text-emerald-400">
                                ¥{u.estimated_cost_cny.toFixed(2)}
                              </div>
                              <div className="text-[10px] text-muted-foreground">
                                ${u.estimated_cost_usd.toFixed(4)}
                              </div>
                            </TableCell>
                            <TableCell
                              className="py-3.5 px-4 font-mono text-[11px] text-muted-foreground max-w-[180px] truncate"
                              title={u.top_model}
                            >
                              <span className="px-2 py-0.5 rounded-md bg-muted/50 border border-border/30">
                                {u.top_model || "未调用"}
                              </span>
                            </TableCell>
                            <TableCell className="py-3.5 px-4 whitespace-nowrap">
                              {u.is_active ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                                  正常
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-destructive/10 text-destructive border border-destructive/20">
                                  <span className="h-1.5 w-1.5 rounded-full bg-destructive"></span>
                                  已停用
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="py-3.5 px-4 whitespace-nowrap">
                              {u.is_superuser ? (
                                <div className="flex items-center gap-1.5">
                                  <Badge className="text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-full px-2 py-0.5 shadow-none">
                                    完整体验 (管理员)
                                  </Badge>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <Switch
                                    checked={!!u.can_access_all_models}
                                    disabled={actionLoading === `model-${u.user_id}`}
                                    onCheckedChange={() => handleToggleAllModels(u.user_id, !!u.can_access_all_models, u.username)}
                                    aria-label={`切换用户 ${u.username} 模型访问权限`}
                                  />
                                  <span
                                    className={cn(
                                      "text-[11px] font-medium select-none cursor-pointer transition-colors",
                                      u.can_access_all_models
                                        ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                                        : "text-amber-600 dark:text-amber-400"
                                    )}
                                    onClick={() => handleToggleAllModels(u.user_id, !!u.can_access_all_models, u.username)}
                                  >
                                    {u.can_access_all_models ? "完整体验" : "体验模式"}
                                  </span>
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                              <ActionTooltip label="审查该用户全部对话记录（含已删除对话）" side="left">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleOpenAudit(u.user_id, u.username)}
                                  className="h-7 px-2.5 text-[11px] font-medium rounded-full text-primary border-primary/20 bg-primary/5 hover:bg-primary/10 hover:text-primary active:scale-95 transition-all"
                                >
                                  <Eye className="h-3 w-3 mr-1" />
                                  <span>审查</span>
                                </Button>
                              </ActionTooltip>
                              {!isMe ? (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      disabled={actionLoading === u.user_id}
                                      className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted inline-flex align-middle"
                                    >
                                      <MoreHorizontal className="h-4 w-4" />
                                      <span className="sr-only">操作菜单</span>
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-44 rounded-xl p-1 shadow-lg border border-border/50">
                                    {!u.is_superuser && (
                                      <>
                                        <DropdownMenuItem
                                          onClick={() => handleToggleAllModels(u.user_id, !!u.can_access_all_models, u.username)}
                                          className="cursor-pointer text-xs rounded-lg px-2.5 py-1.5 text-foreground focus:bg-muted"
                                        >
                                          <Sparkles className="h-3.5 w-3.5 mr-2 text-indigo-500" />
                                          <span>{u.can_access_all_models ? "切换为体验模式" : "开通完整体验"}</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator className="my-1" />
                                      </>
                                    )}
                                    <DropdownMenuItem
                                      onClick={() => handleToggleActive(u.user_id, u.is_active, u.username)}
                                      className={cn(
                                        "cursor-pointer text-xs rounded-lg px-2.5 py-1.5",
                                        u.is_active
                                          ? "text-destructive focus:text-destructive focus:bg-destructive/10"
                                          : "text-emerald-600 focus:text-emerald-600 focus:bg-emerald-500/10"
                                      )}
                                    >
                                      {u.is_active ? (
                                        <>
                                          <UserX className="h-3.5 w-3.5 mr-2" />
                                          <span>停用账号</span>
                                        </>
                                      ) : (
                                        <>
                                          <UserCheck className="h-3.5 w-3.5 mr-2" />
                                          <span>恢复启用</span>
                                        </>
                                      )}
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator className="my-1" />
                                    <DropdownMenuItem
                                      onClick={() => handleToggleAdmin(u.user_id, u.is_superuser, u.username)}
                                      className="cursor-pointer text-xs rounded-lg px-2.5 py-1.5"
                                    >
                                      <Shield className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                                      <span>{u.is_superuser ? "取消管理员" : "设为管理员"}</span>
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              ) : (
                                <span className="text-[11px] text-muted-foreground italic ml-1">当前账号</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* ── Model Distribution Section (Apple HIG Ranked Cards) ── */}
              <div className="rounded-2xl border border-border/50 bg-card/80 dark:bg-[#1C1C1E]/80 backdrop-blur-md shadow-2xs p-5 space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 flex items-center justify-center shrink-0">
                      <Cpu className="h-4 w-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold tracking-tight text-foreground">
                        各模型调用分布与花费 ({currentPeriodName})
                      </h2>
                      <p className="text-xs text-muted-foreground">不同模型的调用量占比与折算费用排行</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] font-medium self-start sm:self-auto">
                    <span className="text-muted-foreground mr-0.5">排序:</span>
                    <Tabs
                      value={modelSortKey}
                      onValueChange={(v) => setModelSortKey(v as "cost" | "tokens")}
                    >
                      <TabsList className="h-7 p-0.5 rounded-lg bg-muted/60 dark:bg-muted/40 border border-border/40 gap-0.5">
                        <TabsTrigger
                          value="cost"
                          className="h-6 px-2.5 rounded-md text-[11px] font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-2xs transition-all"
                        >
                          按花费
                        </TabsTrigger>
                        <TabsTrigger
                          value="tokens"
                          className="h-6 px-2.5 rounded-md text-[11px] font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-2xs transition-all"
                        >
                          按 Token
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                </div>

                {adminStats.model_breakdown.length === 0 ? (
                  <div className="py-12 text-center text-xs text-muted-foreground">
                    该时间区间内暂无模型调用数据。
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {(() => {
                      const sortedModels = [...adminStats.model_breakdown].sort((a, b) =>
                        modelSortKey === "cost"
                          ? b.cost_cny - a.cost_cny || b.total_tokens - a.total_tokens
                          : b.total_tokens - a.total_tokens || b.cost_cny - a.cost_cny
                      );
                      const maxVal =
                        modelSortKey === "cost"
                          ? Math.max(...sortedModels.map((m) => m.cost_cny), 1)
                          : Math.max(...sortedModels.map((m) => m.total_tokens), 1);

                      return sortedModels.map((m, idx) => {
                        const currentVal = modelSortKey === "cost" ? m.cost_cny : m.total_tokens;
                        const percent = Math.min(Math.round((currentVal / maxVal) * 100), 100);

                        return (
                          <div
                            key={m.model}
                            className="p-3.5 rounded-xl border border-border/40 bg-muted/20 hover:bg-muted/40 dark:bg-muted/10 transition-colors space-y-2"
                          >
                            <div className="flex items-center gap-3">
                              <span
                                className={cn(
                                  "shrink-0 w-6 h-6 rounded-lg text-[11px] flex items-center justify-center font-semibold font-mono",
                                  idx === 0
                                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                                    : idx === 1
                                    ? "bg-slate-400/15 text-slate-600 dark:text-slate-300 border border-slate-400/30"
                                    : idx === 2
                                    ? "bg-amber-700/15 text-amber-700 dark:text-amber-500 border border-amber-700/30"
                                    : "bg-muted text-muted-foreground border border-border/40"
                                )}
                              >
                                {idx + 1}
                              </span>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-xs text-foreground truncate">
                                    {m.model}
                                  </span>
                                  {m.is_free && (
                                    <Badge className="text-[9px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-full px-1.5 py-0 shadow-none shrink-0">
                                      免费
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
                                  调用 {m.calls} 次 · Token {m.total_tokens.toLocaleString()}
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                <span className="font-semibold text-xs text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
                                  {m.is_free ? "¥0.00" : `¥${m.cost_cny.toFixed(2)}`}
                                </span>
                                <span className="text-[10px] text-muted-foreground font-mono block">
                                  ${m.cost_usd.toFixed(4)}
                                </span>
                              </div>
                            </div>

                            {/* Apple Screen-time Style Subtle Progress Bar */}
                            <div className="h-1.5 w-full bg-muted/60 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary/70 rounded-full transition-all duration-300"
                                style={{ width: `${Math.max(percent, 2)}%` }}
                              />
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>

              {/* ── Trend Section (Apple HIG Activity Grid) ── */}
              {adminStats.daily_trend.length > 0 && (
                <div className="rounded-2xl border border-border/50 bg-card/80 dark:bg-[#1C1C1E]/80 backdrop-blur-md shadow-2xs p-5 space-y-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 dark:text-blue-400 flex items-center justify-center shrink-0">
                      <Clock className="h-4 w-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold tracking-tight text-foreground">
                        {period === "today"
                          ? "今日各时段消耗走势 (Hourly Trend)"
                          : period === "year"
                          ? "今年各月份消耗走势 (Monthly Trend)"
                          : `${currentPeriodName}走势明细`}
                      </h2>
                      <p className="text-xs text-muted-foreground">各时间段的 Token 与费用趋势分布</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
                    {adminStats.daily_trend.map((d) => (
                      <div
                        key={d.date}
                        className="p-3 rounded-xl border border-border/40 bg-muted/20 hover:bg-muted/40 dark:bg-muted/10 text-center space-y-1 transition-all"
                      >
                        <div className="text-[11px] font-medium text-muted-foreground font-mono">
                          {d.date}
                        </div>
                        <div className="text-sm sm:text-base font-semibold font-mono tracking-tight text-foreground tabular-nums">
                          {d.tokens.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-muted-foreground/80 font-mono">
                          {d.calls} 次 · ¥{d.cost_cny.toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ===================== TAB 2: MY PERSONAL USAGE ===================== */}
          {((!isSuperuser) || activeTab === "my") && myStats && (
            <div className="space-y-6">
              {/* ── KPI Cards ── */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="p-4 sm:p-5 rounded-2xl border border-border/50 bg-card/80 dark:bg-[#1C1C1E]/80 backdrop-blur-md shadow-2xs space-y-3 hover:border-border/80 transition-all duration-200">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-medium text-muted-foreground tracking-tight">
                      对话轮次
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 flex items-center justify-center shrink-0">
                      <MessageSquare className="h-4 w-4" />
                    </div>
                  </div>
                  <div>
                    <div className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground tabular-nums">
                      {myStats.total_messages.toLocaleString()}
                      <span className="text-xs font-normal text-muted-foreground ml-1">次</span>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-border/30 text-[11px] text-muted-foreground/90 font-mono truncate">
                    涉及 {myStats.total_conversations} 个对话会话
                  </div>
                </div>

                <div className="p-4 sm:p-5 rounded-2xl border border-border/50 bg-card/80 dark:bg-[#1C1C1E]/80 backdrop-blur-md shadow-2xs space-y-3 hover:border-border/80 transition-all duration-200">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-medium text-muted-foreground tracking-tight">
                      Token 消耗
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 dark:text-amber-400 flex items-center justify-center shrink-0">
                      <Coins className="h-4 w-4" />
                    </div>
                  </div>
                  <div>
                    <div className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground tabular-nums truncate">
                      {myStats.total_tokens.toLocaleString()}
                    </div>
                  </div>
                  <div className="pt-2 border-t border-border/30 text-[11px] text-muted-foreground/90 font-mono truncate">
                    入: {myStats.prompt_tokens.toLocaleString()} · 出: {myStats.completion_tokens.toLocaleString()}
                  </div>
                </div>

                <div className="p-4 sm:p-5 rounded-2xl border border-border/50 bg-card/80 dark:bg-[#1C1C1E]/80 backdrop-blur-md shadow-2xs space-y-3 hover:border-border/80 transition-all duration-200">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-medium text-muted-foreground tracking-tight">
                      折算花费 (CNY)
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <DollarSign className="h-4 w-4" />
                    </div>
                  </div>
                  <div>
                    <div className="text-2xl sm:text-3xl font-semibold tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums truncate">
                      ¥{myStats.estimated_cost_cny.toFixed(2)}
                    </div>
                  </div>
                  <div className="pt-2 border-t border-border/30 text-[11px] text-muted-foreground/90 font-mono truncate">
                    按官方厂商定价规则折算
                  </div>
                </div>

                <div className="p-4 sm:p-5 rounded-2xl border border-border/50 bg-card/80 dark:bg-[#1C1C1E]/80 backdrop-blur-md shadow-2xs space-y-3 hover:border-border/80 transition-all duration-200">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-medium text-muted-foreground tracking-tight">
                      折算花费 (USD)
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 dark:text-blue-400 flex items-center justify-center shrink-0">
                      <TrendingUp className="h-4 w-4" />
                    </div>
                  </div>
                  <div>
                    <div className="text-2xl sm:text-3xl font-semibold tracking-tight text-blue-600 dark:text-blue-400 tabular-nums truncate">
                      ${myStats.estimated_cost_usd.toFixed(4)}
                    </div>
                  </div>
                  <div className="pt-2 border-t border-border/30 text-[11px] text-muted-foreground/90 font-mono truncate">
                    美元计价成本估算
                  </div>
                </div>
              </div>

              {/* ── My Models Breakdown ── */}
              <div className="rounded-2xl border border-border/50 bg-card/80 dark:bg-[#1C1C1E]/80 backdrop-blur-md shadow-2xs overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-border/40 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Cpu className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold tracking-tight text-foreground">
                      我使用的模型与费用明细 ({currentPeriodName})
                    </h2>
                    <p className="text-xs text-muted-foreground">你所调用过的模型及输入/输出详细 Token 账单</p>
                  </div>
                </div>

                {myStats.model_breakdown.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground">
                    该时间区间内暂无模型调用数据。
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table className="text-xs">
                      <TableHeader className="bg-muted/30">
                        <TableRow className="border-b border-border/40">
                          <TableHead className="py-3 px-4 whitespace-nowrap text-[11px] font-medium text-muted-foreground">调用模型</TableHead>
                          <TableHead className="py-3 px-4 whitespace-nowrap text-[11px] font-medium text-muted-foreground">调用次数</TableHead>
                          <TableHead className="py-3 px-4 whitespace-nowrap text-[11px] font-medium text-muted-foreground">输入 Token (Prompt)</TableHead>
                          <TableHead className="py-3 px-4 whitespace-nowrap text-[11px] font-medium text-muted-foreground">输出 Token (Completion)</TableHead>
                          <TableHead className="py-3 px-4 whitespace-nowrap text-[11px] font-medium text-muted-foreground">总 Token 消耗</TableHead>
                          <TableHead className="py-3 px-4 whitespace-nowrap text-[11px] font-medium text-muted-foreground text-right">折算花费 (CNY / USD)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {myStats.model_breakdown.map((m) => (
                          <TableRow
                            key={m.model}
                            className="hover:bg-muted/40 transition-colors border-b border-border/30 last:border-0"
                          >
                            <TableCell className="py-3.5 px-4 font-semibold text-foreground flex items-center gap-2 whitespace-nowrap">
                              <span>{m.model}</span>
                              {m.is_free && (
                                <Badge className="text-[9px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-full px-1.5 py-0 shadow-none">
                                  免费
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="py-3.5 px-4 font-mono text-muted-foreground tabular-nums whitespace-nowrap">
                              {m.calls} 次
                            </TableCell>
                            <TableCell className="py-3.5 px-4 font-mono text-muted-foreground tabular-nums whitespace-nowrap">
                              {m.prompt_tokens.toLocaleString()}
                            </TableCell>
                            <TableCell className="py-3.5 px-4 font-mono text-muted-foreground tabular-nums whitespace-nowrap">
                              {m.completion_tokens.toLocaleString()}
                            </TableCell>
                            <TableCell className="py-3.5 px-4 font-mono font-semibold text-foreground tabular-nums whitespace-nowrap">
                              {m.total_tokens.toLocaleString()}
                            </TableCell>
                            <TableCell className="py-3.5 px-4 font-mono text-right tabular-nums whitespace-nowrap">
                              {m.is_free ? (
                                <span className="font-semibold text-emerald-600 dark:text-emerald-400">¥0.00</span>
                              ) : (
                                <div>
                                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                    ¥{m.cost_cny.toFixed(2)}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground block">
                                    ${m.cost_usd.toFixed(4)}
                                  </span>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              {/* ── Dynamic Trend Breakdown ── */}
              {myStats.daily_trend.length > 0 && (
                <div className="rounded-2xl border border-border/50 bg-card/80 dark:bg-[#1C1C1E]/80 backdrop-blur-md shadow-2xs p-5 space-y-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 dark:text-blue-400 flex items-center justify-center shrink-0">
                      <Clock className="h-4 w-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold tracking-tight text-foreground">
                        {period === "today"
                          ? "今日各时段消耗走势 (Hourly Trend)"
                          : period === "year"
                          ? "今年各月份用量分布 (Monthly Trend)"
                          : `${currentPeriodName}走势明细`}
                      </h2>
                      <p className="text-xs text-muted-foreground">你个人在选定区间内的对话与 Token 趋势</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
                    {myStats.daily_trend.map((d) => (
                      <div
                        key={d.date}
                        className="p-3 rounded-xl border border-border/40 bg-muted/20 hover:bg-muted/40 dark:bg-muted/10 text-center space-y-1 transition-all"
                      >
                        <div className="text-[11px] font-medium text-muted-foreground font-mono">
                          {d.date}
                        </div>
                        <div className="text-sm sm:text-base font-semibold font-mono tracking-tight text-foreground tabular-nums">
                          {d.tokens.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-muted-foreground/80 font-mono">
                          {d.calls} 次对话 · ¥{d.cost_cny.toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ===================== ADMIN AUDIT MODAL (Apple Sheet Style) ===================== */}
          {auditUser && (
            <Dialog
              open
              onOpenChange={(open) => {
                if (!open) {
                  setAuditUser(null);
                  setInspectData(null);
                }
              }}
            >
              <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden rounded-[22px] border border-border/50 bg-card/95 backdrop-blur-2xl shadow-2xl">
                {/* Modal Header */}
                <DialogHeader className="flex-row items-center justify-between px-6 py-4 border-b border-border/40 bg-muted/30 space-y-0 text-left">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Eye className="h-5 w-5" />
                    </div>
                    <div>
                      <DialogTitle className="text-base font-semibold flex items-center gap-2">
                        <span>用户对话审查与审计</span>
                        <Badge variant="secondary" className="font-mono text-xs rounded-full px-2 py-0.5">
                          {auditUser.username}
                        </Badge>
                      </DialogTitle>
                      <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                        用户删除的对话在底层已安全归档保留，平台可完整审计内容与追踪 Token / 成本消耗。
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>

                {/* Filter Tabs & Refresh */}
                <div className="flex items-center justify-between px-6 py-2.5 border-b border-border/40 text-xs bg-card/50">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground font-medium mr-1 text-[11px]">状态筛选:</span>
                    <Tabs value={auditFilter} onValueChange={(v) => setAuditFilter(v as any)}>
                      <TabsList className="h-7 p-0.5 rounded-lg bg-muted/60 dark:bg-muted/40 border border-border/40 gap-0.5">
                        <TabsTrigger
                          value="all"
                          className="h-6 px-2.5 rounded-md text-[11px] font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-2xs transition-all"
                        >
                          全部 ({auditConversations.length})
                        </TabsTrigger>
                        <TabsTrigger
                          value="active"
                          className="h-6 px-2.5 rounded-md text-[11px] font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-2xs transition-all"
                        >
                          正常 ({auditConversations.filter((c) => !c.is_deleted).length})
                        </TabsTrigger>
                        <TabsTrigger
                          value="deleted"
                          className="h-6 px-2.5 rounded-md text-[11px] font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-2xs transition-all"
                        >
                          已删除 ({auditConversations.filter((c) => c.is_deleted).length})
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => fetchAuditList(auditUser.id)}
                    disabled={auditLoading}
                    className="h-7 px-2.5 rounded-full text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted gap-1"
                  >
                    <RefreshCw className={cn("h-3 w-3", auditLoading && "animate-spin text-primary")} />
                    <span>刷新</span>
                  </Button>
                </div>

                {/* Modal Body */}
                <div className="overflow-y-auto flex-1 max-h-[60vh] p-6 space-y-3 overscroll-contain">
                  {auditLoading ? (
                    <div className="py-16 text-center space-y-2">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto text-primary" />
                      <p className="text-xs text-muted-foreground">正在载入对话记录与审计数据...</p>
                    </div>
                  ) : auditConversations.length === 0 ? (
                    <div className="py-16 text-center text-xs text-muted-foreground">
                      该用户暂无任何对话记录。
                    </div>
                  ) : (
                    auditConversations
                      .filter((c) => {
                        if (auditFilter === "active") return !c.is_deleted;
                        if (auditFilter === "deleted") return c.is_deleted;
                        return true;
                      })
                      .map((conv) => (
                        <div
                          key={conv.id}
                          className={cn(
                            "p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors",
                            conv.is_deleted
                              ? "bg-destructive/5 border-destructive/20"
                              : "bg-muted/20 hover:bg-muted/40 border-border/40"
                          )}
                        >
                          <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-xs sm:text-sm font-semibold text-foreground truncate">
                                {conv.title || "未命名对话"}
                              </h4>
                              {conv.is_deleted ? (
                                <Badge variant="destructive" className="text-[10px] font-medium bg-destructive/10 text-destructive border-destructive/20 rounded-full px-2 py-px shadow-none">
                                  <Trash2 className="h-2.5 w-2.5 mr-1" />
                                  已删除 ({conv.deleted_at || "回收站"})
                                </Badge>
                              ) : (
                                <Badge className="text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-full px-2 py-px shadow-none">
                                  <CheckCircle2 className="h-2.5 w-2.5 mr-1" />
                                  正常活跃
                                </Badge>
                              )}
                              <Badge variant="secondary" className="text-[10px] font-mono rounded-full px-2 py-px">
                                {conv.model}
                              </Badge>
                            </div>

                            <div className="flex items-center gap-4 text-[11px] text-muted-foreground font-mono">
                              <span>消息: {conv.message_count} 条</span>
                              <span>Token: {conv.total_tokens.toLocaleString()}</span>
                              <span>更新: {conv.updated_at || conv.created_at}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleInspectMessages(conv.id)}
                              className="h-7 px-3 text-xs rounded-full border-border/50 bg-background/80 hover:bg-muted active:scale-95 transition-all shadow-2xs gap-1.5"
                            >
                              <FileText className="h-3 w-3" />
                              <span>查阅消息</span>
                            </Button>

                            {conv.is_deleted && (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={restoreLoading === conv.id}
                                onClick={() => handleAdminRestore(conv.id, conv.title)}
                                className="h-7 px-3 text-xs rounded-full text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 active:scale-95 transition-all gap-1.5"
                              >
                                <RotateCcw className={cn("h-3 w-3", restoreLoading === conv.id && "animate-spin")} />
                                <span>恢复对话</span>
                              </Button>
                            )}
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </DialogContent>
            </Dialog>
          )}

          {/* ===================== 操作确认框 ===================== */}
          {pendingConfirm && (
            <ConfirmDialog
              open
              onOpenChange={(open) => {
                if (!open) setPendingConfirm(null);
              }}
              title={pendingConfirm.title}
              description={pendingConfirm.description}
              confirmText={pendingConfirm.confirmText}
              danger={pendingConfirm.danger}
              loading={actionLoading !== null}
              onConfirm={pendingConfirm.onConfirm}
            />
          )}

          {/* ===================== MESSAGE INSPECTION POPUP (Apple HIG Chat Inspect) ===================== */}
          {inspectData && (
            <Dialog
              open
              onOpenChange={(open) => {
                if (!open) setInspectData(null);
              }}
            >
              <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden rounded-[22px] border border-border/50 bg-card/95 backdrop-blur-2xl shadow-2xl">
                {/* Header */}
                <DialogHeader className="flex-row items-center justify-between px-6 py-4 border-b border-border/40 bg-muted/30 space-y-0 text-left">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <MessageSquare className="h-4 w-4" />
                    </div>
                    <div>
                      <DialogTitle className="text-sm font-semibold truncate max-w-md">
                        {inspectData.conversation.title}
                      </DialogTitle>
                      <DialogDescription className="text-[11px] text-muted-foreground mt-0.5">
                        <span>模型: {inspectData.conversation.model}</span>
                        <span> · </span>
                        <span>共 {inspectData.messages.length} 条消息</span>
                        {inspectData.conversation.is_deleted && (
                          <span className="text-destructive font-semibold"> (用户已删除)</span>
                        )}
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>

                {/* Messages Body (iOS iMessage Style) */}
                <div className="overflow-y-auto flex-1 max-h-[60vh] p-6 space-y-4 overscroll-contain bg-background/50">
                  {inspectData.messages.length === 0 ? (
                    <div className="py-16 text-center text-xs text-muted-foreground">对话中暂无任何消息。</div>
                  ) : (
                    inspectData.messages.map((msg, idx) => (
                      <div
                        key={msg.id || idx}
                        className={cn(
                          "flex flex-col space-y-1.5",
                          msg.role === "user" ? "items-end" : "items-start"
                        )}
                      >
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono px-1">
                          <span className="font-semibold uppercase tracking-wider">{msg.role}</span>
                          <span>{msg.created_at}</span>
                          {msg.token_usage > 0 && <span>· {msg.token_usage} Tokens</span>}
                        </div>

                        <div
                          className={cn(
                            "max-w-[85%] p-3.5 text-xs leading-relaxed whitespace-pre-wrap shadow-2xs",
                            msg.role === "user"
                              ? "bg-primary text-primary-foreground rounded-2xl rounded-tr-xs"
                              : "bg-card/90 dark:bg-muted/60 border border-border/40 text-foreground rounded-2xl rounded-tl-xs"
                          )}
                        >
                          {msg.content}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </DialogContent>
            </Dialog>
          )}
        </main>
      </div>
    </div>
  );
}
