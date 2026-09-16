import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Wallet, Lock } from "lucide-react";
import { adminListLedger, adminListWallets } from "@/lib/admin-finance.functions";

export const Route = createFileRoute("/admin/ledger")({
  head: () => ({
    meta: [
      { title: "Wallet & Ledger · Admin · Oventric" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminLedgerPage,
  errorComponent: ({ error, reset }) => (
    <div className="p-6 text-red-300">
      <div className="font-bold mb-2">Ledger error</div>
      <div className="text-sm text-red-200/80 mb-3">{error.message}</div>
      <button onClick={reset} className="px-3 py-1.5 rounded-[10px] border border-red-500/40 text-sm">
        Retry
      </button>
    </div>
  ),
  notFoundComponent: () => <div className="p-6 text-slate-400">Not found.</div>,
});

const TYPES = [
  "ALL",
  "Marketplace Purchase",
  "Marketplace Sale",
  "Wallet Top-Up",
  "Payout Withdrawal",
  "Cashback Earned",
  "Referral Reward",
  "Wallet Transfer Sent",
  "Wallet Transfer Received",
];

const money = (v: number, cur: string) =>
  `${cur} ${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function AdminLedgerPage() {
  const ledgerFn = useServerFn(adminListLedger);
  const walletsFn = useServerFn(adminListWallets);

  const [tab, setTab] = useState<"ledger" | "wallets">("ledger");
  const [q, setQ] = useState("");
  const [type, setType] = useState("ALL");
  const [direction, setDirection] = useState<"all" | "in" | "out">("all");
  const [status, setStatus] = useState("ALL");
  const [currency, setCurrency] = useState("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const ledger = useQuery({
    queryKey: ["admin-ledger", q, type, direction, status, currency, from, to, page],
    queryFn: () => ledgerFn({ data: { q, type, direction, status, currency, from, to, page } }),
    enabled: tab === "ledger",
    staleTime: 10_000,
  });
  const wallets = useQuery({
    queryKey: ["admin-wallets", q],
    queryFn: () => walletsFn({ data: { q } }),
    enabled: tab === "wallets",
    staleTime: 10_000,
  });

  const pages = ledger.data ? Math.max(1, Math.ceil(ledger.data.total / ledger.data.pageSize)) : 1;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <header className="mb-4">
        <h1 className="text-white text-2xl font-black flex items-center gap-2">
          <Wallet className="w-5 h-5 text-emerald-400" /> Wallet & Ledger
        </h1>
        <p className="text-sm text-slate-400">
          Authoritative balances and money entries. Read-only — balances are maintained by the
          backend financial functions and cannot be adjusted from the console.
        </p>
      </header>

      <div className="flex gap-1 rounded-[10px] border border-white/10 p-1 bg-[#1E1E24] w-fit mb-4">
        {(["ledger", "wallets"] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-widest ${
              tab === t ? "bg-white text-black" : "text-slate-400"
            }`}
          >
            {t === "ledger" ? "Ledger entries" : "Wallet accounts"}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          placeholder="User, reference or entry hash"
          className="flex-1 min-w-[220px] bg-[#0b0b0d] border border-white/10 rounded-[10px] px-3 py-2 text-sm text-white placeholder:text-slate-600"
        />
        {tab === "ledger" && (
          <>
            <select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} className="bg-[#0b0b0d] border border-white/10 rounded-[10px] px-3 py-2 text-sm text-white">
              {TYPES.map((t) => (
                <option key={t} value={t}>{t === "ALL" ? "All types" : t}</option>
              ))}
            </select>
            <select value={direction} onChange={(e) => { setDirection(e.target.value as "all" | "in" | "out"); setPage(1); }} className="bg-[#0b0b0d] border border-white/10 rounded-[10px] px-3 py-2 text-sm text-white">
              <option value="all">Credit & debit</option>
              <option value="in">Credits</option>
              <option value="out">Debits</option>
            </select>
            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="bg-[#0b0b0d] border border-white/10 rounded-[10px] px-3 py-2 text-sm text-white">
              <option value="ALL">All statuses</option>
              <option value="success">success</option>
              <option value="pending">pending</option>
              <option value="failed">failed</option>
            </select>
            <select value={currency} onChange={(e) => { setCurrency(e.target.value); setPage(1); }} className="bg-[#0b0b0d] border border-white/10 rounded-[10px] px-3 py-2 text-sm text-white">
              {["ALL", "USD", "NGN", "GHS", "KES", "ZAR"].map((c) => (
                <option key={c} value={c}>{c === "ALL" ? "All currencies" : c}</option>
              ))}
            </select>
            <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="bg-[#0b0b0d] border border-white/10 rounded-[10px] px-3 py-2 text-sm text-white" />
            <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="bg-[#0b0b0d] border border-white/10 rounded-[10px] px-3 py-2 text-sm text-white" />
          </>
        )}
      </div>

      <div className="bg-[#141418] border border-white/10 rounded-xl overflow-hidden">
        {tab === "ledger" ? (
          ledger.isLoading ? (
            <div className="p-8 text-center"><Loader2 className="w-5 h-5 animate-spin text-slate-500 inline" /></div>
          ) : (ledger.data?.items.length ?? 0) === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">No ledger entries match these filters.</div>
          ) : (
            <div className="divide-y divide-white/5">
              {ledger.data!.items.map((l) => (
                <div key={l.id} className="p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-white text-sm font-semibold truncate">{l.type}</div>
                    <div className="text-[11px] text-slate-500 truncate font-mono">
                      {l.userName ?? l.userId.slice(0, 8)} · {l.txHash ?? l.reference ?? l.id} ·{" "}
                      {new Date(l.occurredAt).toLocaleString()}
                    </div>
                  </div>
                  <div className={`text-right shrink-0 font-mono text-sm ${l.inflow ? "text-emerald-300" : "text-red-300"}`}>
                    {l.inflow ? "+" : "−"}
                    {money(l.amount, l.currency)}
                    <div className="text-[10px] text-slate-500 uppercase tracking-widest">{l.status}</div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : wallets.isLoading ? (
          <div className="p-8 text-center"><Loader2 className="w-5 h-5 animate-spin text-slate-500 inline" /></div>
        ) : (wallets.data?.length ?? 0) === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">No wallet accounts found.</div>
        ) : (
          <div className="divide-y divide-white/5">
            {wallets.data!.map((w) => (
              <div key={`${w.userId}-${w.currency}`} className="p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-white text-sm font-semibold truncate">
                    {w.userName ?? w.userId.slice(0, 8)}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono truncate">{w.userId}</div>
                </div>
                <div className="text-right shrink-0 text-xs">
                  <div className="text-white font-mono text-sm">{money(w.available, w.currency)}</div>
                  <div className="text-slate-500">
                    held {money(w.escrow, w.currency)} · cashback {w.cashback.toFixed(2)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {tab === "ledger" && ledger.data && ledger.data.total > ledger.data.pageSize && (
        <div className="flex items-center justify-between mt-3 text-xs text-slate-400">
          <span>
            Page {ledger.data.page} of {pages} · {ledger.data.total} entries
          </span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 rounded-[10px] border border-white/10 disabled:opacity-40">Previous</button>
            <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-[10px] border border-white/10 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}

      <p className="mt-4 text-[11px] text-slate-500 flex items-start gap-2">
        <Lock className="w-4 h-4 text-slate-400 shrink-0" />
        No manual credit or debit exists in this console. Balance changes only happen through
        verified payments, settlements, refunds and payouts in the backend.
      </p>
    </div>
  );
}
