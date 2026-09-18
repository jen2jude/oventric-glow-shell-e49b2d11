import { Link } from "@tanstack/react-router";
import { ShoppingBag, Trophy, GraduationCap } from "lucide-react";
import { navigateSection } from "@/components/oventric/DiscoveryPanel";
import { useFeedDiscovery } from "@/components/oventric/feed/useFeedDiscovery";
import { useOnboarding, type Currency } from "@/lib/onboarding/OnboardingContext";
import { computeDisplayPrice } from "@/lib/fx-display";

function fmtUsd(usd: number, viewer: Currency): string {
  return computeDisplayPrice(
    { price_usd: usd, original_currency: "USD", original_amount: usd, fx_snapshot: null },
    viewer,
  ).formatted;
}

type CommerceItem =
  | { kind: "product"; id: string; title: string; sub: string; priceLabel: string; coverUrl: string | null; hue: string }
  | { kind: "bounty"; id: string; title: string; sub: string; priceLabel: string; coverUrl: string | null }
  | { kind: "course"; id: string; title: string; sub: string; priceLabel: string; coverUrl: string | null };

const META = {
  product: { icon: ShoppingBag, label: "Marketplace", cta: "View product" },
  bounty: { icon: Trophy, label: "Bounty", cta: "Solve & earn" },
  course: { icon: GraduationCap, label: "Academy", cta: "Start learning" },
} as const;

/**
 * Interleaved commerce cards for the "For you" feed — a product, bounty or
 * course surfaced between posts so discovery lives inside the scroll.
 */
export function useFeedCommerceCards(enabled: boolean): CommerceItem[] {
  const { products, bounties, courses } = useFeedDiscovery(enabled);
  const { baseCurrency } = useOnboarding();
  const out: CommerceItem[] = [];
  const max = Math.max(products.length, bounties.length, courses.length);
  for (let i = 0; i < max; i++) {
    const p = products[i];
    if (p)
      out.push({
        kind: "product",
        id: p.id,
        title: p.title,
        sub: `${p.category} · ${p.vendor}`,
        priceLabel: fmtUsd(p.priceUsd, baseCurrency),
        coverUrl: p.coverUrl,
        hue: p.hue,
      });
    const b = bounties[i];
    if (b)
      out.push({
        kind: "bounty",
        id: b.id,
        title: b.title,
        sub: b.category ?? "Open bounty",
        priceLabel: fmtUsd(b.amountUsd, baseCurrency),
        coverUrl: b.coverUrl,
      });
    const c = courses[i];
    if (c)
      out.push({
        kind: "course",
        id: c.id,
        title: c.title,
        sub: c.instructor ? `By ${c.instructor}` : c.category,
        priceLabel: c.isFree ? "Free" : fmtUsd(c.priceUsd, baseCurrency),
        coverUrl: c.coverUrl,
      });
  }
  return out;
}

export function FeedCommerceCard({ item }: { item: CommerceItem }) {
  const meta = META[item.kind];
  const Icon = meta.icon;

  const body = (
    <>
      <div className="relative">
        {item.coverUrl ? (
          <img loading="lazy" decoding="async" src={item.coverUrl} alt="" className="h-40 w-full object-cover" />
        ) : (
          <div
            className={`h-40 w-full bg-gradient-to-br ${
              item.kind === "product" ? item.hue : "from-[#E5484D]/35 to-[#7C6CF6]/25"
            }`}
          />
        )}
        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider text-white backdrop-blur">
          <Icon className="h-3 w-3 text-[#E5484D]" strokeWidth={2.5} />
          {meta.label}
        </span>
      </div>
      <div className="p-4">
        <p className="line-clamp-2 text-[15px] font-bold leading-snug text-white">{item.title}</p>
        <p className="mt-1 truncate text-[12px] text-white/45">{item.sub}</p>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[15px] font-black text-[#E5484D]">{item.priceLabel}</span>
          <span className="rounded-[10px] bg-[#E5484D] px-3 py-1.5 text-[12px] font-bold text-white">
            {meta.cta}
          </span>
        </div>
      </div>
    </>
  );

  const shell =
    "block overflow-hidden rounded-2xl border border-white/[0.06] bg-[#141416] text-left active:scale-[0.995] transition-transform";

  if (item.kind === "product") {
    return (
      <Link to="/product/$id" params={{ id: item.id }} className={shell}>
        {body}
      </Link>
    );
  }
  // Bounty and course cards belong to paused legacy features and are not rendered.
  return null;
}
