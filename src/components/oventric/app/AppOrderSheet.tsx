import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Loader2, MessageCircle, ShieldAlert, Truck, ExternalLink } from "lucide-react";
import { AppSheet } from "./AppSheet";
import { buyerConfirmReceipt, markOrderDelivered, openOrderDispute } from "@/lib/fulfilment.functions";
import type { EscrowInboxItem } from "@/lib/escrow-inbox.functions";
import { formatMoney } from "@/lib/fx-display";
import { haptic } from "@/lib/haptics";

const REASONS = [
  { v: "not_delivered", l: "Not delivered" },
  { v: "wrong_item", l: "Wrong item" },
  { v: "not_working", l: "Not working" },
  { v: "seller_unreachable", l: "Seller unreachable" },
  { v: "other", l: "Other" },
] as const;

function when(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Native order detail sheet: timeline + confirm / deliver / dispute without leaving the list. */
export function AppOrderSheet({ order, onClose }: { order: EscrowInboxItem | null; onClose: () => void }) {
  const qc = useQueryClient();
  const confirm = useServerFn(buyerConfirmReceipt);
  const deliver = useServerFn(markOrderDelivered);
  const dispute = useServerFn(openOrderDispute);
  const [busy, setBusy] = useState(false);
  const [disputing, setDisputing] = useState(false);
  const [reason, setReason] = useState<(typeof REASONS)[number]["v"]>("not_delivered");
  const [details, setDetails] = useState("");

  const o = order;
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      haptic("success");
      toast.success(ok);
      await qc.invalidateQueries({ queryKey: ["escrow-inbox"] });
      setDisputing(false);
      setDetails("");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const open = !!o && o.escrowStatus === "held";
  const disputeOpen = o?.disputeStatus === "open";
  const canConfirm = open && !disputeOpen && o?.role === "buyer" && !!o.deliveredAt && !o.buyerConfirmedAt;
  const canDeliver = open && !disputeOpen && o?.role === "seller" && !o.deliveredAt;
  const canDispute = open && !disputeOpen && o?.role === "buyer" && !o.buyerConfirmedAt;

  const steps = o
    ? [
        { l: "Paid", t: when(o.paidAt ?? o.createdAt), done: true },
        { l: "Delivered", t: when(o.deliveredAt), done: !!o.deliveredAt },
        { l: "Confirmed", t: when(o.buyerConfirmedAt), done: !!o.buyerConfirmedAt },
        {
          l: o.escrowStatus === "refunded" ? "Refunded" : "Released",
          t: when(o.releasedAt),
          done: o.escrowStatus !== "held",
        },
      ]
    : [];

  return (
    <AppSheet open={!!o} onClose={onClose}>
      {o && (
        <div className="px-5 pb-8 pt-2 text-white">
          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-white/35">
            {o.role === "buyer" ? "Your purchase" : "Your sale"}
          </p>
          <h2 className="mt-1 text-[18px] font-bold leading-tight">{o.productName}</h2>
          <p className="mt-1 text-[12px] text-white/45">
            {o.role === "buyer" ? "Seller" : "Buyer"} · {o.counterpartyName}
            {o.quantity > 1 ? ` · ×${o.quantity}` : ""}
          </p>
          <p className="mt-3 text-[22px] font-bold text-[#E5484D]">{formatMoney(o.displayTotal, o.displayCurrency)}</p>

          {disputeOpen && (
            <div className="mt-4 flex gap-2 rounded-2xl border border-[#E5484D]/25 bg-[#E5484D]/10 p-3 text-[12px] text-[#ff8a8e]">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              Under review by Oventric support. Timers are frozen.
            </div>
          )}

          {/* Timeline */}
          <div className="mt-5 space-y-0">
            {steps.map((s, i) => (
              <div key={s.l} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className={`mt-0.5 h-3 w-3 rounded-full ${s.done ? "bg-[#E5484D] shadow-[0_0_10px_rgba(229,72,77,0.6)]" : "border border-white/20"}`} />
                  {i < steps.length - 1 && <span className={`w-px flex-1 ${s.done ? "bg-[#E5484D]/50" : "bg-white/10"}`} />}
                </div>
                <div className="pb-4">
                  <p className={`text-[13px] font-semibold ${s.done ? "text-white/90" : "text-white/35"}`}>{s.l}</p>
                  {s.t && <p className="text-[10.5px] text-white/35">{s.t}</p>}
                </div>
              </div>
            ))}
          </div>

          {disputing ? (
            <div className="mt-2 space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {REASONS.map((r) => (
                  <button
                    key={r.v}
                    onClick={() => setReason(r.v)}
                    className={`rounded-full border px-3 py-1.5 text-[11.5px] font-semibold ${reason === r.v ? "border-[#E5484D] bg-[#E5484D]/15 text-[#ff8a8e]" : "border-white/10 text-white/50"}`}
                  >
                    {r.l}
                  </button>
                ))}
              </div>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={3}
                placeholder="Tell us what went wrong (at least 10 characters)"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-[13px] text-white placeholder:text-white/30 outline-none focus:border-[#E5484D]/50"
              />
              <div className="flex gap-2">
                <button onClick={() => setDisputing(false)} className="flex-1 rounded-full border border-white/10 py-3 text-[13px] font-semibold text-white/60">
                  Cancel
                </button>
                <button
                  disabled={busy || details.trim().length < 10}
                  onClick={() => run(() => dispute({ data: { orderId: o.orderId, reason, details: details.trim() } }), "Problem reported — support is on it")}
                  className="flex-1 rounded-full bg-[#E5484D] py-3 text-[13px] font-semibold disabled:opacity-40"
                  style={{ color: "#ffffff" }}
                >
                  {busy ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Submit report"}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-2 space-y-2">
              {canConfirm && (
                <button
                  disabled={busy}
                  onClick={() => run(() => confirm({ data: { orderId: o.orderId } }), "Receipt confirmed")}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-[#E5484D] py-3.5 text-[14px] font-semibold shadow-[0_8px_24px_rgba(229,72,77,0.35)]"
                  style={{ color: "#ffffff" }}
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Confirm receipt
                </button>
              )}
              {canDeliver && (
                <button
                  disabled={busy}
                  onClick={() => run(() => deliver({ data: { orderId: o.orderId } }), "Marked as delivered")}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-[#E5484D] py-3.5 text-[14px] font-semibold shadow-[0_8px_24px_rgba(229,72,77,0.35)]"
                  style={{ color: "#ffffff" }}
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />} Mark as delivered
                </button>
              )}
              <div className="flex gap-2">
                <Link to="/messages" className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-white/10 py-3 text-[12.5px] font-semibold text-white/75">
                  <MessageCircle className="h-4 w-4" /> Chat
                </Link>
                <Link to="/order/$id" params={{ id: o.orderId }} className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-white/10 py-3 text-[12.5px] font-semibold text-white/75">
                  <ExternalLink className="h-4 w-4" /> Full order
                </Link>
              </div>
              {canDispute && (
                <button onClick={() => setDisputing(true)} className="w-full py-2 text-[12px] font-semibold text-white/40">
                  Report a problem
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </AppSheet>
  );
}
