import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, SlidersHorizontal } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";

import {
  listProducts,
  listMarketplaceCategories,
  type ProductDTO,
} from "@/lib/marketplace.functions";
import { safeFormatDisplayPrice } from "@/lib/fx-display";
import type { Currency } from "@/lib/onboarding/OnboardingContext";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { haptic } from "@/lib/haptics";
import { ProductQuickView } from "./ProductQuickView";
import { AppSearchSheet } from "./AppSearchSheet";

/**
 * Native app Market — search-first, chip filters, dense 2-column grid.
 * Replaces the web marketplace page inside the installed app shell.
 */
export function AppMarket() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [quickViewId, setQuickViewId] = useState<string | null>(null);
  const [cat, setCat] = useState<string>("all");
  const { baseCurrency } = useOnboarding();
  const currency = (baseCurrency ?? "USD") as Currency;

  const fetchProducts = useServerFn(listProducts);
  const fetchCategories = useServerFn(listMarketplaceCategories);

  const { data: products } = useQuery({
    queryKey: ["app-market-products"],
    queryFn: () => fetchProducts(),
    staleTime: 60_000,
  });

  const { data: categories } = useQuery({
    queryKey: ["app-market-categories"],
    queryFn: () => fetchCategories(),
    staleTime: 300_000,
  });

  const priceOf = (p: ProductDTO) =>
    safeFormatDisplayPrice(
      {
        price_usd: p.priceUSD,
        original_currency: p.originalCurrency,
        original_amount: p.originalAmount,
        fx_snapshot: p.fxSnapshot,
      },
      currency,
    );

  const visible = useMemo(() => {
    const all = products ?? [];
    if (cat === "all") return all;
    const selected = (categories ?? []).find((c) => c.id === cat);
    if (!selected) return all;
    const names = new Set(
      [selected.name, ...selected.children.map((c) => c.name)].map((n) =>
        n.toLowerCase(),
      ),
    );
    return all.filter((p) => names.has(String(p.category ?? "").toLowerCase()));
  }, [products, cat, categories]);

  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-28 pt-4 text-white">
      <h1 className="text-[18px] font-extrabold tracking-tight">Market</h1>

      {/* Search pill */}
      <button
        type="button"
        onClick={() => {
          haptic("select");
          setSearchOpen(true);
        }}
        className="nav-tap mt-3 flex w-full items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2.5 text-left"
      >
        <Search className="h-4 w-4 shrink-0 text-white/40" />
        <span className="flex-1 text-[13px] text-white/35">Search the market</span>
        <SlidersHorizontal className="h-4 w-4 text-white/40" />
      </button>

      {/* Category chips */}
      <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={() => {
            haptic("select");
            setCat("all");
          }}
          className={`nav-tap shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-semibold ${
            cat === "all"
              ? "bg-[#E5484D] text-white shadow-[0_6px_18px_-6px_rgba(229,72,77,0.6)]"
              : "border border-white/10 bg-white/[0.05] text-white/60"
          }`}
        >
          All
        </button>
        {(categories ?? []).map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              haptic("select");
              setCat(c.id);
            }}
            className={`nav-tap shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-semibold ${
              cat === c.id
                ? "bg-[#E5484D] text-white shadow-[0_6px_18px_-6px_rgba(229,72,77,0.6)]"
                : "border border-white/10 bg-white/[0.05] text-white/60"
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Dense grid */}
      <div className="mt-5 grid grid-cols-2 gap-3">
        {visible.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              haptic("select");
              setQuickViewId(p.id);
            }}
            className="nav-tap overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.03] text-left"
          >
            <div className="aspect-[4/3] w-full overflow-hidden bg-white/[0.04]">
              {p.coverUrl ? (
                <img src={p.coverUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[10px] text-white/25">
                  No cover
                </div>
              )}
            </div>
            <div className="p-2.5">
              <p className="line-clamp-1 text-[12px] font-semibold">{p.name}</p>
              <p className="mt-0.5 line-clamp-1 text-[10px] text-white/35">{p.vendor}</p>
              <p className="mt-1 text-[12px] font-bold text-[#E5484D]">{priceOf(p)}</p>
            </div>
          </button>
        ))}
      </div>
      {visible.length === 0 && (
        <p className="mt-16 text-center text-[13px] text-white/35">
          Nothing in this category yet.
        </p>
      )}

      <AppSearchSheet
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        products={products ?? []}
        currency={currency}
        onPick={(id) => {
          setSearchOpen(false);
          setQuickViewId(id);
        }}
      />
      <ProductQuickView
        productId={quickViewId}
        currency={currency}
        onClose={() => setQuickViewId(null)}
      />
    </div>
  );
}
