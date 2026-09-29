import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, SlidersHorizontal } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";

import {
  listProducts,
  listMarketplaceCategories,
  type ProductDTO,
} from "@/lib/marketplace.functions";
import { visibleProductPrice } from "@/lib/money-visibility";
import type { Currency } from "@/lib/onboarding/OnboardingContext";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { haptic } from "@/lib/haptics";
import { ProductQuickView } from "./ProductQuickView";
import { AppSearchSheet } from "./AppSearchSheet";
import { OutOfStockTag } from "@/components/oventric/StockBadge";

/**
 * Native app Market — Curated Boutique layout. Search pill + category chips on
 * top, then clearly separated sections with mixed card styles: a featured
 * spotlight, a fresh-drops rail, wide deal cards and a dense grid.
 */
export function AppMarket() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [quickViewId, setQuickViewId] = useState<string | null>(null);
  const [cat, setCat] = useState<string>("all");
  const { homeCurrency, balancesHidden } = useOnboarding();
  const currency = (homeCurrency ?? "USD") as Currency;

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
    visibleProductPrice(
      {
        price_usd: p.priceUSD,
        original_currency: p.originalCurrency,
        original_amount: p.originalAmount,
        fx_snapshot: p.fxSnapshot,
      },
      currency,
      balancesHidden,
    );

  const all = useMemo(() => products ?? [], [products]);

  const visible = useMemo(() => {
    if (cat === "all") return all;
    const selected = (categories ?? []).find((c) => c.id === cat);
    if (!selected) return all;
    const names = new Set(
      [selected.name, ...selected.children.map((c) => c.name)].map((n) =>
        n.toLowerCase(),
      ),
    );
    return all.filter((p) => names.has(String(p.category ?? "").toLowerCase()));
  }, [all, cat, categories]);

  // Section splits — boutique curation from the visible set.
  // The spotlight rotates: each fresh visit to the Market page shows the next
  // product in the promoted pool (all products when nothing is promoted), so
  // the same hero isn't always Edublink. The visit counter survives within the
  // browser session; refetches inside one mount keep the same spotlight.
  const spotlightPool = useMemo(() => {
    const promoted = visible.filter((p) => p.promoted);
    return promoted.length ? promoted : visible;
  }, [visible]);
  const poolKey = spotlightPool.map((p) => p.id).join("|");
  const poolKeyRef = useRef<string | null>(null);
  const spotlightIndexRef = useRef(0);
  const spotlight = useMemo(() => {
    if (!spotlightPool.length) return null;
    if (poolKeyRef.current !== poolKey) {
      poolKeyRef.current = poolKey;
      let idx = 0;
      try {
        const prev = Number(sessionStorage.getItem("oventric:market-spotlight") ?? "0") || 0;
        idx = prev % spotlightPool.length;
        sessionStorage.setItem("oventric:market-spotlight", String(prev + 1));
      } catch {
        // storage unavailable — fall back to the first product
      }
      spotlightIndexRef.current = idx;
    }
    return spotlightPool[spotlightIndexRef.current] ?? null;
  }, [spotlightPool, poolKey]);
  const fresh = useMemo(
    () => visible.filter((p) => p.id !== spotlight?.id).slice(0, 8),
    [visible, spotlight],
  );
  const deals = useMemo(
    () =>
      visible
        .filter((p) => (p.cashbackPct ?? 0) > 0 && p.id !== spotlight?.id)
        .slice(0, 3),
    [visible, spotlight],
  );
  const rest = useMemo(() => {
    const used = new Set(
      [spotlight?.id, ...fresh.map((p) => p.id), ...deals.map((p) => p.id)].filter(
        Boolean,
      ) as string[],
    );
    return visible.filter((p) => !used.has(p.id));
  }, [visible, spotlight, fresh, deals]);

  const open = (id: string) => {
    haptic("select");
    setQuickViewId(id);
  };

  const sectionTitle = (t: string) => (
    <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/40">
      {t}
    </h3>
  );

  return (
    <div className="mx-auto w-full max-w-xl pb-28 pt-4 text-white">
      {/* Search pill */}
      <div className="px-4">
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
      </div>

      {/* Category chips */}
      <div className="mt-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={() => {
            haptic("select");
            setCat("all");
          }}
          className={`nav-tap shrink-0 rounded-full px-4 py-1.5 text-[12px] font-semibold ${
            cat === "all"
              ? "bg-[#E5484D] text-white shadow-[0_6px_18px_-6px_rgba(229,72,77,0.6)]"
              : "border border-white/10 bg-white/[0.05] text-white/70"
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
            className={`nav-tap shrink-0 rounded-full px-4 py-1.5 text-[12px] font-semibold ${
              cat === c.id
                ? "bg-[#E5484D] text-white shadow-[0_6px_18px_-6px_rgba(229,72,77,0.6)]"
                : "border border-white/10 bg-white/[0.05] text-white/70"
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Featured spotlight */}
      {spotlight && (
        <div className="mt-4 px-4">
          <button
            type="button"
            onClick={() => open(spotlight.id)}
            className="nav-tap relative block aspect-[16/9] w-full overflow-hidden rounded-2xl border border-white/5 text-left"
          >
            {spotlight.coverUrl ? (
              <img
                src={spotlight.coverUrl}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="h-full w-full bg-white/[0.04]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
            <div className="absolute bottom-0 left-0 p-4">
              <span className="mb-2 inline-block rounded bg-[#E5484D] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                {spotlight.promoted ? "Featured" : "Spotlight"}
              </span>
              <h2 className="text-[17px] font-bold leading-tight">{spotlight.name}</h2>
              <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-white/60">
                {spotlight.vendor} ·{" "}
                <span
                  className={`font-bold ${
                    spotlight.inStock === false ? "text-white/35" : "text-[#E5484D]"
                  }`}
                >
                  {priceOf(spotlight)}
                </span>
                {spotlight.inStock === false && <OutOfStockTag />}
              </p>
            </div>
          </button>
        </div>
      )}

      {/* Fresh drops rail */}
      {fresh.length > 0 && (
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between px-4">
            {sectionTitle("Fresh drops")}
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#E5484D]">
              {visible.length} items
            </span>
          </div>
          <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {fresh.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => open(p.id)}
                className="nav-tap w-[130px] shrink-0 snap-start space-y-2 text-left"
              >
                <div className="aspect-square overflow-hidden rounded-2xl border border-white/10 bg-white/[0.05]">
                  {p.coverUrl ? (
                    <img
                      src={p.coverUrl}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] text-white/25">
                      No cover
                    </div>
                  )}
                </div>
                <div>
                  <p className="truncate text-[11px] font-medium text-white/90">{p.name}</p>
                  <p className="flex flex-wrap items-center gap-1">
                    <span className={`text-[11px] font-bold ${p.inStock === false ? "text-white/35" : "text-[#E5484D]"}`}>
                      {priceOf(p)}
                    </span>
                    {p.inStock === false && <OutOfStockTag />}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Limited deals — wide list cards with cashback badge */}
      {deals.length > 0 && (
        <div className="mt-6 px-4">
          <div className="mb-3">{sectionTitle("Cashback deals")}</div>
          <div className="space-y-3">
            {deals.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => open(p.id)}
                className="nav-tap flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.05] p-3 text-left"
              >
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-white/5 bg-black/40">
                  {p.coverUrl ? (
                    <img
                      src={p.coverUrl}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[9px] text-white/25">
                      No cover
                    </div>
                  )}
                </div>
                <div className="flex h-20 flex-1 flex-col justify-between py-0.5">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <p className="line-clamp-1 text-[12px] font-semibold text-white/90">
                        {p.name}
                      </p>
                      <span className="shrink-0 rounded bg-[#E5484D]/20 px-1.5 py-0.5 text-[9px] font-bold text-[#E5484D]">
                        +{p.cashbackPct}% back
                      </span>
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-[10px] text-white/40">{p.vendor}</p>
                  </div>
                  <p className="flex flex-wrap items-center gap-1.5 text-[13px] font-bold">
                    <span className={p.inStock === false ? "text-white/35" : "text-white"}>
                      {priceOf(p)}
                    </span>
                    {p.inStock === false && <OutOfStockTag />}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Everything else — dense grid */}
      {rest.length > 0 && (
        <div className="mt-6 px-4">
          <div className="mb-3">{sectionTitle("More to explore")}</div>
          <div className="grid grid-cols-2 gap-3">
            {rest.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => open(p.id)}
                className="nav-tap overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.03] text-left"
              >
                <div className="aspect-[4/3] w-full overflow-hidden bg-white/[0.04]">
                  {p.coverUrl ? (
                    <img
                      src={p.coverUrl}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] text-white/25">
                      No cover
                    </div>
                  )}
                </div>
                <div className="p-2.5">
                  <p className="line-clamp-1 text-[12px] font-semibold">{p.name}</p>
                  <p className="mt-0.5 line-clamp-1 text-[10px] text-white/35">{p.vendor}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-1">
                    <span className={`text-[12px] font-bold ${p.inStock === false ? "text-white/35" : "text-[#E5484D]"}`}>
                      {priceOf(p)}
                    </span>
                    {p.inStock === false && <OutOfStockTag />}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {visible.length === 0 && (
        <p className="mt-16 text-center text-[13px] text-white/35">
          Nothing in this category yet.
        </p>
      )}

      <AppSearchSheet
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        products={all}
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
