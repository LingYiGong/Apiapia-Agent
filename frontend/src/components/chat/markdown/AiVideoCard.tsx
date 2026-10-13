"use client";

import * as React from "react";
import { Download, Film, Video, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { GeneratedVideo } from "@/types";
import { getMediaVideoUrl } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";

/**
 * AI 生成视频播放卡片。
 *
 * 参照 AiImageCard 架构规范：
 *  - 优先使用媒体接口 getMediaVideoUrl(video.id) 进行同源持久化播放与下载
 *  - IntersectionObserver 视口懒加载
 *  - 提供 HTML5 播放器控件以及一键下载
 */
export function AiVideoCard({
  video,
}: {
  video: GeneratedVideo;
}) {
  const { t } = useI18n();
  const [loaded, setLoaded] = React.useState(false);
  const [errored, setErrored] = React.useState(false);
  const [visible, setVisible] = React.useState(false);
  const holderRef = React.useRef<HTMLDivElement>(null);

  const src = video.id ? getMediaVideoUrl(video.id) : video.url || "";

  React.useEffect(() => {
    if (!src || visible) return;
    const node = holderRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [src, visible]);

  const handleDownload = () => {
    const filename = `ai-video-${Date.now()}.${(video.ext || "mp4").toLowerCase()}`;
    const triggerAnchor = (href: string) => {
      const a = document.createElement("a");
      a.href = href;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    };

    if (video.id) {
      triggerAnchor(getMediaVideoUrl(video.id, true));
      return;
    }
    if (!src) return;
    if (src.startsWith("data:")) {
      triggerAnchor(src);
    } else {
      window.open(src, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="my-4 overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-surface-3/60 px-3.5 py-2 text-xs select-none">
        <div className="flex items-center gap-1.5 font-medium text-foreground">
          <Film className="h-3.5 w-3.5 text-primary" />
          <span>{t("chat.markdown.aiVideoTitle")}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge
            variant="secondary"
            className="h-[18px] px-1.5 py-0 font-mono text-2xs font-normal"
          >
            {video.provider} · {video.model}
          </Badge>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleDownload}
            className="h-7 gap-1 rounded-lg bg-primary/10 px-2 text-2xs font-medium text-primary transition-colors hover:bg-primary/20"
          >
            <Download className="h-3 w-3" />
            <span>{t("chat.markdown.download")}</span>
          </Button>
        </div>
      </div>

      <div
        ref={holderRef}
        className="relative flex min-h-[240px] items-center justify-center bg-surface-3/20"
      >
        {!loaded && !errored && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground/60">
            <div className="absolute inset-0 animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-muted/40 via-muted/80 to-muted/40" />
            <Video className="relative h-8 w-8 animate-pulse text-primary/40" />
            <span className="relative text-xs">{t("chat.markdown.videoLoading")}</span>
          </div>
        )}

        {errored ? (
          <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground/60">
            <AlertCircle className="h-8 w-8 text-destructive/70" />
            <span className="text-xs">{t("chat.markdown.videoFailed")}</span>
            <button
              type="button"
              onClick={handleDownload}
              className="mt-1 text-xs text-primary hover:underline"
            >
              {t("chat.markdown.clickToDownloadVideo")}
            </button>
          </div>
        ) : (
          visible && (
            <video
              src={src}
              controls
              playsInline
              preload="metadata"
              className={cn(
                "max-h-[540px] w-full rounded-b-none object-contain transition-opacity duration-300",
                loaded ? "opacity-100" : "opacity-0"
              )}
              onLoadedData={() => setLoaded(true)}
              onError={() => {
                setLoaded(true);
                setErrored(true);
              }}
            />
          )
        )}
      </div>

      <div
        className="truncate border-t border-border/40 px-3.5 py-2 text-xs text-muted-foreground"
        title={video.prompt}
      >
        🎬 {video.prompt}
      </div>
    </div>
  );
}
