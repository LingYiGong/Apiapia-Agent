/**
 * Common copy: buttons, dialogs, feedback, relative time, time buckets, generic errors.
 *
 * Must mirror `messages/zh-CN/common.ts` key for key — the `Messages` type in
 * `runtime.ts` is derived from zh-CN, so a missing key here is a compile error.
 *
 * Plural convention: entries whose wording differs between one and many carry
 * `_one` / `_other`. English genuinely needs the distinction ("1 minute ago" vs
 * "2 minutes ago"); zh-CN and ja repeat the same string in both slots rather than
 * branching at the call site.
 */
export default {
  action: {
    confirm: "Confirm",
    cancel: "Cancel",
    save: "Save",
    saving: "Saving…",
    saved: "Saved",
    delete: "Delete",
    deleting: "Deleting…",
    edit: "Edit",
    rename: "Rename",
    close: "Close",
    retry: "Try again",
    back: "Back",
    copy: "Copy",
    copied: "Copied",
    download: "Download",
    upload: "Upload",
    export: "Export",
    exportAs: "Export as {format}",
    importing: "Importing…",
    refresh: "Refresh",
    create: "New",
    add: "Add",
    remove: "Remove",
    clear: "Clear",
    submit: "Submit",
    search: "Search",
    reset: "Reset",
    select: "Select",
    selectAll: "Select all",
    deselectAll: "Deselect all",
    more: "More",
    expand: "Expand",
    collapse: "Collapse",
    viewAll: "View all",
    loadMore: "Load more",
    send: "Send",
    stop: "Stop",
    regenerate: "Regenerate",
    processing: "Working…",
    loading: "Loading…",
    optional: "Optional",
    required: "Required",
    yes: "Yes",
    no: "No",
    on: "On",
    off: "Off",
    default: "Default",
    none: "None",
    unknown: "Unknown",
    all: "All",
    copyFailed: "Copy failed. Select the text and copy it manually.",
  },

  /**
   * Relative time. Anything older than 30 days degrades to a month-day stamp
   * rather than a needlessly long "23 days ago" form.
   */
  time: {
    justNow: "just now",
    minutesAgo_one: "{n} minute ago",
    minutesAgo_other: "{n} minutes ago",
    hoursAgo_one: "{n} hour ago",
    hoursAgo_other: "{n} hours ago",
    daysAgo_one: "{n} day ago",
    daysAgo_other: "{n} days ago",
    monthDay: "{month}/{day}",
    fullDateTime: "{date} {time}",
  },

  /**
   * List time buckets. Conversations and the memory library share one set of
   * rolling windows (see lib/timeGroups.ts), so the labels live here too.
   */
  timeGroups: {
    last24h: "Last 24 hours",
    last3d: "Last 3 days",
    last7d: "Last 7 days",
    earlier: "Earlier",
    pinnedConversations: "Pinned",
    pinnedMemories: "Pinned",
  },

  /** Fallback errors. Anything with real business meaning lives in its own area. */
  error: {
    operationFailed: "Something went wrong",
    requestFailed: "Request failed ({status})",
    networkError: "Network error. Check your connection and try again.",
    unknownError: "Unknown error",
    notFound: "This item no longer exists",
    unhandledCode: "The operation failed ({code})",
  },

  backendError: {
    fallback: "The service is temporarily unavailable. Please try again shortly.",
  },

  unit: {
    seconds: "{n}s",
    count: "{n}",
    token: "{n} tokens",
    times: "{n} times",
    currencyUsd: "${value}",
  },

  /** Screen-reader labels. Read aloud, so no visual shorthand here. */
  a11y: {
    openMenu: "Open menu",
    closeMenu: "Close menu",
    moreActions: "More actions",
    loading: "Loading",
    loadingMore: "Loading more content",
    selected: "Selected",
    expandSection: "Expand this section",
    collapseSection: "Collapse this section",
    mobileTabBar: "Bottom tab bar",
  },

  /** Avatar menu and account badges. */
  account: {
    menu: "Account menu for {username}",
    adminReady: "Super admin privileges active",
    standardUser: "Signed in as a standard user",
    adminBadge: "Admin",
    standardBadge: "Standard",
    logout: "Sign out",
  },

/** Local validation and network fallbacks for the speech client (lib/speech.ts). */
  speech: {
    transcribeEmpty: "The recording is empty",
    transcribeTooLarge: "The audio file is about {size}MB, over the {max}MB limit",
    transcribeFailed: "Transcription failed",
    speakEmptyText: "There is no text to read aloud",
    speakTextTooLong: "The text is {count} characters, over the {max} per request",
    speakFailed: "Speech synthesis failed",
  },
  theme: {
    label: "Appearance",
    system: "Match system",
    light: "Light",
    dark: "Dark",
  },

  /** The language setting itself; needed by both the settings page and login. */
  language: {
    label: "Language",
    description: "Choose the interface language. The assistant replies in this language too.",
    current: "Current language",
  },

  /** Shared result feedback for the four "sync model list" buttons. */
  modelSync: {
    emptyTitle: "{scope} list is empty after syncing",
    emptyDescription:
      "No models were returned. Check that the service credentials in the backend .env are valid.",
    foundNew: "Found {count} new {scope}",
    updatedDescription: "The {scope} list has been updated. Check it in the picker.",
    upToDate: "The {scope} list is already up to date. Nothing new.",
    scope: {
      language: "chat model",
      image: "image model",
      video: "video model",
      speech: "speech model",
    },
  },
} as const;