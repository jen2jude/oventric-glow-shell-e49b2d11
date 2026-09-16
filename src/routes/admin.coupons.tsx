import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Ticket, Search, Plus, X } from "lucide-react";
import {
  adminListCoupons,
  adminUpsertCoupon,
  adminSetCouponActive,
  adminListCouponRedemptions,
  type AdminCouponRow,
} from "@/lib/admin-promotions.functions";

export const Route = createFileRoute("/admin/coupons")({
  head: () => ({
    meta: [{ title: "Coupons · Admin · Oventric" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: AdminCouponsPage,
  errorComponent: ({ error, reset }) => (
    <div className="p-6 text-red-300">
      <div className="font-bold mb-2">Coupons error</div>
      <div className="text-sm text-red-200/80 mb-3">{error.message}</div>
      <button onClick={reset} className="px-3 py-1.5 rounded-[10px] border border-red-500/40 text-sm">
        Retry
      </button>
    </div>
  ),
  notFoundComponent: () => <div className="p-6 text-slate-400">Not found.</div>,
});

type Draft = {
  code: string;
  discountPct: number;
  active: boolean;
  startsAt: string;
  expiresAt: string;
  minPurchaseUsd: number;
  maxUses: string;
  perUserLimit: string;
  sellerId: string;
  productId: string;
  isNew: boolean;
};

const emptyDraft = (): Draft => ({
  code: "",
  discountPct: 10,
  active: true,
  startsAt: "",
  expiresAt: "",
  minPurchaseUsd: 0,
  maxUses: "",
  perUserLimit: "",
  sellerId: "",
  productId: "",
  isNew: true,
});

const toLocal = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 16) : "");

function AdminCouponsPage() {
  const listFn = useServerFn(adminListCoupons);
  const upsertFn = useServerFn(adminUpsertCoupon);
  const toggleFn = useServerFn(adminSetCouponActive);
  const redemptionsFn = useServerFn(adminListCouponRedemptions);
  const qc = useQueryClient();

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive" | "expired">("all");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [openCode, setOpenCode] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const list = useQuery({ queryKey: ["admin-coupons"], queryFn: () => listFn(), staleTime: 15_000 });
  const reds = useQuery({
    queryKey: ["admin-coupon-redemptions", openCode],
    queryFn: () => redemptionsFn({ data: { code: openCode! } }),
    enabled: Boolean(openCode),
  });

  const save = useMutation({
    mutationFn: (d: Draft) =>
      upsertFn({
        data: {
          code: d.code,
          discountPct: Number(d.discountPct),
          active: d.active,
          startsAt: d.startsAt ? new Date(d.startsAt).toISOString() : null,
          expiresAt: d.expiresAt ? new Date(d.expiresAt).toISOString() : null,
          minPurchaseUsd: Number(d.minPurchaseUsd),
          maxUses: d.maxUses ? Number(d.maxUses) : null,
          perUserLimit: d.perUserLimit ? Number(d.perUserLimit) : null,
          sellerId: d.sellerId || null,
          productId: d.productId || null,
          isNew: d.isNew,
        },
      }),
    onSuccess: () => {
      setDraft(null);
      setErr(null);
      qc.invalidateQueries({ queryKey: ["admin-coupons"] });
    },
    onError: (e: unknown) => setErr(e instanceof Error ? e.message : "Could not save the coupon"),
  });

  const toggle = useMutation({
    mutationFn: (v: { code: string; active: boolean }) => toggleFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-coupons"] }),
    onError: (e: unknown) => setErr(e instanceof Error ? e.message : "Could not update the coupon"),
  });

  const rows = useMemo(() => {
    const now = Date.now();
    return (list.data ?? []).filter((c) => {
      const expired = c.expiresAt ? new Date(c.expiresAt).getTime() < now : false;
      if (status === "active" && (!c.active || expired)) return false;
      if (status === "inactive" && c.active) return false;
      if (status === "expired" && !expired) return false;
      if (!q.trim()) return true;
      const t = q.trim().toLowerCase();
      return (
        c.code.toLowerCase().includes(t) ||
        (c.sellerName ?? "").toLowerCase().includes(t) ||
        (c.productName ?? "").toLowerCase().includes(t)
      );
    });
  }, [list.data, q, status]);

  const edit = (c: AdminCouponRow) =>
    setDraft({
      code: c.code,
      discountPct: c.discountPct,
      active: c.active,
      startsAt: toLocal(c.startsAt),
      expiresAt: toLocal(c.expiresAt),
      minPurchaseUsd: c.minPurchaseUsd,
      maxUses: c.maxUses == null ? "" : String(c.maxUses),
      perUserLimit: c.perUserLimit == null ? "" : String(c.perUserLimit),
      sellerId: c.sellerId ?? "",
      productId: c.productId ?? "",
      isNew: false,
    });

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-white text-2xl font-black flex items-center gap-2">
            <Ticket className="w-5 h-5 text-emerald-400" /> Coupons
          </h1>
          <p className="text-sm text-slate-400">
            Discount codes used at checkout. Eligibility, limits and the final discount are always
            recomputed by the server at payment time — this screen only configures the rules.
          </p>
        </div>
        <button
          onClick={() => setDraft(emptyDraft())}
          className="shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-[10px] bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-bold"
        >
          <Plus className="w-4 h-4" /> New coupon
        </button>
      </header>

      {err && (
        <div className="mb-3 rounded-[10px] border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {err}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search code, seller or product"
            className="w-full pl-9 pr-3 py-2 rounded-[10px] bg-white/5 border border-white/10 text-sm text-slate-200 placeholder:text-slate-500"
          />
        </div>
        {(["all", "active", "inactive", "expired"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`px-3 py-2 rounded-[10px] text-xs font-bold border ${
              status === s
                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                : "bg-white/5 border-white/10 text-slate-300"
            }`}
          >
            {s[0].toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {list.isLoading ? (
        <div className="p-8 text-center">
          <Loader2 className="w-5 h-5 animate-spin text-slate-500 inline" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-[#141418] p-8 text-center text-sm text-slate-500">
          No coupons match this view.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((c) => (
            <div key={c.code} className="rounded-xl border border-white/10 bg-[#141418] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-white text-sm font-bold">{c.code}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full border ${
                        c.active
                          ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                          : "bg-slate-500/10 border-slate-500/40 text-slate-400"
                      }`}
                    >
                      {c.active ? "Active" : "Disabled"}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    {c.discountPct}% off · min spend ${c.minPurchaseUsd.toFixed(2)} ·{" "}
                    {c.maxUses == null ? "unlimited uses" : `${c.usedCount}/${c.maxUses} used`} ·{" "}
                    {c.perUserLimit == null ? "no per-user cap" : `${c.perUserLimit} per user`}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {c.startsAt ? `From ${new Date(c.startsAt).toLocaleDateString()}` : "No start date"} ·{" "}
                    {c.expiresAt ? `Until ${new Date(c.expiresAt).toLocaleDateString()}` : "No end date"}
                    {c.productName ? ` · Product: ${c.productName}` : ""}
                    {c.sellerName ? ` · Seller: ${c.sellerName}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right mr-2">
                    <div className="text-white text-sm font-mono">{c.redemptionCount}</div>
                    <div className="text-[10px] text-slate-500">redemptions</div>
                  </div>
                  <button
                    onClick={() => setOpenCode(openCode === c.code ? null : c.code)}
                    className="px-3 py-1.5 rounded-[10px] bg-white/5 border border-white/10 text-xs text-slate-200"
                  >
                    {openCode === c.code ? "Hide uses" : "View uses"}
                  </button>
                  <button
                    onClick={() => edit(c)}
                    className="px-3 py-1.5 rounded-[10px] bg-white/5 border border-white/10 text-xs text-slate-200"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => toggle.mutate({ code: c.code, active: !c.active })}
                    className="px-3 py-1.5 rounded-[10px] bg-white/5 border border-white/10 text-xs text-slate-200"
                  >
                    {c.active ? "Disable" : "Enable"}
                  </button>
                </div>
              </div>

              {openCode === c.code && (
                <div className="mt-3 border-t border-white/5 pt-3">
                  {reds.isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
                  ) : (reds.data ?? []).length === 0 ? (
                    <div className="text-xs text-slate-500">No redemptions recorded yet.</div>
                  ) : (
                    <div className="space-y-1">
                      {(reds.data ?? []).map((r) => (
                        <div key={r.id} className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-300">{r.userName}</span>
                          <span className="font-mono text-slate-400">
                            ${r.discountUsd.toFixed(2)} · {r.reference ?? "no reference"} ·{" "}
                            {new Date(r.createdAt).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {draft && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-xl border border-white/10 bg-[#141418] p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-bold">{draft.isNew ? "New coupon" : `Edit ${draft.code}`}</h2>
              <button onClick={() => setDraft(null)} className="text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <Field label="Code">
                <input
                  disabled={!draft.isNew}
                  value={draft.code}
                  onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 rounded-[10px] bg-white/5 border border-white/10 text-slate-200 font-mono disabled:opacity-60"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Discount %">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={draft.discountPct}
                    onChange={(e) => setDraft({ ...draft, discountPct: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-[10px] bg-white/5 border border-white/10 text-slate-200"
                  />
                </Field>
                <Field label="Minimum spend (USD)">
                  <input
                    type="number"
                    min={0}
                    value={draft.minPurchaseUsd}
                    onChange={(e) => setDraft({ ...draft, minPurchaseUsd: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-[10px] bg-white/5 border border-white/10 text-slate-200"
                  />
                </Field>
                <Field label="Starts">
                  <input
                    type="datetime-local"
                    value={draft.startsAt}
                    onChange={(e) => setDraft({ ...draft, startsAt: e.target.value })}
                    className="w-full px-3 py-2 rounded-[10px] bg-white/5 border border-white/10 text-slate-200"
                  />
                </Field>
                <Field label="Ends">
                  <input
                    type="datetime-local"
                    value={draft.expiresAt}
                    onChange={(e) => setDraft({ ...draft, expiresAt: e.target.value })}
                    className="w-full px-3 py-2 rounded-[10px] bg-white/5 border border-white/10 text-slate-200"
                  />
                </Field>
                <Field label="Total uses (blank = unlimited)">
                  <input
                    value={draft.maxUses}
                    onChange={(e) => setDraft({ ...draft, maxUses: e.target.value })}
                    className="w-full px-3 py-2 rounded-[10px] bg-white/5 border border-white/10 text-slate-200"
                  />
                </Field>
                <Field label="Uses per customer (blank = unlimited)">
                  <input
                    value={draft.perUserLimit}
                    onChange={(e) => setDraft({ ...draft, perUserLimit: e.target.value })}
                    className="w-full px-3 py-2 rounded-[10px] bg-white/5 border border-white/10 text-slate-200"
                  />
                </Field>
              </div>
              <Field label="Restrict to product ID (optional)">
                <input
                  value={draft.productId}
                  onChange={(e) => setDraft({ ...draft, productId: e.target.value.trim() })}
                  className="w-full px-3 py-2 rounded-[10px] bg-white/5 border border-white/10 text-slate-200 font-mono text-xs"
                />
              </Field>
              <Field label="Restrict to seller ID (optional)">
                <input
                  value={draft.sellerId}
                  onChange={(e) => setDraft({ ...draft, sellerId: e.target.value.trim() })}
                  className="w-full px-3 py-2 rounded-[10px] bg-white/5 border border-white/10 text-slate-200 font-mono text-xs"
                />
              </Field>
              <label className="flex items-center gap-2 text-slate-300">
                <input
                  type="checkbox"
                  checked={draft.active}
                  onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
                />
                Active
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setDraft(null)}
                className="px-3 py-2 rounded-[10px] bg-white/5 border border-white/10 text-sm text-slate-300"
              >
                Cancel
              </button>
              <button
                disabled={save.isPending}
                onClick={() => save.mutate(draft)}
                className="px-4 py-2 rounded-[10px] bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-bold disabled:opacity-60"
              >
                {save.isPending ? "Saving…" : "Save coupon"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] text-slate-400 mb-1">{label}</span>
      {children}
    </label>
  );
}
