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
import { Card, CardContent } from "@/components/ui/card";
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
  Trash2
} from "lucide-react";

type PeriodType = "today" | "month" | "year" | "all";

export default function UsagePage() {
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
    if (user) {
      fetchStats();
    }
  }, [user]);

  const handlePeriodChange = (newPeriod: PeriodType) => {
    setPeriod(newPeriod);
    fetchStats(newPeriod);
  };

  const handleToggleActive = (userId: string, currentStatus: boolean, username: string) => {
    setPendingConfirm({
      title: `${currentStatus ? "停用" : "启用"}用户`,
      description: `确定要${currentStatus ? "停用" : "启用"}用户 [${username}] 吗？${
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
          toast.success(`已${currentStatus ? "停用" : "启用"}用户 [${username}]`);
        } catch (err: any) {
          toast.error(err.message || "操作失败");
        } finally {
          setActionLoading(null);
        }
      },
    });
  };

  const handleToggleAdmin = (userId: string, currentAdmin: boolean, username: string) => {
    setPendingConfirm({
      title: `${currentAdmin ? "取消" : "授予"}管理员权限`,
      description: `确定要${currentAdmin ? "取消" : "设置"}用户 [${username}] 的超级管理员权限吗？`,
      confirmText: currentAdmin ? "取消权限" : "设为管理员",
      danger: currentAdmin,
      onConfirm: async () => {
        setPendingConfirm(null);
        setActionLoading(userId);
        try {
          await apiRequest(`/stats/admin/users/${userId}/toggle-admin`, { method: "POST" });
          await fetchStats();
          toast.success(`已${currentAdmin ? "取消" : "授予"} [${username}] 的管理员权限`);
        } catch (err: any) {
          toast.error(err.message || "操作失败");
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
    <div className="flex flex-col h-dvh overflow-hidden bg-background">
      <Navbar />
      {/* ── Apple HIG Standard Mobile Navigation Bar (44pt) ── */}
      <MobileHeader title="用量监控" />

      <div className="flex-1 overflow-y-auto">
        <main className="max-w-6xl w-full mx-auto p-4 sm:p-5 md:p-8 space-y-4 sm:space-y-6 pb-24 md:pb-8">
        {/* Desktop Header Banner */}
        <div className="hidden md:flex flex-row items-center justify-between gap-4 pb-6 border-b border-border/50">
          <div>
            <div className="flex items-center gap-2 text-primary font-semibold mb-1 flex-wrap text-[13px] tracking-tight">
              <BarChart3 className="h-4 w-4 shrink-0" />
              <span>{isSuperuser ? "全局用量监控" : "个人用量统计"}</span>
              {isSuperuser && (
                <Badge className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10 shrink-0">
                  管理员控制台
                </Badge>
              )}
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              {isSuperuser ? "平台用量与成本核算" : "我的用量总览"}
            </h1>
            <p className="text-[13px] text-muted-foreground mt-1.5 leading-relaxed max-w-2xl">
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
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin text-primary")} />
              <span>刷新数据</span>
            </Button>
          </div>
        </div>

        {/* Mobile Quick Action Sub-bar */}
        <div className="flex md:hidden items-center justify-between gap-2 pb-1">
          <span className="text-xs text-muted-foreground font-mono">
            {isSuperuser ? "管理员控制台" : "个人用量统计"}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchStats()}
            disabled={isLoading}
            className="h-8 px-3 rounded-full text-xs font-medium gap-1.5 shadow-xs"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin text-primary")} />
            <span>刷新数据</span>
          </Button>
        </div>

        {/* Time Period Filter Selector */}
        <Card className="shadow-sm">
          <CardContent className="p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 shrink-0">
              <span className="text-xs font-semibold text-muted-foreground pl-2 shrink-0 whitespace-nowrap">
                统计范围：
              </span>
              <Tabs
                value={period}
                onValueChange={(v) => handlePeriodChange(v as PeriodType)}
                className="shrink-0"
              >
                <TabsList className="h-8">
                  <TabsTrigger value="today" className="text-xs h-7 px-2.5">
                    <Zap className="h-3 w-3 mr-1" />
                    <span>今天</span>
                  </TabsTrigger>
                  <TabsTrigger value="month" className="text-xs h-7 px-2.5">
                    <Calendar className="h-3 w-3 mr-1" />
                    <span>本月</span>
                  </TabsTrigger>
                  <TabsTrigger value="year" className="text-xs h-7 px-2.5">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    <span>今年</span>
                  </TabsTrigger>
                  <TabsTrigger value="all" className="text-xs h-7 px-2.5">
                    <Coins className="h-3 w-3 mr-1" />
                    <span>全部累计</span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

          <div className="text-[11px] text-muted-foreground font-mono pr-2 shrink-0 whitespace-nowrap">
            {period === "today" && "⚡ 今日 00:00 至今"}
            {period === "month" && "📅 本月 1 日 00:00 至今"}
            {period === "year" && "📆 本年 1 月 1 日至今"}
            {period === "all" && "🌐 历史全部数据汇总"}
          </div>
          </CardContent>
        </Card>

        {/* Tab Toggle for Super Admin */}
        {isSuperuser && (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "overview" | "my")}>
            <TabsList>
              <TabsTrigger value="overview">
                <Users className="h-4 w-4 shrink-0 mr-2" />
                <span>全部用户 ({adminStats?.total_users || 0})</span>
              </TabsTrigger>
              <TabsTrigger value="my">
                <UserCheck className="h-4 w-4 shrink-0 mr-2" />
                <span>我的用量</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        {/* ===================== TAB 1: ALL USERS OVERVIEW (SUPER ADMIN ONLY) ===================== */}
        {isLoading && !adminStats && !myStats && <StatCardsSkeleton />}
        {isSuperuser && activeTab === "overview" && adminStats && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
              {/* Card 1: Users */}
              <div className="p-5 rounded-xl border bg-card text-card-foreground shadow-sm space-y-2">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-medium">注册总用户</span>
                  <Users className="h-4 w-4 text-indigo-500" />
                </div>
                <div className="text-2xl font-bold  ">
                  {adminStats.total_users} <span className="text-xs font-normal text-slate-500">位</span>
                </div>
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                  活跃账号: {adminStats.active_users} 位
                </p>
              </div>

              {/* Card 2: Messages */}
              <div className="p-5 rounded-xl border bg-card text-card-foreground shadow-sm space-y-2">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-medium">对话轮次 ({currentPeriodName})</span>
                  <MessageSquare className="h-4 w-4 text-blue-500" />
                </div>
                <div className="text-2xl font-bold  ">
                  {adminStats.total_messages.toLocaleString()}{" "}
                  <span className="text-xs font-normal text-slate-500">次</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  共涉及 {adminStats.total_conversations} 个对话会话
                </p>
              </div>

              {/* Card 3: Tokens */}
              <div className="p-5 rounded-xl border bg-card text-card-foreground shadow-sm space-y-2">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-medium">Token 消耗 ({currentPeriodName})</span>
                  <Coins className="h-4 w-4 text-amber-500" />
                </div>
                <div className="text-2xl font-bold   truncate">
                  {adminStats.total_tokens.toLocaleString()}
                </div>
                <p className="text-[11px] text-muted-foreground truncate">
                  输入: {adminStats.total_prompt_tokens.toLocaleString()} | 输出: {adminStats.total_completion_tokens.toLocaleString()}
                </p>
              </div>

              {/* Card 4: Estimated Cost */}
              <div className="p-5 rounded-xl border bg-card text-card-foreground shadow-sm space-y-2">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-medium">预估费用支出 ({currentPeriodName})</span>
                  <DollarSign className="h-4 w-4 text-emerald-500" />
                </div>
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 truncate">
                  ¥{adminStats.total_cost_cny.toFixed(2)}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  约 ${adminStats.total_cost_usd.toFixed(4)} USD (汇率 7.25)
                </p>
              </div>
            </div>

            {/* User Breakdown Table */}
            <div className="rounded-xl border border-border/80 bg-card shadow-xs overflow-hidden">
              <div className="p-5 border-b border-border/70 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <div className="min-w-0">
                  <h2 className="text-sm font-bold uppercase tracking-wider">
                    各用户详细消耗明细 ({currentPeriodName})
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    按当前选定时间区间内的总 Token 消耗排序，支持实时停用/启用异常账号。
                  </p>
                </div>
                <span className="text-xs text-muted-foreground font-mono shrink-0">共 {adminStats.users.length} 位用户</span>
              </div>

              <Table className="text-xs">
                <TableHeader className="bg-muted uppercase">
                  <TableRow>
                    <TableHead className="py-3 px-4 whitespace-nowrap">用户</TableHead>
                    <TableHead className="py-3 px-4 whitespace-nowrap">对话轮次</TableHead>
                    <TableHead className="py-3 px-4 whitespace-nowrap">总 Token 消耗</TableHead>
                    <TableHead className="py-3 px-4 whitespace-nowrap">输入 / 输出明细</TableHead>
                    <TableHead className="py-3 px-4 whitespace-nowrap">预估花费 (CNY / USD)</TableHead>
                    <TableHead className="py-3 px-4 whitespace-nowrap">常用模型</TableHead>
                    <TableHead className="py-3 px-4 whitespace-nowrap">状态</TableHead>
                    <TableHead className="py-3 px-4 whitespace-nowrap text-right">管理操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                    {adminStats.users.map((u) => {
                      const isMe = u.user_id === user.id;
                      return (
                        <TableRow
                          key={u.user_id}
                          className="hover:bg-muted/50 transition-colors"
                        >
                          <TableCell className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">
                                {u.username}
                              </span>
                              {isMe && (
                                <Badge variant="secondary" className="text-[10px]">
                                  我
                                </Badge>
                              )}
                              {u.is_superuser && (
                                <Badge className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10">
                                  超级管理员
                                </Badge>
                              )}
                            </div>
                            <span
                              className="block max-w-[240px] truncate text-[11px] text-muted-foreground font-mono"
                              title={u.email}
                            >
                              {u.email}
                            </span>
                          </TableCell>
                          <TableCell className="py-3.5 px-4 font-mono whitespace-nowrap">
                            <span className="font-semibold text-foreground">{u.messages_count}</span>
                            <span className="text-muted-foreground text-[11px]"> 轮 ({u.conversations_count} 会话)</span>
                          </TableCell>
                          <TableCell className="py-3.5 px-4 font-mono font-bold whitespace-nowrap">
                            {u.total_tokens.toLocaleString()}
                          </TableCell>
                          <TableCell className="py-3.5 px-4 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                            <div>In: {u.prompt_tokens.toLocaleString()}</div>
                            <div>Out: {u.completion_tokens.toLocaleString()}</div>
                          </TableCell>
                          <TableCell className="py-3.5 px-4 font-mono whitespace-nowrap">
                            <div className="font-bold text-emerald-600 dark:text-emerald-400">
                              ¥{u.estimated_cost_cny.toFixed(2)}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              ${u.estimated_cost_usd.toFixed(4)}
                            </div>
                          </TableCell>
                          <TableCell
                            className="py-3.5 px-4 font-mono text-[11px] text-muted-foreground max-w-[220px] truncate"
                            title={u.top_model}
                          >
                            {u.top_model}
                          </TableCell>
                          <TableCell className="py-3.5 px-4 whitespace-nowrap">
                            {u.is_active ? (
                              <Badge className="text-[11px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1"></span>
                                正常
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="text-[11px] bg-destructive/10 hover:bg-destructive/10">
                                <span className="h-1.5 w-1.5 rounded-full bg-destructive mr-1"></span>
                                已停用
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                            <ActionTooltip label="查看该用户全部对话记录（含已删除对话）与审计详情" side="left">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenAudit(u.user_id, u.username)}
                                className="h-7 px-2.5 text-[11px] text-primary border-primary/30 bg-primary/5 hover:bg-primary/10 hover:text-primary"
                              >
                                <Eye className="h-3 w-3" />
                                <span>审查会话</span>
                              </Button>
                            </ActionTooltip>
                            {!isMe ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    disabled={actionLoading === u.user_id}
                                    className="h-7 w-7 text-muted-foreground hover:text-foreground inline-flex align-middle"
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                    <span className="sr-only">操作菜单</span>
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-36">
                                  <DropdownMenuItem
                                    onClick={() => handleToggleActive(u.user_id, u.is_active, u.username)}
                                    className={cn(
                                      "cursor-pointer text-xs",
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
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => handleToggleAdmin(u.user_id, u.is_superuser, u.username)}
                                    className="cursor-pointer text-xs"
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

            {/* Model Breakdown Section */}
            <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-sm font-bold   uppercase tracking-wider flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-indigo-500" />
                  各模型调用分布与花费 ({currentPeriodName})
                </h2>
                <div className="flex items-center gap-1.5 text-[11px] font-medium">
                  <span className="text-muted-foreground mr-0.5">排序:</span>
                  <Tabs
                    value={modelSortKey}
                    onValueChange={(v) => setModelSortKey(v as "cost" | "tokens")}
                  >
                    <TabsList className="h-7 p-0.5">
                      <TabsTrigger value="cost" className="h-6 px-2 text-[11px]">按花费</TabsTrigger>
                      <TabsTrigger value="tokens" className="h-6 px-2 text-[11px]">按 Token</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </div>

              {adminStats.model_breakdown.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  该时间区间内暂无模型调用数据。
                </div>
              ) : (
                <div className="space-y-2">
                  {[...adminStats.model_breakdown]
                    .sort((a, b) =>
                      modelSortKey === "cost"
                        ? b.cost_cny - a.cost_cny || b.total_tokens - a.total_tokens
                        : b.total_tokens - a.total_tokens || b.cost_cny - a.cost_cny
                    )
                    .map((m, idx) => (
                      <div
                        key={m.model}
                        className="flex items-center gap-3 p-3 rounded-xl border bg-muted/40 text-xs"
                      >
                        <span className="shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-[11px] flex items-center justify-center font-bold font-mono">
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold truncate">
                              {m.model}
                            </span>
                            {m.is_free && (
                              <Badge className="text-[9px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 shrink-0">
                                免费
                              </Badge>
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
                            调用 {m.calls} 次 · Token {m.total_tokens.toLocaleString()}
                          </div>
                        </div>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono shrink-0">
                          {m.is_free ? "¥0.00" : `¥${m.cost_cny.toFixed(2)}`}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Trend Section */}
            {adminStats.daily_trend.length > 0 && (
              <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
                <h2 className="text-sm font-bold   uppercase tracking-wider flex items-center gap-2">
                  <Clock className="h-4 w-4 text-indigo-500" />
                  {period === "today"
                    ? "今日各时段消耗走势 (Hourly Trend)"
                    : period === "year"
                    ? "今年各月份消耗走势 (Monthly Trend)"
                    : `${currentPeriodName}走势明细`}
                </h2>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
                  {adminStats.daily_trend.map((d) => (
                    <div
                      key={d.date}
                      className="p-3 rounded-xl border bg-muted/40 text-center space-y-1"
                    >
                      <div className="text-[11px] font-semibold text-muted-foreground font-mono">
                        {d.date}
                      </div>
                      <div className="text-sm font-bold font-mono">
                        {d.tokens.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
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
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
              <div className="p-5 rounded-xl border bg-card text-card-foreground shadow-sm space-y-2">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-medium">对话轮次 ({currentPeriodName})</span>
                  <MessageSquare className="h-4 w-4 text-indigo-500" />
                </div>
                <div className="text-2xl font-bold  ">
                  {myStats.total_messages.toLocaleString()}{" "}
                  <span className="text-xs font-normal text-slate-500">次</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  涉及 {myStats.total_conversations} 个对话会话
                </p>
              </div>

              <div className="p-5 rounded-xl border bg-card text-card-foreground shadow-sm space-y-2">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-medium">我的 Token 消耗 ({currentPeriodName})</span>
                  <Coins className="h-4 w-4 text-amber-500" />
                </div>
                <div className="text-2xl font-bold   truncate">
                  {myStats.total_tokens.toLocaleString()}
                </div>
                <p className="text-[11px] text-muted-foreground truncate">
                  输入: {myStats.prompt_tokens.toLocaleString()} | 输出: {myStats.completion_tokens.toLocaleString()}
                </p>
              </div>

              <div className="p-5 rounded-xl border bg-card text-card-foreground shadow-sm space-y-2">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-medium">预估总花费 CNY ({currentPeriodName})</span>
                  <DollarSign className="h-4 w-4 text-emerald-500" />
                </div>
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 truncate">
                  ¥{myStats.estimated_cost_cny.toFixed(2)}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  按各官方厂商当前 Token 定价换算
                </p>
              </div>

              <div className="p-5 rounded-xl border bg-card text-card-foreground shadow-sm space-y-2">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-medium">预估总花费 USD ({currentPeriodName})</span>
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                </div>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 truncate">
                  ${myStats.estimated_cost_usd.toFixed(4)}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  美元计价成本
                </p>
              </div>
            </div>

            {/* My Models Breakdown */}
            <div className="rounded-xl border border-border/80 bg-card shadow-xs overflow-hidden">
              <div className="p-5 border-b border-border/70">
                <h2 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-primary" />
                  我使用的模型与费用明细 ({currentPeriodName})
                </h2>
              </div>

              {myStats.model_breakdown.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  该时间区间内暂无模型调用数据。
                </div>
              ) : (
                <Table className="text-xs">
                  <TableHeader className="bg-muted uppercase">
                    <TableRow>
                      <TableHead className="py-3 px-4 whitespace-nowrap">调用模型</TableHead>
                      <TableHead className="py-3 px-4 whitespace-nowrap">调用次数</TableHead>
                      <TableHead className="py-3 px-4 whitespace-nowrap">输入 Token (Prompt)</TableHead>
                      <TableHead className="py-3 px-4 whitespace-nowrap">输出 Token (Completion)</TableHead>
                      <TableHead className="py-3 px-4 whitespace-nowrap">总 Token 消耗</TableHead>
                      <TableHead className="py-3 px-4 whitespace-nowrap text-right">折算花费 (CNY / USD)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {myStats.model_breakdown.map((m) => (
                      <TableRow
                        key={m.model}
                        className="hover:bg-muted/50 transition-colors"
                      >
                        <TableCell className="py-3.5 px-4 font-semibold flex items-center gap-2">
                          <span>{m.model}</span>
                          {m.is_free && (
                            <Badge className="text-[9px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10">
                              免费
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="py-3.5 px-4 font-mono text-muted-foreground">
                          {m.calls} 次
                        </TableCell>
                        <TableCell className="py-3.5 px-4 font-mono text-muted-foreground">
                          {m.prompt_tokens.toLocaleString()}
                        </TableCell>
                        <TableCell className="py-3.5 px-4 font-mono text-muted-foreground">
                          {m.completion_tokens.toLocaleString()}
                        </TableCell>
                        <TableCell className="py-3.5 px-4 font-mono font-bold">
                          {m.total_tokens.toLocaleString()}
                        </TableCell>
                        <TableCell className="py-3.5 px-4 font-mono text-right">
                          {m.is_free ? (
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">¥0.00</span>
                          ) : (
                            <div>
                              <span className="font-bold text-emerald-600 dark:text-emerald-400">
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
              )}
            </div>

            {/* Dynamic Trend Breakdown */}
            {myStats.daily_trend.length > 0 && (
              <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
                <h2 className="text-sm font-bold   uppercase tracking-wider flex items-center gap-2">
                  <Clock className="h-4 w-4 text-indigo-500" />
                  {period === "today"
                    ? "今日各时段消耗走势 (Hourly Trend)"
                    : period === "year"
                    ? "今年各月份用量分布 (Monthly Trend)"
                    : `${currentPeriodName}走势明细`}
                </h2>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
                  {myStats.daily_trend.map((d) => (
                    <div
                      key={d.date}
                      className="p-3 rounded-xl border bg-muted/40 text-center space-y-1"
                    >
                      <div className="text-[11px] font-semibold text-muted-foreground font-mono">
                        {d.date}
                      </div>
                      <div className="text-sm font-bold font-mono">
                        {d.tokens.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {d.calls} 次对话 · ¥{d.cost_cny.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===================== ADMIN AUDIT MODAL ===================== */}
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
            <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
              {/* Modal Header */}
              <DialogHeader className="flex-row items-center justify-between px-6 py-4 border-b bg-muted/40 space-y-0 text-left">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-primary/10 text-primary">
                    <Eye className="h-5 w-5" />
                  </div>
                  <div>
                    <DialogTitle className="text-base flex items-center gap-2">
                      <span>用户对话审查与审计</span>
                      <Badge variant="secondary" className="font-mono">
                        {auditUser.username}
                      </Badge>
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                      用户删除的对话在底层已安全归档保留，平台可完整审计内容与追踪 Token / 成本消耗。
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              {/* Filter Tabs */}
              <div className="flex items-center justify-between px-6 py-2.5 border-b text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground font-medium mr-1">筛选状态:</span>
                  <Tabs value={auditFilter} onValueChange={(v) => setAuditFilter(v as any)}>
                    <TabsList className="h-8">
                      <TabsTrigger value="all" className="h-7 text-xs px-2.5">
                        全部 ({auditConversations.length})
                      </TabsTrigger>
                      <TabsTrigger value="active" className="h-7 text-xs px-2.5">
                        正常显示 ({auditConversations.filter((c) => !c.is_deleted).length})
                      </TabsTrigger>
                      <TabsTrigger value="deleted" className="h-7 text-xs px-2.5">
                        已删除/回收站 ({auditConversations.filter((c) => c.is_deleted).length})
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fetchAuditList(auditUser.id)}
                  disabled={auditLoading}
                  className="h-7 text-[11px] text-muted-foreground hover:text-primary"
                >
                  <RefreshCw className={cn("h-3 w-3", auditLoading && "animate-spin text-primary")} />
                  <span>刷新</span>
                </Button>
              </div>

              {/* Modal Body */}
              <div className="overflow-y-auto flex-1 max-h-[65vh] p-6 space-y-3 overscroll-contain">
                  {auditLoading ? (
                    <div className="py-16 text-center space-y-2">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto text-indigo-600" />
                      <p className="text-xs text-slate-500">正在载入对话记录与审计数据...</p>
                    </div>
                  ) : auditConversations.length === 0 ? (
                    <div className="py-16 text-center text-xs text-slate-500">
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
                            "p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3",
                            conv.is_deleted
                              ? "bg-destructive/5 border-destructive/30"
                              : "bg-muted/40"
                          )}
                        >
                          <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-sm font-bold truncate">
                                {conv.title || "未命名对话"}
                              </h4>
                              {conv.is_deleted ? (
                                <Badge variant="destructive" className="text-[10px] bg-destructive/10 hover:bg-destructive/10">
                                  <Trash2 className="h-2.5 w-2.5 mr-1" />
                                  用户已删除 ({conv.deleted_at || "已移入回收站"})
                                </Badge>
                              ) : (
                                <Badge className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10">
                                  <CheckCircle2 className="h-2.5 w-2.5 mr-1" />
                                  正常活跃
                                </Badge>
                              )}
                              <Badge variant="secondary" className="text-[10px] font-mono">
                                {conv.model}
                              </Badge>
                            </div>

                            <div className="flex items-center gap-4 text-xs text-muted-foreground font-mono">
                              <span>消息: {conv.message_count} 条</span>
                              <span>Token 累计: {conv.total_tokens.toLocaleString()}</span>
                              <span>更新: {conv.updated_at || conv.created_at}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleInspectMessages(conv.id)}
                              className="h-8 text-xs shadow-sm"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              <span>查阅消息</span>
                            </Button>

                            {conv.is_deleted && (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={restoreLoading === conv.id}
                                onClick={() => handleAdminRestore(conv.id, conv.title)}
                                className="h-8 text-xs text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 hover:text-emerald-600 dark:hover:text-emerald-400"
                              >
                                <RotateCcw className={cn("h-3.5 w-3.5", restoreLoading === conv.id && "animate-spin")} />
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

        {/* ===================== MESSAGE INSPECTION POPUP ===================== */}
        {inspectData && (
          <Dialog
            open
            onOpenChange={(open) => {
              if (!open) setInspectData(null);
            }}
          >
            <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
              {/* Header */}
              <DialogHeader className="flex-row items-center justify-between px-6 py-4 border-b bg-muted/40 space-y-0 text-left">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary">
                    <MessageSquare className="h-4 w-4" />
                  </div>
                  <div>
                    <DialogTitle className="text-sm truncate max-w-md">
                      {inspectData.conversation.title}
                    </DialogTitle>
                    <DialogDescription className="text-[11px]">
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

              {/* Messages Body */}
              <div className="overflow-y-auto flex-1 max-h-[65vh] p-6 space-y-4 overscroll-contain">
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
                        <span className="font-semibold uppercase">{msg.role}</span>
                        <span>{msg.created_at}</span>
                        {msg.token_usage > 0 && <span>· {msg.token_usage} Tokens</span>}
                      </div>

                      <div
                        className={cn(
                          "max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed whitespace-pre-wrap",
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted border"
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
