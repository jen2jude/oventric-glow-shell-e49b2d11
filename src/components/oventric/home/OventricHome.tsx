import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
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
  Lock,
  Clock,
  Headphones,
  Download,
  Banknote,
  Search,
  ChevronLeft,
  ChevronRight,
  Heart,
  MessageCircle,
  Eye,
  Sparkles,
  Facebook,
  Instagram,
  Youtube,
} from "lucide-react";

import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { computeDisplayPrice } from "@/lib/fx-display";
import {
  getMarketplaceDiscovery,
  getRecentProducts,
  listMarketplaceCategories,
  getTopSellers,
  type ProductDTO,
  type TopSellerDTO,
} from "@/lib/marketplace.functions";
import { getHomeStats, type HomeStatsDTO } from "@/lib/home-stats.functions";
import { listPosts, type FeedPost } from "@/lib/posts.functions";
import { readRecentProductIds } from "@/lib/recent-products";
import { visualForCategory } from "@/components/oventric/marketplace-discovery/utils";
import { COUNTRY_META, normalizeCountryCode } from "@/lib/currency/africa";
import { AvatarImage } from "@/components/oventric/AvatarImage";
import { CashbackBadge } from "@/components/oventric/CashbackBadge";
import heroImage from "@/assets/home-hero.jpg";
import heroVideo from "@/assets/oventric-hero-loop.mp4.asset.json";
import heroVideoWebm from "@/assets/oventric-hero-loop.webm.asset.json";
import skillsCtaImage from "@/assets/home-skills-bg.jpg";
import cashbackCreatorsImage from "@/assets/earn-cashback-creators.jpg";
import referralCreatorsImage from "@/assets/earn-referral-creators.jpg";
import accountCreatorImage from "@/assets/how-account-creator.jpg";
import marketplaceCreatorImage from "@/assets/how-marketplace-male-creator.jpg";
import paidCreatorImage from "@/assets/how-paid-creator.jpg";

type CategoryNode = { id: string; slug: string; name: string };

/** Bright Spectrum tile tints — blue, violet, green, gold, coral. */
const TILE_TINTS = [
  "bg-newsfeed-blue-soft text-newsfeed-blue",
  "bg-newsfeed-violet-soft text-newsfeed-violet",
  "bg-newsfeed-green-soft text-newsfeed-green",
  "bg-newsfeed-gold-soft text-newsfeed-gold",
  "bg-newsfeed-coral-soft text-newsfeed-coral",
];

const TRUST = [
  {
    Icon: ShieldCheck,
    tint: "bg-newsfeed-green-soft text-newsfeed-green",
    title: "Secure Payments",
    body: "Powered by Paystack",
  },
  {
    Icon: HeartHandshake,
    tint: "bg-newsfeed-coral-soft text-newsfeed-coral",
    title: "Support Creators",
    body: "Shop with impact",
  },
  {
    Icon: WalletIcon,
    tint: "bg-newsfeed-violet-soft text-newsfeed-violet",
    title: "Seller Cashback",
    body: "Earn up to 50% cashback on digital product purchases",
  },
  {
    Icon: Globe2,
    tint: "bg-newsfeed-blue-soft text-newsfeed-blue",
    title: "Global Community",
    body: "Creators. Buyers. Builders.",
  },
];

const HANDWRITTEN = ["Ideas", "Skills", "Products", "Community", "Opportunities"];

/** Why sell / why buy on Oventric — MVP capabilities only. */
const REASONS = [
  {
    Icon: WalletIcon,
    tint: "bg-newsfeed-green-soft text-newsfeed-green",
    title: "Keep 80% of every sale",
    body: "Oventric takes a flat 20%. No listing fees, no monthly subscription, no hidden cuts.",
  },
  {
    Icon: ShieldCheck,
    tint: "bg-newsfeed-blue-soft text-newsfeed-blue",
    title: "Escrow on every order",
    body: "Buyer payments are held until the asset is delivered, then released to the seller.",
  },
  {
    Icon: Download,
    tint: "bg-newsfeed-violet-soft text-newsfeed-violet",
    title: "Instant digital delivery",
    body: "Files and access links hand over in-app the moment a payment is confirmed.",
  },
  {
    Icon: Banknote,
    tint: "bg-newsfeed-gold-soft text-newsfeed-gold",
    title: "Withdraw in your currency",
    body: "Earnings land in your Oventric wallet and cash out to your local bank account.",
  },
  {
    Icon: Clock,
    tint: "bg-newsfeed-coral-soft text-newsfeed-coral",
    title: "Fast, automatic release",
    body: "Completed orders settle automatically — no chasing buyers for confirmation.",
  },
  {
    Icon: Headphones,
    tint: "bg-newsfeed-blue-soft text-newsfeed-blue",
    title: "Support & disputes",
    body: "Raise a dispute on any order and get a mediated resolution from our team.",
  },
];

const STEPS = [
  {
    title: "Create your account",
    body: "Pick your country and currency once — every price you see is shown in it.",
    image: accountCreatorImage,
    imageAlt: "A creator setting up her Oventric account",
  },
  {
    title: "Buy or list a digital asset",
    body: "Shop the marketplace, or publish your own product, service or tool in minutes.",
    image: marketplaceCreatorImage,
    imageAlt: "A digital designer creating an asset at her workspace",
  },
  {
    title: "Get paid and withdraw",
    body: "Escrow releases into your wallet, then cash out to your bank account.",
    image: paidCreatorImage,
    imageAlt: "A creator checking her earnings on her phone",
  },
];

import payVisa from "@/assets/pay/visa.png";
import payMastercard from "@/assets/pay/mastercard.png";
import payVerve from "@/assets/pay/verve.png";
import payPaystack from "@/assets/pay/paystack.png";
import payBank from "@/assets/pay/bank-transfer.png";
import payBinance from "@/assets/pay/binance.svg";
import payMinipay from "@/assets/pay/minipay.svg";


const PAY_METHODS: { name: string; src: string }[] = [
  { name: "Visa", src: payVisa },
  { name: "Mastercard", src: payMastercard },
  { name: "Verve", src: payVerve },
  { name: "Paystack", src: payPaystack },
  { name: "Bank transfer", src: payBank },
  { name: "MiniPay", src: payMinipay },
  { name: "Binance", src: payBinance },
];

export type OventricHomeProps = {
  onSelect: (section: string) => void;
  onCreate?: () => void;
};

export function OventricHome({ onSelect, onCreate }: OventricHomeProps) {
  const navigate = useNavigate();
  const { baseCurrency } = useOnboarding();

  const loadDiscovery = useServerFn(getMarketplaceDiscovery);
  const loadCategories = useServerFn(listMarketplaceCategories);
  const loadSellers = useServerFn(getTopSellers);
  const loadStats = useServerFn(getHomeStats);
  const loadRecentProducts = useServerFn(getRecentProducts);
  const loadPosts = useServerFn(listPosts);

  const [featured, setFeatured] = useState<ProductDTO[]>([]);
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [sellers, setSellers] = useState<TopSellerDTO[]>([]);
  const [fresh, setFresh] = useState<ProductDTO[]>([]);
  const [recentProducts, setRecentProducts] = useState<ProductDTO[]>([]);
  const [latestPosts, setLatestPosts] = useState<FeedPost[]>([]);
  const [stats, setStats] = useState<HomeStatsDTO | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [heroVideoEnabled, setHeroVideoEnabled] = useState(false);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (!reducedMotion && !connection?.saveData) setHeroVideoEnabled(true);
  }, []);


  const submitSearch = () => {
    const q = searchQuery.trim();
    if (!q) return;
    navigate({ to: "/explore", search: { search: q } });
  };

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const recentIds = readRecentProductIds();
        const [discovery, cats, tops, s, recent, postResult] = await Promise.all([
          loadDiscovery(),
          loadCategories(),
          loadSellers(),
          loadStats(),
          loadRecentProducts({ data: { ids: recentIds } }),
          loadPosts(),
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
        setRecentProducts((recent ?? []).slice(0, 10));
        setLatestPosts((postResult?.posts ?? []).slice(0, 10));
      } catch {
        /* public page stays usable even if a feed is unavailable */
      }
    })();
    return () => {
      alive = false;
    };
  }, [loadDiscovery, loadCategories, loadPosts, loadRecentProducts, loadSellers, loadStats]);

  const startSelling = () => onCreate?.();

  return (
    <div className="home-pop min-h-screen w-full bg-home-canvas">
      {/* ---------------------------------------------------------- hero */}
      <section className="home-pop-hero relative w-full overflow-hidden bg-home-surface">
        <div className="absolute inset-0">
          {/* Largest visible image on first paint: load it eagerly, never lazily. */}
          <img loading="eager" fetchPriority="high" decoding="async"
            src={heroImage}
            alt="A creator working on digital products"
            width={1600}
            height={912}
            className="h-full w-full object-cover object-[75%_center]"
          />
          {heroVideoEnabled && (
            <video
              poster={heroImage}
              muted
              autoPlay
              loop
              playsInline
              preload="metadata"
              aria-hidden="true"
              className="home-pop-hero-video absolute inset-0 h-full w-full object-cover object-[75%_center]"
            >
              <source src={heroVideoWebm.url} type="video/webm" />
              <source src={heroVideo.url} type="video/mp4" />
            </video>
          )}
          {/* white fade — text panel on the left, image stretches to both edges */}
          <div className="home-pop-hero-fade absolute inset-0" />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-home-canvas to-transparent" />
        </div>


        <div className="relative z-10 mx-auto flex w-full max-w-[1280px] flex-col justify-center gap-6 px-4 py-14 sm:px-6 sm:py-20 lg:min-h-[520px] lg:px-8 lg:py-28">
          <div>
            <span className="home-pop-strip mb-4 block" aria-hidden="true" />
            <h1 className="font-wallet-display text-[26px] font-extrabold leading-[1.05] text-home-ink sm:text-[48px] lg:text-[58px]">
              1st Africa Digital
              <span className="block text-crimson">Marketplace & Community</span>
              <span className="block">for creators</span>
            </h1>
            <p className="mt-4 max-w-md text-[14px] leading-relaxed text-home-copy sm:text-lg">
              Buy, sell and discover
              <br className="sm:hidden" />{" "}
              digital products, services and tools
              <br className="sm:hidden" />{" "}
              from amazing creators around the world.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate({ to: "/sellers" })}
                className="home-pop-primary inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full px-5 text-sm font-bold text-primary-foreground transition-all active:scale-95 sm:h-12 sm:flex-none sm:px-8"
            >
              Shop
              <ArrowRight className="hidden h-4 w-4 sm:block" />
            </button>
            <button
              type="button"
              onClick={startSelling}
                className="inline-flex h-11 flex-1 items-center justify-center rounded-full border border-home-line bg-home-surface/90 px-5 text-sm font-bold text-home-ink shadow-home-soft backdrop-blur transition-all hover:-translate-y-0.5 active:scale-95 sm:h-12 sm:flex-none sm:px-8"
            >
              <span className="sm:hidden">Sell</span>
              <span className="hidden sm:inline">Become a Seller</span>
            </button>
          </div>

          {/* Search bar */}
          <div className="w-full max-w-md">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitSearch()}
                placeholder="Search digital products, sellers..."
                className="h-12 w-full rounded-full border border-home-line bg-home-surface/95 pl-5 pr-14 text-sm font-medium text-home-ink shadow-home-soft backdrop-blur-sm transition-all placeholder:text-home-muted focus:border-primary/50 focus:bg-home-surface focus:outline-hidden"
              />
              <button
                type="button"
                onClick={submitSearch}
                aria-label="Search"
                className="home-pop-primary absolute right-1 top-1 flex h-10 w-10 items-center justify-center rounded-full text-primary-foreground transition-transform active:scale-95"
              >
                <Search className="h-5 w-5" />
              </button>
            </div>
          </div>

          <ul className="hidden flex-wrap gap-x-5 gap-y-2 md:flex">
            {HANDWRITTEN.map((word) => (
              <li key={word} className="text-[18px] font-semibold italic text-slate-500 lg:text-[20px]">
                {word}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <main className="mx-auto w-full max-w-[1280px] px-4 pb-16 sm:px-6 lg:px-8">


        {/* ------------------------------------------------------- trust bar */}
        <section className="mt-5">
          <h2 className="mb-3 px-1 text-base font-bold text-slate-900 sm:hidden">
            Platform Perks
          </h2>
          <div className="home-pop-trust flex snap-x snap-mandatory gap-3 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-4 lg:gap-4 [&::-webkit-scrollbar]:hidden">
            {TRUST.map(({ Icon, title, body }) => (
              <div
                key={title}
                className="home-pop-trust-card min-w-[85%] shrink-0 snap-center rounded-[10px] border p-5 transition-transform hover:-translate-y-1 sm:min-w-0 sm:flex sm:items-center sm:gap-3 sm:p-4"
              >
                <span
                  className="home-pop-icon grid h-11 w-11 shrink-0 place-items-center rounded-[12px]"
                >
                  <Icon className="h-5 w-5" />
                </span>
                <div className="mt-3 min-w-0 sm:mt-0">
                  <p className="text-sm font-bold text-slate-900 sm:truncate">{title}</p>
                  <p className="text-xs leading-relaxed text-slate-500 sm:truncate">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ----------------------------------------------- recently viewed */}
        {recentProducts.length > 0 && (
          <section>
            <SectionHead
              title="Recently Viewed"
              subtitle="Pick up where you left off"
              action={{ label: "Explore more", onClick: () => onSelect("Marketplace") }}
            />
            <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 lg:grid-cols-6 lg:gap-4">
              {recentProducts.map((product) => (
                <div key={product.id} className="w-[46%] shrink-0 snap-start sm:w-auto sm:shrink">
                  <ProductCard product={product} currency={baseCurrency} compact />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ------------------------------------------------- shop by category */}
        <SectionHead
          title="Shop by Category"
          action={{ label: "View all", onClick: () => onSelect("Marketplace") }}
        />
        <div className="home-pop-categories grid grid-cols-4 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-4">
          {categories.map((c, i) => {
            const { Icon } = visualForCategory(c.slug, c.name);
            const tint = TILE_TINTS[i % TILE_TINTS.length]!;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelect("Marketplace")}
                className="home-pop-category flex flex-col items-center gap-2 rounded-[10px] p-2 text-center transition-all active:scale-[0.98] sm:flex-row sm:gap-3 sm:p-4 sm:text-left sm:hover:-translate-y-1"
              >
                <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-full ${tint} sm:h-11 sm:w-11 sm:rounded-[12px]`}>
                  <Icon className="h-6 w-6 sm:h-5 sm:w-5" />
                </span>
                <span className="min-w-0 max-w-full truncate text-xs font-bold capitalize text-slate-900 sm:text-sm">
                  {c.name.trim()}
                </span>
              </button>
            );
          })}
          {categories.length === 0 && <EmptyNote>Categories are being set up.</EmptyNote>}
        </div>

        {/* ------------------------------------------------ latest newsfeed posts */}
        {latestPosts.length > 0 && (
          <NewsfeedRail posts={latestPosts} onOpenFeed={() => onSelect("Feed")} />
        )}

        {/* -------------------------------------------------- featured products */}
        <SectionHead
          title="Featured Products"
          subtitle="Handpicked by our team"
          action={{ label: "View all", onClick: () => onSelect("Marketplace") }}
        />
        <div className="home-pop-products -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-5 lg:gap-4">
          {featured.slice(0, 10).map((p) => (
            <div key={p.id} className="w-[84%] shrink-0 snap-start sm:w-auto sm:shrink">
              <ProductCard product={p} currency={baseCurrency} />
            </div>
          ))}
          {featured.length === 0 && <EmptyNote>No listings published yet.</EmptyNote>}
        </div>

        {/* -------------------------------------------------------- top sellers */}
        <SectionHead
          title="Top Sellers"
          subtitle="Global creators making waves"
          action={{ label: "View all", onClick: () => navigate({ to: "/sellers" }) }}
        />
        <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-5">
          {sellers.map((s, index) => (
            <Link
              key={s.id}
              to="/shop/$id"
              params={{ id: s.slug || s.id }}
              className="group w-[168px] shrink-0 snap-start sm:w-auto sm:shrink"
            >
              <div className="relative aspect-[3/4] overflow-hidden rounded-[10px] bg-muted shadow-home-soft ring-1 ring-home-line transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-lg">
                <AvatarImage
                  src={s.avatarUrl}
                  alt={s.name}
                  className="transition-transform duration-500 group-hover:scale-105"
                />
                <span className="absolute left-3 top-3 grid h-7 min-w-7 place-items-center rounded-full border-2 border-home-surface bg-home-surface px-1 text-[11px] font-extrabold text-home-ink shadow-home-soft">
                  {index + 1}
                </span>
                <SellerCountryFlag country={s.country} />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-foreground/90 via-foreground/45 to-transparent px-3 pb-3 pt-12 text-primary-foreground">
                  <p className="flex min-w-0 items-center gap-1 text-sm font-extrabold leading-tight">
                    <span className="truncate">{s.name}</span>
                    {s.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-primary" />}
                  </p>
                  <p className="mt-1 truncate text-[11px] font-semibold text-primary-foreground/75">
                    @{s.username}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1 px-1 pt-3 text-center">
                <SellerStat icon={<Star className="h-3 w-3 fill-current text-seller-rating" />} value={s.rating ? s.rating.toFixed(1) : "New"} label="Rating" />
                <SellerStat icon={<ShoppingCart className="h-3 w-3" />} value={String(s.productsCount)} label="Products" />
                <SellerStat icon={<Banknote className="h-3 w-3" />} value={String(s.salesCount)} label="Sales" />
              </div>
            </Link>
          ))}
          {sellers.length === 0 && <EmptyNote>No sellers to show yet.</EmptyNote>}
        </div>

        {/* ------------------------------------------------------------ CTA band */}
        <section className="relative mt-10 overflow-hidden rounded-[10px] lg:mt-14">
          <img
            src={skillsCtaImage}
            alt="A 3D creator character beside a laptop showing growing sales"
            loading="lazy"
            width={1920}
            height={800}
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-white from-[22%] via-white/95 via-[45%] to-white/10 to-[78%]" />
          <div className="relative px-6 py-10 sm:px-10 sm:py-14">
            <div className="max-w-xl">
              <h2 className="font-wallet-display text-2xl font-extrabold leading-tight text-slate-950 sm:text-3xl lg:text-[38px]">
                Turn Your Skills Into Income
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                Join Oventric and sell your digital products, services and tools to buyers around
                the world and earn real money to your account.
              </p>
              <button
                type="button"
                onClick={startSelling}
                className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-crimson px-7 text-sm font-bold text-white shadow-md transition-all hover:brightness-110 active:scale-95"
              >
                Start Selling
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-8 grid max-w-xl grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
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
        <section className="home-pop-earn relative mt-10 overflow-hidden rounded-[10px] px-4 pb-5 pt-1 sm:px-6 sm:pb-6 lg:mt-14 lg:px-8 lg:pb-8">
        <SectionHead title="Ways to Earn More" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
          <PromoCard
            image={cashbackCreatorsImage}
            imageAlt="A digital creator checking her phone at her workspace"
            title="Up to 50% cashback"
            body="Earn cashback when you buy eligible digital products from Oventric creators."
            cta="Shop now"
            onClick={() => onSelect("Marketplace")}
          />
          <PromoCard
            image={referralCreatorsImage}
            imageAlt="Two digital creators collaborating in a bright studio"
            title="Refer & earn"
            body="Invite creators and buyers to Oventric and earn a reward when they make their first qualifying purchase."
            cta="Invite friends"
            to="/referrals"
          />
        </div>
        </section>

        {/* --------------------------------------------------- why sell / why buy */}
        <section className="home-pop-why mt-10 overflow-hidden rounded-[10px] px-4 pb-5 pt-1 sm:px-6 sm:pb-6 lg:mt-14 lg:px-8 lg:pb-8">
        <SectionHead title="Why Oventric" subtitle="Everything you need to build an income online" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
          {REASONS.map(({ Icon, tint, title, body }) => (
            <div
              key={title}
              className="home-pop-reason rounded-[10px] border p-4 transition-all hover:-translate-y-1 sm:p-5"
            >
              <span
                className={`grid h-9 w-9 place-items-center rounded-[10px] ${tint} max-sm:bg-crimson/10 max-sm:text-crimson sm:h-11 sm:w-11 sm:rounded-[12px]`}
              >
                <Icon className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
              </span>
              <h3 className="mt-3 text-xs font-bold leading-tight text-slate-900 sm:mt-4 sm:text-sm">
                {title}
              </h3>
              <p className="mt-1.5 hidden text-xs leading-relaxed text-slate-500 sm:block">
                {body}
              </p>
            </div>
          ))}
        </div>
        </section>

        {/* -------------------------------------------------------- how it works */}
        <section className="home-pop-how mt-10 rounded-[10px] px-4 pb-5 pt-1 sm:px-6 sm:pb-6 lg:mt-14 lg:px-8 lg:pb-8">
        <SectionHead title="How It Works" subtitle="Three steps from sign-up to payout" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:gap-5">
          {STEPS.map((s, i) => (
            <article
              key={s.title}
              className="home-pop-step group overflow-hidden rounded-[10px] border bg-white transition-all hover:-translate-y-1"
            >
              <div className="relative aspect-[16/10] overflow-hidden">
                <img
                  src={s.image}
                  alt={s.imageAlt}
                  loading="lazy"
                  width={1104}
                  height={768}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.025]"
                />
                <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-white to-transparent" />
                <span className="absolute left-5 top-5 grid h-10 w-10 place-items-center rounded-full bg-crimson font-wallet-display text-sm font-extrabold text-primary-foreground shadow-md">
                  {i + 1}
                </span>
              </div>
              <div className="relative -mt-5 px-5 pb-6 sm:px-6 sm:pb-7">
                <h3 className="font-wallet-display text-lg font-extrabold leading-tight text-slate-950">{s.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{s.body}</p>
              </div>
            </article>
          ))}
        </div>
        </section>

        {/* ----------------------------------------------------- secure payments */}
        <section className="home-pop-payments mt-10 overflow-hidden rounded-[10px] border px-5 py-9 text-center sm:px-8 lg:mt-14 lg:py-12">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-crimson">
            <Lock className="h-3.5 w-3.5" /> Secured payments
          </span>
          <h2 className="mt-3 font-wallet-display text-xl font-extrabold text-slate-900 sm:text-2xl">
            Pay your way, protected end to end
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-slate-500">
            Every checkout is encrypted and held in escrow until delivery is confirmed. Pay by card,
            bank transfer or from your Oventric wallet.
          </p>
          <ul className="mt-6 flex items-center gap-2.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:justify-center sm:overflow-visible">
            {PAY_METHODS.map((m) => (
              <li
                key={m.name}
                className="home-pop-payment flex h-14 shrink-0 items-center justify-center rounded-xl border bg-white px-6"
              >
                <img src={m.src} alt={m.name} loading="lazy" className="h-8 w-auto max-w-[110px] object-contain" />
              </li>
            ))}
          </ul>
        </section>
      </main>

      <HomeFooter />
    </div>
  );
}

function SellerCountryFlag({ country }: { country: string | null }) {
  const code = normalizeCountryCode(country);
  if (!code) return null;
  const meta = COUNTRY_META[code];
  if (!meta) return null;
  return (
    <span
      title={meta.name}
      aria-label={meta.name}
      className="absolute right-3 top-3 grid h-8 w-8 place-items-center overflow-hidden rounded-full border-2 border-home-surface bg-home-surface shadow-home-soft"
    >
      <span className={`fi fi-${code.toLowerCase()} h-full w-full bg-cover bg-center`} aria-hidden="true" />
    </span>
  );
}

function SellerStat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <span className="min-w-0 text-home-copy">
      <span className="flex items-center justify-center gap-1 text-[11px] font-extrabold text-home-ink">
        {icon}
        <span className="truncate">{value}</span>
      </span>
      <span className="mt-0.5 block truncate text-[9px] font-semibold text-home-muted">{label}</span>
    </span>
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
        <span className="home-pop-strip mb-2.5 block" aria-hidden="true" />
        <h2 className="font-wallet-display text-xl font-extrabold text-newsfeed-ink sm:text-2xl">{title}</h2>
        {subtitle && <p className="mt-1 text-xs text-newsfeed-muted sm:text-sm">{subtitle}</p>}
      </div>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-newsfeed-line bg-newsfeed-surface px-3 py-1.5 text-xs font-bold text-newsfeed-violet shadow-newsfeed-panel transition-all hover:-translate-y-0.5 sm:text-sm"
        >
          {action.label}
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function PromoCard({
  image,
  imageAlt,
  title,
  body,
  cta,
  onClick,
  to,
}: {
  image: string;
  imageAlt: string;
  title: string;
  body: string;
  cta: string;
  onClick?: () => void;
  to?: string;
}) {
  const inner = (
    <div className="relative min-h-[270px] overflow-hidden rounded-[10px] sm:min-h-[300px]">
      <img
        src={image}
        alt={imageAlt}
        loading="lazy"
        width={1408}
        height={768}
        className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-[1.025]"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-white from-0% via-white/95 via-[48%] to-white/5 to-[82%]" />
      <div className="relative flex min-h-[270px] max-w-[72%] flex-col items-start justify-center p-6 text-left sm:min-h-[300px] sm:max-w-[66%] sm:p-8 lg:max-w-[62%]">
        <h3 className="font-wallet-display text-2xl font-extrabold leading-tight text-slate-950 sm:text-3xl">{title}</h3>
        <p className="mt-3 text-sm leading-6 text-slate-700">{body}</p>
        <span className="mt-6 inline-flex min-h-10 items-center gap-2 rounded-[8px] bg-crimson px-5 text-sm font-bold text-primary-foreground shadow-sm transition-colors group-hover:bg-crimson/90">
          {cta}
          <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
  const cls =
    "group block overflow-hidden rounded-[10px] border border-slate-200 bg-white text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crimson focus-visible:ring-offset-2";

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
    <p className="col-span-full rounded-[10px] border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-400">
      {children}
    </p>
  );
}

function Stat({ value, label }: { value?: number; label: string }) {
  return (
    <div className="rounded-[10px] border border-slate-200/80 bg-white/90 px-3 py-4 text-center shadow-sm backdrop-blur-sm">
      <p className="font-wallet-display text-xl font-extrabold text-slate-950 sm:text-2xl">
        {value === undefined ? "—" : value.toLocaleString()}
      </p>
      <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
    </div>
  );
}

function ProductCard({
  product,
  currency,
  compact = false,
}: {
  product: ProductDTO;
  currency: string;
  compact?: boolean;
}) {
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
    <div className="home-pop-product group flex flex-col overflow-hidden rounded-[10px] border bg-home-surface transition-all hover:-translate-y-1">
      <Link
        to="/product/$id"
        params={{ id: product.id }}
        className={`relative block w-full overflow-hidden bg-slate-100 ${compact ? "aspect-[16/10]" : "aspect-[4/3]"}`}
      >
        {product.coverUrl ? (
          <img
            src={product.coverUrl}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : null}
        <CashbackBadge percentage={product.cashbackPct} className="absolute left-2 top-2" />
      </Link>

      <div className={`flex flex-1 flex-col ${compact ? "gap-1 p-2" : "gap-2 p-3"}`}>
        <Link to="/product/$id" params={{ id: product.id }} className="min-w-0">
          <h3
            className={`font-bold leading-snug text-slate-900 transition-colors group-hover:text-crimson ${compact ? "line-clamp-1 text-[12px]" : "line-clamp-2 text-[13px]"}`}
          >
            {product.name}
          </h3>
        </Link>

        <p className={`truncate text-slate-500 ${compact ? "text-[10px]" : "text-[11px]"}`}>
          {product.vendor}
        </p>

        <p className={`inline-flex items-center gap-1 font-semibold text-slate-600 ${compact ? "text-[10px]" : "text-[11px]"}`}>
          <Star className={`fill-[#F5A524] text-[#F5A524] ${compact ? "h-2.5 w-2.5" : "h-3 w-3"}`} />
          {product.rating ? product.rating.toFixed(1) : "New"}
          {product.reviews ? (
            <span className="font-normal text-slate-400">({product.reviews})</span>
          ) : null}
        </p>

        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <span className={`truncate font-extrabold text-slate-900 ${compact ? "text-xs" : "text-sm"}`}>
            {price}
          </span>
          <Link
            to="/product/$id"
            params={{ id: product.id }}
            aria-label={`View ${product.name}`}
            className={`grid shrink-0 place-items-center rounded-full bg-crimson text-white transition-transform active:scale-95 ${compact ? "h-7 w-7" : "h-8 w-8"}`}
          >
            <ShoppingCart className={`${compact ? "h-3.5 w-3.5" : "h-4 w-4"}`} />
          </Link>
        </div>
      </div>
    </div>
  );
}

function NewsfeedRail({ posts, onOpenFeed }: { posts: FeedPost[]; onOpenFeed: () => void }) {
  const railRef = useRef<HTMLDivElement | null>(null);
  const scrollRail = (dir: 1 | -1) => {
    railRef.current?.scrollBy({ left: dir * 280, behavior: "smooth" });
  };

  return (
    <section className="home-pop-feed mt-10 rounded-[10px] px-4 py-6 sm:px-6 lg:mt-14 lg:px-8">
      {/* Header */}
      <div className="mb-4 flex items-end justify-between">
        <div>
          <span className="home-pop-strip mb-2 block" aria-hidden="true" />
          <div className="mb-1.5 flex items-center gap-2 text-newsfeed-violet">
            <Sparkles className="h-3.5 w-3.5" />
            <span className="text-[10px] font-extrabold uppercase tracking-widest">Community pulse</span>
          </div>
          <h2 className="font-wallet-display text-xl font-extrabold text-newsfeed-ink sm:text-2xl">
            Latest from Newsfeed
          </h2>
        </div>
        <Link
          to="/feed"
          search={{ post: undefined }}
          className="group flex items-center gap-1 rounded-full border border-newsfeed-line bg-newsfeed-surface px-3 py-1.5 text-xs font-bold text-newsfeed-violet shadow-newsfeed-panel transition-all hover:-translate-y-0.5 sm:text-sm"
        >
          View all
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {/* Scrollable rail */}
      <div className="relative">
        <div
          ref={railRef}
          className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] sm:gap-4 [&::-webkit-scrollbar]:hidden"
        >
          {posts.map((post) => (
            <CompactPostCard key={post.id} post={post} />
          ))}
          <JoinDiscussionCard posts={posts} onOpenFeed={onOpenFeed} />
        </div>

        {/* Desktop scroll controls */}
        <div className="pointer-events-none absolute inset-y-0 -right-2 hidden w-20 items-center justify-end bg-gradient-to-l from-home-feed via-home-feed/70 to-transparent lg:flex">
          <button
            type="button"
            onClick={() => scrollRail(1)}
            aria-label="Scroll to more posts"
            className="pointer-events-auto mr-2 grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-md transition-transform hover:scale-105"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="pointer-events-none absolute inset-y-0 -left-2 hidden w-20 items-center justify-start bg-gradient-to-r from-home-feed via-home-feed/70 to-transparent lg:flex">
          <button
            type="button"
            onClick={() => scrollRail(-1)}
            aria-label="Scroll back"
            className="pointer-events-auto ml-2 grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-md transition-transform hover:scale-105"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}

function CompactPostCard({ post }: { post: FeedPost }) {
  const image = post.media.find((item) => item.type === "image");
  const video = post.media.find((item) => item.type === "video" && item.poster_url);
  const thumb = image?.url ?? video?.poster_url ?? post.poster_url ?? null;
  const created = new Date(post.created_at);
  const timeLabel = Number.isNaN(created.getTime())
    ? "Recently"
    : created.toLocaleDateString(undefined, { month: "short", day: "numeric" });

  return (
    <Link
      to="/feed"
      search={{ post: post.id }}
      className="group flex h-auto w-[220px] shrink-0 snap-start flex-col overflow-hidden rounded-[10px] border border-slate-200/80 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md sm:w-[260px]"
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 p-3 pb-0">
        <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full border border-slate-100 bg-slate-100">
          <AvatarImage src={post.author_avatar_url} alt={post.author_name} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-bold text-slate-900">{post.author_name}</p>
          <p className="text-[10px] text-slate-400">{timeLabel}</p>
        </div>
      </div>

      {/* Text */}
      <p className="line-clamp-3 px-3 pt-2 text-[12px] leading-snug text-slate-700">
        {post.text || "A fresh update from the Oventric community."}
      </p>

      {/* Media */}
      {thumb ? (
        <div className="relative mt-2 aspect-[16/10] w-full overflow-hidden bg-slate-100">
          <img
            src={thumb}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </div>
      ) : null}

      {/* Engagement */}
      <div className="mt-auto flex items-center gap-4 border-t border-slate-100 px-3 py-2.5 text-[11px] font-medium text-slate-500">
        <span className="flex items-center gap-1">
          <Heart className="h-3.5 w-3.5 text-slate-400" /> {post.likes_count}
        </span>
        <span className="flex items-center gap-1">
          <MessageCircle className="h-3.5 w-3.5 text-slate-400" /> {post.comments_count}
        </span>
        <span className="flex items-center gap-1">
          <Eye className="h-3.5 w-3.5 text-slate-400" /> {post.views_count}
        </span>
      </div>
    </Link>
  );
}

function JoinDiscussionCard({ posts, onOpenFeed }: { posts: FeedPost[]; onOpenFeed: () => void }) {
  const authors = Array.from(new Map(posts.map((p) => [p.author_id, p])).values()).slice(0, 3);

  return (
    <button
      type="button"
      onClick={onOpenFeed}
      className="group flex h-auto w-[220px] shrink-0 snap-start flex-col items-center justify-center gap-4 overflow-hidden rounded-[10px] border-2 border-dashed border-crimson/30 bg-white p-5 text-center transition-all hover:-translate-y-0.5 hover:border-crimson hover:shadow-md sm:w-[260px]"
    >
      <div className="flex -space-x-2.5">
        {authors.map((post) => (
          <div
            key={post.author_id}
            className="h-10 w-10 overflow-hidden rounded-full border-2 border-white bg-slate-100 shadow-sm"
          >
            <AvatarImage src={post.author_avatar_url} alt={post.author_name} />
          </div>
        ))}
        {posts.length > authors.length && (
          <div className="grid h-10 w-10 place-items-center rounded-full border-2 border-white bg-slate-100 text-[10px] font-extrabold text-slate-500 shadow-sm">
            +{posts.length - authors.length}
          </div>
        )}
      </div>
      <div>
        <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Active now</p>
        <p className="mt-1 font-wallet-display text-lg font-extrabold text-slate-900">
          Join the discussion
        </p>
        <p className="mx-auto mt-1 max-w-[180px] text-[11px] leading-relaxed text-slate-500">
          See what creators and buyers are talking about.
        </p>
      </div>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-crimson px-4 py-2 text-[11px] font-bold text-white shadow-sm transition-transform group-hover:scale-105">
        Open feed
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </button>
  );
}



function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.53V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
    </svg>
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

  return (
    <footer className="home-pop-footer mt-12 overflow-hidden border-t lg:mt-16">
      <div className="mx-auto flex w-full max-w-[1280px] flex-col items-center gap-6 px-4 py-10 text-center sm:px-6 lg:flex-row lg:justify-between lg:gap-8 lg:px-8 lg:py-12 lg:text-left">
        <p className="text-sm text-newsfeed-muted">
          <span className="font-extrabold text-newsfeed-ink">Oventric</span> &copy; 2026
        </p>

        <div className="flex items-center gap-2">
          <SocialLink href="https://www.facebook.com/oventric" label="Facebook" icon={<Facebook className="h-4 w-4" />} />
          <SocialLink href="https://www.instagram.com/oventrictech?stkn=MTV1Y3UwaHhmYWRjOA==" label="Instagram" icon={<Instagram className="h-4 w-4" />} />
          <SocialLink href="https://tiktok.com/@oventric" label="TikTok" icon={<TikTokIcon className="h-4 w-4" />} />
          <SocialLink href="https://youtube.com/@oventric?si=W4Gir4DZB1cA21En" label="YouTube" icon={<Youtube className="h-4 w-4" />} />
        </div>

        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {links.map((l) => (
            <Link
              key={l.label}
              to={l.to}
              className="text-sm font-semibold text-newsfeed-muted transition-colors hover:text-newsfeed-violet"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}

function SocialLink({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  return (
    <a
      href={href}
      aria-label={label}
      target="_blank"
      rel="noopener noreferrer"
      className="home-pop-social inline-flex h-10 w-10 items-center justify-center rounded-full border text-newsfeed-muted transition-all hover:-translate-y-0.5 hover:text-newsfeed-violet"
    >
      {icon}
    </a>
  );
}
