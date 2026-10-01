import { useEffect } from "react";

/**
 * App-wide "slide down to close" for bottom sheets. Touch starting in the top
 * strip of any bottom-anchored panel inside a fixed overlay drags it down; on
 * release past the threshold the sheet's own close path is triggered (Close
 * button, else backdrop click, else Escape). Vaul drawers handle this natively.
 */
const GRAB_ZONE = 72;
const THRESHOLD = 90;

function findPanel(target: HTMLElement): HTMLElement | null {
  let el: HTMLElement | null = target;
  const vh = window.innerHeight;
  while (el && el !== document.body) {
    if (el.closest("[data-vaul-drawer]")) return null;
    const parent = el.parentElement;
    if (parent && getComputedStyle(parent).position === "fixed") {
      const r = el.getBoundingClientRect();
      const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
      if (Math.abs(r.bottom - vh) <= 4 && r.top > 0 && radius > 0 && r.height < vh) return el;
    }
    el = parent;
  }
  return null;
}

function closeSheet(panel: HTMLElement) {
  const btn = panel.querySelector<HTMLElement>(
    'button[aria-label*="close" i], button[aria-label*="cancel" i], button[aria-label*="dismiss" i]',
  );
  if (btn) return btn.click();
  const overlay = panel.parentElement;
  if (overlay) overlay.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
}

export function useSwipeCloseSheets(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let panel: HTMLElement | null = null;
    let startY = 0;
    let dy = 0;

    const onStart = (e: TouchEvent) => {
      const t = e.target as HTMLElement;
      if (!t || t.closest("input, textarea, select, [contenteditable=true]")) return;
      const p = findPanel(t);
      if (!p) return;
      if (e.touches[0].clientY - p.getBoundingClientRect().top > GRAB_ZONE) return;
      panel = p;
      startY = e.touches[0].clientY;
      dy = 0;
      p.style.transition = "none";
    };
    const onMove = (e: TouchEvent) => {
      if (!panel) return;
      dy = Math.max(0, e.touches[0].clientY - startY);
      panel.style.transform = `translateY(${dy}px)`;
      if (dy > 4 && e.cancelable) e.preventDefault();
    };
    const onEnd = () => {
      if (!panel) return;
      const p = panel;
      panel = null;
      p.style.transition = "transform 200ms ease";
      if (dy > THRESHOLD) {
        p.style.transform = "translateY(100%)";
        setTimeout(() => closeSheet(p), 160);
      } else {
        p.style.transform = "";
      }
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);
    document.addEventListener("touchcancel", onEnd);
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
    };
  }, [enabled]);
}
