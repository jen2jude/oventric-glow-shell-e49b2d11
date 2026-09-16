import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search, ShoppingBag, X } from "lucide-react";
import { adminListOrders, adminGetOrderDetail } from "@/lib/admin-orders.functions";

export const Route = createFileRoute("/admin/orders")({
  head: () => ({
    meta: [
      { title: "Orders · Admin · Oventric" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminOrdersPage,
});

const STATUSES = ["ALL", "pending", "paid", "failed", "refunded"] as const;
const ESCROW = ["", "held", "released", "refunded"] as const;
const DISPUTE = ["", "open", "resolved", "rejected"] as const;

const money = (v: number | null | undefined) => (v == null ? "—" : `$${Number(v).toFixed(2)}`);
const when = (v: string | null | undefined) => (v ? new Date(v).toLocaleString() : "—");

function AdminOrdersPage() {
  const listFn = useServerFn(adminListOrders);
  const detailFn = useServerFn(adminGetOrderDetail);

  const [status, setStatus] = useState<(typeof STATUSES)[number]>("ALL");
  const [q, setQ] = useState("");
  const [escrow, setEscrow] = useState("");
  const [dispute, setDispute] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["admin-orders", status, q, escrow, dispute, from, to],
    queryFn: () => listFn({ data: { status, q, escrow, dispute, from, to } }),
    staleTime: 10_000,
  });

  const detail = useQuery({
    queryKey: ["admin-order-detail", openId],
    queryFn: () => detailFn({ data: { id: openId! } }),
    enabled: Boolean(openId),
  });

  const rows = query.data ?? [];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <header className="mb-5">
        <h1 className="text-white text-2xl font-black flex items-center gap-2">
          <ShoppingBag className="w-6 h-6 text-amber-300" /> Orders
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Authoritative order records. Read-only — settlement, refunds and payouts stay inside the
          payment architecture.
        </p>
      </header>

      <div className="space-y-3 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-3 py-1.5 rounded-[10px] text-xs font-bold uppercase tracking-wider border ${
                status === s
                  ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300"
                  : "bg-[#141418] border-white/10 text-slate-400"
              }`}
            >
              {s}
            </button>
          ))}
          <div className="relative ml-auto min-w-[260px]">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Reference, product, buyer or seller…"
              className="w-full pl-9 pr-3 py-2 bg-[#141418] border border-white/10 rounded-[10px] text-sm text-white placeholder:text-slate-500"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <label className="flex items-center gap-1.5">
            Escrow
            <select
              value={escrow}
              onChange={(e) => setEscrow(e.target.value)}
              className="bg-[#141418] border border-white/10 rounded-[10px] px-2 py-1.5 text-white"
            >
              {ESCROW.map((s) => (
                <option key={s} value={s}>
                  {s || "any"}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5">
            Dispute
            <select
              value={dispute}
              onChange={(e) => setDispute(e.target.value)}
              className="bg-[#141418] border border-white/10 rounded-[10px] px-2 py-1.5 text-white"
            >
              {DISPUTE.map((s) => (
                <option key={s} value={s}>
                  {s || "any"}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5">
            From
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="bg-[#141418] border border-white/10 rounded-[10px] px-2 py-1.5 text-white"
            />
          </label>
          <label className="flex items-center gap-1.5">
            To
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="bg-[#141418] border border-white/10 rounded-[10px] px-2 py-1.5 text-white"
            />
          </label>
          {(escrow || dispute || from || to || q) && (
            <button
              onClick={() => {
                setEscrow("");
                setDispute("");
                setFrom("");
                setTo("");
                setQ("");
              }}
              className="px-2.5 py-1.5 rounded-[10px] bg-white/5 border border-white/10 text-slate-300"
            >
              Clear
            </button>
          )}
          <span className="ml-auto">{rows.length} shown</span>
        </div>
      </div>

      {query.isError && (
        <div className="mb-4 text-sm text-red-300 bg-red-500/10 border border-red-500/40 rounded-[10px] p-3">
          {(query.error as Error).message}
        </div>
      )}

      <div className="bg-[#141418] border border-white/10 rounded-xl overflow-x-auto">
        <div className="min-w-[940px]">
          <div className="grid grid-cols-[150px_1fr_1fr_120px_110px_110px] gap-3 px-4 py-2.5 text-[10px] uppercase tracking-widest text-slate-500 font-bold border-b border-white/10 bg-black/20">
            <div>Placed</div>
            <div>Product / reference</div>
            <div>Buyer → Seller</div>
            <div>Status</div>
            <div className="text-right">Total (USD)</div>
            <div className="text-right">Seller 80%</div>
          </div>

          {query.isLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="w-5 h-5 animate-spin text-slate-500 inline" />
            </div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-sm text-slate-500 text-center">No orders match this view.</div>
          ) : (
            <div className="divide-y divide-white/5">
              {rows.map((o) => (
                <button
                  key={o.id}
                  onClick={() => setOpenId(o.id)}
                  className="w-full text-left grid grid-cols-[150px_1fr_1fr_120px_110px_110px] gap-3 px-4 py-3 text-sm items-center hover:bg-white/5"
                >
                  <div className="text-slate-400 text-xs">
                    {new Date(o.createdAt).toLocaleString()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-white truncate">{o.productName ?? "—"}</div>
                    <div className="text-[11px] text-slate-500 font-mono truncate">
                      {o.reference ?? o.id.slice(0, 8)} · {o.paymentMethod ?? "—"}
                    </div>
                  </div>
                  <div className="min-w-0 text-xs text-slate-400 truncate">
                    {o.buyerName ?? o.buyerId.slice(0, 8)} →{" "}
                    {o.sellerName ?? (o.sellerId ? o.sellerId.slice(0, 8) : "—")}
                  </div>
                  <div className="text-xs">
                    <StatusChip status={o.status} />
                    {o.disputeStatus && (
                      <div className="text-[10px] text-rose-300">dispute: {o.disputeStatus}</div>
                    )}
                    {o.escrowStatus && (
                      <div className="text-[10px] text-slate-500">{o.escrowStatus}</div>
                    )}
                  </div>
                  <div className="text-right text-white font-bold">{money(o.totalUsd)}</div>
                  <div className="text-right text-slate-300">{money(o.sellerShareUsd)}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {openId && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex justify-end"
          onClick={() => setOpenId(null)}
        >
          <aside
            className="w-full max-w-lg h-full overflow-y-auto bg-[#141418] border-l border-white/10 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-white text-lg font-black">Order detail</h2>
              <button
                onClick={() => setOpenId(null)}
                className="p-2 rounded-[10px] bg-white/5 text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {detail.isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
            ) : detail.isError ? (
              <p className="text-sm text-red-300">{(detail.error as Error).message}</p>
            ) : detail.data ? (
              <div className="space-y-5 text-sm">
                <div>
                  <div className="text-white font-bold">{detail.data.productName ?? "—"}</div>
                  <div className="text-[11px] font-mono text-slate-500">
                    {detail.data.reference ?? detail.data.id}
                  </div>
                  {detail.data.productId ? (
                    detail.data.productExists ? (
                      <Link
                        to="/product/$id"
                        params={{ id: detail.data.productId }}
                        className="text-xs text-emerald-300"
                      >
                        Open product page
                      </Link>
                    ) : (
                      <span className="text-xs text-amber-300">
                        Product no longer listed — showing the stored order snapshot
                      </span>
                    )
                  ) : (
                    <span className="text-xs text-amber-300">
                      Product record removed — showing the stored order snapshot
                    </span>
                  )}
                </div>

                <Group title="Parties">
                  <Row k="Buyer" v={detail.data.buyerName ?? detail.data.buyerId} />
                  <Row k="Seller" v={detail.data.sellerName ?? detail.data.sellerId ?? "—"} />
                  <Row k="Category" v={detail.data.productCategory ?? "—"} />
                  <Row k="Quantity" v={String(detail.data.quantity)} />
                </Group>

                <Group title="Money (as settled)">
                  <Row k="Unit price" v={money(detail.data.unitPriceUsd)} />
                  <Row
                    k="Coupon"
                    v={
                      detail.data.coupon
                        ? `${detail.data.coupon.code} · −${money(detail.data.coupon.discountUsd)}`
                        : "none"
                    }
                  />
                  <Row k="Paid total" v={money(detail.data.totalUsd)} />
                  <Row
                    k="Charged"
                    v={
                      detail.data.displayTotal == null
                        ? "—"
                        : `${detail.data.displayCurrency ?? ""} ${detail.data.displayTotal.toFixed(2)}`
                    }
                  />
                  <Row k="Seller share" v={money(detail.data.sellerShareUsd)} />
                  <Row k="Oventric share" v={money(detail.data.platformShareUsd)} />
                  <Row k="Buyer cashback" v={money(detail.data.cashbackUsd)} />
                  {detail.data.cashbackReversedUsd != null && (
                    <Row k="Cashback reversed" v={money(detail.data.cashbackReversedUsd)} />
                  )}
                </Group>

                <Group title="State">
                  <Row k="Payment status" v={detail.data.status} />
                  <Row k="Payment method" v={detail.data.paymentMethod ?? "—"} />
                  <Row k="Escrow" v={detail.data.escrowStatus ?? "—"} />
                  <Row k="Dispute" v={detail.data.disputeStatus ?? "none"} />
                  <Row k="Refunded" v={when(detail.data.refundedAt)} />
                  {detail.data.refundReason && (
                    <Row k="Refund reason" v={detail.data.refundReason} />
                  )}
                </Group>

                <Group title="Timeline">
                  <Row k="Placed" v={when(detail.data.createdAt)} />
                  <Row k="Paid" v={when(detail.data.paidAt)} />
                  <Row k="Delivered" v={when(detail.data.deliveredAt)} />
                  <Row k="Buyer confirmed" v={when(detail.data.buyerConfirmedAt)} />
                  <Row k="Auto-release" v={when(detail.data.autoReleaseAt)} />
                  <Row k="Released" v={when(detail.data.releasedAt)} />
                  {detail.data.deliveryNote && (
                    <Row k="Delivery note" v={detail.data.deliveryNote} />
                  )}
                </Group>

                <p className="text-[11px] text-slate-500">
                  This view is read-only. Refunds, releases and payouts are performed through the
                  existing dispute, fulfilment and payout flows.
                </p>
              </div>
            ) : null}
          </aside>
        </div>
      )}
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const cls =
    status === "paid"
      ? "text-emerald-300"
      : status === "refunded"
        ? "text-amber-300"
        : status === "failed"
          ? "text-red-300"
          : "text-slate-400";
  return <span className={`${cls} font-bold`}>{status}</span>;
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2">
        {title}
      </div>
      <div className="rounded-xl border border-white/10 bg-black/20 divide-y divide-white/5">
        {children}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-start justify-between gap-4 px-3 py-2">
      <span className="text-xs text-slate-500">{k}</span>
      <span className="text-xs text-slate-200 text-right break-words">{v}</span>
    </div>
  );
}
