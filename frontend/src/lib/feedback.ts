import { toast } from "sonner";
import type { MessageKey, Translator } from "@/i18n/runtime";

/**
 * ── 全应用统一的反馈形式约定 ──
 *
 * Dialog（需要点一下）：
 *   - 用户必须做出决策（删除、停用、改权限…）→ ConfirmDialog
 *   - 需要填写内容（重命名、编辑记忆…）
 *   - 要阅读的内容在别处看不到（图片预览、对话审计、消息查看）
 *
 * Toast（自动消失）：
 *   - 刚刚那一下操作的结果，用户确认「成了/没成」即可
 *   - 内容在别处已经能看到（例如新模型同步完，选择器里就能看到）
 *   - 过程状态（正在导出… → 已导出）
 *
 * 判断口诀：**要决策或要读 → Dialog；只是回报结果 → Toast。**
 */

/** 四类模型的**词典键**，而不是本地化后的字符串。 */
export type ModelSyncScope = "language" | "image" | "video" | "speech";

const SCOPE_KEY: Record<ModelSyncScope, MessageKey> = {
  language: "common.modelSync.scope.language",
  image: "common.modelSync.scope.image",
  video: "common.modelSync.scope.video",
  speech: "common.modelSync.scope.speech",
};

/**
 * 「同步模型列表」的结果反馈。
 * 设置页语言模型 / 绘图模型 / 视频模型 / 语音模型共用，保证形式与文案完全一致。
 *
 * `t` 显式传入：调用方都在 React 事件处理里，手上有现成的 t，
 * 而这个函数本身不在渲染期，用模块级的 getTranslator 也可以 ——
 * 但显式传参让「文案语言由谁决定」这件事没有歧义，
 * 将来若某个调用点想在 A 语言的界面上提示 B 语言的内容，也不用改这里。
 */
export function notifyModelSyncResult(opts: {
  t: Translator;
  scope: ModelSyncScope;
  newCount: number;
  /** 无新增时后端返回的说明文案 */
  message?: string | null;
  /**
   * 同步后目录仍然为空。
   *
   * 单独拎出来是因为「成功但一个模型都没有」是最难排查的一种失败：toast 说成功，
   * 下拉框空空如也，用户只会以为是自己哪里点错了。而它通常意味着查询参数写错了
   * 或凭证没生效 —— 这两类都不该报成功。
   */
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