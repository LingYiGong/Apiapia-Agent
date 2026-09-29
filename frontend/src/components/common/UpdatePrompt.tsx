"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  CURRENT_VERSION,
  VersionInfo,
  checkAppUpdate,
  performAppUpdate,
} from "@/lib/version";
import { Sparkles, RefreshCw, ArrowUpRight, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

export const UpdatePrompt: React.FC = () => {
  const [updateInfo, setUpdateInfo] = useState<VersionInfo | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"info" | "success" | "warning">("info");

  const showToast = useCallback((msg: string, type: "info" | "success" | "warning" = "info") => {
    setToastMessage(msg);
    setToastType(type);
    const timer = setTimeout(() => {
      setToastMessage(null);
    }, 3500);
    return () => clearTimeout(timer);
  }, []);

  const runCheck = useCallback(async (isManual = false) => {
    if (isManual) {
      showToast("正在检查是否有新版本...", "info");
    }

    const result = await checkAppUpdate();

    if (result.hasUpdate && result.info) {
      let isIgnored = false;
      try {
        const dismissed = sessionStorage.getItem("apiapia_dismissed_version");
        const updated = localStorage.getItem("apiapia_updated_version");
        if (dismissed === result.latestVersion || updated === result.latestVersion) {
          isIgnored = true;
        }
      } catch {}

      if (isManual || !isIgnored) {
        setUpdateInfo(result.info);
        setShowModal(true);
      }
    } else if (isManual) {
      showToast(`已是最新版本 (v${CURRENT_VERSION})，无需更新`, "success");
    }
  }, [showToast]);

  // Initial check on entry / page mount
  useEffect(() => {
    // Check after a brief delay (1s) so initial render is smooth
    const timer = setTimeout(() => {
      runCheck(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, [runCheck]);

  // Listen to manual update events
  useEffect(() => {
    const handleManualEvent = () => {
      runCheck(true);
    };

    window.addEventListener("apiapia_check_update", handleManualEvent);
    return () => {
      window.removeEventListener("apiapia_check_update", handleManualEvent);
    };
  }, [runCheck]);

  const handleUpdateNow = async () => {
    setIsUpdating(true);
    if (updateInfo) {
      try {
        localStorage.setItem("apiapia_updated_version", updateInfo.version);
        sessionStorage.setItem("apiapia_dismissed_version", updateInfo.version);
      } catch {}
    }
    await performAppUpdate();
  };

  const handleDismiss = () => {
    if (updateInfo) {
      try {
        sessionStorage.setItem("apiapia_dismissed_version", updateInfo.version);
      } catch {}
    }
    setShowModal(false);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      handleDismiss();
    } else {
      setShowModal(true);
    }
  };

  return (
    <>
      {/* Toast Notification for Manual Checks */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none transition-all duration-300 animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-full shadow-xl text-xs font-semibold backdrop-blur-md border bg-background/95">
            {toastType === "success" && (
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
            )}
            {toastType === "info" && (
              <RefreshCw className="h-4 w-4 text-primary animate-spin shrink-0" />
            )}
            {toastType === "warning" && (
              <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
            )}
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Update Dialog */}
      <Dialog open={showModal} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md p-0 overflow-hidden gap-0">
          {/* Header banner */}
          <div className="relative bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-700 p-5 text-white">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-inner">
                  <Sparkles className="h-5 w-5 text-amber-300 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <DialogTitle className="text-base font-bold text-white tracking-tight">
                      发现新版本
                    </DialogTitle>
                    {updateInfo && (
                      <Badge className="bg-white/20 text-amber-200 border-white/20 font-mono">
                        v{updateInfo.version}
                      </Badge>
                    )}
                  </div>
                  <DialogDescription className="text-xs text-indigo-100/90 mt-0.5">
                    当前版本: v{CURRENT_VERSION}
                  </DialogDescription>
                </div>
              </div>
            </div>
          </div>

          {/* Content & Changelog */}
          <ScrollArea className="max-h-[60vh]">
            <div className="p-5 space-y-4">
              {updateInfo?.title && (
                <div className="text-xs font-semibold">
                  {updateInfo.title}
                </div>
              )}

              {updateInfo?.changelog && updateInfo.changelog.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    更新内容与特性：
                  </p>
                  <div className="space-y-1.5 bg-muted rounded-xl p-3 border">
                    {updateInfo.changelog.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs">
                        <ArrowUpRight className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                        <span className="leading-snug">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-[11px] text-muted-foreground">
                更新将自动清理浏览器旧版缓存并重载最新界面组件。建议在非对话中途进行更新。
              </p>
            </div>
          </ScrollArea>

          {/* Footer Buttons */}
          <DialogFooter className="p-4 bg-muted/60 border-t">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              disabled={isUpdating}
            >
              稍后提醒
            </Button>
            <Button
              size="sm"
              onClick={handleUpdateNow}
              disabled={isUpdating}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isUpdating ? "animate-spin" : ""}`} />
              <span>{isUpdating ? "正在更新中..." : "立即更新"}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
