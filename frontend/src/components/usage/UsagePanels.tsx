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
import { SegmentedControl } from "@/components/common/SegmentedControl";
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
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <StatCard
        label="注册总用户"
        icon={Users}
        tone={TONE.indigo}
        value={stats.total_users}
        unit="位"
        footer={<LiveDotStat>{`活跃账号: ${stats.active_users} 位`}</LiveDotStat>}
      />
      <StatCard
        label="对话轮次"
        icon={MessageSquare}
        tone={TONE.blue}
        value={stats.total_messages.toLocaleString()}
        unit="次"
        footer={`共涉及 ${stats.total_conversations} 个对话会话`}
      />
      <StatCard
        label="Token 消耗"
        icon={Coins}
        tone={TONE.amber}
        value={stats.total_tokens.toLocaleString()}
        truncateValue
        footer={`入: ${stats.total_prompt_tokens.toLocaleString()} · 出: ${stats.total_completion_tokens.toLocaleString()}`}
      />
      <StatCard
        label="预估费用支出"
        icon={DollarSign}
        tone={TONE.emerald}
        value={`¥${stats.total_cost_cny.toFixed(2)}`}
        truncateValue
        footer={`约 $${stats.total_cost_usd.toFixed(4)} USD (汇率 7.25)`}
      />
    </div>
  );
}

/* ─────────────────────────── 个人用量 KPI ─────────────────────────── */

export function MyUsageCards({ stats }: { stats: MyUsageStats }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <StatCard
        label="对话轮次"
        icon={MessageSquare}
        tone={TONE.blue}
        value={stats.total_messages.toLocaleString()}
        unit="次"
        footer={`涉及 ${stats.total_conversations} 个对话会话`}
      />
      <StatCard
        label="Token 消耗"
        icon={Coins}
        tone={TONE.amber}
        value={stats.total_tokens.toLocaleString()}
        truncateValue
        footer={`入: ${stats.prompt_tokens.toLocaleString()} · 出: ${stats.completion_tokens.toLocaleString()}`}
      />
      <StatCard
        label="折算花费 (CNY)"
        icon={DollarSign}
        tone={TONE.emerald}
        value={`¥${stats.estimated_cost_cny.toFixed(2)}`}
        truncateValue
        footer="按官方厂商定价规则折算"
      />
      <StatCard
        label="折算花费 (USD)"
        icon={TrendingUp}
        tone="bg-blue-500/10 text-blue-600 dark:text-blue-400"
        value={`$${stats.estimated_cost_usd.toFixed(4)}`}
        truncateValue
        footer="美元计价成本估算"
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
  const sorted = [...items].sort((a, b) =>
    sortKey === "cost"
      ? b.cost_cny - a.cost_cny || b.total_tokens - a.total_tokens
      : b.total_tokens - a.total_tokens || b.cost_cny - a.cost_cny
  );
  const maxVal = Math.max(
    ...sorted.map((m) => (sortKey === "cost" ? m.cost_cny : m.total_tokens)),
    1
  );

  return (
    <Panel className="space-y-4 p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <SectionHeader
          icon={Cpu}
          tone={TONE.indigo}
          className="flex-1 border-0 p-0"
          title={`各模型调用分布与花费 (${periodName})`}
          description="不同模型的调用量占比与折算费用排行"
        />
        {/* 排序是一个 radio group（选一个），此前误用了 Tabs：
            读屏会播报成「选项卡」，方向键会把焦点移到没有关联面板的选项上。 */}
        <SegmentedControl
          size="sm"
          ariaLabel="模型分布排序方式"
          value={sortKey}
          onValueChange={onSortKeyChange}
          options={[
            { value: "cost", label: "按花费" },
            { value: "tokens", label: "按 Token" },
          ]}
          listClassName="self-start sm:self-auto"
        />
      </div>

      {sorted.length === 0 ? (
        <EmptyState className="py-8" title="该时间区间内暂无模型调用数据。" />
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
                      <span className="truncate text-xs font-semibold text-foreground">
                        {m.model}
                      </span>
                      {m.is_free && <FreeBadge />}
                    </div>
                    <div className="mt-0.5 font-mono text-2xs text-muted-foreground">
                      调用 {m.calls} 次 · Token {m.total_tokens.toLocaleString()}
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
            className="space-y-1 p-3 text-center transition-all hover:bg-surface-3/40"
          >
            <div className="font-mono text-2xs font-medium text-muted-foreground">
              {d.date}
            </div>
            <div className="text-sm font-semibold tabular-nums text-foreground sm:text-base">
              {d.tokens.toLocaleString()}
            </div>
            <div className="font-mono text-2xs text-muted-foreground/80">
              {d.calls} {unitLabel} · ¥{d.cost_cny.toFixed(2)}
            </div>
          </Panel>
        ))}
      </div>
    </Panel>
  );
}

/* ─────────────────────────── 个人模型明细表 ─────────────────────────── */

export function MyModelsTable({ items }: { items: MyUsageStats["model_breakdown"] }) {
  return (
    <Panel className="overflow-hidden">
      <SectionHeader
        icon={Cpu}
        title="我使用的模型与费用明细"
        description="你所调用过的模型及输入/输出详细 Token 账单"
      />

      {items.length === 0 ? (
        <EmptyState className="py-8" title="该时间区间内暂无模型调用数据。" />
      ) : (
        <div className="overflow-x-auto">
          <Table className="text-xs">
            <TableHeader className="bg-surface-3/30">
              <TableRow className="border-b border-border/40">
                {/* 最后一列表头右对齐。此前写的是 `i === items.length` ——
                    拿**表头下标**去比**数据行数**，行数恰好等于 6 时才会碰巧生效。 */}
                {[
                  "调用模型",
                  "调用次数",
                  "输入 Token (Prompt)",
                  "输出 Token (Completion)",
                  "总 Token 消耗",
                  "折算花费 (CNY / USD)",
                ].map((h, i, all) => (
                  <TableHead
                    key={h}
                    scope="col"
                    className={cn(
                      "whitespace-nowrap px-4 py-3 text-2xs font-medium text-muted-foreground",
                      i === all.length - 1 && "text-right"
                    )}
                  >
                    {h}
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
                    {m.calls} 次
                  </TableCell>
                  <TableCell className="whitespace-nowrap px-4 py-3.5 font-mono tabular-nums text-muted-foreground">
                    {m.prompt_tokens.toLocaleString()}
                  </TableCell>
                  <TableCell className="whitespace-nowrap px-4 py-3.5 font-mono tabular-nums text-muted-foreground">
                    {m.completion_tokens.toLocaleString()}
                  </TableCell>
                  <TableCell className="whitespace-nowrap px-4 py-3.5 font-mono font-semibold tabular-nums text-foreground">
                    {m.total_tokens.toLocaleString()}
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
  if (user.is_superuser) {
    return (
      <span className="whitespace-nowrap rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-2xs font-medium text-emerald-600 shadow-none dark:text-emerald-400">
        完整体验 (管理员)
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
          {on ? "完整体验" : "体验模式"}
        </span>
      </Label>
    </div>
  );
}

function UserRowMenu({ user, isMe, actions }: { user: AdminUserUsageItem; isMe: boolean; actions: UserActions }) {
  if (isMe) {
    return <span className="ml-1 whitespace-nowrap text-2xs italic text-muted-foreground">当前账号</span>;
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={actions.isRowPending(user.user_id)}
          className="inline-flex h-7 w-7 cursor-pointer rounded-full align-middle text-muted-foreground hover:bg-surface-3 hover:text-foreground"
        >
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">操作菜单</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44 rounded-xl border border-border/50 p-1 shadow-lg">
        {!user.is_superuser && (
          <>
            <DropdownMenuItem
              onClick={() => actions.onToggleAllModels(user.user_id, !!user.can_access_all_models, user.username)}
              className="cursor-pointer rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:bg-surface-3"
            >
              <Sparkles className="mr-2 h-3.5 w-3.5 text-indigo-500" />
              <span>{user.can_access_all_models ? "切换为体验模式" : "开通完整体验"}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-1" />
          </>
        )}
        <DropdownMenuItem
          onClick={() => actions.onToggleActive(user.user_id, user.is_active, user.username)}
          className={cn(
            "cursor-pointer rounded-lg px-2.5 py-1.5 text-xs",
            user.is_active
              ? "text-destructive focus:bg-destructive/10 focus:text-destructive"
              : "text-emerald-600 focus:bg-emerald-500/10 focus:text-emerald-600"
          )}
        >
          {user.is_active ? <UserX className="mr-2 h-3.5 w-3.5" /> : <UserCheck className="mr-2 h-3.5 w-3.5" />}
          <span>{user.is_active ? "停用账号" : "恢复启用"}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="my-1" />
        <DropdownMenuItem
          onClick={() => actions.onToggleAdmin(user.user_id, user.is_superuser, user.username)}
          className="cursor-pointer rounded-lg px-2.5 py-1.5 text-xs"
        >
          <Shield className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
          <span>{user.is_superuser ? "取消管理员" : "设为管理员"}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function IdentityCell({ user, isMe }: { user: AdminUserUsageItem; isMe: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <UserAvatar username={user.username} className="h-7 w-7 text-xs" />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-semibold text-foreground">{user.username}</span>
          {isMe && (
            <span className="rounded-full bg-surface-3 px-1.5 py-0 text-2xs font-medium">
              我
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
  return (
    <Panel tone="muted" className="space-y-3 p-4">
      <IdentityCell user={user} isMe={isMe} />

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 font-mono text-2xs text-muted-foreground">
        <div className="flex justify-between">
          <dt>对话轮次</dt>
          <dd className="font-semibold tabular-nums text-foreground">{user.messages_count}</dd>
        </div>
        <div className="flex justify-between">
          <dt>会话数</dt>
          <dd className="tabular-nums text-foreground">{user.conversations_count}</dd>
        </div>
        <div className="flex justify-between">
          <dt>总 Token</dt>
          <dd className="tabular-nums text-foreground">{user.total_tokens.toLocaleString()}</dd>
        </div>
        <div className="flex justify-between">
          <dt>常用模型</dt>
          <dd className="max-w-[100px] truncate text-foreground">{user.top_model || "未调用"}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-3">
        <StatusPill tone={user.is_active ? "success" : "danger"}>
          {user.is_active ? "正常" : "已停用"}
        </StatusPill>
        <ModelAccessCell user={user} actions={actions} />
      </div>

      <div className="flex items-center justify-between gap-2">
        <ActionTooltip label="审查该用户全部对话记录（含已删除对话）" side="left">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => actions.onOpenAudit(user.user_id, user.username)}
            className="h-7 cursor-pointer gap-1 rounded-full border-primary/20 bg-primary/5 px-2.5 text-2xs font-medium text-primary transition-colors hover:bg-primary/10 active:scale-95"
          >
            <Eye className="h-3 w-3" />
            <span>审查</span>
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
  return (
    <Panel className="overflow-hidden">
      <SectionHeader
        icon={Activity}
        tone={TONE.indigo}
        title={`各用户消耗明细 (${periodName})`}
        description="按当前时间区间总 Token 排序，支持查看审计明细与账号权限管理。"
        action={
          <span className="shrink-0 self-start rounded-full border border-border/40 bg-surface-3/60 px-2.5 py-0.5 font-mono text-xs text-muted-foreground sm:self-auto">
            共 {users.length} 位用户
          </span>
        }
      />

      {users.length === 0 ? (
        <EmptyState className="py-10" title="该时间区间内暂无用户用量数据。" />
      ) : (
        <>
          {/* 桌面端：完整表格 */}
          <div className="hidden overflow-x-auto md:block">
            <Table className="text-xs">
              <TableHeader className="bg-surface-3/30">
                <TableRow className="border-b border-border/40">
                  {[
                    "用户", "对话轮次", "总 Token 消耗", "输入 / 输出明细",
                    "折算花费 (CNY / USD)", "常用模型", "状态", "模型权限开关",
                  ].map((h) => (
                    <TableHead
                      key={h}
                      scope="col"
                      className="whitespace-nowrap px-4 py-3 text-2xs font-medium text-muted-foreground"
                    >
                      {h}
                    </TableHead>
                  ))}
                  <TableHead
                    scope="col"
                    className="whitespace-nowrap px-4 py-3 text-right text-2xs font-medium text-muted-foreground"
                  >
                    操作
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
                        <span className="font-semibold text-foreground">{u.messages_count}</span>
                        <span className="text-2xs text-muted-foreground">
                          {" "}轮 ({u.conversations_count} 会话)
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-4 py-3.5 font-mono font-semibold tabular-nums">
                        {u.total_tokens.toLocaleString()}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-4 py-3.5 font-mono text-2xs tabular-nums text-muted-foreground">
                        <div>↓ 入: {u.prompt_tokens.toLocaleString()}</div>
                        <div>↑ 出: {u.completion_tokens.toLocaleString()}</div>
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
                          {u.top_model || "未调用"}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-4 py-3.5">
                        <StatusPill tone={u.is_active ? "success" : "danger"}>
                          {u.is_active ? "正常" : "已停用"}
                        </StatusPill>
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-4 py-3.5">
                        <ModelAccessCell user={u} actions={actions} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-4 py-3.5 text-right">
                        <ActionTooltip label="审查该用户全部对话记录（含已删除对话）" side="left">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => actions.onOpenAudit(u.user_id, u.username)}
                            className="h-7 cursor-pointer gap-1 rounded-full border-primary/20 bg-primary/5 px-2.5 text-2xs font-medium text-primary transition-colors hover:bg-primary/10 active:scale-95"
                          >
                            <Eye className="h-3 w-3" />
                            <span>审查</span>
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
  const visible = conversations.filter((c) => {
    if (filter === "active") return !c.is_deleted;
    if (filter === "deleted") return c.is_deleted;
    return true;
  });

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
                <span>用户对话审查与审计</span>
                <span className="rounded-full bg-surface-3 px-2 py-0.5 font-mono text-xs">
                  {username}
                </span>
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-xs text-muted-foreground">
                用户删除的对话在底层已安全归档保留，平台可完整审计内容与追踪 Token / 成本消耗。
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 bg-card/50 px-6 py-2.5 text-xs">
          <SegmentedControl
            size="sm"
            ariaLabel="审计状态筛选"
            value={filter}
            onValueChange={onFilterChange}
            options={[
              { value: "all", label: `全部 (${conversations.length})` },
              {
                value: "active",
                label: `正常 (${conversations.filter((c) => !c.is_deleted).length})`,
              },
              {
                value: "deleted",
                label: `已删除 (${conversations.filter((c) => c.is_deleted).length})`,
              },
            ]}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
            className="h-7 cursor-pointer gap-1 rounded-full px-2.5 text-2xs text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground"
          >
            <RefreshCw className={cn("h-3 w-3", loading && "animate-spin text-primary")} />
            <span>刷新</span>
          </Button>
        </div>

        <div className="max-h-[60vh] flex-1 space-y-3 overflow-y-auto p-6 overscroll-contain">
          {loading ? (
            <div className="space-y-2 py-16 text-center">
              <RefreshCw className="mx-auto h-6 w-6 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">正在载入对话记录与审计数据...</p>
            </div>
          ) : conversations.length === 0 ? (
            <div className="py-16 text-center text-xs text-muted-foreground">
              该用户暂无任何对话记录。
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
                      {conv.title || "未命名对话"}
                    </h4>
                    {conv.is_deleted ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-destructive/20 bg-destructive/10 px-2 py-px text-2xs font-medium text-destructive">
                        <Trash2 className="mr-0.5 h-2.5 w-2.5" />
                        已删除 ({conv.deleted_at || "回收站"})
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-px text-2xs font-medium text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="mr-0.5 h-2.5 w-2.5" />
                        正常活跃
                      </span>
                    )}
                    {conv.model && (
                      <span className="rounded-full bg-surface-3 px-2 py-px font-mono text-2xs">
                        {conv.model}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-4 font-mono text-2xs text-muted-foreground">
                    <span>消息: {conv.message_count} 条</span>
                    <span>Token: {(conv.total_tokens ?? 0).toLocaleString()}</span>
                    <span>更新: {conv.updated_at || conv.created_at}</span>
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
                    <FileText className="h-3 w-3" />
                    <span>查阅消息</span>
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
                      <RotateCcw className={cn("h-3 w-3", restoringId === conv.id && "animate-spin")} />
                      <span>恢复对话</span>
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
                    {data.conversation.title || "未命名对话"}
                  </DialogTitle>
                  <DialogDescription className="mt-0.5 text-2xs text-muted-foreground">
                    <span>模型: {data.conversation.model}</span>
                    <span> · </span>
                    <span>共 {data.messages.length} 条消息</span>
                    {data.conversation.is_deleted && (
                      <span className="font-semibold text-destructive"> (用户已删除)</span>
                    )}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="max-h-[60vh] flex-1 space-y-4 overflow-y-auto bg-background/50 p-6 overscroll-contain">
              {data.messages.length === 0 ? (
                <div className="py-16 text-center text-xs text-muted-foreground">
                  对话中暂无任何消息。
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
                        <span>· {msg.token_usage} Tokens</span>
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
