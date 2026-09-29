import { useRef } from "react";
import { toast } from "sonner";

async function copyText(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/** Press and hold (~450ms) to copy a chat message. Works even where the
 *  installed app blocks native text selection. */
export function useLongPressCopy(text: string) {
  const timer = useRef<number | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const clear = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
  };
  return {
    onTouchStart: (e: React.TouchEvent) => {
      if (!text) return;
      const t = e.touches[0];
      start.current = { x: t.clientX, y: t.clientY };
      clear();
      timer.current = window.setTimeout(async () => {
        timer.current = null;
        if (await copyText(text)) {
          navigator.vibrate?.(15);
          toast.success("Message copied");
        }
      }, 450);
    },
    onTouchMove: (e: React.TouchEvent) => {
      const t = e.touches[0];
      const s = start.current;
      if (s && Math.hypot(t.clientX - s.x, t.clientY - s.y) > 10) clear();
    },
    onTouchEnd: clear,
    onTouchCancel: clear,
    onContextMenu: (e: React.MouseEvent) => {
      // Stop the phone's own menu fighting with our copy.
      if ("ontouchstart" in window) e.preventDefault();
    },
  };
}
