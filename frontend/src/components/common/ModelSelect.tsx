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
      const match = (o: ModelOption) => o.guide?.useCases.includes(key) === true;
      const matched = options.filter(match);
      return {
        key: `use:${key}`,
        label: t(USE_CASE_LABEL_KEYS[key]),
        icon: USE_CASE_ICONS[key],
        count: matched.length,
        distinctCount: countDistinctModels(options, match),
        section: useCaseSection,
        available: matched.length > 0,
        match,
      };
    });

    return [
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
