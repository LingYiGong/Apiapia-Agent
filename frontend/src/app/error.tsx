"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";

/**
 * 路由级错误边界。
 *
 * 在此之前 `src/app/` 下没有任何 error.tsx —— 聊天页有 30+ 处 setState 和手写
 * 的 SSE 解析，任何一处渲染期抛错都会让整个应用变成白屏，既没有恢复入口，
 * 也没有错误上报。
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 没有接 Sentry 之前，至少保证线上问题在控制台可见。
    console.error("Route error:", error);
  }, [error]);

  const { t } = useI18n();

  return (
    <main
      role="alert"
      className="flex h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center"
    >
      <h1 className="text-lg font-semibold">{t("meta.routeError.title")}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        {t("meta.routeError.description")}
      </p>
      {error.digest && (
        <p className="font-mono text-xs text-muted-foreground/70">
          {t("meta.routeError.digest", { digest: error.digest })}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button type="button" onClick={reset} className="rounded-2xl">
          {t("common.action.retry")}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => (window.location.href = "/chat")}
          className="rounded-2xl"
        >
          {t("chat.history.backToChat")}
        </Button>
      </div>
    </main>
  );
}
