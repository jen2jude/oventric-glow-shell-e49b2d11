import { useSellerView } from "@/lib/seller-views";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { ShoppingBag, Star, Store, X } from "lucide-react";

import { getProduct, type ProductDTO } from "@/lib/marketplace.functions";
import { visibleProductPrice } from "@/lib/money-visibility";
import type { Currency } from "@/lib/onboarding/OnboardingContext";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { haptic } from "@/lib/haptics";
import { AppSheet } from "./AppSheet";
import { OutOfStockTag } from "@/components/oventric/StockBadge";

/**
 * Product quick-view bottom sheet for the app shell. Tapping a product card
 * slides this up over the current screen instead of navigating away — the
 * full product page is one tap deeper ("Full details").
 */
export function ProductQuickView({
  productId,
  currency,
  onClose,
}: {
  productId: string | null;
  currency: Currency;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const { balancesHidden } = useOnboarding();
  const fetchProduct = useServerFn(getProduct);

  const { data: p, isLoading } = useQuery({
    queryKey: ["app-product-quickview", productId],
    queryFn: () => fetchProduct({ data: { id: productId! } }),
    enabled: !!productId,
    staleTime: 60_000,
  });
  useSellerView("product_view", p?.sellerId, p?.id);

  const price = (prod: ProductDTO) =>
    visibleProductPrice(
      {
        price_usd: prod.priceUSD,
        original_currency: prod.originalCurrency,
        original_amount: prod.originalAmount,
        fx_snapshot: prod.fxSnapshot,
      },
      currency,
      balancesHidden,
    );

  const go = (to: "/product/$id" | "/checkout/$id") => {
    if (!p) return;
    haptic("select");
    onClose();
    navigate({ to, params: { id: p.id } });
  };

  return (
    <AppSheet open={!!productId} onClose={onClose}>
      {isLoading || !p ? (
        <div className="animate-pulse p-5">
          <div className="aspect-[16/10] w-full rounded-2xl bg-white/[0.06]" />
          <div className="mt-4 h-4 w-2/3 rounded bg-white/[0.06]" />
          <div className="mt-2 h-3 w-1/3 rounded bg-white/[0.06]" />
          <div className="mt-6 h-11 w-full rounded-xl bg-white/[0.06]" />
        </div>
      ) : (
        <div className="px-5 pb-8 pt-2">
          {/* Cover */}
          <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.04]">
            {p.coverUrl ? (
              <img src={p.coverUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-white/25">
                No cover
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="nav-tap absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 backdrop-blur"
            >
              <X className="h-4 w-4 text-white/90" />
            </button>
          </div>

          {/* Title + seller */}
          <h2 className="mt-4 text-[17px] font-bold leading-snug tracking-tight">
            {p.name}
          </h2>
          <div className="mt-1.5 flex items-center gap-3 text-[12px] text-white/50">
            <span className="flex items-center gap-1">
              <Store className="h-3.5 w-3.5" /> {p.vendor}
            </span>
            {p.reviews > 0 && (
              <span className="flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-[#E5484D] text-[#E5484D]" />
                {p.rating.toFixed(1)} · {p.reviews}
              </span>
            )}
          </div>

          {/* Price */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className={`text-[22px] font-extrabold tracking-tight ${p.inStock === false ? "text-white/35" : "text-[#E5484D]"}`}>
              {price(p)}
            </span>
            {p.inStock === false && <OutOfStockTag />}
          </div>

          {/* Description */}
          {p.description && (
            <p className="mt-3 line-clamp-4 text-[13px] leading-relaxed text-white/60">
              {p.description}
            </p>
          )}

          {/* Actions */}
          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={() => go("/checkout/$id")}
              disabled={p.inStock === false}
              className={`nav-tap flex flex-1 items-center justify-center gap-1.5 rounded-xl py-3 text-[14px] font-bold text-white shadow-[0_8px_24px_-8px_rgba(229,72,77,0.6)] ${
                p.inStock === false ? "bg-white/10 text-white/35 shadow-none" : "bg-[#E5484D]"
              }`}
            >
              <ShoppingBag className="h-4 w-4" /> {p.inStock === false ? "Out of stock" : "Buy now"}
            </button>
            <button
              type="button"
              onClick={() => go("/product/$id")}
              className="nav-tap flex-1 rounded-xl border border-white/10 bg-white/[0.06] py-3 text-[14px] font-bold text-white"
            >
              Full details
            </button>
          </div>
        </div>
      )}
    </AppSheet>
  );
}
