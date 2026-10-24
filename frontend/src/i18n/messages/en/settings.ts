/** Preferences page, model pickers, appearance, save bar. */
export default {
  title: "Preferences",
  adminBadge: "Admin",

  appearance: {
    label: "Appearance",
    avatarMenuHeading: "Appearance",
  },

  /** The three theme options, shared with components/common/ThemeSegments.tsx. */
  themeToggle: {
    tooltip: "Change appearance (currently: {current})",
    srApple: "Change appearance theme",
    sr: "Change theme",
    heading: "Appearance",
  },

  modelGroup: {
    default: "Default models",
    trialBadge: "Trial mode · free models only",
    counts: "{chat} chat · {image} image · {video} video · {speech} speech",
    language: "Chat models",
    image: "Image models",
    video: "Video models",
    speech: "Speech models",
    sttSub: "Speech to text",
    ttsSub: "Text to speech",
    sttKind: "speech-to-text model",
    ttsKind: "text-to-speech model",
    sttPlaceholder: "Choose a speech-to-text model",
    ttsPlaceholder: "Choose a text-to-speech model",
    chatPlaceholder: "Choose the default chat model",
    imagePlaceholder: "Choose an image model",
    videoPlaceholder: "Choose a video model",
    capabilityVision: "Vision (image input)",
    capabilityImage: "Image generation",
    capabilityVideo: "Video generation",
    capabilityStt: "Speech to text",
    capabilityTts: "Text to speech",
    voiceNote: "The selected voice model offers {count} voices. The first is used by default ({voice}).",
    voiceNoteNoList: "This model doesn't publish a voice list, so the provider default is used.",
  },

  memoryGroup: {
    label: "Memory",
    toggle: "Automatic extraction and retrieval",
    toggleAria: "Toggle long-term memory",
    modelLabel: "Extraction model (Memory LLM)",
    modelPlaceholder: "Choose a memory extraction model",
    modelIdLabel: "Memory extraction model ID",
    modelIdPlaceholder: "e.g. openai/gpt-4o-mini",
    consolidationModelLabel: "Consolidation model (Consolidation LLM)",
    consolidationModelPlaceholder: "Choose a memory consolidation model",
    consolidationGuideTitle: "Recommended consolidation models & rationale (click to select):",
    consolidationCurrentSelected: "Selected",
    manualModel: "✍️ Enter another model ID…",
    consolidationPresets: {
      tagFreeRecommended: "Free Pick",
      tagFree: "Free",
      tagBestValue: "Best Value",
      tagHighestAccuracy: "Highest Accuracy",
      tagFastStable: "Fast & Reliable",
      descGemma4: "Google DeepMind 30.7B instruction-tuned model; fast with native JSON adherence and rigorous fact extraction",
      descNemotronSuper: "120B MoE architecture; excels at synthesizing multi-turn profiles and temporal disambiguation",
      descDeepseekFlash: "Top-tier semantic comprehension and strict JSON compliance with ultra-low cost per consolidation",
      descSonnet55: "Flagship reasoning model for subtle temporal shifts, conditional updates, and high-precision memory refactoring",
      descGpt6Luna: "Fast, cost-effective OpenAI workhorse that strictly follows memory consolidation schemas",
    },
  },

  about: {
    label: "About",
    product: "Apiapia",
    versionLabel: "Version",
    versionValue: "v{version}",
    archLabel: "Client stack",
    archValue: "Next.js 14 · React 18",
    engineLabel: "Memory retrieval engine",
    engineValue: "PostgreSQL · pgvector",
    policyLabel: "Update policy",
    policyValue: "Checked automatically",
    checkUpdate: "Check for updates",
  },

  persona: {
    groupLabel: "System prompt",
    groupDesc: "Default persona and global guidance",
    resetDefault: "Restore the standard default",
    defaultPromptValue: "You are an intelligent, sincere, and insightful personal AI assistant. Provide high-quality assistance based on the user's background and long-term memory.",
    promptHint:
      "This prompt serves as the assistant's foundational system instructions. Leave empty to apply standard system defaults.",
    promptPhCustom: "Describe the assistant's role, tone and rules…",
    temperatureLabel: "Temperature",
    temperatureAria: "Sampling temperature",
    temperaturePrecise: "Precise",
    temperatureBalanced: "Balanced",
    temperatureCreative: "Creative",
    temperatureValueText: "{value}, {label}",
    temperatureTicks: {
      min: "0.0 Precise",
      mid: "1.0 Balanced",
      max: "2.0 Creative",
    },
  },

  /** Custom Instructions */
  customInstructions: {
    groupLabel: "Custom Instructions",
    aboutUserLabel: "What would you like the assistant to know about you?",
    aboutUserDesc: "Share your profession, workflow, tech stack, or interests. The assistant will consider this context in every conversation.",
    aboutUserPlaceholder: "E.g. I am a full-stack engineer mainly working with Python and TypeScript; prefer clean and concise code solutions.",
    responseStyleLabel: "How would you like the assistant to respond?",
    responseStyleDesc: "Specify tone, level of detail, formatting preferences, and coding standards.",
    responseStylePlaceholder: "E.g. Be direct and avoid unnecessary pleasantries; provide complete TypeScript types and comments for code.",
  },

  saveBar: {
    saved: "Saved",
    dirty: "Unsaved changes",
    clean: "Up to date",
    reset: "Revert",
    tip: "Save preferences (⌘S / Ctrl+S)",
    save: "Save settings",
    savingLong: "Saving…",
    savingShort: "Saving",
    mobileNotice: "You have unsaved preference changes",
    resetDone: "Reverted to the last saved settings",
    savedDone: "Preferences saved",
    saveFailed: "Could not save the settings",
  },

  sync: {
    tooltip: "Sync the available {scope} list",
    label: "Sync list",
    syncing: "Syncing…",
    sr: "Sync the {scope} list",
  },

  modelBadges: {
    freeModel: "Free model",
    paidModel: "Billed via API",
    textOnly: "Text model",
    idPrefix: "ID: {id}",
    missingId: "Model ID: {id}",
    notSynced: "Not in the synced list",
  },

  picker: {
    placeholder: "Choose a model",
    loading: "Loading…",
    selectAria: "Choose {kind}{current}",
    selectAriaCurrent: ", currently {name}",
    title: "Choose {kind}",
    /** A11y description for the mobile bottom sheet (visually hidden). */
    sheetDesc: "Pick a {kind} by tier, or search by name and vendor.",
    current: "Current: {name}",
    searchAria: "Search {kind}",
    searchPh: "Search {kind}",
    clearSearch: "Clear search",
    listAria: "{kind} list",
    /** A11y name for the tier-card grid (role="group"). */
    tierGroupAria: "{kind} tier filters",
    noMatch: "No matching {kind}",
    searchAll: "Search all models in Custom",
    multimodalBadge: "Multimodal",
    freeBadge: "Free",
    trialBadge: "Trial mode",
    trialTitle: "You're in trial mode, so only free {kind} are available",
    genericKind: "model",
    languageKind: "chat model",
  },

  pickerEmpty: {
    notSynced: "The {kind} list hasn't been synced yet. Use the “Sync list” button above.",
    trialNoFree: "No free {kind} are available. Ask an administrator to register them in {env}.",
    syncedButEmpty: "The backend synced but found no models. Check that the credentials in .env are valid.",
  },

  /** Model selection guidance: price tiers and reasons */
  modelGuide: {
    /** The "Free" tier: the three pinned free entries. */
    groupFree: "Free",

    /** The "Normal" tier: curated everyday value models. */
    groupNormal: "Normal",

    /** The "Smart" tier: curated flagship models. */
    groupSmart: "Smart",

    /** The "Custom" tier: no tier filter, browse the whole catalog. */
    groupCustom: "Custom",

    /** One-line explanations shown on the four tier cards. */
    tierDesc: {
      free: "Three free picks, zero cost",
      normal: "Curated daily drivers with strong value",
      smart: "Curated flagships for complex tasks, priced higher",
      custom: "Search and filter the entire catalog",
    },

    /** Price tier, bucketed roughly by published list price. Answers "is it expensive?" */
    price: {
      free: "Free",
      budget: "Budget",
      standard: "Standard",
      premium: "Flagship",
      /** Tooltip for the exact-price badge: USD per million tokens. */
      perMillion: "Input / output, per 1M tokens (USD)",
    },

    /** The twenty picks. Keys mirror the constants in lib/modelGuide.ts. */
    reason: {
      sonnet: "[All-Round SOTA] Top-tier reasoning, writing, and coding; ideal for complex professional tasks.",
      gptSol61: "[Flagship Experience] Leading comprehensive reasoning with rapid response; excellent for complex tasks.",
      gemini38: "[Fast Long-Context & Vision] Supports million-token context with outstanding chart and visual analysis; high value.",
      glm53: "[Deep Thinking & Workflow] Strong bilingual articulation and reasoning; dependable for advanced programming.",
      gptLuna: "[Cost-Effective Daily Driver] Balances response speed and reasoning quality; ideal as a default daily model.",
      glm53Flash: "[Lightweight Multimodal] Extremely low inference cost with image analysis; optimized for agile lightweight tasks.",
      opus55: "[Deep Reasoning Flagship] Built for complex mathematical proofs, scientific analysis, and system architecture.",
      freeRouter: "[Free Experience Router] Dynamically routes to public free model pools for zero-cost exploration.",
      deepseekPro: "[Code & Logic Specialist] Rigorous algorithmic reasoning and logical deduction; suited for multi-step engineering.",
      grok47: "[Efficient STEM Reasoning] Rapid scientific reasoning and logic processing with excellent cost efficiency.",
      qwenMax: "[Nuanced Writing & Context] Refined and articulate phrasing; excels at creative writing and complex context.",
      gptAstra: "[Complex Task Solver] Leading general deduction and end-to-end task planning capabilities.",
      kimiK3: "[Ultra-Long Context Analysis] Massive context throughput; deep-dive analysis of large codebases and docs.",
      deepseekFlash: "[High-Throughput & Instruction Following] Ultra-low latency, strict JSON schema compliance, exceptional value.",
      qwen38Flash: "[Cost-Effective Vision] Lightweight visual model for efficient table extraction and everyday Q&A.",
      minimaxM3: "[Long-Context & Multimodal] Million-token throughput; economical image and video comprehension.",
      mimoFlash: "[Rapid Daily Q&A] Low-cost inference with swift response for general queries and basic image recognition.",
      haiku55: "[Millisecond Lightweight Model] Near-instant response, optimized for summarization, classification, and quick calls.",
      nemotronUltra: "[Flagship Reasoning] 550B-total / 55B-active MoE built for long-horizon agents and complex deduction; long-context, text-only.",
      minimaxM31Flash: "[Versatile Long-Context Multimodal] 1M-token context and very large outputs; image/video parsing, tool calling, and structured output.",
    },
  },

  errors: {
    syncLanguageFailed: "Could not sync chat models. Check that a valid API key is set in the backend .env",
    syncImageFailed: "Could not sync image models. Check that valid image credentials are set in the backend .env",
    syncVideoFailed: "Could not sync video models. Check that a valid OpenRouter key is set in the backend .env",
    syncAudioFailed: "Could not sync speech models. Check that a valid OpenRouter key is set in the backend .env",
  },
} as const;