"use client";

import { useState, useEffect } from "react";

/**
 * 监听移动端软键盘是否弹起。
 * 综合利用 Visual Viewport API (iOS Safari 13+ & Android Chrome)
 * 与输入框聚焦判定，在键盘呼出时毫秒级响应。
 */
export function useIsKeyboardOpen(): boolean {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. Visual Viewport API 监听
    const vv = window.visualViewport;
    const checkViewport = () => {
      if (!vv) return;
      // 当 visualViewport 高度比 window.innerHeight 小 120px 以上时，判定虚拟键盘弹起
      const diff = window.innerHeight - vv.height;
      setIsOpen(diff > 120);
    };

    if (vv) {
      vv.addEventListener("resize", checkViewport);
      vv.addEventListener("scroll", checkViewport);
    }

    // 2. 文本输入控件 Focus / Blur 联动
    const onFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "TEXTAREA" ||
          (target.tagName === "INPUT" &&
            !["checkbox", "radio", "button", "submit", "file", "range"].includes(
              target.getAttribute("type") || ""
            )))
      ) {
        // 触摸屏设备上聚焦输入框即代表键盘将弹起
        if (window.matchMedia("(pointer: coarse)").matches) {
          setIsOpen(true);
        }
      }
    };

    const onBlur = () => {
      // 延迟 120ms 避开在两个输入框之间切换 focus 导致的频闪
      setTimeout(() => {
        if (vv) {
          checkViewport();
        } else {
          setIsOpen(false);
        }
      }, 120);
    };

    window.addEventListener("focusin", onFocus);
    window.addEventListener("focusout", onBlur);

    return () => {
      if (vv) {
        vv.removeEventListener("resize", checkViewport);
        vv.removeEventListener("scroll", checkViewport);
      }
      window.removeEventListener("focusin", onFocus);
      window.removeEventListener("focusout", onBlur);
    };
  }, []);

  return isOpen;
}
