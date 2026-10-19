/**
 * 应用外壳文案：文档标题、404 / 错误边界、更新提示。
 *
 * metadata.title 本身仍由 app/layout.tsx 的静态 export 决定（Next 的 metadata
 * 只能在服务端构建期产出），所以那一条保留中文原文；其余动态文案都走词典。
 */
export default {
  appName: "Apiapia 助理",
  entering: "正在进入 {app}…",
  appDescription: "Apiapia 助理——一只拥有长期记忆的智能猫咪助理",

  notFound: {
    title: "页面不存在",
    description: "你访问的地址可能已被删除，或链接不正确。",
  },

  routeError: {
    title: "页面加载异常",
    description: "当前页面运行遇到错误。您可以尝试刷新重试；若问题持续，请返回对话页。",
    digest: "错误编号：{digest}",
  },

  globalError: {
    title: "应用无法启动",
    description: "应用初始化遇到错误。您可以尝试重新加载；若持续失败，请清理浏览器缓存后重试。",
    reload: "重新加载",
  },

  update: {
    availableTitle: "发现新版本 {version}",
    currentDescription: "当前版本 {version} 已是最新。",
    changelog: "更新内容",
    changelogHint: "更新内容可在偏好设置中查看，或点击此处查看详情",
    later: "稍后再说",
    updateNow: "立即更新",
    checking: "正在检查更新…",
    /** 后端未返回 changelog 时的占位，避免展开后出现空白块 */
    noChangelog: "本次更新未提供更新日志。",
    cacheWarning: "更新将自动清理旧版缓存并重新载入组件。建议在当前对话完成后再进行更新。",
  },
} as const;