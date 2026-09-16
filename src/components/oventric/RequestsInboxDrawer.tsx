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

  // Lock body scroll while open
  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

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
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-sm h-full bg-white border-l border-slate-200 shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-200">
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#E5484D]">
              Follow requests
            </div>
            <h2 id="requests-inbox-title" className="text-slate-900 font-bold text-lg mt-0.5">
              Approve who connects with you
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 -m-2 rounded-full text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {err && (
            <p role="alert" className="text-xs text-[#E5484D] border-l-2 border-[#E5484D] pl-2">
              {err}
            </p>
          )}

          {followRows === null ? (
            <LoadingRow />
          ) : followRows.length === 0 ? (
            <EmptyBlock
              icon={<UserPlus className="w-6 h-6 text-slate-300 mx-auto" />}
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
                  className="flex items-center gap-3 p-3 rounded-[10px] bg-white border border-slate-200 shadow-sm"
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
                      <div className="w-10 h-10 rounded-full bg-[#E5484D]/10 text-[#E5484D] flex items-center justify-center">
                        <UserIcon className="w-4 h-4" />
                      </div>
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-slate-900 font-semibold truncate">
                      {r.requesterName}
                    </div>
                    <div className="text-[11px] text-slate-500">wants to follow you</div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => actFollow(r.requesterId, acceptFollow)}
                      disabled={busy === r.requesterId}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-[#E5484D] text-white text-xs font-bold hover:bg-[#d13f44] disabled:opacity-60 transition-colors"
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
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 disabled:opacity-60 transition-colors"
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
    <div className="py-8 flex items-center justify-center text-slate-400 text-sm gap-2">
      <Loader2 className="w-4 h-4 animate-spin" /> Loading…
    </div>
  );
}

function EmptyBlock({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="py-10 text-center">
      {icon}
      <p className="text-sm text-slate-600 mt-2 font-medium">{title}</p>
      <p className="text-xs text-slate-400 mt-1">{body}</p>
    </div>
  );
}
