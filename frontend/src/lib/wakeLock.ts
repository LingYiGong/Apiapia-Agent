"use client";

/**
 * 屏幕常亮检测工具（Screen Wake Lock API）
 *
 * 在模型回复时阻止手机等移动端自动熄屏黑屏，回复完毕自动释放。
 */

/**
 * 检查当前运行环境（浏览器/WebView）是否支持 Screen Wake Lock API
 */
export function isWakeLockSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    "wakeLock" in navigator &&
    typeof (navigator as any).wakeLock?.request === "function"
  );
}
