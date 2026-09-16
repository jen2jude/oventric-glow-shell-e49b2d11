import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Gift, Users, TrendingUp, ArrowDownRight } from "lucide-react";
import {
  getCashbackSummary,
  listCashbackUsers,
  listCashbackHistory,
  type CashbackUserRow,
  type CashbackHistoryRow,
  type CashbackSummaryDTO,
} from "@/lib/cashback-admin.functions";
import {
  adminListCashbackConfig,
  adminSetProductCashbackPct,
  adminListCashbackAwards,
} from "@/lib/admin-promotions.functions";

export const Route = createFileRoute("/admin/cashback-wallet")({
  head: () => ({
    meta: [{ title: "Cashback Wallet · Admin" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: CashbackWalletPage,
});

const fmt = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function CashbackWalletPage() {
  const loadSummary = useServerFn(getCashbackSummary);
  const loadUsers = useServerFn(listCashbackUsers);
  const loadHistory = useServerFn(listCashbackHistory);
  const [summary, setSummary] = useState<CashbackSummaryDTO | null>(null);
  const [users, setUsers] = useState<CashbackUserRow[] | null>(null);
  const [history, setHistory] = useState<CashbackHistoryRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [s, u, h] = await Promise.all([loadSummary(), loadUsers(), loadHistory()]);
        if (cancelled) return;
        setSummary(s);
        setUsers(u);
        setHistory(h);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to load");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadSummary, loadUsers, loadHistory]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="mb-6">
        <h1 className="text-white text-2xl font-black">Cashback Wallet</h1>
        <p className="text-sm text-slate-400">
          Every user's Cashback Wallet balance and how they earned it. Cashback is set per product
          by the seller (0–50%) and funded entirely from the seller's 80% share.
        </p>
      </header>

      {err && (
        <div className="mb-4 text-sm text-red-300 bg-red-500/10 border border-red-500/40 rounded-[10px] p-3">
          {err}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <SummaryCard
          label="Outstanding"
          value={fmt(summary?.totalOutstandingUSD ?? 0)}
          sub="Owed to users right now"
          icon={Gift}
          tone="from-pink-500/25 to-fuchsia-700/10 border-pink-500/30"
        />
        <SummaryCard
          label="Total Earned"
          value={fmt(summary?.totalEarnedUSD ?? 0)}
          sub="All-time cashback credited"
          icon={TrendingUp}
          tone="from-emerald-500/25 to-teal-700/10 border-emerald-500/30"
        />
        <SummaryCard
          label="Total Spent"
          value={fmt(summary?.totalSpentUSD ?? 0)}
          sub="Applied to purchases"
          icon={ArrowDownRight}
          tone="from-sky-500/25 to-indigo-700/10 border-sky-500/30"
        />
        <SummaryCard
          label="Active Wallets"
          value={String(summary?.userCount ?? 0)}
          sub="Users with balance > $0"
          icon={Users}
          tone="from-amber-500/25 to-orange-700/10 border-amber-500/30"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#141418] border border-white/10 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-white/10">
            <h2 className="text-white text-sm font-bold">Users with Cashback Balance</h2>
            <p className="text-[11px] text-slate-500">Sorted by balance, top 200</p>
          </div>
          <div className="divide-y divide-white/5 max-h-[560px] overflow-y-auto">
            {!users ? (
              <div className="p-6 text-center">
                <Loader2 className="w-5 h-5 animate-spin text-slate-500 inline" />
              </div>
            ) : users.length === 0 ? (
              <div className="p-6 text-sm text-slate-500 text-center">
                No cashback balances yet.
              </div>
            ) : (
              users.map((u) => (
                <div key={u.userId} className="p-4 flex items-center justify-between text-sm">
                  <div className="min-w-0">
                    <div className="text-white font-semibold truncate">
                      {u.displayName || u.username || "Unnamed user"}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono truncate">
                      {u.username ? `@${u.username}` : u.userId.slice(0, 8)}
                    </div>
                  </div>
                  <div className="text-emerald-300 font-mono font-bold whitespace-nowrap">
                    {fmt(u.accumulatedUSD)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-[#141418] border border-white/10 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-white/10">
            <h2 className="text-white text-sm font-bold">Earning History</h2>
            <p className="text-[11px] text-slate-500">Latest 200 cashback credits</p>
          </div>
          <div className="divide-y divide-white/5 max-h-[560px] overflow-y-auto">
            {!history ? (
              <div className="p-6 text-center">
                <Loader2 className="w-5 h-5 animate-spin text-slate-500 inline" />
              </div>
            ) : history.length === 0 ? (
              <div className="p-6 text-sm text-slate-500 text-center">No cashback events yet.</div>
            ) : (
              history.map((h) => (
                <div key={h.id} className="p-4 flex items-center justify-between text-sm">
                  <div className="min-w-0">
                    <div className="text-white font-semibold truncate">
                      {h.displayName || h.username || h.userId.slice(0, 8)}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono truncate">
                      {h.txHash} · {new Date(h.occurredAt).toLocaleString()}
                    </div>
                  </div>
                  <div
                    className={`font-mono font-bold whitespace-nowrap ${h.inflow ? "text-emerald-300" : "text-rose-300"}`}
                  >
                    {h.inflow ? "+" : "−"} {fmt(h.amountUSD)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <CashbackConfigSection />
      <CashbackAwardsSection />
    </div>
  );
}

/** Seller-funded cashback rates per listing. Capped at 50% in the database. */
function CashbackConfigSection() {
  const listFn = useServerFn(adminListCashbackConfig);
  const setFn = useServerFn(adminSetProductCashbackPct);
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["admin-cashback-config"],
    queryFn: () => listFn(),
    staleTime: 15_000,
  });
  const save = useMutation({
    mutationFn: (v: { productId: string; pct: number }) => setFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-cashback-config"] }),
    onError: (e: unknown) => setError(e instanceof Error ? e.message : "Could not update the rate"),
  });

  return (
    <section className="mt-8 bg-[#141418] border border-white/10 rounded-xl overflow-hidden">
      <div className="p-4 border-b border-white/10">
        <h2 className="text-white text-sm font-bold">Cashback configuration</h2>
        <p className="text-[11px] text-slate-500">
          Rate per listing, 0–50%, funded from the seller's 80% share. Changing a rate only affects
          future settlements — it never credits anyone.
        </p>
      </div>
      {error && <div className="px-4 py-2 text-xs text-red-300">{error}</div>}
      <div className="divide-y divide-white/5 max-h-[420px] overflow-y-auto">
        {q.isLoading ? (
          <div className="p-6 text-center">
            <Loader2 className="w-5 h-5 animate-spin text-slate-500 inline" />
          </div>
        ) : (q.data ?? []).length === 0 ? (
          <div className="p-6 text-sm text-slate-500 text-center">
            No listing currently offers cashback.
          </div>
        ) : (
          (q.data ?? []).map((p) => (
            <div key={p.productId} className="p-4 flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0">
                <div className="text-white font-semibold truncate">{p.productName}</div>
                <div className="text-[11px] text-slate-500 truncate">
                  {p.sellerName ?? "Unknown seller"} · {p.status}
                  {p.priceUsd != null ? ` · $${p.priceUsd.toFixed(2)}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <input
                  type="number"
                  min={0}
                  max={50}
                  defaultValue={p.cashbackPct}
                  onBlur={(e) => {
                    const pct = Number(e.target.value);
                    if (pct === p.cashbackPct) return;
                    if (pct < 0 || pct > 50) {
                      setError("Cashback must be between 0% and 50%.");
                      e.target.value = String(p.cashbackPct);
                      return;
                    }
                    save.mutate({ productId: p.productId, pct });
                  }}
                  className="w-20 px-2 py-1.5 rounded-[10px] bg-white/5 border border-white/10 text-slate-200 text-sm"
                />
                <span className="text-slate-500 text-xs">%</span>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

/** Cashback awards and reversals tied back to the order that produced them. */
function CashbackAwardsSection() {
  const listFn = useServerFn(adminListCashbackAwards);
  const q = useQuery({
    queryKey: ["admin-cashback-awards"],
    queryFn: () => listFn(),
    staleTime: 15_000,
  });
  return (
    <section className="mt-6 bg-[#141418] border border-white/10 rounded-xl overflow-hidden">
      <div className="p-4 border-b border-white/10">
        <h2 className="text-white text-sm font-bold">Awards &amp; reversals</h2>
        <p className="text-[11px] text-slate-500">
          Each award and, where an order was refunded, its reversal entry. History is never deleted.
        </p>
      </div>
      <div className="divide-y divide-white/5 max-h-[420px] overflow-y-auto">
        {q.isLoading ? (
          <div className="p-6 text-center">
            <Loader2 className="w-5 h-5 animate-spin text-slate-500 inline" />
          </div>
        ) : (q.data ?? []).length === 0 ? (
          <div className="p-6 text-sm text-slate-500 text-center">No cashback events yet.</div>
        ) : (
          (q.data ?? []).map((a) => (
            <div key={a.id} className="p-4 flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0">
                <div className="text-white font-semibold truncate">
                  {a.productName ?? "Order snapshot unavailable"}
                </div>
                <div className="text-[11px] text-slate-500 font-mono truncate">
                  {a.userName} · {a.sellerName ? `seller ${a.sellerName} · ` : ""}
                  {a.reference ?? a.txHash} · {new Date(a.occurredAt).toLocaleString()} · {a.status}
                </div>
              </div>
              <div
                className={`font-mono font-bold whitespace-nowrap ${a.inflow ? "text-emerald-300" : "text-rose-300"}`}
              >
                {a.inflow ? "+" : "−"} {fmt(a.amountUsd)}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
}) {
  return (
    <div className={`bg-gradient-to-br ${tone} border rounded-2xl p-5`}>
      <div className="w-10 h-10 rounded-[10px] bg-black/30 flex items-center justify-center mb-3">
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="text-[11px] uppercase tracking-widest text-slate-300 font-bold">{label}</div>
      <div className="text-white text-3xl font-black tracking-tight mt-1">{value}</div>
      <div className="text-xs text-slate-400 mt-1">{sub}</div>
    </div>
  );
}
