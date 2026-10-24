"use client";

import React, { useMemo } from "react";
import {
  FileText,
  FileCode,
  FileSpreadsheet,
  Download,
  Copy,
  Check,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/i18n";
import { useClipboard } from "@/hooks/useClipboard";
import {
  downloadAttachment,
  decodeDataUrlText,
  getFileCategory,
} from "@/lib/fileUpload";
import { cn } from "@/lib/utils";

export interface PreviewableFile {
  name: string;
  size?: number;
  type?: "image" | "document";
  mime_type?: string;
  data_url?: string;
  text?: string;
}

interface FilePreviewModalProps {
  file: PreviewableFile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FilePreviewModal({
  file,
  open,
  onOpenChange,
}: FilePreviewModalProps) {
  const { t, fmt } = useI18n();
  const { copied, copy } = useClipboard();

  const category = useMemo(() => {
    if (!file) return "other";
    return getFileCategory(file.name, file.mime_type);
  }, [file]);

  const decodedText = useMemo(() => {
    if (!file) return "";
    if (file.text) return file.text;
    if (file.data_url && (category === "code" || category === "text" || category === "data")) {
      return decodeDataUrlText(file.data_url);
    }
    return "";
  }, [file, category]);

  if (!file) return null;

  const handleDownload = () => {
    downloadAttachment(file);
  };

  const handleCopyText = () => {
    if (decodedText) {
      void copy(decodedText);
    }
  };

  const isPdf = category === "pdf";
  const isTextLike = category === "code" || category === "text" || category === "data" || !!decodedText;
  const hasContent = !!(file.data_url || file.text);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "flex w-full flex-col gap-0 overflow-hidden border border-border/80 bg-background p-0 shadow-2xl",
          "h-[90dvh] max-h-[90dvh] max-w-[min(94vw,900px)] rounded-2xl"
        )}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border/70 bg-surface-1/80 px-4 py-3 backdrop-blur-md">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              {isPdf ? (
                <FileText className="h-5 w-5 text-rose-500" />
              ) : category === "code" ? (
                <FileCode className="h-5 w-5 text-emerald-500" />
              ) : category === "data" ? (
                <FileSpreadsheet className="h-5 w-5 text-amber-500" />
              ) : (
                <FileText className="h-5 w-5 text-primary" />
              )}
            </div>
            <div className="min-w-0">
              <DialogTitle className="truncate text-sm font-semibold text-foreground">
                {file.name}
              </DialogTitle>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {file.size ? <span>{fmt.fileSize(file.size)}</span> : null}
                <Badge variant="secondary" className="px-1.5 py-0 text-3xs font-mono uppercase">
                  {category}
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {isTextLike && decodedText && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyText}
                className="h-8 gap-1.5 rounded-xl px-2.5 text-xs font-medium"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                    <span>{t("chat.message.copiedTip")}</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>{t("chat.message.copy")}</span>
                  </>
                )}
              </Button>
            )}

            <Button
              variant="default"
              size="sm"
              onClick={handleDownload}
              disabled={!hasContent}
              className="h-8 gap-1.5 rounded-xl px-3 text-xs font-medium"
            >
              <Download className="h-3.5 w-3.5" />
              <span>{t("chat.markdown.download")}</span>
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8 rounded-full text-muted-foreground hover:bg-surface-3 hover:text-foreground"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">{t("common.action.close")}</span>
            </Button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-surface-2/30 p-4">
          {isPdf ? (
            file.data_url ? (
              <div className="relative flex h-full w-full flex-col overflow-hidden rounded-xl border border-border/60 bg-white">
                <iframe
                  src={file.data_url}
                  title={file.name}
                  className="h-full w-full border-0"
                />
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                <FileText className="h-16 w-16 text-rose-500/80" />
                <h4 className="text-base font-semibold">{file.name}</h4>
                <p className="max-w-sm text-xs text-muted-foreground">
                  {t("chat.filePreview.pdfNoInline")}
                </p>
                <Button onClick={handleDownload} className="mt-2 gap-2">
                  <Download className="h-4 w-4" />
                  <span>{t("chat.markdown.download")}</span>
                </Button>
              </div>
            )
          ) : isTextLike && decodedText ? (
            <div className="flex h-full w-full flex-col overflow-hidden rounded-xl border border-border/60 bg-surface-3/50">
              <div className="flex items-center justify-between border-b border-border/50 px-3 py-1.5 text-3xs font-mono text-muted-foreground">
                <span>UTF-8 PREVIEW</span>
                <span>{t("chat.filePreview.lineCount", { count: decodedText.split("\n").length })}</span>
              </div>
              <pre className="flex-1 overflow-auto p-4 font-mono text-xs sm:text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap break-words [overflow-wrap:anywhere] select-text">
                {decodedText}
              </pre>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <FileText className="h-8 w-8" />
              </div>
              <h4 className="text-base font-semibold text-foreground">{file.name}</h4>
              <p className="max-w-sm text-xs text-muted-foreground">
                {hasContent
                  ? t("chat.filePreview.binaryDownloadHint")
                  : t("chat.filePreview.noCachedContent")}
              </p>
              {hasContent && (
                <Button onClick={handleDownload} className="mt-2 gap-2 rounded-xl px-5">
                  <Download className="h-4 w-4" />
                  <span>{t("chat.filePreview.downloadFile")}</span>
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
