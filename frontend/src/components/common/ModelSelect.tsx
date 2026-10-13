"use client";

import React, { useMemo } from "react";
import { Zap, Sparkles } from "lucide-react";
import {
  ModelPicker,
  allFilterMatch,
  featuredFilterMatch,
  freeFilterMatch,
  type ModelFilterGroup,
} from "@/components/common/ModelPicker";
import { useIsTrialMode } from "@/hooks/useIsTrialMode";
import { toChatModelOptions } from "@/lib/models";
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
 * 本文件只负责把后端目录归一化，并组装「免费 / 精选 / 全部」分组筛选。
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
    const free = options.filter(freeFilterMatch);
    const featured = options.filter(featuredFilterMatch);
    return [
      {
        key: "free",
        label: t("settings.picker.freeGroup"),
        tone: "free",
        icon: Zap,
        count: free.length,
        available: free.length > 0,
        match: freeFilterMatch,
      },
      {
        key: "featured",
        label: t("settings.picker.featuredGroup"),
        tone: "featured",
        icon: Sparkles,
        count: featured.length,
        available: featured.length > 0,
        match: featuredFilterMatch,
      },
      {
        key: "all",
        label: t("settings.picker.allGroup"),
        tone: "all",
        count: options.length,
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
      defaultFilterKey={isVocabMode ? "all" : undefined}
      isTrialMode={isTrialMode}
    />
  );
};

export default ModelSelect;
