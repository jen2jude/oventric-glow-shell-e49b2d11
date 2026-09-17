import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BadgeCheck,
  Compass,
  Loader2,
  MessageSquare,
  Search,
  SearchX,
  Sparkles,
  Star,
  TrendingUp,
  Users,
} from "lucide-react";

import exploreHeroBg from "@/assets/explore-hero-bg.jpg";
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
import { visualForCategory } from "@/components/oventric/marketplace-discovery/utils";
import { AvatarImage } from "@/components/oventric/AvatarImage";
import { DiscoveryPanel } from "@/components/oventric/DiscoveryPanel";

type CategoryNode = { id: string; slug: string; name: string };

const TABS = ["All", "Categories", "Products", "Shops", "People"] as const;
type Tab = (typeof TABS)[number];

const TILE_TINTS = [
  "bg-[#EAF1FF] text-[#2F5FD0]",
  "bg-[#F3ECFF] text-[#6F42D4]",
  "bg-[#FFECF3] text-[#D0417A]",
  "bg-[#E8F8EF] text-[#1F9D62]",
  "bg-[#FFF6E2] text-[#C58318]",
  "bg-[#FFEDE4] text-[#D4622A]",
  "bg-[#E3F6F6] text-[#158C8C]",
  "bg-[#ECEEFF] text-[#4A54CF]",
];

/**
 * Explore — a desktop-first discovery page in the marketing/home visual
 * language, reflowing to tablet and mobile. Reads the same public discovery
 * data the marketplace uses; no new data paths.
 */
export function ExplorePage({ onSelect }: { onSelect: (section: "Marketplace") => void }) {
  const navigate = useNavigate();
  const { baseCurrency } = useOnboarding();
  const currency = baseCurrency ?? "USD";

  // The homepage hero search (and shared links) land here with ?search=…
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
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();

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

  const categoriesBlock = (
    <>
      <SectionHead
        title="Browse by category"
        action={{ label: "View all", onClick: () => onSelect("Marketplace") }}
      />
      <div className="grid grid-cols-4 gap-3 sm:grid-cols-4 lg:grid-cols-6 lg:gap-4">
        {shownCategories.slice(0, tab === "Categories" ? 60 : 12).map((c, i) => {
          const { Icon } = visualForCategory(c.slug, c.name);
          const tint = TILE_TINTS[i % TILE_TINTS.length]!;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect("Marketplace")}
              className="flex flex-col items-center gap-2 rounded-[14px] border-slate-200/80 bg-transparent p-0 text-center transition-all active:scale-[0.98] sm:border sm:bg-white sm:p-4 sm:hover:-translate-y-0.5 sm:hover:shadow-[0_12px_30px_-20px_rgba(15,23,42,0.5)]"
            >
              <span
                className={`grid h-14 w-14 shrink-0 place-items-center rounded-full ${tint} sm:h-11 sm:w-11 sm:rounded-[12px]`}
              >
                <Icon className="h-6 w-6 sm:h-5 sm:w-5" />
              </span>
              <span className="min-w-0 max-w-full truncate text-xs font-bold capitalize text-slate-900 sm:text-sm">
                {c.name.trim()}
              </span>
            </button>
          );
        })}
        {shownCategories.length === 0 && <EmptyNote>No categories match.</EmptyNote>}
      </div>
    </>
  );

  const productsBlock = (
    <>
      <SectionHead
        title="Trending right now"
        subtitle="Most reviewed digital products this week"
        icon={TrendingUp}
        action={{ label: "View all", onClick: () => onSelect("Marketplace") }}
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-4">
        {trending.slice(0, tab === "Products" ? 40 : 8).map((p) => (
          <ProductCard key={p.id} product={p} currency={currency} />
        ))}
        {trending.length === 0 && <EmptyNote>Nothing trending yet.</EmptyNote>}
      </div>
    </>
  );

  const sellersBlock = (
    <>
      <SectionHead
        title="Top sellers"
        subtitle="Creators with the most published work"
        icon={Users}
        action={{ label: "View all", onClick: () => navigate({ to: "/sellers" }) }}
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:gap-4">
        {shownSellers.slice(0, tab === "Shops" ? 40 : 6).map((s) => (
          <Link
            key={s.id}
            to="/shop/$id"
            params={{ id: s.slug || s.id }}
            className="flex items-center gap-3 rounded-[14px] border border-slate-200/80 bg-white p-4 transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_30px_-20px_rgba(15,23,42,0.5)]"
          >
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
              <AvatarImage src={s.avatarUrl} alt={s.name} />
            </div>
            <div className="min-w-0">
              <p className="flex items-center gap-1 truncate text-sm font-bold text-slate-900">
                <span className="truncate">{s.name}</span>
                {s.verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-[#2F5FD0]" />}
              </p>
              <p className="truncate text-xs text-slate-500">
                {s.productsCount} product{s.productsCount === 1 ? "" : "s"}
              </p>
              <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600">
                <Star className="h-3 w-3 fill-[#F5A524] text-[#F5A524]" />
                {s.rating ? s.rating.toFixed(1) : "New"}
              </p>
            </div>
          </Link>
        ))}
        {shownSellers.length === 0 && <EmptyNote>No sellers match.</EmptyNote>}
      </div>
    </>
  );

  const freshBlock = (
    <>
      <SectionHead
        title="Fresh in the market"
        subtitle="Newly published digital assets"
        icon={Sparkles}
        action={{ label: "View all", onClick: () => onSelect("Marketplace") }}
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-4">
        {newArrivals.slice(0, tab === "Products" ? 40 : 8).map((p) => (
          <ProductCard key={p.id} product={p} currency={currency} />
        ))}
        {newArrivals.length === 0 && <EmptyNote>No new listings yet.</EmptyNote>}
      </div>
    </>
  );

  const peopleBlock = (
    <>
      <SectionHead title="People on Oventric" subtitle="Members earning their stars" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4">
        {peers.slice(0, tab === "People" ? 40 : 8).map((p) => (
          <Link
            key={p.id}
            to="/profile/$id"
            params={{ id: p.slug }}
            className="flex flex-col items-center gap-2 rounded-[14px] border border-slate-200/80 bg-white p-5 text-center transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_30px_-20px_rgba(15,23,42,0.5)]"
          >
            <div className="h-16 w-16 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
              <AvatarImage src={p.avatarUrl} alt={p.name} />
            </div>
            <p className="max-w-full truncate text-sm font-bold text-slate-900">{p.name}</p>
            <p className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600">
              <Star className="h-3 w-3 fill-[#F5A524] text-[#F5A524]" />
              {p.stars.toFixed(1)}
            </p>
          </Link>
        ))}
        {peers.length === 0 && <EmptyNote>No people match.</EmptyNote>}
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#F7F8FA]">
      <div className="mx-auto w-full max-w-[1280px] px-4 pb-16 pt-5 sm:px-6 lg:pt-8">
        {/* ------------------------------------------------------------ hero */}
        <section className="relative isolate overflow-hidden rounded-[18px] border border-slate-200/80 px-5 py-10 sm:px-8 sm:py-14 lg:px-12 lg:py-20">
          <img
            src={exploreHeroBg}
            alt=""
            className="absolute inset-0 -z-20 h-full w-full object-cover"
            width={1536}
            height={640}
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#0B0C0F]/95 via-[#0B0C0F]/75 to-[#0B0C0F]/40" />
          <div className="relative">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white/90 backdrop-blur-sm">
              <Compass className="h-3.5 w-3.5" /> Explore
            </span>
            <h1 className="mt-4 max-w-[18ch] font-[Outfit] text-[30px] font-extrabold leading-[1.08] text-white sm:text-4xl lg:text-[52px]">
              Discover creators, shops and digital products
            </h1>
            <p className="mt-3 max-w-[60ch] text-sm leading-relaxed text-white/80 sm:text-base">
              Browse what people are buying on Oventric right now — trending downloads, fresh
              listings, top-rated sellers and the people building alongside you.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => onSelect("Marketplace")}
                className="inline-flex items-center gap-2 rounded-full bg-crimson px-5 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
              >
                Browse marketplace <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => navigate({ to: "/sellers" })}
                className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/5 px-5 py-2.5 text-sm font-bold text-white backdrop-blur-sm transition-colors hover:bg-white/10"
              >
                See all sellers
              </button>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------- tabs + search */}
        <div className="sticky top-14 z-20 -mx-4 mt-5 border-b border-slate-200/80 bg-[#F7F8FA]/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
            <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {TABS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition-colors sm:text-sm ${
                    tab === t
                      ? "bg-slate-900 text-white"
                      : "border border-slate-200 bg-white text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={`Search ${tab === "All" ? "Oventric" : tab.toLowerCase()}…`}
                className="h-10 w-full rounded-full border border-slate-200 bg-white pl-9 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-crimson/50 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* ------------------------------------------ content + community */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-8">
          <div className="min-w-0">
            {show("Categories") && categoriesBlock}
            {show("Products") && productsBlock}
            {show("Shops") && sellersBlock}
            {show("Products") && freshBlock}
            {show("People") && peopleBlock}
          </div>

          <aside className="min-w-0 lg:pt-10">
            <h2 className="mb-3 font-[Outfit] text-lg font-extrabold text-slate-900">
              Community
            </h2>
            <DiscoveryPanel asPage />
          </aside>
        </div>
      </div>
    </div>
  );
}

function SectionHead({
  title,
  subtitle,
  icon: Icon,
  action,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="mb-4 mt-10 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 lg:mt-14">
      <div className="min-w-0">
        <h2 className="flex min-w-0 items-center gap-2 font-[Outfit] text-xl font-extrabold text-slate-900 sm:text-2xl">
          {Icon && <Icon className="h-5 w-5 shrink-0 text-crimson" />}
          <span className="truncate">{title}</span>
        </h2>
        {subtitle && <p className="mt-1 text-xs text-slate-500 sm:text-sm">{subtitle}</p>}
      </div>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-crimson transition-opacity hover:opacity-80 sm:text-sm"
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
    <p className="col-span-full rounded-[14px] border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-400">
      {children}
    </p>
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
    <div className="group flex flex-col overflow-hidden rounded-[14px] border border-slate-200/80 bg-white transition-all hover:-translate-y-0.5 hover:shadow-[0_16px_36px_-24px_rgba(15,23,42,0.6)]">
      <Link
        to="/product/$id"
        params={{ id: product.id }}
        className="relative block aspect-[4/3] w-full overflow-hidden bg-slate-100"
      >
        {product.coverUrl ? (
          <img
            src={product.coverUrl}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <Link to="/product/$id" params={{ id: product.id }} className="min-w-0">
          <h3 className="line-clamp-2 text-[13px] font-bold leading-snug text-slate-900 transition-colors group-hover:text-crimson">
            {product.name}
          </h3>
        </Link>
        <p className="truncate text-[11px] text-slate-500">{product.vendor}</p>
        <p className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600">
          <Star className="h-3 w-3 fill-[#F5A524] text-[#F5A524]" />
          {product.rating ? product.rating.toFixed(1) : "New"}
          {product.reviews ? (
            <span className="font-normal text-slate-400">({product.reviews})</span>
          ) : null}
        </p>
        <p className="mt-auto pt-1 text-sm font-extrabold text-slate-900">{price}</p>
      </div>
    </div>
  );
}
