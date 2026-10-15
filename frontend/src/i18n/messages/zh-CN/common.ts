/**
 * 通用文案：按钮、对话框、反馈、相对时间、时间分组、通用错误。
 *
 * 这里定义的是 `Messages` 类型的事实来源 —— 其它三种语言必须逐键对齐本文件，
 * 漏译会在 `tsc --noEmit` 里报错。因此**只有真正跨模块复用的词条**才放在这里；
 * 只在单个页面出现的文案留在各自的区域文件里，避免 common 膨胀成第二个垃圾场。
 *
 * 复数约定：带单复数差异的词条写成 `_one` / `_other` 两档。中文两者相同，
 * 英文需要区分，日语两者也相同但仍按约定补齐，避免读取方写 `.one` 专属分支。
 */
export default {
  action: {
    confirm: "确认",
    cancel: "取消",
    save: "保存",
    close: "关闭",
    retry: "重试",
    processing: "处理中…",
  },

  /** 相对时间。超过 30 天退化为「月日」，不再显示冗长的「N月N日前」。 */
  time: {
    justNow: "刚刚",
    minutesAgo_one: "{n} 分钟前",
    minutesAgo_other: "{n} 分钟前",
    hoursAgo_one: "{n} 小时前",
    hoursAgo_other: "{n} 小时前",
    daysAgo_one: "{n} 天前",
    daysAgo_other: "{n} 天前",
    monthDay: "{month} 月 {day} 日",
  },

  /**
   * 列表时间分组小标。会话列表与记忆库共用同一套滚动窗口
   * （见 lib/timeGroups.ts），所以文案也放在 common 而不是各页面各写一份。
   */
  timeGroups: {
    last24h: "最近 24 小时",
    last3d: "最近 3 天",
    last7d: "最近 7 天",
    earlier: "更早",
    pinnedConversations: "置顶对话",
    pinnedMemories: "置顶记忆",
  },

  /** 通用兜底错误。带具体业务语义的错误留在各自区域，不要往这里堆。 */
  error: {
    operationFailed: "操作失败",
  },

  /** 无障碍标签。这些会被读屏软件朗读，因此不得使用视觉上的简写。 */
  a11y: {
    mobileTabBar: "移动端底部标签栏",
  },

  /** 头像菜单与账号徽章 */
  account: {
    menu: "{username} 的账户菜单",
    adminReady: "超级管理员权限已就绪",
    standardUser: "已登录标准用户",
    adminBadge: "管理员",
    standardBadge: "标准",
    logout: "退出登录",
  },

/** 语音客户端的本地校验与网络兜底文案（lib/speech.ts）。 */
  speech: {
    transcribeEmpty: "录音内容为空",
    transcribeTooLarge: "音频文件约 {size}MB，超过 {max}MB 上限",
    transcribeFailed: "语音识别失败",
    speakEmptyText: "待朗读的文本为空",
    speakTextTooLong: "待朗读文本 {count} 字，超过单次 {max} 字上限",
    speakFailed: "语音合成失败",
  },
  theme: {
    label: "主题",
    system: "跟随系统",
    light: "浅色",
    dark: "深色",
  },

  /** 语言设置本身。放在通用区是因为登录页与设置页都要用到。 */
  language: {
    label: "界面语言",
    description: "选择界面显示语言。AI 的回复语言会跟随此项。",
  },

  /** 「同步模型列表」的结果反馈，设置页四类模型共用。 */
  modelSync: {
    emptyTitle: "{scope}同步后列表为空",
    emptyDescription:
      "未获取到任何模型，请检查后台 .env 中的服务凭证是否有效。",
    foundNew: "发现 {count} 个新{scope}",
    updatedDescription: "{scope}列表已更新，可在选择器中查看",
    upToDate: "{scope}列表已是最新，未发现新增",
    scope: {
      language: "语言模型",
      image: "绘图模型",
      video: "视频模型",
      speech: "语音模型",
    },
  },
} as const;