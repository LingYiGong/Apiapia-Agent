"use client";

import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ActionTooltip } from "@/components/common/ActionTooltip";
import { Panel, SectionHeader } from "@/components/common/Panel";
import { EmptyState } from "@/components/common/EmptyState";
import { AdminBadge, UserAvatar } from "@/components/common/UserAvatar";
import { CostValue, FreeBadge, LiveDotStat, StatCard, StatusPill } from "@/components/usage/StatCard";
import {
  Activity,
  CheckCircle2,
  Clock,
  Coins,
  Cpu,
  DollarSign,
  Eye,
  FileText,
  MessageSquare,
  MoreHorizontal,
  RefreshCw,
  RotateCcw,
  Shield,
  Sparkles,
  Trash2,
  TrendingUp,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";
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
import {
  overlaySurfaceClass,
  menuItemClass,
  menuSeparatorClass,
} from "@/components/common/surfaces";
import { SegmentedControl, type SegmentedOption } from "@/components/common/SegmentedControl";
import { useI18n } from "@/i18n";
import type { MessageKey } from "@/i18n";
import type {
  AdminOverviewStats,
  AdminUserUsageItem,
  MyUsageStats,
} from "@/types";
import { cn } from "@/lib/utils";

/**
 * 用量页的展示层。
 *
 * 从 UsageView（1363 行）里拆出。原先这个文件里有 8 份逐字相同的 KPI 卡片、
 * 一整张 9 列的管理员表格、以及两个各自维护筛选/加载状态的审计弹窗。
 * 现在按职责分成 StatCard / UsersTable / ModelBreakdown / TrendGrid / AuditDialog。
 */

const TONE = {
  indigo: "bg-indigo-500/10 text-indigo-500 dark:text-indigo-400",
  blue: "bg-blue-500/10 text-blue-500 dark:text-blue-400",
  amber: "bg-amber-500/10 text-amber-500 dark:text-amber-400",
  emerald: "bg-emerald-500/10 text-emerald-500 dark:text-emerald-400",
} as const;

/* ─────────────────────────── 平台总览 KPI ─────────────────────────── */

export function AdminOverviewCards({ stats }: { stats: AdminOverviewStats }) {
  const { t, fmt } = useI18n();
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <StatCard
        label={t("usage.cards.totalUsers")}
        icon={Users}
        tone={TONE.indigo}
        value={fmt.number(stats.total_users)}
        unit={t("usage.cards.usersUnit")}
        footer={
          <LiveDotStat>
            {t("usage.cards.activeUsers", { count: fmt.number(stats.active_users) })}
          </LiveDotStat>
        }
      />
      <StatCard
        label={t("usage.cards.messagesAdmin")}
        icon={MessageSquare}
        tone={TONE.blue}
        value={fmt.number(stats.total_messages)}
        unit={t("usage.cards.roundsUnit")}
        footer={t("usage.cards.conversationsAdmin", { count: fmt.number(stats.total_conversations) })}
      />
      <StatCard
        label={t("usage.cards.tokens")}
        icon={Coins}
        tone={TONE.amber}
        value={fmt.number(stats.total_tokens)}
        truncateValue
        footer={t("usage.cards.tokenSplit", {
          prompt: fmt.number(stats.total_prompt_tokens),
          completion: fmt.number(stats.total_completion_tokens),
        })}
      />
      <StatCard
        label={t("usage.cards.costEstimated")}
        icon={DollarSign}
        tone={TONE.emerald}
        value={`¥${stats.total_cost_cny.toFixed(2)}`}
        truncateValue
        footer={t("usage.cards.usdApprox", {
          amount: fmt.number(stats.total_cost_usd, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 4,
          }),
        })}
      />
    </div>
  );
}

/* ─────────────────────────── 个人用量 KPI ─────────────────────────── */

export function MyUsageCards({ stats }: { stats: MyUsageStats }) {
  const { t, fmt } = useI18n();
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <StatCard
        label={t("usage.cards.messagesUser")}
        icon={MessageSquare}
        tone={TONE.blue}
        value={fmt.number(stats.total_messages)}
        unit={t("usage.cards.roundsUnit")}
        footer={t("usage.cards.conversationsUser", { count: fmt.number(stats.total_conversations) })}
      />
      <StatCard
        label={t("usage.cards.tokens")}
        icon={Coins}
        tone={TONE.amber}
        value={fmt.number(stats.total_tokens)}
        truncateValue
        footer={t("usage.cards.tokenSplit", {
          prompt: fmt.number(stats.prompt_tokens),
          completion: fmt.number(stats.completion_tokens),
        })}
      />
      <StatCard
        label={t("usage.cards.costCnyUser")}
        icon={DollarSign}
        tone={TONE.emerald}
        value={`¥${stats.estimated_cost_cny.toFixed(2)}`}
        truncateValue
        footer={t("usage.cards.cnyNote")}
      />
      <StatCard
        label={t("usage.cards.costUsdUser")}
        icon={TrendingUp}
        tone="bg-blue-500/10 text-blue-600 dark:text-blue-400"
        value={fmt.currency(stats.estimated_cost_usd)}
        truncateValue
        footer={t("usage.cards.usdNote")}
      />
    </div>
  );
}

/* ─────────────────────────── 模型分布 ─────────────────────────── */

export function ModelBreakdown({
  items,
  sortKey,
  onSortKeyChange,
  periodName,
}: {
  items: AdminOverviewStats["model_breakdown"];
  sortKey: "cost" | "tokens";
  onSortKeyChange: (k: "cost" | "tokens") => void;
  periodName: string;
}) {
  const { t, fmt } = useI18n();
  const sorted = [...items].sort((a, b) =>
    sortKey === "cost"
      ? b.cost_cny - a.cost_cny || b.total_tokens - a.total_tokens
      : b.total_tokens - a.total_tokens || b.cost_cny - a.cost_cny
  );
  const maxVal = Math.max(
    ...sorted.map((m) => (sortKey === "cost" ? m.cost_cny : m.total_tokens)),
    1
  );

  const sortOptions: SegmentedOption<"cost" | "tokens">[] = [
    { value: "cost", label: t("usage.models.sortByCost") },
    { value: "tokens", label: t("usage.models.sortByTokens") },
  ];

  return (
    <Panel className="space-y-4 p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <SectionHeader
          icon={Cpu}
          tone={TONE.indigo}
          className="flex-1 border-0 p-0"
          title={t("usage.models.breakdownTitle", { period: periodName })}
          description={t("usage.models.breakdownDesc")}
        />
        {/* 排序是一个 radio group（选一个），此前误用了 Tabs：
            读屏会播报成「选项卡」，方向键会把焦点移到没有关联面板的选项上。 */}
        <SegmentedControl
          size="sm"
          ariaLabel={t("usage.models.sortAria")}
          value={sortKey}
          onValueChange={onSortKeyChange}
          options={sortOptions}
          listClassName="self-start sm:self-auto"
        />
      </div>

      {sorted.length === 0 ? (
        <EmptyState className="py-8" title={t("usage.models.empty")} />
      ) : (
        <div className="space-y-2.5">
          {sorted.map((m, idx) => {
            const currentVal = sortKey === "cost" ? m.cost_cny : m.total_tokens;
            const percent = Math.min(Math.round((currentVal / maxVal) * 100), 100);
            return (
              <Panel
                key={m.model}
                tone="muted"
                className="space-y-2 p-3.5 transition-colors hover:bg-surface-3/40"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg font-mono text-2xs font-semibold",
                      idx === 0
                        ? "border border-amber-500/30 bg-amber-500/15 text-amber-600 dark:text-amber-400"
                        : idx === 1
                        ? "border border-slate-400/30 bg-slate-400/15 text-slate-600 dark:text-slate-300"
                        : idx === 2
                        ? "border border-amber-700/30 bg-amber-700/15 text-amber-700 dark:text-amber-500"
                        : "border border-border/40 bg-surface-3 text-muted-foreground"
                    )}
                  >
                    {idx + 1}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-xs font-semibold text-foreground sm:text-footnote">
                        {m.model}
                      </span>
                      {m.is_free && <FreeBadge />}
                    </div>
                    <div className="mt-0.5 font-mono text-2xs text-muted-foreground">
                      {t("usage.models.rowSubline", {
                        calls: fmt.number(m.calls),
                        tokens: fmt.number(m.total_tokens),
                      })}
                    </div>
                  </div>

                  <CostValue
                    cny={m.cost_cny}
                    usd={m.cost_usd}
                    isFree={m.is_free}
                    className="shrink-0"
                  />
                </div>

                {/* Apple Screen-time 风格细进度条 */}
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-4/60">
                  <div
                    className="h-full rounded-full bg-primary/70 transition-[width] duration-300"
                    style={{ width: `${Math.max(percent, 2)}%` }}
                  />
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

/* ─────────────────────────── 趋势网格 ─────────────────────────── */

export function TrendGrid({
  items,
  title,
  description,
  unitLabel,
}: {
  items: { date: string; tokens: number; calls: number; cost_cny: number }[];
  title: string;
  description: string;
  unitLabel: string;
}) {
  const { t, fmt } = useI18n();
  if (items.length === 0) return null;
  return (
    <Panel className="space-y-4 p-5">
      <SectionHeader
        icon={Clock}
        tone={TONE.blue}
        className="border-0 p-0"
        title={title}
        description={description}
      />
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {items.map((d) => (
          <Panel
            key={d.date}
            tone="muted"
            className="space-y-1 p-3 text-center transition-all hover:bg-surface-4/40"
          >
            {/* date 是后端已经按区间切好的桶标签（HH:00 / YYYY-MM / YYYY-MM-DD），
                不是 ISO 时间戳 —— 交给 fmt.longDate 会解析失败变成空串，原样输出。 */}
            <div className="font-mono text-2xs font-medium text-muted-foreground">
              {d.date}
            </div>
            <div className="text-sm font-semibold tabular-nums text-foreground sm:text-base">
              {fmt.number(d.tokens)}
            </div>
            <div className="font-mono text-2xs text-muted-foreground/80">
              {t("usage.trend.cellFooter", {
                calls: fmt.number(d.calls),
                unit: unitLabel,
                cost: d.cost_cny.toFixed(2),
              })}
            </div>
          </Panel>
        ))}
      </div>
    </Panel>
  );
}

/* ─────────────────────────── 个人模型明细表 ─────────────────────────── */

export function MyModelsTable({ items }: { items: MyUsageStats["model_breakdown"] }) {
  const { t, fmt } = useI18n();
  const columns: MessageKey[] = [
    "usage.models.colModel",
    "usage.models.colCalls",
    "usage.models.colPrompt",
    "usage.models.colCompletion",
    "usage.models.colTotal",
    "usage.models.colCost",
  ];
  return (
    <Panel className="overflow-hidden">
      <SectionHeader
        icon={Cpu}
        title={t("usage.models.myTableTitle")}
        description={t("usage.models.myTableDesc")}
      />

      {items.length === 0 ? (
        <EmptyState className="py-8" title={t("usage.models.empty")} />
      ) : (
        <div className="overflow-x-auto">
          <Table className="text-xs">
            <TableHeader className="bg-surface-3/30">
              <TableRow className="border-b border-border/40">
                {/* 最后一列表头右对齐。此前写的是 `i === items.length` ——
                    拿**表头下标**去比**数据行数**，行数恰好等于 6 时才会碰巧生效。 */}
                {columns.map((key, i, all) => (
                  <TableHead
                    key={key}
                    scope="col"
                    className={cn(
                      "whitespace-nowrap px-4 py-3 text-2xs font-medium text-muted-foreground",
                      i === all.length - 1 && "text-right"
                    )}
                  >
                    {t(key)}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((m) => (
                <TableRow
                  key={m.model}
                  className="border-b border-border/30 transition-colors last:border-0 hover:bg-surface-3/40"
                >
                  <TableCell className="whitespace-nowrap px-4 py-3.5 font-semibold text-foreground">
                    <span className="flex items-center gap-2">
                      <span>{m.model}</span>
                      {m.is_free && <FreeBadge />}
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap px-4 py-3.5 font-mono tabular-nums text-muted-foreground">
                    {t("usage.models.callsSuffix", { count: fmt.number(m.calls) })}
                  </TableCell>
                  <TableCell className="whitespace-nowrap px-4 py-3.5 font-mono tabular-nums text-muted-foreground">
                    {fmt.number(m.prompt_tokens)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap px-4 py-3.5 font-mono tabular-nums text-muted-foreground">
                    {fmt.number(m.completion_tokens)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap px-4 py-3.5 font-mono font-semibold tabular-nums text-foreground">
                    {fmt.number(m.total_tokens)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap px-4 py-3.5 text-right">
                    <CostValue cny={m.cost_cny} usd={m.cost_usd} isFree={m.is_free} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Panel>
  );
}

/* ─────────────────────── 管理员用户明细（表格 / 卡片）─────────────────────── */

export interface UserActions {
  onToggleAllModels: (userId: string, current: boolean, username: string) => void;
  onToggleActive: (userId: string, current: boolean, username: string) => void;
  onToggleAdmin: (userId: string, current: boolean, username: string) => void;
  onOpenAudit: (userId: string, username: string) => void;
  isModelPending: (userId: string) => boolean;
  isRowPending: (userId: string) => boolean;
}

function ModelAccessCell({ user, actions }: { user: AdminUserUsageItem; actions: UserActions }) {
  const { t } = useI18n();
  if (user.is_superuser) {
    return (
      <span className="whitespace-nowrap rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-2xs font-medium text-emerald-600 shadow-none dark:text-emerald-400">
        {t("usage.admin.fullAccessBadge")}
      </span>
    );
  }
  const on = !!user.can_access_all_models;
  return (
    <div className="flex items-center gap-2">
      {/* 用 <label> 而非可点击的 <span>：span 不可聚焦、不是语义控件，
          键盘用户根本够不到这个开关。 */}
      <Label
        htmlFor={`model-access-${user.user_id}`}
        className="flex cursor-pointer items-center gap-2"
      >
        <Switch
          id={`model-access-${user.user_id}`}
          checked={on}
          disabled={actions.isModelPending(user.user_id)}
          onCheckedChange={() => actions.onToggleAllModels(user.user_id, on, user.username)}
        />
        <span
          className={cn(
            "whitespace-nowrap text-2xs font-medium select-none",
            on
              ? "font-semibold text-emerald-600 dark:text-emerald-400"
              : "text-amber-600 dark:text-amber-400"
          )}
        >
          {on ? t("usage.admin.fullAccess") : t("usage.admin.trialMode")}
        </span>
      </Label>
    </div>
  );
}

function UserRowMenu({ user, isMe, actions }: { user: AdminUserUsageItem; isMe: boolean; actions: UserActions }) {
  const { t } = useI18n();
  if (isMe) {
    return <span className="ml-1 whitespace-nowrap text-2xs italic text-muted-foreground">{t("usage.admin.currentAccount")}</span>;
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={actions.isRowPending(user.user_id)}
          className="inline-flex h-9 w-9 cursor-pointer rounded-full align-middle text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground sm:h-7 sm:w-7"
        >
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">{t("usage.admin.actionMenu")}</span>
        </Button>
      </DropdownMenuTrigger>
      {/* w-44 固定宽在多语言下会截断：英文 "Switch to trial mode" 约 130px，
          容器扣掉内边距和图标后标签只剩 116px，必然折行。四个问题的根因见
          components/common/surfaces.ts。 */}
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        collisionPadding={12}
        className={overlaySurfaceClass}
      >
        {!user.is_superuser && (
          <>
            <DropdownMenuItem
              onClick={() => actions.onToggleAllModels(user.user_id, !!user.can_access_all_models, user.username)}
              className={menuItemClass}
            >
              <Sparkles className="h-4 w-4 text-indigo-500" />
              <span>{user.can_access_all_models ? t("usage.admin.switchToTrial") : t("usage.admin.grantFull")}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className={menuSeparatorClass} />
          </>
        )}
        <DropdownMenuItem
          onClick={() => actions.onToggleActive(user.user_id, user.is_active, user.username)}
          className={cn(
            menuItemClass,
            user.is_active
              ? "text-destructive hover:bg-destructive/10 focus:bg-destructive/10 data-[highlighted]:bg-destructive/10 dark:text-destructive"
              : "text-emerald-600 hover:bg-emerald-500/10 focus:bg-emerald-500/10 data-[highlighted]:bg-emerald-500/10 dark:text-emerald-400"
          )}
        >
          {user.is_active ? (
            <UserX className="h-4 w-4" />
          ) : (
            <UserCheck className="h-4 w-4" />
          )}
          <span>{user.is_active ? t("usage.admin.disable") : t("usage.admin.enable")}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator className={menuSeparatorClass} />
        <DropdownMenuItem
          onClick={() => actions.onToggleAdmin(user.user_id, user.is_superuser, user.username)}
          className={menuItemClass}
        >
          <Shield className="h-4 w-4 text-muted-foreground" />
          <span>{user.is_superuser ? t("usage.admin.revokeAdmin") : t("usage.admin.grantAdmin")}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function IdentityCell({ user, isMe }: { user: AdminUserUsageItem; isMe: boolean }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-2.5">
      <UserAvatar username={user.username} className="h-7 w-7 text-xs" />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-semibold text-foreground">{user.username}</span>
          {isMe && (
            <span className="rounded-full bg-surface-3 px-1.5 py-0 text-2xs font-medium">
              {t("usage.users.meBadge")}
            </span>
          )}
          {user.is_superuser && <AdminBadge size="sm" />}
        </div>
        <span
          title={user.email}
          className="mt-0.5 block max-w-[200px] truncate font-mono text-2xs text-muted-foreground"
        >
          {user.email}
        </span>
      </div>
    </div>
  );
}

function UserCard({ user, isMe, actions }: { user: AdminUserUsageItem; isMe: boolean; actions: UserActions }) {
  const { t, fmt } = useI18n();
  return (
    <Panel tone="muted" className="space-y-3 p-4">
      <IdentityCell user={user} isMe={isMe} />

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 font-mono text-2xs text-muted-foreground">
        <div className="flex justify-between">
          <dt>{t("usage.userCard.messages")}</dt>
          <dd className="font-semibold tabular-nums text-foreground">
            {fmt.number(user.messages_count)}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt>{t("usage.userCard.conversations")}</dt>
          <dd className="tabular-nums text-foreground">{fmt.number(user.conversations_count)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>{t("usage.userCard.tokens")}</dt>
          <dd className="tabular-nums text-foreground">{fmt.number(user.total_tokens)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>{t("usage.userCard.topModel")}</dt>
          <dd className="max-w-[100px] truncate text-foreground">
            {user.top_model || t("usage.userCard.noTopModel")}
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-3">
        <StatusPill tone={user.is_active ? "success" : "danger"}>
          {user.is_active ? t("usage.users.statusActive") : t("usage.users.statusInactive")}
        </StatusPill>
        <ModelAccessCell user={user} actions={actions} />
      </div>

      <div className="flex items-center justify-between gap-2">
        <ActionTooltip label={t("usage.userCard.auditTip")} side="left">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => actions.onOpenAudit(user.user_id, user.username)}
            className="h-7 cursor-pointer gap-1 rounded-full border-primary/20 bg-primary/5 px-2.5 text-2xs font-medium text-primary transition-colors hover:bg-primary/10 active:scale-95"
          >
            <Eye className="h-4 w-4" />
            <span>{t("usage.userCard.audit")}</span>
          </Button>
        </ActionTooltip>
        <UserRowMenu user={user} isMe={isMe} actions={actions} />
      </div>
    </Panel>
  );
}

export function UsersTable({
  users,
  currentUserId,
  periodName,
  actions,
}: {
  users: AdminUserUsageItem[];
  currentUserId: string;
  periodName: string;
  actions: UserActions;
}) {
  const { t, fmt } = useI18n();
  const columns: MessageKey[] = [
    "usage.users.colUser",
    "usage.users.colMessages",
    "usage.users.colTokens",
    "usage.users.colSplit",
    "usage.users.colCost",
    "usage.users.colTopModel",
    "usage.users.colStatus",
    "usage.users.colModelAccess",
  ];
  return (
    <Panel className="overflow-hidden">
      <SectionHeader
        icon={Activity}
        tone={TONE.indigo}
        title={t("usage.users.tableTitle", { period: periodName })}
        description={t("usage.users.tableDesc")}
        action={
          <span className="shrink-0 self-start rounded-full border border-border/40 bg-surface-3/60 px-2.5 py-0.5 font-mono text-xs text-muted-foreground sm:self-auto">
            {t("usage.users.countBadge", { count: fmt.number(users.length) })}
          </span>
        }
      />

      {users.length === 0 ? (
        <EmptyState className="py-10" title={t("usage.users.empty")} />
      ) : (
        <>
          {/* 桌面端：完整表格 */}
          <div className="hidden overflow-x-auto md:block">
            <Table className="text-xs">
              <TableHeader className="bg-surface-3/30">
                <TableRow className="border-b border-border/40">
                  {columns.map((key) => (
                    <TableHead
                      key={key}
                      scope="col"
                      className="whitespace-nowrap px-4 py-3 text-2xs font-medium text-muted-foreground"
                    >
                      {t(key)}
                    </TableHead>
                  ))}
                  <TableHead
                    scope="col"
                    className="whitespace-nowrap px-4 py-3 text-right text-2xs font-medium text-muted-foreground"
                  >
                    {t("usage.users.colActions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => {
                  const isMe = u.user_id === currentUserId;
                  return (
                    <TableRow
                      key={u.user_id}
                      className="border-b border-border/30 transition-colors last:border-0 hover:bg-surface-3/40"
                    >
                      <TableCell className="whitespace-nowrap px-4 py-3.5">
                        <IdentityCell user={u} isMe={isMe} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-4 py-3.5 font-mono tabular-nums">
                        <span className="font-semibold text-foreground">
                          {fmt.number(u.messages_count)}
                        </span>
                        <span className="text-2xs text-muted-foreground">
                          {t("usage.users.roundsSuffix", { count: fmt.number(u.conversations_count) })}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-4 py-3.5 font-mono font-semibold tabular-nums">
                        {fmt.number(u.total_tokens)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-4 py-3.5 font-mono text-2xs tabular-nums text-muted-foreground">
                        <div>{t("usage.users.promptLine", { count: fmt.number(u.prompt_tokens) })}</div>
                        <div>
                          {t("usage.users.completionLine", { count: fmt.number(u.completion_tokens) })}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-4 py-3.5 font-mono tabular-nums">
                        <CostValue
                          cny={u.estimated_cost_cny}
                          usd={u.estimated_cost_usd}
                          className="text-left"
                        />
                      </TableCell>
                      <TableCell className="max-w-[180px] truncate px-4 py-3.5 font-mono text-2xs text-muted-foreground">
                        <span title={u.top_model} className="rounded-md border border-border/30 bg-surface-3/50 px-2 py-0.5">
                          {u.top_model || t("usage.users.noTopModel")}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-4 py-3.5">
                        <StatusPill tone={u.is_active ? "success" : "danger"}>
                          {u.is_active ? t("usage.users.statusActive") : t("usage.users.statusInactive")}
                        </StatusPill>
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-4 py-3.5">
                        <ModelAccessCell user={u} actions={actions} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-4 py-3.5 text-right">
                        <ActionTooltip label={t("usage.userCard.auditTip")} side="left">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => actions.onOpenAudit(u.user_id, u.username)}
                            className="h-7 cursor-pointer gap-1 rounded-full border-primary/20 bg-primary/5 px-2.5 text-2xs font-medium text-primary transition-colors hover:bg-primary/10 active:scale-95"
                          >
                            <Eye className="h-4 w-4" />
                            <span>{t("usage.userCard.audit")}</span>
                          </Button>
                        </ActionTooltip>
                        <UserRowMenu user={u} isMe={isMe} actions={actions} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* 移动端：卡片列表。9 列表格塞进手机只能横向滚动，功能上等于不可用。 */}
          <div className="space-y-2.5 p-3 md:hidden">
            {users.map((u) => (
              <UserCard
                key={u.user_id}
                user={u}
                isMe={u.user_id === currentUserId}
                actions={actions}
              />
            ))}
          </div>
        </>
      )}
    </Panel>
  );
}

/* ─────────────────────────── 审计 / 查阅弹窗 ─────────────────────────── */

type AuditConv = {
  id: string;
  title?: string;
  model?: string;
  is_deleted?: boolean;
  deleted_at?: string;
  message_count?: number;
  total_tokens?: number;
  created_at?: string;
  updated_at?: string;
};

export function AuditDialog({
  open,
  username,
  conversations,
  loading,
  filter,
  onFilterChange,
  onRefresh,
  onClose,
  onInspect,
  onRestore,
  restoringId,
}: {
  open: boolean;
  username: string;
  conversations: AuditConv[];
  loading: boolean;
  filter: "all" | "active" | "deleted";
  onFilterChange: (f: "all" | "active" | "deleted") => void;
  onRefresh: () => void;
  onClose: () => void;
  onInspect: (conversationId: string) => void;
  onRestore: (conversationId: string, title: string) => void;
  restoringId: string | null;
}) {
  const { t, fmt } = useI18n();
  const visible = conversations.filter((c) => {
    if (filter === "active") return !c.is_deleted;
    if (filter === "deleted") return c.is_deleted;
    return true;
  });

  const filterOptions: SegmentedOption<"all" | "active" | "deleted">[] = [
    { value: "all", label: t("usage.audit.filterAll", { count: fmt.number(conversations.length) }) },
    {
      value: "active",
      label: t("usage.audit.filterActive", {
        count: fmt.number(conversations.filter((c) => !c.is_deleted).length),
      }),
    },
    {
      value: "deleted",
      label: t("usage.audit.filterDeleted", {
        count: fmt.number(conversations.filter((c) => c.is_deleted).length),
      }),
    },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[85vh] max-w-4xl flex-col gap-0 overflow-hidden rounded-[22px] border border-border/50 bg-card/95 p-0 shadow-2xl backdrop-blur-2xl">
        <DialogHeader className="flex-row items-center justify-between space-y-0 border-b border-border/40 bg-surface-3/30 px-6 py-4 text-left">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Eye className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="flex items-center gap-2 text-base font-semibold">
                <span>{t("usage.audit.title")}</span>
                <span className="rounded-full bg-surface-3 px-2 py-0.5 font-mono text-xs">
                  {username}
                </span>
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-xs text-muted-foreground">
                {t("usage.audit.desc")}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 bg-card/50 px-6 py-2.5 text-xs">
          <SegmentedControl
            size="sm"
            ariaLabel={t("usage.audit.filterAria")}
            value={filter}
            onValueChange={onFilterChange}
            options={filterOptions}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
            className="h-7 cursor-pointer gap-1 rounded-full px-2.5 text-2xs text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin text-primary")} />
            <span>{t("usage.audit.refresh")}</span>
          </Button>
        </div>

        <div className="max-h-[60vh] flex-1 space-y-3 overflow-y-auto p-6 overscroll-contain">
          {loading ? (
            <div className="space-y-2 py-16 text-center">
              <RefreshCw className="mx-auto h-6 w-6 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">{t("usage.audit.loading")}</p>
            </div>
          ) : conversations.length === 0 ? (
            <div className="py-16 text-center text-xs text-muted-foreground">
              {t("usage.audit.empty")}
            </div>
          ) : (
            visible.map((conv) => (
              <Panel
                key={conv.id}
                tone={conv.is_deleted ? "danger" : "muted"}
                className="flex flex-col gap-3 p-4 transition-colors sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="truncate text-xs font-semibold text-foreground sm:text-sm">
                      {conv.title || t("usage.audit.untitled")}
                    </h4>
                    {conv.is_deleted ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-destructive/20 bg-destructive/10 px-2 py-px text-2xs font-medium text-destructive">
                        <Trash2 className="mr-0.5 h-2.5 w-2.5" />
                        {t("usage.audit.deletedBadge", {
                          date: conv.deleted_at || t("usage.audit.recycleBin"),
                        })}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-px text-2xs font-medium text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="mr-0.5 h-2.5 w-2.5" />
                        {t("usage.audit.activeBadge")}
                      </span>
                    )}
                    {conv.model && (
                      <span className="rounded-full bg-surface-3 px-2 py-px font-mono text-2xs">
                        {conv.model}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-4 font-mono text-2xs text-muted-foreground">
                    <span>{t("usage.audit.messagesMeta", { count: fmt.number(conv.message_count ?? 0) })}</span>
                    <span>{t("usage.audit.tokensMeta", { count: fmt.number(conv.total_tokens ?? 0) })}</span>
                    <span>
                      {t("usage.audit.updatedMeta", {
                        date: conv.updated_at || conv.created_at || "",
                      })}
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onInspect(conv.id)}
                    className="h-7 cursor-pointer gap-1.5 rounded-full border-border/50 bg-background/80 px-3 text-xs shadow-2xs transition-colors hover:bg-surface-3 active:scale-95"
                  >
                    <FileText className="h-4 w-4" />
                    <span>{t("usage.audit.inspect")}</span>
                  </Button>
                  {conv.is_deleted && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={restoringId === conv.id}
                      onClick={() => onRestore(conv.id, conv.title || "")}
                      className="h-7 cursor-pointer gap-1.5 rounded-full border-emerald-500/30 bg-emerald-500/10 px-3 text-xs text-emerald-600 transition-colors hover:bg-emerald-500/20 active:scale-95 dark:text-emerald-400"
                    >
                      <RotateCcw className={cn("h-4 w-4", restoringId === conv.id && "animate-spin")} />
                      <span>{t("usage.audit.restore")}</span>
                    </Button>
                  )}
                </div>
              </Panel>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function InspectMessagesDialog({
  data,
  onClose,
}: {
  data: {
    conversation: { title?: string; model?: string; is_deleted?: boolean };
    messages: { id?: string; role: string; content: string; created_at?: string; token_usage?: number }[];
  } | null;
  onClose: () => void;
}) {
  const { t, fmt } = useI18n();
  return (
    <Dialog open={!!data} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col gap-0 overflow-hidden rounded-[22px] border border-border/50 bg-card/95 p-0 shadow-2xl backdrop-blur-2xl">
        {data && (
          <>
            <DialogHeader className="flex-row items-center justify-between space-y-0 border-b border-border/40 bg-surface-3/30 px-6 py-4 text-left">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <div>
                  <DialogTitle className="max-w-md truncate text-sm font-semibold">
                    {data.conversation.title || t("usage.audit.untitled")}
                  </DialogTitle>
                  <DialogDescription className="mt-0.5 text-2xs text-muted-foreground">
                    <span>{t("usage.audit.inspectModel", { model: data.conversation.model ?? "" })}</span>
                    <span> · </span>
                    <span>{t("usage.audit.inspectCount", { count: fmt.number(data.messages.length) })}</span>
                    {data.conversation.is_deleted && (
                      <span className="font-semibold text-destructive">
                        {" "}
                        {t("usage.audit.inspectDeleted")}
                      </span>
                    )}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="max-h-[60vh] flex-1 space-y-4 overflow-y-auto bg-background/50 p-6 overscroll-contain">
              {data.messages.length === 0 ? (
                <div className="py-16 text-center text-xs text-muted-foreground">
                  {t("usage.audit.inspectEmpty")}
                </div>
              ) : (
                data.messages.map((msg, idx) => (
                  <div
                    key={msg.id || idx}
                    className={cn(
                      "flex flex-col space-y-1.5",
                      msg.role === "user" ? "items-end" : "items-start"
                    )}
                  >
                    <div className="flex items-center gap-2 px-1 font-mono text-2xs text-muted-foreground">
                      <span className="font-semibold uppercase tracking-wider">{msg.role}</span>
                      <span>{msg.created_at}</span>
                      {!!msg.token_usage && msg.token_usage > 0 && (
                        <span>
                          {t("usage.audit.inspectTokens", { count: fmt.number(msg.token_usage) })}
                        </span>
                      )}
                    </div>
                    <div
                      className={cn(
                        "max-w-[85%] whitespace-pre-wrap p-3.5 text-xs leading-relaxed shadow-2xs",
                        msg.role === "user"
                          ? "rounded-2xl rounded-tr-xs bg-primary text-primary-foreground"
                          : "rounded-2xl rounded-tl-xs border border-border/40 bg-card/90 text-foreground dark:bg-surface-3/60"
                      )}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
