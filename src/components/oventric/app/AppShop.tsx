import { useSellerView } from "@/lib/seller-views";
import { useMemo, useState, type ReactNode } from "react";
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
import { getShopBranding, getShopDiscovery } from "@/lib/shop.functions";
import { getLiveProfileTab, getProfileSocialCounts } from "@/lib/profiles.functions";
import type { ProfileListing } from "@/lib/profiles/mockProfiles";
import { visibleProductPrice } from "@/lib/money-visibility";
import { OutOfStockTag } from "@/components/oventric/StockBadge";
import { haptic } from "@/lib/haptics";
import { useOnboarding, type Currency } from "@/lib/onboarding/OnboardingContext";
import { ProductQuickView } from "./ProductQuickView";

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

type Tab = "shop" | "services" | "about";

export function AppShop({ idOrSlug }: { idOrSlug: string }) {
  const navigate = useNavigate();
  const [quickViewId, setQuickViewId] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("shop");
  const { homeCurrency, balancesHidden } = useOnboarding();
  const currency = (homeCurrency ?? "USD") as Currency;

  const fetchShop = useServerFn(getShopBranding);
  const fetchCounts = useServerFn(getProfileSocialCounts);
  const fetchTab = useServerFn(getLiveProfileTab);
  const fetchDiscovery = useServerFn(getShopDiscovery);

  const { data: shopData, isLoading } = useQuery({
    queryKey: ["app-shop", idOrSlug],
    queryFn: () => fetchShop({ data: { idOrSlug } }),
    staleTime: 60_000,
  });
  const shop = shopData?.shop ?? null;
  useSellerView("shop_visit", shop?.userId);

  const { data: counts } = useQuery({
    queryKey: ["app-shop-counts", idOrSlug],
    queryFn: () => fetchCounts({ data: { idOrSlug } }).catch(() => null),
    staleTime: 60_000,
  });
  const { data: mp } = useQuery({
    queryKey: ["app-shop-listings", idOrSlug, "marketplace"],
    queryFn: () =>
      fetchTab({
        data: { idOrSlug, tab: "marketplace", page: 1, pageSize: 48, q: "", sort: "newest" },
      } as never).catch(() => null),
    staleTime: 60_000,
  });
  const { data: sv } = useQuery({
    queryKey: ["app-shop-listings", idOrSlug, "services"],
    queryFn: () =>
      fetchTab({
        data: { idOrSlug, tab: "services", page: 1, pageSize: 24, q: "", sort: "newest" },
      } as never).catch(() => null),
    staleTime: 60_000,
  });

  const products = useMemo(() => ((mp as any)?.items ?? []) as ProfileListing[], [mp]);
  const services = useMemo(() => ((sv as any)?.items ?? []) as ProfileListing[], [sv]);
  const productTotal: number = (mp as any)?.total ?? products.length;
  const firstCat = products[0]?.category;

  const { data: discovery } = useQuery({
    queryKey: ["app-shop-discovery", shop?.userId, firstCat],
    enabled: !!shop?.userId,
    queryFn: () =>
      fetchDiscovery({
        data: { sellerId: shop!.userId, ...(firstCat ? { category: firstCat } : {}) },
      }).catch(() => null),
    staleTime: 60_000,
  });

  const price = (usd: number, l?: Partial<ProfileListing>) =>
    usd <= 0
      ? "Free"
       : visibleProductPrice(
          {
            price_usd: usd,
            original_currency: (l?.originalCurrency ?? "USD") as never,
            original_amount: l?.originalAmount ?? usd,
            fx_snapshot: (l?.fxSnapshot ?? null) as never,
          },
           currency,
           balancesHidden,
         );

  const sales = useMemo(() => products.reduce((a, p) => a + (p.sales ?? 0), 0), [products]);
  const rating = useMemo(() => {
    const r = products.filter((p) => (p.rating ?? 0) > 0);
    return r.length ? (r.reduce((a, p) => a + (p.rating ?? 0), 0) / r.length).toFixed(1) : "—";
  }, [products]);

  const selectedId =
    typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("productId") : null;
  const selected = selectedId ? products.find((p) => p.id === selectedId) ?? null : null;

  const featured = useMemo(() => {
    const promoted = products.filter((p) => p.promoted);
    const rest = products.filter((p) => !p.promoted).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    return [...promoted, ...rest].slice(0, 6);
  }, [products]);
  const bestSellers = useMemo(
    () => [...products].sort((a, b) => (b.sales ?? 0) - (a.sales ?? 0)).slice(0, 10),
    [products],
  );
  const popular = bestSellers.slice(0, 4);
  const arrivals = products.slice(0, 10);
  const topRated = useMemo(
    () => [...products].filter((p) => (p.rating ?? 0) > 0).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).slice(0, 10),
    [products],
  );

  const categories = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of products) m.set(p.category || "Other", (m.get(p.category || "Other") ?? 0) + 1);
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).map(([c]) => c);
  }, [products]);
  const visible = category ? products.filter((p) => (p.category || "Other") === category) : products;

  const open = (id: string) => {
    haptic("select");
    setQuickViewId(id);
  };

  if (isLoading) {
    return (
      <div className="h-dvh overflow-y-auto overscroll-contain bg-[#0A0A0B] pb-32 [scrollbar-width:none] [-webkit-overflow-scrolling:touch]">
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
      <div className="flex h-dvh flex-col items-center justify-center gap-3 overflow-y-auto overscroll-contain bg-[#0A0A0B] px-8 pb-32 text-center [scrollbar-width:none] [-webkit-overflow-scrolling:touch]">
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
    <div className="h-dvh overflow-y-auto overscroll-contain bg-[#0A0A0B] pb-[calc(8rem+env(safe-area-inset-bottom))] [scrollbar-width:none] [-webkit-overflow-scrolling:touch]">
      {/* Cover */}
      <div className="relative h-28 overflow-hidden">
        {shop.coverUrl ? (
          <img src={shop.coverUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-[#E5484D]/40 via-[#17171B] to-[#0A0A0B]" />
        )}
        <button
          onClick={() => window.history.back()}
          aria-label="Back"
          className="absolute left-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-black/50 backdrop-blur"
        >
          <ArrowLeft className="h-4.5 w-4.5 text-white" />
        </button>
      </div>

      {/* Identity */}
      <div className="relative z-10 px-4">
        <div className="-mt-9 flex items-end justify-between">
          <div className="h-20 w-20 shrink-0 rounded-2xl border-4 border-[#0A0A0B] bg-[#17171B] shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
            {shop.logoUrl ? (
              <img src={shop.logoUrl} alt="" className="h-full w-full rounded-2xl object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center rounded-2xl bg-[#E5484D]">
                <Store className="h-8 w-8 text-white" />
              </div>
            )}
          </div>
          <button
            onClick={() => navigate({ to: "/messages" })}
            className="mb-1 flex shrink-0 items-center gap-1.5 rounded-full bg-[#E5484D] px-4 py-2 text-xs font-semibold text-white"
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

      {/* Stats */}
      <div className="mx-4 mt-4 grid grid-cols-4 rounded-2xl border border-white/[0.06] bg-white/[0.03] py-3">
        {[
          { v: compact(counts?.followers ?? 0), l: "Followers" },
          { v: compact(productTotal), l: "Products" },
          { v: compact(sales), l: "Sales" },
          { v: rating, l: "Rating" },
        ].map((st) => (
          <div key={st.l} className="text-center">
            <div className="text-[15px] font-bold text-white">{st.v}</div>
            <div className="text-[9px] font-semibold uppercase tracking-wide text-white/40">{st.l}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="app-scroll-header sticky top-0 z-20 mt-4 flex border-b border-white/[0.06] bg-[#0A0A0B]">
        {(
          [
            ["shop", "Shop"],
            ["services", `Services${services.length ? ` · ${services.length}` : ""}`],
            ["about", "About"],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            onClick={() => {
              haptic("select");
              setTab(k);
            }}
            className={`relative flex-1 py-3 text-[13px] font-semibold ${tab === k ? "text-white" : "text-white/45"}`}
          >
            {l}
            {tab === k && <span className="absolute inset-x-6 bottom-0 h-[3px] rounded-full bg-[#E5484D]" />}
          </button>
        ))}
      </div>

      {tab === "services" ? (
        services.length === 0 ? (
          <Empty text="No services listed yet." />
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-2.5 px-3">
            {services.map((p) => (
              <Card key={p.id} p={p} price={price} onClick={() => navigate({ to: "/product/$id", params: { id: p.id } })} />
            ))}
          </div>
        )
      ) : tab === "about" ? (
        <div className="space-y-4 px-4 py-5">
          <p className="text-[13px] leading-relaxed text-white/70">
            {shop.shopAbout?.trim() || "Branded digital goods and professional services on Oventric."}
          </p>
          {shop.country && (
            <p className="flex items-center gap-2 text-[12px] text-white/50">
              <MapPin className="h-3.5 w-3.5" /> {shop.country}
            </p>
          )}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 text-center">
            <BadgeCheck className="mx-auto h-6 w-6 text-[#E5484D]" />
            <p className="mt-2 text-[13px] font-bold text-white">Seller identity</p>
            <p className="mt-1 text-[11px] text-white/45">
              See their work, links and community activity on their profile.
            </p>
            <button
              onClick={() => navigate({ to: "/profile/$id", params: { id: shop.slug } })}
              className="mt-3 rounded-full bg-[#E5484D] px-4 py-2 text-[11px] font-semibold text-white"
            >
              View profile
            </button>
          </div>
        </div>
      ) : (
        <>
          {selected && (
            <Section title="Selected item">
              <button onClick={() => open(selected.id)} className="mx-4 block w-[calc(100%-2rem)] overflow-hidden rounded-2xl border border-[#E5484D]/30 bg-white/[0.03] text-left">
                <div className="relative aspect-[16/9] bg-white/[0.04]">
                  {selected.coverUrl && <img src={selected.coverUrl} alt="" className="h-full w-full object-cover" />}
                  <span className="absolute left-3 top-3 rounded-full bg-[#E5484D] px-2.5 py-1 text-[9px] font-bold uppercase text-white">From the post</span>
                </div>
                <div className="flex items-start justify-between gap-3 p-3.5">
                  <div className="min-w-0">
                    <p className="text-[14px] font-bold text-white line-clamp-1">{selected.title}</p>
                    <p className="mt-0.5 text-[11px] text-white/45 line-clamp-2">{selected.blurb || selected.category}</p>
                  </div>
                  <p className="flex shrink-0 flex-wrap items-center justify-end gap-1 text-[14px] font-bold">
                    <span className={selected.inStock === false ? "text-white/35" : "text-[#E5484D]"}>
                      {price(selected.priceUsd, selected)}
                    </span>
                    {selected.inStock === false && <OutOfStockTag />}
                  </p>
                </div>
              </button>
            </Section>
          )}

          {featured.length > 0 && (
            <Section title="Featured products">
              <Rail>
                {featured.map((p) => (
                  <button key={p.id} onClick={() => open(p.id)} className="w-[72%] shrink-0 snap-start overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.03] text-left">
                    <div className="aspect-[16/10] bg-white/[0.04]">
                      {p.coverUrl && <img src={p.coverUrl} alt="" className="h-full w-full object-cover" />}
                    </div>
                    <div className="flex items-center justify-between gap-2 p-3">
                      <p className="text-[12px] font-semibold text-white line-clamp-1">{p.title}</p>
                      <p className="flex shrink-0 flex-wrap items-center gap-1 text-[12px] font-bold">
                        <span className={p.inStock === false ? "text-white/35" : "text-[#E5484D]"}>
                          {price(p.priceUsd, p)}
                        </span>
                        {p.inStock === false && <OutOfStockTag />}
                      </p>
                    </div>
                  </button>
                ))}
              </Rail>
            </Section>
          )}

          {popular.some((p) => (p.sales ?? 0) > 0) && (
            <Section title="Popular picks" hint="Most purchased">
              <div className="space-y-2 px-4">
                {popular.map((p, i) => (
                  <button key={p.id} onClick={() => open(p.id)} className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-2 text-left">
                    <span className="w-5 text-center text-[13px] font-bold text-white/35">{i + 1}</span>
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-white/[0.04]">
                      {p.coverUrl && <img src={p.coverUrl} alt="" className="h-full w-full object-cover" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-semibold text-white line-clamp-1">{p.title}</p>
                      {(p.sales ?? 0) > 0 && <p className="text-[10px] text-white/40">{compact(p.sales)} sold</p>}
                    </div>
                    <p className="flex shrink-0 flex-wrap items-center gap-1 text-[12px] font-bold">
                      <span className={p.inStock === false ? "text-white/35" : "text-[#E5484D]"}>
                        {price(p.priceUsd, p)}
                      </span>
                      {p.inStock === false && <OutOfStockTag />}
                    </p>
                  </button>
                ))}
              </div>
            </Section>
          )}

          {arrivals.length > 0 && (
            <Section title="New arrivals">
              <Rail>{arrivals.map((p) => <Mini key={p.id} p={p} price={price} onClick={() => open(p.id)} />)}</Rail>
            </Section>
          )}
          {bestSellers.some((p) => (p.sales ?? 0) > 0) && (
            <Section title="Best sellers">
              <Rail>{bestSellers.map((p) => <Mini key={p.id} p={p} price={price} onClick={() => open(p.id)} />)}</Rail>
            </Section>
          )}
          {topRated.length > 0 && (
            <Section title="Top rated">
              <Rail>{topRated.map((p) => <Mini key={p.id} p={p} price={price} onClick={() => open(p.id)} />)}</Rail>
            </Section>
          )}

          <Section title="All products">
            {categories.length > 1 && (
              <div className="mb-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
                {[null, ...categories].map((c) => (
                  <button
                    key={c ?? "all"}
                    onClick={() => {
                      haptic("select");
                      setCategory(c);
                    }}
                    className={`shrink-0 rounded-full px-3.5 py-1.5 text-[11px] font-semibold ${
                      category === c ? "bg-[#E5484D] text-white" : "border border-white/10 bg-white/[0.04] text-white/60"
                    }`}
                  >
                    {c ?? "All"}
                  </button>
                ))}
              </div>
            )}
            {visible.length === 0 ? (
              <Empty text="No products in this section yet." />
            ) : (
              <div className="grid grid-cols-2 gap-2.5 px-3">
                {visible.map((p) => <Card key={p.id} p={p} price={price} onClick={() => open(p.id)} />)}
              </div>
            )}
          </Section>

          {(discovery?.similarProducts.length ?? 0) > 0 && (
            <Section title="Similar items from other sellers">
              <Rail>
                {discovery!.similarProducts.map((p) => (
                  <Mini
                    key={p.id}
                    p={{ ...(p as any), sales: 0, category: "", priceUsd: p.priceUsd ?? 0 }}
                    price={price}
                    onClick={() => navigate({ to: "/product/$id", params: { id: p.id } })}
                  />
                ))}
              </Rail>
            </Section>
          )}
        </>
      )}

      <ProductQuickView productId={quickViewId} currency={currency} onClose={() => setQuickViewId(null)} />
    </div>
  );
}

type PriceFn = (usd: number, l?: Partial<ProfileListing>) => string;

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      <div className="mb-2.5 flex items-center justify-between px-4">
        <h2 className="text-[14px] font-bold text-white">{title}</h2>
        {hint && <span className="text-[10px] font-semibold text-[#E5484D]">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

function Rail({ children }: { children: ReactNode }) {
  return <div className="flex snap-x gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">{children}</div>;
}

function Empty({ text }: { text: string }) {
  return <p className="px-8 py-14 text-center text-xs text-white/35">{text}</p>;
}

function Mini({ p, price, onClick }: { p: ProfileListing; price: PriceFn; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-[38%] shrink-0 snap-start overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.03] text-left">
      <div className="aspect-square bg-white/[0.04]">
        {p.coverUrl ? (
          <img src={p.coverUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center"><ShoppingBag className="h-5 w-5 text-white/20" /></div>
        )}
      </div>
      <div className="p-2">
        <p className="text-[11px] font-semibold leading-snug text-white line-clamp-2">{p.title}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] font-bold">
          <span className={p.inStock === false ? "text-white/35" : "text-[#E5484D]"}>
            {price(p.priceUsd, p)}
          </span>
          {p.inStock === false && <OutOfStockTag />}
        </p>
      </div>
    </button>
  );
}

function Card({ p, price, onClick }: { p: ProfileListing; price: PriceFn; onClick: () => void }) {
  return (
    <button onClick={onClick} className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.03] text-left">
      <div className="relative aspect-square bg-white/[0.04]">
        {p.coverUrl ? (
          <img src={p.coverUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center"><ShoppingBag className="h-6 w-6 text-white/20" /></div>
        )}
        {(p.cashbackPct ?? 0) > 0 && (
          <span className="absolute left-2 top-2 rounded-full bg-[#E5484D] px-2 py-0.5 text-[9px] font-bold text-white">+{p.cashbackPct}% back</span>
        )}
      </div>
      <div className="p-2.5">
        <p className="text-[12px] font-semibold text-white line-clamp-1">{p.title}</p>
        <div className="mt-0.5 flex items-center justify-between">
          <p className="flex flex-wrap items-center gap-1 text-[12px] font-bold">
            <span className={p.inStock === false ? "text-white/35" : "text-[#E5484D]"}>
              {price(p.priceUsd, p)}
            </span>
            {p.inStock === false && <OutOfStockTag />}
          </p>
          {(p.rating ?? 0) > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-white/40">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              {p.rating!.toFixed(1)}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
