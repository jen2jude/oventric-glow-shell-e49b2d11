import { useEffect, type RefObject } from "react";
import { supabase } from "@/integrations/supabase/client";

type Kind = "play" | "link_click" | "full_video_click" | "share";

function viewerKey(): string {
  try {
    let k = localStorage.getItem("oventric:viewer-key");
    if (!k) {
      k = crypto.randomUUID();
      localStorage.setItem("oventric:viewer-key", k);
    }
    return k;
  } catch {
    return "anon";
  }
}

/** Fire-and-forget event on a Creators-tab showcase (clicks, watch time). */
export function logCreatorEvent(postId: string, kind: Kind, opts: { seconds?: number; target?: string } = {}) {
  void supabase
    .rpc("log_creator_post_event", {
      _post_id: postId,
      _kind: kind,
      _seconds: opts.seconds ?? 0,
      _target: opts.target ?? null,
      _session: viewerKey(),
    } as never)
    .then(() => {}, () => {});
}

/**
 * Counts real watch time on a showcase video — only while `active` is true
 * (the viewer tapped to play / opened it), so muted feed autoplay never counts.
 * Flushes on pause, end, tab hide and unmount.
 */
export function useWatchTime(ref: RefObject<HTMLVideoElement | null>, postId: string | null | undefined, active: boolean) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !postId || !active) return;
    let startedAt: number | null = null;
    let acc = 0;
    const start = () => { if (startedAt == null) startedAt = performance.now(); };
    const stop = () => {
      if (startedAt != null) { acc += (performance.now() - startedAt) / 1000; startedAt = null; }
    };
    const flush = () => {
      stop();
      if (acc >= 1) logCreatorEvent(postId, "play", { seconds: Math.round(acc) });
      acc = 0;
    };
    const onPlay = () => start();
    const onPause = () => flush();
    const onVis = () => { if (document.visibilityState === "hidden") flush(); else if (!el.paused) start(); };
    el.addEventListener("playing", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onPause);
    document.addEventListener("visibilitychange", onVis);
    if (!el.paused) start();
    return () => {
      el.removeEventListener("playing", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onPause);
      document.removeEventListener("visibilitychange", onVis);
      flush();
    };
  }, [ref, postId, active]);
}
