import { Flag, X, Loader2, AlertTriangle, WifiOff, RefreshCw, LifeBuoy } from "lucide-react";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { submitReport } from "@/lib/reports.functions";

type ErrorKind = "network" | "auth" | "rate" | "validation" | "server" | "unknown";

interface ReportError {
  kind: ErrorKind;
  title: string;
  message: string;
}

function classifyError(e: unknown): ReportError {
  const raw = e instanceof Error ? e.message : typeof e === "string" ? e : "Unexpected error";
  const msg = raw.toLowerCase();

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return {
      kind: "network",
      title: "You're offline",
      message: "Reconnect to the internet and try submitting again.",
    };
  }
  if (msg.includes("failed to fetch") || msg.includes("network") || msg.includes("timeout")) {
    return {
      kind: "network",
      title: "Network hiccup",
      message: "We couldn't reach the server. Check your connection and retry.",
    };
  }
  if (msg.includes("unauthorized") || msg.includes("401") || msg.includes("auth")) {
    return {
      kind: "auth",
      title: "Session expired",
      message: "Your session ended. Refresh the page and try again.",
    };
  }
  if (msg.includes("rate") || msg.includes("429") || msg.includes("too many")) {
    return {
      kind: "rate",
      title: "Slow down a moment",
      message: "You've submitted too many reports quickly. Wait a minute and retry.",
    };
  }
  if (msg.includes("validation") || msg.includes("invalid") || msg.includes("parse")) {
    return {
      kind: "validation",
      title: "Report couldn't be sent",
      message: "The details look off. Pick a reason and keep notes under 280 characters.",
    };
  }
  if (msg.includes("500") || msg.includes("server") || msg.includes("insert")) {
    return {
      kind: "server",
      title: "Our servers are struggling",
      message: "Something went wrong on our side. Try again in a moment.",
    };
  }
  return {
    kind: "unknown",
    title: "Couldn't submit report",
    message: raw,
  };
}

const REASONS = [
  { id: "spam", label: "Spam", desc: "Unsolicited promotions, mass posting, or bots." },
  { id: "harassment", label: "Harassment", desc: "Hate speech, targeted abuse, or threats." },
  {
    id: "ip",
    label: "Intellectual Property",
    desc: "Copyright, trademark, or code license violation.",
  },
  { id: "scam", label: "Scam", desc: "Phishing, impersonation, or fraudulent listings." },
] as const;

type ReasonId = (typeof REASONS)[number]["id"];

export function ReportModal({
  open,
  onClose,
  target,
  targetId,
  targetKind = "post",
  onReported,
}: {
  open: boolean;
  onClose: () => void;
  target?: string;
  targetId?: string;
  targetKind?: string;
  onReported?: (
    targetId: string,
    details: { reason: string; reasonLabel: string; note: string | null },
  ) => void;
}) {
  const submit = useServerFn(submitReport);
  const [reason, setReason] = useState<ReasonId | "">("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<ReportError | null>(null);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (!open) {
      setReason("");
      setNote("");
      setSubmitted(false);
      setSubmitting(false);
      setError(null);
      setAttempts(0);
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!reason || !targetId) return;
    setSubmitting(true);
    setError(null);
    try {
      await submit({
        data: {
          targetId,
          targetKind,
          reason,
          note: note.trim() || null,
        },
      });
      setSubmitted(true);
      onReported?.(targetId, {
        reason,
        reasonLabel: REASONS.find((r) => r.id === reason)?.label ?? reason,
        note: note.trim() || null,
      });
      toast.success("Report submitted", {
        description: "Trust & safety will review it within 24h.",
      });
      setTimeout(onClose, 1400);
    } catch (e) {
      console.error("[ReportModal] submit failed", e);
      const err = classifyError(e);
      setError(err);
      setAttempts((n) => n + 1);
      toast.error(err.title, { description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-light fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-[#1E1E24] border border-white/10 rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-2xl">
        <header className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Flag className="w-4 h-4 text-[#FF3EB5]" />
            <span className="text-white font-semibold text-sm">Report {target ?? "content"}</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-[10px] hover:bg-white/5 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </header>

        {submitted ? (
          <div className="p-8 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center mb-3">
              <Flag className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-white font-semibold text-sm">Report submitted</div>
            <p className="text-xs text-slate-400 mt-1">
              Our trust &amp; safety team will review within 24h.
            </p>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <p className="text-xs text-slate-400">
              Choose the reason that best describes the issue.
            </p>
            <div className="grid gap-2">
              {REASONS.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setReason(r.id)}
                  className={`text-left p-3 rounded-[10px] border transition-colors ${
                    reason === r.id
                      ? "border-[#FF3EB5]/60 bg-[#FF3EB5]/10"
                      : "border-white/10 bg-black/20 hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-white">{r.label}</span>
                    <span
                      className={`w-3.5 h-3.5 rounded-full border ${
                         reason === r.id ? "bg-[#A7FF16] border-[#A7FF16]" : "border-white/30"
                      }`}
                    />
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{r.desc}</div>
                </button>
              ))}
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">
                Add a short custom reason (optional)
              </label>
              <textarea
                rows={3}
                maxLength={280}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Tell us anything else that helps us review this…"
                 className="w-full bg-black/30 border border-white/10 rounded-[10px] px-3 py-3 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-[#FF3EB5]/60"
              />
              <div className="text-[10px] text-slate-500 text-right mt-1">{note.length}/280</div>
            </div>
            {error && (
              <div
                role="alert"
                aria-live="polite"
                className="rounded-[10px] border border-red-500/40 bg-red-500/10 p-3"
              >
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 shrink-0 text-red-300">
                    {error.kind === "network" ? (
                      <WifiOff className="w-4 h-4" />
                    ) : (
                      <AlertTriangle className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-red-200">{error.title}</div>
                    <p className="mt-0.5 text-[11px] text-red-200/80 leading-relaxed">
                      {error.message}
                    </p>
                    {attempts >= 2 && (
                      <a
                        href="mailto:support@oventric.app?subject=Report%20submission%20failing"
                        className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-red-200 underline underline-offset-2 hover:text-red-100"
                      >
                        <LifeBuoy className="w-3 h-3" /> Contact support
                      </a>
                    )}
                  </div>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="shrink-0 inline-flex items-center gap-1 rounded-[10px] border border-red-400/40 bg-red-500/10 px-2 py-1 text-[11px] font-bold text-red-100 hover:bg-red-500/20 disabled:opacity-40"
                  >
                    <RefreshCw className={`w-3 h-3 ${submitting ? "animate-spin" : ""}`} />
                    Retry
                  </button>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={onClose}
                disabled={submitting}
                className="flex-1 px-4 py-3 rounded-[10px] border border-white/10 text-slate-300 hover:bg-white/5 text-sm disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!reason || submitting || !targetId}
                 className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-[10px] bg-[#FF3EB5] hover:bg-[#FF7ACD] disabled:opacity-40 disabled:cursor-not-allowed text-[#070A08] font-semibold text-sm"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {submitting ? "Submitting…" : error ? "Try again" : "Submit report"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
