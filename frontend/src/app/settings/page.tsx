"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";
import { Navbar } from "@/components/layout/Navbar";
import { ModelCatalogItem, ModelConfig } from "@/types";
import { useTheme } from "@/lib/theme";
import { ModelSelect } from "@/components/common/ModelSelect";
import { Settings, Save, ShieldCheck, Key, Plus, Trash2, Cpu, Globe, Search, Sparkles, X, Sun, Moon, Monitor } from "lucide-react";

export default function SettingsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  // User Settings State
  const [defaultModel, setDefaultModel] = useState("gpt-4o-mini");
  const [memoryModel, setMemoryModel] = useState("openai/gpt-4o-mini");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [temperature, setTemperature] = useState(0.7);
  const [memoryEnabled, setMemoryEnabled] = useState(true);

  // Model Configs State
  const [availableModels, setAvailableModels] = useState<ModelCatalogItem[]>([]);
  const [customConfigs, setCustomConfigs] = useState<ModelConfig[]>([]);

  // Add Model Config Modal State
  const [showAddConfig, setShowAddConfig] = useState(false);
  const [newProvider, setNewProvider] = useState("openai");
  const [newModel, setNewModel] = useState("gpt-4o");
  const [newApiKey, setNewApiKey] = useState("");
  const [newBaseUrl, setNewBaseUrl] = useState("");

  // OpenRouter live models browser
  const [showOpenRouterModal, setShowOpenRouterModal] = useState(false);
  const [openRouterModels, setOpenRouterModels] = useState<any[]>([]);
  const [orSearch, setOrSearch] = useState("");
  const [loadingOrModels, setLoadingOrModels] = useState(false);

  const [savingSettings, setSavingSettings] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const fetchOpenRouterModels = async (query = "") => {
    setLoadingOrModels(true);
    try {
      const res = await apiRequest<any[]>(`/models/openrouter?q=${encodeURIComponent(query)}`);
      setOpenRouterModels(res || []);
    } catch (err) {
      console.error("Failed to fetch openrouter models:", err);
    } finally {
      setLoadingOrModels(false);
    }
  };

  const handleSelectFromOpenRouter = (item: any) => {
    setNewProvider("openrouter");
    setNewModel(item.id);
    setNewBaseUrl("https://openrouter.ai/api/v1");
    setShowOpenRouterModal(false);
    setShowAddConfig(true);
  };

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  const fetchSettingsAndConfigs = async () => {
    try {
      const [settingsRes, modelsRes, configsRes] = await Promise.all([
        apiRequest<any>("/settings"),
        apiRequest<{ models: ModelCatalogItem[] }>("/models/configured"),
        apiRequest<ModelConfig[]>("/models"),
      ]);

      if (settingsRes) {
        setDefaultModel(settingsRes.default_model || "gpt-4o-mini");
        setMemoryModel(settingsRes.memory_model || "openai/gpt-4o-mini");
        setSystemPrompt(settingsRes.system_prompt || "");
        setTemperature(settingsRes.temperature ?? 0.7);
        setMemoryEnabled(settingsRes.memory_enabled ?? true);
      }
      if (modelsRes?.models) setAvailableModels(modelsRes.models);
      if (configsRes) setCustomConfigs(configsRes);
    } catch (err) {
      console.error("Failed to load settings:", err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchSettingsAndConfigs();
    }
  }, [user]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSaveSuccess(false);
    try {
      await apiRequest("/settings", {
        method: "PATCH",
        body: JSON.stringify({
          default_model: defaultModel,
          memory_model: memoryModel,
          system_prompt: systemPrompt,
          temperature,
          memory_enabled: memoryEnabled,
        }),
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      alert(err.message || "保存设置失败");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleAddCustomModel = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest("/models", {
        method: "POST",
        body: JSON.stringify({
          provider: newProvider,
          model: newModel,
          api_key: newApiKey.trim() || undefined,
          base_url: newBaseUrl.trim() || undefined,
          enabled: true,
        }),
      });
      setShowAddConfig(false);
      setNewApiKey("");
      setNewBaseUrl("");
      const configs = await apiRequest<ModelConfig[]>("/models");
      setCustomConfigs(configs);
    } catch (err: any) {
      alert(err.message || "添加自定义模型配置失败");
    }
  };

  const handleDeleteConfig = async (id: string) => {
    if (!confirm("确定要删除该模型配置吗？")) return;
    try {
      await apiRequest(`/models/${id}`, { method: "DELETE" });
      setCustomConfigs((prev) => prev.filter((c) => c.id !== id));
    } catch (err: any) {
      alert(err.message || "删除配置失败");
    }
  };

  if (loading || !user) return null;

  return (
    <div className="flex flex-col min-h-dvh bg-slate-50 dark:bg-slate-950 transition-colors">
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 md:p-8 space-y-6 sm:space-y-8 pb-24 md:pb-8">
        <div className="flex items-center justify-between pb-6 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-semibold mb-1">
              <Settings className="h-5 w-5" />
              <span>系统与模型设置</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">偏好配置</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              控制界面外观模式、默认提示词、温度、长期记忆开关以及专属 API Key。
            </p>
          </div>
        </div>

        {/* General Settings Form */}
        <form onSubmit={handleSaveSettings} className="space-y-6">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-6 space-y-6 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">全局通用设置</h2>

            {/* Theme Appearance Setting */}
            <div className="space-y-3 pb-5 border-b border-slate-200 dark:border-slate-800">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  界面外观与主题 (Theme Appearance)
                </label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  支持白天模式、夜间模式或跟随操作系统自动切换。
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setTheme("system")}
                  className={`flex flex-col items-center justify-center gap-2 p-3.5 rounded-xl border text-xs font-medium transition-all ${
                    theme === "system"
                      ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 shadow-sm ring-1 ring-indigo-600"
                      : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                >
                  <Monitor className="h-5 w-5" />
                  <span>💻 跟随系统</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTheme("light")}
                  className={`flex flex-col items-center justify-center gap-2 p-3.5 rounded-xl border text-xs font-medium transition-all ${
                    theme === "light"
                      ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 shadow-sm ring-1 ring-indigo-600"
                      : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                >
                  <Sun className="h-5 w-5 text-amber-500" />
                  <span>☀️ 浅色 (白天)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTheme("dark")}
                  className={`flex flex-col items-center justify-center gap-2 p-3.5 rounded-xl border text-xs font-medium transition-all ${
                    theme === "dark"
                      ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 shadow-sm ring-1 ring-indigo-600"
                      : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                >
                  <Moon className="h-5 w-5 text-indigo-400" />
                  <span>🌙 深色 (夜间)</span>
                </button>
              </div>
            </div>

            {/* Default Model */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                默认大模型 (Default Model)
              </label>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                新对话启动时默认使用的大模型，支持实时搜索与免费模型置顶展示。
              </p>
              <ModelSelect
                value={defaultModel}
                onChange={(mId) => setDefaultModel(mId)}
                models={availableModels}
                placeholder="请选择默认大模型"
              />
            </div>

            {/* System Prompt */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                系统人设 Prompt (System Prompt)
              </label>
              <textarea
                rows={4}
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="设定 AI 助理的口吻与角色准则..."
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            {/* Temperature */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  回答创意度 (Temperature): {temperature}
                </label>
                <span className="text-[11px] text-slate-500">
                  {temperature < 0.4 ? "严谨精确" : temperature > 0.8 ? "发散创意" : "平衡"}
                </span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.5"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>

            {/* Memory Toggle */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
              <div>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">启用长期记忆提取与检索</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  开启后对话将自动提取重要事实存入 pgvector，并作为不可信背景注入后续对话。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMemoryEnabled(!memoryEnabled)}
                className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors ${
                  memoryEnabled ? "bg-indigo-600" : "bg-slate-300 dark:bg-slate-700"
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    memoryEnabled ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Memory Extraction Model */}
            {memoryEnabled && (
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800/80 space-y-2">
                <div className="flex justify-between items-center">
                  <label htmlFor="memory-model-select" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    长期记忆提炼模型 (Memory LLM)
                  </label>
                  <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
                    后台自动总结与事实提炼
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  <div>
                    <select
                      id="memory-model-select"
                      value={["openai/gpt-4o-mini", "deepseek/deepseek-chat", "anthropic/claude-3-5-haiku", "google/gemini-2.5-flash", "gpt-4o-mini"].includes(memoryModel) ? memoryModel : "custom"}
                      onChange={(e) => {
                        if (e.target.value !== "custom") {
                          setMemoryModel(e.target.value);
                        }
                      }}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 text-xs text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="openai/gpt-4o-mini">openai/gpt-4o-mini (推荐：高性价比、提取稳定)</option>
                      <option value="deepseek/deepseek-chat">deepseek/deepseek-chat (DeepSeek V3 便宜且智能)</option>
                      <option value="anthropic/claude-3-5-haiku">anthropic/claude-3-5-haiku (Claude 快速响应)</option>
                      <option value="google/gemini-2.5-flash">google/gemini-2.5-flash (Gemini 2.5 Flash 超快)</option>
                      <option value="gpt-4o-mini">gpt-4o-mini (OpenAI 原生直连)</option>
                      <option value="custom">✍️ 手动输入其它模型 ID...</option>
                    </select>
                  </div>
                  <div>
                    <input
                      type="text"
                      value={memoryModel}
                      onChange={(e) => setMemoryModel(e.target.value.trim())}
                      placeholder="例如: openai/gpt-4o-mini 或 deepseek/deepseek-chat"
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-indigo-500 focus:outline-none font-mono"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  💡 <strong>提示：</strong>若你配置了 OpenRouter Key，填入支持的任意模型标识符（如 <code>openai/gpt-4o-mini</code> 或 <code>deepseek/deepseek-chat</code>）即可全自动调用，无需单独绑定 OpenAI 官方 Key。
                </p>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3">
              {saveSuccess && (
                <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                  <ShieldCheck className="h-4 w-4" />
                  配置已保存
                </span>
              )}
              <button
                type="submit"
                disabled={savingSettings}
                className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-500 disabled:opacity-50 transition-all"
              >
                <Save className="h-4 w-4" />
                <span>{savingSettings ? "正在保存..." : "保存全局设置"}</span>
              </button>
            </div>
          </div>
        </form>

        {/* Custom Model Configurations (API Keys encrypted on backend) */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-6 space-y-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">自定义模型与 API 凭证</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                密钥仅在后端使用对称加密安全存储，前端绝不保存或显示明文。
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowOpenRouterModal(true);
                  fetchOpenRouterModels();
                }}
                className="flex items-center gap-1.5 rounded-xl border border-indigo-200 dark:border-indigo-500/40 bg-indigo-50 dark:bg-indigo-600/20 px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-600/30 transition-all shadow-sm"
              >
                <Globe className="h-3.5 w-3.5" />
                <span>从 OpenRouter 库选择模型</span>
              </button>
              <button
                type="button"
                onClick={() => setShowAddConfig(true)}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all shadow-sm"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>手动添加模型</span>
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {customConfigs.length === 0 ? (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800/60 bg-slate-50 dark:bg-slate-950/40 p-5 text-center text-xs text-slate-500">
                暂未配置个人私有 API 凭证，系统将默认采用后端 .env 中设置的全局环境变量。
              </div>
            ) : (
              customConfigs.map((cfg) => (
                <div
                  key={cfg.id}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-xs shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-indigo-50 dark:bg-indigo-600/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20">
                      <Cpu className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">{cfg.model}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 capitalize">
                        厂商: {cfg.provider} {cfg.base_url && `| 地址: ${cfg.base_url}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {cfg.has_api_key && (
                      <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 px-2 py-0.5 rounded-md font-medium">
                        <Key className="h-3 w-3" />
                        <span>已配置秘钥</span>
                      </span>
                    )}
                    <button
                      onClick={() => handleDeleteConfig(cfg.id)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
                      title="删除该配置"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {/* Add Custom Model Config Modal */}
      {showAddConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1.5">添加模型 API 凭证</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              密钥将在后端加密入库，调用该模型时优先使用此凭证。
            </p>
            <form onSubmit={handleAddCustomModel} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">供应商</label>
                <select
                  value={newProvider}
                  onChange={(e) => {
                    const p = e.target.value;
                    setNewProvider(p);
                    if (p === "openrouter") {
                      setNewModel("anthropic/claude-3.5-sonnet");
                      setNewBaseUrl("https://openrouter.ai/api/v1");
                    } else if (p === "openai") {
                      setNewModel("gpt-4o");
                      setNewBaseUrl("https://api.openai.com/v1");
                    } else if (p === "anthropic") {
                      setNewModel("claude-3-5-sonnet-20240620");
                      setNewBaseUrl("");
                    } else if (p === "gemini") {
                      setNewModel("gemini-1.5-pro");
                      setNewBaseUrl("");
                    } else if (p === "ollama") {
                      setNewModel("llama3:latest");
                      setNewBaseUrl("http://host.docker.internal:11434");
                    }
                  }}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 text-xs text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="openrouter">OpenRouter (多模型聚合)</option>
                  <option value="openai">OpenAI (或兼容接口)</option>
                  <option value="anthropic">Anthropic Claude</option>
                  <option value="gemini">Google Gemini</option>
                  <option value="ollama">Ollama (本地模型)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">模型标识 (Model)</label>
                <input
                  type="text"
                  required
                  value={newModel}
                  onChange={(e) => setNewModel(e.target.value)}
                  placeholder="如 gpt-4o, claude-3-5-sonnet-20240620..."
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {newProvider !== "ollama" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">API Key</label>
                  <input
                    type="password"
                    value={newApiKey}
                    onChange={(e) => setNewApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  自定义 Base URL (选填)
                </label>
                <input
                  type="text"
                  value={newBaseUrl}
                  onChange={(e) => setNewBaseUrl(e.target.value)}
                  placeholder={
                    newProvider === "ollama"
                      ? "http://host.docker.internal:11434"
                      : "https://api.openai.com/v1"
                  }
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddConfig(false)}
                  className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 shadow-md shadow-indigo-600/20 transition-all"
                >
                  保存配置
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OpenRouter Live Catalog Browser Modal */}
      {showOpenRouterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-indigo-50 dark:bg-indigo-600/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30">
                  <Globe className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">从 OpenRouter 实时模型库挑选</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">点击任意模型即可自动填入配置</p>
                </div>
              </div>
              <button
                onClick={() => setShowOpenRouterModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Search and Filter */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3 bg-slate-50 dark:bg-slate-950/40 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  placeholder="搜索模型（如：claude-3.5, deepseek, llama-3.1, gemini...）"
                  value={orSearch}
                  onChange={(e) => {
                    const q = e.target.value;
                    setOrSearch(q);
                    fetchOpenRouterModels(q);
                  }}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 py-2 pl-9 pr-4 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* Quick Filter Tags */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-slate-500">热门过滤:</span>
                {["Claude", "DeepSeek", "GPT", "Llama", "Gemini", "Qwen"].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      setOrSearch(tag);
                      fetchOpenRouterModels(tag);
                    }}
                    className="px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-[10px] font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-700 transition-colors shadow-xs"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Models Scrollable List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {loadingOrModels ? (
                <div className="py-16 flex flex-col items-center justify-center gap-2">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                  <p className="text-xs text-slate-500 dark:text-slate-400">正在从 OpenRouter 获取支持的模型列表...</p>
                </div>
              ) : openRouterModels.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500">
                  未检索到匹配的模型，请尝试其他关键词
                </div>
              ) : (
                openRouterModels.map((m) => (
                  <div
                    key={m.id}
                    onClick={() => handleSelectFromOpenRouter(m)}
                    className="group flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 hover:border-indigo-500/50 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-all shadow-xs"
                  >
                    <div className="min-w-0 flex-1 pr-3">
                      <p className="text-xs font-semibold text-slate-800 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-300 truncate">
                        {m.name}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5 truncate">
                        {m.id}
                      </p>
                      {m.description && (
                        <p className="text-[10px] text-slate-500 mt-1 line-clamp-1">
                          {m.description}
                        </p>
                      )}
                    </div>
                    {m.context_length && (
                      <span className="shrink-0 text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2 py-1 rounded-md">
                        {Math.round(m.context_length / 1000)}k 上下文
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
