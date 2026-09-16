import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ShieldCheck,
  HeartHandshake,
  Wallet as WalletIcon,
  Globe2,
  Star,
  ShoppingCart,
  ArrowRight,
  BadgeCheck,
  Twitter,
  Instagram,
  Youtube,
  Linkedin,
  Facebook,
  Lock,
  Clock,
  Headphones,
  Gift,
  Download,
  Banknote,
  Users,
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
import { getHomeStats, type HomeStatsDTO } from "@/lib/home-stats.functions";
import { visualForCategory } from "@/components/oventric/marketplace-discovery/utils";
import { AvatarImage } from "@/components/oventric/AvatarImage";
import heroImage from "@/assets/home-hero.jpg";

type CategoryNode = { id: string; slug: string; name: string };

/** Pastel tile tints, mirroring the marketing layout. */
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

const TRUST = [
  {
    Icon: ShieldCheck,
    tint: "bg-[#E8F8EF] text-[#1F9D62]",
    title: "Secure Payments",
    body: "Powered by Paystack",
  },
  {
    Icon: HeartHandshake,
    tint: "bg-[#FFEDE4] text-[#D4622A]",
    title: "Support Creators",
    body: "Shop with impact",
  },
  {
    Icon: WalletIcon,
    tint: "bg-[#F3ECFF] text-[#6F42D4]",
    title: "Seller Cashback",
    body: "Earn up to 50% cashback on digital product purchases",
  },
  {
    Icon: Globe2,
    tint: "bg-[#EAF1FF] text-[#2F5FD0]",
    title: "Global Community",
    body: "Creators. Buyers. Builders.",
  },
];

const HANDWRITTEN = ["Ideas", "Skills", "Products", "Community", "Opportunities"];

/** Why sell / why buy on Oventric — MVP capabilities only. */
const REASONS = [
  {
    Icon: WalletIcon,
    tint: "bg-[#E8F8EF] text-[#1F9D62]",
    title: "Keep 80% of every sale",
    body: "Oventric takes a flat 20%. No listing fees, no monthly subscription, no hidden cuts.",
  },
  {
    Icon: ShieldCheck,
    tint: "bg-[#EAF1FF] text-[#2F5FD0]",
    title: "Escrow on every order",
    body: "Buyer payments are held until the asset is delivered, then released to the seller.",
  },
  {
    Icon: Download,
    tint: "bg-[#F3ECFF] text-[#6F42D4]",
    title: "Instant digital delivery",
    body: "Files and access links hand over in-app the moment a payment is confirmed.",
  },
  {
    Icon: Banknote,
    tint: "bg-[#FFF6E2] text-[#C58318]",
    title: "Withdraw in your currency",
    body: "Earnings land in your Oventric wallet and cash out to your local bank account.",
  },
  {
    Icon: Clock,
    tint: "bg-[#FFEDE4] text-[#D4622A]",
    title: "Fast, automatic release",
    body: "Completed orders settle automatically — no chasing buyers for confirmation.",
  },
  {
    Icon: Headphones,
    tint: "bg-[#E3F6F6] text-[#158C8C]",
    title: "Support & disputes",
    body: "Raise a dispute on any order and get a mediated resolution from our team.",
  },
];

const STEPS = [
  {
    title: "Create your account",
    body: "Pick your country and currency once — every price you see is shown in it.",
  },
  {
    title: "Buy or list a digital asset",
    body: "Shop the marketplace, or publish your own product, service or tool in minutes.",
  },
  {
    title: "Get paid and withdraw",
    body: "Escrow releases into your wallet, then cash out to your bank account.",
  },
];

const PAY_METHODS = ["Visa", "Mastercard", "Verve", "Paystack", "Bank transfer"];

const SOCIALS: Array<{
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  { href: "https://x.com/oventric", label: "X", Icon: Twitter },
  { href: "https://instagram.com/oventric", label: "Instagram", Icon: Instagram },
  { href: "https://youtube.com/@oventric", label: "YouTube", Icon: Youtube },
  { href: "https://linkedin.com/company/oventric", label: "LinkedIn", Icon: Linkedin },
  { href: "https://facebook.com/oventric", label: "Facebook", Icon: Facebook },
];

export type OventricHomeProps = {
  onSelect: (section: string) => void;
  onCreate?: () => void;
};

export function OventricHome({ onSelect, onCreate }: OventricHomeProps) {
  const { baseCurrency } = useOnboarding();

  const loadDiscovery = useServerFn(getMarketplaceDiscovery);
  const loadCategories = useServerFn(listMarketplaceCategories);
  const loadSellers = useServerFn(getTopSellers);
  const loadStats = useServerFn(getHomeStats);

  const [featured, setFeatured] = useState<ProductDTO[]>([]);
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [sellers, setSellers] = useState<TopSellerDTO[]>([]);
  const [fresh, setFresh] = useState<ProductDTO[]>([]);
  const [stats, setStats] = useState<HomeStatsDTO | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const [discovery, cats, tops, s] = await Promise.all([
          loadDiscovery(),
          loadCategories(),
          loadSellers(),
          loadStats(),
        ]);
        if (!alive) return;
        const picks = [
          ...(discovery?.featured ?? []),
          ...(discovery?.trending ?? []),
          ...(discovery?.newArrivals ?? []),
        ];
        const seen = new Set<string>();
        setFeatured(
          picks.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true))).slice(0, 10),
        );
        setFresh((discovery?.newArrivals ?? []).slice(0, 5));
        setCategories((cats ?? []).slice(0, 8));
        setSellers((tops ?? []).slice(0, 5));
        setStats(s);
      } catch {
        /* public page stays usable even if a feed is unavailable */
      }
    })();
    return () => {
      alive = false;
    };
  }, [loadDiscovery, loadCategories, loadSellers, loadStats]);

  const startSelling = () => onCreate?.();

  return (
    <div className="min-h-screen w-full bg-[#F7F8FA]">
      <main className="mx-auto w-full max-w-[1280px] px-4 pb-16 sm:px-6 lg:px-8">
        {/* ---------------------------------------------------------- hero */}
        <section className="mt-4 overflow-hidden rounded-[20px] bg-[#16181D] sm:mt-6 sm:rounded-[24px]">
          <div className="grid items-stretch gap-0 lg:grid-cols-[1.05fr_1fr]">
            <div className="flex flex-col justify-center gap-6 px-6 py-10 sm:px-10 sm:py-14 lg:py-20">
              <div>
                <h1 className="font-[Outfit] text-[34px] font-extrabold leading-[1.05] text-white sm:text-[46px] lg:text-[58px]">
                  Creative People
                  <span className="block text-crimson">Real Value</span>
                </h1>
                <p className="mt-4 max-w-md text-sm leading-relaxed text-white/70 sm:text-base">
                  Buy, sell and discover digital products, services and tools from amazing creators
                  around the world.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={() => onSelect("Marketplace")}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-crimson px-7 text-sm font-bold text-white transition-all hover:brightness-110 active:scale-95"
                >
                  Explore Marketplace
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={startSelling}
                  className="inline-flex h-12 items-center justify-center rounded-full border border-white/25 px-7 text-sm font-bold text-white transition-colors hover:bg-white/10 active:scale-95"
                >
                  Become a Seller
                </button>
              </div>
            </div>

            <div className="relative min-h-[240px] sm:min-h-[320px] lg:min-h-[420px]">
              <img
                src={heroImage}
                alt="A creator working on digital products"
                width={1600}
                height={912}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#16181D] via-[#16181D]/40 to-transparent lg:via-[#16181D]/25" />
              <ul className="absolute inset-y-0 right-4 hidden flex-col justify-center gap-4 text-right sm:right-8 md:flex">
                {HANDWRITTEN.map((word, i) => (
                  <li
                    key={word}
                    className="text-[22px] font-semibold italic text-white/85 lg:text-[26px]"
                    style={{ transform: `translateX(${(i % 2 === 0 ? -1 : 1) * 10}px)` }}
                  >
                    {word}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------- trust bar */}
        <section className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
          {TRUST.map(({ Icon, tint, title, body }) => (
            <div
              key={title}
              className="flex items-center gap-3 rounded-[14px] border border-slate-200/80 bg-white p-4"
            >
              <span
                className={`grid h-11 w-11 shrink-0 place-items-center rounded-[12px] ${tint}`}
              >
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-900">{title}</p>
                <p className="truncate text-xs text-slate-500">{body}</p>
              </div>
            </div>
          ))}
        </section>

        {/* ------------------------------------------------- shop by category */}
        <SectionHead
          title="Shop by Category"
          action={{ label: "View all", onClick: () => onSelect("Marketplace") }}
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-4">
          {categories.map((c, i) => {
            const { Icon } = visualForCategory(c.slug, c.name);
            const tint = TILE_TINTS[i % TILE_TINTS.length]!;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelect("Marketplace")}
                className="flex items-center gap-3 rounded-[14px] border border-slate-200/80 bg-white p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_30px_-20px_rgba(15,23,42,0.5)] active:scale-[0.98]"
              >
                <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-[12px] ${tint}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 truncate text-sm font-bold capitalize text-slate-900">
                  {c.name.trim()}
                </span>
              </button>
            );
          })}
          {categories.length === 0 && <EmptyNote>Categories are being set up.</EmptyNote>}
        </div>

        {/* -------------------------------------------------- featured products */}
        <SectionHead
          title="Featured Products"
          subtitle="Handpicked by our team"
          action={{ label: "View all", onClick: () => onSelect("Marketplace") }}
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 lg:gap-4">
          {featured.slice(0, 10).map((p) => (
            <ProductCard key={p.id} product={p} currency={baseCurrency} />
          ))}
          {featured.length === 0 && <EmptyNote>No listings published yet.</EmptyNote>}
        </div>

        {/* -------------------------------------------------------- top sellers */}
        <SectionHead
          title="Top Sellers"
          action={{ label: "View all", onClick: () => onSelect("Sellers") }}
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 lg:gap-4">
          {sellers.map((s) => (
            <Link
              key={s.id}
              to="/shop/$id"
              params={{ id: s.slug || s.id }}
              className="flex flex-col items-center gap-2 rounded-[14px] border border-slate-200/80 bg-white p-5 text-center transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_30px_-20px_rgba(15,23,42,0.5)]"
            >
              <div className="h-16 w-16 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                <AvatarImage src={s.avatarUrl} alt={s.name} />
              </div>
              <p className="flex max-w-full items-center gap-1 text-sm font-bold text-slate-900">
                <span className="truncate">{s.name}</span>
                {s.verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-[#2F5FD0]" />}
              </p>
              <p className="text-xs text-slate-500">{s.productsCount} products</p>
              <p className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700">
                <Star className="h-3.5 w-3.5 fill-[#F5A524] text-[#F5A524]" />
                {s.rating ? s.rating.toFixed(1) : "New"}
              </p>
            </Link>
          ))}
          {sellers.length === 0 && <EmptyNote>No sellers to show yet.</EmptyNote>}
        </div>

        {/* ------------------------------------------------------------ CTA band */}
        <section className="mt-10 overflow-hidden rounded-[20px] bg-[#16181D] px-6 py-10 sm:px-10 sm:py-12 lg:mt-14">
          <div className="grid items-center gap-8 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <h2 className="font-[Outfit] text-2xl font-extrabold leading-tight text-white sm:text-3xl lg:text-[38px]">
                Turn Your Skills Into Income
              </h2>
              <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/70">
                Join Oventric and sell your digital products, services and tools to buyers around
                the world and earn real money to your account.
              </p>
              <button
                type="button"
                onClick={startSelling}
                className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-crimson px-7 text-sm font-bold text-white transition-all hover:brightness-110 active:scale-95"
              >
                Start Selling
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-[16px] bg-white/[0.05] p-4 sm:gap-4 sm:p-6">
              <Stat value={stats?.creators} label="Creators" />
              <Stat value={stats?.products} label="Products" />
              <Stat value={stats?.customers} label="Customers" />
              <Stat value={stats?.countries} label="Countries" />
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------ fresh listings */}
        {fresh.length > 0 && (
          <>
            <SectionHead
              title="Fresh in the Market"
              subtitle="Newest digital assets from our creators"
              action={{ label: "View all", onClick: () => onSelect("Marketplace") }}
            />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 lg:gap-4">
              {fresh.map((p) => (
                <ProductCard key={p.id} product={p} currency={baseCurrency} />
              ))}
            </div>
          </>
        )}

        {/* ------------------------------------------------------------- promos */}
        <SectionHead title="Ways to Earn More" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <PromoCard
            Icon={Gift}
            gradient="linear-gradient(135deg,#FFD22E 0%,#FF8A3D 100%)"
            title="Up to 50% cashback"
            body="Sellers fund their own cashback on digital products — money back into your cashback wallet, automatically."
            cta="Shop now"
            onClick={() => onSelect("Marketplace")}
          />
          <PromoCard
            Icon={Users}
            gradient="linear-gradient(135deg,#7DE2A8 0%,#12B39B 100%)"
            title="Refer & earn"
            body="Invite creators and buyers to Oventric and earn a reward when they make their first qualifying purchase."
            cta="Invite friends"
            to="/referrals"
          />
        </div>

        {/* --------------------------------------------------- why sell / why buy */}
        <SectionHead
          title="Why Oventric"
          subtitle="Everything you need to build an income online"
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
          {REASONS.map(({ Icon, tint, title, body }) => (
            <div
              key={title}
              className="rounded-[14px] border border-slate-200/80 bg-white p-5 transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_30px_-20px_rgba(15,23,42,0.5)]"
            >
              <span className={`grid h-11 w-11 place-items-center rounded-[12px] ${tint}`}>
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-sm font-bold text-slate-900">{title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{body}</p>
            </div>
          ))}
        </div>

        {/* -------------------------------------------------------- how it works */}
        <SectionHead title="How It Works" subtitle="Three steps from sign-up to payout" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:gap-4">
          {STEPS.map((s, i) => (
            <div key={s.title} className="rounded-[14px] border border-slate-200/80 bg-white p-6">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-crimson/10 font-[Outfit] text-sm font-extrabold text-crimson">
                {i + 1}
              </span>
              <h3 className="mt-4 text-base font-bold text-slate-900">{s.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{s.body}</p>
            </div>
          ))}
        </div>

        {/* ----------------------------------------------------- secure payments */}
        <section className="mt-10 rounded-[20px] border border-slate-200/80 bg-white px-6 py-10 text-center lg:mt-14">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-crimson">
            <Lock className="h-3.5 w-3.5" /> Secured payments
          </span>
          <h2 className="mt-3 font-[Outfit] text-xl font-extrabold text-slate-900 sm:text-2xl">
            Pay your way, protected end to end
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-slate-500">
            Every checkout is encrypted and held in escrow until delivery is confirmed. Pay by card,
            bank transfer or from your Oventric wallet.
          </p>
          <ul className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
            {PAY_METHODS.map((m) => (
              <li
                key={m}
                className="rounded-full border border-slate-200 bg-[#F7F8FA] px-4 py-2 text-xs font-bold text-slate-600"
              >
                {m}
              </li>
            ))}
          </ul>
        </section>

        {/* ------------------------------------------------------ follow oventric */}
        <section className="mt-5 flex flex-col items-center justify-between gap-5 rounded-[20px] border border-slate-200/80 bg-white px-6 py-7 text-center lg:flex-row lg:text-left">
          <div>
            <h2 className="font-[Outfit] text-lg font-extrabold text-slate-900">Follow Oventric</h2>
            <p className="mt-1 text-sm text-slate-500">
              Get updates, tips and community highlights.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            {SOCIALS.map(({ href, label, Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noreferrer noopener"
                aria-label={label}
                className="grid h-11 w-11 place-items-center rounded-full border border-slate-200 text-slate-600 transition-all hover:-translate-y-0.5 hover:border-crimson hover:text-crimson"
              >
                <Icon className="h-4.5 w-4.5" />
              </a>
            ))}
          </div>
        </section>
      </main>

      <HomeFooter />
    </div>
  );
}

/* -------------------------------------------------------------- sub-parts */

function SectionHead({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="mb-4 mt-10 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 lg:mt-14">
      <div className="min-w-0">
        <h2 className="font-[Outfit] text-xl font-extrabold text-slate-900 sm:text-2xl">{title}</h2>
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

function PromoCard({
  Icon,
  gradient,
  title,
  body,
  cta,
  onClick,
  to,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  title: string;
  body: string;
  cta: string;
  onClick?: () => void;
  to?: string;
}) {
  const inner = (
    <>
      <span
        className="grid h-12 w-12 place-items-center rounded-[14px] text-white"
        style={{ backgroundImage: gradient }}
      >
        <Icon className="h-5 w-5" />
      </span>
      <h3 className="mt-4 font-[Outfit] text-lg font-extrabold text-slate-900">{title}</h3>
      <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{body}</p>
      <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-crimson">
        {cta}
        <ArrowRight className="h-4 w-4" />
      </span>
    </>
  );
  const cls =
    "block rounded-[16px] border border-slate-200/80 bg-white p-6 text-left transition-all hover:-translate-y-0.5 hover:shadow-[0_16px_36px_-24px_rgba(15,23,42,0.6)]";

  if (to) {
    return (
      <Link to={to} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={`w-full ${cls}`}>
      {inner}
    </button>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="col-span-full rounded-[14px] border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-400">
      {children}
    </p>
  );
}

function Stat({ value, label }: { value?: number; label: string }) {
  return (
    <div className="text-center">
      <p className="font-[Outfit] text-2xl font-extrabold text-white sm:text-3xl">
        {value === undefined ? "—" : value.toLocaleString()}
      </p>
      <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-white/50">
        {label}
      </p>
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

        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <span className="truncate text-sm font-extrabold text-slate-900">{price}</span>
          <Link
            to="/product/$id"
            params={{ id: product.id }}
            aria-label={`View ${product.name}`}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-crimson text-white transition-transform active:scale-95"
          >
            <ShoppingCart className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function HomeFooter() {
  const links: Array<{ to: string; label: string }> = [
    { to: "/about", label: "About" },
    { to: "/help", label: "Help" },
    { to: "/terms", label: "Terms" },
    { to: "/privacy", label: "Privacy" },
    { to: "/report-problem", label: "Contact" },
  ];
  const socials: Array<{ href: string; label: string; Icon: React.ComponentType<{ className?: string }> }> = [
    { href: "https://x.com/oventric", label: "X", Icon: Twitter },
    { href: "https://instagram.com/oventric", label: "Instagram", Icon: Instagram },
    { href: "https://youtube.com/@oventric", label: "YouTube", Icon: Youtube },
    { href: "https://linkedin.com/company/oventric", label: "LinkedIn", Icon: Linkedin },
  ];

  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-[1280px] flex-col items-center gap-5 px-4 py-8 text-center sm:px-6 lg:flex-row lg:justify-between lg:gap-6 lg:px-8 lg:text-left">
        <p className="text-sm text-slate-500">
          <span className="font-extrabold text-slate-900">Oventric</span> &copy; 2026
        </p>

        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {links.map((l) => (
            <Link
              key={l.label}
              to={l.to}
              className="text-sm font-semibold text-slate-500 transition-colors hover:text-slate-900"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {socials.map(({ href, label, Icon }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              aria-label={label}
              className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 text-slate-500 transition-colors hover:border-slate-900 hover:text-slate-900"
            >
              <Icon className="h-4 w-4" />
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
