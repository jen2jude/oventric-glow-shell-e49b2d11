import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  BadgeCheck,
  MapPin,
  MessageCircle,
  ShoppingBag,
  Star,
  Store,
} from "lucide-react";
import { getShopBranding } from "@/lib/shop.functions";
import { listProducts, type ProductDTO } from "@/lib/marketplace.functions";
import { haptic } from "@/lib/haptics";
import { useOnboarding, type Currency } from "@/lib/onboarding/OnboardingContext";
import { ProductQuickView } from "./ProductQuickView";

export function AppShop({ idOrSlug }: { idOrSlug: string }) {
  const navigate = useNavigate();
  const [quickViewId, setQuickViewId] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const { baseCurrency } = useOnboarding();
  const currency = (baseCurrency ?? "USD") as Currency;

  const fetchShop = useServerFn(getShopBranding);
  const fetchProducts = useServerFn(listProducts);

  const { data: shopData, isLoading } = useQuery({
    queryKey: ["app-shop", idOrSlug],
    queryFn: () => fetchShop({ data: { idOrSlug } }),
    staleTime: 60_000,
  });
  const shop = shopData?.shop ?? null;

  const { data: productsData } = useQuery({
    queryKey: ["app-shop-products"],
    queryFn: () => fetchProducts(),
    staleTime: 60_000,
  });

  const products = useMemo(
    () =>
      (productsData ?? []).filter(
        (p: ProductDTO) => p.sellerId === shop?.userId && p.status === "active",
      ),
    [productsData, shop],
  );

  const categories = useMemo(() => {
    const set = new Map<string, number>();
    for (const p of products) {
      const c = p.category || "Other";
      set.set(c, (set.get(c) ?? 0) + 1);
    }
    return Array.from(set.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([c]) => c);
  }, [products]);

  const visible = useMemo(
    () => (category ? products.filter((p) => (p.category || "Other") === category) : products),
    [products, category],
  );

  if (isLoading) {
    return (
      <div className="min-h-dvh bg-[#0A0A0B] pb-32">
        <div className="h-32 bg-white/[0.04] animate-pulse" />
        <div className="px-4 pt-12 space-y-3">
          <div className="h-5 w-44 rounded bg-white/[0.06] animate-pulse" />
          <div className="h-3 w-60 rounded bg-white/[0.04] animate-pulse" />
        </div>
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="min-h-dvh bg-[#0A0A0B] pb-32 flex flex-col items-center justify-center gap-3 px-8 text-center">
        <Store className="h-8 w-8 text-white/20" />
        <p className="text-white/80 text-sm font-semibold">Shop not found</p>
        <button
          onClick={() => navigate({ to: "/" })}
          className="mt-2 rounded-full bg-[#E5484D] px-5 py-2 text-xs font-semibold text-white"
        >
          Back home
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#0A0A0B] pb-32">
      {/* Cover */}
      <div className="relative h-32 overflow-hidden">
        {shop.coverUrl ? (
          <img src={shop.coverUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-[#E5484D]/40 via-[#17171B] to-[#0A0A0B]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0B] to-transparent" />
        <button
          onClick={() => window.history.back()}
          aria-label="Back"
          className="absolute left-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-black/50 backdrop-blur"
        >
          <ArrowLeft className="h-4.5 w-4.5 text-white" />
        </button>
      </div>

      {/* Identity */}
      <div className="px-4">
        <div className="-mt-10 flex items-end justify-between">
          <div className="h-20 w-20 rounded-2xl border-4 border-[#0A0A0B] bg-[#17171B] overflow-hidden">
            {shop.logoUrl ? (
              <img src={shop.logoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center bg-[#E5484D]">
                <Store className="h-8 w-8 text-white" />
              </div>
            )}
          </div>
          <button
            onClick={() => navigate({ to: "/messages" })}
            className="mb-1 flex items-center gap-1.5 rounded-full bg-[#E5484D] px-4 py-2 text-xs font-semibold text-white"
          >
            <MessageCircle className="h-3.5 w-3.5" /> Message
          </button>
        </div>

        <div className="mt-3 flex items-center gap-1.5">
          <h1 className="text-lg font-bold text-white">{shop.shopName}</h1>
          {shop.verified && <BadgeCheck className="h-4.5 w-4.5 text-[#E5484D]" />}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/40">
          {shop.country && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {shop.country}
            </span>
          )}
          <span className="flex items-center gap-1">
            <ShoppingBag className="h-3 w-3" /> {products.length} products
          </span>
        </div>
        {shop.shopAbout && (
          <p className="mt-2 text-[13px] leading-relaxed text-white/70 line-clamp-3">
            {shop.shopAbout}
          </p>
        )}

        <button
          onClick={() => navigate({ to: "/profile/$id", params: { id: shop.slug } })}
          className="mt-3 text-[11px] font-semibold text-[#E5484D]"
        >
          View creator profile →
        </button>
      </div>

      {/* Category chips */}
      {categories.length > 1 && (
        <div className="mt-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          <button
            onClick={() => setCategory(null)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-[11px] font-semibold ${
              !category
                ? "bg-[#E5484D] text-white"
                : "border border-white/10 bg-white/[0.04] text-white/60"
            }`}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => {
                haptic("select");
                setCategory(category === c ? null : c);
              }}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-[11px] font-semibold ${
                category === c
                  ? "bg-[#E5484D] text-white"
                  : "border border-white/10 bg-white/[0.04] text-white/60"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {/* Products */}
      {visible.length === 0 ? (
        <p className="px-8 py-14 text-center text-xs text-white/35">
          No products in this section yet.
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2.5 px-3">
          {visible.map((p: ProductDTO) => (
            <button
              key={p.id}
              onClick={() => {
                haptic("select");
                setQuickViewId(p.id);
              }}
              className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.03] text-left"
            >
              <div className="relative aspect-square bg-white/[0.04]">
                {p.coverUrl ? (
                  <img src={p.coverUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full w-full place-items-center">
                    <ShoppingBag className="h-6 w-6 text-white/20" />
                  </div>
                )}
                {p.cashbackPct > 0 && (
                  <span className="absolute left-2 top-2 rounded-full bg-[#E5484D] px-2 py-0.5 text-[9px] font-bold text-white">
                    +{p.cashbackPct}% back
                  </span>
                )}
              </div>
              <div className="p-2.5">
                <p className="text-[12px] font-semibold text-white line-clamp-1">{p.name}</p>
                <div className="mt-0.5 flex items-center justify-between">
                  <p className="text-[12px] font-bold text-[#E5484D]">
                    {p.priceUSD <= 0 ? (
                      <span className="text-emerald-400">Free</span>
                    ) : (
                      `$${p.priceUSD.toFixed(2)}`
                    )}
                  </p>
                  {p.rating > 0 && (
                    <span className="flex items-center gap-0.5 text-[10px] text-white/40">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      {p.rating.toFixed(1)}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <ProductQuickView
        productId={quickViewId}
        currency={currency}
        onClose={() => setQuickViewId(null)}
      />
    </div>
  );
}
