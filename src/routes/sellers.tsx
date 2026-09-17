import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUpRight, BadgeCheck, Search, ShoppingBag, Star, Store, Trophy, Users } from "lucide-react";
import { PublicChrome } from "@/components/oventric/PublicChrome";
import { AvatarImage } from "@/components/oventric/AvatarImage";
import { getTopSellers } from "@/lib/marketplace.functions";

type Seller = {
  id: string;
  name: string;
  slug: string;
  avatarUrl: string | null;
  verified: boolean;
  rating: number;
  followersCount: number;
  productsCount: number;
  salesCount: number;
};

const compact = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K` : String(n);

export const Route = createFileRoute("/sellers")({
  head: () => ({
    meta: [
      { title: "Top Sellers on Oventric — Browse every verified seller" },
      {
        name: "description",
        content:
          "Discover every seller on Oventric, ranked by live sales, ratings and followers. Open any storefront to browse their products and services.",
      },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "Top Sellers on Oventric" },
      {
        property: "og:description",
        content: "Browse all Oventric sellers ranked by live sales, ratings and followers.",
      },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://oventric.com/sellers" }],
  }),
  component: SellersPage,
});

function SellersPage() {
  const loadSellers = useServerFn(getTopSellers);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    loadSellers()
      .then((rows) => {
        if (cancelled) return;
        setSellers(
          [...((rows ?? []) as Seller[])].sort(
            (a, b) => b.salesCount - a.salesCount || b.followersCount - a.followersCount,
          ),
        );
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadSellers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sellers;
    return sellers.filter((s) => s.name.toLowerCase().includes(q) || s.slug?.toLowerCase().includes(q));
  }, [sellers, query]);

  const leaders = sellers.slice(0, 3);

  return (
    <PublicChrome lightDesktop>
      <main className="web-sellers min-h-screen bg-background text-foreground">
        <section className="border-b border-border bg-card">
          <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 sm:px-6 md:py-14 lg:grid-cols-[1fr_25rem] lg:items-end lg:px-8">
            <div>
              <span className="inline-flex items-center gap-2 text-xs font-extrabold uppercase text-primary">
                <Trophy className="h-4 w-4" /> Seller leaderboard
              </span>
              <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-tight sm:text-5xl">
                Meet Oventric’s top digital sellers
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                Discover every seller, ranked using live sales, ratings and followers. Open a storefront to explore their digital products.
              </p>
            </div>
            <label className="relative block">
              <span className="sr-only">Search sellers</span>
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by seller name"
                aria-label="Search sellers"
                className="h-13 w-full rounded-[10px] border border-input bg-background pl-12 pr-4 text-sm text-foreground outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/10"
              />
            </label>
          </div>
        </section>

        <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 md:py-14 lg:px-8">
          {loading ? (
            <div className="space-y-12" aria-label="Loading sellers">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-72 animate-pulse rounded-[10px] border border-border bg-card" />
                ))}
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-44 animate-pulse rounded-[10px] border border-border bg-card" />
                ))}
              </div>
            </div>
          ) : sellers.length === 0 ? (
            <div className="py-24 text-center">
              <Store className="mx-auto h-10 w-10 text-muted-foreground" />
              <h2 className="mt-4 text-xl font-bold">No sellers yet</h2>
              <p className="mt-2 text-sm text-muted-foreground">Seller storefronts will appear here when they go live.</p>
            </div>
          ) : (
            <>
              <section aria-labelledby="leaderboard-heading">
                <div className="mb-6 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs font-extrabold uppercase text-primary">Leading the marketplace</p>
                    <h2 id="leaderboard-heading" className="mt-2 text-2xl font-bold sm:text-3xl">The top three</h2>
                  </div>
                  <p className="hidden text-sm text-muted-foreground sm:block">Ranked by live marketplace activity</p>
                </div>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                  {leaders.map((seller, index) => (
                    <Link
                      key={seller.id}
                      to="/shop/$id"
                      params={{ id: seller.slug || seller.id }}
                      className="seller-leader group relative flex min-h-72 flex-col rounded-[10px] border border-border bg-card p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg"
                    >
                      <span className="absolute right-5 top-5 grid h-10 w-10 place-items-center rounded-full border-4 border-card bg-primary text-sm font-extrabold text-primary-foreground shadow-md">
                        {index + 1}
                      </span>
                      <div className="h-20 w-20 overflow-hidden rounded-[10px] border border-border bg-muted">
                        <AvatarImage src={seller.avatarUrl} alt={seller.name} />
                      </div>
                      <div className="mt-5 min-w-0 pr-12">
                        <div className="flex items-center gap-1.5">
                          <h3 className="truncate text-xl font-bold">{seller.name}</h3>
                          {seller.verified && <BadgeCheck className="h-5 w-5 shrink-0 text-primary" aria-label="Verified seller" />}
                        </div>
                        <div className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Star className="h-4 w-4 fill-current text-warning" />
                          <span className="font-bold text-foreground">{seller.rating ? seller.rating.toFixed(1) : "New"}</span>
                          <span>· {compact(seller.followersCount)} followers</span>
                        </div>
                      </div>
                      <div className="mt-auto grid grid-cols-2 border-t border-border pt-5 text-sm">
                        <div>
                          <p className="font-bold text-foreground">{compact(seller.salesCount)}</p>
                          <p className="text-xs text-muted-foreground">Sales</p>
                        </div>
                        <div>
                          <p className="font-bold text-foreground">{compact(seller.productsCount)}</p>
                          <p className="text-xs text-muted-foreground">Digital listings</p>
                        </div>
                      </div>
                      <span className="mt-5 flex min-h-11 items-center justify-between rounded-[10px] border border-border bg-muted px-4 text-sm font-bold transition group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground">
                        Visit storefront <ArrowUpRight className="h-4 w-4" />
                      </span>
                    </Link>
                  ))}
                </div>
              </section>

              <section className="mt-16" aria-labelledby="all-sellers-heading">
                <div className="mb-6 flex items-end justify-between gap-4 border-b border-border pb-5">
                  <div>
                    <p className="text-xs font-extrabold uppercase text-primary">Seller directory</p>
                    <h2 id="all-sellers-heading" className="mt-2 text-2xl font-bold sm:text-3xl">All sellers</h2>
                  </div>
                  <span className="text-sm font-semibold text-muted-foreground">{filtered.length} {filtered.length === 1 ? "seller" : "sellers"}</span>
                </div>

                {filtered.length === 0 ? (
                  <div className="rounded-[10px] border border-dashed border-border bg-card px-6 py-16 text-center">
                    <Search className="mx-auto h-8 w-8 text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-bold">No matching sellers</h3>
                    <p className="mt-2 text-sm text-muted-foreground">Try another name or clear your search.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filtered.map((seller) => {
                      const rank = sellers.findIndex((item) => item.id === seller.id) + 1;
                      return (
                        <Link
                          key={seller.id}
                          to="/shop/$id"
                          params={{ id: seller.slug || seller.id }}
                          className="group flex min-h-44 flex-col rounded-[10px] border border-border bg-card p-5 transition duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
                        >
                          <div className="flex items-start gap-4">
                            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-[10px] border border-border bg-muted">
                              <AvatarImage src={seller.avatarUrl} alt={seller.name} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <h3 className="truncate text-base font-bold">{seller.name}</h3>
                                {seller.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-primary" aria-label="Verified seller" />}
                              </div>
                              <p className="mt-1 text-xs font-bold uppercase text-muted-foreground">Rank #{rank}</p>
                            </div>
                            <ArrowUpRight className="h-5 w-5 shrink-0 text-muted-foreground transition group-hover:text-primary" />
                          </div>
                          <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-4 text-xs font-semibold text-muted-foreground">
                            <span className="inline-flex items-center gap-1.5"><Star className="h-3.5 w-3.5 text-warning" /> {seller.rating ? seller.rating.toFixed(1) : "New"}</span>
                            <span className="inline-flex items-center gap-1.5"><ShoppingBag className="h-3.5 w-3.5" /> {compact(seller.salesCount)} sales</span>
                            <span className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> {compact(seller.followersCount)}</span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </main>
    </PublicChrome>
  );
}
