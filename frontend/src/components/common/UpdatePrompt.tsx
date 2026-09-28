"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  CURRENT_VERSION,
  VersionInfo,
  checkAppUpdate,
  performAppUpdate,
} from "@/lib/version";
import { Sparkles, RefreshCw, X, ArrowUpRight, CheckCircle2, AlertCircle } from "lucide-react";

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
        const dismissed = sessionStorage.getItem("personal_ai_dismissed_version");
        const updated = localStorage.getItem("personal_ai_updated_version");
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

    window.addEventListener("personal_ai_check_update", handleManualEvent);
    return () => {
      window.removeEventListener("personal_ai_check_update", handleManualEvent);
    };
  }, [runCheck]);

  const handleUpdateNow = async () => {
    setIsUpdating(true);
    if (updateInfo) {
      try {
        localStorage.setItem("personal_ai_updated_version", updateInfo.version);
        sessionStorage.setItem("personal_ai_dismissed_version", updateInfo.version);
      } catch {}
    }
    await performAppUpdate();
  };

  const handleDismiss = () => {
    if (updateInfo) {
      try {
        sessionStorage.setItem("personal_ai_dismissed_version", updateInfo.version);
      } catch {}
    }
    setShowModal(false);
  };

  return (
    <>
      {/* Toast Notification for Manual Checks */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none transition-all duration-300 animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-full shadow-xl text-xs font-semibold backdrop-blur-md border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 text-slate-800 dark:text-slate-100">
            {toastType === "success" && (
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
            )}
            {toastType === "info" && (
              <RefreshCw className="h-4 w-4 text-indigo-500 animate-spin shrink-0" />
            )}
            {toastType === "warning" && (
              <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
            )}
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Update Dialog Modal */}
      {showModal && updateInfo && (
        <div className="fixed inset-0 z-[9990] flex items-center justify-center bg-black/60 dark:bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div
            className="w-full max-w-md rounded-2xl border border-indigo-100 dark:border-indigo-900/50 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden flex flex-col scale-100 transition-transform"
            role="dialog"
            aria-modal="true"
          >
            {/* Header banner */}
            <div className="relative bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-700 p-5 text-white">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-10 w-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-inner">
                    <Sparkles className="h-5 w-5 text-amber-300 animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-white tracking-tight">
                        发现新版本
                      </h3>
                      <span className="px-2 py-0.5 rounded-full bg-white/20 text-xs font-mono font-bold text-amber-200 border border-white/20">
                        v{updateInfo.version}
                      </span>
                    </div>
                    <p className="text-xs text-indigo-100/90 mt-0.5">
                      当前版本: v{CURRENT_VERSION}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDismiss}
                  className="p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                  aria-label="关闭"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Content & Changelog */}
            <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
              {updateInfo.title && (
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {updateInfo.title}
                </div>
              )}

              {updateInfo.changelog && updateInfo.changelog.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    更新内容与特性：
                  </p>
                  <div className="space-y-1.5 bg-slate-50 dark:bg-slate-950/50 rounded-xl p-3 border border-slate-100 dark:border-slate-800">
                    {updateInfo.changelog.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300">
                        <ArrowUpRight className="h-3.5 w-3.5 text-indigo-500 shrink-0 mt-0.5" />
                        <span className="leading-snug">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                更新将自动清理浏览器旧版缓存并重载最新界面组件。建议在非对话中途进行更新。
              </p>
            </div>

            {/* Footer Buttons */}
            <div className="p-4 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={handleDismiss}
                disabled={isUpdating}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              >
                稍后提醒
              </button>

              <button
                type="button"
                onClick={handleUpdateNow}
                disabled={isUpdating}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/25 active:scale-[0.98] transition-all disabled:opacity-60"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isUpdating ? "animate-spin" : ""}`} />
                <span>{isUpdating ? "正在更新中..." : "立即更新"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
