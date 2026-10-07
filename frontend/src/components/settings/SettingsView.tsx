"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";
import { ViewShell } from "@/components/common/ViewShell";
import { ModelCatalogItem, ImageModelItem, ImageModelsResponse } from "@/types";
import { ModelSelect } from "@/components/common/ModelSelect";
import { isFreeModel, isMultimodalModel, toChatModelOptions } from "@/lib/models";
import { CURRENT_VERSION, triggerManualUpdateCheck } from "@/lib/version";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ThemeSegments } from "@/components/common/ThemeSegments";
import { BrandLogo } from "@/components/common/BrandLogo";
import { ImageModelSelect } from "@/components/settings/ImageModelSelect";
import {
  ModelInfoPanel,
  ModelMissingNotice,
  SyncModelsButton,
} from "@/components/settings/ModelControls";
import {
  PersonaPicker,
  TemperatureControl,
  matchPersonaId,
  type PersonaId,
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
import { RefreshCw, Zap, Brain, Palette } from "lucide-react";
import { toast } from "sonner";

interface InitialSettings {
  defaultModel: string;
  memoryModel: string;
  imageModel: string | null;
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

export const SettingsView: React.FC<SettingsViewProps> = ({
  isMobileSpa = false,
  onSelectMobileTab,
  active = true,
}) => {
  const { user, loading } = useAuth();

  // User Settings State
  const [defaultModel, setDefaultModel] = useState("openrouter/free");
  const [memoryModel, setMemoryModel] = useState("openai/gpt-4o-mini");
  const [imageModel, setImageModel] = useState<string | null>(null);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [personaId, setPersonaId] = useState<PersonaId>("default");
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
      imageModel !== initialSettings.imageModel ||
      systemPrompt !== initialSettings.systemPrompt ||
      Math.abs(temperature - initialSettings.temperature) > 0.001 ||
      memoryEnabled !== initialSettings.memoryEnabled
    );
  }, [initialSettings, defaultModel, memoryModel, imageModel, systemPrompt, temperature, memoryEnabled]);

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
    const extra = chatOptions
      .filter((o) => !presets.some((p) => p.id === o.id) && o.isFree)
      .slice(0, 5)
      .map((o) => ({ id: o.id, label: `${o.name}（免费 · ${o.provider}）` }));
    return [...presets, ...extra];
  }, [chatOptions]);

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
        scope: "语言模型",
        newCount: res.new_count || 0,
        message: res.message,
      });
    } catch (err: any) {
      toast.error(err.message || "同步语言模型失败，请检查后台 .env 是否配置了有效 API 密钥");
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
        scope: "绘图模型",
        newCount: res.new_count || 0,
        message: res.message,
      });
    } catch (err: any) {
      toast.error(err.message || "同步绘图模型失败，请检查后台 .env 是否配置了有效的生图服务密钥");
    } finally {
      setSyncingImageModels(false);
    }
  };

  // 视图内部守卫（此前与 UsageView / MemoryView 逐字相同的三份之一）
  useRequireAuth();

  const fetchSettingsAndConfigs = async () => {
    setLoadingSettings(true);
    setLoadingImageModels(true);
    try {
      const [settingsRes, modelsRes, imageModelsRes] = await Promise.all([
        apiRequest<any>("/settings"),
        apiRequest<{ models: ModelCatalogItem[] }>("/models/configured"),
        apiRequest<ImageModelsResponse>("/models/image-models").catch(() => null),
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
        // Mirror the chat model contract: an absent selection falls back to the
        // zero-cost default rather than staying empty.
        const freeImage =
          imageModelsRes?.models?.find((m) => m.is_free) || imageModelsRes?.models?.[0];
        let iModel: string | null = settingsRes.image_model || null;
        if (!iModel || !imageModelsRes?.models?.some((m) => m.id === iModel)) {
          iModel = freeImage?.id || iModel;
        }
        const sPrompt = settingsRes.system_prompt || "";
        const temp = settingsRes.temperature ?? 0.7;
        const memEnabled = settingsRes.memory_enabled ?? true;

        setDefaultModel(dModel);
        setMemoryModel(mModel);
        setImageModel(iModel);
        setSystemPrompt(sPrompt);
        setPersonaId(matchPersonaId(sPrompt));
        setTemperature(temp);
        setMemoryEnabled(memEnabled);

        setInitialSettings({
          defaultModel: dModel,
          memoryModel: mModel,
          imageModel: iModel,
          systemPrompt: sPrompt,
          temperature: temp,
          memoryEnabled: memEnabled,
        });
      }
      if (modelsRes?.models) setAvailableModels(modelsRes.models);
      if (imageModelsRes?.models) setImageModels(imageModelsRes.models);
      if (imageModelsRes) setImageModelsSynced(!!imageModelsRes.synced);
    } catch (err) {
      console.error("Failed to load settings:", err);
    } finally {
      setLoadingSettings(false);
      setLoadingImageModels(false);
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
    setImageModel(initialSettings.imageModel);
    setSystemPrompt(initialSettings.systemPrompt);
    setPersonaId(matchPersonaId(initialSettings.systemPrompt));
    setTemperature(initialSettings.temperature);
    setMemoryEnabled(initialSettings.memoryEnabled);
    toast.info("已还原至上次保存的配置");
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
            ...(user?.is_superuser ? { memory_model: memoryModel } : {}),
            image_model: imageModel,
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
          imageModel,
          systemPrompt,
          temperature,
          memoryEnabled,
        });

        setSaveSuccess(true);
        toast.success("偏好设置已成功保存");
        setTimeout(() => setSaveSuccess(false), 2500);
      } catch (err: any) {
        toast.error(err.message || "保存设置失败");
      } finally {
        setSavingSettings(false);
      }
    },
    [defaultModel, memoryModel, imageModel, systemPrompt, temperature, memoryEnabled, user, savingSettings]
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

  return (
    <ViewShell
      title="偏好设置"
      isMobileSpa={isMobileSpa}
      onSelectMobileTab={onSelectMobileTab}
    >
      {/* ── 桌面头部：标题 + 管理员徽章 + 保存控件 ──
          移动端不渲染：那里的保存入口是底部的 <SaveActionBar>，
          两者由断点互斥，不再同屏出现两套保存按钮。 */}
      <div className="hidden items-center justify-between gap-4 border-b border-border/40 pb-4 md:flex">
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">偏好设置</h1>
          {user.is_superuser && (
            <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 shadow-none dark:text-amber-400">
              管理员
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
            <SectionLabel>界面外观</SectionLabel>
            <Panel className="p-2 sm:p-2.5">
              <ThemeSegments />
            </Panel>
          </div>

          {/* ── GROUP 2: 默认模型设置（语言 + 绘图）── */}
          <div>
            <div className="flex items-center justify-between gap-2 px-1 pb-1.5">
              <SectionLabel className="pb-0">默认模型设置</SectionLabel>
              <div className="flex items-center gap-2">
                {isTrialMode && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal text-emerald-600 dark:text-emerald-400">
                    <Zap className="h-2.5 w-2.5" />
                    体验模式 · 仅免费
                  </span>
                )}
                <span className="font-mono text-[11px] font-normal normal-case tracking-normal text-muted-foreground">
                  {availableModels.length} 语言 · {imageModels.length} 绘图
                </span>
              </div>
            </div>

            <Panel className="p-3 sm:p-3.5">
              {/* 语言模型 */}
              <div className="flex items-center gap-2 px-0.5">
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
                  <Brain className="h-3.5 w-3.5" />
                </span>
                <span className="text-[12px] font-semibold tracking-tight text-foreground">
                  语言模型
                </span>
                <SyncModelsButton
                  onSync={handleSyncModels}
                  syncing={syncingModels}
                  scope="语言模型"
                />
              </div>

              <div className="mt-2">
                <ModelSelect
                  value={defaultModel}
                  onChange={setDefaultModel}
                  models={availableModels}
                  placeholder="选择会话初始模型"
                />
              </div>

              {currentModelItem ? (
                <ModelInfoPanel
                  model={currentModelItem}
                  isMultimodal={isMultimodalModel(currentModelItem)}
                  isPaid={!isFreeModel(currentModelItem)}
                  capabilityLabel={
                    isMultimodalModel(currentModelItem) ? "支持图文视觉" : undefined
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
                  <span className="text-[12px] font-semibold tracking-tight text-foreground">
                    绘图模型
                  </span>
                  <SyncModelsButton
                    onSync={handleSyncImageModels}
                    syncing={syncingImageModels}
                    scope="绘图模型"
                  />
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
                    capabilityLabel="位图生成"
                  />
                ) : (
                  <ModelMissingNotice id={imageModel ?? ""} />
                )}
              </div>
            </Panel>
          </div>

          {/* ── GROUP 3: 系统人设 ── */}
          <PersonaPicker
            personaId={personaId}
            systemPrompt={systemPrompt}
            onPromptChange={(text) => {
              setSystemPrompt(text);
              setPersonaId(matchPersonaId(text));
            }}
          />

          {/* ── GROUP 4: 采样温度 ── */}
          <TemperatureControl value={temperature} onChange={setTemperature} />

          {/* ── GROUP 5: 长期记忆 ── */}
          <div>
            <SectionLabel>记忆系统</SectionLabel>
            <Panel className="divide-y divide-border/40">
              <div className="flex items-center justify-between gap-4 p-3.5 sm:p-4">
                <Label
                  htmlFor="memory-switch"
                  className="cursor-pointer text-[14px] font-medium tracking-tight text-foreground"
                >
                  自动提取与上下文检索
                </Label>
                <Switch
                  id="memory-switch"
                  checked={memoryEnabled}
                  onCheckedChange={setMemoryEnabled}
                  aria-label="长期记忆开关"
                />
              </div>

              {/* 记忆提炼模型：仅超管可见（普通用户的字段后端不接收）*/}
              {memoryEnabled && user.is_superuser && (
                <div className="space-y-2.5 bg-surface-3/20 p-3.5 sm:p-4">
                  <Label
                    htmlFor="memory-model-select"
                    className="text-[12px] font-medium text-muted-foreground"
                  >
                    提取模型 (Memory LLM)
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
                        <SelectValue placeholder="选择记忆提炼模型" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {memoryModelOptions.map((o) => (
                          <SelectItem key={o.id} value={o.id} className="rounded-lg text-xs">
                            {o.label}
                          </SelectItem>
                        ))}
                        <SelectItem value="custom" className="rounded-lg text-xs">
                          ✍️ 手动输入其它模型 ID...
                        </SelectItem>
                      </SelectContent>
                    </Select>

                    <div>
                      <Label htmlFor="memory-model-input" className="sr-only">
                        记忆提炼模型 ID
                      </Label>
                      <Input
                        id="memory-model-input"
                        type="text"
                        value={memoryModel}
                        onChange={(e) => setMemoryModel(e.target.value.trim())}
                        placeholder="例如: openai/gpt-4o-mini"
                        className="rounded-xl border-border/60 bg-background font-mono text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}
            </Panel>
          </div>

          {/* ── GROUP 6: 关于系统与版本 ── */}
          <div>
            <SectionLabel>关于系统</SectionLabel>
            <Panel className="divide-y divide-border/40">
              <div className="flex items-center justify-between gap-3 p-3.5 sm:p-4">
                <div className="flex items-center gap-3">
                  <BrandLogo size={36} className="shadow-2xs" />
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-semibold text-foreground">Apiapia</span>
                    <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                      v{CURRENT_VERSION}
                    </span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={triggerManualUpdateCheck}
                  className="h-7 shrink-0 cursor-pointer gap-1.5 rounded-full border-border/50 bg-surface-3/30 px-3 text-[12px] font-medium text-foreground transition-colors hover:bg-surface-3 active:scale-95"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>检查更新</span>
                </Button>
              </div>

              <dl className="divide-y divide-border/40">
                {[
                  ["软件版本", `v${CURRENT_VERSION}`],
                  ["客户端架构", "Next.js 14 · React 18"],
                  ["记忆检索引擎", "PostgreSQL · pgvector"],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between px-4 py-2.5 text-[13px] sm:px-5"
                  >
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="font-medium text-foreground">{value}</dd>
                  </div>
                ))}
                <div className="flex items-center justify-between px-4 py-2.5 text-[13px] sm:px-5">
                  <dt className="text-muted-foreground">更新策略</dt>
                  <dd className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <span>自动在线校验</span>
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
              {savingSettings ? "正在保存..." : "保存设置"}
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
