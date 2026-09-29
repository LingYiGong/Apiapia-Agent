"use client";

import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * 全应用共享的骨架屏。
 * - FullPageSkeleton：鉴权等待（`loading || !user`）与路由切换 loading.tsx 共用，
 *   按目标页面骨架还原大致布局，避免白屏 / 内容跳变。
 * - ConversationListSkeleton / MessageListSkeleton / StatCardsSkeleton /
 *   SettingsFormSkeleton：各页面数据拉取中的局部骨架。
 */

// ---------- 顶部导航栏骨架 ----------
function NavbarSkeleton() {
  return (
    <div className="border-b bg-background px-3 sm:px-4 h-14 hidden md:flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-4 w-24" />
        <div className="hidden md:flex items-center gap-1.5 ml-4">
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
          className="flex items-center gap-1 px-2 py-2 rounded-xl border border-transparent"
        >
          <div className="flex min-w-0 flex-1 flex-col gap-1.5 overflow-hidden">
            <Skeleton
              className="h-3.5 rounded"
              style={{ width: `${58 + ((i * 37) % 32)}%` }}
            />
            <Skeleton className="h-2.5 w-28 rounded" />
          </div>
          <div className="flex items-center gap-0.5 ml-1 shrink-0">
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
            <div className="max-w-[78%] w-2/3 space-y-1.5">
              <Skeleton className="h-4 w-full rounded-2xl" />
              <Skeleton className="h-4 w-3/5 rounded-2xl ml-auto" />
            </div>
          </div>
        ) : (
          <div key={i} className="flex justify-start">
            <div className="w-full max-w-3xl rounded-2xl border p-3.5 space-y-2">
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="p-5 rounded-xl border space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-3 w-full" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border overflow-hidden">
        <div className="p-5 border-b space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-72 max-w-full" />
        </div>
        <div className="divide-y">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3.5">
              <Skeleton className="h-8 w-8 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5 min-w-0">
                <Skeleton className="h-3.5 w-2/5" />
                <Skeleton className="h-3 w-3/5" />
              </div>
              <Skeleton className="h-6 w-16 rounded-md shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------- 设置页表单骨架 ----------
export function SettingsFormSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-xl border">
          <div className="p-5 border-b">
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="p-5 space-y-4">
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
        </div>
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
        className={cn("flex flex-col h-dvh overflow-hidden bg-background", className)}
        aria-hidden="true"
      >
        <NavbarSkeleton />
        <div className="flex flex-1 overflow-hidden">
          {/* 侧栏骨架（桌面端） */}
          <div className="hidden md:flex w-64 lg:w-72 flex-col border-r shrink-0">
            <div className="p-3 border-b space-y-2">
              <Skeleton className="h-9 w-full rounded-md" />
              <Skeleton className="h-8 w-full rounded-md" />
            </div>
            <div className="flex-1 p-2">
              <ConversationListSkeleton rows={7} />
            </div>
          </div>
          {/* 对话区骨架 */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="border-b px-4 py-2.5 flex items-center justify-between shrink-0">
              <Skeleton className="h-8 w-40 rounded-md" />
              <div className="flex items-center gap-1.5">
                <Skeleton className="h-8 w-8 rounded-md" />
                <Skeleton className="h-8 w-8 rounded-md" />
              </div>
            </div>
            <div className="flex-1 px-4 sm:px-6 md:px-8 py-5 max-w-4xl w-full mx-auto">
              <MessageListSkeleton rows={4} />
            </div>
            <div className="p-3 sm:p-4 border-t">
              <Skeleton className="h-12 w-full max-w-3xl mx-auto rounded-2xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn("flex flex-col h-dvh overflow-hidden bg-background", className)}
      aria-hidden="true"
    >
      <NavbarSkeleton />
      <div className="flex-1 overflow-hidden">
        <main className="max-w-5xl w-full mx-auto p-4 sm:p-6 md:p-8 space-y-6">
          <div className="pb-6 border-b space-y-2">
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
              <div key={i} className="rounded-xl border p-4 sm:p-5 space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
