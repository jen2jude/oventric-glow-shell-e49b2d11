import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ScanSearch, CheckCircle2 } from "lucide-react";
import { adminReconciliation, adminFinanceOverview } from "@/lib/admin-finance.functions";

export const Route = createFileRoute("/admin/reconciliation")({
  head: () => ({
    meta: [
      { title: "Reconciliation · Admin · Oventric" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminReconciliationPage,
  errorComponent: ({ error, reset }) => (
    <div className="p-6 text-red-300">
      <div className="font-bold mb-2">Reconciliation error</div>
      <div className="text-sm text-red-200/80 mb-3">{error.message}</div>
      <button onClick={reset} className="px-3 py-1.5 rounded-[10px] border border-red-500/40 text-sm">
        Retry
      </button>
    </div>
  ),
  notFoundComponent: () => <div className="p-6 text-slate-400">Not found.</div>,
});

const usd = (v: number) => `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function AdminReconciliationPage() {
  const reconFn = useServerFn(adminReconciliation);
  const overviewFn = useServerFn(adminFinanceOverview);

  const overview = useQuery({ queryKey: ["admin-finance-overview"], queryFn: () => overviewFn(), staleTime: 30_000 });
  const recon = useQuery({ queryKey: ["admin-reconciliation"], queryFn: () => reconFn(), staleTime: 30_000 });

  const findings = recon.data ?? [];
  const grouped = findings.reduce<Record<string, typeof findings>>((acc, f) => {
    (acc[f.check] ??= []).push(f);
    return acc;
  }, {});

  const o = overview.data;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <header className="mb-5">
        <h1 className="text-white text-2xl font-black flex items-center gap-2">
          <ScanSearch className="w-5 h-5 text-amber-400" /> Financial reconciliation
        </h1>
        <p className="text-sm text-slate-400">
          Detection only. Discrepancies are reported for investigation — nothing is repaired
          automatically and no financial record is modified from this screen.
        </p>
      </header>

      {o && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Kpi label="Settled sales" value={usd(o.settledSalesUsd)} sub={`${o.settledOrders} orders`} />
          <Kpi label="Oventric revenue" value={usd(o.platformRevenueUsd)} />
          <Kpi label="Seller earnings" value={usd(o.sellerEarningsUsd)} sub={`${usd(o.escrowHeldUsd)} in escrow`} />
          <Kpi label="Cashback awarded" value={usd(o.cashbackAwardedUsd)} sub="seller-funded" />
          <Kpi label="Refunded" value={usd(o.refundedUsd)} sub={`${o.refundedOrders} orders`} />
          <Kpi label="Open disputes" value={String(o.openDisputes)} />
          <Kpi
            label="Payouts"
            value={`${o.pendingPayouts} pending`}
            sub={
              Object.entries(o.pendingPayoutAmounts)
                .map(([c, v]) => `${c} ${v.toFixed(2)}`)
                .join(" · ") || `${o.paidPayouts} paid`
            }
          />
          <Kpi
            label="Wallet funding"
            value={`${o.fundingSuccess} success`}
            sub={`${o.fundingPending} pending · ${o.fundingFailed} failed`}
          />
        </div>
      )}

      {recon.isLoading ? (
        <div className="p-8 text-center"><Loader2 className="w-5 h-5 animate-spin text-slate-500 inline" /></div>
      ) : findings.length === 0 ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-6 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-300" />
          <div>
            <div className="text-emerald-200 font-bold text-sm">No discrepancies detected</div>
            <div className="text-xs text-emerald-200/70">
              Payments, settlements, ledger entries, wallet funding, holds and payouts all match.
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([check, items]) => (
            <div key={check} className="rounded-xl border border-white/10 bg-[#141418] overflow-hidden">
              <div className="p-3 border-b border-white/10 flex items-center justify-between">
                <h2 className="text-white text-sm font-bold">{check}</h2>
                <span className="text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded bg-amber-500/15 text-amber-300">
                  {items.length} · requires investigation
                </span>
              </div>
              <div className="divide-y divide-white/5">
                {items.map((f, i) => (
                  <div key={i} className="p-3">
                    <div className="text-slate-100 text-xs font-semibold">{f.subject}</div>
                    <div className="text-[11px] text-slate-500">{f.detail}</div>
                    {f.reference && (
                      <div className="text-[10px] text-slate-600 font-mono mt-0.5">{f.reference}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#141418] p-4">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">{label}</div>
      <div className="text-white text-xl font-black mt-1">{value}</div>
      {sub && <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}
