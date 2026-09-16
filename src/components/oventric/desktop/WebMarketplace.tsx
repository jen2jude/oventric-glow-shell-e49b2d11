import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Search,
  Star,
  SlidersHorizontal,
  X,
  BadgeCheck,
  Store,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { computeDisplayPrice, formatMoney } from "@/lib/fx-display";
import {
  listProducts,
  listMarketplaceCategories,
  getMarketplaceDiscovery,
  type ProductDTO,
  type CategoryNode,
} from "@/lib/marketplace.functions";
import type { SellerLite } from "@/components/oventric/marketplace-discovery/cards";

type Kind = "all" | "digital";
type SortKey = "popular" | "newest" | "price_asc" | "price_desc" | "top_rated";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "popular", label: "Most popular" },
  { key: "newest", label: "Newest arrivals" },
  { key: "price_asc", label: "Price: low to high" },
  { key: "price_desc", label: "Price: high to low" },
  { key: "top_rated", label: "Highest rated" },
];

const PAGE_SIZE = 24;

interface Discovery {
  featured: ProductDTO[];
  trending: ProductDTO[];
  newArrivals: ProductDTO[];
  topSellers: SellerLite[];
  categoryCounts: Record<string, number>;
}

/**
 * Dedicated web (URL) marketplace: a light, catalogue-style storefront with a
 * persistent filter rail, dense product grid and pagination. Completely
 * separate from the dark app-shell experience in `Marketplace.tsx`.
 */
export function WebMarketplace() {
  const navigate = useNavigate();
  const { baseCurrency } = useOnboarding();

  const loadDiscovery = useServerFn(getMarketplaceDiscovery);
  const loadProducts = useServerFn(listProducts);
  const loadCats = useServerFn(listMarketplaceCategories);

  const [discovery, setDiscovery] = useState<Discovery | null>(null);
  const [products, setProducts] = useState<ProductDTO[]>([]);
  const [cats, setCats] = useState<CategoryNode[]>([]);
  const [loading, setLoading] = useState(true);

  const [kind, setKind] = useState<Kind>("all");
  const [sort, setSort] = useState<SortKey>("popular");
  const [query, setQuery] = useState("");
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [minRating, setMinRating] = useState(0);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [d, p, c] = await Promise.all([
          loadDiscovery(),
          loadProducts(),
          loadCats(),
        ]);
        setDiscovery(d as Discovery);
        setProducts(p ?? []);
        setCats(c ?? []);
      } catch (e) {
        console.error("web marketplace load failed", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [loadDiscovery, loadProducts, loadCats]);

  const priceOf = useMemo(
    () => (p: ProductDTO) =>
      computeDisplayPrice(
        {
          price_usd: p.priceUSD,
          original_currency: p.originalCurrency,
          original_amount: p.originalAmount,
          fx_snapshot: p.fxSnapshot,
        },
        baseCurrency,
      ),
    [baseCurrency],
  );

  const priceCeiling = useMemo(() => {
    if (!products.length) return 0;
    const max = Math.max(...products.map((p) => priceOf(p).value));
    return Math.ceil(max / 100) * 100 || 100;
  }, [products, priceOf]);

  const rootCats = useMemo(
    () => cats.filter((c) => kind === "all" || c.kind === kind),
    [cats, kind],
  );

  const catCount = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of cats) {
      const slugs = new Set([c.slug, ...c.children.map((k) => k.slug)]);
      counts[c.slug] = products.filter(
        (p) => slugs.has(p.category) || (p.subcategory && slugs.has(p.subcategory)),
      ).length;
    }
    return counts;
  }, [cats, products]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const catSlugs = new Set<string>();
    for (const slug of selectedCats) {
      const node = cats.find((c) => c.slug === slug);
      catSlugs.add(slug);
      node?.children.forEach((k) => catSlugs.add(k.slug));
    }
    return products.filter((p) => {
      if (kind !== "all" && p.kind !== kind) return false;
      if (inStockOnly && !p.inStock) return false;
      if (minRating && p.rating < minRating) return false;
      if (maxPrice != null && priceOf(p).value > maxPrice) return false;
      if (catSlugs.size && !(catSlugs.has(p.category) || (p.subcategory && catSlugs.has(p.subcategory))))
        return false;
      if (
        q &&
        !(
          p.name.toLowerCase().includes(q) ||
          p.vendor.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
        )
      )
        return false;
      return true;
    });
  }, [products, cats, kind, query, selectedCats, minRating, inStockOnly, maxPrice, priceOf]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    const sales = (p: ProductDTO) => Number(p.salesCount ?? 0);
    switch (sort) {
      case "newest":
        return list.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
      case "price_asc":
        return list.sort((a, b) => priceOf(a).value - priceOf(b).value);
      case "price_desc":
        return list.sort((a, b) => priceOf(b).value - priceOf(a).value);
      case "top_rated":
        return list.sort((a, b) => b.rating - a.rating || b.reviews - a.reviews);
      default:
        return list.sort(
          (a, b) => sales(b) * 3 + b.reviews - (sales(a) * 3 + a.reviews) || b.rating - a.rating,
        );
    }
  }, [filtered, sort, priceOf]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const pageItems = sorted.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [kind, query, selectedCats, minRating, inStockOnly, maxPrice, sort]);

  const openProduct = (p: ProductDTO) =>
    navigate({ to: "/product/$id", params: { id: p.slug ?? p.id }, search: { qty: 1 } });

  const activeFilters =
    selectedCats.length + (minRating ? 1 : 0) + (inStockOnly ? 1 : 0) + (maxPrice != null ? 1 : 0);

  const clearAll = () => {
    setSelectedCats([]);
    setMinRating(0);
    setInStockOnly(false);
    setMaxPrice(null);
  };

  /** Rotating pool: the big hero picks whatever was in the small slots, and the
   *  small slots keep pulling fresh items from "What's Moving". */
  const movingPool = useMemo(() => {
    const pool = [
      ...(discovery?.trending ?? []),
      ...(discovery?.featured ?? []),
      ...(discovery?.newArrivals ?? []),
    ];
    const seen = new Set<string>();
    const out: ProductDTO[] = [];
    for (const p of pool) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      out.push(p);
    }
    return out.slice(0, 12);
  }, [discovery]);

  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (movingPool.length < 3) return;
    const t = setInterval(() => setTick((n) => n + 1), 5500);
    return () => clearInterval(t);
  }, [movingPool.length]);

  const len = movingPool.length;
  const featured = len ? movingPool[tick % len] : null;
  const sellers = discovery?.topSellers ?? [];

  const sellerById = useMemo(
    () => new Map(sellers.map((seller) => [seller.id, seller])),
    [sellers],
  );


  const filterPanel = (
    <div className="space-y-7">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
            Filters
          </h3>
          {activeFilters > 0 && (
            <button
              onClick={clearAll}
              className="text-[11px] font-bold text-crimson hover:underline"
            >
              Clear all
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-1 rounded-[10px] bg-slate-100 p-1">
          {(["all", "digital"] as Kind[]).map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`rounded-[8px] py-2 text-[12px] font-bold capitalize transition-colors ${
                kind === k ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h4 className="mb-2.5 text-[13px] font-black text-slate-900">Category</h4>
        <ul className="max-h-72 space-y-1 overflow-y-auto pr-1">
          {rootCats.map((c) => {
            const checked = selectedCats.includes(c.slug);
            return (
              <li key={c.id}>
                <label className="flex cursor-pointer items-center gap-2.5 rounded-[8px] px-2 py-1.5 hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setSelectedCats((prev) =>
                        checked ? prev.filter((s) => s !== c.slug) : [...prev, c.slug],
                      )
                    }
                    className="h-4 w-4 accent-[#E5484D]"
                  />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-700">
                    {c.name}
                  </span>
                  <span className="text-[11px] font-bold text-slate-400">{catCount[c.slug] ?? 0}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <h4 className="mb-2.5 text-[13px] font-black text-slate-900">Max price</h4>
        <input
          type="range"
          min={0}
          max={priceCeiling || 100}
          step={Math.max(1, Math.round((priceCeiling || 100) / 100))}
          value={maxPrice ?? priceCeiling}
          onChange={(e) => setMaxPrice(Number(e.target.value))}
          className="w-full accent-[#E5484D]"
        />
        <div className="mt-1 flex items-center justify-between text-[11.5px] font-bold text-slate-500">
          <span>{formatMoney(0, baseCurrency)}</span>
          <span className="text-slate-900">
            {formatMoney(maxPrice ?? priceCeiling, baseCurrency)}
          </span>
        </div>
      </div>

      <div>
        <h4 className="mb-2.5 text-[13px] font-black text-slate-900">Rating</h4>
        <div className="space-y-1">
          {[4, 3, 0].map((r) => (
            <button
              key={r}
              onClick={() => setMinRating(r)}
              className={`flex w-full items-center gap-2 rounded-[8px] px-2 py-1.5 text-left text-[13px] font-medium transition-colors ${
                minRating === r ? "bg-crimson/10 text-crimson" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {r === 0 ? (
                "Any rating"
              ) : (
                <>
                  <span className="flex">
                    {Array.from({ length: r }).map((_, i) => (
                      <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    ))}
                  </span>
                  & up
                </>
              )}
            </button>
          ))}
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-2.5 rounded-[8px] px-2 py-1.5 hover:bg-slate-50">
        <input
          type="checkbox"
          checked={inStockOnly}
          onChange={(e) => setInStockOnly(e.target.checked)}
          className="h-4 w-4 accent-[#E5484D]"
        />
        <span className="text-[13px] font-medium text-slate-700">Available now</span>
      </label>
    </div>
  );

  return (
    <div className="web-marketplace min-h-screen bg-background text-foreground">
      <main className="mx-auto w-full max-w-[1440px] px-4 py-7 sm:px-6 sm:py-10 lg:px-11 lg:py-12">
        <header className="grid gap-6 border-b border-border pb-7 md:grid-cols-[minmax(0,1fr)_minmax(360px,520px)] md:items-end">
          <div className="min-w-0">
            <span className="text-[11px] font-extrabold uppercase text-primary">Oventric Marketplace</span>
            <h1 className="font-wallet-display mt-2 text-[34px] font-bold leading-tight sm:text-[42px]">Digital products from sellers you can trust.</h1>
            <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted-foreground">Discover creator-made tools, software and services, protected by escrow and priced in your currency.</p>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <div className="relative min-w-0">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products, sellers or categories" className="h-12 w-full rounded-[10px] border border-input bg-card pl-10 pr-4 text-[14px] outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/10" />
            </div>
            <Button variant="outline" className="h-12 rounded-[10px] px-4 lg:hidden" onClick={() => setFiltersOpen(true)}><SlidersHorizontal /> <span className="hidden sm:inline">Filters</span>{activeFilters > 0 && <span>({activeFilters})</span>}</Button>
          </div>
        </header>

        <div className="no-scrollbar flex gap-2 overflow-x-auto border-b border-border py-4">
          <Button size="sm" className="shrink-0 rounded-full" onClick={() => { setKind("all"); setSelectedCats([]); }}>All digital goods</Button>
          {rootCats.slice(0, 8).map((category) => (
            <Button key={category.id} size="sm" variant={selectedCats.includes(category.slug) ? "default" : "outline"} className="shrink-0 rounded-full" onClick={() => setSelectedCats([category.slug])}>{category.name}</Button>
          ))}
        </div>

        {sellers.length > 0 && !query.trim() && (
          <section className="py-8">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
              <div className="min-w-0"><h2 className="font-wallet-display text-[24px] font-bold">Shop by seller</h2><p className="mt-1 text-[13px] text-muted-foreground">Meet trusted creators and explore their storefronts.</p></div>
              <Button variant="ghost" className="px-2 text-primary" onClick={() => navigate({ to: "/sellers" })}>View all <ArrowRight /></Button>
            </div>
            <div className="no-scrollbar -mx-4 mt-5 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:px-0 lg:grid-cols-4">
              {sellers.slice(0, 4).map((seller) => <SellerCard key={seller.id} seller={seller} onClick={() => seller.slug && navigate({ to: "/shop/$id", params: { id: seller.slug } })} />)}
            </div>
          </section>
        )}

        {!loading && movingPool.length > 0 && !query.trim() && (
          <section className="border-y border-border py-8">
            <h2 className="font-wallet-display text-[24px] font-bold">Featured digital products</h2>
            <p className="mt-1 text-[13px] text-muted-foreground">Popular picks from Oventric sellers.</p>
            <div className="no-scrollbar -mx-4 mt-5 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:px-0 lg:grid-cols-4">
              {movingPool.slice(0, 4).map((product) => <SellerProductCard key={product.id} product={product} seller={sellerById.get(product.sellerId)} price={priceOf(product).formatted} onClick={() => openProduct(product)} />)}
            </div>
          </section>
        )}

        <section className="pt-8">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 pb-5">
            <div className="min-w-0"><h2 className="font-wallet-display text-[24px] font-bold">Explore the marketplace</h2><p className="mt-1 text-[13px] text-muted-foreground">Compare every available digital product.</p></div>
            <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)} className="h-10 max-w-[150px] rounded-[10px] border border-input bg-card px-3 text-[12px] font-bold outline-none sm:max-w-none">{SORTS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</select>
          </div>
        <div className="grid gap-8 lg:grid-cols-[248px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <div className="sticky top-24">{filterPanel}</div>
          </aside>

          <div className="min-w-0">
            <p className="mb-4 text-[13px] font-medium text-slate-500">
              {loading ? "Loading catalogue…" : `${sorted.length} products`}
              {selectedCats.length > 0 && !loading && " · filtered"}
            </p>

            {loading ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="aspect-square rounded-[10px] bg-slate-100" />
                    <div className="mt-3 h-3 w-3/4 rounded bg-slate-100" />
                    <div className="mt-2 h-3 w-1/3 rounded bg-slate-100" />
                  </div>
                ))}
              </div>
            ) : pageItems.length === 0 ? (
              <div className="rounded-[10px] border border-dashed border-slate-300 py-20 text-center">
                <p className="text-[15px] font-bold text-slate-800">No products match your filters</p>
                <button onClick={clearAll} className="mt-2 text-[13px] font-bold text-crimson hover:underline">
                  Reset filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
                {pageItems.map((p) => (
                  <WebProductCard
                    key={p.id}
                    product={p}
                    seller={sellerById.get(p.sellerId)}
                    price={priceOf(p).formatted}
                    onClick={() => openProduct(p)}
                  />
                ))}
              </div>
            )}

            {/* Pagination */}
            {!loading && pageCount > 1 && (
              <nav className="mt-10 flex items-center justify-center gap-1.5">
                {Array.from({ length: pageCount }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setPage(i + 1);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className={`h-9 min-w-9 rounded-[8px] px-3 text-[13px] font-bold transition-colors ${
                      current === i + 1
                        ? "bg-crimson text-white"
                        : "border border-slate-200 text-slate-600 hover:border-crimson/40 hover:text-crimson"
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </nav>
            )}
          </div>
          </div>
        </section>
      </main>

      {/* Mobile filter drawer */}
      {filtersOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setFiltersOpen(false)} />
          <div className="absolute inset-y-0 right-0 w-[86%] max-w-sm overflow-y-auto bg-white p-5">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-[16px] font-black text-slate-900">Filters</h2>
              <button onClick={() => setFiltersOpen(false)} aria-label="Close filters">
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>
            {filterPanel}
            <div className="mt-6">
              <label className="mb-2 block text-[13px] font-black text-slate-900">Sort by</label>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="h-11 w-full rounded-[10px] border border-slate-200 px-3 text-[13px] font-bold text-slate-700"
              >
                {SORTS.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => setFiltersOpen(false)}
              className="mt-6 h-12 w-full rounded-[10px] bg-crimson text-[14px] font-black text-white"
            >
              Show {sorted.length} products
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function WebProductCard({
  product,
  seller,
  price,
  onClick,
}: {
  product: ProductDTO;
  seller?: SellerLite;
  price: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col overflow-hidden rounded-[10px] border border-border bg-card text-left transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg"
    >
      <SellerIdentity seller={seller} vendor={product.vendor} rating={product.rating} />
      <div className="relative mx-3 aspect-video overflow-hidden rounded-[8px] bg-muted">
        {product.coverUrl ? (
          <img
            src={product.coverUrl}
            alt={product.name}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-slate-100 to-slate-200" />
        )}
        {!product.inStock && (
          <span className="absolute left-2 top-2 rounded-[6px] bg-slate-900/85 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-white">
            Out of stock
          </span>
        )}
        {product.promoted && product.inStock && (
          <span className="absolute left-2 top-2 rounded-[6px] bg-crimson px-2 py-1 text-[10px] font-black uppercase tracking-wide text-white">
            Featured
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-3.5">
        <p className="line-clamp-2 text-[13.5px] font-bold leading-snug text-slate-900">
          {product.name}
        </p>
        <p className="mt-1 truncate text-[11.5px] font-medium text-slate-500">{product.vendor}</p>
        <div className="mt-auto flex items-end justify-between pt-3">
          <span className="text-[16px] font-black text-primary">{price}</span>
          <span className="flex items-center gap-0.5 text-[11.5px] font-bold text-slate-500">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            {product.rating > 0 ? product.rating.toFixed(1) : "5.0"}
            <span className="text-slate-400">({product.reviews})</span>
          </span>
        </div>
      </div>
    </button>
  );
}

function SellerIdentity({ seller, vendor, rating }: { seller?: SellerLite; vendor: string; rating: number }) {
  return <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 p-3"><div className="flex min-w-0 items-center gap-2.5"><span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-muted">{seller?.avatarUrl ? <img src={seller.avatarUrl} alt={seller.name} className="h-full w-full object-cover" /> : <Store className="h-4 w-4 text-muted-foreground" />}</span><div className="min-w-0"><p className="truncate text-[12px] font-bold text-foreground">{seller?.name ?? vendor}</p><p className="flex items-center gap-1 text-[10px] text-muted-foreground">{seller?.verified && <BadgeCheck className="h-3 w-3 text-primary" />} {seller?.verified ? "Verified seller" : "Oventric seller"}</p></div></div><span className="flex shrink-0 items-center gap-1 rounded-[6px] bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700"><Star className="h-3 w-3 fill-amber-400 text-amber-400" />{rating > 0 ? rating.toFixed(1) : "5.0"}</span></div>;
}

function SellerProductCard({ product, seller, price, onClick }: { product: ProductDTO; seller?: SellerLite; price: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="group w-[78vw] max-w-[310px] shrink-0 snap-start overflow-hidden rounded-[10px] border border-border bg-card text-left transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg sm:w-auto sm:max-w-none"><SellerIdentity seller={seller} vendor={product.vendor} rating={product.rating} /><div className="mx-3 aspect-video overflow-hidden rounded-[8px] bg-muted">{product.coverUrl && <img src={product.coverUrl} alt={product.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />}</div><div className="p-4"><p className="line-clamp-2 min-h-10 text-[13.5px] font-bold leading-snug">{product.name}</p><div className="mt-4 flex items-center justify-between border-t border-border pt-3"><div><span className="block text-[9px] font-bold uppercase text-muted-foreground">Price</span><span className="text-[17px] font-extrabold text-primary">{price}</span></div><span className="grid h-9 w-9 place-items-center rounded-[8px] bg-muted text-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground"><ArrowRight className="h-4 w-4" /></span></div></div></button>;
}

function SellerCard({ seller, onClick }: { seller: SellerLite; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="group relative h-[190px] w-[78vw] max-w-[310px] shrink-0 snap-start overflow-hidden rounded-[10px] border border-border bg-muted text-left sm:w-auto sm:max-w-none">{seller.coverUrl && <img src={seller.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />}<span className="absolute inset-0 bg-gradient-to-t from-foreground/90 via-foreground/30 to-transparent" /><div className="absolute inset-x-0 bottom-0 flex items-end gap-3 p-4 text-primary-foreground"><span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-primary-foreground/80 bg-muted">{seller.avatarUrl ? <img src={seller.avatarUrl} alt={seller.name} className="h-full w-full object-cover" /> : <Store className="h-5 w-5 text-muted-foreground" />}</span><div className="min-w-0 flex-1"><p className="flex items-center gap-1 truncate text-[14px] font-bold">{seller.name}{seller.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-primary" />}</p><p className="text-[11px] opacity-80">{seller.productsCount} products · {seller.followersCount} followers</p></div><ArrowRight className="h-4 w-4 shrink-0" /></div></button>;
}

