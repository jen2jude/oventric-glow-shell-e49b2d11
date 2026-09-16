import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Undo2, ShieldAlert } from "lucide-react";
import { adminListRefunds } from "@/lib/admin-finance.functions";

export const Route = createFileRoute("/admin/refunds")({
  head: () => ({
    meta: [
      { title: "Refunds · Admin · Oventric" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminRefundsPage,
  errorComponent: ({ error, reset }) => (
    <div className="p-6 text-red-300">
      <div className="font-bold mb-2">Refunds error</div>
      <div className="text-sm text-red-200/80 mb-3">{error.message}</div>
      <button onClick={reset} className="px-3 py-1.5 rounded-[10px] border border-red-500/40 text-sm">
        Retry
      </button>
    </div>
  ),
  notFoundComponent: () => <div className="p-6 text-slate-400">Not found.</div>,
});

function AdminRefundsPage() {
  const listFn = useServerFn(adminListRefunds);
  const q = useQuery({ queryKey: ["admin-refunds"], queryFn: () => listFn(), staleTime: 15_000 });
  const rows = q.data ?? [];

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <header className="mb-4">
        <h1 className="text-white text-2xl font-black flex items-center gap-2">
          <Undo2 className="w-5 h-5 text-red-400" /> Refunds
        </h1>
        <p className="text-sm text-slate-400">
          Every refund executed by the backend refund path, with its reversal entries. Refunds are
          issued from the dispute queue or by the automatic escrow rules — never from this screen.
        </p>
      </header>

      <Link
        to="/admin/disputes"
        className="inline-flex items-center gap-2 mb-4 px-3 py-2 rounded-[10px] bg-white/5 border border-white/10 text-xs font-bold text-slate-200 hover:bg-white/10"
      >
        <ShieldAlert className="w-4 h-4 text-red-400" /> Open dispute queue to issue a refund
      </Link>

      {q.isLoading ? (
        <div className="p-8 text-center"><Loader2 className="w-5 h-5 animate-spin text-slate-500 inline" /></div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-[#141418] p-8 text-center text-sm text-slate-500">
          No refunds have been issued.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.orderId} className="rounded-xl border border-white/10 bg-[#141418] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-white text-sm font-bold truncate">
                    {r.productName ?? "Product removed — stored order snapshot"}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {r.buyerName ?? "Buyer"} ← {r.sellerName ?? "Seller"} · Order{" "}
                    {r.orderId.slice(0, 8)} · {r.reference ?? "no reference"}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-red-300 font-mono text-sm">
                    {r.currency ?? ""} {r.refundAmount?.toFixed(2) ?? "—"}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {r.refundedAt ? new Date(r.refundedAt).toLocaleString() : "—"}
                  </div>
                </div>
              </div>
              {r.reason && (
                <div className="text-[11px] text-slate-400 mt-2">Reason: {r.reason}</div>
              )}
              {r.reversals.length > 0 && (
                <div className="mt-2 border-t border-white/5 pt-2 space-y-1">
                  {r.reversals.map((v, i) => (
                    <div key={i} className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">{v.type}</span>
                      <span className="font-mono text-slate-200">
                        {v.currency} {v.amount.toFixed(2)} · {v.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
