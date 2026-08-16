import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  ChevronRight,
  Clock,
  Eye,
  EyeOff,
  Headphones,
  Newspaper,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Store,
  GraduationCap,
  Target,
  Wallet as WalletIcon,
  Users,
} from "lucide-react";
import { useAuthGate } from "@/lib/auth-gate/AuthGateProvider";
import { useOnboarding, type Currency } from "@/lib/onboarding/OnboardingContext";
import heroCollage from "@/assets/hero-collage.png.asset.json";
import { getWalletBalances } from "@/lib/wallet.functions";
import { getMyFullProfile } from "@/lib/profiles.functions";
import { getDiscoveryFeed } from "@/lib/discovery.functions";
import { listCourses } from "@/lib/academy.functions";
import { listMarketplaceCategories, type CategoryNode } from "@/lib/marketplace.functions";
import { formatMoney, safeFormatDisplayPrice } from "@/lib/fx-display";
import { COUNTRY_META } from "@/lib/currency/africa";
import { SiteNavbar } from "@/components/oventric/desktop/SiteNavbar";
import { Reveal } from "@/components/oventric/desktop/Reveal";
import { SiteFooter } from "@/components/oventric/desktop/SiteFooter";
import { DownloadAppSection } from "@/components/oventric/desktop/DownloadAppSection";
import { DesktopPromo } from "@/components/oventric/desktop/DesktopPromo";
import {
  TradeSecurelyBanner,
  ProductRails,
  SecuredPayments,
} from "@/components/oventric/desktop/DesktopCommerceSections";

import walletIcon from "@/assets/wallet-3d.webp.asset.json";
import marketIcon from "@/assets/marketplace-3d.png.asset.json";
import academyIcon from "@/assets/academy-3d.png.asset.json";
import bountiesIcon from "@/assets/bounties-3d.webp.asset.json";
import circlesIcon from "@/assets/circles-3d.png.asset.json";
import feedIcon from "@/assets/home-3d.png.asset.json";

export type DesktopHomeProps = {
  onSelect: (section: string) => void;
  onCreate: () => void;
};

type Card = { id: string; title: string; coverUrl: string | null; meta: string };

const FEATURES = [
  {
    label: "Marketplace",
    section: "Marketplace",
    icon: Store,
    img: marketIcon.url,
    title: "Sell digital and physical products, safely",
    body: "List once and reach buyers across Africa. Escrow holds every payment until delivery is confirmed, and buyers earn 2% cashback on each order.",
    tint: "from-emerald-500/10",
  },
  {
    label: "Academy",
    section: "Academy",
    icon: GraduationCap,
    img: academyIcon.url,
    title: "Learn a skill, or teach one and get paid",
    body: "Structured courses from practitioners, priced in your own currency. Publish your own course and keep the majority of every enrolment.",
    tint: "from-violet-500/10",
  },
  {
    label: "Bounties",
    section: "Bounties",
    icon: Target,
    img: bountiesIcon.url,
    title: "Post work. Fund it. Release on delivery.",
    body: "Bounties are funded up front and held in escrow, so solvers know the money is real and posters only release when the work lands.",
    tint: "from-amber-500/10",
  },
  {
    label: "Wallet",
    section: "Wallet",
    icon: WalletIcon,
    img: walletIcon.url,
    title: "One wallet, your home currency",
    body: "Fund with card, bank or mobile money through Flutterwave, Paystack and MiniPay. Main, cashback, bounty and escrow balances in one place.",
    tint: "from-teal-500/10",
  },
  {
    label: "Circles",
    section: "Circles",
    icon: Users,
    img: circlesIcon.url,
    title: "Communities that actually ship",
    body: "Join or forge a circle around a craft, a city or a product. Share posts to your circle, the main feed, or both.",
    tint: "from-pink-500/10",
  },
] as const;

const HUB_TILES = [
  { label: "Marketplace", section: "Marketplace", img: marketIcon.url },
  { label: "Academy", section: "Academy", img: academyIcon.url },
  { label: "Bounties", section: "Bounties", img: bountiesIcon.url },
  { label: "Wallet", section: "Wallet", img: walletIcon.url },
  { label: "Circles", section: "Circles", img: circlesIcon.url },
  { label: "Feed", section: "Feed", img: feedIcon.url },
] as const;

const STEPS = [
  {
    title: "Create your account",
    body: "Pick your country and currency once — everything you see is priced for you.",
  },
  {
    title: "Buy, learn or post work",
    body: "Shop the marketplace, enrol in a course, or fund a bounty in minutes.",
  },
  {
    title: "Get paid and withdraw",
    body: "Escrow releases to your wallet, then cash out to your bank or mobile money.",
  },
];

export function DesktopHome({ onSelect, onCreate }: DesktopHomeProps) {
  const { isAuthenticated, openGate } = useAuthGate();
  const { baseCurrency, country, balancesHidden, toggleBalancesHidden, fullName, storeName } =
    useOnboarding();
  const currency: Currency = country ? baseCurrency : "USD";
  const flag = country ? (COUNTRY_META[country]?.flag ?? "") : "";

  const loadBalances = useServerFn(getWalletBalances);
  const loadProfile = useServerFn(getMyFullProfile);
  const loadDiscovery = useServerFn(getDiscoveryFeed);
  const loadCourses = useServerFn(listCourses);
  const loadCats = useServerFn(listMarketplaceCategories);
  const navigate = useNavigate();

  const [main, setMain] = useState(0);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [name, setName] = useState<string>(fullName || storeName || "");
  const [products, setProducts] = useState<Card[]>([]);
  const [courses, setCourses] = useState<Card[]>([]);
  const [bounties, setBounties] = useState<Card[]>([]);
  const [counts, setCounts] = useState({ products: 0, courses: 0, bounties: 0 });
  const [cats, setCats] = useState<CategoryNode[]>([]);
  const [catTab, setCatTab] = useState<"digital" | "physical">("digital");
  const [q, setQ] = useState("");
  const [searchOpen, setSearchOpen] = useState<"nav" | "hero" | null>(null);
  const searchRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    let cancelled = false;
    loadCats()
      .then((rows) => {
        if (!cancelled) setCats(rows ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [loadCats]);

  useEffect(() => {
    if (!searchOpen) return;
    const onDoc = (e: MouseEvent) => {
      const el = searchRefs.current[searchOpen];
      if (el && !el.contains(e.target as Node)) setSearchOpen(null);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [searchOpen]);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (term.length < 2) return [] as Array<Card & { kind: "product" | "course" | "bounty" }>;
    const tag = (list: Card[], kind: "product" | "course" | "bounty") =>
      list.filter((c) => c.title.toLowerCase().includes(term)).map((c) => ({ ...c, kind }));
    return [
      ...tag(products, "product"),
      ...tag(courses, "course"),
      ...tag(bounties, "bounty"),
    ].slice(0, 8);
  }, [q, products, courses, bounties]);

  const catList = useMemo(() => cats.filter((c) => c.kind === catTab), [cats, catTab]);

  useEffect(() => {
    if (!isAuthenticated) {
      setMain(0);
      setAvatarUrl(null);
      return;
    }
    let cancelled = false;
    loadBalances()
      .then((r) => {
        if (cancelled) return;
        setMain(r.balances[baseCurrency] ?? 0);
      })
      .catch(() => {});
    loadProfile()
      .then((r) => {
        if (cancelled || !r?.profile) return;
        setAvatarUrl(r.profile.avatarUrl ?? null);
        if (r.profile.displayName) setName(r.profile.displayName);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, baseCurrency, loadBalances, loadProfile]);

  useEffect(() => {
    let cancelled = false;
    loadDiscovery()
      .then((r) => {
        if (cancelled) return;
        const p = r?.products ?? [];
        const b = r?.bounties ?? [];
        setProducts(
          p.slice(0, 8).map((x) => ({
            id: x.id,
            title: x.title,
            coverUrl: x.coverUrl,
            meta: safeFormatDisplayPrice({ price_usd: x.priceUsd }, currency),
          })),
        );
        setBounties(
          b.slice(0, 8).map((x) => ({
            id: x.id,
            title: x.title,
            coverUrl: x.coverUrl,
            meta: safeFormatDisplayPrice({ price_usd: x.amountUsd }, currency),
          })),
        );
        setCounts((c) => ({ ...c, products: p.length, bounties: b.length }));
      })
      .catch(() => {});
    loadCourses()
      .then((rows) => {
        if (cancelled) return;
        const list = rows ?? [];
        setCourses(
          list.slice(0, 8).map((c) => ({
            id: c.id,
            title: c.title,
            coverUrl: c.coverUrl,
            meta: c.isFree ? "Free" : safeFormatDisplayPrice({ price_usd: c.priceUSD }, currency),
          })),
        );
        setCounts((c) => ({ ...c, courses: list.length }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [loadDiscovery, loadCourses, currency]);

  const primary = () => (isAuthenticated ? onSelect("Feed") : openGate("generic"));

  const renderSearch = (place: "nav" | "hero") => {
    const compact = place === "nav";
    return (
      <div
        ref={(el) => {
          searchRefs.current[place] = el;
        }}
        className={compact ? "relative w-[240px] lg:w-[300px]" : "relative w-full"}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (results[0]) {
              setSearchOpen(null);
              if (results[0].kind === "product")
                navigate({ to: "/product/$id", params: { id: results[0].id }, search: { qty: 1 } });
              else onSelect(results[0].kind === "course" ? "Academy" : "Bounties");
            } else onSelect("Marketplace");
          }}
          className={`flex items-center rounded-[10px] border border-slate-200 bg-white transition-colors focus-within:border-crimson/45 ${
            compact ? "h-10 gap-2 rounded-xl pl-3 pr-1 shadow-sm" : "h-14 gap-3 pl-5 pr-2"
          }`}
        >
          <Search className={`shrink-0 text-slate-400 ${compact ? "h-4 w-4" : "h-5 w-5"}`} />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSearchOpen(place);
            }}
            onFocus={() => setSearchOpen(place)}
            placeholder={compact ? "Search Oventric" : "Search products, courses and bounties"}
            aria-label="Search Oventric"
            className="h-full min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
          />
          <button
            type="submit"
            className={`inline-flex items-center bg-crimson font-bold text-white transition-transform active:scale-95 ${
              compact ? "h-7 rounded-[10px] px-3 text-xs" : "h-10 rounded-[10px] px-5 text-sm"
            }`}
          >
            Search
          </button>
        </form>
        {searchOpen === place && results.length > 0 && (
          <div
            className={`absolute left-0 right-0 z-30 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl ${
              compact ? "top-11" : "top-16"
            }`}
          >
            {results.map((r) => (
              <button
                key={`${r.kind}-${r.id}`}
                type="button"
                onClick={() => {
                  setSearchOpen(null);
                  if (r.kind === "product")
                    navigate({ to: "/product/$id", params: { id: r.id }, search: { qty: 1 } });
                  else onSelect(r.kind === "course" ? "Academy" : "Bounties");
                }}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50"
              >
                <span className="h-11 w-11 shrink-0 overflow-hidden rounded-[10px] bg-slate-100">
                  {r.coverUrl && (
                    <img loading="lazy" decoding="async"
                      src={r.coverUrl}
                      alt=""
                      aria-hidden
                      className="h-full w-full object-cover"
                    />
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-slate-900">{r.title}</span>
                <span className="shrink-0 text-xs font-bold text-crimson">{r.meta}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-full bg-white text-slate-700">
      {/* SiteNavbar is now handled at the route level to support universal vs marketplace headers */}

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(1000px 480px at 10% -10%, rgba(59, 130, 246,0.12), transparent 70%), radial-gradient(800px 420px at 95% 0%, rgba(99,102,241,0.09), transparent 70%)",
          }}
        />

        {/* Left readability gradient — text overlaps the collage */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-full bg-gradient-to-r from-white via-white/[0.94] to-transparent sm:w-[56%] lg:w-[50%] xl:w-[46%]" />

        <div className="relative z-20 mx-auto grid h-full w-full max-w-[1400px] grid-cols-1 items-center px-5 py-8 sm:px-6 sm:py-12 lg:px-8 lg:py-16">
          <div className="max-w-2xl">
            <span className="web-eyebrow">
              <Sparkles className="h-3.5 w-3.5" /> 2% cashback on every purchase
            </span>
            <h1 className="mt-6 text-[clamp(2.5rem,5.2vw,4.5rem)] font-bold leading-[1.05] tracking-tight text-slate-900">
              The platform where Africa&apos;s builders
              <span className="text-crimson"> sell, learn and get paid.</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-slate-600 [text-shadow:0_1px_16px_rgba(255,255,255,0.9)]">
              Marketplace, academy, bounties and a multi-currency wallet in one place.
              Escrow-protected payments in your own currency, wherever you are on the continent.
            </p>
            <div className="mt-9 max-w-lg">{renderSearch("hero")}</div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={primary}
                className="web-glow-crimson inline-flex h-12 items-center gap-2 rounded-[10px] bg-crimson px-6 text-sm font-bold text-white transition-transform hover:brightness-110 active:scale-95"
              >
                {isAuthenticated ? "Visit feed" : "Get started free"}{" "}
                <ArrowRight className="h-4 w-4" strokeWidth={3} />
              </button>
              <button
                type="button"
                onClick={() => onSelect("Marketplace")}
                className="inline-flex h-12 items-center gap-2 rounded-[10px] border border-slate-200 bg-white px-6 text-sm font-bold text-slate-900 transition-all hover:border-crimson/40 hover:text-crimson active:scale-95"
              >
                Explore marketplace
              </button>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-500 [text-shadow:0_1px_12px_rgba(255,255,255,0.9)]">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-crimson" /> Escrow on every order
              </span>
              <span>54 African countries</span>
              <span>Card, bank &amp; mobile money</span>
            </div>

            {/* Mobile hero visual — hidden to keep the fold tight */}
            <img
              src={heroCollage.url}
              alt="Oventric members shopping, learning and chatting across the platform"
              className="hidden"
              loading="eager"
              decoding="async"
            />
          </div>
        </div>

        {/* Hero visual — large but contained so the right edge stays visible */}
        <div className="pointer-events-none absolute right-[-1%] top-1/2 z-0 hidden w-[78vw] max-w-[1080px] -translate-y-1/2 sm:block">
          <div
            className="pointer-events-none absolute -inset-10 -z-10 rounded-full blur-3xl"
            style={{
              backgroundImage:
                "radial-gradient(closest-side, rgba(59, 130, 246,0.14), transparent 75%), radial-gradient(closest-side at 70% 30%, rgba(99,102,241,0.12), transparent 75%)",
            }}
          />
          <img
            src={heroCollage.url}
            alt="Oventric members shopping, learning and chatting across the platform"
            className="hp-float w-full select-none object-contain drop-shadow-[0_30px_80px_rgba(15,23,42,0.14)]"
            loading="eager"
            decoding="async"
          />
        </div>
      </section>

      {/* Stats */}
      <section className="hp-dark border-y border-slate-200">
        <div className="mx-auto grid w-full max-w-[1200px] grid-cols-2 gap-6 px-5 py-10 sm:px-8 md:grid-cols-4 md:gap-8 md:py-12">
          {[
            { v: counts.products, l: "Live products" },
            { v: counts.courses, l: "Courses to learn" },
            { v: counts.bounties, l: "Open bounties" },
            { v: 54, l: "Countries covered" },
          ].map((s, i) => (
            <Reveal key={s.l} delay={i * 90}>
              <Stat value={s.v} label={s.l} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid w-full max-w-[1200px] grid-cols-1 gap-6 px-5 py-8 sm:grid-cols-2 sm:px-8 lg:grid-cols-4">
          {[
            {
              Icon: ShieldCheck,
              title: "Escrow protection",
              body: "Funds held until delivery is confirmed",
            },
            { Icon: Clock, title: "Fast delivery", body: "In-app handover with 48h auto-release" },
            { Icon: Star, title: "2% cashback", body: "Earned on every completed purchase" },
            {
              Icon: Headphones,
              title: "Support & disputes",
              body: "Live chat and mediated resolution",
            },
          ].map((t) => (
            <div key={t.title} className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-crimson/10 text-crimson">
                <t.Icon className="h-4 w-4" strokeWidth={2.4} />
              </span>
              <div className="min-w-0">
                <div className="text-sm font-bold text-slate-900">{t.title}</div>
                <div className="mt-0.5 text-xs leading-relaxed text-slate-500">{t.body}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Quick navigation — mirrors the app hub's glowing tile grid */}
      <section className="mx-auto w-full max-w-[1200px] px-5 pt-10 sm:px-8 sm:pt-14">
        <span className="web-eyebrow">Jump straight in</span>
        <h2 className="web-accent-underline mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          The whole ecosystem, one tap away
        </h2>
        <div className="web-rail mt-8 sm:grid sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
          {HUB_TILES.map((t) => (
            <button
              key={t.label}
              type="button"
              onClick={() => onSelect(t.section)}
              className="web-tile aspect-square w-[104px] shrink-0 p-3 sm:w-auto"
              aria-label={`Open ${t.label}`}
            >
              <img
                loading="lazy"
                decoding="async"
                src={t.img}
                alt=""
                aria-hidden
                className="h-10 w-10 object-contain sm:h-12 sm:w-12"
              />
              <span className="min-w-0 truncate text-[11px] font-black uppercase tracking-wider text-slate-700 sm:text-xs">
                {t.label}
              </span>
            </button>
          ))}
        </div>
      </section>

      <DesktopPromo onSelect={onSelect} />

      {/* Explore categories */}
      {catList.length > 0 && (
        <section className="mx-auto w-full max-w-[1200px] px-5 pt-14 sm:px-8 sm:pt-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Explore categories
            </h2>
            <div className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-white p-1">
              {(["digital", "physical"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setCatTab(k)}
                  className={`h-9 rounded-xl px-4 text-sm font-semibold capitalize transition-colors ${
                    catTab === k
                      ? "bg-crimson text-white"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
            {catList.slice(0, 6).map((c, i) => (
              <Reveal
                key={c.id}
                delay={(i % 3) * 90}
                className="web-card p-6"
              >
                <button
                  type="button"
                  onClick={() => onSelect("Marketplace")}
                  className="flex w-full items-center justify-between text-left"
                >
                  <span className="text-base font-bold text-slate-900">{c.name}</span>
                  <ChevronRight className="h-4 w-4 text-slate-500" />
                </button>
                {c.description && (
                  <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-500">
                    {c.description}
                  </p>
                )}
                {c.children.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {c.children.slice(0, 5).map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => onSelect("Marketplace")}
                        className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-crimson/50 hover:text-crimson"
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                )}
              </Reveal>
            ))}
          </div>
        </section>
      )}

      <ProductRails onSelect={onSelect} />

      {/* Live rails */}
      <section className="hp-dark border-t border-slate-200">
        <div className="mx-auto w-full max-w-[1200px] space-y-12 px-5 py-14 sm:space-y-16 sm:px-8 sm:py-20 lg:py-24">
          <CardGrid
            title="Fresh in the market"
            items={products}
            onSeeAll={() => onSelect("Marketplace")}
          />
          <CardGrid title="Learn on Academy" items={courses} onSeeAll={() => onSelect("Academy")} />
          <CardGrid title="Open bounties" items={bounties} onSeeAll={() => onSelect("Bounties")} />
        </div>
      </section>

      <TradeSecurelyBanner onLearnMore={() => onSelect("Help")} />

      {/* Feature blocks */}
      <section className="mx-auto w-full max-w-[1200px] px-5 py-14 sm:px-8 sm:py-20 lg:py-24">
        <h2 className="max-w-2xl text-2xl font-bold leading-tight tracking-tight text-slate-900 sm:text-4xl">
          Everything you need to build an income online.
        </h2>
        <div className="mt-10 space-y-12 sm:mt-16 sm:space-y-20">
          {FEATURES.map((f, i) => (
            <Reveal
              key={f.label}
              className={`grid grid-cols-1 items-center gap-8 lg:grid-cols-2 lg:gap-16 ${i % 2 === 1 ? "lg:[&>*:first-child]:order-2" : ""}`}
            >
              <div>
                <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-crimson">
                  <f.icon className="h-4 w-4" strokeWidth={2.5} /> {f.label}
                </span>
                <h3 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-slate-900">
                  {f.title}
                </h3>
                <p className="mt-4 max-w-lg text-base leading-relaxed text-slate-600">{f.body}</p>
                <button
                  type="button"
                  onClick={() => onSelect(f.section)}
                  className="mt-6 inline-flex items-center gap-1.5 text-sm font-bold text-crimson transition-colors hover:brightness-110"
                >
                  Open {f.label} <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <div
                className={`web-card flex h-64 items-center justify-center bg-gradient-to-br ${f.tint} to-transparent`}
              >
                <img loading="lazy" decoding="async"
                  src={f.img}
                  alt=""
                  aria-hidden
                  className="h-28 w-28 object-contain transition-transform duration-500 hover:scale-110"
                />
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="hp-dark border-y border-slate-200">
        <div className="mx-auto w-full max-w-[1200px] px-5 py-14 sm:px-8 sm:py-20 lg:py-24">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            How it works
          </h2>
          <div className="mt-10 grid grid-cols-1 gap-5 sm:mt-12 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal
                key={s.title}
                delay={i * 110}
                className="web-card p-7"
              >
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-crimson/10 text-sm font-black text-crimson">
                  {i + 1}
                </span>
                <h3 className="mt-5 text-lg font-bold text-slate-900">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.body}</p>
              </Reveal>
            ))}
          </div>

          <Reveal className="mt-12 flex flex-col items-start justify-between gap-6 rounded-[10px] border border-crimson/25 bg-gradient-to-br from-crimson/10 to-transparent p-6 sm:p-10 lg:mt-16 lg:flex-row lg:items-center lg:gap-10">
            <div>
              <h3 className="text-2xl font-bold text-slate-900">
                Ready to start earning on Oventric?
              </h3>
              <p className="mt-2 max-w-xl text-sm text-slate-600">
                Join builders across the continent trading, teaching and solving bounties —
                protected by escrow, paid in your own currency.
              </p>
            </div>
            <button
              type="button"
              onClick={primary}
              className="inline-flex h-12 shrink-0 items-center gap-2 rounded-2xl bg-emerald-600 px-6 text-sm font-bold text-white transition-transform hover:scale-[1.03] active:scale-95"
            >
              {isAuthenticated ? "Visit feed" : "Create your account"}{" "}
              <ArrowRight className="h-4 w-4" strokeWidth={3} />
            </button>
          </Reveal>
        </div>
      </section>

      <DownloadAppSection />

      <SecuredPayments />

      {/* Social connect */}
      <section className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col items-center justify-between gap-6 px-5 py-10 sm:px-8 md:flex-row">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Follow Oventric</h3>
            <p className="mt-1 text-sm text-slate-500">
              Get updates, tips and community highlights.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <SocialLink
              href="https://facebook.com/oventric"
              label="Facebook"
              icon={<FacebookIcon />}
            />
            <SocialLink
              href="https://instagram.com/oventric"
              label="Instagram"
              icon={<InstagramIcon />}
            />
            <SocialLink href="https://x.com/oventric" label="X" icon={<XIcon />} />
            <SocialLink href="https://tiktok.com/@oventric" label="TikTok" icon={<TikTokIcon />} />
            <SocialLink
              href="https://whatsapp.com/channel/oventric"
              label="WhatsApp Channel"
              icon={<WhatsAppIcon />}
            />
          </div>
        </div>
      </section>

      <SiteFooter onSelect={onSelect} currency={currency} flag={flag} />
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <div className="text-3xl font-bold tabular-nums text-slate-900">
        {value > 0 ? `${value}+` : "—"}
      </div>
      <div className="mt-1 text-sm text-slate-500">{label}</div>
    </div>
  );
}

function SocialLink({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition-all hover:-translate-y-0.5 hover:border-emerald-400 hover:text-emerald-600 hover:shadow-md"
    >
      {icon}
    </a>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.37 2.063-5.5 5.5-5.5 1.463 0 2.727.108 3.094.157v3.59h-2.125c-1.67 0-2.235.992-2.235 1.992v2.399h3.787l-.532 3.47h-3.255v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <rect
        x="2"
        y="2"
        width="20"
        height="20"
        rx="5"
        ry="5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <line
        x1="17.5"
        y1="6.5"
        x2="17.51"
        y2="6.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.53V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.04-.1z" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.124-1.43l-.365-.218-3.78.992.1-.392.007-.027.99-3.82-.235-.374a9.86 9.86 0 0 1-1.525-5.327C1.633 3.697 6.03.5 11.228.5c2.58 0 5.007 1.006 6.83 2.832 1.821 1.823 2.827 4.25 2.827 6.83 0 5.198-4.197 9.595-9.413 9.623M11.2 0C5.022 0 0 5.022 0 11.2c0 2.062.556 4.033 1.595 5.765L.547 23.55l6.766-1.778A11.154 11.154 0 0 0 22.4 11.2C22.4 5.022 17.378 0 11.2 0" />
    </svg>
  );
}

function CardGrid({
  title,
  items,
  onSeeAll,
}: {
  title: string;
  items: Card[];
  onSeeAll: () => void;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h2>
        <button
          type="button"
          onClick={onSeeAll}
          className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-600 transition-colors hover:text-emerald-700"
        >
          See all <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
        {items.map((it, i) => (
          <Reveal key={it.id} delay={(i % 4) * 80}>
            <button type="button" onClick={onSeeAll} className="hp-lift group w-full text-left">
              <span className="block h-40 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white">
                {it.coverUrl ? (
                  <img loading="lazy" decoding="async"
                    src={it.coverUrl}
                    alt={it.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-slate-400">
                    <Newspaper className="h-7 w-7" />
                  </span>
                )}
              </span>
              <span className="mt-3 block line-clamp-2 h-[36px] overflow-hidden text-sm font-semibold leading-[18px] text-slate-900">
                {it.title}
              </span>
              <span className="mt-1 block truncate text-sm font-bold text-emerald-600">
                {it.meta}
              </span>
            </button>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
