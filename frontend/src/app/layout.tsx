import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning className="h-full">
      <body className="h-full bg-background font-sans text-base text-foreground antialiased">
        <ThemeProvider>
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
        </ThemeProvider>
      </body>
    </html>
  );
}
