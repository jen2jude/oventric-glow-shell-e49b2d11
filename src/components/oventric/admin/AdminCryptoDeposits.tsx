import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bitcoin, Loader2 } from "lucide-react";
import { adminListCryptoDeposits } from "@/lib/admin-crypto-deposits.functions";

const STATUSES = ["all", "awaiting_payment", "confirming", "credited", "underpaid", "expired", "failed"];

const tone: Record<string, string> = {
  credited: "text-emerald-400",
  underpaid: "text-amber-400",
  expired: "text-slate-400",
  failed: "text-red-400",
};

export function AdminCryptoDeposits() {
  const listFn = useServerFn(adminListCryptoDeposits);
  const [status, setStatus] = useState("all");
  const list = useQuery({
    queryKey: ["admin-crypto-deposits", status],
    queryFn: () => listFn({ data: { status } }),
    staleTime: 15_000,
  });
  const rows = list.data ?? [];

  return (
    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-black text-white">
          <Bitcoin className="h-4 w-4 text-amber-400" /> Crypto deposits
        </h2>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-[10px] border border-white/10 bg-[#0b0b0d] px-3 py-2 text-sm text-white"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s === "all" ? "All statuses" : s.replace("_", " ")}
            </option>
          ))}
        </select>
      </div>
      <p className="mb-3 text-xs text-slate-500">
        Detection only. Wallets are credited by the provider webhook after on-chain confirmation — never from this
        screen.
      </p>

      <div className="overflow-hidden rounded-xl border border-white/10 bg-[#141418]">
        {list.isLoading ? (
          <div className="p-8 text-center">
            <Loader2 className="inline h-5 w-5 animate-spin text-slate-500" />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">No crypto deposits yet.</div>
        ) : (
          <div className="divide-y divide-white/5">
            {rows.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-white">
                    {r.userName ?? r.userId.slice(0, 8)} · {r.currency}{" "}
                    {r.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                  <div className="truncate text-[11px] text-slate-500">
                    {r.payCurrency.toUpperCase()} {r.payAmount ?? "—"}
                    {r.receivedAmount !== null ? ` · received ${r.receivedAmount}` : ""} ·{" "}
                    {new Date(r.createdAt).toLocaleString()} · {r.providerPaymentId}
                  </div>
                  {r.note && <div className="mt-1 text-[11px] text-amber-300/80">{r.note}</div>}
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-mono text-sm text-white">${r.usdAmount.toFixed(2)}</div>
                  <div
                    className={`text-[10px] font-bold uppercase tracking-widest ${tone[r.status] ?? "text-slate-400"}`}
                  >
                    {r.status.replace("_", " ")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
