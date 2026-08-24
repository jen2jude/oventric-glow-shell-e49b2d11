import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, Search, ShoppingBag, Star } from "lucide-react";
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
    loadSellers({ data: { kind: "all" } })
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

  return (
    <PublicChrome lightDesktop>
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 md:py-12">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-crimson/30 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-crimson">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-crimson" />
          Live right now
        </span>
        <h1 className="mt-3 text-[26px] font-bold tracking-tight text-white md:text-[34px] md:text-slate-900">
          Top Sellers
        </h1>
        <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-slate-400 md:text-[15px] md:text-slate-600">
          Every seller on Oventric, ranked by live sales, ratings and followers. Tap any seller to open
          their storefront.
        </p>

        <div className="relative mt-6 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sellers"
            aria-label="Search sellers"
            className="h-11 w-full rounded-[10px] border border-white/10 bg-white/[0.04] pl-9 pr-3 text-[14px] text-white placeholder:text-slate-500 outline-none focus:border-crimson/50 md:border-slate-200 md:bg-white md:text-slate-800 md:placeholder:text-slate-400"
          />
        </div>

        {loading ? (
          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-[112px] animate-pulse rounded-[10px] border border-white/[0.06] bg-white/[0.03] md:border-slate-200 md:bg-slate-100"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="mt-10 text-[14px] text-slate-400 md:text-slate-500">No sellers found.</p>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((s, i) => (
              <Link
                key={s.id}
                to="/shop/$id"
                params={{ id: s.slug || s.id }}
                className="group rounded-[10px] border border-white/[0.06] bg-[#141416] p-4 transition-transform hover:-translate-y-0.5 active:scale-[0.99] md:border-slate-200 md:bg-white"
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="h-12 w-12 overflow-hidden rounded-full border border-white/10 md:border-slate-200">
                      <AvatarImage src={s.avatarUrl} alt={s.name} />
                    </div>
                    {!query.trim() && (
                      <span className="absolute -left-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-crimson text-[10px] font-black text-white">
                        {i + 1}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1 truncate text-[14px] font-bold text-white md:text-slate-900">
                      <span className="truncate">{s.name}</span>
                      {s.verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-crimson" />}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400 md:text-slate-500">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      {s.rating ? s.rating.toFixed(1) : "New"} · {compact(s.followersCount)} followers
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-3 text-[11px] font-semibold text-slate-400 md:text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <ShoppingBag className="h-3.5 w-3.5" /> {compact(s.salesCount)} sales
                  </span>
                  <span>{compact(s.productsCount)} listings</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </PublicChrome>
  );
}
