import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle, Receipt, ExternalLink } from "lucide-react";
import {
  adminListManualPayments,
  adminReviewManualPayment,
  getManualProofUrl,
} from "@/lib/manual-payments.functions";
import { formatMoney } from "@/lib/fx-display";

export const Route = createFileRoute("/admin/manual-payments")({
  head: () => ({
    meta: [
      { title: "MiniPay Payments · Admin · Oventric" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminManualPaymentsPage,
  errorComponent: ({ error, reset }) => (
    <div className="p-6 text-red-300">
      <div className="font-bold mb-2">MiniPay queue error</div>
      <div className="text-sm text-red-200/80 mb-3">{error.message}</div>
      <button onClick={reset} className="px-3 py-1.5 rounded-[10px] border border-red-500/40 text-sm">
        Retry
      </button>
    </div>
  ),
});

const STATUSES = ["pending", "approved", "rejected", "cancelled", "ALL"] as const;

function AdminManualPaymentsPage() {
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("pending");
  const [busyId, setBusyId] = useState<string | null>(null);

  const listFn = useServerFn(adminListManualPayments);
  const reviewFn = useServerFn(adminReviewManualPayment);
  const proofFn = useServerFn(getManualProofUrl);
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["admin-manual-payments", status],
    queryFn: () => listFn({ data: { status } }),
    staleTime: 10_000,
  });

  const review = async (id: string, approve: boolean) => {
    const reason = approve
      ? null
      : (window.prompt("Reason for rejection (shown to the payer)") ?? "");
    if (!approve && !reason) return;
    setBusyId(id);
    try {
      await reviewFn({ data: { id, approve, reason } });
      toast.success(approve ? "Payment approved and settled" : "Payment rejected");
      await qc.invalidateQueries({ queryKey: ["admin-manual-payments"] });
    } catch (e) {
      toast.error("Review failed", { description: e instanceof Error ? e.message : "Try again." });
    } finally {
      setBusyId(null);
    }
  };

  const openProof = async (path: string) => {
    try {
      const { url } = await proofFn({ data: { path } });
      if (url) window.open(url, "_blank", "noopener,noreferrer");
      else toast.error("Proof unavailable");
    } catch {
      toast.error("Could not open proof");
    }
  };

  const rows = query.data ?? [];

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <header className="flex items-center gap-3">
        <Receipt className="w-5 h-5 text-emerald-400" />
        <h1 className="text-lg font-black text-white">MiniPay Payments</h1>
      </header>

      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`px-3 py-1.5 rounded-[10px] text-xs font-bold uppercase tracking-wider border ${
              status === s
                ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300"
                : "bg-[#1E1E24] border-white/10 text-slate-400"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {query.isLoading && (
        <div className="py-16 text-center">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-400 mx-auto" />
        </div>
      )}

      {!query.isLoading && rows.length === 0 && (
        <p className="text-sm text-slate-500 py-10 text-center">Nothing here.</p>
      )}

      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.id} className="rounded-xl border border-white/10 bg-[#1E1E24] p-4 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm text-white font-bold truncate">
                  {r.targetLabel ?? r.purpose}
                </div>
                <div className="text-[11px] text-slate-500 font-mono">{r.reference}</div>
                <div className="text-xs text-slate-400 mt-1">
                  {r.payerName ?? r.payerUsername ?? r.userId.slice(0, 8)} · {r.purpose}
                </div>
              </div>
              <div className="text-right">
                <div className="text-base font-black text-white">
                  {formatMoney(r.amount, r.currency)}
                </div>
                <div className="text-[11px] text-slate-500">≈ ${r.amountUsd.toFixed(2)}</div>
              </div>
            </div>

            {r.payerNote && <p className="text-xs text-slate-400 italic">“{r.payerNote}”</p>}
            {r.rejectReason && <p className="text-xs text-rose-400">{r.rejectReason}</p>}

            <div className="flex flex-wrap items-center gap-2">
              {r.proofPath ? (
                <button
                  onClick={() => openProof(r.proofPath!)}
                  className="px-3 py-1.5 rounded-[10px] bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-200 inline-flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> View receipt
                </button>
              ) : (
                <span className="text-[11px] text-amber-300">No receipt uploaded yet</span>
              )}

              {r.status === "pending" && (
                <>
                  <button
                    onClick={() => review(r.id, true)}
                    disabled={busyId === r.id}
                    className="px-3 py-1.5 rounded-[10px] bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-black text-xs font-black inline-flex items-center gap-1.5"
                  >
                    {busyId === r.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                    Approve &amp; settle
                  </button>
                  <button
                    onClick={() => review(r.id, false)}
                    disabled={busyId === r.id}
                    className="px-3 py-1.5 rounded-[10px] bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 disabled:opacity-60 text-rose-300 text-xs font-bold inline-flex items-center gap-1.5"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Reject
                  </button>
                </>
              )}

              {r.status !== "pending" && (
                <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400">
                  {r.status}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
