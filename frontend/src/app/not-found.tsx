import Link from "next/link";
import { Cat } from "lucide-react";

/**
 * 404 页面。
 *
 * 这一点在静态导出（`output: "export"`，见 next.config.mjs）下尤其重要：
 * 任何未预渲染的路径都会落到这里，而此前 Next 默认的 404 既没有应用外壳，
 * 也没有「回首页」的入口。
 *
 * 圆角/字号沿用全站语言（rounded-2xl 而非 shadcn 默认的 rounded-md），
 * 避免这个页面看起来像另一个产品。
 */
export default function NotFound() {
  return (
    <main className="flex h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <div className="mb-1 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Cat className="h-7 w-7" />
      </div>
      <p className="font-mono text-xs tracking-widest text-muted-foreground">404</p>
      <h1 className="text-lg font-semibold">页面不存在</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        你访问的地址可能已被删除，或链接不正确。
      </p>
      <Link
        href="/chat"
        className="inline-flex h-10 items-center justify-center rounded-2xl bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        返回对话
      </Link>
    </main>
  );
}
