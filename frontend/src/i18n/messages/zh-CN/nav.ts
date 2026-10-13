/**
 * 导航文案。与 config/navigation.ts 的 NAV_ITEMS 一一对应。
 *
 * 之所以把 label/shortLabel/menuLabel/mobileTitle 抽成嵌套结构：同一入口在
 * 桌面宽屏、桌面收窄、头像菜单、移动端标题四个位置各有一份文案，英文里
 * 「对话 / Chat」这类词长差异会直接决定窄屏会不会被截断，必须能分别调整。
 */
export default {
  newChat: "新建对话",
  chat: {
    label: "对话",
    shortLabel: "对话",
    menuLabel: "对话",
    mobileTitle: "对话",
  },
  history: {
    label: "历史",
    shortLabel: "历史",
    menuLabel: "历史对话",
    mobileTitle: "历史会话",
  },
  memory: {
    label: "记忆库",
    shortLabel: "记忆",
    menuLabel: "长期记忆库",
    mobileTitle: "记忆库",
  },
  usage: {
    label: "用量",
    shortLabel: "用量",
    menuLabel: "用量与账单",
    mobileTitle: "用量与账单",
  },
  settings: {
    label: "设置",
    shortLabel: "设置",
    menuLabel: "偏好设置",
    mobileTitle: "偏好设置",
  },
} as const;