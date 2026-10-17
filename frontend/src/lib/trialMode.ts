import type { User } from "@/types";

/**
 * 「体验模式」判定（仅允许使用免费模型）。
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
