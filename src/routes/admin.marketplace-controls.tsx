import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LayoutGrid, Loader2, Search, Star, StarOff } from "lucide-react";
import { listAllProducts, setProductPromoted } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/marketplace-controls")({
  head: () => ({
    meta: [
      { title: "Marketplace Curation · Admin" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: MarketplaceControlsPage,
});

type ProductRow = {
  id: string;
  name: string;
  category: string | null;
  vendor: string | null;
  price_usd: number | null;
  status: string | null;
  promoted: boolean | null;
  kind: string | null;
};

/**
 * Editorial curation only. The single curated concept the marketplace actually
 * reads is `products.promoted`, so this screen manages exactly that through the
 * existing audited `setProductPromoted` server function.
 */
function MarketplaceControlsPage() {
  const listFn = useServerFn(listAllProducts);
  const promoteFn = useServerFn(setProductPromoted);
  const qc = useQueryClient();

  const [q, setQ] = useState("");
  const [onlyFeatured, setOnlyFeatured] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["admin-curation-products"],
    queryFn: () => listFn() as Promise<ProductRow[]>,
    staleTime: 15_000,
  });

  const products = useMemo(() => {
    const all = (query.data ?? []) as ProductRow[];
    const term = q.trim().toLowerCase();
    return all.filter((p) => {
      if (onlyFeatured && !p.promoted) return false;
      if (p.status !== "active") return false;
      if (!term) return true;
      return [p.name, p.category, p.vendor]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(term));
    });
  }, [query.data, q, onlyFeatured]);

  const featuredCount = ((query.data ?? []) as ProductRow[]).filter((p) => p.promoted).length;

  const toggle = async (p: ProductRow) => {
    setBusy(p.id);
    try {
      await promoteFn({ data: { id: p.id, promoted: !p.promoted } });
      toast.success(p.promoted ? "Removed from featured" : "Featured on the marketplace");
      await qc.invalidateQueries({ queryKey: ["admin-curation-products"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-white text-2xl font-black flex items-center gap-2">
            <LayoutGrid className="w-6 h-6 text-sky-300" /> Marketplace Curation
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Choose which live listings are featured across the marketplace. {featuredCount}{" "}
            currently featured.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setOnlyFeatured((v) => !v)}
            className={`px-3 py-2 rounded-[10px] text-xs font-bold uppercase tracking-wider border ${
              onlyFeatured
                ? "bg-amber-500/15 border-amber-500/50 text-amber-300"
                : "bg-[#141418] border-white/10 text-slate-400"
            }`}
          >
            Featured only
          </button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search listings…"
              className="bg-[#141418] border border-white/10 rounded-[10px] pl-9 pr-4 py-2 text-sm text-white w-60"
            />
          </div>
        </div>
      </header>

      {query.isError && (
        <div className="mb-4 text-sm text-red-300 bg-red-500/10 border border-red-500/40 rounded-[10px] p-3">
          {(query.error as Error).message}
        </div>
      )}

      {query.isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-7 h-7 animate-spin text-sky-400" />
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-20 bg-[#141418] border border-white/10 rounded-2xl text-slate-500 text-sm">
          No live listings match this view.
        </div>
      ) : (
        <div className="grid gap-2">
          {products.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3 bg-[#141418] border border-white/10 rounded-xl px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="text-white text-sm font-bold truncate">{p.name}</div>
                <div className="text-[11px] text-slate-500 truncate">
                  {p.category ?? "—"} · {p.vendor ?? "—"} ·{" "}
                  {p.price_usd == null ? "—" : `$${Number(p.price_usd).toFixed(2)}`}
                </div>
              </div>
              <button
                onClick={() => toggle(p)}
                disabled={busy === p.id}
                className={`px-3 py-1.5 rounded-[10px] text-xs font-bold border inline-flex items-center gap-1.5 disabled:opacity-50 ${
                  p.promoted
                    ? "bg-amber-500/15 border-amber-500/50 text-amber-300"
                    : "bg-white/5 border-white/10 text-slate-300"
                }`}
              >
                {busy === p.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : p.promoted ? (
                  <Star className="w-3.5 h-3.5 fill-amber-300" />
                ) : (
                  <StarOff className="w-3.5 h-3.5" />
                )}
                {p.promoted ? "Featured" : "Feature"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
