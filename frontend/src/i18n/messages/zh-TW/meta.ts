/**
 * 應用外殼文案：文件標題、404、錯誤邊界、更新提示。
 *
 * `metadata.title` 本身維持 app/layout.tsx 的簡體中文原文 —— Next.js 的
 * metadata 只能在伺服器建置期產出，無法跟隨客戶端在 hydration 之後選定的語言。
 */
export default {
  appName: "Apiapia 助理",
  entering: "正在進入 {app}…",
  appDescription: "Apiapia 助理——一隻擁有長期記憶的貓咪助理",

  notFound: {
    title: "頁面不存在",
    description: "您造訪的網址可能已被刪除，或連結不正確。",
  },

  routeError: {
    title: "頁面發生了點問題",
    description: "目前頁面遇到了錯誤。您可以重試；若反覆出現，請返回對話頁。",
    digest: "錯誤編號：{digest}",
  },

  globalError: {
    title: "應用無法啟動",
    description: "初始化時發生錯誤。可以嘗試重新載入；若持續失敗，請清除本站資料後重試。",
    reload: "重新載入",
  },

  update: {
    availableTitle: "發現新版本 {version}",
    currentDescription: "目前版本 {version} 已是最新。",
    changelog: "更新內容",
    changelogHint: "更新內容可在偏好設定中檢視，或點擊此處檢視詳情",
    later: "稍後再說",
    updateNow: "立即更新",
    checking: "正在檢查更新…",
    noChangelog: "本次更新未提供更新紀錄。",
    cacheWarning: "更新將自動清理瀏覽器舊版快取並重載最新介面元件。建議不要在對話進行到一半時更新。",
  },
} as const;