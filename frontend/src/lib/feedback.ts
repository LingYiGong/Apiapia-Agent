import { toast } from "sonner";
import type { MessageKey, Translator } from "@/i18n/runtime";

export type ModelSyncScope = "language" | "image" | "video" | "speech";

const SCOPE_KEY: Record<ModelSyncScope, MessageKey> = {
  language: "common.modelSync.scope.language",
  image: "common.modelSync.scope.image",
  video: "common.modelSync.scope.video",
  speech: "common.modelSync.scope.speech",
};

/**
 * 「同步模型列表」的结果反馈。
 * 设置页语言模型 / 绘图模型 / 视频模型 / 语音模型共用。
 */
export function notifyModelSyncResult(opts: {
  t: Translator;
  scope: ModelSyncScope;
  newCount: number;
  /** 无新增时后端返回的说明文案 */
  message?: string | null;
  /** 同步后目录仍然为空 */
  emptyResult?: boolean;
}) {
  const { t, scope, newCount, message, emptyResult } = opts;
  const scopeKey = SCOPE_KEY[scope];
  if (emptyResult) {
    toast.error(t("common.modelSync.emptyTitle", { scope: t(scopeKey) }), {
      description: message || t("common.modelSync.emptyDescription"),
    });
    return;
  }
  if (newCount > 0) {
    toast.success(t("common.modelSync.foundNew", { count: newCount, scope: t(scopeKey) }), {
      description: t("common.modelSync.updatedDescription", { scope: t(scopeKey) }),
    });
  } else {
    // 后端返回的 message 是服务端按 Accept-Language 查好的，已是当前语言；
    // 缺失时才用本地兜底。
    toast.success(message || t("common.modelSync.upToDate", { scope: t(scopeKey) }));
  }
}