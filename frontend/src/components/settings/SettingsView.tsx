"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";
import { ViewShell } from "@/components/common/ViewShell";
import { ModelCatalogItem, ImageModelItem, ImageModelsResponse, VideoModelItem, VideoModelsResponse, AudioModelItem, AudioModelsResponse } from "@/types";
import { ModelSelect } from "@/components/common/ModelSelect";
import { isFreeModel, isMultimodalModel, toChatModelOptions } from "@/lib/models";
import { CURRENT_VERSION, triggerManualUpdateCheck } from "@/lib/version";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ThemeSegments } from "@/components/common/ThemeSegments";
import { LanguageRow } from "@/components/common/LanguageSwitcher";
import { BrandLogo } from "@/components/common/BrandLogo";
import { ImageModelSelect } from "@/components/settings/ImageModelSelect";
import { VideoModelSelect } from "@/components/settings/VideoModelSelect";
import { AudioModelSelect } from "@/components/settings/AudioModelSelect";
import {
  ModelInfoPanel,
  ModelMissingNotice,
  SyncModelsButton,
} from "@/components/settings/ModelControls";
import {
  TemperatureControl,
} from "@/components/settings/PreferenceControls";
import { SaveActionBar, SaveStatus, type SaveState } from "@/components/settings/SaveBar";
import { useRefreshOnResume } from "@/hooks/useRefreshOnResume";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useIsTrialMode } from "@/hooks/useIsTrialMode";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Panel, SectionLabel } from "@/components/common/Panel";
import { notifyModelSyncResult } from "@/lib/feedback";
import { FullPageSkeleton, SettingsFormSkeleton } from "@/components/common/PageSkeleton";
import type { MobileTab } from "@/config/navigation";
import { useI18n } from "@/i18n";
import type { MessageKey, TranslateValues } from "@/i18n";
import { RefreshCw, Zap, Brain, Palette, Video, AudioLines, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface InitialSettings {
  defaultModel: string;
  memoryModel: string;
  consolidationModel: string;
  imageModel: string | null;
  videoModel: string | null;
  sttModel: string | null;
  ttsModel: string | null;
  systemPrompt: string;
  temperature: number;
  memoryEnabled: boolean;
}

export interface SettingsViewProps {
  isMobileSpa?: boolean;
  onSelectMobileTab?: (tab: MobileTab) => void;
  /** 移动端 SPA 里该页签当前是否可见；用于切回时补一次刷新 */
  active?: boolean;
}

/**
 * 「记忆提炼模型」的推荐项。
 *
 * 关键改动：这些 id **不再**与语言模型目录无关地硬编码。此前这份 5 项列表写死，
 * 用户只有 DeepSeek key 时下拉里照样列出 openai/gpt-4o-mini 等他调不通的模型。
 * 现在推荐项从 /models/configured 的真实目录里挑（见 buildMemoryModelOptions），
 * 并且允许手动输入任意 id。
 */
const MEMORY_MODEL_PRESET_IDS = [
  "openai/gpt-4o-mini",
  "deepseek/deepseek-chat",
  "anthropic/claude-3-5-haiku",
  "google/gemini-2.5-flash",
];

interface RecommendedConsolidationModel {
  id: string;
  name: string;
  tag: string;
  isFree: boolean;
  desc: string;
}

const RECOMMENDED_CONSOLIDATION_MODELS: RecommendedConsolidationModel[] = [
  {
    id: "openrouter/free",
    name: "Free Models Router",
    tag: "免费",
    isFree: true,
    desc: "官方免费智能路由，自动调度在线可用免费大模型池，开箱即用",
  },
  {
    id: "nvidia/nemotron-3-ultra-550b-a55b:free",
    name: "NVIDIA Nemotron 3 Ultra (Free)",
    tag: "免费",
    isFree: true,
    desc: "550B 参数开源旗舰前沿推理模型（55B 激活），逻辑消歧与时序推断极强",
  },
  {
    id: "google/gemma-4-31b-it:free",
    name: "Google Gemma 4 31B (Free)",
    tag: "免费",
    isFree: true,
    desc: "Google DeepMind 30.7B 密集指令微调模型，长文本遵循优秀，事实提炼严谨",
  },
  {
    id: "nvidia/nemotron-3-super-120b-a12b:free",
    name: "NVIDIA Nemotron 3 Super (Free)",
    tag: "免费",
    isFree: true,
    desc: "120B 参数混合 MoE 架构，大算力长上下文，高吞吐批量记忆脱水合并",
  },
  {
    id: "liquid/lfm-2.5-2.6b:free",
    name: "LiquidAI LFM 2.5 (Free)",
    tag: "免费",
    isFree: true,
    desc: "专为长上下文、数据提取（Data Extraction）与 RAG 优化的轻快推理模型",
  },
  {
    id: "deepseek/deepseek-v4.1-flash",
    name: "DeepSeek V4.1 Flash",
    tag: "API 计费",
    isFree: false,
    desc: "DeepSeek 最新稀疏 MoE 架构，长文本理解顶尖，JSON 格式输出高度遵从且极低成本",
  },
  {
    id: "anthropic/claude-sonnet-5.5",
    name: "Claude Sonnet 5.5",
    tag: "API 计费",
    isFree: false,
    desc: "Anthropic 新一代 Sonnet 旗舰，记忆推理天花板，细微时序冲突辨析与碎片归纳最精准",
  },
  {
    id: "anthropic/claude-haiku-5.5",
    name: "Claude Haiku 5.5",
    tag: "API 计费",
    isFree: false,
    desc: "专为高吞吐摘要与长文脱水优化的高速模型，响应极快，兼顾推理精度与经济性",
  },
  {
    id: "openai/gpt-6-luna",
    name: "GPT-6 Luna",
    tag: "API 计费",
    isFree: false,
    desc: "OpenAI GPT-6 系列高性价比主力，极速响应，指令遵从度极高，单次整理成本极低",
  },
  {
    id: "google/gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    tag: "API 计费",
    isFree: false,
    desc: "Google 最新 Flash 超大上下文模型，擅长跨时间线全局扫描与海量历史条目综合梳理",
  },
  {
    id: "qwen/qwen3.8-omni-flash",
    name: "Qwen 3.8 Omni Flash",
    tag: "API 计费",
    isFree: false,
    desc: "阿里通义千问最新多模态智能体模型，中文本土语义理解深刻，擅长人物关系与复杂事实梳理",
  },
];

/** 「关于系统」里的固定行。版本号这类运行时取值走 values 插值，不写进字典。 */
const ABOUT_ROWS: { labelKey: MessageKey; valueKey: MessageKey; values?: TranslateValues }[] = [
  {
    labelKey: "settings.about.versionLabel",
    valueKey: "settings.about.versionValue",
    values: { version: CURRENT_VERSION },
  },
  { labelKey: "settings.about.archLabel", valueKey: "settings.about.archValue" },
  { labelKey: "settings.about.engineLabel", valueKey: "settings.about.engineValue" },
];

export const SettingsView: React.FC<SettingsViewProps> = ({
  isMobileSpa = false,
  onSelectMobileTab,
  active = true,
}) => {
  const { t } = useI18n();
  const { user, loading } = useAuth();
  const isAdmin = Boolean(user?.is_superuser);

  // User Settings State
  const [defaultModel, setDefaultModel] = useState("openrouter/free");
  const [memoryModel, setMemoryModel] = useState("openai/gpt-4o-mini");
  const [consolidationModel, setConsolidationModel] = useState("openrouter/free");
  const [imageModel, setImageModel] = useState<string | null>(null);
  const [videoModel, setVideoModel] = useState<string | null>(null);
  // 语音识别与语音合成各一个选择，各存一个字段。两者在上游是互不相交的模型族，
  // 所以不共用一个 state。
  const [sttModel, setSttModel] = useState<string | null>(null);
  const [ttsModel, setTtsModel] = useState<string | null>(null);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [temperature, setTemperature] = useState(0.7);
  const [memoryEnabled, setMemoryEnabled] = useState(true);

  // Baseline state for dirty checking & reset (Apple HIG)
  const [initialSettings, setInitialSettings] = useState<InitialSettings | null>(null);

  // Model Catalog State
  const [availableModels, setAvailableModels] = useState<ModelCatalogItem[]>([]);
  const [imageModels, setImageModels] = useState<ImageModelItem[]>([]);
  const [imageModelsSynced, setImageModelsSynced] = useState(false);
  const [loadingImageModels, setLoadingImageModels] = useState(true);
  const [syncingImageModels, setSyncingImageModels] = useState(false);
  const [videoModels, setVideoModels] = useState<VideoModelItem[]>([]);
  const [videoModelsSynced, setVideoModelsSynced] = useState(false);
  const [loadingVideoModels, setLoadingVideoModels] = useState(true);
  const [syncingVideoModels, setSyncingVideoModels] = useState(false);
  const [audioModels, setAudioModels] = useState<AudioModelItem[]>([]);
  const [audioModelsSynced, setAudioModelsSynced] = useState(false);
  const [loadingAudioModels, setLoadingAudioModels] = useState(true);
  const [syncingAudioModels, setSyncingAudioModels] = useState(false);
  const [syncingModels, setSyncingModels] = useState(false);

  const [savingSettings, setSavingSettings] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);

  // Accounts without full model access only ever see zero-cost options.
  const isTrialMode = useIsTrialMode();

  // Apple HIG Dirty Check: Has user changed any settings?
  const isDirty = useMemo(() => {
    if (!initialSettings) return false;
    return (
      defaultModel !== initialSettings.defaultModel ||
      memoryModel !== initialSettings.memoryModel ||
      consolidationModel !== initialSettings.consolidationModel ||
      imageModel !== initialSettings.imageModel ||
      videoModel !== initialSettings.videoModel ||
      sttModel !== initialSettings.sttModel ||
      ttsModel !== initialSettings.ttsModel ||
      systemPrompt !== initialSettings.systemPrompt ||
      Math.abs(temperature - initialSettings.temperature) > 0.001 ||
      memoryEnabled !== initialSettings.memoryEnabled
    );
  }, [initialSettings, defaultModel, memoryModel, consolidationModel, imageModel, videoModel, sttModel, ttsModel, systemPrompt, temperature, memoryEnabled]);

  const saveState: SaveState = { dirty: isDirty, saving: savingSettings, justSaved: saveSuccess };

  const chatOptions = useMemo(() => toChatModelOptions(availableModels), [availableModels]);

  /**
   * 记忆提炼模型的下拉项：从真实目录里筛出「便宜、快」的候选。
   * 判据与语言模型目录共用 lib/models 的免费/多模态判定，不另写一套。
   */
  const memoryModelOptions = useMemo(() => {
    const presets: { id: string; label: string }[] = [];
    for (const id of MEMORY_MODEL_PRESET_IDS) {
      const item = chatOptions.find((o) => o.id === id);
      if (item) presets.push({ id: item.id, label: `${item.name}（${item.provider}）` });
    }
    // 目录里还有免费模型时补充进来（优先取前若干个，避免下拉过长）
    const freeLabel = t("settings.picker.freeBadge");
    const extra = chatOptions
      .filter((o) => !presets.some((p) => p.id === o.id) && o.isFree)
      .slice(0, 5)
      .map((o) => ({ id: o.id, label: `${o.name}（${freeLabel} · ${o.provider}）` }));
    return [...presets, ...extra];
  }, [chatOptions, t]);

  const memoryModelIsPreset = memoryModelOptions.some((o) => o.id === memoryModel);


  const handleSyncModels = async () => {
    setSyncingModels(true);
    try {
      const res = await apiRequest<{
        success: boolean;
        new_count: number;
        new_models: ModelCatalogItem[];
        total: number;
        message: string;
      }>("/models/sync", { method: "POST" });

      const modelsRes = await apiRequest<{ models: ModelCatalogItem[] }>("/models/configured");
      if (modelsRes?.models) setAvailableModels(modelsRes.models);

      notifyModelSyncResult({
        t,
        scope: "language",
        newCount: res.new_count || 0,
        message: res.message,
      });
    } catch (err: any) {
      toast.error(err.message || t("settings.errors.syncLanguageFailed"));
    } finally {
      setSyncingModels(false);
    }
  };

  const handleSyncImageModels = async () => {
    setSyncingImageModels(true);
    try {
      const res = await apiRequest<{
        success: boolean;
        new_count: number;
        total: number;
        synced_providers: string[];
        message: string;
      }>("/models/sync-images", { method: "POST" });

      const imageRes = await apiRequest<ImageModelsResponse>("/models/image-models");
      if (imageRes?.models) setImageModels(imageRes.models);
      setImageModelsSynced(imageRes?.synced ?? true);

      notifyModelSyncResult({
        t,
        scope: "image",
        newCount: res.new_count || 0,
        message: res.message,
      });
    } catch (err: any) {
      toast.error(err.message || t("settings.errors.syncImageFailed"));
    } finally {
      setSyncingImageModels(false);
    }
  };

  const handleSyncVideoModels = async () => {
    setSyncingVideoModels(true);
    try {
      const res = await apiRequest<{
        success: boolean;
        new_count: number;
        total: number;
        synced_providers: string[];
        message: string;
      }>("/models/sync-videos", { method: "POST" });

      const videoRes = await apiRequest<VideoModelsResponse>("/models/video-models");
      if (videoRes?.models) setVideoModels(videoRes.models);
      setVideoModelsSynced(videoRes?.synced ?? true);

      notifyModelSyncResult({
        t,
        scope: "video",
        newCount: res.new_count || 0,
        message: res.message,
      });
    } catch (err: any) {
      toast.error(err.message || t("settings.errors.syncVideoFailed"));
    } finally {
      setSyncingVideoModels(false);
    }
  };

  const handleSyncAudioModels = async () => {
    setSyncingAudioModels(true);
    try {
      const res = await apiRequest<{
        success: boolean;
        new_count: number;
        total: number;
        synced_providers: string[];
        message: string;
      }>("/models/sync-audio", { method: "POST" });

      const audioRes = await apiRequest<AudioModelsResponse>("/models/audio-models");
      if (audioRes?.models) setAudioModels(audioRes.models);
      setAudioModelsSynced(audioRes?.synced ?? true);

      notifyModelSyncResult({
        t,
        scope: "speech",
        newCount: res.new_count || 0,
        message: res.message,
        // 语音目录空着就一定是哪里不对了：要么查询写错、要么凭证没生效。
        // 不加这一条的话 toast 报成功、下拉框空着，用户完全无从判断。
        emptyResult: (audioRes?.models?.length ?? 0) === 0,
      });
    } catch (err: any) {
      toast.error(err.message || t("settings.errors.syncAudioFailed"));
    } finally {
      setSyncingAudioModels(false);
    }
  };

  // 视图内部守卫（此前与 UsageView / MemoryView 逐字相同的三份之一）
  useRequireAuth();

  const fetchSettingsAndConfigs = async () => {
    setLoadingSettings(true);
    setLoadingImageModels(true);
    setLoadingVideoModels(true);
    setLoadingAudioModels(true);
    try {
      const [settingsRes, modelsRes, imageModelsRes, videoModelsRes, audioModelsRes] = await Promise.all([
        apiRequest<any>("/settings"),
        apiRequest<{ models: ModelCatalogItem[] }>("/models/configured"),
        apiRequest<ImageModelsResponse>("/models/image-models").catch(() => null),
        apiRequest<VideoModelsResponse>("/models/video-models").catch(() => null),
        apiRequest<AudioModelsResponse>("/models/audio-models").catch(() => null),
      ]);

      if (settingsRes) {
        const models = modelsRes?.models ?? [];
        let dModel = settingsRes.default_model;
        if (isTrialMode) {
          if (!dModel || !models.some((m) => m.id === dModel)) {
            dModel = models.some((m) => m.id === "openrouter/free")
              ? "openrouter/free"
              : (models[0]?.id || "openrouter/free");
          }
        } else {
          dModel = dModel || "openrouter/free";
        }
        const mModel = settingsRes.memory_model || "openai/gpt-4o-mini";
        const cModel = settingsRes.consolidation_model || "openrouter/free";
        // Mirror the chat model contract: an absent selection falls back to the
        // zero-cost default rather than staying empty.
        const freeImage =
          imageModelsRes?.models?.find((m) => m.is_free) || imageModelsRes?.models?.[0];
        let iModel: string | null = settingsRes.image_model || null;
        if (!iModel || !imageModelsRes?.models?.some((m) => m.id === iModel)) {
          iModel = freeImage?.id || iModel;
        }

        const freeVideo =
          videoModelsRes?.models?.find((m) => m.is_free) || videoModelsRes?.models?.[0];
        let vModel: string | null = settingsRes.video_model || null;
        if (!vModel || !videoModelsRes?.models?.some((m) => m.id === vModel)) {
          vModel = freeVideo?.id || vModel;
        }

        // 语音模型按 capability 分流后再回退：目录里两类模型混在一起，
        // 不分流的「取第一个」很可能把一个合成模型塞进识别下拉。
        const pickFallback = (capability: "stt" | "tts") => {
          const family = audioModelsRes?.models?.filter((m) => m.capability === capability) ?? [];
          return family.find((m) => m.is_free) || family[0];
        };
        const sttFamily = audioModelsRes?.models?.filter((m) => m.capability === "stt") ?? [];
        let sModel: string | null = settingsRes.stt_model || null;
        if (!sModel || !sttFamily.some((m) => m.id === sModel)) {
          sModel = pickFallback("stt")?.id || sModel;
        }

        const ttsFamily = audioModelsRes?.models?.filter((m) => m.capability === "tts") ?? [];
        let tModel: string | null = settingsRes.tts_model || null;
        if (!tModel || !ttsFamily.some((m) => m.id === tModel)) {
          tModel = pickFallback("tts")?.id || tModel;
        }

        const sPrompt = settingsRes.system_prompt || "";
        const temp = settingsRes.temperature ?? 0.7;
        const memEnabled = settingsRes.memory_enabled ?? true;

        setDefaultModel(dModel);
        setMemoryModel(mModel);
        setConsolidationModel(cModel);
        setImageModel(iModel);
        setVideoModel(vModel);
        setSttModel(sModel);
        setTtsModel(tModel);
        setSystemPrompt(sPrompt);
        setTemperature(temp);
        setMemoryEnabled(memEnabled);

        setInitialSettings({
          defaultModel: dModel,
          memoryModel: mModel,
          consolidationModel: cModel,
          imageModel: iModel,
          videoModel: vModel,
          sttModel: sModel,
          ttsModel: tModel,
          systemPrompt: sPrompt,
          temperature: temp,
          memoryEnabled: memEnabled,
        });
      }
      if (modelsRes?.models) setAvailableModels(modelsRes.models);
      if (imageModelsRes?.models) setImageModels(imageModelsRes.models);
      if (imageModelsRes) setImageModelsSynced(!!imageModelsRes.synced);
      if (videoModelsRes?.models) setVideoModels(videoModelsRes.models);
      if (videoModelsRes) setVideoModelsSynced(!!videoModelsRes.synced);
      if (audioModelsRes?.models) setAudioModels(audioModelsRes.models);
      if (audioModelsRes) setAudioModelsSynced(!!audioModelsRes.synced);
    } catch (err) {
      console.error("Failed to load settings:", err);
    } finally {
      setLoadingSettings(false);
      setLoadingImageModels(false);
      setLoadingVideoModels(false);
      setLoadingAudioModels(false);
    }
  };

  useEffect(() => {
    // 同 UsageView：SPA 里五个页签同时挂载，这里按 active 收口，
    // 避免桌面端打开 /chat 时把 /settings 与两份模型目录一起请求掉。
    if (isMobileSpa && !active) return;
    if (user) {
      fetchSettingsAndConfigs();
    }
  }, [user, isMobileSpa, active]);

  // 切后台 / 切回本页签时刷新，让后台改过的配置同步过来。
  // 有未保存改动时必须跳过：fetchSettingsAndConfigs 会重置表单，直接吞掉用户的输入。
  useRefreshOnResume(fetchSettingsAndConfigs, {
    enabled: !!user && !isDirty && !savingSettings,
    visible: active,
  });

  const handleResetSettings = () => {
    if (!initialSettings) return;
    setDefaultModel(initialSettings.defaultModel);
    setMemoryModel(initialSettings.memoryModel);
    setConsolidationModel(initialSettings.consolidationModel);
    setImageModel(initialSettings.imageModel);
    setVideoModel(initialSettings.videoModel);
    setSttModel(initialSettings.sttModel);
    setTtsModel(initialSettings.ttsModel);
    setSystemPrompt(initialSettings.systemPrompt);
    setTemperature(initialSettings.temperature);
    setMemoryEnabled(initialSettings.memoryEnabled);
    toast.info(t("settings.saveBar.resetDone"));
  };

  const handleSaveSettings = useCallback(
    async (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (savingSettings) return;
      setSavingSettings(true);
      setSaveSuccess(false);
      try {
        await apiRequest("/settings", {
          method: "PATCH",
          body: JSON.stringify({
            default_model: defaultModel,
            ...(user?.is_superuser
              ? {
                  memory_model: memoryModel,
                  consolidation_model: consolidationModel,
                }
              : {}),
            image_model: imageModel,
            video_model: videoModel,
            stt_model: sttModel,
            tts_model: ttsModel,
            system_prompt: systemPrompt,
            temperature,
            memory_enabled: memoryEnabled,
          }),
        });
        try {
          localStorage.setItem("apiapia_preferred_model", defaultModel);
        } catch (e) {}

        setInitialSettings({
          defaultModel,
          memoryModel,
          consolidationModel,
          imageModel,
          videoModel,
          sttModel,
          ttsModel,
          systemPrompt,
          temperature,
          memoryEnabled,
        });

        setSaveSuccess(true);
        toast.success(t("settings.saveBar.savedDone"));
        setTimeout(() => setSaveSuccess(false), 2500);
      } catch (err: any) {
        toast.error(err.message || t("settings.saveBar.saveFailed"));
      } finally {
        setSavingSettings(false);
      }
    },
    [defaultModel, memoryModel, consolidationModel, imageModel, videoModel, sttModel, ttsModel, systemPrompt, temperature, memoryEnabled, user, savingSettings, t]
  );

  // Apple Mac Shortcut: Command + S / Ctrl + S to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSaveSettings();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSaveSettings]);

  if (loading || !user) return <FullPageSkeleton variant="list" />;

  const currentModelItem = availableModels.find((m) => m.id === defaultModel);
  const currentImageItem = imageModels.find((m) => m.id === imageModel);
  const currentVideoItem = videoModels.find((m) => m.id === videoModel);
  const currentSttItem = audioModels.find((m) => m.id === sttModel);
  const currentTtsItem = audioModels.find((m) => m.id === ttsModel);
  const sttCount = audioModels.filter((m) => m.capability === "stt").length;
  const ttsCount = audioModels.filter((m) => m.capability === "tts").length;

  return (
    <ViewShell
      title={t("settings.title")}
      isMobileSpa={isMobileSpa}
      onSelectMobileTab={onSelectMobileTab}
    >
      {/* ── 桌面头部：标题 + 管理员徽章 + 保存控件 ──
          移动端不渲染：那里的保存入口是底部的 <SaveActionBar>，
          两者由断点互斥，不再同屏出现两套保存按钮。 */}
      <div className="hidden items-center justify-between gap-4 border-b border-border/40 pb-4 md:flex">
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-semibold text-foreground">{t("settings.title")}</h1>
          {user.is_superuser && (
            <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-2xs font-medium text-amber-600 shadow-none dark:text-amber-400">
              {t("settings.adminBadge")}
            </span>
          )}
        </div>
        <SaveStatus
          state={saveState}
          onReset={handleResetSettings}
          onSave={() => handleSaveSettings()}
        />
      </div>

      {loadingSettings ? (
        <SettingsFormSkeleton />
      ) : (
        <form onSubmit={handleSaveSettings} className="space-y-4 sm:space-y-5">
          {/* ── GROUP 1: 界面外观 ── */}
          <div>
            <SectionLabel>{t("settings.appearance.label")}</SectionLabel>
            <Panel className="p-2 sm:p-2.5">
              <ThemeSegments />
              {/* 界面语言与主题并排成组：两者都是「这台设备上的显示偏好」，
                  都不写服务端、不参与脏检查、不需要点保存 —— 放在一起
                  正好回答「我该去哪里改」，而不是散进别处。 */}
              <div className="mt-2 border-t border-border/60 pt-2 sm:mt-2.5 sm:pt-2.5">
                <LanguageRow />
              </div>
            </Panel>
          </div>

          {/* ── GROUP 2: 默认模型设置（语言 + 绘图 + 视频 + 语音）── */}
          <div>
            <div className="flex items-center justify-between gap-2 px-1 pb-1.5">
              <SectionLabel className="pb-0">{t("settings.modelGroup.default")}</SectionLabel>
              <div className="flex items-center gap-2">
                {isTrialMode && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-2xs font-medium normal-case tracking-normal text-emerald-600 dark:text-emerald-400">
                    <Zap className="h-2.5 w-2.5" />
                    {t("settings.modelGroup.trialBadge")}
                  </span>
                )}
                <span className="font-mono text-2xs font-normal normal-case tracking-normal text-muted-foreground">
                  {t("settings.modelGroup.counts", {
                    chat: availableModels.length,
                    image: imageModels.length,
                    video: videoModels.length,
                    speech: sttCount + ttsCount,
                  })}
                </span>
              </div>
            </div>

            <Panel className="p-3 sm:p-3.5">
              {/* 语言模型 */}
              <div className="flex items-center gap-2 px-0.5">
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
                  <Brain className="h-3.5 w-3.5" />
                </span>
                <span className="text-xs font-semibold text-foreground">
                  {t("settings.modelGroup.language")}
                </span>
                {isAdmin && (
                  <SyncModelsButton
                    onSync={handleSyncModels}
                    syncing={syncingModels}
                    scope="language"
                  />
                )}
              </div>

              <div className="mt-2">
                <ModelSelect
                  value={defaultModel}
                  onChange={setDefaultModel}
                  models={availableModels}
                  placeholder={t("settings.modelGroup.chatPlaceholder")}
                />
              </div>

              {currentModelItem ? (
                <ModelInfoPanel
                  model={currentModelItem}
                  isMultimodal={isMultimodalModel(currentModelItem)}
                  isPaid={!isFreeModel(currentModelItem)}
                  capabilityLabel={
                    isMultimodalModel(currentModelItem)
                      ? t("settings.modelGroup.capabilityVision")
                      : undefined
                  }
                />
              ) : (
                <ModelMissingNotice id={defaultModel} />
              )}

              {/* 绘图模型 */}
              <div className="mt-1 pt-4">
                <div className="flex items-center gap-2 px-0.5">
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-violet-500/25 bg-violet-500/10 text-violet-600 dark:text-violet-400">
                    <Palette className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-xs font-semibold text-foreground">
                    {t("settings.modelGroup.image")}
                  </span>
                  {isAdmin && (
                    <SyncModelsButton
                      onSync={handleSyncImageModels}
                      syncing={syncingImageModels}
                      scope="image"
                    />
                  )}
                </div>

                <div className="mt-2">
                  <ImageModelSelect
                    value={imageModel}
                    onChange={setImageModel}
                    models={imageModels}
                    loading={loadingImageModels}
                    synced={imageModelsSynced}
                    isTrialMode={isTrialMode}
                  />
                </div>

                {currentImageItem ? (
                  <ModelInfoPanel
                    model={currentImageItem}
                    isFree={currentImageItem.is_free}
                    capabilityLabel={t("settings.modelGroup.capabilityImage")}
                  />
                ) : (
                  <ModelMissingNotice id={imageModel ?? ""} />
                )}
              </div>

              {/* 视频模型 */}
              <div className="mt-1 pt-4 border-t border-border/30">
                <div className="flex items-center gap-2 px-0.5">
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-sky-500/25 bg-sky-500/10 text-sky-600 dark:text-sky-400">
                    <Video className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-xs font-semibold text-foreground">
                    {t("settings.modelGroup.video")}
                  </span>
                  {isAdmin && (
                    <SyncModelsButton
                      onSync={handleSyncVideoModels}
                      syncing={syncingVideoModels}
                      scope="video"
                    />
                  )}
                </div>

                <div className="mt-2">
                  <VideoModelSelect
                    value={videoModel}
                    onChange={setVideoModel}
                    models={videoModels}
                    loading={loadingVideoModels}
                    synced={videoModelsSynced}
                    isTrialMode={isTrialMode}
                  />
                </div>

                {currentVideoItem ? (
                  <ModelInfoPanel
                    model={currentVideoItem}
                    isFree={currentVideoItem.is_free}
                    capabilityLabel={t("settings.modelGroup.capabilityVideo")}
                  />
                ) : (
                  <ModelMissingNotice id={videoModel ?? ""} />
                )}
              </div>

              {/* 语音模型：一个同步按钮 + 两个下拉。
                  两个下拉而非一个是必须的 —— OpenRouter 的语音识别
                  (output_modalities=transcription) 与语音合成 (=speech) 是两族
                  互不相交的模型，放进同一个列表就必然有一半选项用不了。 */}
              <div className="mt-1 pt-4 border-t border-border/30">
                <div className="flex items-center gap-2 px-0.5">
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-teal-500/25 bg-teal-500/10 text-teal-600 dark:text-teal-400">
                    <AudioLines className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-xs font-semibold text-foreground">
                    {t("settings.modelGroup.speech")}
                  </span>
                  {isAdmin && (
                    <SyncModelsButton
                      onSync={handleSyncAudioModels}
                      syncing={syncingAudioModels}
                      scope="speech"
                    />
                  )}
                </div>

                <div className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <div className="min-w-0">
                    <div className="mb-1.5 px-0.5 text-2xs font-medium text-muted-foreground">
                      {t("settings.modelGroup.sttSub")}
                    </div>
                    <AudioModelSelect
                      value={sttModel}
                      onChange={setSttModel}
                      models={audioModels}
                      capability="stt"
                      kindLabel={t("settings.modelGroup.sttKind")}
                      placeholder={t("settings.modelGroup.sttPlaceholder")}
                      loading={loadingAudioModels}
                      synced={audioModelsSynced}
                      isTrialMode={isTrialMode}
                    />
                    {currentSttItem ? (
                      <ModelInfoPanel
                        model={currentSttItem}
                        isFree={currentSttItem.is_free}
                        capabilityLabel={t("settings.modelGroup.capabilityStt")}
                      />
                    ) : (
                      <ModelMissingNotice id={sttModel ?? ""} />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="mb-1.5 px-0.5 text-2xs font-medium text-muted-foreground">
                      {t("settings.modelGroup.ttsSub")}
                    </div>
                    <AudioModelSelect
                      value={ttsModel}
                      onChange={setTtsModel}
                      models={audioModels}
                      capability="tts"
                      kindLabel={t("settings.modelGroup.ttsKind")}
                      placeholder={t("settings.modelGroup.ttsPlaceholder")}
                      loading={loadingAudioModels}
                      synced={audioModelsSynced}
                      isTrialMode={isTrialMode}
                    />
                    {currentTtsItem ? (
                      <ModelInfoPanel
                        model={currentTtsItem}
                        isFree={currentTtsItem.is_free}
                        capabilityLabel={t("settings.modelGroup.capabilityTts")}
                      />
                    ) : (
                      <ModelMissingNotice id={ttsModel ?? ""} />
                    )}
                  </div>
                </div>

                {currentTtsItem?.supported_voices?.length ? (
                  <p className="mt-2 px-0.5 font-mono text-2xs leading-relaxed text-muted-foreground">
                    {t("settings.modelGroup.voiceNote", {
                      count: currentTtsItem.supported_voices.length,
                      voice: currentTtsItem.supported_voices[0],
                    })}
                  </p>
                ) : currentTtsItem ? (
                  /* 不公布音色列表的模型（Fish Audio / Seed Audio 系）：后端会省略
                     voice 字段，由 provider 用自己的默认音色。这里说清楚，免得
                     用户以为功能坏了。 */
                  <p className="mt-2 px-0.5 font-mono text-2xs leading-relaxed text-muted-foreground">
                    {t("settings.modelGroup.voiceNoteNoList")}
                  </p>
                ) : null}
              </div>
            </Panel>
          </div>

          {/* ── GROUP 3: 采样温度 ── */}
          <TemperatureControl value={temperature} onChange={setTemperature} />

          {/* ── GROUP 4: 默认提示词 ── */}
          <div>
            <SectionLabel>{t("settings.persona.groupLabel")}</SectionLabel>
            <Panel className="p-3 sm:p-4 space-y-2">
              <div className="flex items-center justify-between gap-2 px-0.5">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
                    <Sparkles className="h-3.5 w-3.5" />
                  </span>
                  <Label htmlFor="system-prompt-textarea" className="text-xs font-semibold text-foreground cursor-pointer">
                    {t("settings.persona.groupDesc")}
                  </Label>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setSystemPrompt("你是一个智能、真诚、有洞察力的个人智能助理。请根据用户提供的历史背景和长期记忆为用户提供高质量服务。")
                  }
                  className="h-6 px-2 text-2xs text-muted-foreground hover:text-foreground"
                >
                  {t("settings.persona.resetDefault")}
                </Button>
              </div>

              <Textarea
                id="system-prompt-textarea"
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={4}
                placeholder={t("settings.persona.promptPhCustom")}
                className="resize-y rounded-xl border-border/60 bg-background text-xs leading-relaxed font-sans"
              />
              <p className="px-0.5 text-2xs leading-relaxed text-muted-foreground">
                {t("settings.persona.promptHint")}
              </p>
            </Panel>
          </div>

          {/* ── GROUP 5: 长期记忆 ── */}
          <div>
            <SectionLabel>{t("settings.memoryGroup.label")}</SectionLabel>
            <Panel className="divide-y divide-border/40">
              <div className="flex items-center justify-between gap-4 p-3.5 sm:p-4">
                <Label
                  htmlFor="memory-switch"
                  className="cursor-pointer text-sm font-medium text-foreground"
                >
                  {t("settings.memoryGroup.toggle")}
                </Label>
                <Switch
                  id="memory-switch"
                  checked={memoryEnabled}
                  onCheckedChange={setMemoryEnabled}
                  aria-label={t("settings.memoryGroup.toggleAria")}
                />
              </div>

              {/* 记忆提炼与整理合并模型：仅超管可见（普通用户的字段后端不接收）*/}
              {memoryEnabled && user.is_superuser && (
                <div className="space-y-4 bg-surface-3/20 p-3.5 sm:p-4">
                  {/* 记忆提炼模型 */}
                  <div className="space-y-2.5">
                    <Label
                      htmlFor="memory-model-select"
                      className="text-xs font-medium text-muted-foreground"
                    >
                      {t("settings.memoryGroup.modelLabel")}
                    </Label>

                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      <Select
                        value={memoryModelIsPreset ? memoryModel : "custom"}
                        onValueChange={(v) => {
                          if (v !== "custom") setMemoryModel(v);
                        }}
                      >
                        <SelectTrigger
                          id="memory-model-select"
                          className="rounded-xl border-border/60 bg-background text-xs"
                        >
                          <SelectValue placeholder={t("settings.memoryGroup.modelPlaceholder")} />
                        </SelectTrigger>
                        <SelectContent collisionPadding={12} className="rounded-xl">
                          {memoryModelOptions.map((o) => (
                            <SelectItem key={o.id} value={o.id} className="rounded-lg text-xs">
                              {o.label}
                            </SelectItem>
                          ))}
                          <SelectItem value="custom" className="rounded-lg text-xs">
                            {t("settings.memoryGroup.manualModel")}
                          </SelectItem>
                        </SelectContent>
                      </Select>

                      <div>
                        <Label htmlFor="memory-model-input" className="sr-only">
                          {t("settings.memoryGroup.modelIdLabel")}
                        </Label>
                        <Input
                          id="memory-model-input"
                          type="text"
                          value={memoryModel}
                          onChange={(e) => setMemoryModel(e.target.value.trim())}
                          placeholder={t("settings.memoryGroup.modelIdPlaceholder")}
                          className="rounded-xl border-border/60 bg-background font-mono text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 记忆整理合并模型 */}
                  <div className="space-y-2.5 pt-3 border-t border-border/40">
                    <Label className="text-xs font-medium text-muted-foreground">
                      {t("settings.memoryGroup.consolidationModelLabel")}
                    </Label>

                    <ModelSelect
                      value={consolidationModel}
                      onChange={setConsolidationModel}
                      models={availableModels}
                      placeholder={t("settings.memoryGroup.consolidationModelPlaceholder")}
                    />

                    {/* 推荐整理模型说明卡片列表 */}
                    <div className="mt-2 space-y-1.5 rounded-xl border border-border/40 bg-surface-2/40 p-3">
                      <div className="flex items-center gap-1.5 px-0.5 text-2xs font-semibold text-foreground">
                        <Sparkles className="h-3 w-3 text-primary" />
                        <span>推荐整理模型及选用理由（点击卡片可快速选用）：</span>
                      </div>
                      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 pt-1">
                        {RECOMMENDED_CONSOLIDATION_MODELS.map((item) => {
                          const isSelected = consolidationModel === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setConsolidationModel(item.id)}
                              className={cn(
                                "flex flex-col gap-1 p-2.5 rounded-lg border text-left transition-all cursor-pointer",
                                isSelected
                                  ? "border-primary/50 bg-primary/10 shadow-xs ring-1 ring-primary/30"
                                  : "border-border/40 bg-background/60 hover:bg-surface-3/80 hover:border-border/70"
                              )}
                            >
                              <div className="flex items-center justify-between gap-1.5 flex-wrap">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span
                                    className={cn(
                                      "text-[10px] font-medium px-1.5 py-0.2 rounded font-sans shrink-0",
                                      item.isFree
                                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                        : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                                    )}
                                  >
                                    {item.tag}
                                  </span>
                                  <span className="font-semibold text-xs text-foreground truncate">
                                    {item.name}
                                  </span>
                                </div>
                                {isSelected && (
                                  <span className="text-[10px] font-medium text-primary shrink-0">
                                    当前选用
                                  </span>
                                )}
                              </div>
                              <span className="font-mono text-2xs text-muted-foreground truncate">
                                {item.id}
                              </span>
                              <p className="text-2xs text-muted-foreground leading-relaxed mt-0.5">
                                {item.desc}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </Panel>
          </div>

          {/* ── GROUP 6: 关于系统与版本 ── */}
          <div>
            <SectionLabel>{t("settings.about.label")}</SectionLabel>
            <Panel className="divide-y divide-border/40">
              <div className="flex items-center justify-between gap-3 p-3.5 sm:p-4">
                <div className="flex items-center gap-3">
                  <BrandLogo size={36} className="shadow-2xs" />
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {t("settings.about.product")}
                    </span>
                    <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 font-mono text-2xs font-medium text-emerald-600 dark:text-emerald-400">
                      {t("settings.about.versionValue", { version: CURRENT_VERSION })}
                    </span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={triggerManualUpdateCheck}
                  className="h-7 shrink-0 cursor-pointer gap-1.5 rounded-full border-border/50 bg-surface-3/30 px-3 text-xs font-medium text-foreground transition-colors hover:bg-surface-3 active:scale-95"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>{t("settings.about.checkUpdate")}</span>
                </Button>
              </div>

              <dl className="divide-y divide-border/40">
                {ABOUT_ROWS.map((row) => (
                  <div
                    key={row.labelKey}
                    className="flex items-center justify-between px-4 py-2.5 text-footnote sm:px-5"
                  >
                    <dt className="text-muted-foreground">{t(row.labelKey)}</dt>
                    <dd className="font-medium text-foreground">{t(row.valueKey, row.values)}</dd>
                  </div>
                ))}
                <div className="flex items-center justify-between px-4 py-2.5 text-footnote sm:px-5">
                  <dt className="text-muted-foreground">{t("settings.about.policyLabel")}</dt>
                  <dd className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <span>{t("settings.about.policyValue")}</span>
                  </dd>
                </div>
              </dl>
            </Panel>
          </div>

          {/* 移动端没有头部保存控件时，表单内留一个提交入口，
              保证「回车提交表单」与可见按钮行为一致。 */}
          <div className="flex justify-end md:hidden">
            <Button
              type="submit"
              size="sm"
              disabled={savingSettings || !isDirty}
              className="h-9 cursor-pointer rounded-full px-5 text-xs font-semibold"
            >
              {savingSettings ? t("settings.saveBar.savingLong") : t("settings.saveBar.save")}
            </Button>
          </div>
        </form>
      )}

      {/* 浮动保存条：仅 < md（与桌面头部的 SaveStatus 由断点互斥）*/}
      <SaveActionBar
        state={saveState}
        onReset={handleResetSettings}
        onSave={() => handleSaveSettings()}
      />
    </ViewShell>
  );
};
