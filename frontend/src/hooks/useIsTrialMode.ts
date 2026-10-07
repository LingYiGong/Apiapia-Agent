import { useAuth } from "@/lib/auth";
import { isTrialCatalog, isTrialUser } from "@/lib/trialMode";

/**
 * 当前用户是否处于「体验模式」（只能用免费模型）。
 *
 * 权限判定优先（后端权威）；用户对象尚未加载完成时，用传入的模型目录兜底近似，
 * 这样模型选择器在首帧也不会错标成完整体验。
 */
export function useIsTrialMode(options?: readonly { isFree: boolean }[]): boolean {
  const { user, loading } = useAuth();
  if (!loading && user) return isTrialUser(user);
  return options ? isTrialCatalog(options) : false;
}
