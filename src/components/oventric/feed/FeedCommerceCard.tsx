import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ShoppingBag } from "lucide-react";
import { useOnboarding, type Currency } from "@/lib/onboarding/OnboardingContext";
import { visibleProductPrice } from "@/lib/money-visibility";
import type { DiscoveryProduct } from "@/lib/discovery.functions";

function productPrice(product: DiscoveryProduct, viewer: Currency, hidden: boolean): string {
  return visibleProductPrice(
    {
      price_usd: product.priceUsd,
      original_currency: product.originalCurrency,
      original_amount: product.originalAmount,
      fx_snapshot: product.fxSnapshot,
    },
    viewer,
    hidden,
  );
}

export function ShopTheFeedRail({
  products,
  appShell = true,
}: {
  products: DiscoveryProduct[];
  appShell?: boolean;
}) {
  const { baseCurrency, balancesHidden } = useOnboarding();
  const [pages, setPages] = useState(1);
  const pool = products.slice(0, 30);

  const visibleProducts = useMemo(() => {
    if (pool.length === 0) return [];
    const total = Math.min(pool.length * pages, pool.length * 8);
    return Array.from({ length: total }, (_, index) => ({
      product: pool[index % pool.length],
      repeat: Math.floor(index / pool.length),
    }));
  }, [pool, pages]);

  if (pool.length === 0) return null;

  return (
    <section
      aria-label="Shop the feed"
      className={
        appShell
          ? "overflow-hidden border-y border-white/[0.06] bg-[#101112] py-4 md:rounded-[10px] md:border"
          : "overflow-hidden rounded-[10px] border border-slate-200 bg-white py-4 shadow-sm"
      }
    >
      <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-amber-400/15 text-amber-300 ring-1 ring-amber-300/20">
            <ShoppingBag className="h-4 w-4" strokeWidth={2.4} />
          </span>
          <span className="min-w-0">
            <h2 className={appShell ? "truncate text-sm font-black text-white" : "truncate text-sm font-black text-slate-950"}>
              Shop the feed
            </h2>
            <p className={appShell ? "truncate text-[11px] text-white/40" : "truncate text-[11px] text-slate-500"}>
              Products from our marketplace
            </p>
          </span>
        </div>
        <span className={appShell ? "text-[11px] font-semibold text-white/35" : "text-[11px] font-semibold text-slate-500"}>
          Scroll
        </span>
      </div>

      <div
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onScroll={(event) => {
          const el = event.currentTarget;
          if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 260) {
            setPages((current) => Math.min(current + 1, 8));
          }
        }}
      >
        {visibleProducts.map(({ product, repeat }, index) => (
          <Link
            key={`${product.id}-${repeat}-${index}`}
            to="/product/$id"
            params={{ id: product.id }}
            className={
              appShell
                ? "w-[150px] shrink-0 snap-start overflow-hidden rounded-[10px] border border-white/[0.07] bg-[#18191B] active:scale-[0.98]"
                : "w-[150px] shrink-0 snap-start overflow-hidden rounded-[10px] border border-slate-200 bg-slate-50 active:scale-[0.98]"
            }
          >
            <div className="relative h-28 w-full overflow-hidden bg-slate-900">
              {product.coverUrl ? (
                <img loading="lazy" decoding="async" src={product.coverUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className={`h-full w-full bg-gradient-to-br ${product.hue}`} />
              )}
              <span style={{ color: "#ffffff" }} className="absolute left-2 top-2 max-w-[calc(100%-16px)] truncate rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur">
                {product.category}
              </span>
            </div>
            <div className="p-2.5">
              <p className={appShell ? "line-clamp-2 text-[12.5px] font-bold leading-snug text-white" : "line-clamp-2 text-[12.5px] font-bold leading-snug text-slate-950"}>
                {product.title}
              </p>
              <p className={appShell ? "mt-1 truncate text-[10.5px] text-white/45" : "mt-1 truncate text-[10.5px] text-slate-500"}>
                {product.vendor}
              </p>
              <p className="mt-1 text-[12px] font-black text-[#E5484D]">
                {productPrice(product, baseCurrency, balancesHidden)}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}