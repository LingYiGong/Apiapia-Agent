"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
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
