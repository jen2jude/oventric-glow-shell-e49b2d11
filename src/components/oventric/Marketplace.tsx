import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { readCache, writeCache } from "@/lib/swr-cache";
import { ChevronLeft, ChevronRight, LayoutGrid, Search, SlidersHorizontal, ShoppingBag, GraduationCap, ArrowLeft } from "lucide-react";
import { useDominantColor } from "@/hooks/use-dominant-color";
import { useIsAppShell } from "@/hooks/use-launch-context";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import {
  listProducts,
  listMarketplaceCategories,
  getMarketplaceDiscovery,
  type ProductDTO,
  type CategoryNode,
} from "@/lib/marketplace.functions";
import { TopSellersPanel } from "./marketplace-discovery/TopSellersPanel";
import { SocialProofRails } from "@/components/oventric/social-proof/SocialProofRails";
import { CategoryDiscoverySheet } from "./marketplace-discovery/CategoryDiscoverySheet";
import { GridCard, Rail, RowCard, ShopCard, TileCard, type SellerLite } from "./marketplace-discovery/cards";
import { visualForCategory } from "./marketplace-discovery/utils";
import { ExploreCategories } from "./hub/ExploreCategories";
import { AppStickyHeader } from "@/components/oventric/AppStickyHeader";
import { WebMarketplace } from "@/components/oventric/desktop/WebMarketplace";


type Mode = "all" | "digital";
type SortKey = "popular" | "newest" | "best_selling" | "top_rated";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "popular", label: "Popular" },
  { key: "newest", label: "Newest" },
  { key: "best_selling", label: "Best Selling" },
  { key: "top_rated", label: "Top Rated" },
];

interface Discovery {
  featured: ProductDTO[];
  trending: ProductDTO[];
  newArrivals: ProductDTO[];
  topSellers: SellerLite[];
  categoryCounts: Record<string, number>;
}

/** Routes to the dedicated web storefront for URL visitors, app grid for the shell. */
export function Marketplace() {
  const isAppShell = useIsAppShell();
  return isAppShell ? <AppMarketplace /> : <WebMarketplace />;
}

function AppMarketplace() {
  const isAppShell = useIsAppShell();
  const { require } = useOnboarding();
  const navigate = useNavigate();

  const loadDiscovery = useServerFn(getMarketplaceDiscovery);
  const loadProducts = useServerFn(listProducts);
  const loadCats = useServerFn(listMarketplaceCategories);

  const [discovery, setDiscovery] = useState<Discovery | null>(null);
  const [products, setProducts] = useState<ProductDTO[]>([]);
  const [cats, setCats] = useState<CategoryNode[]>([]);
  const [mode, setMode] = useState<Mode>("all");
  const [sort, setSort] = useState<SortKey>("popular");
  const [catalogLimit, setCatalogLimit] = useState(8);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCategories, setShowCategories] = useState(false);
  const [showTopSellers, setShowTopSellers] = useState(false);
  const [activeCategory, setActiveCategory] = useState<CategoryNode | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const kindParam = mode === "all" ? "all" : mode;
      const cacheKey = `marketplace:${kindParam}`;
      type Payload = [Discovery, ProductDTO[], CategoryNode[]];
      // Paint from the last known payload instantly, then revalidate.
      const cached = readCache<Payload>(cacheKey);
      if (cached) {
        setDiscovery(cached[0]);
        setProducts(cached[1]);
        setCats(cached[2]);
        setLoading(false);
      } else {
        setLoading(true);
      }
      try {
        const [d, p, c] = await Promise.all([
          loadDiscovery({ data: { kind: kindParam } }),
          loadProducts({ data: { kind: kindParam } }),
          loadCats(),
        ]);
        setDiscovery(d as Discovery);
        setProducts(p ?? []);
        setCats(c ?? []);
        writeCache<Payload>(cacheKey, [d as Discovery, p ?? [], c ?? []]);
      } catch (e) {
        console.error("marketplace load failed", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [loadDiscovery, loadProducts, loadCats, mode]);

  // Snap to top when the marketplace mode changes so the new feed starts fresh.
  useEffect(() => {
    setCatalogLimit(8);
    scrollTop();
  }, [mode]);

  useEffect(() => {
    setCatalogLimit(8);
  }, [sort]);

  const [featuredIndex, setFeaturedIndex] = useState(0);

  const openProduct = (p: ProductDTO) =>
    require(1, () => navigate({ to: "/product/$id", params: { id: p.slug ?? p.id }, search: { qty: 1 } }), "buyer");
  const openShop = (slug: string) => navigate({ to: "/shop/$id", params: { id: slug } });

  const byMode = useMemo(
    () => (mode === "all" ? products : products.filter((p) => p.kind === mode)),
    [products, mode],
  );

  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return byMode;
    return byMode.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.vendor.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q),
    );
  }, [byMode, query]);

  const sortedCatalog = useMemo(() => {
    const list = [...byMode];
    const sales = (p: ProductDTO) => Number(p.salesCount ?? 0);
    switch (sort) {
      case "newest":
        return list.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
      case "best_selling":
        return list.sort((a, b) => sales(b) - sales(a) || b.reviews - a.reviews);
      case "top_rated":
        return list.sort((a, b) => b.rating - a.rating || b.reviews - a.reviews);
      default:
        // Popular = sales weighted, then review volume, then rating.
        return list.sort(
          (a, b) =>
            sales(b) * 3 + b.reviews - (sales(a) * 3 + a.reviews) || b.rating - a.rating,
        );
    }
  }, [byMode, sort]);



  const categoryProducts = useMemo(() => {
    if (!activeCategory) return [];
    const slugs = new Set<string>([activeCategory.slug, ...activeCategory.children.map((c) => c.slug)]);
    return byMode.filter((p) => slugs.has(p.category) || (p.subcategory && slugs.has(p.subcategory)));
  }, [byMode, activeCategory]);

  /** Root categories that actually have live products — used for the trailing grids. */
  const categoryBuckets = useMemo(() => {
    return cats
      .filter((c) => mode === "all" || c.kind === mode)
      .map((c) => {
        const slugs = new Set<string>([c.slug, ...c.children.map((k) => k.slug)]);
        const items = byMode.filter((p) => slugs.has(p.category) || (p.subcategory && slugs.has(p.subcategory)));
        return { cat: c, items };
      })
      .filter((b) => b.items.length > 0)
      .slice(0, 8);
  }, [cats, byMode, mode]);

  const recommendedProducts = useMemo(() => [...byMode].sort(() => 0).slice(0, 8), [byMode]);
  const sellers = discovery?.topSellers ?? [];

  const scrollTop = () => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  if (loading) return <MarketplaceSkeleton />;

  const featured = discovery?.featured?.[0] ?? discovery?.trending?.[0] ?? null;

  return (
    <div
      ref={topRef}
      className={`min-h-full bg-[#0A0A0B] pb-24 text-white ${!isAppShell ? "oventric-web" : ""}`}
    >
      {isAppShell && <AppStickyHeader />}
      <div className="mx-auto w-full max-w-[720px]">
        {activeCategory ? (
          <CategoryResults
            category={activeCategory}
            items={categoryProducts}
            onBack={() => setActiveCategory(null)}
            onOpenProduct={openProduct}
          />
        ) : (
          <>
            {/* Title */}
            <div className="px-4 pt-2">
              <h1 className="text-[38px] font-bold leading-[1.05] tracking-tight text-white">Marketplace</h1>
              <p className="mt-2 max-w-[19rem] text-[15px] leading-snug text-white/45">
                Discover people, products and opportunities.
              </p>
            </div>

            {/* Search */}
            <div className="px-4 pt-5">
              <div className="flex items-center gap-3 rounded-[10px] bg-[#141416] px-4 py-3.5">
                <Search className="h-[18px] w-[18px] shrink-0 text-white/40" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search products, shops..."
                  className="min-w-0 flex-1 bg-transparent text-[14px] text-white outline-none placeholder:text-white/35"
                />
                <SlidersHorizontal className="h-[18px] w-[18px] shrink-0 text-white/40" />
              </div>
            </div>

            {/* Filter pills */}
            <div className="no-scrollbar mt-4 flex gap-2.5 overflow-x-auto snap-x snap-mandatory scroll-smooth no-scrollbar px-4 pb-1">
              <Pill active={mode === "all"} onClick={() => setMode("all")} label="All" />
              <Pill active={mode === "digital"} onClick={() => setMode("digital")} label="Digital" />
              <Pill
                active={false}
                onClick={() => setShowCategories(true)}
                label="Categories"
                icon={<LayoutGrid className="h-3.5 w-3.5" />}
              />
            </div>

            {!query.trim() && (
              <SocialProofRails
                variant="dark"
                className="mt-2"
                onOpenMarketplace={() => setShowTopSellers(true)}
                hideCommunity
              />
            )}

            {query.trim() ? (

              <section className="px-4 pt-6">
                <h2 className="mb-3 text-[19px] font-bold text-white">
                  {searched.length} result{searched.length === 1 ? "" : "s"}
                </h2>
                <div className="grid grid-cols-2 gap-x-3 gap-y-5">
                  {searched.map((p) => (
                    <GridCard key={p.id} product={p} onClick={() => openProduct(p)} />
                  ))}
                </div>
              </section>
            ) : (
              <div className="space-y-8 pt-6">
                {/* Catalog — sort tabs + grid (Digital / Physical modes) */}
                {mode !== "all" && byMode.length > 0 && (
                  <section className="px-4">
                    <div className="no-scrollbar -mx-1 mb-4 flex gap-5 overflow-x-auto px-1">
                      {SORTS.map((s) => (
                        <button
                          key={s.key}
                          type="button"
                          onClick={() => setSort(s.key)}
                          className={`shrink-0 whitespace-nowrap pb-2 text-[14px] font-semibold transition-colors ${
                            sort === s.key
                              ? "border-b-2 border-[#E5484D] text-white"
                              : "border-b-2 border-transparent text-white/40"
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-5">
                      {sortedCatalog.slice(0, catalogLimit).map((p) => (
                        <GridCard key={p.id} product={p} onClick={() => openProduct(p)} />
                      ))}
                    </div>
                    {sortedCatalog.length > catalogLimit && (
                      <button
                        type="button"
                        onClick={() => setCatalogLimit((n) => n + 8)}
                        className={`mt-5 w-full rounded-[10px] bg-[#141416] py-3 text-[13px] font-semibold text-white/70 ring-1 ring-white/5 transition-colors ${!isAppShell ? "hover:ring-[#E5484D]/40 hover:text-white" : ""}`}
                      >
                        Show more
                      </button>
                    )}
                  </section>
                )}

                {/* Horizontal Category Shortcuts - Mirroring Hub Style */}
                <div className="px-4">
                  <ExploreCategories onSelect={(catName) => {
                    const found = cats.find(c => c.name === catName);
                    if (found) setActiveCategory(found);
                  }} />
                </div>


                {/* Larger Featured Hero */}
                {discovery && discovery.featured.length > 0 && (
                  <div className="px-4">
                    <div
                      onScroll={(e) => {
                        const el = e.currentTarget;
                        setFeaturedIndex(Math.round(el.scrollLeft / Math.max(el.clientWidth, 1)));
                      }}
                      className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth no-scrollbar pb-2"
                    >
                      {discovery.featured.slice(0, 8).map((item, idx) => (
                        <FeaturedHeroCard 
                          key={item.id} 
                          item={item} 
                          onClick={() => openProduct(item)} 
                        />
                      ))}
                    </div>
                    {/* Dots indicator */}
                    <div className="mt-3 flex justify-center gap-2">
                      {discovery.featured.slice(0, 8).map((_, i) => (
                        <div
                          key={i}
                          className={`h-1.5 rounded-full transition-all duration-300 ${i === featuredIndex ? "w-5 bg-[#E5484D]" : "w-1.5 bg-white/20"}`}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* What's Moving */}
                {discovery && discovery.trending.length > 0 && (
                  <Rail title="What's Moving 🔥" onSeeAll={() => setShowCategories(true)}>
                    <div className="no-scrollbar flex gap-3 snap-start overflow-x-auto snap-x snap-mandatory scroll-smooth no-scrollbar px-4">
                      {discovery.trending.slice(0, 10).map((p) => (
                        <TileCard key={p.id} product={p} onClick={() => openProduct(p)} />
                      ))}
                    </div>
                  </Rail>
                )}

                {/* Trending Products */}
                {discovery && discovery.trending.length > 0 && (
                  <Rail title="Trending Products" onSeeAll={scrollTop}>
                    <div className="space-y-2.5 px-4">
                      {discovery.trending.slice(0, 4).map((p) => (
                        <RowCard key={p.id} product={p} onClick={() => openProduct(p)} />
                      ))}
                    </div>
                  </Rail>
                )}

                {/* New on Oventric */}
                {discovery && discovery.newArrivals.length > 0 && (
                  <Rail title="New on Oventric" onSeeAll={scrollTop}>
                    <div className="no-scrollbar flex gap-3 snap-start overflow-x-auto snap-x snap-mandatory scroll-smooth no-scrollbar px-4">
                      {discovery.newArrivals.slice(0, 10).map((p) => (
                        <TileCard key={p.id} product={p} onClick={() => openProduct(p)} />
                      ))}
                    </div>
                  </Rail>
                )}

                {/* Featured Shops */}
                {sellers.length > 0 && (
                  <Rail title="Featured Shops">
                    <div className="space-y-3 px-4">
                      {sellers.slice(0, 2).map((s) => (
                        <ShopCard key={s.id} seller={s} onClick={() => openShop(s.slug)} />
                      ))}
                    </div>
                  </Rail>
                )}
                
                {/* Top Sellers */}
                {sellers.length > 0 && (
                  <Rail title="Top Sellers" onSeeAll={() => setShowTopSellers(true)}>
                    <div className="no-scrollbar flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth no-scrollbar px-4 pb-2">
                      {sellers.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => navigate({ to: "/profile/$id", params: { id: s.slug } })}
                          className="group flex w-[64px] shrink-0 flex-col items-center gap-2"
                        >
                          <span className="relative h-[62px] w-[62px] shrink-0 rounded-full bg-gradient-to-tr from-[#E5484D] to-[#FF7A7F] p-[1.5px] transition-transform group-active:scale-95">
                            <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border-[1.5px] border-[#0A0A0B] bg-black">
                              {s.avatarUrl ? (
                                <img loading="lazy" decoding="async" src={s.avatarUrl} alt={s.name} className="h-full w-full object-cover" />
                              ) : (
                                <span className="text-[14px] font-black text-white/40">
                                  {s.name.slice(0, 2).toUpperCase()}
                                </span>
                              )}
                            </span>
                          </span>
                          <span className="w-full truncate text-center text-[10.5px] font-medium text-white/50">{s.name}</span>
                        </button>
                      ))}
                    </div>
                  </Rail>
                )}

                {/* Recommended */}
                {recommendedProducts.length > 0 && (
                  <Rail title="Recommended Products">
                    <div className="grid grid-cols-2 gap-x-3 gap-y-5 px-4">
                      {recommendedProducts.map((p) => (
                        <GridCard key={p.id} product={p} onClick={() => openProduct(p)} />
                      ))}
                    </div>
                  </Rail>
                )}

                {sellers.length > 0 && (
                  <Rail title="Recommended Sellers">
                    <div className="no-scrollbar flex gap-3 snap-start overflow-x-auto snap-x snap-mandatory scroll-smooth no-scrollbar px-4">
                      {sellers.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => navigate({ to: "/profile/$id", params: { id: s.slug } })}
                          className="group w-[160px] shrink-0 rounded-[28px] bg-[#131316] p-4 text-center ring-1 ring-white/[0.04] transition-transform active:scale-95"
                        >
                          <span className="relative mx-auto grid h-16 w-16 place-items-center overflow-hidden rounded-full bg-black ring-[1.5px] ring-white/10 group-hover:ring-[#E5484D]">
                            {s.avatarUrl ? (
                              <img loading="lazy" decoding="async" src={s.avatarUrl} alt={s.name} className="h-full w-full object-cover" />
                            ) : (
                              <span className="text-[14px] font-black text-white/40">
                                {s.name.slice(0, 2).toUpperCase()}
                              </span>
                            )}
                          </span>
                          <span className="mt-3 block truncate text-[14px] font-bold text-white">{s.name}</span>
                          <span className="block text-[11px] font-medium text-white/30">{s.productsCount} products</span>
                          <span className="mt-4 block rounded-[10px] border border-[#E5484D]/30 bg-[#E5484D]/10 py-2.5 text-[11px] font-bold text-[#E5484D] group-hover:bg-[#E5484D] group-hover:text-white transition-colors">
                            View Profile
                          </span>
                        </button>
                      ))}
                    </div>
                  </Rail>
                )}

                {sellers.length > 2 && (
                  <Rail title="Recommended Shops">
                    <div className="space-y-3 px-4">
                      {sellers.slice(2, 6).map((s) => (
                        <ShopCard key={s.id} seller={s} onClick={() => openShop(s.slug)} />
                      ))}
                    </div>
                  </Rail>
                )}

                {/* Category grids — 2-row horizontal scroll per category */}
                {categoryBuckets.map(({ cat, items }) => (
                  <Rail
                    key={cat.id}
                    title={cat.name}
                    onSeeAll={() => {
                      setActiveCategory(cat);
                      scrollTop();
                    }}
                  >
                    <div className="no-scrollbar overflow-x-auto snap-x snap-mandatory scroll-smooth no-scrollbar px-4 pb-2">
                      <div
                        className={`grid grid-flow-col gap-x-4 gap-y-6 ${items.length <= 2 ? "grid-rows-1" : "grid-rows-2"}`}
                      >
                        {items.slice(0, 10).map((p) => (
                          <div key={p.id} className="w-[150px]">
                            <GridCard product={p} onClick={() => openProduct(p)} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </Rail>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <CategoryDiscoverySheet
        open={showCategories}
        onClose={() => setShowCategories(false)}
        categories={cats}
        counts={discovery?.categoryCounts ?? {}}
        onSelectCategory={(cat) => {
          setActiveCategory(cat);
          scrollTop();
        }}
      />

      {showTopSellers && (
        <TopSellersPanel
          kind={mode}
          onClose={() => setShowTopSellers(false)}
          onOpenShop={(slug) => {
            setShowTopSellers(false);
            openShop(slug);
          }}
        />
      )}

    </div>
  );
}

function Pill({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 rounded-full px-5 py-2.5 text-[13px] font-bold transition-colors ${
        active ? "bg-[#E5484D] text-white" : "border border-white/10 bg-[#141416] text-white/60"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function CategoryResults({
  category,
  items,
  onBack,
  onOpenProduct,
}: {
  category: CategoryNode;
  items: ProductDTO[];
  onBack: () => void;
  onOpenProduct: (p: ProductDTO) => void;
}) {
  return (
    <div className="pt-2">
      <div className="flex items-center gap-2 px-4">
        <button type="button" onClick={onBack} className="grid h-11 w-11 place-items-center rounded-full">
          <ChevronLeft className="h-6 w-6 text-white" />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-[24px] font-bold text-white">{category.name}</h1>
          <p className="text-[12.5px] text-white/40">
            {items.length} {items.length === 1 ? "product" : "products"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-5 px-4 pt-5">
        {items.map((p) => (
          <GridCard key={p.id} product={p} onClick={() => onOpenProduct(p)} />
        ))}
      </div>

      {items.length === 0 && (
        <p className="px-4 py-24 text-center text-[13px] text-white/40">
          No live products in this category yet.
        </p>
      )}
    </div>
  );
}

function FeaturedHeroCard({ item, onClick }: { item: ProductDTO; onClick: () => void }) {
  const dominantColor = useDominantColor(item.coverUrl);
  
  return (
    <div
      className="relative flex aspect-[16/9] w-full min-w-full shrink-0 snap-center overflow-hidden rounded-3xl ring-1 ring-white/5"
      style={{ 
        backgroundColor: dominantColor,
        background: `linear-gradient(135deg, ${dominantColor}, rgba(0,0,0,0.8))`
      }}
    >
      <div className="absolute inset-0 flex">
        <div className="z-10 flex flex-1 flex-col justify-center p-6 text-white md:p-8">
          <span className="mb-2 w-fit rounded-full bg-white/25 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
            Digital Asset
          </span>
          <h2 className="mb-3 line-clamp-2 text-lg font-black leading-tight tracking-tighter drop-shadow-sm md:text-xl">
            {item.name}
          </h2>
          <button
            type="button"
            onClick={onClick}
            className="self-start rounded-full bg-[#E5484D] px-6 py-2.5 text-xs font-bold text-white shadow-lg transition-transform active:scale-95 hover:bg-[#F35E62]"
          >
            Shop Now
          </button>
        </div>
        <div className="relative flex-1 min-w-0">
          {item.coverUrl ? (
            <img
              src={item.coverUrl}
              alt={item.name}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full bg-white/10 flex items-center justify-center">
              <ShoppingBag className="w-16 h-16 text-white/20" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-black/20 via-transparent to-transparent" />
        </div>
      </div>
      
      {item.rating > 4.5 && (
        <div className="absolute top-3 right-3 rounded-full bg-white/25 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
          Top Rated
        </div>
      )}
    </div>
  );
}

function MarketplaceSkeleton() {
  return (
    <div className="min-h-full animate-pulse space-y-5 bg-[#0A0A0B] px-4 pt-12">
      <div className="h-10 w-2/3 rounded-[10px] bg-white/5 animate-pulse" />
      <div className="h-12 w-full rounded-[10px] bg-white/5 animate-pulse" />
      <div className="flex gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-10 w-24 rounded-full bg-white/5 animate-pulse" />
        ))}
      </div>
      <div className="h-[190px] w-full rounded-3xl bg-white/5 animate-pulse" />
      <div className="grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-40 rounded-[10px] bg-white/5 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
