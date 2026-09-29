import { Link } from "@tanstack/react-router";
import { Star } from "lucide-react";

import { CashbackBadge } from "@/components/oventric/CashbackBadge";
import { OutOfStockTag } from "@/components/oventric/StockBadge";
import { computeDisplayPrice } from "@/lib/fx-display";
import type { ProductDTO } from "@/lib/marketplace.functions";

export function AppProductCard({ product, currency }: { product: ProductDTO; currency: string }) {
  const price = computeDisplayPrice(
    {
      price_usd: product.priceUSD,
      original_currency: product.originalCurrency,
      original_amount: product.originalAmount,
      fx_snapshot: product.fxSnapshot,
    },
    currency,
  ).formatted;

  return (
    <div className="group flex flex-col overflow-hidden rounded-[10px] border border-white/[0.06] bg-white/[0.03] active:scale-[0.99]">
      <Link
        to="/product/$id"
        params={{ id: product.slug || product.id }}
        className="relative block aspect-[4/3] w-full overflow-hidden bg-white/[0.05]"
      >
        {product.coverUrl ? (
          <img
            src={product.coverUrl}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : null}
        <CashbackBadge percentage={product.cashbackPct} className="absolute left-2 top-2" />
      </Link>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <Link to="/product/$id" params={{ id: product.slug || product.id }} className="min-w-0">
          <h3 className="line-clamp-2 text-[13px] font-bold leading-snug text-white">
            {product.name}
          </h3>
        </Link>
        <p className="truncate text-[11px] text-white/45">{product.vendor}</p>
        <p className="inline-flex items-center gap-1 text-[11px] font-semibold text-white/55">
          <Star className="h-3 w-3 fill-[#F2C14E] text-[#F2C14E]" />
          {product.rating ? product.rating.toFixed(1) : "New"}
          {product.reviews ? <span className="font-normal text-white/35">({product.reviews})</span> : null}
        </p>
        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
          <span className={`text-sm font-extrabold ${product.inStock === false ? "text-white/35" : "text-white"}`}>
            {price}
          </span>
          {product.inStock === false && <OutOfStockTag />}
        </div>
      </div>
    </div>
  );
}