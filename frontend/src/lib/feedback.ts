import { toast } from "sonner";

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

/**
 * 「同步模型列表」的结果反馈。
 * 设置页语言模型 / 绘图模型 / 视频模型 / 语音模型共用，保证形式与文案完全一致。
 */
export function notifyModelSyncResult(opts: {
  /** 用于文案区分「语言模型」、「绘图模型」、「视频模型」与「语音模型」 */
  scope: "语言模型" | "绘图模型" | "视频模型" | "语音模型";
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
  const { scope, newCount, message, emptyResult } = opts;
  if (emptyResult) {
    toast.error(`${scope}同步后列表为空`, {
      description:
        message || "未获取到任何模型，请检查后台 .env 中的服务凭证是否有效。",
    });
    return;
  }
  if (newCount > 0) {
    toast.success(`发现 ${newCount} 个新${scope}`, {
      description: `${scope}列表已更新，可在选择器中查看`,
    });
  } else {
    toast.success(message || `${scope}列表已是最新，未发现新增`);
  }
}