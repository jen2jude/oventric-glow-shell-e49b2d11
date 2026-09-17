import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { X, Loader2, UserPlus, User as UserIcon } from "lucide-react";
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
      className="modal-light fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="requests-inbox-title"
    >
      <div
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-xl animate-in fade-in duration-200"
        onClick={onClose}
      />
      <div className="relative w-full max-w-[480px] bg-white rounded-[32px] sm:rounded-[42px] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.25)] border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 sm:px-10 pt-7 sm:pt-10 pb-6 sm:pb-8 flex items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#E5484D]">
              Follow requests
            </div>
            <h2
              id="requests-inbox-title"
              className="font-[Sora] text-2xl sm:text-3xl font-bold tracking-tight text-slate-900"
            >
              Requests
            </h2>
            <p className="text-sm sm:text-[15px] font-medium text-slate-400">
              {followRows === null
                ? "Checking for new requests…"
                : followCount === 0
                  ? "Approve who connects with you"
                  : `${followCount} ${followCount === 1 ? "person wants" : "people want"} to follow you`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-11 h-11 sm:w-12 sm:h-12 shrink-0 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all group"
            aria-label="Close"
          >
            <X className="w-5 h-5 transition-transform group-hover:rotate-90" />
          </button>
        </div>

        {/* Body */}
        <div className="px-3 sm:px-4 pb-6 sm:pb-8 space-y-2 max-h-[55vh] sm:max-h-[560px] overflow-y-auto">
          {err && (
            <p role="alert" className="mx-3 text-xs text-[#E5484D] border-l-2 border-[#E5484D] pl-2">
              {err}
            </p>
          )}

          {followRows === null ? (
            <div className="py-10 flex items-center justify-center text-slate-400 text-sm gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : followRows.length === 0 ? (
            <div className="py-12 text-center px-6">
              <div className="w-14 h-14 mx-auto rounded-full bg-slate-50 flex items-center justify-center">
                <UserPlus className="w-6 h-6 text-slate-300" />
              </div>
              <p className="text-sm text-slate-600 mt-3 font-semibold">No pending follow requests.</p>
              <p className="text-xs text-slate-400 mt-1">
                When someone asks to follow you, it will appear here.
              </p>
            </div>
          ) : (
            followRows.map((r) => (
              <div
                key={r.requesterId}
                className="group flex items-center gap-3 sm:gap-4 p-3 sm:p-4 hover:bg-slate-50 rounded-[24px] sm:rounded-[32px] transition-all duration-300"
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
                    <img
                      loading="lazy"
                      decoding="async"
                      src={r.avatarUrl}
                      alt=""
                      className="w-12 h-12 sm:w-16 sm:h-16 rounded-full object-cover bg-slate-100 shadow-inner"
                    />
                  ) : (
                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-[#E5484D]/10 text-[#E5484D] flex items-center justify-center shadow-inner">
                      <UserIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                  )}
                </button>

                <div className="flex-grow min-w-0">
                  <div className="font-bold text-slate-900 truncate text-[15px] sm:text-base">
                    {r.requesterName}
                  </div>
                  <p className="text-xs sm:text-sm font-medium text-slate-400 truncate">
                    wants to follow you
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => actFollow(r.requesterId, acceptFollow)}
                    disabled={busy === r.requesterId}
                    className="h-10 sm:h-11 px-4 sm:px-6 inline-flex items-center justify-center gap-1.5 bg-[#E5484D] hover:bg-[#d13f44] text-white text-sm font-bold rounded-2xl transition-all active:scale-95 shadow-lg shadow-red-900/10 disabled:opacity-60"
                    aria-label={`Accept ${r.requesterName}`}
                  >
                    {busy === r.requesterId ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Accept"
                    )}
                  </button>
                  <button
                    onClick={() => actFollow(r.requesterId, declineFollow)}
                    disabled={busy === r.requesterId}
                    className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl transition-all active:scale-95 disabled:opacity-60"
                    aria-label={`Decline ${r.requesterName}`}
                  >
                    <X className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
