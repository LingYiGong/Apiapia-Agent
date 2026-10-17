/** `md` 断点值与移动端媒体查询检测 */
export const MD_BREAKPOINT_PX = 768;

/** True when the viewport is narrower than Tailwind's `md` (i.e. mobile). */
export function isBelowMd(): boolean {
  if (typeof window === "undefined") return false;
  if (typeof window.matchMedia === "function") {
    return window.matchMedia(`(max-width: ${MD_BREAKPOINT_PX - 1}px)`).matches;
  }
  // Fallback for very old browsers without matchMedia.
  return window.innerWidth < MD_BREAKPOINT_PX;
}
