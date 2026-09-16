import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Gift, Search, Save } from "lucide-react";
import {
  adminReferralOverview,
  adminUpdateReferralSettings,
} from "@/lib/admin-promotions.functions";

export const Route = createFileRoute("/admin/referrals")({
  head: () => ({
    meta: [
      { title: "Referrals · Admin · Oventric" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminReferralsPage,
  errorComponent: ({ error, reset }) => (
    <div className="p-6 text-red-300">
      <div className="font-bold mb-2">Referrals error</div>
      <div className="text-sm text-red-200/80 mb-3">{error.message}</div>
      <button onClick={reset} className="px-3 py-1.5 rounded-[10px] border border-red-500/40 text-sm">
        Retry
      </button>
    </div>
  ),
  notFoundComponent: () => <div className="p-6 text-slate-400">Not found.</div>,
});

type Filter = "all" | "pending" | "qualified" | "rewarded" | "reversed";

function AdminReferralsPage() {
  const loadFn = useServerFn(adminReferralOverview);
  const saveFn = useServerFn(adminUpdateReferralSettings);
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [form, setForm] = useState<null | {
    active: boolean;
    rewardAmountUsd: number;
    minPurchaseUsd: number;
    qualificationDays: number;
  }>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const data = useQuery({
    queryKey: ["admin-referrals"],
    queryFn: () => loadFn(),
    staleTime: 15_000,
  });

  const settings = form ??
    (data.data
      ? {
          active: data.data.settings.active,
          rewardAmountUsd: data.data.settings.rewardAmountUsd,
          minPurchaseUsd: data.data.settings.minPurchaseUsd,
          qualificationDays: data.data.settings.qualificationDays,
        }
      : null);

  const save = useMutation({
    mutationFn: () => saveFn({ data: settings! }),
    onSuccess: () => {
      setMsg("Referral programme settings saved.");
      setForm(null);
      qc.invalidateQueries({ queryKey: ["admin-referrals"] });
    },
    onError: (e: unknown) => setMsg(e instanceof Error ? e.message : "Could not save settings"),
  });

  const rows = useMemo(() => {
    const list = data.data?.referrals ?? [];
    return list.filter((r) => {
      if (filter === "pending" && r.status !== "pending") return false;
      if (filter === "qualified" && r.status !== "qualified") return false;
      if (filter === "rewarded" && r.rewardStatus !== "credited") return false;
      if (filter === "reversed" && r.rewardStatus !== "reversed") return false;
      if (!q.trim()) return true;
      const t = q.trim().toLowerCase();
      return (
        r.referrerName.toLowerCase().includes(t) ||
        r.inviteeName.toLowerCase().includes(t) ||
        (r.orderReference ?? "").toLowerCase().includes(t)
      );
    });
  }, [data.data, q, filter]);

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <header className="mb-4">
        <h1 className="text-white text-2xl font-black flex items-center gap-2">
          <Gift className="w-5 h-5 text-emerald-400" /> Referrals
        </h1>
        <p className="text-sm text-slate-400">
          The Oventric referral programme. A reward is only issued by the backend when an invited
          member's first purchase settles — it can never be granted from this screen.
        </p>
      </header>

      {msg && (
        <div className="mb-3 rounded-[10px] border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
          {msg}
        </div>
      )}

      <section className="rounded-xl border border-white/10 bg-[#141418] p-4 mb-5">
        <h2 className="text-white text-sm font-bold mb-3">Programme settings</h2>
        {!settings ? (
          <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="block text-[11px] text-slate-400 mb-1">Reward (USD)</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={settings.rewardAmountUsd}
                onChange={(e) => setForm({ ...settings, rewardAmountUsd: Number(e.target.value) })}
                className="w-32 px-3 py-2 rounded-[10px] bg-white/5 border border-white/10 text-sm text-slate-200"
              />
            </label>
            <label className="block">
              <span className="block text-[11px] text-slate-400 mb-1">Minimum purchase (USD)</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={settings.minPurchaseUsd}
                onChange={(e) => setForm({ ...settings, minPurchaseUsd: Number(e.target.value) })}
                className="w-40 px-3 py-2 rounded-[10px] bg-white/5 border border-white/10 text-sm text-slate-200"
              />
            </label>
            <label className="block">
              <span className="block text-[11px] text-slate-400 mb-1">
                Qualification window (days, 0 = none)
              </span>
              <input
                type="number"
                min={0}
                value={settings.qualificationDays}
                onChange={(e) =>
                  setForm({ ...settings, qualificationDays: Number(e.target.value) })
                }
                className="w-48 px-3 py-2 rounded-[10px] bg-white/5 border border-white/10 text-sm text-slate-200"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-300 pb-2">
              <input
                type="checkbox"
                checked={settings.active}
                onChange={(e) => setForm({ ...settings, active: e.target.checked })}
              />
              Programme active
            </label>
            <button
              disabled={save.isPending}
              onClick={() => save.mutate()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-bold disabled:opacity-60"
            >
              <Save className="w-4 h-4" /> {save.isPending ? "Saving…" : "Save"}
            </button>
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search referrer, invited member or reference"
            className="w-full pl-9 pr-3 py-2 rounded-[10px] bg-white/5 border border-white/10 text-sm text-slate-200 placeholder:text-slate-500"
          />
        </div>
        {(["all", "pending", "qualified", "rewarded", "reversed"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-2 rounded-[10px] text-xs font-bold border ${
              filter === f
                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                : "bg-white/5 border-white/10 text-slate-300"
            }`}
          >
            {f[0].toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {data.isLoading ? (
        <div className="p-8 text-center">
          <Loader2 className="w-5 h-5 animate-spin text-slate-500 inline" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-[#141418] p-8 text-center text-sm text-slate-500">
          No referrals match this view.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.inviteeId} className="rounded-xl border border-white/10 bg-[#141418] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-white text-sm font-bold truncate">
                    {r.referrerName} → {r.inviteeName}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Attributed {new Date(r.createdAt).toLocaleDateString()}
                    {r.qualifiedAt
                      ? ` · Qualified ${new Date(r.qualifiedAt).toLocaleString()}`
                      : " · Awaiting first settled purchase"}
                  </div>
                  {r.qualifiedOrderId && (
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Order {r.qualifiedOrderId.slice(0, 8)} · {r.orderReference ?? "no reference"} ·{" "}
                      {r.orderTotalUsd != null ? `$${r.orderTotalUsd.toFixed(2)}` : "—"} ·{" "}
                      {r.orderStatus ?? "—"}
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className="text-emerald-300 font-mono text-sm">
                    {r.rewardUsd > 0 ? `$${r.rewardUsd.toFixed(2)}` : "—"}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {r.status} · reward {r.rewardStatus}
                  </div>
                  {r.rewardTxHash && (
                    <div className="text-[10px] text-slate-600 font-mono">{r.rewardTxHash}</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
