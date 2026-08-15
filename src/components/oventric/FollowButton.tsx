import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { UserPlus, UserCheck, UserMinus, Loader2, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  getFollowStatus,
  sendFollowRequest,
  cancelFollowRequest,
  unfollow,
  type FollowStatus,
} from "@/lib/follows.functions";

interface Props {
  targetId: string;
  className?: string;
  compact?: boolean;
  onStatusChange?: (status: FollowStatus) => void;
}

export function FollowButton({ targetId, className, compact, onStatusChange }: Props) {
  const [status, setStatus] = useState<FollowStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fetchStatus = useServerFn(getFollowStatus);
  const send = useServerFn(sendFollowRequest);
  const cancel = useServerFn(cancelFollowRequest);
  const unfollowFn = useServerFn(unfollow);

  // The follow server fns require an authenticated session — never call them
  // signed out, or they throw "Unauthorized: No authorization header".
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (alive) setSignedIn(!!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setSignedIn(!!session);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const load = useCallback(async () => {
    if (!signedIn) return;
    try {
      const r = await fetchStatus({ data: { targetId } });
      setStatus(r.status);
      onStatusChange?.(r.status);
    } catch (e) {
      console.error("[FollowButton] load", e);
    }
  }, [targetId, fetchStatus, onStatusChange, signedIn]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime: watch follows + follow_requests changes involving this pair
  useEffect(() => {
    if (!signedIn) return;
    const channel = supabase
      .channel(`follow-${targetId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "follows" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "follow_requests" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [targetId, load, signedIn]);

  const act = async (fn: () => Promise<{ status: FollowStatus }>) => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fn();
      setStatus(r.status);
      onStatusChange?.(r.status);
    } catch (e: any) {
      setErr(e?.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };

  if (status === null) {
    return (
      <button
        disabled
        className={`inline-flex items-center justify-center gap-2 px-4 py-3 rounded-[10px] border border-white/10 text-slate-500 text-sm font-semibold opacity-70 ${className ?? ""}`}
      >
        <Loader2 className="w-4 h-4 animate-spin" /> Loading…
      </button>
    );
  }

  const base =
    "inline-flex items-center justify-center gap-2 px-4 py-3 rounded-[10px] font-semibold text-sm transition-colors disabled:opacity-60";
  const label = compact
    ? {
        follow: "Follow",
        requested: "Requested",
        following: "Following",
        mutual: "Mutual",
        follows_you: "Follow back",
      }
    : {
        follow: "Follow",
        requested: "Requested",
        following: "Following",
        mutual: "Mutual friends",
        follows_you: "Follow back",
      };

  let button;
  if (status === "none") {
    button = (
      <button
        onClick={() => act(() => send({ data: { targetId } }))}
        disabled={busy}
        className={`${base} bg-sky-500 hover:bg-sky-400 text-black ${className ?? ""}`}
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
        {label.follow}
      </button>
    );
  } else if (status === "follows_you") {
    button = (
      <button
        onClick={() => act(() => send({ data: { targetId } }))}
        disabled={busy}
        className={`${base} bg-sky-500 hover:bg-sky-400 text-black ${className ?? ""}`}
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
        {label.follows_you}
      </button>
    );
  } else if (status === "requested") {
    button = (
      <button
        onClick={() => act(() => cancel({ data: { targetId } }))}
        disabled={busy}
        className={`${base} bg-yellow-500/10 border border-yellow-500/40 text-yellow-300 hover:bg-yellow-500/15 ${className ?? ""}`}
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
        {label.requested}
      </button>
    );
  } else if (status === "following" || status === "mutual") {
    button = (
      <button
        onClick={() =>
          act(async () => {
            const r = await unfollowFn({ data: { targetId } });
            return { status: r.status };
          })
        }
        disabled={busy}
        className={`${base} bg-emerald-500/15 border border-emerald-500/50 text-emerald-300 hover:bg-red-500/15 hover:border-red-500/50 hover:text-red-300 group ${className ?? ""}`}
      >
        {busy ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <>
            <UserCheck className="w-4 h-4 group-hover:hidden" />
            <UserMinus className="w-4 h-4 hidden group-hover:inline" />
          </>
        )}
        <span className="group-hover:hidden">
          {status === "mutual" ? label.mutual : label.following}
        </span>
        <span className="hidden group-hover:inline">Unfollow</span>
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {button}
      {err && <div className="text-[11px] text-red-400 text-center">{err}</div>}
    </div>
  );
}
