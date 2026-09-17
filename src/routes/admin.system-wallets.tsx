import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { useServerFn } from "@tanstack/react-start";
import { Loader2, ShoppingBag, ArrowUpRight } from "lucide-react";
import {
  getSystemWallets,
  listSystemWalletTx,
  type SystemWalletDTO,
  type SystemWalletTxDTO,
  type SystemWalletKind,
} from "@/lib/system-wallets.functions";

export const Route = createFileRoute("/admin/system-wallets")({
  head: () => ({
    meta: [{ title: "System Wallets · Admin" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: SystemWalletsPage,
});

const META: Record<
  SystemWalletKind,
  { label: string; sub: string; icon: React.ComponentType<{ className?: string }>; hue: string }
> = {
  marketplace: {
    label: "Marketplace Revenue",
    sub: "20% of every marketplace sale",
    icon: ShoppingBag,
    hue: "from-emerald-500/25 to-teal-700/10 border-emerald-500/30",
  },
};
const KINDS: SystemWalletKind[] = ["marketplace"];
const FALLBACK_META = {
  label: "Other Revenue",
  sub: "",
  icon: ShoppingBag,
  hue: "from-slate-500/25 to-slate-700/10 border-slate-500/30",
} as const;
const metaFor = (k: string) => (META as Record<string, typeof FALLBACK_META>)[k] ?? FALLBACK_META;

type ViewCur = "NGN" | "USD" | "GHS";
const USD_TO: Record<ViewCur, number> = { USD: 1, NGN: 1500, GHS: 14 };
const SYM: Record<ViewCur, string> = { USD: "$", NGN: "₦", GHS: "₵" };
function fmtCur(usd: number, cur: ViewCur) {
  const v = usd * USD_TO[cur];
  const s = cur === "USD" ? v.toFixed(2) : Math.round(v).toLocaleString();
  return `${SYM[cur]}${s}`;
}

function SystemWalletsPage() {
  const loadWallets = useServerFn(getSystemWallets);
  const loadTx = useServerFn(listSystemWalletTx);
  const [wallets, setWallets] = useState<SystemWalletDTO[] | null>(null);
  const [tx, setTx] = useState<SystemWalletTxDTO[] | null>(null);
  const [filter, setFilter] = useState<SystemWalletKind | "ALL">("ALL");
  const [view, setView] = useState<ViewCur>("NGN");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [w, t] = await Promise.all([
          loadWallets(),
          loadTx({ data: { kind: filter, limit: 50 } }),
        ]);
        if (cancelled) return;
        setWallets(w);
        setTx(t);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to load");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadWallets, loadTx, filter]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-white text-2xl font-black">System Wallets</h1>
          <p className="text-sm text-slate-400">
            Admin-only revenue held from marketplace, bounties, and ads.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="inline-flex rounded-[10px] overflow-hidden border border-white/10 bg-[#0b0b0d]">
            {(["NGN", "USD", "GHS"] as ViewCur[]).map((c) => (
              <button
                key={c}
                onClick={() => setView(c)}
                className={`px-3 py-1.5 text-xs font-bold ${view === c ? "bg-emerald-500/25 text-emerald-200" : "text-slate-400 hover:text-white"}`}
              >
                {c}
              </button>
            ))}
          </div>
          <Link
            to="/admin/cashback-wallet"
            className="px-3 py-2 rounded-[10px] bg-pink-500/20 border border-pink-500/40 text-pink-200 text-xs font-bold hover:bg-pink-500/30"
          >
            Cashback Wallet →
          </Link>
        </div>
      </header>

      {err && (
        <div className="mb-4 text-sm text-red-300 bg-red-500/10 border border-red-500/40 rounded-[10px] p-3">
          {err}
        </div>
      )}

      {!wallets ? (
        <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {KINDS.map((k) => {
            const w = wallets.find((x) => x.kind === k);
            const m = metaFor(k);
            const Icon = m.icon;
            return (
              <div key={k} className={`bg-gradient-to-br ${m.hue} border rounded-2xl p-5`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-[10px] bg-black/30 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-white/50" />
                </div>
                <div className="text-[11px] uppercase tracking-widest text-slate-300 font-bold">
                  {m.label}
                </div>
                <div className="text-white text-3xl font-black tracking-tight mt-1">
                  {fmtCur(w?.balanceUSD ?? 0, view)}
                </div>
                {view !== "USD" && (
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    ≈ {fmtCur(w?.balanceUSD ?? 0, "USD")}
                  </div>
                )}
                <div className="text-xs text-slate-400 mt-1">{m.sub}</div>
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-[#141418] border border-white/10 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-white text-sm font-bold">Recent Movements</h2>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as SystemWalletKind | "ALL")}
            className="bg-[#0b0b0d] border border-white/10 rounded-[10px] px-3 py-1.5 text-xs text-white"
          >
            <option value="ALL">All wallets</option>
            <option value="marketplace">Marketplace</option>
            <option value="bounty">Bounty</option>
            <option value="ads">Ads</option>
            <option value="academy">Academy</option>
          </select>
        </div>
        <div className="divide-y divide-white/5">
          {!tx ? (
            <div className="p-6 text-center">
              <Loader2 className="w-5 h-5 animate-spin text-slate-500 inline" />
            </div>
          ) : tx.length === 0 ? (
            <div className="p-6 text-sm text-slate-500 text-center">No revenue yet.</div>
          ) : (
            tx.map((t) => (
              <div key={t.id} className="p-4 flex items-center justify-between text-sm">
                <div>
                  <div className="text-white font-semibold">{metaFor(t.kind).label}</div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    {t.source} · {new Date(t.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="text-emerald-300 font-mono font-bold text-right">
                  + {fmtCur(t.amountUSD, view)}
                  {view !== "USD" && (
                    <div className="text-[10px] text-slate-500 font-normal">
                      ≈ {fmtCur(t.amountUSD, "USD")}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
