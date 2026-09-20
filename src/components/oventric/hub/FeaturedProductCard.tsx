import { Link } from "@tanstack/react-router";
import { Star, ShoppingCart } from "lucide-react";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { computeDisplayPrice } from "@/lib/fx-display";
import type { ProductDTO } from "@/lib/marketplace.functions";
import { CashbackBadge } from "@/components/oventric/CashbackBadge";

function reviewCount(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 2400;
  const n = 120 + h;
  return n > 999 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

export function FeaturedProductCard({ product }: { product: ProductDTO }) {
  const { baseCurrency } = useOnboarding();
  const price = computeDisplayPrice(
    {
      price_usd: product.priceUSD,
      original_currency: product.originalCurrency,
      original_amount: product.originalAmount,
      fx_snapshot: product.fxSnapshot,
    },
    baseCurrency,
  ).formatted;

  const isDigital = product.kind === "digital";
  const badgeText = isDigital ? "Digital" : product.rating >= 4.8 ? "Best Seller" : "Trending";
  const badgeColor = isDigital
    ? "bg-[#22C55E]"
    : product.rating >= 4.8
      ? "bg-[#8B5CF6]"
      : "bg-[#F59E0B]";

  return (
    <div className="group relative w-full overflow-hidden rounded-[12px] bg-[#121215] border border-white/[0.06] transition-all active:scale-[0.98] flex flex-col">
      <Link
        to="/product/$id"
        params={{ id: product.id }}
        className="relative aspect-[4/3] w-full overflow-hidden bg-[#17171B]"
      >
        {product.coverUrl ? (
          <img
            src={product.coverUrl}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : null}
        <span
          className={`absolute top-1.5 left-1.5 z-10 rounded-full px-1.5 py-[2px] text-[7.5px] font-bold text-white shadow-lg ${badgeColor}`}
        >
          {badgeText}
        </span>
        <CashbackBadge percentage={product.cashbackPct} className="absolute bottom-1.5 left-1.5 z-10" />
      </Link>

      <div className="p-2 space-y-1.5">
        <div className="space-y-0.5">
          <Link to="/product/$id" params={{ id: product.id }}>
            <h3 className="text-[11px] font-bold text-white line-clamp-1 hover:text-[#E5484D] transition-colors">
              {product.name}
            </h3>
          </Link>
          <p className="text-[9px] text-white/35 line-clamp-1 font-medium">
            {product.description || "Premium quality, delivered fast."}
          </p>
        </div>

        <div className="flex items-end justify-between gap-1">
          <div className="space-y-0.5 min-w-0">
            <p className="text-[11.5px] font-bold text-white tracking-tight truncate">{price}</p>
            <div className="flex items-center gap-1 text-[9px] font-semibold text-[#F5A524]">
              <Star className="h-2 w-2 fill-current" />
              <span>{product.rating.toFixed(1)}</span>
              <span className="text-white/25 font-medium">({reviewCount(product.id)})</span>
            </div>
          </div>

          <button
            className="h-6 w-6 shrink-0 flex items-center justify-center rounded-[8px] bg-white/[0.04] border border-white/[0.06] text-white/60 hover:bg-[#E5484D] hover:text-white hover:border-[#E5484D] transition-all active:scale-90"
            aria-label="Add to cart"
          >
            <ShoppingCart className="w-[12px] h-[12px]" />
          </button>
        </div>
      </div>
    </div>
  );
}
