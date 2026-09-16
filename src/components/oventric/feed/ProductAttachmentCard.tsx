import { Link } from "@tanstack/react-router";
import { ShoppingBag, Star, CheckCircle2 } from "lucide-react";
import type { ProductAttachment } from "@/lib/posts.functions";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { computeDisplayPrice } from "@/lib/fx-display";

export function ProductAttachmentCard({ 
  product, 
  isAppShell 
}: { 
  product: ProductAttachment; 
  isAppShell?: boolean 
}) {
  const { baseCurrency } = useOnboarding();
  if (product.available === false) {
    return (
      <div className={`mt-3 ${isAppShell ? "mx-4 md:mx-0" : ""}`}>
        <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/[0.04]">
            <ShoppingBag className="h-5 w-5 text-white/20" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white/70">This product is no longer available</p>
            <p className="text-[11px] text-white/40">The seller removed or unpublished this listing.</p>
          </div>
        </div>
      </div>
    );
  }
  // Use the product's publish-time currency + FX snapshot so the feed price is
  // identical to the marketplace and product page.
  const priceLabel = computeDisplayPrice(
    {
      price_usd: product.priceUsd,
      original_currency: (product.originalCurrency ?? "USD") as any,
      original_amount: product.originalAmount ?? product.priceUsd,
      fx_snapshot: product.fxSnapshot ?? null,
    },
    baseCurrency,
  ).formatted;
  return (
    <div className={`mt-3 ${isAppShell ? 'mx-4 md:mx-0' : ''}`}>
      <Link
        to="/product/$id"
        params={{ id: product.id }}
        className="flex items-stretch bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-2xl overflow-hidden transition-colors group"
      >
        <div className="w-28 sm:w-32 shrink-0 bg-neutral-900 overflow-hidden">
          {product.coverUrl ? (
            <img loading="lazy" decoding="async" 
              src={product.coverUrl} 
              alt={product.name} 
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ShoppingBag className="w-8 h-8 text-white/10" />
            </div>
          )}
        </div>
        
        <div className="flex-1 min-w-0 p-3 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-sm font-bold text-white line-clamp-1">{product.name}</h4>
              <div className="attach-accent text-sm font-black text-[#E5484D] shrink-0">
                {priceLabel}
              </div>
            </div>
            
            {product.shortDescription && (
              <p className="text-[11px] text-white/50 line-clamp-1 mt-0.5">
                {product.shortDescription}
              </p>
            )}

            {!!product.cashbackPct && product.cashbackPct > 0 && (
              <span className="mt-1.5 inline-block rounded-[10px] border border-emerald-400/25 bg-emerald-400/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                {product.cashbackPct}% cashback
              </span>
            )}

            <div className="mt-2 flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-full overflow-hidden bg-white/10 shrink-0">
                {product.vendorAvatarUrl && (
                  <img loading="lazy" decoding="async" src={product.vendorAvatarUrl} alt="" className="w-full h-full object-cover" />
                )}
              </div>
              <span className="text-[10px] text-white/70 font-medium truncate">
                {product.vendor}
              </span>
              <CheckCircle2 className="w-3 h-3 text-sky-400 shrink-0" />
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
              ))}
              <span className="text-[9px] text-white/40 ml-1">(12)</span>
            </div>
            <div className="attach-accent text-[10px] font-bold text-[#E5484D] uppercase tracking-wider group-hover:translate-x-1 transition-transform">
              View Product →
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}
