import Link from "next/link";

/**
 * 404 页面。
 *
 * 这一点在静态导出（`output: "export"`，见 next.config.mjs）下尤其重要：
 * 任何未预渲染的路径都会落到这里，而此前 Next 默认的 404 既没有应用外壳，
 * 也没有「回首页」的入口。
 */
export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <p className="font-mono text-xs tracking-widest text-muted-foreground">404</p>
      <h1 className="text-lg font-semibold">页面不存在</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        你访问的地址可能已被删除，或链接不正确。
      </p>
      <Link
        href="/chat"
        className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        返回对话
      </Link>
    </main>
  );
}
