/**
 * Single source of truth for the `md` breakpoint used to decide between the
 * desktop routes (`/memory`, `/usage`, `/settings`) and the mobile SPA shell
 * (`/chat?tab=...`).
 *
 * Why a media query instead of `window.innerWidth < 768`:
 * - `innerWidth` **includes** the classic desktop scrollbar, while a Tailwind
 *   `md:` media query measures the viewport **excluding** it. On a 768px-wide
 *   desktop window the two disagree by ~15px, so the page rendered with the
 *   mobile chrome (`MobileHeader` + tab bar) while the JS check said "desktop,
 *   no redirect" — leaving no nav at all.
 * - `768` is also Tailwind's literal, so the two can never drift apart again.
 */
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
