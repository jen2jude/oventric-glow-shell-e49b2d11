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
  Pause,
  Play,
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
import { AvatarImage } from "@/components/oventric/AvatarImage";
import { Button } from "@/components/ui/button";
import heroImage from "@/assets/home-hero.jpg";
import heroVideo from "@/assets/oventric-hero-loop.mp4.asset.json";
import skillsCtaImage from "@/assets/home-skills-bg.jpg";
import cashbackCreatorsImage from "@/assets/earn-cashback-creators.jpg";
import referralCreatorsImage from "@/assets/earn-referral-creators.jpg";
import accountCreatorImage from "@/assets/how-account-creator.jpg";
import marketplaceCreatorImage from "@/assets/how-marketplace-male-creator.jpg";
import paidCreatorImage from "@/assets/how-paid-creator.jpg";

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
  const [heroVideoPaused, setHeroVideoPaused] = useState(false);
  const heroVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (!reducedMotion && !connection?.saveData) setHeroVideoEnabled(true);
  }, []);

  const toggleHeroVideo = () => {
    const video = heroVideoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play();
      setHeroVideoPaused(false);
    } else {
      video.pause();
      setHeroVideoPaused(true);
    }
  };

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
          <img
            src={heroImage}
            alt="A creator working on digital products"
            width={1600}
            height={912}
            className="h-full w-full object-cover object-[75%_center]"
          />
          {heroVideoEnabled && (
            <video
              ref={heroVideoRef}
              src={heroVideo.url}
              poster={heroImage}
              muted
              autoPlay
              loop
              playsInline
              preload="metadata"
              aria-hidden="true"
              onPause={() => setHeroVideoPaused(true)}
              onPlay={() => setHeroVideoPaused(false)}
              className="home-pop-hero-video absolute inset-0 h-full w-full object-cover object-[75%_center]"
            />
          )}
          {/* white fade — text panel on the left, image stretches to both edges */}
          <div className="absolute inset-0 bg-gradient-to-r from-white/95 from-0% via-white/80 via-[30%] to-transparent to-[65%] sm:via-[38%] sm:to-[72%] lg:via-[42%] lg:to-[78%]" />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-home-canvas to-transparent" />
        </div>

        {heroVideoEnabled && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={toggleHeroVideo}
            aria-label={heroVideoPaused ? "Play hero animation" : "Pause hero animation"}
            title={heroVideoPaused ? "Play animation" : "Pause animation"}
            className="home-pop-hero-control absolute bottom-7 right-4 z-20 h-10 w-10 rounded-full border-home-line bg-home-surface/90 text-home-ink shadow-home-soft backdrop-blur-sm sm:bottom-9 sm:right-6"
          >
            {heroVideoPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </Button>
        )}

        <div className="relative z-10 mx-auto flex w-full max-w-[1280px] flex-col justify-center gap-6 px-4 py-14 sm:px-6 sm:py-20 lg:min-h-[520px] lg:px-8 lg:py-28">
          <div>
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
                className="home-pop-trust-card min-w-[85%] shrink-0 snap-center rounded-[14px] border p-5 transition-transform hover:-translate-y-1 sm:min-w-0 sm:flex sm:items-center sm:gap-3 sm:p-4"
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
            <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-5 lg:gap-4">
              {recentProducts.map((product) => (
                <div key={product.id} className="w-[72%] shrink-0 snap-start sm:w-auto sm:shrink">
                  <ProductCard product={product} currency={baseCurrency} />
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
                className="home-pop-category flex flex-col items-center gap-2 rounded-[14px] p-2 text-center transition-all active:scale-[0.98] sm:flex-row sm:gap-3 sm:p-4 sm:text-left sm:hover:-translate-y-1"
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
          action={{ label: "View all", onClick: () => navigate({ to: "/sellers" }) }}
        />
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-5 lg:gap-4">
          {sellers.map((s) => (
            <Link
              key={s.id}
              to="/shop/$id"
              params={{ id: s.slug || s.id }}
              className="flex w-[104px] shrink-0 flex-col items-center gap-2 rounded-[14px] border-slate-200/80 bg-transparent p-0 text-center transition-all sm:w-auto sm:shrink sm:border sm:bg-white sm:p-5 sm:hover:-translate-y-0.5 sm:hover:shadow-[0_12px_30px_-20px_rgba(15,23,42,0.5)]"
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
        <section className="relative mt-10 overflow-hidden rounded-[20px] lg:mt-14">
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
              <h2 className="font-[Outfit] text-2xl font-extrabold leading-tight text-slate-950 sm:text-3xl lg:text-[38px]">
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
        <SectionHead title="Ways to Earn More" />
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
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

        {/* --------------------------------------------------- why sell / why buy */}
        <SectionHead
          title="Why Oventric"
          subtitle="Everything you need to build an income online"
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
          {REASONS.map(({ Icon, tint, title, body }) => (
            <div
              key={title}
              className="rounded-[14px] border border-slate-200/80 bg-white p-4 transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_30px_-20px_rgba(15,23,42,0.5)] sm:p-5"
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

        {/* -------------------------------------------------------- how it works */}
        <SectionHead title="How It Works" subtitle="Three steps from sign-up to payout" />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 lg:gap-5">
          {STEPS.map((s, i) => (
            <article
              key={s.title}
              className="group overflow-hidden rounded-[10px] border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
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
                <span className="absolute left-5 top-5 grid h-10 w-10 place-items-center rounded-full bg-crimson font-[Outfit] text-sm font-extrabold text-primary-foreground shadow-md">
                  {i + 1}
                </span>
              </div>
              <div className="relative -mt-5 px-5 pb-6 sm:px-6 sm:pb-7">
                <h3 className="font-[Outfit] text-lg font-extrabold leading-tight text-slate-950">{s.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{s.body}</p>
              </div>
            </article>
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
          <ul className="mt-6 flex items-center gap-2.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:justify-center sm:overflow-visible">
            {PAY_METHODS.map((m) => (
              <li
                key={m.name}
                className="flex h-14 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white px-6 shadow-sm"
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
        <h3 className="font-[Outfit] text-2xl font-extrabold leading-tight text-slate-950 sm:text-3xl">{title}</h3>
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
    <p className="col-span-full rounded-[14px] border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-400">
      {children}
    </p>
  );
}

function Stat({ value, label }: { value?: number; label: string }) {
  return (
    <div className="rounded-[14px] border border-slate-200/80 bg-white/90 px-3 py-4 text-center shadow-sm backdrop-blur-sm">
      <p className="font-[Outfit] text-xl font-extrabold text-slate-950 sm:text-2xl">
        {value === undefined ? "—" : value.toLocaleString()}
      </p>
      <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
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
    <div className="home-pop-product group flex flex-col overflow-hidden rounded-[14px] border bg-home-surface transition-all hover:-translate-y-1">
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

function NewsfeedRail({ posts, onOpenFeed }: { posts: FeedPost[]; onOpenFeed: () => void }) {
  const railRef = useRef<HTMLDivElement | null>(null);
  const scrollRail = (dir: 1 | -1) => {
    railRef.current?.scrollBy({ left: dir * 280, behavior: "smooth" });
  };

  return (
    <section className="home-pop-feed mt-10 rounded-[20px] px-4 py-6 sm:px-6 lg:mt-14 lg:px-8">
      {/* Header */}
      <div className="mb-4 flex items-end justify-between">
        <div>
          <div className="mb-1.5 flex items-center gap-2 text-crimson">
            <Sparkles className="h-3.5 w-3.5" />
            <span className="text-[10px] font-extrabold uppercase tracking-widest">Community pulse</span>
          </div>
          <h2 className="font-[Outfit] text-xl font-extrabold text-slate-900 sm:text-2xl">
            Latest from Newsfeed
          </h2>
        </div>
        <Link
          to="/feed"
          search={{ post: undefined }}
          className="group flex items-center gap-1 text-xs font-bold text-crimson transition-opacity hover:opacity-80 sm:text-sm"
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
      className="group flex h-auto w-[220px] shrink-0 snap-start flex-col overflow-hidden rounded-[16px] border border-slate-200/80 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md sm:w-[260px]"
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
      className="group flex h-auto w-[220px] shrink-0 snap-start flex-col items-center justify-center gap-4 overflow-hidden rounded-[16px] border-2 border-dashed border-crimson/30 bg-white p-5 text-center transition-all hover:-translate-y-0.5 hover:border-crimson hover:shadow-md sm:w-[260px]"
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
        <p className="mt-1 font-[Outfit] text-lg font-extrabold text-slate-900">
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



function HomeFooter() {
  const links: Array<{ to: string; label: string }> = [
    { to: "/about", label: "About" },
    { to: "/help", label: "Help" },
    { to: "/terms", label: "Terms" },
    { to: "/privacy", label: "Privacy" },
    { to: "/report-problem", label: "Contact" },
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
      </div>
    </footer>
  );
}
