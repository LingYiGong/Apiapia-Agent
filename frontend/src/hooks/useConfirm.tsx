"use client";

import React, { useCallback, useState } from "react";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";

export interface ConfirmRequest {
  title: string;
  description?: string;
  confirmText?: string;
  danger?: boolean;
  /** 确认后要跑的异步动作；抛错请自行处理 */
  onConfirm: () => void | Promise<void>;
}

export interface UseConfirmResult {
  /** 当前挂起的确认请求；为 null 时不应渲染对话框 */
  pending: ConfirmRequest | null;
  /** 打开确认框 */
  ask: (req: ConfirmRequest) => void;
  /** 手动关闭 */
  close: () => void;
  /** 确认框正在执行 onConfirm */
  confirming: boolean;
  /** 渲染好的确认框，直接放进 JSX 即可 */
  dialog: React.ReactElement | null;
}

/**
 * 破坏性操作的「先确认再执行」状态机。
 */
export function useConfirm(): UseConfirmResult {
  const [pending, setPending] = useState<ConfirmRequest | null>(null);
  const [confirming, setConfirming] = useState(false);

  const ask = useCallback((req: ConfirmRequest) => {
    setPending(req);
    setConfirming(false);
  }, []);

  const close = useCallback(() => {
    if (confirming) return;
    setPending(null);
    setConfirming(false);
  }, [confirming]);

  const handleConfirm = useCallback(async () => {
    if (!pending || confirming) return;
    setConfirming(true);
    try {
      await pending.onConfirm();
    } finally {
      setConfirming(false);
      setPending(null);
    }
  }, [pending, confirming]);

  const dialog = pending ? (
    <ConfirmDialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
      title={pending.title}
      description={pending.description}
      confirmText={pending.confirmText}
      danger={pending.danger}
      loading={confirming}
      onConfirm={handleConfirm}
    />
  ) : null;

  return { pending, ask, close, confirming, dialog };
}
