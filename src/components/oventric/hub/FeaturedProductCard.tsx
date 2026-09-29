import { Link } from "@tanstack/react-router";
import { Star, ShoppingCart } from "lucide-react";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { visibleProductPrice } from "@/lib/money-visibility";
import type { ProductDTO } from "@/lib/marketplace.functions";
import { CashbackBadge } from "@/components/oventric/CashbackBadge";
import { OutOfStockTag } from "@/components/oventric/StockBadge";

export function FeaturedProductCard({ product }: { product: ProductDTO }) {
  const { baseCurrency, balancesHidden } = useOnboarding();
  const price = visibleProductPrice(
    {
      price_usd: product.priceUSD,
      original_currency: product.originalCurrency,
      original_amount: product.originalAmount,
      fx_snapshot: product.fxSnapshot,
    },
    baseCurrency,
    balancesHidden,
  );

  const rating = Number(product.rating ?? 0);
  const isDigital = product.kind === "digital";
  const badgeText = isDigital ? "Digital" : "Featured";
  const badgeTint = isDigital ? "#22C55E" : "#8B5CF6";

  return (
    <div className="group relative flex w-full flex-col overflow-hidden rounded-[10px] border border-slate-200 bg-white shadow-[0_10px_30px_-26px_rgba(15,23,42,0.5)] transition-all hover:border-slate-300 active:scale-[0.98]">
      <Link
        to="/product/$id"
        params={{ id: product.id }}
        className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100"
      >
        {product.coverUrl ? (
          <img
            src={product.coverUrl}
            alt={product.name}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : null}
        <span
          className="absolute left-1.5 top-1.5 z-10 rounded-full px-1.5 py-[2px] text-[7.5px] font-bold text-white"
          style={{ backgroundColor: badgeTint }}
        >
          {badgeText}
        </span>
        <CashbackBadge percentage={product.cashbackPct} className="absolute bottom-1.5 left-1.5 z-10" />
      </Link>

      <div className="space-y-1.5 p-2">
        <div className="space-y-0.5">
          <Link to="/product/$id" params={{ id: product.id }}>
            <h3 className="line-clamp-1 text-[11px] font-bold text-slate-900 transition-colors hover:text-violet-600">
              {product.name}
            </h3>
          </Link>
          {product.description ? (
            <p className="line-clamp-1 text-[9px] font-medium text-slate-500">{product.description}</p>
          ) : null}
        </div>

        <div className="flex items-end justify-between gap-1">
          <div className="min-w-0 space-y-0.5">
            <div className="flex flex-wrap items-center gap-1">
              <span className={`truncate text-[11.5px] font-bold tracking-tight ${product.inStock === false ? "text-slate-400" : "text-slate-900"}`}>
                {price}
              </span>
              {product.inStock === false && <OutOfStockTag light />}
            </div>
            {rating > 0 ? (
              <div className="flex items-center gap-1 text-[9px] font-semibold text-amber-500">
                <Star className="h-2 w-2 fill-current" />
                <span>{rating.toFixed(1)}</span>
              </div>
            ) : null}
          </div>

          <button
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px] border border-slate-200 bg-slate-50 text-slate-500 transition-all hover:border-violet-500 hover:bg-violet-500 hover:text-white active:scale-90"
            aria-label="Add to cart"
          >
            <ShoppingCart className="h-[12px] w-[12px]" />
          </button>
        </div>
      </div>
    </div>
  );
}
