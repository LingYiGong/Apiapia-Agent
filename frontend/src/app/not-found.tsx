"use client";

import Link from "next/link";
import { Cat } from "lucide-react";
import { useI18n } from "@/i18n";

/**
 * 404 页面。
 *
 * 这一点在静态导出（`output: "export"`，见 next.config.mjs）下尤其重要：
 * 任何未预渲染的路径都会落到这里，而此前 Next 默认的 404 既没有应用外壳，
 * 也没有「回首页」的入口。
 *
 * 圆角/字号沿用全站语言（rounded-2xl 而非 shadcn 默认的 rounded-md），
 * 避免这个页面看起来像另一个产品。
 *
 * 用客户端组件而不是服务端组件，是为了能取 useI18n —— 404 页面没有自己的
 * 布局包裹，必须自己挂在 root layout 的 provider 之下。
 */
export default function NotFound() {
  const { t } = useI18n();

  return (
    <main className="flex h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <div className="mb-1 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Cat className="h-7 w-7" />
      </div>
      <p className="font-mono text-xs tracking-widest text-muted-foreground">404</p>
      <h1 className="text-lg font-semibold">{t("meta.notFound.title")}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        {t("meta.notFound.description")}
      </p>
      <Link
        href="/chat"
        className="inline-flex h-10 items-center justify-center rounded-2xl bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {t("chat.history.backToChat")}
      </Link>
    </main>
  );
}