import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** A member counts as online until they've been quiet for this long. */
export const OFFLINE_GRACE_MS = 5 * 60 * 1000;
/** How often the current user stamps themselves as active. */
const HEARTBEAT_MS = 60 * 1000;
/** How often we refresh everyone else's last-seen times. */
const REFRESH_MS = 45 * 1000;

type PresenceSnapshot = {
  /** userId -> last seen timestamp (ms) */
  lastSeen: Map<string, number>;
  version: number;
};

const snapshot: PresenceSnapshot = { lastSeen: new Map(), version: 0 };
const listeners = new Set<() => void>();
let started = false;
let viewerId: string | null = null;

function emit() {
  snapshot.version += 1;
  listeners.forEach((l) => l());
}

function mergeRows(rows: { user_id: string; last_seen_at: string }[]) {
  let changed = false;
  for (const r of rows) {
    const ts = new Date(r.last_seen_at).getTime();
    if (!Number.isFinite(ts)) continue;
    const prev = snapshot.lastSeen.get(r.user_id) ?? 0;
    if (ts > prev) {
      snapshot.lastSeen.set(r.user_id, ts);
      changed = true;
    }
  }
  if (changed) emit();
}

async function heartbeat() {
  if (!viewerId) return;
  const now = new Date().toISOString();
  await supabase
    .from("user_presence")
    .upsert({ user_id: viewerId, last_seen_at: now }, { onConflict: "user_id" });
  snapshot.lastSeen.set(viewerId, Date.now());
  emit();
}

async function refresh() {
  const since = new Date(Date.now() - OFFLINE_GRACE_MS * 3).toISOString();
  const { data } = await supabase
    .from("user_presence")
    .select("user_id, last_seen_at")
    .gte("last_seen_at", since)
    .order("last_seen_at", { ascending: false })
    .limit(500);
  if (data) mergeRows(data as { user_id: string; last_seen_at: string }[]);
}

/**
 * Starts the app-wide presence engine once: a heartbeat for the signed-in
 * viewer plus a shared poll of everyone's last-seen time. Realtime presence
 * on the `oventric:presence` topic keeps "online" instant, while the DB
 * timestamps keep it accurate for 5 minutes after someone disappears.
 */
function ensureStarted() {
  if (started || typeof window === "undefined") return;
  started = true;

  let channel: ReturnType<typeof supabase.channel> | null = null;

  (async () => {
    const { data } = await supabase.auth.getSession();
    viewerId = data.session?.user?.id ?? null;

    await refresh();
    if (viewerId) await heartbeat();

    window.setInterval(() => {
      if (document.visibilityState === "visible") void heartbeat();
    }, HEARTBEAT_MS);
    window.setInterval(() => void refresh(), REFRESH_MS);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        void heartbeat();
        void refresh();
      }
    });

    if (!viewerId) return;

    channel = supabase.channel("oventric:presence", {
      config: { presence: { key: viewerId } },
    });

    const sync = () => {
      if (!channel) return;
      const state = channel.presenceState();
      const now = Date.now();
      let changed = false;
      for (const id of Object.keys(state)) {
        snapshot.lastSeen.set(id, now);
        changed = true;
      }
      if (changed) emit();
    };

    channel
      .on("presence", { event: "sync" }, sync)
      .on("presence", { event: "join" }, sync)
      .on("presence", { event: "leave" }, sync)
      .subscribe(async (status) => {
        if (status !== "SUBSCRIBED" || !channel) return;
        await channel.track({ user_id: viewerId, online_at: new Date().toISOString() });
      });
  })();
}

function usePresenceStore() {
  const [, setTick] = useState(0);
  useEffect(() => {
    ensureStarted();
    const l = () => setTick((t) => t + 1);
    listeners.add(l);
    // Re-render every 30s so "online" decays into "last seen" on its own.
    const timer = window.setInterval(l, 30_000);
    return () => {
      listeners.delete(l);
      window.clearInterval(timer);
    };
  }, []);
  return snapshot;
}

/**
 * Set of user ids considered online right now — active within the last 5
 * minutes, so a brief disconnect never flips someone to offline instantly.
 */
export function useOnlineUsers(): Set<string> {
  const store = usePresenceStore();
  return useMemo(() => {
    const cutoff = Date.now() - OFFLINE_GRACE_MS;
    const set = new Set<string>();
    store.lastSeen.forEach((ts, id) => {
      if (ts >= cutoff) set.add(id);
    });
    return set;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.version]);
}

/** Human readable "last seen" for a member, or null when unknown. */
export function formatLastSeen(ts: number | null | undefined): string | null {
  if (!ts) return null;
  const diff = Date.now() - ts;
  if (diff < OFFLINE_GRACE_MS) return "Online now";
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `Last seen ${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Last seen ${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Last seen ${days}d ago`;
  return `Last seen ${new Date(ts).toLocaleDateString()}`;
}

/**
 * Presence for the whole app: an online set plus a `lastSeenLabel` helper for
 * showing "Last seen 12m ago" once the 5-minute grace window expires.
 */
export function usePresence() {
  const store = usePresenceStore();
  const online = useOnlineUsers();
  const lastSeenAt = useCallback(
    (userId: string | null | undefined) => (userId ? (store.lastSeen.get(userId) ?? null) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store.version],
  );
  const lastSeenLabel = useCallback(
    (userId: string | null | undefined) => formatLastSeen(lastSeenAt(userId)),
    [lastSeenAt],
  );
  const isOnline = useCallback((userId: string | null | undefined) => !!userId && online.has(userId), [online]);
  return { online, isOnline, lastSeenAt, lastSeenLabel };
}
