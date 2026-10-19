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
    selectAria: "Choose {kind}",
    selectAriaCurrent: ", currently {name}",
    title: "Choose {kind}",
    /** A11y description for the mobile bottom sheet (visually hidden). */
    sheetDesc: "Pick a {kind} by scenario, or search by name and vendor.",
    current: "Current: {name}",
    searchAria: "Search {kind}",
    searchPh: "Search {kind}",
    clearSearch: "Clear search",
    listAria: "{kind} list",
    /** A11y name for the filter-chip row (role="group"). */
    filterGroupAria: "{kind} category filters",
    noMatch: "No matching {kind}",
    multimodalBadge: "Multimodal",
    allGroup: "All",
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

  /** Model selection guidance: need tags, price tiers, reasons and gotchas */
  modelGuide: {
    /** The "Picks" filter group in ModelPicker */
    groupRecommend: "Recommended",

    /** The "Free" chip in the ModelPicker: every free model in the catalog. */
    groupFree: "Free",

    /** Section headers in ModelPicker's category list */
    sectionUseCase: "By scenario",

    /** Task tags; also used as the ModelPicker category labels */
    useCase: {
      writing: "Writing & Translation",
      reasoning: "Deep Reasoning",
      coding: "Coding & Dev",
      visionDocs: "Vision & Docs",
      fastFree: "Fast & Free",
    },

    /** Price tier, bucketed roughly by published list price. Answers "is it expensive?" */
    price: {
      free: "Free",
      budget: "Budget",
      standard: "Standard",
      premium: "Flagship",
    },

    /** The eighteen picks. Keys mirror the constants in lib/modelGuide.ts. */
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
    },

    /** Only written where there is a real gotcha. Models without a caveatKey skip this line. */
    caveat: {
      longPrompt: "Notice: Inputs exceeding hundreds of thousands of tokens scale to a higher price bracket.",
      priceRise: "Notice: Scheduled for a price adjustment in 2027; plan ahead for long-term production use.",
      thinking: "Notice: Always engages deep chain-of-thought reasoning, which adds processing time and cost.",
      freeUnstable: "Notice: Routed through public free pools; response quality and availability may fluctuate.",
      shortContext: "Notice: Context window is 500K tokens (shorter than 1M models); verify large document sizes.",
      primeVariant: "Notice: -prime accelerated variants are priced higher; use standard models for maximum value.",
      kimiPrice: "Notice: Output token pricing is higher for verbose long-form generations.",
      peakPricing: "Notice: Dynamic peak pricing applies during UTC 01:00-04:00 and 06:00-10:00.",
      haikuLongPrompt: "Notice: Single requests exceeding 100K tokens step up to the next pricing tier.",
    },
  },

  errors: {
    syncLanguageFailed: "Could not sync chat models. Check that a valid API key is set in the backend .env",
    syncImageFailed: "Could not sync image models. Check that valid image credentials are set in the backend .env",
    syncVideoFailed: "Could not sync video models. Check that a valid OpenRouter key is set in the backend .env",
    syncAudioFailed: "Could not sync speech models. Check that a valid OpenRouter key is set in the backend .env",
  },
} as const;