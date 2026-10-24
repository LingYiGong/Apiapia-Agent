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
import {
  ImageModelSelect,
  VideoModelSelect,
  AudioModelSelect,
} from "@/components/common/ModelSelect";
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
import { RefreshCw, Zap, Brain, Palette, Video, AudioLines, Sparkles, User, Sliders } from "lucide-react";
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
  customInstructionsAboutUser: string;
  customInstructionsResponseStyle: string;
}

export interface SettingsViewProps {
  isMobileSpa?: boolean;
  onSelectMobileTab?: (tab: MobileTab) => void;
  /** 移动端 SPA 里该页签当前是否可见；用于切回时补一次刷新 */
  active?: boolean;
}

/** 「记忆提炼模型」的预设候选项。 */
const MEMORY_MODEL_PRESET_IDS = [
  "openai/gpt-4o-mini",
  "deepseek/deepseek-chat",
  "anthropic/claude-3-5-haiku",
  "google/gemini-2.5-flash",
];

interface RecommendedConsolidationModel {
  id: string;
  name: string;
  tagKey: MessageKey;
  isFree: boolean;
  descKey: MessageKey;
}

const RECOMMENDED_CONSOLIDATION_MODELS: RecommendedConsolidationModel[] = [
  {
    id: "google/gemma-4-31b-it:free",
    name: "Google Gemma 4 31B (Free)",
    tagKey: "settings.memoryGroup.consolidationPresets.tagFreeRecommended",
    isFree: true,
    descKey: "settings.memoryGroup.consolidationPresets.descGemma4",
  },
  {
    id: "nvidia/nemotron-3-super-120b-a12b:free",
    name: "NVIDIA Nemotron 3 Super (Free)",
    tagKey: "settings.memoryGroup.consolidationPresets.tagFree",
    isFree: true,
    descKey: "settings.memoryGroup.consolidationPresets.descNemotronSuper",
  },
  {
    id: "deepseek/deepseek-v4.1-flash",
    name: "DeepSeek V4.1 Flash",
    tagKey: "settings.memoryGroup.consolidationPresets.tagBestValue",
    isFree: false,
    descKey: "settings.memoryGroup.consolidationPresets.descDeepseekFlash",
  },
  {
    id: "anthropic/claude-sonnet-5.5",
    name: "Claude Sonnet 5.5",
    tagKey: "settings.memoryGroup.consolidationPresets.tagHighestAccuracy",
    isFree: false,
    descKey: "settings.memoryGroup.consolidationPresets.descSonnet55",
  },
  {
    id: "openai/gpt-6-luna",
    name: "GPT-6 Luna",
    tagKey: "settings.memoryGroup.consolidationPresets.tagFastStable",
    isFree: false,
    descKey: "settings.memoryGroup.consolidationPresets.descGpt6Luna",
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

  const [defaultModel, setDefaultModel] = useState<string>("");
  const [memoryModel, setMemoryModel] = useState("openai/gpt-4o-mini");
  const [consolidationModel, setConsolidationModel] = useState("google/gemma-4-31b-it:free");
  const [imageModel, setImageModel] = useState<string | null>(null);
  const [videoModel, setVideoModel] = useState<string | null>(null);
  const [sttModel, setSttModel] = useState<string | null>(null);
  const [ttsModel, setTtsModel] = useState<string | null>(null);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [customInstructionsAboutUser, setCustomInstructionsAboutUser] = useState("");
  const [customInstructionsResponseStyle, setCustomInstructionsResponseStyle] = useState("");
  const [temperature, setTemperature] = useState(0.7);
  const [memoryEnabled, setMemoryEnabled] = useState(true);

  const [initialSettings, setInitialSettings] = useState<InitialSettings | null>(null);

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

  const isTrialMode = useIsTrialMode();

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
      customInstructionsAboutUser !== initialSettings.customInstructionsAboutUser ||
      customInstructionsResponseStyle !== initialSettings.customInstructionsResponseStyle ||
      Math.abs(temperature - initialSettings.temperature) > 0.001 ||
      memoryEnabled !== initialSettings.memoryEnabled
    );
  }, [initialSettings, defaultModel, memoryModel, consolidationModel, imageModel, videoModel, sttModel, ttsModel, systemPrompt, customInstructionsAboutUser, customInstructionsResponseStyle, temperature, memoryEnabled]);

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
        emptyResult: (audioRes?.models?.length ?? 0) === 0,
      });
    } catch (err: any) {
      toast.error(err.message || t("settings.errors.syncAudioFailed"));
    } finally {
      setSyncingAudioModels(false);
    }
  };

  useRequireAuth();

  const fetchSettingsAndConfigs = async () => {
    setLoadingSettings(true);
    setLoadingImageModels(true);
    setLoadingVideoModels(true);
    setLoadingAudioModels(true);
    try {
      const [settingsRes, modelsRes, imageModelsRes, videoModelsRes, audioModelsRes] = await Promise.all([
        apiRequest<any>("/settings"),
        apiRequest<{ models: ModelCatalogItem[]; default_model?: string }>("/models/configured"),
        apiRequest<ImageModelsResponse>("/models/image-models").catch(() => null),
        apiRequest<VideoModelsResponse>("/models/video-models").catch(() => null),
        apiRequest<AudioModelsResponse>("/models/audio-models").catch(() => null),
      ]);

      if (settingsRes) {
        const models = modelsRes?.models ?? [];
        const systemDefault =
          (modelsRes as any)?.default_model ||
          models.find((m) => m.is_default)?.id ||
          models[0]?.id ||
          "";
        let dModel = settingsRes.default_model;
        if (!dModel || !models.some((m) => m.id === dModel)) {
          dModel = systemDefault;
        }
        const mModel = settingsRes.memory_model || "openai/gpt-4o-mini";
        const cModel =
          settingsRes.consolidation_model && settingsRes.consolidation_model !== "openrouter/free"
            ? settingsRes.consolidation_model
            : "google/gemma-4-31b-it:free";
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
        const aboutUser = settingsRes.custom_instructions_about_user || "";
        const responseStyle = settingsRes.custom_instructions_response_style || "";
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
        setCustomInstructionsAboutUser(aboutUser);
        setCustomInstructionsResponseStyle(responseStyle);
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
          customInstructionsAboutUser: aboutUser,
          customInstructionsResponseStyle: responseStyle,
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
    setCustomInstructionsAboutUser(initialSettings.customInstructionsAboutUser);
    setCustomInstructionsResponseStyle(initialSettings.customInstructionsResponseStyle);
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
            custom_instructions_about_user: customInstructionsAboutUser,
            custom_instructions_response_style: customInstructionsResponseStyle,
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
          customInstructionsAboutUser,
          customInstructionsResponseStyle,
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
    [defaultModel, memoryModel, consolidationModel, imageModel, videoModel, sttModel, ttsModel, systemPrompt, customInstructionsAboutUser, customInstructionsResponseStyle, temperature, memoryEnabled, user, savingSettings, t]
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
            <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-600 shadow-none dark:text-amber-400">
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
              <div className="mt-2 border-t border-border/60 pt-2 sm:mt-2.5 sm:pt-2.5">
                <LanguageRow />
              </div>
            </Panel>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 px-1 pb-1.5">
              <SectionLabel className="pb-0">{t("settings.modelGroup.default")}</SectionLabel>
              <div className="flex items-center gap-2">
                {isTrialMode && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium normal-case tracking-normal text-emerald-600 dark:text-emerald-400">
                    <Zap className="h-3 w-3" />
                    {t("settings.modelGroup.trialBadge")}
                  </span>
                )}
                <span className="font-mono text-xs font-normal normal-case tracking-normal text-muted-foreground">
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

              <div className="mt-1 pt-4 border-t border-border/30">
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
                    <div className="mb-1.5 px-0.5 text-xs font-medium text-muted-foreground">
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
                    <div className="mb-1.5 px-0.5 text-xs font-medium text-muted-foreground">
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
                  <p className="mt-2 px-0.5 font-mono text-xs leading-relaxed text-muted-foreground">
                    {t("settings.modelGroup.voiceNote", {
                      count: currentTtsItem.supported_voices.length,
                      voice: currentTtsItem.supported_voices[0],
                    })}
                  </p>
                ) : currentTtsItem ? (
                  <p className="mt-2 px-0.5 font-mono text-xs leading-relaxed text-muted-foreground">
                    {t("settings.modelGroup.voiceNoteNoList")}
                  </p>
                ) : null}
              </div>
            </Panel>
          </div>

          <TemperatureControl value={temperature} onChange={setTemperature} />

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
                    setSystemPrompt(t("settings.persona.defaultPromptValue"))
                  }
                  className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
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
                className="resize-y rounded-xl border-border/60 bg-background text-xs sm:text-sm leading-relaxed font-sans"
              />
              <p className="px-0.5 text-xs leading-relaxed text-muted-foreground">
                {t("settings.persona.promptHint")}
              </p>
            </Panel>
          </div>

          <div>
            <SectionLabel>{t("settings.customInstructions.groupLabel")}</SectionLabel>
            <Panel className="p-3 sm:p-4 space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-0.5">
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
                    <User className="h-3.5 w-3.5" />
                  </span>
                  <Label htmlFor="custom-instructions-user" className="text-xs font-semibold text-foreground cursor-pointer">
                    {t("settings.customInstructions.aboutUserLabel")}
                  </Label>
                </div>
                <p className="px-0.5 text-xs leading-relaxed text-muted-foreground">
                  {t("settings.customInstructions.aboutUserDesc")}
                </p>
                <Textarea
                  id="custom-instructions-user"
                  value={customInstructionsAboutUser}
                  onChange={(e) => setCustomInstructionsAboutUser(e.target.value)}
                  rows={3}
                  placeholder={t("settings.customInstructions.aboutUserPlaceholder")}
                  className="resize-y rounded-xl border-border/60 bg-background text-xs sm:text-sm leading-relaxed font-sans"
                />
              </div>

              <div className="space-y-2 pt-3 border-t border-border/40">
                <div className="flex items-center gap-2 px-0.5">
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
                    <Sliders className="h-3.5 w-3.5" />
                  </span>
                  <Label htmlFor="custom-instructions-style" className="text-xs font-semibold text-foreground cursor-pointer">
                    {t("settings.customInstructions.responseStyleLabel")}
                  </Label>
                </div>
                <p className="px-0.5 text-xs leading-relaxed text-muted-foreground">
                  {t("settings.customInstructions.responseStyleDesc")}
                </p>
                <Textarea
                  id="custom-instructions-style"
                  value={customInstructionsResponseStyle}
                  onChange={(e) => setCustomInstructionsResponseStyle(e.target.value)}
                  rows={3}
                  placeholder={t("settings.customInstructions.responseStylePlaceholder")}
                  className="resize-y rounded-xl border-border/60 bg-background text-xs sm:text-sm leading-relaxed font-sans"
                />
              </div>
            </Panel>
          </div>

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

              {memoryEnabled && user.is_superuser && (
                <div className="space-y-4 bg-surface-3/20 p-3.5 sm:p-4">
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

                    <div className="mt-2 space-y-1.5 rounded-xl border border-border/40 bg-surface-2/40 p-3">
                      <div className="flex items-center gap-1.5 px-0.5 text-xs font-semibold text-foreground">
                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                        <span>{t("settings.memoryGroup.consolidationGuideTitle")}</span>
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
                                      "text-xs font-medium px-1.5 py-0.5 rounded font-sans shrink-0",
                                      item.isFree
                                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                        : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                                    )}
                                  >
                                    {t(item.tagKey)}
                                  </span>
                                  <span className="font-semibold text-xs text-foreground truncate">
                                    {item.name}
                                  </span>
                                </div>
                                {isSelected && (
                                  <span className="text-xs font-medium text-primary shrink-0">
                                    {t("settings.memoryGroup.consolidationCurrentSelected")}
                                  </span>
                                )}
                              </div>
                              <span className="font-mono text-xs text-muted-foreground truncate">
                                {item.id}
                              </span>
                              <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                                {t(item.descKey)}
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
                    <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 font-mono text-xs font-medium text-emerald-600 dark:text-emerald-400">
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
        </form>
      )}

      <SaveActionBar
        state={saveState}
        onReset={handleResetSettings}
        onSave={() => handleSaveSettings()}
      />
    </ViewShell>
  );
};
