import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Loader2, CreditCard, X, ShieldCheck } from "lucide-react";
import {
  adminListPayments,
  adminGetPaymentDetail,
  adminPaymentRailStatus,
  type AdminPaymentRow,
} from "@/lib/admin-finance.functions";

export const Route = createFileRoute("/admin/payments")({
  head: () => ({
    meta: [
      { title: "Payments · Admin · Oventric" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminPaymentsPage,
  errorComponent: ({ error, reset }) => (
    <div className="p-6 text-red-300">
      <div className="font-bold mb-2">Payments error</div>
      <div className="text-sm text-red-200/80 mb-3">{error.message}</div>
      <button onClick={reset} className="px-3 py-1.5 rounded-[10px] border border-red-500/40 text-sm">
        Retry
      </button>
    </div>
  ),
  notFoundComponent: () => <div className="p-6 text-slate-400">Not found.</div>,
});

const money = (v: number | null | undefined, cur?: string | null) =>
  v == null ? "—" : `${cur ? `${cur} ` : ""}${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function AdminPaymentsPage() {
  const listFn = useServerFn(adminListPayments);
  const detailFn = useServerFn(adminGetPaymentDetail);
  const railFn = useServerFn(adminPaymentRailStatus);

  const [purpose, setPurpose] = useState<"all" | "order" | "wallet_funding">("all");
  const [status, setStatus] = useState("ALL");
  const [provider, setProvider] = useState<"all" | "paystack" | "flutterwave">("all");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selected, setSelected] = useState<AdminPaymentRow | null>(null);

  const rails = useQuery({ queryKey: ["admin-rails"], queryFn: () => railFn(), staleTime: 60_000 });
  const list = useQuery({
    queryKey: ["admin-payments", purpose, status, provider, q, from, to],
    queryFn: () => listFn({ data: { purpose, status, provider, q, from, to } }),
    staleTime: 10_000,
  });

  const detail = useQuery({
    queryKey: ["admin-payment-detail", selected?.key],
    enabled: !!selected,
    queryFn: () =>
      detailFn({
        data: { reference: selected?.reference ?? "", orderId: selected?.orderId ?? "" },
      }),
  });

  const rows = list.data ?? [];
  const totals = useMemo(() => {
    const settled = rows.filter((r) => r.settled).length;
    return { count: rows.length, settled };
  }, [rows]);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <header className="mb-4">
        <h1 className="text-white text-2xl font-black flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-emerald-400" /> Payments
        </h1>
        <p className="text-sm text-slate-400">
          Authoritative gateway payments — marketplace purchases and wallet funding. Read-only:
          payment status is set by provider verification and webhooks, never from this screen.
        </p>
      </header>

      {rails.data && (
        <div className="mb-4 flex flex-wrap gap-2 text-[11px]">
          <Pill ok={rails.data.paystackEnabled} label={`Paystack ${rails.data.paystackEnabled ? "enabled" : "off"}`} />
          <Pill ok={rails.data.paystackLiveKey} label={rails.data.paystackKeyConfigured ? (rails.data.paystackLiveKey ? "Live secret key" : "Test secret key") : "No secret key"} />
          <Pill ok={rails.data.flutterwaveEnabled} label={`Flutterwave ${rails.data.flutterwaveEnabled ? "enabled" : "off"}`} />
          <Pill ok={!rails.data.minipayEnabled} label={`MiniPay ${rails.data.minipayEnabled ? "ENABLED" : "disabled (legacy)"}`} />
          <span className="px-2 py-1 rounded-[10px] bg-white/5 border border-white/10 text-slate-300">
            {rails.data.webhookEventsRecorded} webhook events recorded
          </span>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Reference, order, buyer or seller"
          className="flex-1 min-w-[220px] bg-[#0b0b0d] border border-white/10 rounded-[10px] px-3 py-2 text-sm text-white placeholder:text-slate-600"
        />
        <Select value={purpose} onChange={(v) => setPurpose(v as typeof purpose)} options={[["all", "All purposes"], ["order", "Marketplace order"], ["wallet_funding", "Wallet funding"]]} />
        <Select value={status} onChange={setStatus} options={[["ALL", "All statuses"], ["paid", "paid"], ["pending", "pending"], ["failed", "failed"], ["refunded", "refunded"], ["success", "success"]]} />
        <Select value={provider} onChange={(v) => setProvider(v as typeof provider)} options={[["all", "All providers"], ["paystack", "Paystack"], ["flutterwave", "Flutterwave"]]} />
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="bg-[#0b0b0d] border border-white/10 rounded-[10px] px-3 py-2 text-sm text-white" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="bg-[#0b0b0d] border border-white/10 rounded-[10px] px-3 py-2 text-sm text-white" />
      </div>

      <div className="text-xs text-slate-500 mb-2">
        {totals.count} payments · {totals.settled} settled
      </div>

      <div className="bg-[#141418] border border-white/10 rounded-xl overflow-hidden">
        {list.isLoading ? (
          <div className="p-8 text-center"><Loader2 className="w-5 h-5 animate-spin text-slate-500 inline" /></div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">No payments match these filters.</div>
        ) : (
          <div className="divide-y divide-white/5">
            {rows.map((r) => (
              <button
                key={r.key}
                onClick={() => setSelected(r)}
                className="w-full text-left p-3 hover:bg-white/[0.03] flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="text-white text-sm font-semibold truncate">
                    {r.reference ?? "No reference"}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {r.purpose === "order" ? "Marketplace order" : "Wallet funding"} ·{" "}
                    {r.userName ?? r.userId.slice(0, 8)}
                    {r.counterpartyName ? ` → ${r.counterpartyName}` : ""} ·{" "}
                    {new Date(r.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-white font-mono text-sm">{money(r.amount, r.currency)}</div>
                  <div className="text-[10px] uppercase tracking-widest font-bold text-slate-400">
                    {r.provider} · {r.status} {r.settled ? "· settled" : ""}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <AdminCryptoDeposits />



      {selected && (
        <div className="fixed inset-0 z-50 bg-black/70 flex justify-end" onClick={() => setSelected(null)}>
          <div
            className="w-full max-w-xl h-full overflow-y-auto bg-[#0f0f12] border-l border-white/10 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-white font-black text-lg">Payment detail</h2>
                <p className="text-xs text-slate-500 font-mono">{selected.reference ?? "No reference"}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {detail.isLoading || !detail.data ? (
              <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
            ) : (
              <div className="space-y-5 text-sm">
                <Block title="Payment">
                  <Row k="Purpose" v={detail.data.purpose === "order" ? "Marketplace order" : "Wallet funding"} />
                  <Row k="Provider" v={detail.data.provider} />
                  <Row k="Status" v={detail.data.status} />
                  <Row k="Created" v={detail.data.createdAt ? new Date(detail.data.createdAt).toLocaleString() : "—"} />
                  <Row k="Webhooks" v={detail.data.webhookEvents.length === 0 ? "No webhook recorded" : detail.data.webhookEvents.map((w) => w.event).join(", ")} />
                </Block>

                {detail.data.order && (
                  <Block title="Settlement (server-computed)">
                    <Row k="Order" v={detail.data.order.id} />
                    <Row k="Product" v={detail.data.order.productName ?? "—"} />
                    <Row k="Buyer" v={detail.data.order.buyerName ?? "—"} />
                    <Row k="Seller" v={detail.data.order.sellerName ?? "—"} />
                    <Row k="Charged" v={money(detail.data.order.displayTotal, detail.data.order.displayCurrency)} />
                    <Row k="Order value (USD)" v={money(detail.data.order.totalUsd, "USD")} />
                    <Row k="FX rate applied" v={detail.data.order.fxRate ? String(detail.data.order.fxRate) : "—"} />
                    <Row k="Coupon" v={detail.data.order.couponCode ? `${detail.data.order.couponCode} · −${money(detail.data.order.couponDiscountUsd, "USD")}` : "None"} />
                    <Row k="Seller share (80%)" v={money(detail.data.order.sellerShareUsd, "USD")} />
                    <Row k="Oventric share (20%)" v={money(detail.data.order.platformShareUsd, "USD")} />
                    <Row k="Cashback (seller-funded)" v={money(detail.data.order.cashbackUsd, "USD")} />
                    <Row k="Escrow" v={detail.data.order.escrowStatus ?? "—"} />
                    <Row k="Dispute" v={detail.data.order.disputeStatus ?? "none"} />
                    <Row k="Paid at" v={detail.data.order.paidAt ? new Date(detail.data.order.paidAt).toLocaleString() : "—"} />
                    <Row k="Released at" v={detail.data.order.releasedAt ? new Date(detail.data.order.releasedAt).toLocaleString() : "—"} />
                    <Row k="Refunded" v={detail.data.order.refundedAt ? `${new Date(detail.data.order.refundedAt).toLocaleString()} · ${detail.data.order.refundReason ?? ""}` : "No"} />
                  </Block>
                )}

                {detail.data.funding && (
                  <Block title="Wallet funding">
                    <Row k="User" v={detail.data.funding.userName ?? "—"} />
                    <Row k="Amount" v={money(detail.data.funding.amount, detail.data.funding.currency)} />
                    <Row k="Status" v={detail.data.funding.status} />
                    <Row k="Credited" v={new Date(detail.data.funding.occurredAt).toLocaleString()} />
                    <p className="text-[11px] text-slate-500 pt-2">
                      Wallet funding never creates an order, seller earning, platform commission,
                      cashback or referral reward.
                    </p>
                  </Block>
                )}

                <Block title={`Ledger entries (${detail.data.ledger.length})`}>
                  {detail.data.ledger.length === 0 ? (
                    <p className="text-xs text-slate-500">No ledger entries linked to this reference.</p>
                  ) : (
                    detail.data.ledger.map((l) => (
                      <div key={l.id} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                        <div className="min-w-0">
                          <div className="text-slate-200 text-xs font-semibold">{l.type}</div>
                          <div className="text-[10px] text-slate-500 font-mono truncate">{l.txHash ?? l.id}</div>
                        </div>
                        <div className={`text-xs font-mono ${l.inflow ? "text-emerald-300" : "text-red-300"}`}>
                          {l.inflow ? "+" : "−"}
                          {money(l.amount, l.currency)}
                          <span className="text-slate-500"> · {l.status}</span>
                        </div>
                      </div>
                    ))
                  )}
                </Block>

                {detail.data.platformRevenue.length > 0 && (
                  <Block title="Platform revenue postings">
                    {detail.data.platformRevenue.map((p) => (
                      <Row key={p.id} k={p.kind} v={money(p.amountUsd, "USD")} />
                    ))}
                  </Block>
                )}

                <p className="text-[11px] text-slate-500 flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  All values are read from authoritative order, ledger and revenue records. Nothing
                  on this screen can change a payment, settlement or balance.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Pill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`px-2 py-1 rounded-[10px] border font-bold ${
        ok
          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
          : "bg-slate-500/10 border-slate-500/30 text-slate-400"
      }`}
    >
      {label}
    </span>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-[#0b0b0d] border border-white/10 rounded-[10px] px-3 py-2 text-sm text-white"
    >
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[10px] border border-white/10 bg-[#141418] p-4">
      <h3 className="text-[11px] uppercase tracking-widest text-slate-400 font-bold mb-2">{title}</h3>
      {children}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1 text-xs">
      <span className="text-slate-500">{k}</span>
      <span className="text-slate-100 text-right break-all">{v}</span>
    </div>
  );
}
