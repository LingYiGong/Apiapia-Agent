"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";
import { ViewShell } from "@/components/common/ViewShell";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ActionTooltip } from "@/components/common/ActionTooltip";
import { SegmentedControl } from "@/components/common/SegmentedControl";
import { AdminBadge } from "@/components/common/UserAvatar";
import { FullPageSkeleton, StatCardsSkeleton } from "@/components/common/PageSkeleton";
import {
  AdminOverviewCards,
  AuditDialog,
  InspectMessagesDialog,
  ModelBreakdown,
  MyModelsTable,
  MyUsageCards,
  TrendGrid,
  UsersTable,
  type UserActions,
} from "@/components/usage/UsagePanels";
import { useRefreshOnResume } from "@/hooks/useRefreshOnResume";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useConfirm } from "@/hooks/useConfirm";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { MyUsageStats, AdminOverviewStats } from "@/types";
import type { MobileTab } from "@/config/navigation";
import {
  BarChart3,
  Calendar,
  Coins,
  RefreshCw,
  TrendingUp,
  UserCheck,
  Users,
  Zap,
} from "lucide-react";

type PeriodType = "today" | "month" | "year" | "all";

export interface UsageViewProps {
  isMobileSpa?: boolean;
  onSelectMobileTab?: (tab: MobileTab) => void;
  /** 移动端 SPA 里该页签当前是否可见；用于切回时补一次刷新 */
  active?: boolean;
}

const PERIOD_LABELS: Record<PeriodType, string> = {
  today: "今天",
  month: "本月",
  year: "今年",
  all: "全部累计",
};

/** 时间区间筛选器。上一版是 Tab，一度用 Tabs 组件（role=tablist）实现，
 *  但它不是选项卡而是「一组单选」，现在改为 SegmentedControl（radiogroup）。 */
const PERIOD_OPTIONS = [
  { value: "today" as const, label: "今天", icon: Zap, iconClassName: "text-amber-500" },
  { value: "month" as const, label: "本月", icon: Calendar, iconClassName: "text-blue-500" },
  { value: "year" as const, label: "今年", icon: TrendingUp, iconClassName: "text-indigo-500" },
  { value: "all" as const, label: "全部累计", icon: Coins, iconClassName: "text-emerald-500" },
];

const PERIOD_HINT: Record<PeriodType, string> = {
  today: "⚡ 今日 00:00 至今",
  month: "📅 本月 1 日 00:00 至今",
  year: "📆 本年 1 月 1 日至今",
  all: "🌐 历史全部数据汇总",
};

export const UsageView: React.FC<UsageViewProps> = ({
  isMobileSpa = false,
  onSelectMobileTab,
  active = true,
}) => {
  const { user, loading } = useAuth();

  const [activeTab, setActiveTab] = useState<"overview" | "my">("overview");
  const [period, setPeriod] = useState<PeriodType>("all");
  const [adminStats, setAdminStats] = useState<AdminOverviewStats | null>(null);
  const [myStats, setMyStats] = useState<MyUsageStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Admin Audit Modal State
  const [auditUser, setAuditUser] = useState<{ id: string; username: string } | null>(null);
  const [auditConversations, setAuditConversations] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditFilter, setAuditFilter] = useState<"all" | "active" | "deleted">("all");
  const [inspectData, setInspectData] = useState<{ conversation: any; messages: any[] } | null>(null);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState<string | null>(null);
  const [modelSortKey, setModelSortKey] = useState<"cost" | "tokens">("cost");

  // 统一确认框 + 写操作状态机（原先三处管理员操作各自维护一份 try/catch/finally）
  const { ask: askConfirm, dialog: confirmDialog } = useConfirm();
  const { pendingKey: actionLoading, isPending: isActionPendingFor, run: runAction } = useAsyncAction();

  // 该行任一管理动作在途（启用/停用、授予/取消管理员、开通/限制模型）。
  // 三个动作的 key 都以 user_id 为后缀，所以统一前缀匹配即可覆盖整行。
  const isActionPending = (userId: string) =>
    isActionPendingFor(`active-${userId}`) ||
    isActionPendingFor(`admin-${userId}`) ||
    isActionPendingFor(`model-${userId}`);

  // 视图内部守卫（此前与 SettingsView / MemoryView 逐字相同的三份之一）
  useRequireAuth();

  const isSuperuser = !!user?.is_superuser;

  const fetchStats = async (pOverride?: PeriodType) => {
    const targetPeriod = pOverride || period;
    setIsLoading(true);
    const tzOffset = new Date().getTimezoneOffset();
    try {
      if (isSuperuser) {
        const [admData, myData] = await Promise.all([
          apiRequest<AdminOverviewStats>(`/stats/admin/overview?period=${targetPeriod}&tz_offset=${tzOffset}`),
          apiRequest<MyUsageStats>(`/stats/my?period=${targetPeriod}&tz_offset=${tzOffset}`),
        ]);
        setAdminStats(admData);
        setMyStats(myData);
      } else {
        const myData = await apiRequest<MyUsageStats>(
          `/stats/my?period=${targetPeriod}&tz_offset=${tzOffset}`
        );
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

  /* ── 三个管理员操作（结构同构，收口到 runAction）── */

  const handleToggleActive = (userId: string, currentStatus: boolean, username: string) => {
    askConfirm({
      title: `${currentStatus ? "停用" : "启用"}用户`,
      description: `确定要${currentStatus ? "停用" : "启用"}用户「${username}」吗？${
        currentStatus ? "停用后该用户将无法登录使用。" : ""
      }`,
      confirmText: currentStatus ? "停用" : "启用",
      danger: currentStatus,
      onConfirm: () =>
        // key 必须带上动作名。三个操作原本都用裸 userId，于是「设为管理员」在
        // 「启用/停用」在途时被单飞守卫直接 return undefined —— 无 toast、无
        // 任何 UI 变化，用户点了永远没反应。
        runAction(
          `active-${userId}`,
          async () => {
            await apiRequest(`/stats/admin/users/${userId}/toggle-active`, { method: "POST" });
            await fetchStats();
          },
          { success: `已${currentStatus ? "停用" : "启用"}用户「${username}」` }
        ),
    });
  };

  const handleToggleAdmin = (userId: string, currentAdmin: boolean, username: string) => {
    askConfirm({
      title: `${currentAdmin ? "取消" : "授予"}管理员权限`,
      description: `确定要${currentAdmin ? "取消" : "设置"}用户「${username}」的超级管理员权限吗？`,
      confirmText: currentAdmin ? "取消权限" : "设为管理员",
      danger: currentAdmin,
      onConfirm: () =>
        runAction(
          `admin-${userId}`,
          async () => {
            await apiRequest(`/stats/admin/users/${userId}/toggle-admin`, { method: "POST" });
            await fetchStats();
          },
          { success: `已${currentAdmin ? "取消" : "授予"}用户「${username}」的管理员权限` }
        ),
    });
  };

  const handleToggleAllModels = (userId: string, currentAccessAll: boolean, username: string) => {
    const nextStatus = !currentAccessAll;
    askConfirm({
      title: `${nextStatus ? "开通" : "限制"}模型访问权限`,
      description: nextStatus
        ? `确定为用户「${username}」开通完整体验权限吗？开通后该用户可使用系统内包括所有高级付费模型在内的全部可用模型。`
        : `确定将用户「${username}」切换为体验模式吗？切换后该用户将只能访问和调用免费模型。`,
      confirmText: nextStatus ? "开通完整体验" : "切换为体验模式",
      danger: !nextStatus,
      onConfirm: () =>
        runAction(
          `model-${userId}`,
          async () => {
            await apiRequest(`/stats/admin/users/${userId}/toggle-all-models`, {
              method: "POST",
              body: JSON.stringify({ can_access_all_models: nextStatus }),
            });
            await fetchStats();
          },
          {
            success: `已为用户「${username}」${nextStatus ? "开通完整体验" : "切换为体验模式"}`,
          }
        ),
    });
  };

  /* ── 审计 ── */

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
      // Restore lives at the conversation resource, not under /stats. There used to
      // be a second copy here that forwarded to it purely to reshape the response;
      // this call never used that response, so the duplicate could go.
      await apiRequest(`/conversations/${convId}/restore`, { method: "POST" });
      await fetchAuditList(auditUser.id);
      await fetchStats();
      toast.success(`已恢复对话「${title}」`);
    } catch (err: any) {
      toast.error(err.message || "恢复对话失败");
    } finally {
      setRestoreLoading(null);
    }
  };

  /**
   * 表格的操作回调。
   *
   * 刻意**不做 useMemo**。此前它被 `useMemo([isActionPendingFor])` 锁住，而
   * `isActionPendingFor` 是稳定引用 —— 于是这个对象永远停在首轮，里面捕获的
   * `fetchStats` 也停在首轮，`fetchStats` 又闭包了当时的 `period`。
   * 后果：用户切了时间区间，再去操作某个用户的模型权限，刷新回来的仍是旧区间
   * 的数据（表格和 KPI 一起跳回）。
   *
   * 每次渲染重建的代价为零：UsersTable 不是 memo 组件，稳定引用没有任何收益，
   * 而错误的缓存会直接显示错数据。
   */
  const userActions: UserActions = {
    onToggleAllModels: handleToggleAllModels,
    onToggleActive: handleToggleActive,
    onToggleAdmin: handleToggleAdmin,
    onOpenAudit: handleOpenAudit,
    isModelPending: (id) => isActionPendingFor(`model-${id}`),
    isRowPending: isActionPending,
  };

  if (loading || !user) return <FullPageSkeleton variant="list" />;

  const currentPeriodName = PERIOD_LABELS[period];
  const showSkeleton = isLoading && !adminStats && !myStats;

  const trendTitle =
    period === "today"
      ? "今日各时段消耗走势 (Hourly Trend)"
      : period === "year"
      ? "今年各月份消耗走势 (Monthly Trend)"
      : `${currentPeriodName}走势明细`;

  return (
    <ViewShell
      title="用量与账单"
      isMobileSpa={isMobileSpa}
      onSelectMobileTab={onSelectMobileTab}
      maxWidth="6xl"
    >
      {/* ── 桌面头部 ── */}
      <div className="hidden flex-row items-center justify-between gap-4 border-b border-border/40 pb-5 md:flex">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs font-medium text-primary">
              <BarChart3 className="h-4 w-4 shrink-0" />
              <span>{isSuperuser ? "平台用量监控" : "个人用量统计"}</span>
            </span>
            {isSuperuser && <AdminBadge size="sm" />}
          </div>
          <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">
            {isSuperuser ? "平台用量与成本核算" : "我的用量总览"}
          </h1>
          <p className="max-w-2xl text-footnote leading-relaxed text-muted-foreground">
            {isSuperuser
              ? "统计所有注册用户的 Token 消耗、调用轮次与模型定价折算费用，支持时间区间筛选与账号权限管控。"
              : "查看你在本平台产生的全部对话轮次、输入/输出 Token 消耗及模型调用明细。"}
          </p>
        </div>

        <RefreshButton onClick={() => fetchStats()} loading={isLoading} />
      </div>

      {/* ── 移动端子栏 ── */}
      <div className="flex items-center justify-between gap-2 pb-0.5 md:hidden">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            {isSuperuser ? "平台管理员控制台" : "个人用量统计"}
          </span>
          {isSuperuser && <AdminBadge size="sm" />}
        </div>
        <RefreshButton onClick={() => fetchStats()} loading={isLoading} compact />
      </div>

      {/* ── 时间区间筛选 ── */}
      <div className="flex flex-col gap-2.5 rounded-2xl border border-border/50 bg-card/80 p-2 shadow-2xs backdrop-blur-md sm:flex-row sm:items-center sm:justify-between sm:p-2.5">
        <div className="flex shrink-0 items-center gap-2 overflow-x-auto py-0.5 no-scrollbar">
          <span className="shrink-0 whitespace-nowrap pl-1 text-xs font-medium text-muted-foreground">
            统计区间:
          </span>
          <SegmentedControl
            size="sm"
            ariaLabel="统计时间区间"
            value={period}
            onValueChange={handlePeriodChange}
            options={PERIOD_OPTIONS}
            listClassName="shrink-0"
          />
        </div>

        <span className="shrink-0 self-start rounded-md border border-border/20 bg-surface-3/30 px-2 py-0.5 font-mono text-2xs text-muted-foreground/80 sm:self-auto">
          {PERIOD_HINT[period]}
        </span>
      </div>

      {/* ── 管理员 / 我的 切换：这一处确实是选项卡，保留 Tabs 语义 ── */}
      {isSuperuser && (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "overview" | "my")}>
          <TabsList className="inline-flex h-9 gap-1 rounded-xl border border-border/40 bg-surface-3/60 p-1 backdrop-blur-sm">
            <TabsTrigger
              value="overview"
              className="flex h-7 items-center gap-1.5 rounded-lg px-3.5 text-xs font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-2xs data-[state=active]:text-foreground sm:text-sm"
            >
              <Users className="h-3.5 w-3.5 text-indigo-500" />
              <span>全部用户</span>
              {adminStats && (
                <span className="rounded-full bg-primary/10 px-1.5 py-px font-mono text-2xs font-semibold text-primary">
                  {adminStats.total_users}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="my"
              className="flex h-7 items-center gap-1.5 rounded-lg px-3.5 text-xs font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-2xs data-[state=active]:text-foreground sm:text-sm"
            >
              <UserCheck className="h-3.5 w-3.5 text-emerald-500" />
              <span>我的用量</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {showSkeleton && <StatCardsSkeleton />}

      {isSuperuser && activeTab === "overview" && adminStats && (
        <div className="space-y-6">
          <AdminOverviewCards stats={adminStats} />

          <UsersTable
            users={adminStats.users}
            currentUserId={user.id}
            periodName={currentPeriodName}
            actions={userActions}
          />

          <ModelBreakdown
            items={adminStats.model_breakdown}
            sortKey={modelSortKey}
            onSortKeyChange={setModelSortKey}
            periodName={currentPeriodName}
          />

          <TrendGrid
            items={adminStats.daily_trend}
            title={trendTitle}
            description="各时间段的 Token 与费用趋势分布"
            unitLabel="次"
          />
        </div>
      )}

      {((!isSuperuser) || activeTab === "my") && myStats && (
        <div className="space-y-6">
          <MyUsageCards stats={myStats} />
          <MyModelsTable items={myStats.model_breakdown} />
          <TrendGrid
            items={myStats.daily_trend}
            title={
              period === "today"
                ? "今日各时段消耗走势 (Hourly Trend)"
                : period === "year"
                ? "今年各月份用量分布 (Monthly Trend)"
                : `${currentPeriodName}走势明细`
            }
            description="你个人在选定区间内的对话与 Token 趋势"
            unitLabel="次对话"
          />
        </div>
      )}

      {auditUser && (
        <AuditDialog
          open
          username={auditUser.username}
          conversations={auditConversations}
          loading={auditLoading}
          filter={auditFilter}
          onFilterChange={setAuditFilter}
          onRefresh={() => fetchAuditList(auditUser.id)}
          onClose={() => {
            setAuditUser(null);
            setInspectData(null);
          }}
          onInspect={handleInspectMessages}
          onRestore={handleAdminRestore}
          restoringId={restoreLoading}
        />
      )}

      {confirmDialog}

      {inspectData && (
        <InspectMessagesDialog data={inspectData} onClose={() => setInspectData(null)} />
      )}

      {/* 查阅中的加载态：inspecting 期间在弹窗标题栏给一个转圈 */}
      {inspectLoading && (
        <span className="sr-only" role="status" aria-live="polite">
          正在载入对话消息…
        </span>
      )}
    </ViewShell>
  );
};

function RefreshButton({
  onClick,
  loading,
  compact,
}: {
  onClick: () => void;
  loading: boolean;
  compact?: boolean;
}) {
  return (
    <ActionTooltip label="重新拉取统计">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onClick}
        disabled={loading}
        className={cn(
          "shrink-0 cursor-pointer gap-1.5 rounded-full border-border/50 bg-card/80 font-medium text-muted-foreground shadow-2xs transition-colors hover:bg-surface-3 active:scale-95",
          compact ? "h-7 px-3 text-2xs" : "h-8 px-3.5 text-xs"
        )}
      >
        <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin text-primary")} />
        <span>{compact ? "刷新" : "刷新数据"}</span>
      </Button>
    </ActionTooltip>
  );
}
