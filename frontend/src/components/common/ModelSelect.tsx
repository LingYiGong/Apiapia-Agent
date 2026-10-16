"use client";

import React, { useMemo } from "react";
import { Sparkles, List } from "lucide-react";
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
 * 分组以普通用户的直觉场景为核心：
 * 1. 综合推荐（最聪明全能）
 * 2. 5 个高频日常场景（写作翻译 / 深度思考 / 编程开发 / 看图识文 / 极速免费）
 * 3. 全部模型
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
    const useCaseSection = t("settings.modelGuide.sectionUseCase");

    const byUseCase: ModelFilterGroup[] = USE_CASE_ORDER.map((key) => {
      const Icon = USE_CASE_ICONS[key];
      const match = (o: ModelOption) => {
        if (key === "fastFree") {
          return o.guide?.useCases.includes("fastFree") === true || freeFilterMatch(o);
        }
        return o.guide?.useCases.includes(key) === true;
      };
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
