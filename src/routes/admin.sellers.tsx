import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Search, ShieldCheck, Store, Ban, X } from "lucide-react";
import { adminListSellers, type AdminSellerRow } from "@/lib/admin-sellers.functions";
import { verifySeller, suspendSeller } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/sellers")({
  head: () => ({
    meta: [{ title: "Sellers · Admin" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: SellersPage,
});

const FILTERS = ["all", "verified", "unverified", "suspended", "flagged"] as const;

function SellersPage() {
  const listFn = useServerFn(adminListSellers);
  const verifyFn = useServerFn(verifySeller);
  const suspendFn = useServerFn(suspendSeller);
  const qc = useQueryClient();

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<AdminSellerRow | null>(null);

  const query = useQuery({
    queryKey: ["admin-sellers"],
    queryFn: () => listFn(),
    staleTime: 15_000,
  });

  const rows = useMemo(() => {
    const all = query.data ?? [];
    const term = q.trim().toLowerCase();
    return all.filter((s) => {
      if (filter === "verified" && !s.kycCompletedAt) return false;
      if (filter === "unverified" && s.kycCompletedAt) return false;
      if (filter === "suspended" && !s.bannedAt) return false;
      if (filter === "flagged" && !s.flagged) return false;
      if (!term) return true;
      return [s.username, s.displayName, s.shopName, s.userId]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(term));
    });
  }, [query.data, q, filter]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-sellers"] });

  const verify = async (userId: string, tier: string) => {
    setBusy(userId);
    try {
      await verifyFn({ data: { userId, tier } });
      toast.success(`Seller verified (${tier})`);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  };

  const suspend = async (userId: string) => {
    const reason = window.prompt("Reason for suspending this seller");
    if (!reason) return;
    setBusy(userId);
    try {
      await suspendFn({ data: { userId, reason } });
      toast.success("Seller suspended");
      setOpen(null);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-white text-2xl font-black flex items-center gap-2">
            <Store className="w-6 h-6 text-emerald-300" /> Sellers &amp; shops
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Everyone with at least one listing, with their shop, catalogue and settled sales.
            Earnings are shown from settled order records and cannot be edited here.
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search seller or shop…"
            className="bg-[#141418] border border-white/10 rounded-[10px] pl-9 pr-4 py-2 text-sm text-white w-64"
          />
        </div>
      </header>

      <div className="flex flex-wrap gap-2 mb-5">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-[10px] text-xs font-bold uppercase tracking-wider border ${
              filter === f
                ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300"
                : "bg-[#141418] border-white/10 text-slate-400"
            }`}
          >
            {f}
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-500 self-center">{rows.length} sellers</span>
      </div>

      {query.isError && (
        <div className="mb-4 text-sm text-red-300 bg-red-500/10 border border-red-500/40 rounded-[10px] p-3">
          {(query.error as Error).message}
        </div>
      )}

      {query.isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-7 h-7 animate-spin text-emerald-500" />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-20 bg-[#141418] border border-white/10 rounded-2xl text-slate-500 text-sm">
          No sellers match this view.
        </div>
      ) : (
        <div className="bg-[#141418] border border-white/10 rounded-xl overflow-x-auto">
          <div className="min-w-[900px]">
            <div className="grid grid-cols-[1fr_1fr_110px_110px_110px_120px] gap-3 px-4 py-2.5 text-[10px] uppercase tracking-widest text-slate-500 font-bold border-b border-white/10 bg-black/20">
              <div>Seller</div>
              <div>Shop</div>
              <div>Status</div>
              <div className="text-right">Listings</div>
              <div className="text-right">Sales</div>
              <div className="text-right">Gross (USD)</div>
            </div>
            <div className="divide-y divide-white/5">
              {rows.map((s) => (
                <button
                  key={s.userId}
                  onClick={() => setOpen(s)}
                  className="w-full text-left grid grid-cols-[1fr_1fr_110px_110px_110px_120px] gap-3 px-4 py-3 text-sm items-center hover:bg-white/5"
                >
                  <div className="min-w-0">
                    <div className="text-white truncate">
                      {s.displayName ?? s.username ?? "Unknown"}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      @{s.username ?? "no-handle"}
                    </div>
                  </div>
                  <div className="min-w-0 text-slate-300 truncate">{s.shopName ?? "—"}</div>
                  <div className="text-[11px]">
                    {s.bannedAt ? (
                      <span className="text-red-300 font-bold">suspended</span>
                    ) : s.kycCompletedAt ? (
                      <span className="text-emerald-300 font-bold">verified</span>
                    ) : (
                      <span className="text-slate-400 font-bold">unverified</span>
                    )}
                    {s.flagged && <div className="text-amber-300">flagged</div>}
                  </div>
                  <div className="text-right text-slate-300">
                    {s.activeProductCount}/{s.productCount}
                  </div>
                  <div className="text-right text-slate-300">{s.salesCount}</div>
                  <div className="text-right text-white font-bold">
                    ${s.grossSalesUsd.toFixed(2)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 bg-black/70 flex justify-end" onClick={() => setOpen(null)}>
          <aside
            className="w-full max-w-md h-full overflow-y-auto bg-[#141418] border-l border-white/10 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-white text-lg font-black">
                  {open.displayName ?? open.username}
                </h2>
                <p className="text-xs text-slate-500">@{open.username ?? "no-handle"}</p>
              </div>
              <button
                onClick={() => setOpen(null)}
                className="p-2 rounded-[10px] bg-white/5 text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <dl className="rounded-xl border border-white/10 bg-black/20 divide-y divide-white/5 text-xs mb-4">
              <Row k="Shop" v={open.shopName ?? "—"} />
              <Row k="About" v={open.shopAbout ?? "—"} />
              <Row k="Country" v={open.country ?? "—"} />
              <Row k="Joined" v={new Date(open.createdAt).toLocaleDateString()} />
              <Row k="Verification tier" v={open.verificationTier ?? "NONE"} />
              <Row
                k="Verified at"
                v={open.kycCompletedAt ? new Date(open.kycCompletedAt).toLocaleString() : "—"}
              />
              <Row
                k="Suspended"
                v={open.bannedAt ? new Date(open.bannedAt).toLocaleString() : "no"}
              />
              {open.flagReason && <Row k="Flag reason" v={open.flagReason} />}
              <Row k="Listings" v={`${open.activeProductCount} active / ${open.productCount}`} />
              <Row k="Promoted listings" v={String(open.promotedProductCount)} />
              <Row k="Settled sales" v={String(open.salesCount)} />
              <Row k="Gross settled" v={`$${open.grossSalesUsd.toFixed(2)}`} />
            </dl>

            <div className="flex flex-wrap gap-2">
              {open.shopSlug && (
                <Link
                  to="/shop/$id"
                  params={{ id: open.shopSlug }}
                  className="px-3 py-2 rounded-[10px] bg-white/5 border border-white/10 text-xs text-slate-200"
                >
                  Open shop
                </Link>
              )}
              {!open.kycCompletedAt && (
                <button
                  onClick={() => verify(open.userId, "TIER_1")}
                  disabled={busy === open.userId}
                  className="px-3 py-2 rounded-[10px] bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-3.5 h-3.5" /> Verify Tier 1
                </button>
              )}
              {!open.bannedAt && (
                <button
                  onClick={() => suspend(open.userId)}
                  disabled={busy === open.userId}
                  className="px-3 py-2 rounded-[10px] bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-bold disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  <Ban className="w-3.5 h-3.5" /> Suspend seller
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-4">
              Seller earnings, payouts and wallet balances are not editable from this screen.
            </p>
          </aside>
        </div>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-start justify-between gap-4 px-3 py-2">
      <span className="text-slate-500">{k}</span>
      <span className="text-slate-200 text-right break-words">{v}</span>
    </div>
  );
}
