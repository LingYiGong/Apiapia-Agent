"use client";

import React, { useMemo } from "react";
import { Brain, Coins, Gauge, SlidersHorizontal } from "lucide-react";
import { ModelPicker } from "@/components/common/ModelPicker";
import {
  allFilterMatch,
  type ModelFilterGroup,
} from "@/components/common/modelFilterGroups";
import { useIsTrialMode } from "@/hooks/useIsTrialMode";
import { countDistinctModels, toChatModelOptions } from "@/lib/models";
import { getModelTier } from "@/lib/modelTiers";
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
 * 本文件只负责把后端目录归一化，并组装四个等级卡片。
 *
 * 三个推荐档位只列精选模型（清单见 lib/modelTiers.ts），顺序固定为：
 * 1. 免费 —— 置顶的三个免费入口
 * 2. 正常 —— 精选的日常性价比模型
 * 3. 聪明 —— 精选的旗舰模型
 * 4. 自定义 —— 不做等级筛选，搜索并浏览全部模型
 *
 * 精选清单之外的模型不会消失，只是不在前三个档位里重复展示；用户仍可在
 * 「自定义」里搜索到它们。这样档位是「推荐」而不是「目录分区」。
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
    // 「有可选分组」时挑一次并上锁；若此时只递一个 available 的「自定义」，
    // 它会立刻锁定在「自定义」，之后目录到了也不会再切到当前模型所属推荐档。
    if (options.length === 0) return [];

    const tiers: Array<Omit<ModelFilterGroup, "count" | "distinctCount" | "available">> = [
      {
        key: "free",
        label: t("settings.modelGuide.groupFree"),
        description: t("settings.modelGuide.tierDesc.free"),
        icon: Coins,
        // 只保留三个置顶免费入口，其余免费模型仍在「自定义」里。
        match: (o) => getModelTier(o) === "free",
      },
      {
        key: "normal",
        label: t("settings.modelGuide.groupNormal"),
        description: t("settings.modelGuide.tierDesc.normal"),
        icon: Gauge,
        // 精选日常性价比模型，不把整个付费目录倒进来。
        match: (o) => getModelTier(o) === "normal",
      },
      {
        key: "smart",
        label: t("settings.modelGuide.groupSmart"),
        description: t("settings.modelGuide.tierDesc.smart"),
        icon: Brain,
        // 精选旗舰，同系列的旧版与变体只在「自定义」里出现。
        match: (o) => getModelTier(o) === "smart",
      },
      {
        key: "custom",
        label: t("settings.modelGuide.groupCustom"),
        description: t("settings.modelGuide.tierDesc.custom"),
        icon: SlidersHorizontal,
        // 不做等级筛选：配合搜索框可以自己翻遍整个目录。
        match: allFilterMatch,
      },
    ];

    return tiers.map((group) => {
      const matched = options.filter(group.match);
      return {
        ...group,
        count: matched.length,
        distinctCount: countDistinctModels(options, group.match),
        available: matched.length > 0,
      };
    });
  }, [options, t]);

  /**
   * 首次打开面板时默认停在当前模型所属的推荐档：免费模型进「免费」，精选
   * 旗舰进「聪明」，精选日常模型进「正常」。
   *
   * 如果当前模型不在任何精选清单里（旧模型、快照、`:batch` 变体等），直接
   * 落到「自定义」，否则列表里会看不到当前选中项。没有选中项（新用户）时
   * 从「免费」开始。
   *
   * 词汇/翻译模式有专门的排序（见 lib/models.ts 的 isVocabMode 分支），
   * 那里直接落到「自定义」浏览全部更合适。
   */
  const initialFilterKey = useMemo(() => {
    if (isVocabMode) return "custom";
    const selected = options.find((o) => o.id === value);
    const selectedTier = selected ? getModelTier(selected) : null;
    if (selectedTier) return selectedTier;
    if (selected) return "custom";
    // 没有选中项时优先从「免费」开始；目录里没有精选免费模型才退到「自定义」。
    return options.some((o) => getModelTier(o) === "free") ? "free" : "custom";
  }, [options, value, isVocabMode]);

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
      defaultFilterKey={initialFilterKey}
      isTrialMode={isTrialMode}
    />
  );
};

export default ModelSelect;
