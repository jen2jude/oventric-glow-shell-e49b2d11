import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search, ShoppingBag } from "lucide-react";
import { adminListOrders } from "@/lib/admin-orders.functions";

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

function AdminOrdersPage() {
  const listFn = useServerFn(adminListOrders);
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("ALL");
  const [q, setQ] = useState("");

  const query = useQuery({
    queryKey: ["admin-orders", status, q],
    queryFn: () => listFn({ data: { status, q } }),
    staleTime: 10_000,
  });

  const rows = query.data ?? [];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <header className="mb-5">
        <h1 className="text-white text-2xl font-black flex items-center gap-2">
          <ShoppingBag className="w-6 h-6 text-amber-300" /> Orders
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Authoritative order records. Read-only — money moves only through the existing settlement,
          refund and payout flows.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2 mb-4">
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
        <div className="relative ml-auto min-w-[240px]">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search reference or product…"
            className="w-full pl-9 pr-3 py-2 bg-[#141418] border border-white/10 rounded-[10px] text-sm text-white placeholder:text-slate-500"
          />
        </div>
      </div>

      {query.isError && (
        <div className="mb-4 text-sm text-red-300 bg-red-500/10 border border-red-500/40 rounded-[10px] p-3">
          {(query.error as Error).message}
        </div>
      )}

      <div className="bg-[#141418] border border-white/10 rounded-xl overflow-x-auto">
        <div className="min-w-[900px]">
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
                <div
                  key={o.id}
                  className="grid grid-cols-[150px_1fr_1fr_120px_110px_110px] gap-3 px-4 py-3 text-sm items-center"
                >
                  <div className="text-slate-400 text-xs">
                    {new Date(o.createdAt).toLocaleString()}
                  </div>
                  <div className="min-w-0">
                    <Link
                      to="/order/$id"
                      params={{ id: o.id }}
                      className="text-white hover:text-emerald-300 truncate block"
                    >
                      {o.productName ?? "—"}
                    </Link>
                    <div className="text-[11px] text-slate-500 font-mono truncate">
                      {o.reference ?? o.id.slice(0, 8)} · {o.paymentMethod ?? "—"}
                    </div>
                  </div>
                  <div className="min-w-0 text-xs text-slate-400 truncate">
                    {o.buyerName ?? o.buyerId.slice(0, 8)} →{" "}
                    {o.sellerName ?? (o.sellerId ? o.sellerId.slice(0, 8) : "—")}
                  </div>
                  <div className="text-xs">
                    <span
                      className={
                        o.status === "paid"
                          ? "text-emerald-300 font-bold"
                          : o.status === "refunded"
                            ? "text-amber-300 font-bold"
                            : o.status === "failed"
                              ? "text-red-300 font-bold"
                              : "text-slate-400 font-bold"
                      }
                    >
                      {o.status}
                    </span>
                    {o.disputeStatus && (
                      <div className="text-[10px] text-rose-300">dispute: {o.disputeStatus}</div>
                    )}
                    {o.escrowStatus && (
                      <div className="text-[10px] text-slate-500">{o.escrowStatus}</div>
                    )}
                  </div>
                  <div className="text-right text-white font-bold">${o.totalUsd.toFixed(2)}</div>
                  <div className="text-right text-slate-300">
                    {o.sellerShareUsd == null ? "—" : `$${o.sellerShareUsd.toFixed(2)}`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
