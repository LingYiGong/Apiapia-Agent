import type { User } from "@/types";

/**
 * 「体验模式」的唯一定义。
 *
 * 此前有两套判定：
 *   - components/settings/SettingsView.tsx:159
 *       `!user?.is_superuser && !user?.can_access_all_models`   —— 权限语义
 *   - components/common/ModelSelect.tsx:74
 *       `options.every(o => o.isFree)`                          —— 目录语义
 *
 * 后端实际按权限拦截（403），所以**权限是权威**，目录只是「恰好一个付费模型都没有」
 * 的表象。两者在管理员把自己的模型目录筛成全免费时就会不一致，导致徽章闪没。
 */

/** 判定所需的最小用户字段，便于测试与复用。 */
export type TrialUserLike = Pick<User, "is_superuser" | "can_access_all_models">;

export function isTrialUser(user: TrialUserLike | null | undefined): boolean {
  if (!user) return false;
  return !user.is_superuser && !user.can_access_all_models;
}

/**
 * 目录兜底判定：拿不到用户对象时（例如模型选择器被用在无鉴权上下文中），
 * 用「目录里一个付费模型都没有」近似体验模式。
 */
export function isTrialCatalog(options: readonly { isFree: boolean }[]): boolean {
  return options.length > 0 && options.every((o) => o.isFree);
}
