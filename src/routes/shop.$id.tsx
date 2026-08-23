import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { SiteFooterAuto } from "@/components/oventric/desktop/SiteFooterAuto";
import { useIsAppShell } from "@/hooks/use-launch-context";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  MessageCircle,
  Pencil,
  ShoppingBag,
  Star,
  Target,
} from "lucide-react";
import {
  getLiveProfileTab,
  getProfileSocialCounts,
} from "@/lib/profiles.functions";
import {
  getShopBranding,
  getShopDiscovery,
  type ShopBranding,
  type ShopDiscovery,
  type ShopRailItem,
} from "@/lib/shop.functions";
import type { ProfileListing } from "@/lib/profiles/mockProfiles";
import { FollowButton } from "@/components/oventric/FollowButton";
import { ProfileMessageModal } from "@/components/oventric/messaging/ProfileMessageModal";
import { ShopEditModal } from "@/components/oventric/shop/ShopEditModal";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { supabase } from "@/integrations/supabase/client";

const ACCENT = "#E5484D";
type ShopTab = "shop" | "collections" | "services" | "about";

import { z } from "zod";

export const Route = createFileRoute("/shop/$id")({
  validateSearch: (search) => z.object({
    productId: z.string().optional(),
    tab: z.string().optional(),
    pages: z.number().optional(),
    y: z.number().optional(),
    q: z.string().optional(),
    sort: z.string().optional()
  }).parse(search),

  head: ({ params }) => ({
    meta: [
      { title: `Shop · @${params.id} · Oventric` },
      {
        name: "description",
        content: `Browse products, collections and services from @${params.id} on Oventric.`,
      },
      { property: "og:title", content: `Shop · @${params.id} · Oventric` },
      {
        property: "og:description",
        content: `Browse products, collections and services from @${params.id} on Oventric.`,
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: `https://oventric.com/shop/${params.id}` },
    ],
    links: [{ rel: "canonical", href: `https://oventric.com/shop/${params.id}` }],
  }),
  component: ShopPage,
});

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}K`;
  return String(n);
}

function Cover({ url, className }: { url?: string | null; className?: string }) {
  return (
    <div className={`overflow-hidden bg-[#1C1C21] ${className ?? ""}`}>
      {url ? (
        <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <div className="grid h-full w-full place-items-center">
          <ShoppingBag className="h-6 w-6 text-white/25" />
        </div>
      )}
    </div>
  );
}

function SectionHead({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mt-7 flex items-center justify-between gap-3">
      <h2 className="text-base font-black">{title}</h2>
      {action}
    </div>
  );
}

/** Horizontal snap rail with optional desktop arrows. */
function Rail({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const scrollBy = (dir: number) =>
    ref.current?.scrollBy({ left: dir * (ref.current.clientWidth * 0.8), behavior: "smooth" });
  return (
    <div className="relative">
      <div
        ref={ref}
        className="-mx-1 mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      <div className="pointer-events-none absolute inset-y-0 right-0 hidden items-center sm:flex">
        <button
          type="button"
          onClick={() => scrollBy(1)}
          aria-label="Scroll right"
          className="pointer-events-auto grid h-9 w-9 place-items-center rounded-full bg-black/60 backdrop-blur hover:bg-black/80"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 hidden items-center sm:flex">
        <button
          type="button"
          onClick={() => scrollBy(-1)}
          aria-label="Scroll left"
          className="pointer-events-auto grid h-9 w-9 place-items-center rounded-full bg-black/60 backdrop-blur hover:bg-black/80"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function ShopPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { baseCurrency } = useOnboarding();

  const loadShop = useServerFn(getShopBranding);
  const loadCounts = useServerFn(getProfileSocialCounts);
  const loadTab = useServerFn(getLiveProfileTab);
  const loadDiscovery = useServerFn(getShopDiscovery);

  const [shop, setShop] = useState<(ShopBranding & { category?: string }) | null>(null);
  const [followers, setFollowers] = useState(0);
  const [products, setProducts] = useState<ProfileListing[]>([]);
  const [productTotal, setProductTotal] = useState(0);
  const [services, setServices] = useState<ProfileListing[]>([]);
  const [discovery, setDiscovery] = useState<ShopDiscovery | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  const [tab, setTab] = useState<ShopTab>("shop");
  const [dmOpen, setDmOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  const fx = baseCurrency === "USD" ? 1 : baseCurrency === "NGN" ? 1500 : 14;
  const sym = baseCurrency === "USD" ? "$" : baseCurrency === "NGN" ? "₦" : "₵";
  const price = useCallback(
    (usd: number) =>
      usd === 0 ? "Free" : `${sym}${(usd * fx).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
    [sym, fx],
  );

  const { productId } = Route.useSearch();
  const [focalProduct, setFocalProduct] = useState<ProfileListing | null>(null);
  const focalRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (productId && products.length > 0) {
      const found = products.find(p => p.id === productId);
      if (found) {
        setFocalProduct(found);
        setTab("shop");
      }
    }
  }, [productId, products]);

  useEffect(() => {
    if (!focalProduct) return;
    const t = window.setTimeout(() => {
      focalRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 250);
    return () => window.clearTimeout(t);
  }, [focalProduct]);


  useEffect(() => {

    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (alive) setMeId(data.session?.user?.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setMeId(session?.user?.id ?? null);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [s, c, mp, sv] = await Promise.all([
          loadShop({ data: { idOrSlug: id } }),
          loadCounts({ data: { idOrSlug: id } }).catch(() => null),
          loadTab({
            data: { idOrSlug: id, tab: "marketplace", page: 1, pageSize: 48, q: "", sort: "newest" },
          }).catch(() => null),
          loadTab({
            data: { idOrSlug: id, tab: "services", page: 1, pageSize: 24, q: "", sort: "newest" },
          }).catch(() => null),
        ]);
        if (cancelled) return;
        if (s.shop) {
          setShop({
            ...s.shop,
            category: (mp?.items?.[0] as any)?.category || "General Store"
          });
        }
        setFollowers(c?.followers ?? 0);
        const items = (mp?.items ?? []) as ProfileListing[];
        setProducts(items);
        setProductTotal(mp?.total ?? items.length);
        setServices((sv?.items ?? []) as ProfileListing[]);

        if (s.shop) {
          const d = await loadDiscovery({
            data: {
              sellerId: s.shop.userId,
              ...(items[0]?.category ? { category: items[0].category } : {}),
            },
          }).catch(() => null);
          if (!cancelled && d) setDiscovery(d);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, reloadKey, loadShop, loadCounts, loadTab, loadDiscovery]);

  const sales = useMemo(() => products.reduce((s, p) => s + (p.sales ?? 0), 0), [products]);
  const rating = useMemo(() => {
    const rated = products.filter((p) => (p.rating ?? 0) > 0);
    return rated.length
      ? (rated.reduce((s, p) => s + (p.rating ?? 0), 0) / rated.length).toFixed(1)
      : "—";
  }, [products]);

  const featured = useMemo(() => {
    const promoted = products.filter((p) => p.promoted);
    const rest = products.filter((p) => !p.promoted).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    return [...promoted, ...rest].slice(0, 6);
  }, [products]);
  const arrivals = useMemo(() => products.slice(0, 10), [products]);
  const topRated = useMemo(
    () => [...products].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).slice(0, 10),
    [products],
  );
  const bestSellers = useMemo(
    () => [...products].sort((a, b) => (b.sales ?? 0) - (a.sales ?? 0)).slice(0, 10),
    [products],
  );

  const isAppShell = useIsAppShell();
  const name = shop?.shopName ?? id;
  const verified = (shop?.verificationTier ?? "none") !== "none";
  const isOwner = !!meId && !!shop && meId === shop.userId;

  return (
    <div className={`min-h-screen bg-[#0A0A0B] text-white ${!isAppShell ? "oventric-web" : ""}`}>
      {/* Top bar */}
      <div className="sticky top-0 z-30 flex items-center gap-3 bg-[#0A0A0B]/90 px-4 py-3 backdrop-blur md:px-8 lg:px-12">
        <button
          type="button"
          onClick={() =>
            navigate({
              to: "/profile/$id",
              params: { id },
              search: { tab: "marketplace", pages: 1, y: 0, q: "", sort: "newest" } as never,
            })
          }
          aria-label="Back"
          className="grid h-9 w-9 place-items-center rounded-full bg-white/10 hover:bg-white/15"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1 truncate text-[11px] font-black uppercase tracking-widest text-slate-400">Branded Storefront</div>
        {isOwner && (
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-black"
            style={{ backgroundColor: ACCENT }}
          >
            <Pencil className="h-3.5 w-3.5" /> Edit shop
          </button>
        )}
      </div>

      <div className="mx-auto w-full max-w-[720px] px-4 pb-20 md:max-w-[900px] md:px-8 lg:max-w-[1000px] lg:px-12">
        {/* Cover */}
        <div className="relative h-48 w-full overflow-hidden sm:h-64">
          {shop?.coverUrl ? (
            <img src={shop.coverUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-[#1A1A1F]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0B] via-transparent to-transparent" />
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-1/2 web-dark-band md:block"
            style={{ maskImage: "linear-gradient(to top, black, transparent)", WebkitMaskImage: "linear-gradient(to top, black, transparent)", opacity: 0.85 }}
          />
        </div>

        {/* Identity */}
        <div className="-mt-12">
          <div className="relative h-24 w-24 overflow-hidden rounded-2xl border border-white/10 bg-[#141417]">
            {shop?.logoUrl ? (
              <img src={shop.logoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center text-2xl font-black text-white/60">
                {name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-2xl font-black">{name}</h1>
                {verified && <BadgeCheck className="h-6 w-6 shrink-0 text-sky-400" />}
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest">
                <span>{shop?.country || "Global"}</span>
                <span>•</span>
                <span>{shop?.category || "Creator"}</span>
              </div>
            </div>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            {shop?.shopAbout?.trim() || "Branded digital goods and professional services on Oventric."}
          </p>

          {/* Stats */}
          <div className="mt-6 flex items-center justify-between gap-6 overflow-x-auto no-scrollbar py-2 md:grid md:grid-cols-4 md:gap-2">
            {[
              { v: compact(followers), l: "Followers" },
              { v: compact(productTotal), l: "Products" },
              { v: compact(sales), l: "Sales" },
              { v: rating, l: "Rating" },
            ].map((s) => (
              <div key={s.l} className="shrink-0 md:web-card-flat md:px-3 md:py-3 md:text-center">
                <div className="text-lg font-black">{s.v}</div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{s.l}</div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            {isOwner ? (
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-black"
                style={{ backgroundColor: ACCENT }}
              >
                <Pencil className="h-4 w-4" /> Edit shop details
              </button>
            ) : shop?.userId ? (
              <FollowButton
                targetId={shop.userId}
                className="h-11 w-full rounded-xl text-sm font-bold"
              />
            ) : (
              <div className="h-11 rounded-xl bg-white/5" />
            )}
            <button
              type="button"
              onClick={() => setDmOpen(true)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[0.04] text-sm font-bold hover:bg-white/[0.08]"
            >
              <MessageCircle className="h-4 w-4" /> Message
            </button>
          </div>

          {/* Tabs */}
          <nav className="mt-5 flex items-center gap-1 overflow-x-auto border-b border-white/10 md:sticky md:top-[57px] md:z-20 md:-mx-8 md:border-b-0 md:px-8 md:web-glass lg:-mx-12 lg:px-12">
            {(
              [
                ["shop", "Shop"],
                ["collections", "Collections"],
                ["services", "Services"],
                ["about", "About"],
              ] as [ShopTab, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`-mb-px shrink-0 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
                  tab === key
                    ? "border-[#E5484D] text-white md:rounded-full md:border-b-0 md:bg-crimson/10 md:text-crimson"
                    : "border-transparent text-slate-400 hover:text-white md:rounded-full md:border-b-0 md:hover:bg-white/5"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>

          {/* Content */}
          {loading ? (
            <div className="mt-6 space-y-3">
              <div className="h-28 animate-pulse rounded-2xl bg-white/5" />
              <div className="h-28 animate-pulse rounded-2xl bg-white/5" />
            </div>
          ) : tab === "about" ? (
            <div className="mt-5 rounded-2xl border border-white/10 bg-[#141417] p-4 text-sm leading-relaxed text-slate-300">
              {shop?.shopAbout?.trim() || "This seller hasn't added a shop description yet."}
              {shop?.country && (
                <div className="mt-3 text-xs text-slate-500">Based in {shop.country}</div>
              )}
              {isOwner && (
                <button
                  type="button"
                  onClick={() => setEditOpen(true)}
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold"
                  style={{ color: ACCENT }}
                >
                  <Pencil className="h-4 w-4" /> Edit about
                </button>
              )}
            </div>
          ) : tab === "services" ? (
            <Grid items={services} price={price} emptyLabel="No services listed yet." />
          ) : tab === "collections" ? (
            <div className="mt-5 rounded-2xl border border-white/10 bg-[#141417] p-6 text-center text-sm text-slate-400">
              Collections are coming to this shop soon.
            </div>
          ) : (
            <>
              {/* Featured Product (Visual Emphasis) */}
              {focalProduct && (
                <div className="mt-8 scroll-mt-24" ref={focalRef}>
                  <SectionHead title="Selected item" />
                  <Link
                    to="/product/$id"
                    params={{ id: focalProduct.id }}
                    className="group mt-4 block overflow-hidden rounded-[2rem] border border-[#E5484D]/50 bg-[#141417] ring-2 ring-[#E5484D]/25 transition-all hover:border-[#E5484D]"
                  >
                    <div className="relative aspect-[16/9] w-full overflow-hidden bg-neutral-900">
                      <Cover url={focalProduct.coverUrl} className="h-full w-full transition-transform duration-700 group-hover:scale-105" />
                      <div className="absolute top-5 left-5 rounded-full bg-[#E5484D] px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-white shadow-lg">
                        From the post
                      </div>

                    </div>
                    <div className="p-6">
                      <div className="flex items-start justify-between gap-6">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-xl font-black leading-tight text-white group-hover:text-[#E5484D] transition-colors">
                            {focalProduct.title}
                          </h3>
                          <p className="mt-2 line-clamp-2 text-sm text-slate-400">
                            {focalProduct.blurb || focalProduct.category}
                          </p>
                        </div>
                        <div className="text-2xl font-black text-[#E5484D]">
                          {price(focalProduct.priceUsd)}
                        </div>
                      </div>

                      <div className="mt-6 flex items-center justify-between border-t border-white/5 pt-5">
                        <div className="flex items-center gap-3">
                          <div className="flex -space-x-2.5">
                            {[1, 2, 3].map((i) => (
                              <div key={i} className="h-7 w-7 rounded-full border-2 border-[#141417] bg-slate-800" />
                            ))}
                          </div>
                          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            {compact(sales + 12)} global sales
                          </span>
                        </div>
                        <div className="rounded-full bg-white/5 px-6 py-2.5 text-xs font-black uppercase tracking-widest text-white transition-colors group-hover:bg-[#E5484D]">
                          View Details
                        </div>
                      </div>
                    </div>
                  </Link>
                </div>
              )}

              {/* Featured carousel */}

              {featured.length > 0 && (
                <>
                  <SectionHead
                    title="Featured Products"
                    action={
                      <span className="text-xs font-bold text-slate-400">swipe →</span>
                    }
                  />
                  <Rail>
                    {featured.map((p) => (
                      <Link
                        key={p.id}
                        to="/product/$id"
                        params={{ id: p.id }}
                        className="w-[78%] shrink-0 snap-start overflow-hidden rounded-2xl border border-white/10 bg-[#141417] sm:w-[46%]"
                      >
                        <Cover url={p.coverUrl} className="aspect-[16/10] w-full" />
                        <div className="p-3">
                          <div className="truncate text-sm font-bold">{p.title}</div>
                          <div className="mt-0.5 line-clamp-2 text-xs text-slate-400">
                            {p.blurb?.trim() || p.category}
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <span className="text-sm font-black" style={{ color: ACCENT }}>
                              {price(p.priceUsd)}
                            </span>
                            {(p.rating ?? 0) > 0 && (
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-400">
                                <Star className="h-3.5 w-3.5 fill-amber-400" strokeWidth={0} />
                                {(p.rating ?? 0).toFixed(1)}
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </Rail>
                </>
              )}

              {/* New arrivals rail */}
              {arrivals.length > 0 && (
                <>
                  <SectionHead
                    title="New Arrivals"
                    action={
                      <span className="text-sm font-bold" style={{ color: ACCENT }}>
                        {compact(productTotal)} items
                      </span>
                    }
                  />
                  <Rail>
                    {arrivals.map((p) => (
                      <ProductCard key={p.id} item={p} price={price} />
                    ))}
                  </Rail>
                </>
              )}

              {/* Best sellers rail */}
              {bestSellers.some((p) => (p.sales ?? 0) > 0) && (
                <>
                  <SectionHead title="Best Sellers" />
                  <Rail>
                    {bestSellers.map((p) => (
                      <ProductCard key={p.id} item={p} price={price} />
                    ))}
                  </Rail>
                </>
              )}

              {/* Top rated rail */}
              {topRated.some((p) => (p.rating ?? 0) > 0) && (
                <>
                  <SectionHead title="Top Rated" />
                  <Rail>
                    {topRated.map((p) => (
                      <ProductCard key={p.id} item={p} price={price} />
                    ))}
                  </Rail>
                </>
              )}

              {/* All products grid */}
              <SectionHead title="All Products" />
              <Grid items={products} price={price} emptyLabel="No products listed yet." />

              {/* Similar items from other sellers */}
              {(discovery?.similarProducts.length ?? 0) > 0 && (
                <>
                  <SectionHead title="Similar items from other sellers" />
                  <Rail>
                    {discovery!.similarProducts.map((p) => (
                      <Link
                        key={p.id}
                        to="/product/$id"
                        params={{ id: p.id }}
                        className="w-[38%] shrink-0 snap-start overflow-hidden rounded-xl border border-white/10 bg-[#141417] sm:w-[22%]"
                      >
                        <Cover url={p.coverUrl} className="aspect-square w-full" />
                        <div className="p-2">
                          <div className="line-clamp-2 text-[11px] font-bold leading-snug">
                            {p.title}
                          </div>
                          <div className="mt-1 text-[11px] font-black" style={{ color: ACCENT }}>
                            {price(p.priceUsd ?? 0)}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </Rail>
                </>
              )}

              {/* Blog */}
              {(discovery?.blog.length ?? 0) > 0 && (
                <>
                  <SectionHead
                    title="From the Oventric blog"
                    action={
                      <Link to="/blog" className="text-sm font-bold" style={{ color: ACCENT }}>
                        View all
                      </Link>
                    }
                  />
                  <Rail>
                    {discovery!.blog.map((b) => (
                      <Link
                        key={b.id}
                        to="/blog/$slug"
                        params={{ slug: b.id }}
                        className="w-[70%] shrink-0 snap-start overflow-hidden rounded-2xl border border-white/10 bg-[#141417] sm:w-[42%]"
                      >
                        <Cover url={b.coverUrl} className="aspect-[16/9] w-full" />
                        <div className="p-3">
                          <div className="line-clamp-2 text-xs font-bold">{b.title}</div>
                          <div className="mt-1 line-clamp-2 text-[11px] text-slate-400">
                            {b.subtitle}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </Rail>
                </>
              )}

              {/* Bounties */}
              {(discovery?.bounties.length ?? 0) > 0 && (
                <>
                  <SectionHead
                    title="Open bounties"
                    action={
                      <Link to="/" search={{ section: "Bounties" } as never} className="text-sm font-bold" style={{ color: ACCENT }}>
                        View all
                      </Link>
                    }
                  />
                  <Rail>
                    {discovery!.bounties.map((b) => (
                      <div
                        key={b.id}
                        className="w-[62%] shrink-0 snap-start overflow-hidden rounded-2xl border border-white/10 bg-[#141417] p-3 sm:w-[36%]"
                      >
                        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400">
                          <Target className="h-3.5 w-3.5" style={{ color: ACCENT }} />
                          {b.subtitle ?? "Bounty"}
                        </div>
                        <div className="mt-1.5 line-clamp-2 text-xs font-bold">{b.title}</div>
                        <div className="mt-2 text-sm font-black" style={{ color: ACCENT }}>
                          {price(b.priceUsd ?? 0)}
                        </div>
                      </div>
                    ))}
                  </Rail>
                </>
              )}

              {/* Courses */}
              {(discovery?.courses.length ?? 0) > 0 && (
                <>
                  <SectionHead title="Academy courses" />
                  <Rail>
                    {discovery!.courses.map((c) => (
                      <div
                        key={c.id}
                        className="w-[62%] shrink-0 snap-start overflow-hidden rounded-2xl border border-white/10 bg-[#141417] sm:w-[36%]"
                      >
                        <Cover url={c.coverUrl} className="aspect-[16/9] w-full" />
                        <div className="p-3">
                          <div className="line-clamp-2 text-xs font-bold">{c.title}</div>
                          <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-400">
                            <span className="inline-flex items-center gap-1">
                              <GraduationCap className="h-3.5 w-3.5" /> {c.subtitle ?? "Oventric"}
                            </span>
                            <span className="font-black" style={{ color: ACCENT }}>
                              {(c.priceUsd ?? 0) > 0 ? price(c.priceUsd ?? 0) : "Free"}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </Rail>
                </>
              )}
              {/* Seller Content Module */}
              {isOwner === false && (
                <div className="mt-12 mb-8 rounded-3xl border border-white/10 bg-[#141417] p-8 text-center">
                  <h3 className="text-base font-black uppercase tracking-widest text-white">Identity Verified</h3>
                  <p className="mt-2 text-sm text-slate-400">This shop belongs to a real person/creator. Check their Oventric profile for more content.</p>
                  <Link 
                    to="/profile/$id" 
                    params={{ id }} 
                    className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-2.5 text-xs font-black uppercase tracking-widest text-white hover:bg-white/10"
                  >
                    View Broader Identity <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {shop?.userId && (
        <ProfileMessageModal
          open={dmOpen}
          onClose={() => setDmOpen(false)}
          recipient={{
            userId: shop.userId,
            displayName: name,
            avatarUrl: shop.logoUrl,
            slug: shop.slug,
          }}
        />
      )}

      {isOwner && shop && (
        <ShopEditModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          shop={shop}
          userId={shop.userId}
          onSaved={() => setReloadKey((k) => k + 1)}
        />
      )}
      {!isAppShell && <SiteFooterAuto />}
    </div>
  );
}

function ProductCard({
  item,
  price,
}: {
  item: ProfileListing;
  price: (usd: number) => string;
}) {
  return (
    <Link
      to="/product/$id"
      params={{ id: item.id }}
      className="w-[46%] shrink-0 snap-start overflow-hidden rounded-2xl border border-white/10 bg-[#141417] sm:w-[28%] md:web-card"
    >
      <Cover url={item.coverUrl} className="aspect-square w-full" />
      <div className="p-2.5">
        <div className="line-clamp-2 text-xs font-bold leading-snug">{item.title}</div>
        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="text-xs font-black" style={{ color: ACCENT }}>
            {price(item.priceUsd)}
          </span>
          {(item.rating ?? 0) > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-amber-400">
              <Star className="h-3 w-3 fill-amber-400" strokeWidth={0} />
              {(item.rating ?? 0).toFixed(1)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function Grid({
  items,
  price,
  emptyLabel,
}: {
  items: ProfileListing[];
  price: (usd: number) => string;
  emptyLabel: string;
}) {
  if (items.length === 0) {
    return (
      <div className="mt-5 rounded-2xl border border-white/10 bg-[#141417] p-6 text-center text-sm text-slate-400">
        {emptyLabel}
      </div>
    );
  }
  return (
    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3">
      {items.map((p) => (
        <Link
          key={p.id}
          to="/product/$id"
          params={{ id: p.id }}
          className="overflow-hidden rounded-2xl border border-white/10 bg-[#141417] transition-transform hover:-translate-y-0.5 md:web-card md:hover:translate-y-0"
        >
          <Cover url={p.coverUrl} className="aspect-square w-full" />
          <div className="p-2.5">
            <div className="line-clamp-2 text-xs font-bold leading-snug">{p.title}</div>
            <div className="mt-1 flex items-center justify-between gap-2">
              <span className="text-xs font-black" style={{ color: ACCENT }}>
                {price(p.priceUsd)}
              </span>
              {(p.rating ?? 0) > 0 && (
                <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-amber-400">
                  <Star className="h-3 w-3 fill-amber-400" strokeWidth={0} />
                  {(p.rating ?? 0).toFixed(1)}
                </span>
              )}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
