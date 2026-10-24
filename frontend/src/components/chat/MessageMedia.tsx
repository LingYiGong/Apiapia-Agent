"use client";

import React from "react";
import { FileCode, FileSpreadsheet, FileText, Download, ZoomIn } from "lucide-react";
import type { AttachmentItem } from "@/types";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { downloadAttachment, getFileCategory } from "@/lib/fileUpload";

/**
 * 用户消息里的图片缩略图与文档徽标。
 */

export function ImageThumb({
  src,
  alt,
  onClick,
}: {
  src: string;
  alt: string;
  onClick: () => void;
}) {
  const { t } = useI18n();

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    downloadAttachment({ name: alt || "image.png", data_url: src });
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      title={t("chat.markdown.imageZoom")}
      aria-label={t("chat.media.zoomAlt", { alt })}
      className="group relative cursor-zoom-in overflow-hidden rounded-xl border border-white/20 bg-black/20 shadow-md outline-none focus-visible:ring-2 focus-visible:ring-primary/80"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className="max-h-48 max-w-[240px] rounded-lg object-cover transition-transform duration-200 group-hover:scale-105 sm:max-w-xs"
      />
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-between p-2 bg-gradient-to-t from-black/60 via-transparent to-black/30 opacity-0 transition-opacity group-hover:opacity-100"
      >
        <span className="flex items-center gap-1 text-xs text-white drop-shadow-md">
          <ZoomIn className="h-4 w-4" />
        </span>
        <button
          type="button"
          onClick={handleDownload}
          title={t("chat.markdown.download")}
          aria-label={t("chat.markdown.download")}
          className="pointer-events-auto rounded-full bg-black/70 p-1.5 text-white hover:bg-black transition-transform active:scale-95 shadow-md"
        >
          <Download className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function DocChip({
  name,
  size,
  data_url,
  text,
  mime_type,
  onPreview,
  onDownload,
}: {
  name: string;
  size?: number;
  data_url?: string;
  text?: string;
  mime_type?: string;
  onPreview?: () => void;
  onDownload?: () => void;
}) {
  const { fmt, t } = useI18n();
  const category = getFileCategory(name, mime_type);

  const handleDownloadClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDownload) {
      onDownload();
    } else {
      downloadAttachment({ name, data_url, text, mime_type });
    }
  };

  const Icon =
    category === "pdf"
      ? FileText
      : category === "code"
        ? FileCode
        : category === "data"
          ? FileSpreadsheet
          : FileText;

  const iconColor =
    category === "pdf"
      ? "text-rose-300"
      : category === "code"
        ? "text-emerald-300"
        : category === "data"
          ? "text-amber-300"
          : "text-indigo-200";

  return (
    <div
      role={onPreview ? "button" : undefined}
      tabIndex={onPreview ? 0 : undefined}
      onClick={onPreview}
      onKeyDown={(e) => {
        if (onPreview && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onPreview();
        }
      }}
      title={`${name}${size ? ` (${fmt.fileSize(size)})` : ""}${onPreview ? ` - ${t("chat.media.clickToPreview")}` : ""}`}
      className={cn(
        "group flex max-w-[240px] items-center gap-1.5 rounded-xl border border-indigo-400/40 bg-indigo-700/80 px-2.5 py-1.5 text-xs text-white shadow-xs backdrop-blur-sm transition-all",
        onPreview && "cursor-pointer hover:border-indigo-300 hover:bg-indigo-700 active:scale-[0.98]"
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0", iconColor)} />
      <span className="truncate font-medium flex-1">{name}</span>
      {size ? <span className="font-mono text-3xs text-indigo-200/90 shrink-0">{fmt.fileSize(size)}</span> : null}

      <button
        type="button"
        onClick={handleDownloadClick}
        title={t("chat.markdown.download")}
        aria-label={`${t("chat.markdown.download")} ${name}`}
        className="ml-0.5 rounded-lg p-1 text-white/70 opacity-80 hover:bg-white/20 hover:text-white hover:opacity-100 transition-all shrink-0 active:scale-95"
      >
        <Download className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/** 附件 / 解析出的图片文档，统一排成右对齐的换行网格。 */
export function MediaGrid({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mb-2 flex flex-wrap justify-end gap-2", className)}
      {...props}
    />
  );
}

export function AttachmentItems({
  attachments,
  onImageClick,
  onFileClick,
}: {
  attachments: AttachmentItem[];
  onImageClick: (src: string, alt?: string) => void;
  onFileClick?: (file: AttachmentItem) => void;
}) {
  return (
    <MediaGrid>
      {attachments.map((att) =>
        att.type === "image" ? (
          <ImageThumb
            key={att.id}
            src={att.data_url}
            alt={att.name}
            onClick={() => onImageClick(att.data_url, att.name)}
          />
        ) : (
          <DocChip
            key={att.id}
            name={att.name}
            size={att.size}
            data_url={att.data_url}
            text={att.text}
            mime_type={att.mime_type}
            onPreview={onFileClick ? () => onFileClick(att) : undefined}
            onDownload={() => downloadAttachment(att)}
          />
        )
      )}
    </MediaGrid>
  );
}
