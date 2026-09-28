import { useEffect, useRef, useState, type RefObject } from "react";
import { RefreshCw } from "lucide-react";

const THRESHOLD = 70;
const MAX = 110;

/**
 * App-only pull-to-refresh for a scroll container. Installed apps don't get
 * the browser's native pull-to-refresh, so we provide our own.
 */
export function PullToRefresh({
  scrollRef,
  onRefresh,
  enabled = true,
}: {
  scrollRef: RefObject<HTMLElement | null>;
  onRefresh: () => Promise<void> | void;
  enabled?: boolean;
}) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const pullRef = useRef(0);
  const busy = useRef(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !enabled) return;

    const atTop = (target: EventTarget | null) => {
      if (el.scrollTop > 0) return false;
      // Any inner scroller that isn't at its top blocks the gesture.
      let n = target as HTMLElement | null;
      while (n && n !== el) {
        if (n.scrollHeight > n.clientHeight + 2 && n.scrollTop > 0) return false;
        n = n.parentElement;
      }
      return true;
    };

    const onStart = (e: TouchEvent) => {
      if (busy.current || e.touches.length !== 1) return;
      if (document.body.style.overflow === "hidden") return; // a sheet is open
      startY.current = atTop(e.target) ? e.touches[0].clientY : null;
    };
    const onMove = (e: TouchEvent) => {
      if (startY.current == null) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0) {
        if (pullRef.current) { pullRef.current = 0; setPull(0); }
        return;
      }
      if (el.scrollTop > 0) { startY.current = null; return; }
      const d = Math.min(MAX, dy * 0.5);
      pullRef.current = d;
      setPull(d);
      if (e.cancelable && d > 4) e.preventDefault();
    };
    const onEnd = async () => {
      if (startY.current == null) return;
      startY.current = null;
      const d = pullRef.current;
      pullRef.current = 0;
      if (d >= THRESHOLD) {
        busy.current = true;
        setRefreshing(true);
        setPull(56);
        try { navigator.vibrate?.(10); } catch { /* noop */ }
        try { await onRefresh(); } finally {
          await new Promise((r) => setTimeout(r, 500));
          busy.current = false;
          setRefreshing(false);
          setPull(0);
        }
      } else {
        setPull(0);
      }
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [scrollRef, onRefresh, enabled]);

  if (!enabled || (pull === 0 && !refreshing)) return null;
  const ready = pull >= THRESHOLD || refreshing;
  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center"
      style={{ top: `calc(env(safe-area-inset-top) + ${Math.max(8, pull)}px)`, transition: startY.current == null ? "top 200ms ease" : undefined }}
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-[#16161A] shadow-lg">
        <RefreshCw
          className={`h-4 w-4 ${ready ? "text-[#E5484D]" : "text-white/60"} ${refreshing ? "animate-spin" : ""}`}
          style={refreshing ? undefined : { transform: `rotate(${pull * 3}deg)` }}
        />
      </div>
    </div>
  );
}
