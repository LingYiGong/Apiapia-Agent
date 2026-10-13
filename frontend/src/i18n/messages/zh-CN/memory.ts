/** 长期记忆库页面文案。 */
export default {
  title: "记忆库",

  search: {
    label: "搜索记忆",
    placeholder: "搜索记忆…",
    clear: "清除搜索",
    submit: "搜索",
    submitSr: "搜索记忆",
  },

  section: {
    searchResults: "搜索结果",
    all: "全部记忆",
    /** 分组小标后面的条目数，如「最近 24 小时 (12)」 */
    count: "({count})",
  },

  counter: {
    foundPlus: "(已找到 {count}+ 条)",
    loadedOfTotal: "(已加载 {count} / {total} 条)",
    total: "(共 {total} 条)",
  },

  export: {
    tip: "导出全部 {count} 条记忆为 JSON",
    sr: "导出 JSON",
    inProgress: "正在导出记忆数据…",
    partial: "已导出 {exported} 条（服务端总数 {total} 条，可能未完整）",
    all: "已导出全部 {exported} 条记忆",
    failed: "导出记忆数据失败",
  },

  showAll: "显示全部",

  empty: {
    searchTitle: "未找到匹配的记忆记录",
    searchDesc: "换个关键词试试，或清除搜索框。",
    browseTitle: "暂无记忆记录",
    browseDesc:
      "在与 AI 对话中提及关于你的背景、习惯或关键事实，模型将自动提炼并记录在此处。",
    resetSearch: "重置搜索",
    newChat: "去新建对话",
  },

  loadMore: {
    busy: "正在加载…",
    searching: "加载更多结果",
    browsing: "加载更多",
  },

  endOfList: "已显示全部 {total} 条记忆",

  card: {
    edited: "已编辑",
    editTip: "编辑记忆",
    deleteTip: "删除记忆",
  },

  edit: {
    title: "编辑长期记忆",
    desc: "修改此条记忆内容，AI 将在全站对话中以修改后的事实作为参考。",
    label: "记忆内容",
    placeholder: "修改记忆内容…",
    /** 快捷键提示里的 ⌘ 只在 macOS 上正确，Windows 应显示 Ctrl */
    shortcutMac: "支持 ⌘ + 回车 完成修改",
    shortcutOther: "支持 Ctrl + 回车 完成修改",
    charCount: "{count} 字",
    cancel: "取消",
    saving: "正在保存…",
    done: "完成",
    saved: "已更新记忆",
    failed: "修改记忆失败",
  },

  remove: {
    title: "删除这条记忆",
    desc: "确定要从记忆库中永久移除这条记录吗？删除后 AI 将不再参考该事实，此操作无法撤销。",
    confirm: "删除",
    done: "已删除记忆",
    failed: "删除记忆失败",
  },

  errors: {
    searchFallback: "检索记忆库失败，已返回全部记忆",
    loadFailed: "加载记忆失败，请重试",
  },
} as const;