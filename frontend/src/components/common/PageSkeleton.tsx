"use client";

import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Panel } from "@/components/common/Panel";
import { cn } from "@/lib/utils";

/**
 * 全应用共享的骨架屏。
 * - FullPageSkeleton：鉴权等待（`loading || !user`）与路由切换 loading.tsx 共用，
 *   按目标页面骨架还原大致布局，避免白屏 / 内容跳变。
 * - ConversationListSkeleton / MessageListSkeleton / StatCardsSkeleton /
 *   SettingsFormSkeleton / MemoryListSkeleton：各页面数据拉取中的局部骨架。
 *
 * 所有宽度都引用 globals.css 的 --sidebar-w / --sidebar-w-lg，与真实侧栏
 * 共用同一组变量。此前骨架屏把 `w-64 lg:w-72` 写死、真实侧栏写
 * `md:w-64 lg:w-72`，两处独立维护。
 */

// ---------- 顶部导航栏骨架 ----------
function NavbarSkeleton() {
  return (
    <div className="hidden h-[var(--header-h-desktop)] shrink-0 items-center justify-between border-b bg-background px-3 sm:px-4 md:flex">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-4 w-24" />
        <div className="ml-4 hidden items-center gap-1.5 md:flex">
          <Skeleton className="h-8 w-16 rounded-md" />
          <Skeleton className="h-8 w-16 rounded-md" />
          <Skeleton className="h-8 w-16 rounded-md" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-8 rounded-md" />
        <Skeleton className="h-7 w-20 rounded-full" />
      </div>
    </div>
  );
}

// ---------- 左侧历史会话行骨架 ----------
export function ConversationListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-1" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-1 rounded-xl border border-transparent px-2 py-2"
        >
          <div className="flex min-w-0 flex-1 flex-col gap-1.5 overflow-hidden">
            <Skeleton className="h-3.5 rounded" style={{ width: `${58 + ((i * 37) % 32)}%` }} />
            <Skeleton className="h-2.5 w-28 rounded" />
          </div>
          <div className="ml-1 flex shrink-0 items-center gap-0.5">
            <Skeleton className="h-7 w-7 rounded-md" />
            <Skeleton className="h-7 w-7 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- 对话消息气泡骨架 ----------
export function MessageListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-4" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) =>
        i % 2 === 0 ? (
          <div key={i} className="flex justify-end">
            <div className="w-2/3 max-w-[78%] space-y-1.5">
              <Skeleton className="h-4 w-full rounded-2xl" />
              <Skeleton className="ml-auto h-4 w-3/5 rounded-2xl" />
            </div>
          </div>
        ) : (
          <div key={i} className="flex justify-start">
            <div className="w-full max-w-3xl space-y-2 rounded-2xl border p-3.5">
              <Skeleton className="h-4 w-1/4 rounded" />
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="h-4 w-2/3 rounded" />
            </div>
          </div>
        )
      )}
    </div>
  );
}

// ---------- 用量页 KPI + 表格骨架 ----------
export function StatCardsSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Panel key={i} className="space-y-2 p-5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-3 w-full" />
          </Panel>
        ))}
      </div>
      <Panel className="overflow-hidden">
        <div className="space-y-2 border-b p-5">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-72 max-w-full" />
        </div>
        <div className="divide-y">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3.5">
              <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-2/5" />
                <Skeleton className="h-3 w-3/5" />
              </div>
              <Skeleton className="h-6 w-16 shrink-0 rounded-md" />
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

// ---------- 设置页表单骨架 ----------
export function SettingsFormSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <Panel key={i}>
          <div className="border-b p-5">
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="space-y-4 p-5">
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-9 w-full rounded-md" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Skeleton className="h-16 rounded-lg" />
              <Skeleton className="h-16 rounded-lg" />
              <Skeleton className="h-16 rounded-lg" />
            </div>
            <Skeleton className="h-3 w-2/3" />
          </div>
        </Panel>
      ))}
    </div>
  );
}

// ---------- 记忆库列表骨架 ----------
//
// space-y-3（此前是 space-y-2.5）：与 MemoryView 真实列表的间距对齐。
// 加载更多时本组件会拼在已渲染列表的尾部，间距不一致会出现一道可见的缝。
export function MemoryListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        // 与 <MemoryCard> 的新结构对齐：图标方块 + 正文同行，时间行在下方。
        // 此前骨架还留着「标签行 + 正文两行」的旧形状，卡片改了它没改，
        // 加载时会出现明显的形状跳变。
        <Panel key={i} className="space-y-2 p-4">
          <div className="flex items-start gap-3">
            <Skeleton className="h-8 w-8 shrink-0 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-full rounded-md" />
              <Skeleton className="h-4 w-2/3 rounded-md" />
            </div>
          </div>
          <Skeleton className="ml-11 h-3 w-32 rounded-md" />
        </Panel>
      ))}
    </div>
  );
}

// ---------- 整页骨架（鉴权等待 + 路由切换） ----------
export function FullPageSkeleton({
  variant = "list",
  className,
}: {
  variant?: "chat" | "list";
  className?: string;
}) {
  if (variant === "chat") {
    return (
      <div
        className={cn("flex h-dvh flex-col overflow-hidden bg-background", className)}
        aria-hidden="true"
      >
        <NavbarSkeleton />
        <div className="flex flex-1 overflow-hidden">
          {/* 侧栏骨架（桌面端） */}
          <div className="hidden w-[var(--sidebar-w)] shrink-0 flex-col border-r md:flex lg:w-[var(--sidebar-w-lg)]">
            <div className="space-y-2 border-b p-3">
              <Skeleton className="h-9 w-full rounded-md" />
              <Skeleton className="h-8 w-full rounded-md" />
            </div>
            <div className="flex-1 p-2">
              <ConversationListSkeleton rows={7} />
            </div>
          </div>
          {/* 对话区骨架 */}
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex h-[var(--toolbar-h)] shrink-0 items-center justify-between border-b px-4 py-2.5">
              <Skeleton className="h-8 w-40 rounded-md" />
              <div className="flex items-center gap-1.5">
                <Skeleton className="h-8 w-8 rounded-md" />
                <Skeleton className="h-8 w-8 rounded-md" />
              </div>
            </div>
            <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-5 sm:px-6 md:px-8">
              <MessageListSkeleton rows={4} />
            </div>
            <div className="border-t p-3 sm:p-4">
              <Skeleton className="mx-auto h-12 w-full max-w-3xl rounded-2xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn("flex h-dvh flex-col overflow-hidden bg-background", className)}
      aria-hidden="true"
    >
      <NavbarSkeleton />
      <div className="flex-1 overflow-hidden">
        <main className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6 md:p-8">
          <div className="space-y-2 border-b pb-6">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-3 w-80 max-w-full" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 flex-1 rounded-md" />
            <Skeleton className="h-10 w-20 rounded-md" />
          </div>
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Panel key={i} className="space-y-2 p-4 sm:p-5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </Panel>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
