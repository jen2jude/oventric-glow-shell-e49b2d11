import { useEffect, useState } from "react";
import { useIsAppShell } from "@/hooks/use-launch-context";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import {
  GraduationCap,
  ShoppingBag,
  Target,
  Users,
  Newspaper,
  Sparkles,
  ArrowRight,
  Flame,
  Clock,
} from "lucide-react";
import {
  getAcademyRecommendations,
  type AcademyRecommendations as RecoDTO,
  type RecoCourse,
  type RecoCircle,
  type RecoBlog,
  type DiscoveryProduct,
  type DiscoveryBounty,
  type DiscoveryAd,
} from "@/lib/discovery.functions";
import { ResponsiveImage } from "@/components/ui/responsive-image";
import { useOnboarding, type Currency } from "@/lib/onboarding/OnboardingContext";
import { computeDisplayPrice } from "@/lib/fx-display";

function fmtPrice(usd: number, viewer: Currency): string {
  if (!usd) return "Free";
  return computeDisplayPrice(
    { price_usd: usd, original_currency: "USD", original_amount: usd, fx_snapshot: null },
    viewer,
  ).formatted;
}

function SectionHeader({ icon: Icon, title, hint, isAppShell }: { icon: any; title: string; hint?: string; isAppShell: boolean }) {
  if (isAppShell) {
    return (
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-white text-lg">{title}</h3>
        <button className="text-[#E5484D] text-xs font-bold">View All</button>
      </div>
    );
  }
  return (
    <div className="flex items-end justify-between mb-3 px-1 gap-2">
      <div className="min-w-0">
        {!isAppShell && <div className="web-eyebrow mb-2">{hint || "Discover"}</div>}
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="w-5 h-5 text-crimson shrink-0" strokeWidth={2.5} />
          <h3 className={`font-black text-lg tracking-tight truncate ${!isAppShell ? "text-slate-900 web-accent-underline inline-block" : "text-white md:text-slate-900"}`}>{title}</h3>
        </div>
      </div>
    </div>
  );
}

function CourseTile({
  c,
  currency,
  onOpen,
  isAppShell,
}: {
  c: RecoCourse;
  currency: Currency;
  onOpen: (id: string) => void;
  isAppShell: boolean;
}) {
  if (isAppShell) {
    return (
      <div className="bg-[#141416] rounded-xl border border-white/5 shadow-lg overflow-hidden flex flex-col">
        <button onClick={() => onOpen(c.id)} className="block w-full text-left relative aspect-video bg-[#0A0A0B]">
          {c.coverUrl ? (
            <ResponsiveImage
              src={c.coverUrl}
              alt={c.title}
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <GraduationCap className="w-8 h-8 text-white/10" />
            </div>
          )}
          <div className="absolute top-2 left-2 bg-[#E5484D] text-white text-[8px] font-bold px-1.5 py-0.5 rounded uppercase">
            {c.category}
          </div>
        </button>
        <div className="p-3 flex-1 flex flex-col justify-between">
          <div>
            <h4 className="font-bold text-white text-[13px] line-clamp-2 leading-tight mb-2">
              {c.title}
            </h4>
          </div>
          <div className="flex items-center justify-between mt-auto">
            <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold">
              <Clock className="w-3 h-3 text-slate-500" /> 6-9 Hours
            </div>
            <div className="text-[10px] text-emerald-400 font-black uppercase">
              {c.isFree ? "Free" : fmtPrice(c.priceUsd, currency)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => onOpen(c.id)}
      className={`text-left overflow-hidden transition-colors group ${!isAppShell ? "web-card" : "border rounded-xl bg-[#1A1A1C] border-white/5 hover:border-[#E5484D]/40"}`}
    >
      <div className="relative aspect-video bg-[#0A0A0B]">
        {c.coverUrl ? (
          <ResponsiveImage
            src={c.coverUrl}
            alt={c.title}
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
            decoding="async"
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <GraduationCap className="w-10 h-10 text-white/30" />
          </div>
        )}
        <span className="absolute top-2 left-2 text-[10px] font-bold bg-black/60 text-white border border-white/20 rounded px-2 py-0.5 uppercase tracking-wider">
          {c.category}
        </span>
        <span className="absolute top-2 right-2 text-[10px] font-bold bg-[#E5484D] text-white rounded px-2 py-0.5">
          {c.isFree ? "Free" : fmtPrice(c.priceUsd, currency)}
        </span>
      </div>
      <div className="p-3">
        <h4 className={`font-bold text-sm line-clamp-2 leading-snug ${!isAppShell ? "text-slate-900" : "text-white"}`}>{c.title}</h4>
        <div className={`mt-1.5 flex items-center gap-2 text-[11px] ${!isAppShell ? "text-slate-500" : "text-slate-500"}`}>
          <Flame className="w-3 h-3 text-amber-400" />
          <span>{c.enrollments} enrolled</span>
        </div>
      </div>
    </button>
  );
}

function ProductTile({ p, currency, isAppShell }: { p: DiscoveryProduct; currency: Currency; isAppShell: boolean }) {
  if (isAppShell) {
    return (
      <Link
        to="/product/$id"
        params={{ id: p.id }}
        className="bg-[#141416] rounded-xl border border-white/5 shadow-lg overflow-hidden flex flex-col"
      >
        <div className="relative aspect-square bg-[#0A0A0B]">
          {p.coverUrl ? (
            <ResponsiveImage
              src={p.coverUrl}
              alt={p.title}
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <ShoppingBag className="w-8 h-8 text-white/10" />
            </div>
          )}
        </div>
        <div className="p-3 flex-1 flex flex-col justify-between">
          <h4 className="font-bold text-white text-[13px] line-clamp-2 leading-tight mb-2">{p.title}</h4>
          <div className="text-[12px] font-black text-[#E5484D]">{fmtPrice(p.priceUsd, currency)}</div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      to="/product/$id"
      params={{ id: p.id }}
      className={`text-left border rounded-xl overflow-hidden transition-colors block ${!isAppShell ? "bg-white border-slate-200 hover:border-[#E5484D]/30 shadow-sm" : "bg-[#1A1A1C] border-white/5 hover:border-[#E5484D]/40"}`}
    >
      <div className={`relative aspect-video bg-gradient-to-br ${p.hue}`}>
        {p.coverUrl ? (
          <ResponsiveImage
            src={p.coverUrl}
            alt={p.title}
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
            decoding="async"
            sizes="(min-width: 1024px) 25vw, 50vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <ShoppingBag className="w-8 h-8 text-white/40" />
          </div>
        )}
        <span className="absolute top-2 right-2 text-[11px] font-bold bg-black/60 text-white border border-white/20 rounded px-2 py-0.5">
          {fmtPrice(p.priceUsd, currency)}
        </span>
      </div>
      <div className="p-3">
        <h4 className={`font-bold text-sm line-clamp-2 leading-snug ${!isAppShell ? "text-slate-900" : "text-white"}`}>{p.title}</h4>
        <div className={`text-[11px] mt-1 truncate ${!isAppShell ? "text-slate-500" : "text-slate-500"}`}>{p.vendor || p.category}</div>
      </div>
    </Link>
  );
}

function BountyTile({ b, currency, isAppShell }: { b: DiscoveryBounty; currency: Currency; isAppShell: boolean }) {
  const open = () => {
    window.dispatchEvent(new CustomEvent("oventric:navigate", { detail: { section: "Bounties" } }));
    // give Bounties a tick to mount, then open the detail view
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent("oventric:bounty:open-detail", { detail: { id: b.id } }),
      );
    }, 60);
  };
  return (
    <button
      onClick={open}
      className={`text-left border rounded-xl overflow-hidden transition-colors block w-full ${!isAppShell ? "bg-white border-slate-200 hover:border-[#E5484D]/30 shadow-sm" : "bg-[#1A1A1C] border-white/5 hover:border-[#E5484D]/40"}`}
    >
      <div className="relative aspect-video bg-gradient-to-br from-amber-500/30 to-rose-600/30">
        {b.coverUrl ? (
          <ResponsiveImage
            src={b.coverUrl}
            alt={b.title}
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
            decoding="async"
            sizes="(min-width: 1024px) 25vw, 50vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Target className="w-8 h-8 text-white/40" />
          </div>
        )}
        <span className="absolute top-2 right-2 text-[11px] font-bold bg-black/70 text-amber-300 border border-amber-400/40 rounded px-2 py-0.5">
          {fmtPrice(b.amountUsd, currency)}
        </span>
      </div>
      <div className="p-3">
        <h4 className={`font-bold text-sm line-clamp-2 leading-snug ${!isAppShell ? "text-slate-900" : "text-white"}`}>{b.title}</h4>
        {b.category && (
          <div className="text-[11px] text-slate-500 mt-1 uppercase tracking-wider">
            {b.category}
          </div>
        )}
      </div>
    </button>
  );
}

function CircleTile({ c, isAppShell }: { c: RecoCircle; isAppShell: boolean }) {
  const open = () => {
    window.dispatchEvent(new CustomEvent("oventric:navigate", { detail: { section: "Circles" } }));
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent("oventric:circle:open-slug", { detail: { slug: c.slug } }),
      );
    }, 60);
  };
  return (
    <button
      onClick={open}
      className={`text-left border rounded-xl overflow-hidden transition-colors block w-full ${!isAppShell ? "bg-white border-slate-200 hover:border-[#E5484D]/30 shadow-sm" : "bg-[#1A1A1C] border-white/5 hover:border-[#E5484D]/40"}`}
    >
      <div className="relative aspect-[3/1] bg-gradient-to-br from-indigo-600/40 to-fuchsia-600/40">
        {c.coverUrl ? (
          <ResponsiveImage
            src={c.coverUrl}
            alt={c.name}
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
            decoding="async"
            sizes="(min-width: 1024px) 33vw, 100vw"
          />
        ) : null}
      </div>
      <div className="p-3 flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 overflow-hidden border ${!isAppShell ? "bg-slate-100 border-slate-200 shadow-inner" : "bg-black/50 border-white/20"}`}>
          {c.avatarUrl ? (
            <img loading="lazy" decoding="async" src={c.avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <span>{c.emoji}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className={`font-bold text-sm truncate ${!isAppShell ? "text-slate-900" : "text-white"}`}>{c.name}</h4>
          <div className="text-[11px] text-slate-500 flex items-center gap-1">
            <Users className="w-3 h-3" /> {c.memberCount} members
          </div>
        </div>
      </div>
    </button>
  );
}

function BlogTile({ b, isAppShell }: { b: RecoBlog; isAppShell: boolean }) {
  return (
    <Link
      to="/blog/$slug"
      params={{ slug: b.slug }}
      className={`text-left border rounded-xl overflow-hidden transition-colors block ${!isAppShell ? "bg-white border-slate-200 hover:border-[#E5484D]/30 shadow-sm" : "bg-[#1A1A1C] border-white/5 hover:border-[#E5484D]/40"}`}
    >
      <div className="relative aspect-video bg-gradient-to-br from-sky-600/30 to-emerald-600/30">
        {b.coverUrl ? (
          <ResponsiveImage
            src={b.coverUrl}
            alt={b.title}
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
            decoding="async"
            sizes="(min-width: 1024px) 33vw, 100vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Newspaper className="w-8 h-8 text-white/40" />
          </div>
        )}
        {b.categoryName && (
          <span className="absolute top-2 left-2 text-[10px] font-bold bg-black/60 text-white border border-white/20 rounded px-2 py-0.5 uppercase tracking-wider">
            {b.categoryName}
          </span>
        )}
      </div>
      <div className="p-3">
        <h4 className={`font-bold text-sm line-clamp-2 leading-snug ${!isAppShell ? "text-slate-900" : "text-white"}`}>{b.title}</h4>
        {b.excerpt && <p className={`text-[12px] line-clamp-2 mt-1 ${!isAppShell ? "text-slate-600" : "text-slate-400"}`}>{b.excerpt}</p>}
      </div>
    </Link>
  );
}

function PromotedStrip({ ads, isAppShell }: { ads: DiscoveryAd[]; isAppShell: boolean }) {
  if (!ads.length) return null;
  return (
    <div className={`my-6 rounded-xl border p-4 ${!isAppShell ? "border-[#E5484D]/10 bg-[#E5484D]/5" : "border-[#E5484D]/20 bg-gradient-to-r from-[#E5484D]/5 via-transparent to-crimson-500/5"}`}>
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className={`w-4 h-4 ${!isAppShell ? "text-[#E5484D]" : "text-[#E5484D]"}`} />
        <span className={`text-[11px] uppercase tracking-wider font-bold ${!isAppShell ? "text-[#E5484D]" : "text-[#E5484D]"}`}>
          Promoted picks
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {ads.map((a) => (
          <a
            key={a.id}
            href={a.ctaUrl}
            target="_blank"
            rel="noreferrer"
            className={`flex gap-3 items-center border rounded-[10px] p-3 transition-colors ${!isAppShell ? "bg-white border-slate-200 hover:border-[#E5484D]/30 shadow-sm" : "bg-[#1A1A1C] border-white/5 hover:border-[#E5484D]/40"}`}
          >
            {a.coverUrl ? (
              <img loading="lazy" decoding="async"
                src={a.coverUrl}
                alt=""
                className="w-16 h-16 rounded-[10px] object-cover shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-[10px] bg-gradient-to-br from-emerald-500/40 to-indigo-600/40 shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">
                {a.advertiser}
              </div>
              <div className={`font-bold text-sm truncate ${!isAppShell ? "text-slate-900" : "text-white"}`}>{a.title}</div>
              {a.body && <div className={`text-[12px] line-clamp-1 ${!isAppShell ? "text-slate-600" : "text-slate-400"}`}>{a.body}</div>}
            </div>
            <ArrowRight className="w-4 h-4 text-[#E5484D] shrink-0" />
          </a>
        ))}
      </div>
    </div>
  );
}

export function AcademyRecommendations({ onOpenCourse }: { onOpenCourse: (id: string) => void }) {
  const isAppShell = useIsAppShell();
  const fetchReco = useServerFn(getAcademyRecommendations);
  const { baseCurrency } = useOnboarding();
  const [data, setData] = useState<RecoDTO | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchReco()
      .then(setData)
      .catch((e) => setError(e?.message ?? "Failed to load"));
  }, [fetchReco]);

  if (error) return null;
  if (!data) {
    return (
      <section className={`mt-12 border-t pt-8 ${!isAppShell ? "border-slate-200" : "border-white/10"}`}>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className={`border rounded-xl overflow-hidden animate-pulse ${!isAppShell ? "bg-white border-slate-200" : "bg-[#1E1E24] border-white/10"}`}
            >
              <div className={`aspect-video ${!isAppShell ? "bg-slate-100" : "bg-white/5"}`} />
              <div className="p-3 space-y-2">
                <div className={`h-3 rounded w-3/4 ${!isAppShell ? "bg-slate-200" : "bg-white/10"}`} />
                <div className={`h-3 rounded w-1/2 ${!isAppShell ? "bg-slate-100" : "bg-white/5"}`} />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  const halfAds = Math.ceil(data.promoted.length / 2);
  const adsA = data.promoted.slice(0, halfAds);
  const adsB = data.promoted.slice(halfAds);
  const blogA = data.blog.slice(0, 3);
  const blogB = data.blog.slice(3, 6);

  return (
    <section className={`mt-12 space-y-10 ${!isAppShell ? "border-t pt-8 border-slate-200" : "px-0 pb-20"}`}>
      {/* Recommended courses */}
      {data.courses.length > 0 && (
        <div>
          <SectionHeader icon={GraduationCap} title="Recommended courses" hint="Most enrolled" isAppShell={isAppShell} />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {data.courses.map((c) => (
              <CourseTile key={c.id} c={c} currency={baseCurrency} onOpen={onOpenCourse} isAppShell={isAppShell} />
            ))}
          </div>
        </div>
      )}

      {/* Blog news #1 */}
      {blogA.length > 0 && (
        <div>
          <SectionHeader icon={Newspaper} title="From the blog" hint="Latest" isAppShell={isAppShell} />
          <div className="flex md:grid gap-3 md:grid-cols-3 overflow-x-auto md:overflow-visible snap-x snap-mandatory -mx-4 px-4 md:mx-0 md:px-0 pb-2 md:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {blogA.map((b) => (
              <div key={b.id} className="shrink-0 w-[80%] sm:w-[60%] md:w-auto snap-start">
                <BlogTile b={b} isAppShell={isAppShell} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Promoted A */}
      <PromotedStrip ads={adsA} isAppShell={isAppShell} />

      {/* Recommended products */}
      {data.products.length > 0 && (
        <div>
          <SectionHeader
            icon={ShoppingBag}
            title="Recommended products"
            hint="Digital products"
            isAppShell={isAppShell}
          />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {data.products.map((p) => (
              <ProductTile key={p.id} p={p} currency={baseCurrency} isAppShell={isAppShell} />
            ))}
          </div>
        </div>
      )}

      {/* Top bounties */}
      {data.bounties.length > 0 && (
        <div>
          <SectionHeader icon={Target} title="Top bounties" hint="Highest reward" isAppShell={isAppShell} />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {data.bounties.map((b) => (
              <BountyTile key={b.id} b={b} currency={baseCurrency} isAppShell={isAppShell} />
            ))}
          </div>
        </div>
      )}

      {/* Blog news #2 */}
      {blogB.length > 0 && (
        <div>
          <SectionHeader icon={Newspaper} title="More reads" isAppShell={isAppShell} />
          <div className="flex md:grid gap-3 md:grid-cols-3 overflow-x-auto md:overflow-visible snap-x snap-mandatory -mx-4 px-4 md:mx-0 md:px-0 pb-2 md:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {blogB.map((b) => (
              <div key={b.id} className="shrink-0 w-[80%] sm:w-[60%] md:w-auto snap-start">
                <BlogTile b={b} isAppShell={isAppShell} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Promoted B */}
      <PromotedStrip ads={adsB} isAppShell={isAppShell} />

      {/* Top circles */}
      {data.circles.length > 0 && (
        <div>
          <SectionHeader icon={Users} title="Top circles" hint="Join the movement" isAppShell={isAppShell} />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.circles.map((c) => (
              <CircleTile key={c.id} c={c} isAppShell={isAppShell} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
