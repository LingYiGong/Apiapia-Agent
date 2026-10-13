/** Long-term memory library page. */
export default {
  title: "Memory",

  search: {
    label: "Search memories",
    placeholder: "Search memories…",
    clear: "Clear search",
    submit: "Search",
    submitSr: "Search memories",
  },

  section: {
    searchResults: "Results",
    all: "All memories",
    /** Item count after a group heading, e.g. "Last 24 hours (12)". */
    count: "({count})",
  },

  counter: {
    foundPlus: "(found {count}+ )",
    loadedOfTotal: "(loaded {count} of {total})",
    total: "({total} total)",
  },

  export: {
    tip: "Export all {count} memories as JSON",
    sr: "Export JSON",
    inProgress: "Exporting memories…",
    partial: "Exported {exported} (server reports {total} in total — this may be incomplete)",
    all: "Exported all {exported} memories",
    failed: "Could not export the memories",
  },

  showAll: "Show all",

  empty: {
    searchTitle: "No matching memories",
    searchDesc: "Try another keyword, or clear the search box.",
    browseTitle: "No memories yet",
    browseDesc:
      "Mention your background, habits or key facts while chatting and the model will distil them into this list.",
    resetSearch: "Reset search",
    newChat: "Start a conversation",
  },

  loadMore: {
    busy: "Loading…",
    searching: "Load more results",
    browsing: "Load more",
  },

  endOfList: "Showing all {total} memories",

  card: {
    edited: "Edited",
    editTip: "Edit memory",
    deleteTip: "Delete memory",
  },

  edit: {
    title: "Edit memory",
    desc: "Change what this memory says. The assistant will use the edited fact everywhere from now on.",
    label: "Memory content",
    placeholder: "Edit the memory…",
    /** ⌘ is only correct on macOS; Windows users should see Ctrl. */
    shortcutMac: "⌘ + Enter to save",
    shortcutOther: "Ctrl + Enter to save",
    charCount: "{count} characters",
    cancel: "Cancel",
    saving: "Saving…",
    done: "Done",
    saved: "Memory updated",
    failed: "Could not update the memory",
  },

  remove: {
    title: "Delete this memory",
    desc: "Permanently remove this record from the memory library? The assistant will stop using this fact, and this cannot be undone.",
    confirm: "Delete",
    done: "Memory deleted",
    failed: "Could not delete the memory",
  },

  errors: {
    searchFallback: "Memory search failed, showing everything instead",
    loadFailed: "Could not load memories. Try again.",
  },
} as const;