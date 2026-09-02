import { Link } from "@tanstack/react-router";
import { ChevronRight, ShoppingBag, Star } from "lucide-react";
import type { ProfileListing } from "@/lib/profiles/mockProfiles";

const ACCENT = "#E5484D";

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#141417] px-3 py-4 text-center md:rounded-[10px] md:border-slate-200 md:bg-slate-50">
      <div className="text-xl font-black text-white md:text-slate-900">{value}</div>
      <div className="mt-1 text-[11px] font-semibold text-slate-400 md:text-slate-500">{label}</div>
    </div>
  );
}

function SectionHead({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="mt-7 flex items-center justify-between">
      <h3 className="text-base font-black text-white md:text-slate-900">{title}</h3>
      {action}
    </div>
  );
}

function Cover({
  url,
  className,
}: {
  url?: string | null;
  className?: string;
}) {
  return (
    <div className={`overflow-hidden rounded-xl bg-[#1C1C21] md:bg-slate-100 ${className ?? ""}`}>
      {url ? (
        <img loading="lazy" decoding="async" src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="grid h-full w-full place-items-center">
          <ShoppingBag className="h-6 w-6 text-white/25 md:text-slate-400" />
        </div>
      )}
    </div>
  );
}

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}K`;
  return String(n);
}

/**
 * Shop tab for the identity hub — "My Shop" stats, featured rows and the
 * full product grid, with a link out to the seller's full shop page.
 */
export function ProfileShopTab({
  items,
  total,
  isOwner,
  price,
  shopSlug,
}: {
  items: ProfileListing[];
  total: number;
  isOwner: boolean;
  price: (usd: number) => string;
  shopSlug: string;
}) {
  const sales = items.reduce((s, i) => s + (i.sales ?? 0), 0);
  const rated = items.filter((i) => (i.rating ?? 0) > 0);
  const rating = rated.length
    ? (rated.reduce((s, i) => s + (i.rating ?? 0), 0) / rated.length).toFixed(1)
    : "—";

  const featured = items.slice(0, 3);
  const all = items;

  const viewShop = (
    <Link
      to="/shop/$id"
      params={{ id: shopSlug }}
      className="inline-flex items-center gap-1 text-sm font-bold"
      style={{ color: ACCENT }}
    >
      View Shop <ChevronRight className="h-4 w-4" strokeWidth={3} />
    </Link>
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black text-white md:text-slate-900">
          {isOwner ? "My Shop" : "Shop"}
        </h2>
        {viewShop}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3">
        <StatCard value={compact(total)} label="Products" />
        <StatCard value={compact(sales)} label="Sales" />
        <StatCard value={rating} label="Rating" />
      </div>

      {featured.length > 0 && (
        <>
          <SectionHead title="Featured Products" action={viewShop} />
          <div className="mt-3 space-y-3">
            {featured.map((p) => (
              <Link
                key={p.id}
                to="/product/$id"
                params={{ id: p.id }}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#141417] p-3 transition-colors hover:bg-[#1A1A1F] md:rounded-[10px] md:border-slate-200 md:bg-slate-50 md:hover:border-[#E5484D]/30 md:hover:bg-white"
              >
                <Cover url={p.coverUrl} className="h-16 w-16 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-white md:text-slate-900">
                    {p.title}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-slate-400 md:text-slate-500">
                    {p.blurb?.trim() || p.category}
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-3">
                    <span className="text-sm font-black text-white md:text-slate-900">
                      {price(p.priceUsd)}
                    </span>
                    {(p.rating ?? 0) > 0 && (
                      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-amber-400">
                        <Star className="h-3.5 w-3.5 fill-amber-400" strokeWidth={0} />
                        {(p.rating ?? 0).toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      <SectionHead title="All Products" action={viewShop} />
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {all.map((p) => (
          <Link
            key={p.id}
            to="/product/$id"
            params={{ id: p.id }}
            className="group overflow-hidden rounded-2xl border border-white/10 bg-[#141417] transition-transform hover:-translate-y-0.5 md:rounded-[10px] md:border-slate-200 md:bg-slate-50 md:hover:border-[#E5484D]/30 md:hover:bg-white md:hover:shadow-sm"
          >
            <Cover url={p.coverUrl} className="aspect-square w-full rounded-none" />
            <div className="p-2">
              <div className="line-clamp-2 text-[11px] font-bold leading-snug text-white md:text-slate-900">
                {p.title}
              </div>
              <div className="mt-1 text-[11px] font-black" style={{ color: ACCENT }}>
                {price(p.priceUsd)}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
