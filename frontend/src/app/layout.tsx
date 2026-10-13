import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";
import { I18nProvider } from "@/i18n";
import { UpdatePrompt } from "@/components/common/UpdatePrompt";
import { CapacitorInit } from "@/components/common/CapacitorInit";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import "./globals.css";
import "katex/dist/katex.min.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // 此前这里设了 `maximumScale: 1` + `userScalable: false` 锁死缩放，
  // 违反 WCAG 2.1 SC 1.4.4（Resize Text）：Android Chrome 会真的禁止双指放大，
  // 低视力用户无法放大任何内容。iOS 忽略这两个字段，但 Android 会遵守。
  // 保留 viewportFit: "cover" —— globals.css 里的 env(safe-area-inset-*)
  // 依赖它才能拿到刘海与底部安全区数值。
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

/**
 * 文档 metadata —— **静态导出**。
 *
 * 曾经写成 `generateMetadata()` 读 cookie 取语言，静态导出（Cloudflare Pages，
 * `output: "export"`）下直接构建失败：
 *
 *     Route /login with `dynamic = "error"` couldn't be rendered statically
 *     because it used `cookies`
 *
 * 静态导出没有请求、没有 cookie 可读，任何服务端 API（`cookies()` /
 * `headers()`）都会触发这条 bailout。所以这里回到静态 export，标题与描述按
 * **默认语言**烘进 HTML，真实语言由 `I18nProvider` 在挂载后写进
 * `document.title`（见 i18n/provider.tsx）。
 *
 * 代价只是首屏那一瞬的标题是默认语言：正文本来就是登录后才渲染的客户端内容，
 * 爬虫看不到实质内容，SEO 上没有损失。
 */
export const metadata: Metadata = {
  title: "Apiapia 助理",
  description: "Apiapia 助理——一只拥有长期记忆的猫咪助理",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Apiapia",
    startupImage: [
      {
        url: "/apple-touch-icon-180x180.png",
      },
    ],
  },
  // 图标全部由这里声明。此前 <head> 里还手写了 12 个 <link rel="icon"> /
  // <link rel="apple-touch-icon">，与下面这份完全重复 —— Next 会把两份都输出，
  // 浏览器要下两遍同样的资源，且改图标时必须记得改两个地方。
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    shortcut: ["/favicon.ico"],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      { url: "/apple-touch-icon-120x120.png", sizes: "120x120", type: "image/png" },
      { url: "/apple-touch-icon-152x152.png", sizes: "152x152", type: "image/png" },
      { url: "/apple-touch-icon-167x167.png", sizes: "167x167", type: "image/png" },
      { url: "/apple-touch-icon-180x180.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

/**
 * 首帧主题引导 —— 必须**内联**且**同步**执行，不能 `defer` / `async`，
 * 也不能挪进独立文件（那会多一个阻塞首帧的网络往返，等于没做）。
 *
 * 为什么需要它：`next-themes` 的主题脚本挂在 <body> 内的 ThemeProvider 下，
 * 而 `<body class="bg-background">` 的底色来自 globals.css 的 `--background`。
 * 浏览器解析到 <body> 时 `<html>` 上还没有 `dark` 类，`:root` 的浅色 token
 * 已经生效 —— 于是夜间模式用户每次冷启动都会先闪一屏纯白，这正是手机 web
 * app「进入 app 前的等待页」发白的直接原因。
 *
 * 这里把同一套判定提前到 <head> 里同步跑完：`<html>` 在 <body> 解析前就带上
 * `dark` / `light` 与 `color-scheme`，首帧就是最终配色。
 *
 * 两个约束，改动时务必同步维护：
 *   1. 存储键 `apiapia_theme` 与 `lib/theme.tsx` 的 storageKey 必须一致，
 *      否则脚本和 next-themes 得出相反结论，来回切主题。
 *   2. 判定顺序（显式 light/dark 优先于系统偏好）与 next-themes 一致。
 *
 * 后半段切 manifest：Web App Manifest 规范没有 `prefers-color-scheme`，
 * 没法在一份 JSON 里同时表达白/黑两套底色，所以拆成 manifest.json（浅）
 * 与 manifest-dark.json（深），按解析结果改 <link rel="manifest"> 的 href。
 * `metadata.manifest` 仍输出浅色那份，作为无脚本 / 脚本异常时的兜底。
 * 注意：系统启动画面（logo 闪屏）在「添加到主屏幕」时就被系统缓存了，
 * 改 manifest 只影响之后重新访问/重装，不会追溯已安装 App 的启动画面。
 */
const THEME_BOOT_SCRIPT = `(function(){var d=document.documentElement,t=null;try{t=localStorage.getItem("apiapia_theme")}catch(e){}var m=typeof matchMedia==="function"&&matchMedia("(prefers-color-scheme: dark)").matches;var k=t==="dark"?true:t==="light"?false:m;d.classList.add(k?"dark":"light");d.style.colorScheme=k?"dark":"light";var href=k?"/manifest-dark.json":"/manifest.json",l=d.querySelector('link[rel="manifest"]');if(l){l.setAttribute("href",href)}else{var n=document.createElement("link");n.rel="manifest";n.setAttribute("href",href);d.appendChild(n)}document.addEventListener("DOMContentLoaded",function(){var a=d.querySelectorAll('link[rel="manifest"]');for(var i=1;i<a.length;i++){a[i].parentNode&&a[i].parentNode.removeChild(a[i])}});})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // `lang` 在这里只能写死默认语言：静态导出（output: "export"，见
    // next.config.mjs）下这份 HTML 是构建期产物，那时还不存在「用户选了哪种
    // 语言」。真正的语言由 I18nProvider 在 layout effect 里写到
    // documentElement.lang 上 —— 在浏览器绘制之前完成，所以不会闪。
    <html lang="zh-CN" suppressHydrationWarning className="h-full">
      {/* 引导脚本必须是 <head> 的第一个子节点：在样式表与 <body> 之前同步
          跑完，`<html>` 才拿得到 dark 类，首帧才不会白。放在 <body> 里
          （next-themes 现在的位置）就已经晚了。 */}
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="h-full bg-background font-sans text-base text-foreground antialiased">
        <ThemeProvider>
          <I18nProvider>
            <AuthProvider>
              {/* 全应用共用一个 TooltipProvider，鼠标横扫一排图标按钮时
                  气泡会接力而不是逐个重新计时 */}
              <TooltipProvider delayDuration={200} skipDelayDuration={300}>
                <CapacitorInit />
                <UpdatePrompt />
                {children}
              </TooltipProvider>
              {/* `offset` 省略 —— Toaster 包装层已处理头部避让
                  （见 TOASTER_TOP_OFFSET） */}
              <Toaster richColors position="top-center" />
            </AuthProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
