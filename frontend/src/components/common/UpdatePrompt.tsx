"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  CURRENT_VERSION,
  VersionInfo,
  checkAppUpdate,
  performAppUpdate,
} from "@/lib/version";
import { Sparkles, RefreshCw, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { useI18n } from "@/i18n";

/**
 * 新版本提示。
 *
 * 按全应用统一的反馈约定：自动检查只是「回报一个结果」，不该打断用户，所以只弹
 * toast；changelog 是需要阅读的内容，但仅在用户主动想看时才展开成Dialog
 * （偏好设置 → 检查更新，或点 toast 上的「查看详情」）。
 */
export const UpdatePrompt: React.FC = () => {
  const { t } = useI18n();
  const [updateInfo, setUpdateInfo] = useState<VersionInfo | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const openDetail = useCallback((info: VersionInfo) => {
    setUpdateInfo(info);
    setShowModal(true);
  }, []);

  const runCheck = useCallback(
    async (isManual = false) => {
      if (isManual) {
        toast.info(t("meta.update.checking"));
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

        if (isManual) {
          // 用户主动点的检查，直接给完整详情。
          openDetail(result.info);
          return;
        }

        if (!isIgnored) {
          // 自动检查不打断：只提示一句，想看 changelog 再点进来。
          // 偏好设置里的「检查更新」按钮随时可以主动打开详情。
          toast.info(t("meta.update.availableTitle", { version: result.info.version }), {
            description: t("meta.update.changelogHint"),
            duration: 8000,
            action: {
              label: t("meta.update.changelog"),
              onClick: () => openDetail(result.info!),
            },
          });
        }
      } else if (isManual) {
        toast.success(t("meta.update.currentDescription", { version: CURRENT_VERSION }));
      }
    },
    [openDetail, t]
  );

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
    <Dialog open={showModal} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md gap-0 overflow-hidden p-0 [&>button]:text-white/80 [&>button:hover]:bg-white/15 [&>button:hover]:text-white">
          {/* Header banner */}
          <div className="relative bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-700 p-5 pr-12 text-white">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-inner">
                  <Sparkles className="h-5 w-5 text-amber-300 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <DialogTitle className="text-base font-bold text-white">
                      {t("meta.update.availableTitle", { version: updateInfo?.version ?? "" })}
                    </DialogTitle>
                    {updateInfo && (
                      <Badge className="bg-white/20 text-amber-200 border-white/20 font-mono">
                        v{updateInfo.version}
                      </Badge>
                    )}
                  </div>
                  <DialogDescription className="text-xs text-indigo-100/90 mt-0.5">
                    {t("settings.about.versionValue", { version: CURRENT_VERSION })}
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

              {updateInfo?.changelog && updateInfo.changelog.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    {t("meta.update.changelog")}
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
              ) : (
                // 服务端没给 changelog 时留一行说明，而不是留一块空白 ——
                // 空白会让用户以为是加载失败了。
                <p className="text-xs text-muted-foreground">
                  {t("meta.update.noChangelog")}
                </p>
              )}

              <p className="text-xs text-muted-foreground">
                {t("meta.update.cacheWarning")}
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
              {t("meta.update.later")}
            </Button>
            <Button
              size="sm"
              onClick={handleUpdateNow}
              disabled={isUpdating}
            >
              <RefreshCw className={`h-4 w-4 ${isUpdating ? "animate-spin" : ""}`} />
              <span>
                {isUpdating ? t("common.action.processing") : t("meta.update.updateNow")}
              </span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  );
};
