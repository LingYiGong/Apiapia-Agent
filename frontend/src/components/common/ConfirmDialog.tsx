"use client";

import React from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  /** 危险操作（删除/停用等）用红色确认按钮，默认 primary */
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
}

/**
 * 全应用统一的操作确认框，用来替代原生 `confirm()`。
 * 样式与项目 Dialog 体系一致：顶部图标 + 标题 + 说明，底部取消/确认。
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = "确认",
  cancelText = "取消",
  danger = false,
  loading = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "p-2.5 rounded-xl shrink-0",
                danger
                  ? "bg-destructive/10 text-destructive"
                  : "bg-primary/10 text-primary"
              )}
            >
              <TriangleAlert className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-sm font-semibold">{title}</DialogTitle>
              {description && (
                <DialogDescription className="text-xs mt-1 text-muted-foreground leading-relaxed">
                  {description}
                </DialogDescription>
              )}
            </div>
          </div>
        </DialogHeader>
        <DialogFooter className="flex-row items-center justify-end gap-2.5 sm:gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => onOpenChange(false)}
            className="flex-1 sm:flex-initial h-9 rounded-xl text-xs font-medium"
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            variant={danger ? "destructive" : "default"}
            disabled={loading}
            onClick={onConfirm}
            className="flex-1 sm:flex-initial h-9 rounded-xl text-xs font-semibold"
          >
            {loading ? "处理中..." : confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
