"use client";

import React, { useMemo } from "react";
import { Coins, Sparkles, List } from "lucide-react";
import { ModelPicker } from "@/components/common/ModelPicker";
import {
  allFilterMatch,
  featuredFilterMatch,
  freeFilterMatch,
  type ModelFilterGroup,
} from "@/components/common/modelFilterGroups";
import {
  USE_CASE_ICONS,
  USE_CASE_LABEL_KEYS,
} from "@/components/common/ModelGuideTags";
import { useIsTrialMode } from "@/hooks/useIsTrialMode";
import { countDistinctModels, toChatModelOptions, type ModelOption } from "@/lib/models";
import { USE_CASE_ORDER } from "@/lib/modelGuide";
import { useI18n } from "@/i18n";
import type { ModelCatalogItem } from "@/types";

interface ModelSelectProps {
  value: string;
  onChange: (modelId: string) => void;
  models: ModelCatalogItem[];
  placeholder?: string;
  className?: string;
  variant?: "default" | "compact";
  isVocabMode?: boolean;
}

/**
 * 语言模型选择器。实现已收敛到共享的 <ModelPicker>；
 * 本文件只负责把后端目录归一化，并组装分组筛选。
 *
 * 分组按「先价格、后场景、再兜底」排列：
 * 1. 免费（价格维度：目录里所有 is_free 的模型）
 * 2. 综合推荐（最聪明全能）
 * 3. 4 个高频日常场景（深度思考 / 写作翻译 / 看图识文 / 编程开发），
 *    顺序由 lib/modelGuide.ts 的 USE_CASE_ORDER 决定
 * 4. 全部模型
 */
export const ModelSelect: React.FC<ModelSelectProps> = ({
  value,
  onChange,
  models,
  placeholder,
  className,
  variant = "default",
  isVocabMode = false,
}) => {
  const { t } = useI18n();
  const options = useMemo(() => toChatModelOptions(models, isVocabMode), [models, isVocabMode]);

  const filterGroups = useMemo<ModelFilterGroup[]>(() => {
    // 目录还没加载出来时**一个分组都不给**。ModelPicker 的自动选组只在
    // 「有可选分组」时挑一次并上锁；若此时只递一个 available 的「全部」进去，
    // 它会立刻锁定在「全部」，之后目录到了也不会再切到「推荐」。
    // 聊天页首帧就是空目录（目录靠 useEffect 异步拉取），不挡这一下会踩中。
    if (options.length === 0) return [];

    const recommended = options.filter(featuredFilterMatch);
    const freeModels = options.filter(freeFilterMatch);
    const useCaseSection = t("settings.modelGuide.sectionUseCase");

    const byUseCase: ModelFilterGroup[] = USE_CASE_ORDER.map((key) => {
      const Icon = USE_CASE_ICONS[key];
      // 场景谓词只看画像标签，不掺价格条件。
      // 此前 fastFree 那一档在这里额外 `|| o.isFree`，把免费模型也算进
      // 「极速与免费」；现在免费有自己的分组（纯 isFree），这里回到纯粹的
      // 「这个模型是不是擅长这件事」。
      const match = (o: ModelOption) => o.guide?.useCases.includes(key) === true;
      const matched = options.filter(match);
      return {
        key: `use:${key}`,
        label: t(USE_CASE_LABEL_KEYS[key]),
        icon: Icon,
        count: matched.length,
        // 右侧显示去重后的真实模型数。`:batch` / `-pro` / `~latest` 变体不该让数字虚高。
        distinctCount: countDistinctModels(options, match),
        section: useCaseSection,
        available: matched.length > 0,
        match,
      };
    });

    return [
      /* 免费排在最前，且谓词是纯 `isFree` —— 「免费」这一档要的就是
         目录里所有免费的模型，一档不多一档不少。
         此前这里挂的是「极速与免费」（use:fastFree），谓词是
         「带 fastFree 画像 或 isFree」：那既不是纯免费，也会把一批
         低价付费模型（GLM-Flash / Qwen-Flash 等画像档都是 budget）
         混进来，用户按「免费」筛完却要为用不了的东西付费。 */
      {
        key: "free",
        label: t("settings.modelGuide.groupFree"),
        icon: Coins,
        count: freeModels.length,
        distinctCount: countDistinctModels(options, freeFilterMatch),
        available: freeModels.length > 0,
        match: freeFilterMatch,
      },
      {
        key: "recommended",
        label: t("settings.modelGuide.groupRecommend"),
        icon: Sparkles,
        count: recommended.length,
        distinctCount: countDistinctModels(options, featuredFilterMatch),
        available: recommended.length > 0,
        match: featuredFilterMatch,
      },
      ...byUseCase,
      {
        key: "all",
        label: t("settings.picker.allGroup"),
        icon: List,
        count: options.length,
        distinctCount: countDistinctModels(options, () => true),
        available: true,
        match: allFilterMatch,
      },
    ];
  }, [options, t]);

  // 体验模式改由 useIsTrialMode 按**权限**判定（后端权威），目录仅在用户对象
  // 尚未加载时兜底。此前这里是 `options.every(isFree)`，与设置页的
  // `!is_superuser && !can_access_all_models` 是两套判定，可能互相矛盾。
  const isTrialMode = useIsTrialMode(options);

  return (
    <ModelPicker
      value={value}
      onChange={onChange}
      options={options}
      kindLabel={t("settings.picker.genericKind")}
      ariaLabel={t("settings.picker.languageKind")}
      placeholder={placeholder}
      className={className}
      variant={variant}
      width="wide"
      filterGroups={filterGroups}
      // 词汇/翻译模式有专门的模型排序（见 lib/models.ts 的 isVocabMode 分支），
      // 那里推荐的往往是 flash-lite 之类的小模型，直接落到「全部」更合适。
      defaultFilterKey={isVocabMode ? "all" : "recommended"}
      isTrialMode={isTrialMode}
    />
  );
};

export default ModelSelect;
