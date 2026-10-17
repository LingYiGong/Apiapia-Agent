"use client";

import Link from "next/link";
import { Cat } from "lucide-react";
import { useI18n } from "@/i18n";

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