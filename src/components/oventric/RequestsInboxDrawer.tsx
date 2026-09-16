import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { X, Loader2, UserPlus, Check, Ban, User as UserIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  listIncomingFollowRequests,
  acceptFollowRequest,
  declineFollowRequest,
  type IncomingFollowRequest,
} from "@/lib/follows.functions";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function RequestsInboxDrawer({ open, onClose }: Props) {
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const navigate = useNavigate();

  // Follow requests
  const [followRows, setFollowRows] = useState<IncomingFollowRequest[] | null>(null);
  const listFollow = useServerFn(listIncomingFollowRequests);
  const acceptFollow = useServerFn(acceptFollowRequest);
  const declineFollow = useServerFn(declineFollowRequest);

  const loadFollow = useCallback(() => {
    setErr(null);
    listFollow()
      .then((r) => setFollowRows(r))
      .catch((e) => {
        console.error("[RequestsInboxDrawer] follow load", e);
        setErr(e instanceof Error ? e.message : "Failed to load follow requests");
        setFollowRows([]);
      });
  }, [listFollow]);

  useEffect(() => {
    if (!open) return;
    loadFollow();
  }, [open, loadFollow]);

  // Realtime refresh while open
  useEffect(() => {
    if (!open) return;
    const ch = supabase
      .channel("requests-inbox-drawer")
      .on("postgres_changes", { event: "*", schema: "public", table: "follow_requests" }, () =>
        loadFollow(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [open, loadFollow]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const actFollow = async (
    requesterId: string,
    fn: (input: { data: { requesterId: string } }) => Promise<unknown>,
  ) => {
    setBusy(requesterId);
    try {
      await fn({ data: { requesterId } });
      setFollowRows((rs) => (rs ?? []).filter((r) => r.requesterId !== requesterId));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(null);
    }
  };

  if (!open || typeof document === "undefined") return null;

  const followCount = followRows?.length ?? 0;

  return createPortal(
    <div
      className="modal-light fixed inset-0 z-[200] flex items-stretch justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby="requests-inbox-title"
    >
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full sm:max-w-sm h-full bg-[#141418] border-l border-white/10 shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-200">
        <div className="sticky top-0 z-10 bg-[#141418] px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">
              Follow requests
            </div>
            <h2 id="requests-inbox-title" className="text-white font-black text-lg mt-0.5">
              Approve who connects with you
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 -m-2 rounded-[10px] text-slate-500 hover:text-white hover:bg-white/5"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {err && (
            <p role="alert" className="text-xs text-red-400 border-l-2 border-red-500 pl-2">
              {err}
            </p>
          )}

          {followRows === null ? (
            <LoadingRow />
          ) : followRows.length === 0 ? (
            <EmptyBlock
              icon={<UserPlus className="w-6 h-6 text-slate-600 mx-auto" />}
              title="No pending follow requests."
              body="When someone asks to follow you, it will appear here."
            />
          ) : (
            <>
              <p className="text-[11px] text-slate-500">
                {followCount} pending {followCount === 1 ? "request" : "requests"}
              </p>
              {followRows.map((r) => (
                <div
                  key={r.requesterId}
                  className="flex items-center gap-3 p-3 rounded-[10px] bg-[#1E1E24] border border-white/10"
                >
                  <button
                    onClick={() => {
                      if (r.requesterSlug) {
                        navigate({ to: "/profile/$id", params: { id: r.requesterSlug } });
                        onClose();
                      }
                    }}
                    className="shrink-0"
                    aria-label={`Open ${r.requesterName}'s profile`}
                  >
                    {r.avatarUrl ? (
                      <img loading="lazy" decoding="async"
                        src={r.avatarUrl}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center">
                        <UserIcon className="w-4 h-4" />
                      </div>
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-white font-semibold truncate">
                      {r.requesterName}
                    </div>
                    <div className="text-[11px] text-slate-500">wants to follow you</div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => actFollow(r.requesterId, acceptFollow)}
                      disabled={busy === r.requesterId}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[10px] bg-emerald-500 text-black text-xs font-bold hover:bg-emerald-400 disabled:opacity-60"
                      aria-label={`Accept ${r.requesterName}`}
                    >
                      {busy === r.requesterId ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Check className="w-3 h-3" />
                      )}
                      Accept
                    </button>
                    <button
                      onClick={() => actFollow(r.requesterId, declineFollow)}
                      disabled={busy === r.requesterId}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[10px] border border-white/10 text-slate-300 text-xs font-bold hover:bg-white/5 disabled:opacity-60"
                      aria-label={`Decline ${r.requesterName}`}
                    >
                      <Ban className="w-3 h-3" />
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function LoadingRow() {
  return (
    <div className="py-8 flex items-center justify-center text-slate-500 text-sm gap-2">
      <Loader2 className="w-4 h-4 animate-spin" /> Loading…
    </div>
  );
}

function EmptyBlock({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="py-10 text-center">
      {icon}
      <p className="text-sm text-slate-400 mt-2">{title}</p>
      <p className="text-xs text-slate-600 mt-1">{body}</p>
    </div>
  );
}
