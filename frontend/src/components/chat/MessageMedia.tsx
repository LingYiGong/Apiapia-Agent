"use client";

import React from "react";
import { FileText, ZoomIn } from "lucide-react";
import type { AttachmentItem } from "@/types";
import { formatFileSize } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * 用户消息里的图片缩略图与文档徽标。
 *
 * 此前 ChatMessageItem 里这两块各写了两遍 —— 一遍渲染 `msg.attachments`，
 * 一遍渲染从正文里解析出来的 `parsed.images` / `parsed.docs` —— 结构、
 * className、hover 效果全部重复共 40 余行。现在只有这一份。
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
  return (
    <button
      type="button"
      onClick={onClick}
      title="点击放大查看原图"
      aria-label={`放大查看 ${alt}`}
      className="group relative cursor-zoom-in overflow-hidden rounded-xl border border-white/20 bg-black/20 shadow-md"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className="max-h-48 max-w-[240px] rounded-lg object-cover transition-transform duration-200 group-hover:scale-105 sm:max-w-xs"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30 text-white opacity-0 transition-opacity group-hover:opacity-100"
      >
        <ZoomIn className="h-5 w-5 drop-shadow-md" />
      </span>
    </button>
  );
}

export function DocChip({ name, size }: { name: string; /** 字节数。省略时不显示体积 */ size?: number }) {
  return (
    <span
      title={name}
      className="flex max-w-[160px] items-center gap-1.5 rounded-xl border border-indigo-400/40 bg-indigo-700/70 px-3 py-1.5 text-xs text-white shadow-xs"
    >
      <FileText className="h-4 w-4 shrink-0 text-indigo-200" />
      <span className="truncate font-medium">{name}</span>
      {size ? <span className="font-mono text-[10px] text-indigo-200">{formatFileSize(size)}</span> : null}
    </span>
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
}: {
  attachments: AttachmentItem[];
  onImageClick: (src: string, alt?: string) => void;
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
          <DocChip key={att.id} name={att.name} size={att.size} />
        )
      )}
    </MediaGrid>
  );
}
