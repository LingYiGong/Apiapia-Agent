"use client";

import { Capacitor } from "@capacitor/core";

/**
 * Check if currently running inside a native iOS or Android Capacitor wrapper
 */
export const isNativePlatform = (): boolean => {
  if (typeof window === "undefined") return false;
  return Capacitor.isNativePlatform();
};

/**
 * Initialize Capacitor native controls (Status Bar, Keyboard, Notch handling)
 */
export const initCapacitorApp = async (theme: "light" | "dark" = "dark") => {
  if (!isNativePlatform()) return;

  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");

    // Force iOS native layer to NOT overlay the webview with the status bar.
    // This physically isolates the native status bar from web content, preventing any notch/island blocking.
    await StatusBar.setOverlaysWebView({ overlay: false });

    // Set status bar theme
    await StatusBar.setStyle({
      style: theme === "dark" ? Style.Dark : Style.Light,
    });

    await StatusBar.setBackgroundColor({
      color: theme === "dark" ? "#090d16" : "#ffffff",
    });
  } catch (err) {
    console.warn("Capacitor StatusBar init skipped/failed:", err);
  }

  try {
    const { Keyboard, KeyboardResize } = await import("@capacitor/keyboard");
    await Keyboard.setResizeMode({ mode: KeyboardResize.Native });
  } catch (err) {
    console.warn("Capacitor Keyboard init skipped/failed:", err);
  }
};
