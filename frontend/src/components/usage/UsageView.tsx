"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";
import { ViewShell } from "@/components/common/ViewShell";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ActionTooltip } from "@/components/common/ActionTooltip";
import { SegmentedControl, type SegmentedOption } from "@/components/common/SegmentedControl";
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
import { useI18n } from "@/i18n";
import type { MessageKey } from "@/i18n";
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

const PERIOD_LABEL_KEYS: Record<PeriodType, MessageKey> = {
  today: "usage.period.today",
  month: "usage.period.month",
  year: "usage.period.year",
  all: "usage.period.all",
};

const PERIOD_HINT_KEYS: Record<PeriodType, MessageKey> = {
  today: "usage.period.hintToday",
  month: "usage.period.hintMonth",
  year: "usage.period.hintYear",
  all: "usage.period.hintAll",
};

/** 时间区间筛选配置。 */
const PERIOD_OPTIONS: readonly {
  value: PeriodType;
  labelKey: MessageKey;
  icon: typeof Zap;
  iconClassName: string;
}[] = [
  { value: "today", labelKey: "usage.period.today", icon: Zap, iconClassName: "text-amber-500" },
  { value: "month", labelKey: "usage.period.month", icon: Calendar, iconClassName: "text-blue-500" },
  { value: "year", labelKey: "usage.period.year", icon: TrendingUp, iconClassName: "text-indigo-500" },
  { value: "all", labelKey: "usage.period.all", icon: Coins, iconClassName: "text-emerald-500" },
];

export const UsageView: React.FC<UsageViewProps> = ({
  isMobileSpa = false,
  onSelectMobileTab,
  active = true,
}) => {
  const { user, loading } = useAuth();
  const { t, fmt } = useI18n();

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
  const [purgeLoading, setPurgeLoading] = useState(false);
  const [modelSortKey, setModelSortKey] = useState<"cost" | "tokens">("cost");

  const { ask: askConfirm, dialog: confirmDialog } = useConfirm();
  const { pendingKey: actionLoading, isPending: isActionPendingFor, run: runAction } = useAsyncAction();

  const isActionPending = (userId: string) =>
    isActionPendingFor(`active-${userId}`) ||
    isActionPendingFor(`admin-${userId}`) ||
    isActionPendingFor(`model-${userId}`);

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

  const handleToggleActive = (userId: string, currentStatus: boolean, username: string) => {
    askConfirm({
      title: currentStatus ? t("usage.admin.disableConfirmTitle") : t("usage.admin.enableConfirmTitle"),
      description: currentStatus
        ? t("usage.admin.disableConfirmDesc", { username })
        : t("usage.admin.enableConfirmDesc", { username }),
      confirmText: currentStatus ? t("usage.admin.disable") : t("usage.admin.enable"),
      danger: currentStatus,
      onConfirm: () =>
        runAction(
          `active-${userId}`,
          async () => {
            await apiRequest(`/stats/admin/users/${userId}/toggle-active`, { method: "POST" });
            await fetchStats();
          },
          {
            success: currentStatus
              ? t("usage.admin.disableDone", { username })
              : t("usage.admin.enableDone", { username }),
          }
        ),
    });
  };

  const handleToggleAdmin = (userId: string, currentAdmin: boolean, username: string) => {
    askConfirm({
      title: currentAdmin ? t("usage.admin.revokeAdminTitle") : t("usage.admin.grantAdminTitle"),
      description: currentAdmin
        ? t("usage.admin.revokeAdminDesc", { username })
        : t("usage.admin.grantAdminDesc", { username }),
      confirmText: currentAdmin
        ? t("usage.admin.revokeAdminConfirm")
        : t("usage.admin.grantAdminConfirm"),
      danger: currentAdmin,
      onConfirm: () =>
        runAction(
          `admin-${userId}`,
          async () => {
            await apiRequest(`/stats/admin/users/${userId}/toggle-admin`, { method: "POST" });
            await fetchStats();
          },
          {
            success: currentAdmin
              ? t("usage.admin.revokeAdminDone", { username })
              : t("usage.admin.grantAdminDone", { username }),
          }
        ),
    });
  };

  const handleToggleAllModels = (userId: string, currentAccessAll: boolean, username: string) => {
    const nextStatus = !currentAccessAll;
    askConfirm({
      title: nextStatus ? t("usage.admin.grantModelsTitle") : t("usage.admin.restrictModelsTitle"),
      description: nextStatus
        ? t("usage.admin.grantModelsDesc", { username })
        : t("usage.admin.restrictModelsDesc", { username }),
      confirmText: nextStatus
        ? t("usage.admin.grantModelsConfirm")
        : t("usage.admin.restrictModelsConfirm"),
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
            success: nextStatus
              ? t("usage.admin.grantModelsDone", { username })
              : t("usage.admin.restrictModelsDone", { username }),
          }
        ),
    });
  };

  const fetchAuditList = async (userId: string) => {
    setAuditLoading(true);
    try {
      const data = await apiRequest<any[]>(`/stats/admin/users/${userId}/conversations`);
      setAuditConversations(data || []);
    } catch (err: any) {
      toast.error(err.message || t("usage.audit.loadConversationsFailed"));
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
      toast.error(err.message || t("usage.audit.loadMessagesFailed"));
    } finally {
      setInspectLoading(false);
    }
  };

  const handleAdminRestore = async (convId: string, title: string) => {
    if (!auditUser) return;
    setRestoreLoading(convId);
    try {
      await apiRequest(`/conversations/${convId}/restore`, { method: "POST" });
      await fetchAuditList(auditUser.id);
      await fetchStats();
      toast.success(t("usage.audit.restoreDone", { title }));
    } catch (err: any) {
      toast.error(err.message || t("usage.audit.restoreFailed"));
    } finally {
      setRestoreLoading(null);
    }
  };

  const handlePurgeDeleted = () => {
    if (!auditUser) return;
    askConfirm({
      title: t("usage.audit.purgeTitle"),
      description: t("usage.audit.purgeDesc", { username: auditUser.username }),
      confirmText: t("usage.audit.purgeConfirm"),
      danger: true,
      onConfirm: async () => {
        setPurgeLoading(true);
        try {
          await apiRequest(`/stats/admin/users/${auditUser.id}/deleted-conversations`, { method: "DELETE" });
          await fetchAuditList(auditUser.id);
          await fetchStats();
          toast.success(t("usage.audit.purgeDone"));
        } catch (err: any) {
          toast.error(err.message || t("usage.audit.purgeFailed"));
        } finally {
          setPurgeLoading(false);
        }
      },
    });
  };

  const userActions: UserActions = {
    onToggleAllModels: handleToggleAllModels,
    onToggleActive: handleToggleActive,
    onToggleAdmin: handleToggleAdmin,
    onOpenAudit: handleOpenAudit,
    isModelPending: (id) => isActionPendingFor(`model-${id}`),
    isRowPending: isActionPending,
  };

  if (loading || !user) return <FullPageSkeleton variant="list" />;

  const currentPeriodName = t(PERIOD_LABEL_KEYS[period]);
  const showSkeleton = isLoading && !adminStats && !myStats;

  // 模块级只存键；文案在渲染时经 t() 查，否则换语言时这里必然留下中文。
  const periodOptions = PERIOD_OPTIONS.map(
    (o): SegmentedOption<PeriodType> => ({
      value: o.value,
      label: t(o.labelKey),
      icon: o.icon,
      iconClassName: o.iconClassName,
    })
  );

  const adminTrendTitle =
    period === "today"
      ? t("usage.trend.adminTodayTitle")
      : period === "year"
      ? t("usage.trend.adminYearTitle")
      : t("usage.trend.adminDefaultTitle", { period: currentPeriodName });

  const userTrendTitle =
    period === "today"
      ? t("usage.trend.userTodayTitle")
      : period === "year"
      ? t("usage.trend.userYearTitle")
      : t("usage.trend.userDefaultTitle", { period: currentPeriodName });

  return (
    <ViewShell
      title={t("usage.title")}
      isMobileSpa={isMobileSpa}
      onSelectMobileTab={onSelectMobileTab}
      maxWidth="6xl"
    >
      <div className="hidden flex-row items-center justify-between gap-4 border-b border-border/40 pb-5 md:flex">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs font-medium text-primary">
              <BarChart3 className="h-4 w-4 shrink-0" />
              <span>{isSuperuser ? t("usage.header.adminEyebrow") : t("usage.header.userEyebrow")}</span>
            </span>
            {isSuperuser && <AdminBadge size="sm" />}
          </div>
          <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">
            {isSuperuser ? t("usage.header.adminTitle") : t("usage.header.userTitle")}
          </h1>
          <p className="max-w-2xl text-footnote leading-relaxed text-muted-foreground">
            {isSuperuser ? t("usage.header.adminDesc") : t("usage.header.userDesc")}
          </p>
        </div>

        <RefreshButton onClick={() => fetchStats()} loading={isLoading} />
      </div>

      <div className="flex items-center justify-between gap-2 pb-0.5 md:hidden">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            {isSuperuser ? t("usage.header.adminMobileSub") : t("usage.header.userMobileSub")}
          </span>
          {isSuperuser && <AdminBadge size="sm" />}
        </div>
        <RefreshButton onClick={() => fetchStats()} loading={isLoading} compact />
      </div>

      <div className="flex flex-col gap-2.5 rounded-2xl border border-border/50 bg-card/80 p-2 shadow-2xs backdrop-blur-md sm:flex-row sm:items-center sm:justify-between sm:p-2.5">
        <div className="flex shrink-0 items-center gap-2 overflow-x-auto py-0.5 no-scrollbar">
          <span className="shrink-0 whitespace-nowrap pl-1 text-xs font-medium text-muted-foreground">
            {t("usage.period.label")}
          </span>
          <SegmentedControl
            size="sm"
            ariaLabel={t("usage.period.aria")}
            value={period}
            onValueChange={handlePeriodChange}
            options={periodOptions}
            listClassName="shrink-0"
          />
        </div>

        <span className="shrink-0 self-start rounded-md border border-border/20 bg-surface-3/30 px-2 py-0.5 font-mono text-xs text-muted-foreground/85 sm:self-auto">
          {t(PERIOD_HINT_KEYS[period])}
        </span>
      </div>

      {isSuperuser && (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "overview" | "my")}>
          <TabsList className="inline-flex h-9 gap-1 rounded-xl border border-border/40 bg-surface-3/60 p-1 backdrop-blur-sm">
            <TabsTrigger
              value="overview"
              className="flex h-7 items-center gap-1.5 rounded-lg px-3.5 text-xs font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-2xs data-[state=active]:text-foreground sm:text-sm"
            >
              <Users className="h-3.5 w-3.5 text-indigo-500" />
              <span>{t("usage.tabs.allUsers")}</span>
              {adminStats && (
                <span className="rounded-full bg-primary/10 px-1.5 py-px font-mono text-xs font-semibold text-primary">
                  {fmt.number(adminStats.total_users)}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="my"
              className="flex h-7 items-center gap-1.5 rounded-lg px-3.5 text-xs font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-2xs data-[state=active]:text-foreground sm:text-sm"
            >
              <UserCheck className="h-3.5 w-3.5 text-emerald-500" />
              <span>{t("usage.tabs.myUsage")}</span>
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
            title={adminTrendTitle}
            description={t("usage.trend.adminDesc")}
            unitLabel={t("usage.trend.adminUnit")}
          />
        </div>
      )}

      {((!isSuperuser) || activeTab === "my") && myStats && (
        <div className="space-y-6">
          <MyUsageCards stats={myStats} />
          <MyModelsTable items={myStats.model_breakdown} />
          <TrendGrid
            items={myStats.daily_trend}
            title={userTrendTitle}
            description={t("usage.trend.userDesc")}
            unitLabel={t("usage.trend.userUnit")}
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
          onPurgeDeleted={handlePurgeDeleted}
          purgeLoading={purgeLoading}
        />
      )}

      {confirmDialog}

      {inspectData && (
        <InspectMessagesDialog data={inspectData} onClose={() => setInspectData(null)} />
      )}

      {inspectLoading && (
        <span className="sr-only" role="status" aria-live="polite">
          {t("usage.refresh.loadingAudit")}
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
  const { t } = useI18n();
  return (
    <ActionTooltip label={t("usage.refresh.tip")}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onClick}
        disabled={loading}
        className={cn(
          "shrink-0 cursor-pointer gap-1.5 rounded-full border-border/50 bg-card/80 font-medium text-muted-foreground shadow-2xs transition-colors hover:bg-surface-3 active:scale-95",
          compact ? "h-7 px-3 text-xs" : "h-8 px-3.5 text-xs"
        )}
      >
        <RefreshCw className={cn("h-4 w-4", loading && "animate-spin text-primary")} />
        <span>{compact ? t("usage.refresh.short") : t("usage.refresh.full")}</span>
      </Button>
    </ActionTooltip>
  );
}
