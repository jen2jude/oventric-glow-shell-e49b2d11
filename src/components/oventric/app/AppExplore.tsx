import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BadgeCheck,
  Loader2,
  MessageSquare,
  Search,
  SearchX,
  Star,
} from "lucide-react";

import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { computeDisplayPrice } from "@/lib/fx-display";
import {
  getMarketplaceDiscovery,
  listMarketplaceCategories,
  getTopSellers,
  type ProductDTO,
  type TopSellerDTO,
} from "@/lib/marketplace.functions";
import { getDiscoveryFeed, type DiscoveryPeer } from "@/lib/discovery.functions";
import { searchGlobal, type SearchResults } from "@/lib/search.functions";
import { AppSearchSuggestions, rememberSearch } from "./AppSearchSuggestions";
import { visualForCategory } from "@/components/oventric/marketplace-discovery/utils";
import { AvatarImage } from "@/components/oventric/AvatarImage";
import { CashbackBadge } from "@/components/oventric/CashbackBadge";
import { haptic } from "@/lib/haptics";
import { AppSellerLeaderboardSheet } from "./AppSellerLeaderboardSheet";

type CategoryNode = { id: string; slug: string; name: string };

const TABS = ["All", "Categories", "Products", "Shops", "People"] as const;
type Tab = (typeof TABS)[number];

const TILE_TINTS = [
  "bg-[#2F5FD0]/15 text-[#7DA2FF]",
  "bg-[#7C5CFC]/15 text-[#B39DFF]",
  "bg-[#E5484D]/15 text-[#FF8A8E]",
  "bg-[#2FA96F]/15 text-[#6FD9A4]",
  "bg-[#D9A429]/15 text-[#F2C14E]",
];

/**
 * App-native Explore — dark, compact discovery surface for the app shell.
 * Reads the same public discovery data as the website Explore page; no new
 * data paths.
 */
export function AppExplore({ onSelect }: { onSelect: (section: "Marketplace") => void }) {
  const navigate = useNavigate();
  const [boardOpen, setBoardOpen] = useState(false);
  const { baseCurrency } = useOnboarding();
  const currency = baseCurrency ?? "USD";

  const routeSearch = useSearch({ strict: false }) as { search?: string };

  const fetchDiscovery = useServerFn(getMarketplaceDiscovery);
  const fetchCategories = useServerFn(listMarketplaceCategories);
  const fetchSellers = useServerFn(getTopSellers);
  const fetchPeers = useServerFn(getDiscoveryFeed);
  const runSearch = useServerFn(searchGlobal);

  const { data: discovery } = useQuery({
    queryKey: ["explore-discovery"],
    queryFn: () => fetchDiscovery(),
    staleTime: 60_000,
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["explore-categories"],
    queryFn: () => fetchCategories() as Promise<CategoryNode[]>,
    staleTime: 5 * 60_000,
  });
  const { data: sellers = [] } = useQuery({
    queryKey: ["explore-sellers"],
    queryFn: () => fetchSellers(),
    staleTime: 60_000,
  });
  const { data: peerFeed } = useQuery({
    queryKey: ["explore-peers"],
    queryFn: () => fetchPeers(),
    staleTime: 60_000,
  });

  const [tab, setTab] = useState<Tab>("All");
  const [q, setQ] = useState(routeSearch?.search ?? "");
  const [focused, setFocused] = useState(false);
  const query = q.trim().toLowerCase();

  useEffect(() => {
    const incoming = (routeSearch?.search ?? "").trim();
    if (incoming) setQ(incoming);
  }, [routeSearch?.search]);

  const { data: searchResults, isFetching: searching } = useQuery({
    queryKey: ["explore-search", query],
    queryFn: () => runSearch({ data: { q: q.trim() } }),
    enabled: query.length > 0,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const allTrending = (discovery?.trending ?? []) as ProductDTO[];
  const allNew = (discovery?.newArrivals ?? []) as ProductDTO[];
  const allPeers = (peerFeed?.topPeersAny ?? []) as DiscoveryPeer[];

  const matchP = (p: ProductDTO) =>
    !query ||
    p.name.toLowerCase().includes(query) ||
    (p.vendor ?? "").toLowerCase().includes(query);

  const trending = useMemo(() => allTrending.filter(matchP), [allTrending, query]);
  const newArrivals = useMemo(() => allNew.filter(matchP), [allNew, query]);
  const shownCategories = useMemo(
    () => categories.filter((c) => !query || c.name.toLowerCase().includes(query)),
    [categories, query],
  );
  const shownSellers = useMemo(
    () =>
      (sellers as TopSellerDTO[]).filter((s) => !query || s.name.toLowerCase().includes(query)),
    [sellers, query],
  );
  const peers = useMemo(
    () => allPeers.filter((p) => !query || p.name.toLowerCase().includes(query)),
    [allPeers, query],
  );

  const show = (t: Tab) => tab === "All" || tab === t;

  return (
    <>
      <AppSellerLeaderboardSheet open={boardOpen} onClose={() => setBoardOpen(false)} />
    <div className="min-h-screen bg-[#0A0A0B] pb-24 text-white">
      {/* ------------------------------------------------ search + tabs */}
      <div className="app-scroll-header sticky top-0 z-30 border-b border-white/[0.06] bg-[#0A0A0B] px-4 pb-3 pt-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              if (q.trim()) rememberSearch(q);
              setTimeout(() => setFocused(false), 150);
            }}
            placeholder={`Search ${tab === "All" ? "Oventric" : tab.toLowerCase()}…`}
            className="h-11 w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] pl-10 pr-4 text-sm text-white placeholder:text-white/35 focus:border-[#E5484D]/50 focus:outline-none"
          />
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                haptic("select");
                setTab(t);
              }}
              className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${
                tab === t
                  ? "bg-[#E5484D] text-white"
                  : "border border-white/[0.08] bg-white/[0.03] text-white/60"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4">
        {focused && !query && (
          <div onMouseDown={(e) => e.preventDefault()}>
            <AppSearchSuggestions
              names={[...allTrending, ...allNew].map((p) => p.name)}
              vendors={[
                ...(sellers as TopSellerDTO[]).map((s) => s.name),
                ...allPeers.map((p) => p.name),
              ]}
              categories={categories.map((c) => c.name)}
              onPick={(t) => setQ(t)}
            />
          </div>
        )}
        {query ? (
          <SearchResultsView
            results={searchResults}
            loading={searching && !searchResults}
            query={q.trim()}
            currency={currency}
          />
        ) : (
          <>
            {/* ------------------------------------------------ categories */}
            {show("Categories") && (
              <section className="mt-5">
                <SectionHead
                  title="Browse by category"
                  action={{ label: "View all", onClick: () => onSelect("Marketplace") }}
                />
                <div className="grid grid-cols-4 gap-3">
                  {shownCategories.slice(0, tab === "Categories" ? 60 : 8).map((c, i) => {
                    const { Icon } = visualForCategory(c.slug, c.name);
                    const tint = TILE_TINTS[i % TILE_TINTS.length]!;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          haptic("select");
                          onSelect("Marketplace");
                        }}
                        className="flex flex-col items-center gap-2 text-center active:scale-[0.96]"
                      >
                        <span
                          className={`grid h-14 w-14 shrink-0 place-items-center rounded-full ${tint}`}
                        >
                          <Icon className="h-6 w-6" />
                        </span>
                        <span className="min-w-0 max-w-full truncate text-[11px] font-semibold capitalize text-white/80">
                          {c.name.trim()}
                        </span>
                      </button>
                    );
                  })}
                  {shownCategories.length === 0 && <EmptyNote>No categories match.</EmptyNote>}
                </div>
              </section>
            )}

            {/* ------------------------------------------------- trending */}
            {show("Products") && (
              <section className="mt-7">
                <SectionHead
                  title="Trending right now"
                  action={{ label: "View all", onClick: () => onSelect("Marketplace") }}
                />
                <div className="grid grid-cols-2 gap-3">
                  {trending.slice(0, tab === "Products" ? 40 : 6).map((p) => (
                    <ProductCard key={p.id} product={p} currency={currency} />
                  ))}
                  {trending.length === 0 && <EmptyNote>Nothing trending yet.</EmptyNote>}
                </div>
              </section>
            )}

            {/* --------------------------------------------------- sellers */}
            {show("Shops") && (
              <section className="mt-7">
                <SectionHead
                  title="Top sellers"
                  action={{ label: "View all", onClick: () => setBoardOpen(true) }}
                />
                <div className="space-y-2">
                  {shownSellers.slice(0, tab === "Shops" ? 40 : 5).map((s) => (
                    <Link
                      key={s.id}
                      to="/shop/$id"
                      params={{ id: s.slug || s.id }}
                      className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3 active:scale-[0.99]"
                    >
                      <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full border border-white/[0.08] bg-white/[0.05]">
                        <AvatarImage src={s.avatarUrl} alt={s.name} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1 truncate text-sm font-bold text-white">
                          <span className="truncate">{s.name}</span>
                          {s.verified && (
                            <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-[#7DA2FF]" />
                          )}
                        </p>
                        <p className="truncate text-[11px] text-white/45">
                          {s.productsCount} product{s.productsCount === 1 ? "" : "s"}
                        </p>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-white/60">
                        <Star className="h-3 w-3 fill-[#F2C14E] text-[#F2C14E]" />
                        {s.rating ? s.rating.toFixed(1) : "New"}
                      </span>
                    </Link>
                  ))}
                  {shownSellers.length === 0 && <EmptyNote>No sellers match.</EmptyNote>}
                </div>
              </section>
            )}

            {/* ----------------------------------------------------- fresh */}
            {show("Products") && (
              <section className="mt-7">
                <SectionHead
                  title="Fresh in the market"
                  action={{ label: "View all", onClick: () => onSelect("Marketplace") }}
                />
                <div className="grid grid-cols-2 gap-3">
                  {newArrivals.slice(0, tab === "Products" ? 40 : 6).map((p) => (
                    <ProductCard key={p.id} product={p} currency={currency} />
                  ))}
                  {newArrivals.length === 0 && <EmptyNote>No new listings yet.</EmptyNote>}
                </div>
              </section>
            )}

            {/* ---------------------------------------------------- people */}
            {show("People") && (
              <section className="mt-7">
                <SectionHead title="People on Oventric" />
                <div className="grid grid-cols-3 gap-3">
                  {peers.slice(0, tab === "People" ? 40 : 6).map((p) => (
                    <Link
                      key={p.id}
                      to="/profile/$id"
                      params={{ id: p.slug }}
                      className="flex flex-col items-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 text-center active:scale-[0.98]"
                    >
                      <div className="h-14 w-14 overflow-hidden rounded-full border border-white/[0.08] bg-white/[0.05]">
                        <AvatarImage src={p.avatarUrl} alt={p.name} />
                      </div>
                      <p className="max-w-full truncate text-xs font-bold text-white">{p.name}</p>
                      <p className="inline-flex items-center gap-1 text-[10px] font-semibold text-white/50">
                        <Star className="h-3 w-3 fill-[#F2C14E] text-[#F2C14E]" />
                        {p.stars.toFixed(1)}
                      </p>
                    </Link>
                  ))}
                  {peers.length === 0 && <EmptyNote>No people match.</EmptyNote>}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
    </>
  );
}

function SectionHead({
  title,
  action,
}: {
  title: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="truncate text-[15px] font-extrabold text-white">{title}</h2>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-[#FF8A8E]"
        >
          {action.label}
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="col-span-full rounded-2xl border border-dashed border-white/[0.1] bg-white/[0.02] p-6 text-center text-xs text-white/40">
      {children}
    </p>
  );
}

function SearchResultsView({
  results,
  loading,
  query,
  currency,
}: {
  results: SearchResults | undefined;
  loading: boolean;
  query: string;
  currency: string;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm font-semibold text-white/50">
        <Loader2 className="h-4 w-4 animate-spin text-[#E5484D]" />
        Searching Oventric for “{query}”…
      </div>
    );
  }

  const products = results?.products ?? [];
  const services = results?.services ?? [];
  const people = results?.peers ?? [];
  const posts = results?.posts ?? [];
  const total = products.length + services.length + people.length + posts.length;

  const priceOf = (usd: number) =>
    computeDisplayPrice(
      { price_usd: usd, original_currency: null, original_amount: null, fx_snapshot: null },
      currency,
    ).formatted;

  return (
    <div className="mt-5">
      <h2 className="flex items-center gap-2 text-[15px] font-extrabold text-white">
        <Search className="h-4 w-4 text-[#E5484D]" />
        Results for “{query}”
        <span className="text-xs font-semibold text-white/40">({total})</span>
      </h2>

      {total === 0 && (
        <div className="mt-5 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-white/[0.1] bg-white/[0.02] px-6 py-12 text-center">
          <SearchX className="h-8 w-8 text-white/20" />
          <p className="text-sm font-bold text-white/70">Nothing found for “{query}”</p>
          <p className="text-xs text-white/40">
            Try another word — a product name, a category, a seller or a member.
          </p>
        </div>
      )}

      {(products.length > 0 || services.length > 0) && (
        <section className="mt-6">
          <h3 className="mb-3 text-[13px] font-extrabold text-white/80">Products &amp; services</h3>
          <div className="grid grid-cols-2 gap-3">
            {[...products, ...services].map((p) => (
              <Link
                key={`${p.kind}-${p.id}`}
                to="/product/$id"
                params={{ id: p.id }}
                className="group flex flex-col overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.03] active:scale-[0.99]"
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-white/[0.05]">
                  {p.coverUrl ? (
                    <img
                      src={p.coverUrl}
                      alt={p.title}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                  {p.kind === "service" && (
                    <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                      Service
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-1.5 p-3">
                  <h4 className="line-clamp-2 text-[13px] font-bold leading-snug text-white">
                    {p.title}
                  </h4>
                  <p className="truncate text-[11px] text-white/45">
                    {p.kind === "service" ? p.providerName : p.vendor}
                  </p>
                  <p className="mt-auto pt-1 text-sm font-extrabold text-white">
                    {priceOf(p.priceUsd)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {people.length > 0 && (
        <section className="mt-7">
          <h3 className="mb-3 text-[13px] font-extrabold text-white/80">People</h3>
          <div className="grid grid-cols-3 gap-3">
            {people.map((p) => (
              <Link
                key={p.id}
                to="/profile/$id"
                params={{ id: p.slug }}
                className="flex flex-col items-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 text-center active:scale-[0.98]"
              >
                <div className="h-14 w-14 overflow-hidden rounded-full border border-white/[0.08] bg-white/[0.05]">
                  <AvatarImage src={p.avatarUrl} alt={p.name} />
                </div>
                <p className="max-w-full truncate text-xs font-bold text-white">{p.name}</p>
                {p.username && (
                  <p className="max-w-full truncate text-[10px] text-white/40">@{p.username}</p>
                )}
                <p className="inline-flex items-center gap-1 text-[10px] font-semibold text-white/50">
                  <Star className="h-3 w-3 fill-[#F2C14E] text-[#F2C14E]" />
                  {p.stars.toFixed(1)}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {posts.length > 0 && (
        <section className="mt-7">
          <h3 className="mb-3 text-[13px] font-extrabold text-white/80">Posts</h3>
          <div className="grid gap-2">
            {posts.map((p) => (
              <Link
                key={p.id}
                to="/feed"
                search={{ post: p.id }}
                className="flex items-start gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3.5 active:scale-[0.99]"
              >
                <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-white/[0.08] bg-white/[0.05]">
                  <AvatarImage src={p.authorAvatarUrl} alt={p.authorName} />
                </div>
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-bold text-white">
                    <span className="truncate">{p.authorName}</span>
                    <MessageSquare className="h-3.5 w-3.5 shrink-0 text-white/25" />
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-white/55">
                    {p.text}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ProductCard({ product, currency }: { product: ProductDTO; currency: string }) {
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
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.03] active:scale-[0.99]">
      <Link
        to="/product/$id"
        params={{ id: product.id }}
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
        <Link to="/product/$id" params={{ id: product.id }} className="min-w-0">
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
        <p className="mt-auto pt-1 text-sm font-extrabold text-white">{price}</p>
      </div>
    </div>
  );
}
