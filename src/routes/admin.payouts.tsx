import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Banknote,
  Loader2,
  CheckCircle2,
  XCircle,
  Send,
  Filter,
  ChevronDown,
  ChevronUp,
  Copy,
  Clock3,
  AlertTriangle,
} from "lucide-react";
import {
  adminListPayouts,
  adminApprovePayout,
  adminRejectPayout,
  adminMarkPayoutPaid,
  adminListPayoutAudit,
  type PayoutDTO,
  type PayoutStatus,
  type PayoutAuditEntry,
} from "@/lib/payouts.functions";
import { listHeldEscrowOrders, adminReleaseOrderEscrow } from "@/lib/marketplace.functions";

export const Route = createFileRoute("/admin/payouts")({
  head: () => ({
    meta: [
      { title: "Payouts · Admin · Oventric" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminPayoutsPage,
  errorComponent: ({ error, reset }) => (
    <div className="p-6 text-red-300">
      <div className="font-bold mb-2">Payout queue error</div>
      <div className="text-sm text-red-200/80 mb-3">{error.message}</div>
      <button onClick={reset} className="px-3 py-1.5 rounded-[10px] border border-red-500/40 text-sm">
        Retry
      </button>
    </div>
  ),
  notFoundComponent: () => <div className="p-6 text-slate-400">Not found.</div>,
});

const STATUSES: (PayoutStatus | "ALL")[] = [
  "pending",
  "approved",
  "paid",
  "rejected",
  "cancelled",
  "ALL",
];

function AdminPayoutsPage() {
  const [status, setStatus] = useState<PayoutStatus | "ALL">("pending");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const listFn = useServerFn(adminListPayouts);
  const approveFn = useServerFn(adminApprovePayout);
  const rejectFn = useServerFn(adminRejectPayout);
  const paidFn = useServerFn(adminMarkPayoutPaid);
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["admin-payouts", status],
    queryFn: () => listFn({ data: { status } }),
    staleTime: 10_000,
  });

  const refetch = () => {
    qc.invalidateQueries({ queryKey: ["admin-payouts"] });
    qc.invalidateQueries({ queryKey: ["admin-payout-audit"] });
  };

  const approve = async (id: string) => {
    const note = window.prompt("Approval note (optional — visible in audit log):") ?? "";
    try {
      await approveFn({ data: { id, note } });
      toast.success("Approved");
      refetch();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const reject = async (id: string) => {
    const reason = window.prompt("Reason for rejection? (required — logged to audit trail)");
    if (!reason || !reason.trim()) return;
    try {
      await rejectFn({ data: { id, reason: reason.trim() } });
      toast.success("Rejected — funds refunded");
      refetch();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const markPaid = async (id: string) => {
    const note =
      window.prompt(
        "Reference / note for this payout (transfer ID, etc. — logged to audit trail):",
      ) ?? "";
    try {
      await paidFn({ data: { id, note } });
      toast.success("Marked as paid");
      refetch();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const items = query.data ?? [];

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <header className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl border border-sky-500/40 bg-sky-500/10 flex items-center justify-center">
          <Banknote className="w-5 h-5 text-sky-300" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-black text-white">Payout Requests</h1>
          <p className="text-xs text-slate-400">
            Review, approve, reject and settle user withdrawals.
          </p>
        </div>
      </header>

      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-slate-400" />
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`px-3 py-1.5 rounded-[10px] text-xs font-bold uppercase tracking-wider transition-colors ${
              status === s
                ? "border border-sky-500/60 bg-sky-500/10 text-sky-200"
                : "border border-[#222226] bg-[#0A0A0C] text-slate-400 hover:text-white"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-[#222226] bg-[#141418] overflow-hidden">
        {query.isLoading && (
          <div className="p-8 text-center text-slate-400 text-sm inline-flex items-center gap-2 justify-center w-full">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading payouts…
          </div>
        )}
        {!query.isLoading && items.length === 0 && (
          <div className="p-8 text-center text-slate-500 text-sm">No payouts in this status.</div>
        )}
        {items.map((p) => (
          <PayoutRow
            key={p.id}
            p={p}
            expanded={!!expanded[p.id]}
            onToggle={() => setExpanded((s) => ({ ...s, [p.id]: !s[p.id] }))}
            onApprove={() => approve(p.id)}
            onReject={() => reject(p.id)}
            onMarkPaid={() => markPaid(p.id)}
          />
        ))}
      </div>

      <HeldEscrowPanel />
    </div>
  );
}

function HeldEscrowPanel() {
  const listFn = useServerFn(listHeldEscrowOrders);
  const releaseFn = useServerFn(adminReleaseOrderEscrow);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin-held-escrow"],
    queryFn: () => listFn(),
    staleTime: 15_000,
  });
  const rows = q.data ?? [];
  const release = async (orderId: string) => {
    try {
      await releaseFn({ data: { orderId } });
      toast.success("Escrow released to seller");
      await qc.invalidateQueries({ queryKey: ["admin-held-escrow"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  return (
    <div className="rounded-2xl border border-[#222226] bg-[#141418] overflow-hidden">
      <div className="px-4 py-3 border-b border-[#222226] flex items-center gap-2">
        <Clock3 className="w-4 h-4 text-amber-300" />
        <div className="text-sm font-bold text-white">Held escrow (manual-delivery orders)</div>
        <span className="text-[10px] text-slate-500 ml-auto">
          {rows.length} order{rows.length === 1 ? "" : "s"}
        </span>
      </div>
      {q.isLoading && (
        <div className="p-6 text-center text-slate-400 text-sm inline-flex items-center gap-2 justify-center w-full">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      )}
      {!q.isLoading && rows.length === 0 && (
        <div className="p-6 text-center text-slate-500 text-sm">
          No orders currently held in escrow.
        </div>
      )}
      {rows.map((r) => (
        <div
          key={r.orderId}
          className="px-4 py-3 border-t border-[#222226] flex items-center gap-3 flex-wrap"
        >
          <div className="min-w-0 flex-1">
            <div className="text-sm text-white font-semibold truncate">{r.productName}</div>
            <div className="text-[11px] text-slate-500">
              Order {r.orderId.slice(0, 8)} · seller share ${r.sellerShareUSD.toFixed(2)} · paid{" "}
              {new Date(r.paidAt ?? r.createdAt).toLocaleDateString()}
            </div>
          </div>
          <button
            onClick={() => release(r.orderId)}
            className="px-3 py-1.5 rounded-[10px] bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold"
          >
            Release to seller
          </button>
        </div>
      ))}
    </div>
  );
}

function PayoutRow({
  p,
  expanded,
  onToggle,
  onApprove,
  onReject,
  onMarkPaid,
}: {
  p: PayoutDTO;
  expanded: boolean;
  onToggle: () => void;
  onApprove: () => void;
  onReject: () => void;
  onMarkPaid: () => void;
}) {
  const sym = p.currency === "USD" ? "$" : p.currency === "NGN" ? "₦" : "₵";
  const tone: Record<PayoutStatus, string> = {
    pending: "border-amber-500/40 bg-amber-500/10 text-amber-300",
    approved: "border-sky-500/40 bg-sky-500/10 text-sky-300",
    paid: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
    rejected: "border-red-500/40 bg-red-500/10 text-red-300",
    cancelled: "border-slate-500/40 bg-slate-500/10 text-slate-300",
  };
  const Icon =
    p.status === "paid"
      ? CheckCircle2
      : p.status === "rejected"
        ? XCircle
        : p.status === "cancelled"
          ? AlertTriangle
          : Clock3;

  return (
    <div className="border-t border-[#1c1c20] first:border-t-0">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center gap-1 rounded-[10px] border px-2 py-0.5 text-[11px] font-bold uppercase ${tone[p.status]}`}
            >
              <Icon className="w-3 h-3" /> {p.status}
            </span>
            <span className="text-sm font-bold text-white tabular-nums">
              {sym}
              {Number(p.amount).toLocaleString("en-US", {
                minimumFractionDigits: p.currency === "NGN" ? 0 : 2,
              })}{" "}
              {p.currency}
            </span>
            <span className="text-[11px] uppercase tracking-wider text-slate-500">
              via {p.method}
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-400 truncate">
            {p.requester_name ?? p.requester_username ?? p.user_id.slice(0, 8)} ·{" "}
            {new Date(p.created_at).toLocaleString()}
          </div>
        </div>
        <button
          onClick={onToggle}
          className="shrink-0 inline-flex items-center gap-1 rounded-[10px] border border-[#222226] bg-[#0A0A0C] px-3 py-1.5 text-xs text-slate-300 hover:border-white/30"
        >
          Details{" "}
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="rounded-[10px] border border-[#222226] bg-[#0A0A0C] p-3">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                Balance before
              </div>
              <div className="text-sm font-bold text-slate-100 tabular-nums">
                {sym}
                {Number(p.balance_before_request ?? 0).toLocaleString("en-US", {
                  minimumFractionDigits: p.currency === "NGN" ? 0 : 2,
                })}
              </div>
            </div>
            <div className="rounded-[10px] border border-[#222226] bg-[#0A0A0C] p-3">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                Available now
              </div>
              <div className="text-sm font-bold text-emerald-200 tabular-nums">
                {sym}
                {Number(p.wallet_available_now ?? 0).toLocaleString("en-US", {
                  minimumFractionDigits: p.currency === "NGN" ? 0 : 2,
                })}
              </div>
            </div>
            <div className="rounded-[10px] border border-[#222226] bg-[#0A0A0C] p-3">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                In escrow
              </div>
              <div className="text-sm font-bold text-amber-200 tabular-nums">
                {sym}
                {Number(p.wallet_escrow_now ?? 0).toLocaleString("en-US", {
                  minimumFractionDigits: p.currency === "NGN" ? 0 : 2,
                })}
              </div>
            </div>
          </div>

          <div className="rounded-[10px] border border-[#222226] bg-[#0A0A0C] p-3 flex items-center gap-3 flex-wrap">
            <div className="text-[10px] uppercase tracking-wider text-slate-500">KYC</div>
            {p.kyc_completed_at ? (
              <span className="inline-flex items-center gap-1 rounded-[10px] border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 px-2 py-0.5 text-[11px] font-bold">
                <CheckCircle2 className="w-3 h-3" /> Verified{" "}
                {new Date(p.kyc_completed_at).toLocaleDateString()}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-[10px] border border-red-500/40 bg-red-500/10 text-red-300 px-2 py-0.5 text-[11px] font-bold">
                <AlertTriangle className="w-3 h-3" /> Not verified
              </span>
            )}
            {p.verification_tier != null && (
              <span className="text-[11px] text-slate-400">Tier {p.verification_tier}</span>
            )}
            {p.requester_country && (
              <span className="text-[11px] text-slate-400">· {p.requester_country}</span>
            )}
          </div>

          <div className="rounded-[10px] border border-[#222226] bg-[#0A0A0C] p-3">
            <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">
              Destination
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {Object.entries(p.destination ?? {}).map(([k, v]) => (
                <div
                  key={k}
                  className="grid grid-cols-[110px_minmax(0,1fr)_auto] items-center gap-2"
                >
                  <span className="text-slate-500 capitalize">{k.replace(/_/g, " ")}</span>
                  <span className="text-slate-100 truncate font-mono">{String(v)}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(String(v));
                      toast.success("Copied");
                    }}
                    className="text-slate-500 hover:text-white"
                    title="Copy"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {(p.admin_note || p.reject_reason) && (
            <div className="text-xs text-slate-400">
              {p.admin_note && (
                <div>
                  <span className="text-slate-500">Note:</span> {p.admin_note}
                </div>
              )}
              {p.reject_reason && (
                <div>
                  <span className="text-slate-500">Reason:</span> {p.reject_reason}
                </div>
              )}
              {p.processed_at && (
                <div className="text-slate-500">
                  Processed {new Date(p.processed_at).toLocaleString()}
                </div>
              )}
            </div>
          )}

          <PayoutAuditTrail payoutId={p.id} expanded={expanded} />

          <div className="flex items-center gap-2 flex-wrap">
            {p.status === "pending" && (
              <>
                <button
                  onClick={onApprove}
                  className="inline-flex items-center gap-1.5 rounded-[10px] bg-sky-500 hover:bg-sky-400 text-black font-bold px-3 py-1.5 text-xs"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                </button>
                <button
                  onClick={onMarkPaid}
                  className="inline-flex items-center gap-1.5 rounded-[10px] bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-3 py-1.5 text-xs"
                >
                  <Send className="w-3.5 h-3.5" /> Mark paid
                </button>
                <button
                  onClick={onReject}
                  className="inline-flex items-center gap-1.5 rounded-[10px] border border-red-500/50 text-red-300 hover:bg-red-500/10 font-bold px-3 py-1.5 text-xs"
                >
                  <XCircle className="w-3.5 h-3.5" /> Reject & refund
                </button>
              </>
            )}
            {p.status === "approved" && (
              <>
                <button
                  onClick={onMarkPaid}
                  className="inline-flex items-center gap-1.5 rounded-[10px] bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-3 py-1.5 text-xs"
                >
                  <Send className="w-3.5 h-3.5" /> Mark paid
                </button>
                <button
                  onClick={onReject}
                  className="inline-flex items-center gap-1.5 rounded-[10px] border border-red-500/50 text-red-300 hover:bg-red-500/10 font-bold px-3 py-1.5 text-xs"
                >
                  <XCircle className="w-3.5 h-3.5" /> Reject & refund
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const AUDIT_LABEL: Record<string, { label: string; tone: string }> = {
  "payout.approve": { label: "Approved", tone: "border-sky-500/40 bg-sky-500/10 text-sky-300" },
  "payout.reject": { label: "Rejected", tone: "border-red-500/40 bg-red-500/10 text-red-300" },
  "payout.mark_paid": {
    label: "Marked paid",
    tone: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  },
};

function PayoutAuditTrail({ payoutId, expanded }: { payoutId: string; expanded: boolean }) {
  const auditFn = useServerFn(adminListPayoutAudit);
  const q = useQuery({
    queryKey: ["admin-payout-audit", payoutId],
    queryFn: () => auditFn({ data: { payoutId } }),
    enabled: expanded,
    staleTime: 10_000,
  });

  const entries: PayoutAuditEntry[] = q.data ?? [];

  return (
    <div className="rounded-[10px] border border-[#222226] bg-[#0A0A0C] p-3">
      <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">Audit trail</div>
      {q.isLoading && (
        <div className="text-xs text-slate-500 inline-flex items-center gap-2">
          <Loader2 className="w-3 h-3 animate-spin" /> Loading history…
        </div>
      )}
      {!q.isLoading && entries.length === 0 && (
        <div className="text-xs text-slate-500">No admin actions recorded yet.</div>
      )}
      {entries.length > 0 && (
        <ol className="space-y-2">
          {entries.map((e) => {
            const meta = AUDIT_LABEL[e.action] ?? {
              label: e.action,
              tone: "border-slate-500/40 bg-slate-500/10 text-slate-300",
            };
            const actor =
              e.actor_name ||
              e.actor_username ||
              (e.actor_id ? `${e.actor_id.slice(0, 8)}…` : "system");
            const reason =
              (typeof e.meta?.reason === "string" && e.meta.reason) ||
              (typeof e.meta?.note === "string" && e.meta.note) ||
              "";
            return (
              <li key={e.id} className="grid grid-cols-[auto_minmax(0,1fr)] gap-2 text-xs">
                <span
                  className={`inline-flex items-center rounded-[10px] border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${meta.tone}`}
                >
                  {meta.label}
                </span>
                <div className="min-w-0">
                  <div className="text-slate-200">
                    <span className="font-medium">{actor}</span>
                    <span className="text-slate-500">
                      {" "}
                      · {new Date(e.created_at).toLocaleString()}
                    </span>
                  </div>
                  {reason && (
                    <div className="text-slate-400 break-words">
                      <span className="text-slate-500">Reason:</span> {reason}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
