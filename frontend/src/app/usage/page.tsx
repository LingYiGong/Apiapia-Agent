"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";
import { Navbar } from "@/components/layout/Navbar";
import { MyUsageStats, AdminOverviewStats } from "@/types";
import {
  BarChart3,
  Users,
  Coins,
  Cpu,
  ShieldCheck,
  ShieldAlert,
  Calendar,
  MessageSquare,
  TrendingUp,
  RefreshCw,
  UserCheck,
  UserX,
  Zap,
  ArrowUpRight,
  DollarSign,
  AlertCircle,
  Clock,
  Eye,
  RotateCcw,
  X,
  FileText,
  CheckCircle2,
  Trash2,
  MessageCircle
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

  const handleToggleActive = async (userId: string, currentStatus: boolean, username: string) => {
    if (!confirm(`确定要${currentStatus ? "停用" : "启用"}用户 [${username}] 吗？`)) return;
    setActionLoading(userId);
    try {
      await apiRequest(`/stats/admin/users/${userId}/toggle-active`, { method: "POST" });
      await fetchStats();
    } catch (err: any) {
      alert(err.message || "操作失败");
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleAdmin = async (userId: string, currentAdmin: boolean, username: string) => {
    if (!confirm(`确定要${currentAdmin ? "取消" : "设置"}用户 [${username}] 的超级管理员权限吗？`)) return;
    setActionLoading(userId);
    try {
      await apiRequest(`/stats/admin/users/${userId}/toggle-admin`, { method: "POST" });
      await fetchStats();
    } catch (err: any) {
      alert(err.message || "操作失败");
    } finally {
      setActionLoading(null);
    }
  };

  const fetchAuditList = async (userId: string) => {
    setAuditLoading(true);
    try {
      const data = await apiRequest<any[]>(`/stats/admin/users/${userId}/conversations`);
      setAuditConversations(data || []);
    } catch (err: any) {
      alert(err.message || "获取对话列表失败");
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
      alert(err.message || "获取对话消息失败");
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
    } catch (err: any) {
      alert(err.message || "恢复对话失败");
    } finally {
      setRestoreLoading(null);
    }
  };

  if (loading || !user) return null;

  const isSuperuser = !!user.is_superuser;

  const periodLabels: Record<PeriodType, string> = {
    today: "今天",
    month: "本月",
    year: "今年",
    all: "全部累计",
  };

  const currentPeriodName = periodLabels[period];

  return (
    <div className="flex flex-col h-dvh overflow-hidden bg-slate-50 dark:bg-slate-950 transition-colors">
      <Navbar />

      <div className="flex-1 overflow-y-auto">
        <main className="max-w-6xl w-full mx-auto p-3 sm:p-4 md:p-8 space-y-4 sm:space-y-6 pb-24 md:pb-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-semibold mb-1 flex-wrap">
              <BarChart3 className="h-5 w-5 shrink-0" />
              <span>{isSuperuser ? "全局监控与用量统计" : "个人用量与 Token 统计"}</span>
              {isSuperuser && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 shrink-0">
                  超级管理员控制台
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              {isSuperuser ? "平台用量与多用户成本核算" : "我的 API 消耗总览"}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
              {isSuperuser
                ? "统计所有注册用户的 Token 消耗、调用轮次与模型定价折算费用，支持时间区间筛选与账号权限管控。"
                : "查看你在本平台产生的全部对话轮次、输入/输出 Token 消耗及模型调用明细。"}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => fetchStats()}
              disabled={isLoading}
              className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-2 rounded-xl transition-all shadow-xs disabled:opacity-50 shrink-0 whitespace-nowrap"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin text-indigo-600" : ""}`} />
              <span>刷新数据</span>
            </button>
          </div>
        </div>

        {/* Time Period Filter Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-xs">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 shrink-0">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 pl-2 mr-1 shrink-0 whitespace-nowrap">
              统计范围：
            </span>
            {[
              { id: "today", label: "今天", icon: Zap },
              { id: "month", label: "本月", icon: Calendar },
              { id: "year", label: "今年", icon: TrendingUp },
              { id: "all", label: "全部累计", icon: Coins },
            ].map((item) => {
              const Icon = item.icon;
              const isSelected = period === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handlePeriodChange(item.id as PeriodType)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 whitespace-nowrap transition-all ${
                    isSelected
                      ? "bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-500"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono pr-2 shrink-0 whitespace-nowrap">
            {period === "today" && "⚡ 今日 00:00 至今"}
            {period === "month" && "📅 本月 1 日 00:00 至今"}
            {period === "year" && "📆 本年 1 月 1 日至今"}
            {period === "all" && "🌐 历史全部数据汇总"}
          </div>
        </div>

        {/* Tab Toggle for Super Admin */}
        {isSuperuser && (
          <div className="flex flex-wrap sm:flex-nowrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
            <button
              onClick={() => setActiveTab("overview")}
              className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                activeTab === "overview"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-900"
              }`}
            >
              <Users className="h-4 w-4 shrink-0" />
              <span>全盘多用户监控 ({adminStats?.total_users || 0} 人)</span>
            </button>
            <button
              onClick={() => setActiveTab("my")}
              className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                activeTab === "my"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-900"
              }`}
            >
              <UserCheck className="h-4 w-4 shrink-0" />
              <span>我的个人消耗 ({user.username})</span>
            </button>
          </div>
        )}

        {/* ===================== TAB 1: ALL USERS OVERVIEW (SUPER ADMIN ONLY) ===================== */}
        {isSuperuser && activeTab === "overview" && adminStats && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
              {/* Card 1: Users */}
              <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs space-y-2">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                  <span className="text-xs font-medium">注册总用户</span>
                  <Users className="h-4 w-4 text-indigo-500" />
                </div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white">
                  {adminStats.total_users} <span className="text-xs font-normal text-slate-500">位</span>
                </div>
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                  活跃账号: {adminStats.active_users} 位
                </p>
              </div>

              {/* Card 2: Messages */}
              <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs space-y-2">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                  <span className="text-xs font-medium">对话轮次 ({currentPeriodName})</span>
                  <MessageSquare className="h-4 w-4 text-blue-500" />
                </div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white">
                  {adminStats.total_messages.toLocaleString()}{" "}
                  <span className="text-xs font-normal text-slate-500">次</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  共涉及 {adminStats.total_conversations} 个对话会话
                </p>
              </div>

              {/* Card 3: Tokens */}
              <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs space-y-2">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                  <span className="text-xs font-medium">Token 消耗 ({currentPeriodName})</span>
                  <Coins className="h-4 w-4 text-amber-500" />
                </div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white truncate">
                  {adminStats.total_tokens.toLocaleString()}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  输入: {adminStats.total_prompt_tokens.toLocaleString()} | 输出: {adminStats.total_completion_tokens.toLocaleString()}
                </p>
              </div>

              {/* Card 4: Estimated Cost */}
              <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs space-y-2">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                  <span className="text-xs font-medium">预估费用支出 ({currentPeriodName})</span>
                  <DollarSign className="h-4 w-4 text-emerald-500" />
                </div>
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 truncate">
                  ¥{adminStats.total_cost_cny.toFixed(2)}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  约 ${adminStats.total_cost_usd.toFixed(4)} USD (汇率 7.25)
                </p>
              </div>
            </div>

            {/* User Breakdown Table */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs overflow-hidden">
              <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    各用户详细消耗明细 ({currentPeriodName})
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    按当前选定时间区间内的总 Token 消耗排序，支持实时停用/启用异常账号。
                  </p>
                </div>
                <span className="text-xs text-slate-500 font-mono shrink-0">共 {adminStats.users.length} 位用户</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-medium uppercase">
                    <tr>
                      <th className="py-3 px-4 whitespace-nowrap">用户</th>
                      <th className="py-3 px-4 whitespace-nowrap">对话轮次</th>
                      <th className="py-3 px-4 whitespace-nowrap">总 Token 消耗</th>
                      <th className="py-3 px-4 whitespace-nowrap">输入 / 输出明细</th>
                      <th className="py-3 px-4 whitespace-nowrap">预估花费 (CNY / USD)</th>
                      <th className="py-3 px-4 whitespace-nowrap">常用模型</th>
                      <th className="py-3 px-4 whitespace-nowrap">状态</th>
                      <th className="py-3 px-4 whitespace-nowrap text-right">管理操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {adminStats.users.map((u) => {
                      const isMe = u.user_id === user.id;
                      return (
                        <tr
                          key={u.user_id}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-850/50 transition-colors"
                        >
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-900 dark:text-white">
                                {u.username}
                              </span>
                              {isMe && (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                                  我
                                </span>
                              )}
                              {u.is_superuser && (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                                  超级管理员
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                              {u.email}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-mono">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{u.messages_count}</span>
                            <span className="text-slate-400 text-[11px]"> 轮 ({u.conversations_count} 会话)</span>
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white">
                            {u.total_tokens.toLocaleString()}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                            <div>In: {u.prompt_tokens.toLocaleString()}</div>
                            <div>Out: {u.completion_tokens.toLocaleString()}</div>
                          </td>
                          <td className="py-3.5 px-4 font-mono">
                            <div className="font-bold text-emerald-600 dark:text-emerald-400">
                              ¥{u.estimated_cost_cny.toFixed(2)}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              ${u.estimated_cost_usd.toFixed(4)}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                            {u.top_model}
                          </td>
                          <td className="py-3.5 px-4">
                            {u.is_active ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 px-2 py-0.5 rounded-full">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                                正常
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/40 px-2 py-0.5 rounded-full">
                                <span className="h-1.5 w-1.5 rounded-full bg-red-500"></span>
                                已停用
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleOpenAudit(u.user_id, u.username)}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50/70 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800/60 inline-flex items-center gap-1 transition-all"
                              title="查看该用户全部对话记录（含已删除对话）与审计详情"
                            >
                              <Eye className="h-3 w-3" />
                              <span>审查会话</span>
                            </button>
                            {!isMe ? (
                              <>
                                <button
                                  type="button"
                                  disabled={actionLoading === u.user_id}
                                  onClick={() => handleToggleActive(u.user_id, u.is_active, u.username)}
                                  className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-all ${
                                    u.is_active
                                      ? "text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 border border-red-200 dark:border-red-900/50"
                                      : "text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50"
                                  }`}
                                >
                                  {u.is_active ? "停用账号" : "恢复启用"}
                                </button>
                                <button
                                  type="button"
                                  disabled={actionLoading === u.user_id}
                                  onClick={() => handleToggleAdmin(u.user_id, u.is_superuser, u.username)}
                                  className="px-2 py-1 rounded-lg text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700"
                                >
                                  {u.is_superuser ? "取消超管" : "设为超管"}
                                </button>
                              </>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic ml-1">当前账号</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Model Breakdown Section */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-5 shadow-xs space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-indigo-500" />
                  各模型调用分布与花费 ({currentPeriodName})
                </h2>
                <div className="flex items-center gap-1 text-[11px] font-medium">
                  <span className="text-slate-400 dark:text-slate-500 mr-1">排序:</span>
                  {(
                    [
                      { id: "cost", label: "按花费" },
                      { id: "tokens", label: "按 Token" },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setModelSortKey(opt.id)}
                      className={`px-2.5 py-1 rounded-lg transition-all ${
                        modelSortKey === opt.id
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
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
                        className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-xs"
                      >
                        <span className="shrink-0 w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-300 text-[11px] flex items-center justify-center font-bold font-mono">
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-900 dark:text-white truncate">
                              {m.model}
                            </span>
                            {m.is_free && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shrink-0">
                                免费
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
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
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-5 shadow-xs space-y-4">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
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
                      className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-center space-y-1"
                    >
                      <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 font-mono">
                        {d.date}
                      </div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white font-mono">
                        {d.tokens.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-slate-400">
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
              <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs space-y-2">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                  <span className="text-xs font-medium">对话轮次 ({currentPeriodName})</span>
                  <MessageSquare className="h-4 w-4 text-indigo-500" />
                </div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white">
                  {myStats.total_messages.toLocaleString()}{" "}
                  <span className="text-xs font-normal text-slate-500">次</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  涉及 {myStats.total_conversations} 个对话会话
                </p>
              </div>

              <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs space-y-2">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                  <span className="text-xs font-medium">我的 Token 消耗 ({currentPeriodName})</span>
                  <Coins className="h-4 w-4 text-amber-500" />
                </div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white truncate">
                  {myStats.total_tokens.toLocaleString()}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  输入: {myStats.prompt_tokens.toLocaleString()} | 输出: {myStats.completion_tokens.toLocaleString()}
                </p>
              </div>

              <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs space-y-2">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                  <span className="text-xs font-medium">预估总花费 CNY ({currentPeriodName})</span>
                  <DollarSign className="h-4 w-4 text-emerald-500" />
                </div>
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 truncate">
                  ¥{myStats.estimated_cost_cny.toFixed(2)}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  按各官方厂商当前 Token 定价换算
                </p>
              </div>

              <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs space-y-2">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                  <span className="text-xs font-medium">预估总花费 USD ({currentPeriodName})</span>
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                </div>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 truncate">
                  ${myStats.estimated_cost_usd.toFixed(4)}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  美元计价成本
                </p>
              </div>
            </div>

            {/* My Models Breakdown */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs overflow-hidden">
              <div className="p-5 border-b border-slate-200 dark:border-slate-800">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-indigo-500" />
                  我使用的模型与费用明细 ({currentPeriodName})
                </h2>
              </div>

              {myStats.model_breakdown.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  该时间区间内暂无模型调用数据。
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-medium uppercase">
                      <tr>
                        <th className="py-3 px-4 whitespace-nowrap">调用模型</th>
                        <th className="py-3 px-4 whitespace-nowrap">调用次数</th>
                        <th className="py-3 px-4 whitespace-nowrap">输入 Token (Prompt)</th>
                        <th className="py-3 px-4 whitespace-nowrap">输出 Token (Completion)</th>
                        <th className="py-3 px-4 whitespace-nowrap">总 Token 消耗</th>
                        <th className="py-3 px-4 whitespace-nowrap text-right">折算花费 (CNY / USD)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {myStats.model_breakdown.map((m) => (
                        <tr
                          key={m.model}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-850/50 transition-colors"
                        >
                          <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                            <span>{m.model}</span>
                            {m.is_free && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                免费
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-700 dark:text-slate-300">
                            {m.calls} 次
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-500 dark:text-slate-400">
                            {m.prompt_tokens.toLocaleString()}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-500 dark:text-slate-400">
                            {m.completion_tokens.toLocaleString()}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white">
                            {m.total_tokens.toLocaleString()}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-right">
                            {m.is_free ? (
                              <span className="font-bold text-emerald-600 dark:text-emerald-400">¥0.00</span>
                            ) : (
                              <div>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                  ¥{m.cost_cny.toFixed(2)}
                                </span>
                                <span className="text-[10px] text-slate-400 block">
                                  ${m.cost_usd.toFixed(4)}
                                </span>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Dynamic Trend Breakdown */}
            {myStats.daily_trend.length > 0 && (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-5 shadow-xs space-y-4">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
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
                      className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-center space-y-1"
                    >
                      <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 font-mono">
                        {d.date}
                      </div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white font-mono">
                        {d.tokens.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-slate-400">
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                    <Eye className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>用户对话审查与审计</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 font-mono text-slate-600 dark:text-slate-300">
                        {auditUser.username}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      用户删除的对话在底层已安全归档保留，平台可完整审计内容与追踪 Token / 成本消耗。
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setAuditUser(null);
                    setInspectData(null);
                  }}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center justify-between px-6 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 dark:text-slate-400 font-medium mr-1">筛选状态:</span>
                  {(
                    [
                      { id: "all", label: `全部 (${auditConversations.length})` },
                      {
                        id: "active",
                        label: `正常显示 (${auditConversations.filter((c) => !c.is_deleted).length})`,
                      },
                      {
                        id: "deleted",
                        label: `已删除/回收站 (${auditConversations.filter((c) => c.is_deleted).length})`,
                      },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setAuditFilter(f.id)}
                      className={`px-3 py-1 rounded-lg font-medium transition-all ${
                        auditFilter === f.id
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => fetchAuditList(auditUser.id)}
                  disabled={auditLoading}
                  className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-indigo-600 transition-colors"
                >
                  <RefreshCw className={`h-3 w-3 ${auditLoading ? "animate-spin text-indigo-600" : ""}`} />
                  <span>刷新</span>
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-3">
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
                        className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          conv.is_deleted
                            ? "bg-rose-50/40 dark:bg-rose-950/20 border-rose-200/80 dark:border-rose-900/40"
                            : "bg-slate-50/80 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800"
                        }`}
                      >
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                              {conv.title || "未命名对话"}
                            </h4>
                            {conv.is_deleted ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-100/80 dark:bg-rose-900/40 border border-rose-300/60 dark:border-rose-800/60 px-2 py-0.5 rounded-full">
                                <Trash2 className="h-2.5 w-2.5" />
                                用户已删除 ({conv.deleted_at || "已移入回收站"})
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-100/80 dark:bg-emerald-900/40 border border-emerald-300/60 dark:border-emerald-800/60 px-2 py-0.5 rounded-full">
                                <CheckCircle2 className="h-2.5 w-2.5" />
                                正常活跃
                              </span>
                            )}
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              {conv.model}
                            </span>
                          </div>

                          <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 font-mono">
                            <span>消息: {conv.message_count} 条</span>
                            <span>Token 累计: {conv.total_tokens.toLocaleString()}</span>
                            <span>更新: {conv.updated_at || conv.created_at}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleInspectMessages(conv.id)}
                            className="px-3 py-1.5 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all flex items-center gap-1 shadow-2xs"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            <span>查阅消息</span>
                          </button>

                          {conv.is_deleted && (
                            <button
                              type="button"
                              disabled={restoreLoading === conv.id}
                              onClick={() => handleAdminRestore(conv.id, conv.title)}
                              className="px-3 py-1.5 rounded-xl text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-all flex items-center gap-1"
                            >
                              <RotateCcw className={`h-3.5 w-3.5 ${restoreLoading === conv.id ? "animate-spin" : ""}`} />
                              <span>恢复对话</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ===================== MESSAGE INSPECTION POPUP ===================== */}
        {inspectData && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                    <MessageSquare className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-md">
                      {inspectData.conversation.title}
                    </h3>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <span>模型: {inspectData.conversation.model}</span>
                      <span>·</span>
                      <span>共 {inspectData.messages.length} 条消息</span>
                      {inspectData.conversation.is_deleted && (
                        <span className="text-rose-500 font-semibold">(用户已删除)</span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setInspectData(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Messages Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {inspectData.messages.length === 0 ? (
                  <div className="py-16 text-center text-xs text-slate-500">对话中暂无任何消息。</div>
                ) : (
                  inspectData.messages.map((msg, idx) => (
                    <div
                      key={msg.id || idx}
                      className={`flex flex-col space-y-1.5 ${
                        msg.role === "user" ? "items-end" : "items-start"
                      }`}
                    >
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono px-1">
                        <span className="font-semibold uppercase">{msg.role}</span>
                        <span>{msg.created_at}</span>
                        {msg.token_usage > 0 && <span>· {msg.token_usage} Tokens</span>}
                      </div>

                      <div
                        className={`max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed whitespace-pre-wrap ${
                          msg.role === "user"
                            ? "bg-indigo-600 text-white rounded-tr-xs"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-xs border border-slate-200 dark:border-slate-700/60"
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </main>
      </div>
    </div>
  );
}
