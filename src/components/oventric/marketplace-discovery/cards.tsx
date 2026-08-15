import { Star, ShoppingCart, BadgeCheck } from "lucide-react";
import type { ProductDTO } from "@/lib/marketplace.functions";
import { computeDisplayPrice } from "@/lib/fx-display";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";

export function usePrice() {
  const { baseCurrency } = useOnboarding();
  return (p: ProductDTO) =>
    computeDisplayPrice(
      {
        price_usd: p.priceUSD,
        original_currency: p.originalCurrency,
        original_amount: p.originalAmount,
        fx_snapshot: p.fxSnapshot,
      },
      baseCurrency,
    ).formatted;
}

function Cover({ src, alt, className }: { src: string | null; alt: string; className?: string }) {
  if (!src) {
    return <div className={`bg-gradient-to-br from-[#1d1d22] to-[#101014] ${className ?? ""}`} />;
  }
  return <img loading="lazy" decoding="async" src={src} alt={alt} className={`object-cover ${className ?? ""}`} />;
}

/** Small tile used in horizontal rails ("What's Moving", "New on Oventric"). */
export function TileCard({ product, onClick }: { product: ProductDTO; onClick: () => void }) {
  const price = usePrice();
  return (
    <button type="button" onClick={onClick} className="w-[142px] shrink-0 text-left">
      <div className="aspect-square w-full overflow-hidden rounded-[10px] bg-[#161618] ring-1 ring-white/[0.04]">
        <Cover src={product.coverUrl} alt={product.name} className="h-full w-full" />
      </div>
      <p className="mt-2.5 line-clamp-1 text-[13.5px] font-bold tracking-tight text-white">
        {product.name}
      </p>
      <div className="mt-1 flex items-center justify-between gap-1.5">
        <span className="truncate text-[13.5px] font-black text-[#E5484D]">{price(product)}</span>
        <span className="flex shrink-0 items-center gap-0.5 text-[11px] font-bold text-white/40">
          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
          {product.rating > 0 ? product.rating.toFixed(1) : "5.0"}
        </span>
      </div>
    </button>
  );
}

/** Full-width list row used in "Trending Products". */
export function RowCard({ product, onClick }: { product: ProductDTO; onClick: () => void }) {
  const price = usePrice();
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3.5 rounded-[10px] bg-[#131316] p-3 text-left ring-1 ring-white/[0.04]"
    >
      <div className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-[10px] bg-[#1A1A1E]">
        <Cover src={product.coverUrl} alt={product.name} className="h-full w-full" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 text-[14.5px] font-bold text-white">{product.name}</p>
        <span className="block truncate text-[12px] font-medium text-white/40">
          by {product.vendor}
        </span>

        <div className="mt-1.5 flex items-center gap-2">
          <span className="truncate text-[14px] font-black text-[#E5484D]">{price(product)}</span>
          <span className="ml-auto flex shrink-0 items-center gap-0.5 text-[11.5px] font-bold text-white/40">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            {product.rating > 0 ? product.rating.toFixed(1) : "5.0"}
          </span>
        </div>
      </div>
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[10px] bg-white/[0.03]">
        <ShoppingCart className="h-4.5 w-4.5 text-white/40" />
      </span>
    </button>
  );
}

/** 2-up grid card used for category grids and recommendations. */
export function GridCard({ product, onClick }: { product: ProductDTO; onClick: () => void }) {
  const price = usePrice();
  return (
    <button type="button" onClick={onClick} className="w-full text-left">
      <div className="aspect-square w-full overflow-hidden rounded-[10px] bg-[#161618] ring-1 ring-white/[0.05]">
        <Cover src={product.coverUrl} alt={product.name} className="h-full w-full" />
      </div>
      <p className="mt-3 line-clamp-1 text-[14.5px] font-bold tracking-tight text-white">
        {product.name}
      </p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="truncate text-[14px] font-black text-[#E5484D]">{price(product)}</span>
        <span className="flex shrink-0 items-center gap-0.5 text-[11.5px] font-bold text-white/40">
          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
          {product.rating > 0 ? product.rating.toFixed(1) : "5.0"}
        </span>
      </div>
    </button>
  );
}

export interface SellerLite {
  id: string;
  name: string;
  slug: string;
  bio?: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  verified: boolean;
  rating: number;
  followersCount: number;
  productsCount: number;
}

const compact = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K` : String(n);

/** Wide shop banner card used in "Featured Shops" / "Recommended Shops". */
export function ShopCard({ seller, onClick }: { seller: SellerLite; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex w-full flex-col overflow-hidden rounded-[10px] border border-white/[0.04] bg-[#131316] p-4 text-left transition-transform active:scale-[0.98]"
    >
      <div className="relative mb-4 h-[120px] w-full overflow-hidden rounded-[10px] bg-[#1A1A1E]">
        {seller.coverUrl && (
          <img loading="lazy" decoding="async" src={seller.coverUrl} alt="" className="h-full w-full object-cover opacity-60" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-3 left-3 flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border-2 border-[#131316] bg-black shadow-xl">
          {seller.avatarUrl ? (
            <img loading="lazy" decoding="async" src={seller.avatarUrl} alt={seller.name} className="h-full w-full object-cover" />
          ) : (
            <span className="text-[14px] font-black text-white">{seller.name.slice(0, 2).toUpperCase()}</span>
          )}
        </div>
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-[16px] font-black tracking-tight text-white">{seller.name}</p>
          {seller.verified && <BadgeCheck className="h-4 w-4 shrink-0 fill-[#E5484D] text-black" />}
        </div>
        <p className="mt-1 flex items-center gap-2 text-[12px] font-medium text-white/40">
          <span>{seller.productsCount} items</span>
          <span className="h-1 w-1 rounded-full bg-white/20" />
          <span>{compact(seller.followersCount)} followers</span>
        </p>
      </div>
    </button>
  );
}

/** Section title + "See all". */
export function Rail({
  title,
  onSeeAll,
  children,
}: {
  title: string;
  onSeeAll?: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between px-4">
        <h2 className="text-[19px] font-bold tracking-tight text-white">{title}</h2>
        {onSeeAll && (
          <button type="button" onClick={onSeeAll} className="text-[13px] font-semibold text-[#E5484D]">
            See all
          </button>
        )}
      </div>
      {children}
    </section>
  );
}
