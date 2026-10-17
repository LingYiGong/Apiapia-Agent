"use client";

import * as React from "react";
import { Download, ImageOff, Palette } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { GeneratedImage } from "@/types";
import { getMediaImageUrl } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";

/**
 * AI 生成图片卡片。
 */
export function AiImageCard({
  image,
  onImageClick,
}: {
  image: GeneratedImage;
  onImageClick?: (src: string, alt?: string) => void;
}) {
  const { t } = useI18n();
  const [loaded, setLoaded] = React.useState(false);
  const [errored, setErrored] = React.useState(false);
  const [visible, setVisible] = React.useState(false);
  const holderRef = React.useRef<HTMLDivElement>(null);

  const src = image.id ? getMediaImageUrl(image.id) : image.url || "";

  // 只有接近视口才真正开始下载，否则打开长对话会一次性请求所有图片。
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
    const filename = `ai-image-${Date.now()}.${(image.ext || "png").toLowerCase()}`;
    const triggerAnchor = (href: string) => {
      const a = document.createElement("a");
      a.href = href;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    };

    if (image.id) {
      // 同源资源且响应带 Content-Disposition，普通导航即可保存
      triggerAnchor(getMediaImageUrl(image.id, true));
      return;
    }
    if (!src) return;
    if (src.startsWith("data:")) {
      triggerAnchor(src);
    } else {
      // 跨域地址无法设置 download，只能新开标签让用户自行保存
      window.open(src, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="my-4 overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-surface-3/60 px-3.5 py-2 text-xs select-none">
        <div className="flex items-center gap-1.5 font-medium text-foreground">
          <Palette className="h-3.5 w-3.5 text-primary" />
          <span>{t("chat.markdown.aiImageTitle")}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge
            variant="secondary"
            className="h-5 px-2 py-0 font-mono text-xs font-normal"
          >
            {image.provider} · {image.model}
          </Badge>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleDownload}
            className="h-7 gap-1 rounded-lg bg-primary/10 px-2.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
          >
            <Download className="h-4 w-4" />
            <span>{t("chat.markdown.download")}</span>
          </Button>
        </div>
      </div>

      <div
        ref={holderRef}
        className="relative flex min-h-[200px] items-center justify-center bg-surface-3/20"
      >
        {!loaded && !errored && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground/60">
            <div className="absolute inset-0 animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-muted/40 via-muted/80 to-muted/40" />
            <Palette className="relative h-8 w-8 animate-pulse text-primary/40" />
            <span className="relative text-xs">{t("chat.markdown.imageLoading")}</span>
          </div>
        )}

        {errored ? (
          <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground/60">
            <ImageOff className="h-8 w-8" />
            <span className="text-xs">{t("chat.markdown.imageFailed")}</span>
            <button
              type="button"
              onClick={handleDownload}
              className="mt-1 text-xs text-primary hover:underline"
            >
              {t("chat.markdown.clickToDownload")}
            </button>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={visible ? src : undefined}
            alt={image.prompt}
            loading="lazy"
            decoding="async"
            onClick={() => onImageClick?.(src, image.prompt)}
            title={t("chat.markdown.imageZoom")}
            className={cn(
              "max-h-[520px] max-w-full cursor-zoom-in object-contain transition-opacity duration-300",
              loaded ? "opacity-100" : "opacity-0"
            )}
            onLoad={() => setLoaded(true)}
            onError={() => {
              setLoaded(true);
              setErrored(true);
            }}
          />
        )}
      </div>

      <div
        className="truncate border-t border-border/40 px-3.5 py-2 text-xs text-muted-foreground"
        title={image.prompt}
      >
        💡 {image.prompt}
      </div>
    </div>
  );
}
