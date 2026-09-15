import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Store,
  Target,
  GraduationCap,
  Newspaper,
  ChevronRight,
  KeyRound,
  Star,
  Plus,
  PenSquare,
  Search,
  Filter,
  Bell,
  Wallet as WalletIcon,
} from "lucide-react";
import { useAuthGate } from "@/lib/auth-gate/AuthGateProvider";
import { useOnboarding, type Currency } from "@/lib/onboarding/OnboardingContext";
import { getMyFullProfile } from "@/lib/profiles.functions";
import { getDiscoveryFeed } from "@/lib/discovery.functions";
import { listCourses } from "@/lib/academy.functions";
import { safeFormatDisplayPrice, formatMoney, usdRate } from "@/lib/fx-display";
import { AvatarImage } from "@/components/oventric/AvatarImage";
import { SellSwitcherModal } from "@/components/oventric/SellSwitcherModal";
import { CoursePublishWizard } from "@/components/oventric/CoursePublishWizard";
import type { ChoiceKey } from "@/components/oventric/CreatePanel";
import { getTopUsers, type TopUser } from "@/lib/top-users.functions";
import {
  NotificationsDrawer,
  useUnreadNotificationsCount,
} from "@/components/oventric/NotificationsDrawer";
import { CountBadge } from "@/components/oventric/CountBadge";

import { PromoInterstitial } from "@/components/oventric/PromoInterstitial";

import { HubPromoCarousel } from "@/components/oventric/hub/HubPromoCarousel";
import { AllFeaturesSheet } from "@/components/oventric/hub/AllFeaturesSheet";
import { ExploreCategories } from "@/components/oventric/hub/ExploreCategories";
import { FeaturedProductCard } from "@/components/oventric/hub/FeaturedProductCard";
import { WalletDetailModal } from "@/components/oventric/hub/WalletDetailModal";
import { CommunityRail } from "@/components/oventric/hub/CommunityRail";
import { AddCapitalModal } from "@/components/oventric/wallet/AddCapitalModal";
import { PayoutModal } from "@/components/oventric/wallet/PayoutModal";
import { MegaMenu } from "@/components/oventric/MegaMenu";
import { getWalletBalances } from "@/lib/wallet.functions";
import logoFull from "@/assets/oventric-full-transparent.png";


type Counts = Partial<Record<string, number>>;

export type HubProps = {
  onSelect: (section: string) => void;
  onCreate: (choice?: ChoiceKey) => void;
  onOpenMessages: () => void;
  counts?: Counts;
  returnedToHub?: boolean;
};

/** ISO-2 country code → flag emoji (regional indicator pair). */
function flagEmoji(code: string | null | undefined): string {
  if (!code || code.length !== 2 || code === "OT") return "🌍";
  return String.fromCodePoint(
    ...code
      .toUpperCase()
      .split("")
      .map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/**
 * Time-of-day greeting. Rendered after hydration only: the server and the
 * visitor's browser can sit in different time zones, which would otherwise
 * cause a hydration mismatch.
 */
function Greeting() {
  const [text, setText] = useState("Welcome");
  useEffect(() => setText(greeting()), []);
  return <>{text}</>;
}


function fromUSD(usd: number, target: Currency): number {
  return target === "USD" ? usd : usd * usdRate(target);
}

export function HomeHub({ onSelect, onCreate, onOpenMessages, returnedToHub }: HubProps) {
  const { isAuthenticated, openGate } = useAuthGate();
  const {
    baseCurrency,
    country,
    fullName,
    storeName,
    require: requireTier,
  } = useOnboarding();
  const [sellOpen, setSellOpen] = useState(false);
  const [courseOpen, setCourseOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [addFundsOpen, setAddFundsOpen] = useState(false);
  const [payoutOpen, setPayoutOpen] = useState(false);
  const unreadNotifs = useUnreadNotificationsCount();
  const currency: Currency = country ? baseCurrency : "USD";

  const goSection = (section: string) =>
    section === "Messages" ? onOpenMessages() : onSelect(section);

  const loadBalances = useServerFn(getWalletBalances);
  const loadProfile = useServerFn(getMyFullProfile);
  const loadDiscovery = useServerFn(getDiscoveryFeed);
  const loadCourses = useServerFn(listCourses);
  const loadTopUsers = useServerFn(getTopUsers);

  const [main, setMain] = useState(0);
  const [cashback, setCashback] = useState(0);
  const [bounty, setBounty] = useState(0);
  const [escrow, setEscrow] = useState(0);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [topUsers, setTopUsers] = useState<TopUser[]>([]);

  const [name, setName] = useState<string>(fullName || storeName || "");
  const [products, setProducts] = useState<
    Array<{
      id: string;
      title: string;
      coverUrl: string | null;
      priceUsd: number;
      originalCurrency: string;
      originalAmount: number;
      fxSnapshot: { base: string; rates: Record<string, number> } | null;
    }>
  >([]);
  const [courses, setCourses] = useState<
    Array<{ id: string; title: string; coverUrl: string | null; priceUsd: number; isFree: boolean }>
  >([]);
  const [bounties, setBounties] = useState<
    Array<{ id: string; title: string; coverUrl: string | null; amountUsd: number }>
  >([]);

  useEffect(() => {
    if (!isAuthenticated) {
      setAvatarUrl(null);
      setMain(0);
      setCashback(0);
      setBounty(0);
      setEscrow(0);
      return;
    }
    let cancelled = false;
    loadProfile()
      .then((r) => {
        if (cancelled || !r?.profile) return;
        setAvatarUrl(r.profile.avatarUrl ?? null);
        if (r.profile.displayName) setName(r.profile.displayName);
      })
      .catch(() => {});
    loadBalances()
      .then((r) => {
        if (cancelled) return;
        setMain(r.balances[baseCurrency] ?? 0);
        setEscrow(r.escrow[baseCurrency] ?? 0);
        setCashback(r.cashback ?? 0);
        setBounty(r.bountyBalance ?? 0);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, baseCurrency, loadProfile, loadBalances]);

  useEffect(() => {
    let cancelled = false;
    loadDiscovery()
      .then((r) => {
        if (cancelled) return;
        setProducts(
          (r?.products ?? []).slice(0, 10).map((p) => ({
            id: p.id,
            title: p.title,
            coverUrl: p.coverUrl,
            priceUsd: p.priceUsd,
            originalCurrency: p.originalCurrency ?? "USD",
            originalAmount: Number(p.originalAmount ?? p.priceUsd ?? 0),
            fxSnapshot: p.fxSnapshot ?? null,
          })),
        );
        setBounties(
          (r?.bounties ?? []).slice(0, 10).map((b) => ({
            id: b.id,
            title: b.title,
            coverUrl: b.coverUrl,
            amountUsd: b.amountUsd,
          })),
        );
      })
      .catch(() => {});
    loadTopUsers()
      .then((r) => {
        if (cancelled) return;
        setTopUsers(r.users);
      })
      .catch(() => {});
    loadCourses()
      .then((rows) => {
        if (cancelled) return;
        setCourses(
          (rows ?? []).slice(0, 10).map((c) => ({
            id: c.id,
            title: c.title,
            coverUrl: c.coverUrl,
            priceUsd: c.priceUSD,
            isFree: c.isFree,
          })),
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [loadDiscovery, loadCourses]);

  return (
    <div className="hub-enter mx-auto w-full max-w-5xl px-3 md:px-6 pt-0 md:py-8 space-y-7 pb-24 bg-[#0A0A0B] min-h-screen">
      {/* Sticky top header — small mark, notifications, profile */}
      <header className="sticky top-0 z-40 -mx-3 px-3 md:-mx-6 md:px-6 py-4 bg-[#0A0A0B]/85 backdrop-blur-xl border-b border-white/[0.04]">
        <section className="flex items-center gap-3">
          <img
            loading="lazy"
            decoding="async"
            src={logoFull}
            alt="Oventric"
            className="h-7 w-auto shrink-0"
          />

          <div className="ml-auto flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => (isAuthenticated ? setNotifOpen(true) : openGate("generic"))}
              aria-label="Notifications"
              className="relative h-11 w-11 flex items-center justify-center rounded-full bg-[#141416] border border-white/5 text-white/70 active:scale-95 transition-transform"
            >
              <Bell className="w-5 h-5" strokeWidth={2} />
              <CountBadge count={unreadNotifs} ariaLabel={`${unreadNotifs} new notifications`} />
            </button>

            <button
              type="button"
              onClick={() => (isAuthenticated ? setMegaOpen(true) : openGate("generic"))}
              aria-label="Your profile menu"
              className="h-11 w-11 rounded-full overflow-hidden border border-white/10 shrink-0 active:scale-95 transition-transform bg-[#141416]"
            >
              <AvatarImage src={avatarUrl} alt={name || "You"} />
            </button>
          </div>
        </section>
      </header>

      {/* Greeting + wallet snippet */}
      <section className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <p className="text-[13px] font-medium text-white/45">
            <Greeting />, <span className="text-white/80 font-semibold">{name || "there"}</span> 👋
          </p>
          <h1 className="text-[26px] font-black leading-none text-white tracking-tight">Discover more.</h1>
          <p className="text-[13px] font-medium text-white/40">Shop. Connect. Grow.</p>
        </div>

        <button
          type="button"
          onClick={() => (isAuthenticated ? setWalletOpen(true) : openGate("generic"))}
          className="shrink-0 w-[150px] rounded-[14px] bg-[#141416] border border-white/[0.08] p-3 text-left active:scale-[0.97] transition-transform"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 space-y-1">
              <div className="text-[8.5px] font-bold uppercase tracking-[0.12em] text-white/35 truncate">
                Oventric Wallet
              </div>
              <div className="text-[15px] font-black text-white tracking-tight truncate">
                {isAuthenticated ? formatMoney(main, currency) : formatMoney(0, currency)}
              </div>
            </div>
            <div className="relative shrink-0 h-8 w-8 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <span className="pointer-events-none absolute inset-0 rounded-full bg-emerald-400/20 blur-md" />
              <WalletIcon className="relative w-4 h-4 text-emerald-400" strokeWidth={2} />
            </div>
          </div>
          <div className="mt-2 text-[11px] font-bold text-emerald-400 flex items-center gap-1">
            View wallet <ChevronRight className="w-3 h-3" />
          </div>
        </button>
      </section>

      {/* Search Header */}
      <section className="flex items-center gap-3">
        <div className="relative flex-1 group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-white/30 group-focus-within:text-[#E5484D] transition-colors" />
          <input 
            type="text"
            placeholder="Search products, shops, people..."
            className="w-full h-[52px] pl-11 pr-4 rounded-full bg-[#141416] border border-white/5 text-[15px] text-white placeholder:text-white/20 focus:outline-none focus:border-[#E5484D]/40 transition-all"
          />
        </div>
        <button className="h-[52px] w-[52px] flex items-center justify-center rounded-full bg-[#141416] border border-white/5 text-white/40 active:scale-95 transition-transform">
          <Filter className="w-5 h-5" />
        </button>
      </section>

      {/* Hero Section */}
      <section>
        <div className="relative overflow-hidden rounded-[16px]">
           <HubPromoCarousel onSelect={goSection} />
        </div>
      </section>

      {/* Explore Categories - mirrors reference: white sentence-case heading, compact glowing icon cards */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-[16px] font-bold text-white">Explore Categories</h2>
          <Link
            to="/"
            onClick={(e) => {
              e.preventDefault();
              onSelect("Marketplace");
            }}
            className="text-[13px] font-medium text-white/40 flex items-center gap-1"
          >
            See all <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <ExploreCategories onSelect={(cat) => {
          if (cat === "Academy") onSelect("Academy");
          else onSelect("Marketplace");
        }} />
      </section>

      {/* Featured This Week - compact 3-up cards, mirrors reference */}
      {products.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[16px] font-bold text-white flex items-center gap-1.5">🔥 Featured This Week</h2>
            <Link
              to="/"
              onClick={(e) => {
                e.preventDefault();
                onSelect("Marketplace");
              }}
              className="text-[13px] font-medium text-white/40 flex items-center gap-1"
            >
              See all <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {products.slice(0, 3).map((p) => (
              <FeaturedProductCard key={p.id} product={{
                ...p,
                priceUSD: p.priceUsd,
                originalCurrency: p.originalCurrency,
                originalAmount: p.originalAmount,
                fxSnapshot: p.fxSnapshot,
                rating: 4.7 + Math.random() * 0.3,
                vendor: "Oventric",
                name: p.title
              } as any} />
            ))}
          </div>
        </section>
      )}

      {/* Trending / What's Moving rail */}
      <MiniRail
        title="⚡ What's Moving"
        onSeeAll={() => onSelect("Marketplace")}
        items={products.slice(3, 10).map((p) => ({
          id: p.id,
          title: p.title,
          coverUrl: p.coverUrl,
          meta: `${(Math.random() * 2 + 1).toFixed(1)}k sold`,
          icon: "🔥",
          onClick: () => onSelect("Marketplace"),
        }))}
      />

      {/* Academy & Bounties in same UI style */}
      <MiniRail
        title="Academy Trending"
        onSeeAll={() => onSelect("Academy")}
        items={courses.map((c) => ({
          id: c.id,
          title: c.title,
          coverUrl: c.coverUrl,
          meta: c.isFree ? "Free" : safeFormatDisplayPrice({ price_usd: c.priceUsd }, currency),
          onClick: () => onSelect("Academy"),
        }))}
      />

      {/* Top Creators - Refined circle rail */}
      {topUsers.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[16px] font-bold text-white">Top Creators</h2>
            <button
              onClick={() => onSelect("Feed")}
              className="text-[13px] font-medium text-white/40 flex items-center gap-1"
            >
              See all <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide px-1 snap-x snap-mandatory">
            {topUsers.map((u) => (
              <Link
                key={u.userId}
                to="/profile/$id"
                params={{ id: u.slug }}
                className="flex flex-col items-center gap-2 shrink-0 group snap-start"
              >
                <div className="relative">
                  <div className="w-[72px] h-[72px] rounded-full p-[2px] bg-[#141416] border border-white/10 transition-transform duration-300 group-active:scale-90">
                    <div className="w-full h-full rounded-full overflow-hidden bg-[#1A1A1F]">
                      <AvatarImage src={u.avatarUrl} alt={u.displayName} />
                    </div>
                  </div>
                  {u.reputationStars >= 4.5 && (
                    <div className="absolute bottom-0 right-0 h-5 w-5 rounded-full bg-[#E5484D] border-2 border-[#0A0A0B] flex items-center justify-center shadow-lg shadow-[#E5484D]/20">
                      <Star className="w-2.5 h-2.5 fill-white text-white" />
                    </div>
                  )}
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-white/40 truncate w-[72px] text-center group-hover:text-white transition-colors">
                  {u.displayName.split(" ")[0]}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* From Our Community - real posts pulled from the news feed, horizontally scrollable */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-[16px] font-bold text-white flex items-center gap-1.5">👥 From Our Community</h2>
          <button onClick={() => onSelect("Feed")} className="text-[13px] font-medium text-white/40 flex items-center gap-1">
            See all <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <CommunityRail onOpenFeed={() => onSelect("Feed")} />
      </section>

      {/* Floating Action Button for Create (mirrored from App Chrome if not present) */}
      <div className="fixed bottom-24 right-6 z-50">
        <button 
          onClick={() => onCreate()}
          className="h-14 w-14 flex items-center justify-center rounded-full bg-[#E5484D] text-white shadow-[0_8px_25px_rgba(229,72,77,0.4)] active:scale-90 transition-all border border-white/10"
        >
          <Plus className="w-7 h-7" strokeWidth={3} />
        </button>
      </div>

      {!isAuthenticated && (
        <button
          type="button"
          onClick={() => openGate("generic")}
          className="w-full inline-flex items-center justify-center gap-2 h-14 rounded-[14px] bg-[#141416] border border-white/10 text-white text-[13px] font-black uppercase tracking-widest active:scale-95 transition-transform"
        >
          <KeyRound className="w-4 h-4" strokeWidth={3} /> Connect Account
        </button>
      )}

      <SellSwitcherModal open={sellOpen} onClose={() => setSellOpen(false)} />
      <CoursePublishWizard
        open={courseOpen}
        onClose={() => setCourseOpen(false)}
        onSaved={() => {
          setCourseOpen(false);
          onSelect("Academy");
        }}
      />
      <AllFeaturesSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        onSelect={goSection}
        onSell={() => requireTier(2, () => setSellOpen(true))}
      />
      <SellSwitcherModal open={sellOpen} onClose={() => setSellOpen(false)} />
      <NotificationsDrawer open={notifOpen} onClose={() => setNotifOpen(false)} />
      <MegaMenu open={megaOpen} onClose={() => setMegaOpen(false)} />
      <WalletDetailModal
        open={walletOpen}
        onClose={() => setWalletOpen(false)}
        balanceLabel={formatMoney(main, currency)}
        cashbackLabel={formatMoney(fromUSD(cashback, currency), currency)}
        bountyLabel={formatMoney(fromUSD(bounty, currency), currency)}
        escrowLabel={formatMoney(escrow, currency)}
        onAddFunds={() => {
          setWalletOpen(false);
          setAddFundsOpen(true);
        }}
        onWithdraw={() => {
          setWalletOpen(false);
          setPayoutOpen(true);
        }}
      />
      {addFundsOpen && <AddCapitalModal onClose={() => setAddFundsOpen(false)} />}
      {payoutOpen && <PayoutModal onClose={() => setPayoutOpen(false)} />}
    </div>
  );
}



type MiniRailItem = {
  id: string;
  title: string;
  coverUrl: string | null;
  meta: string;
  onClick: () => void;
};

function MiniRail({
  title,
  items,
  onSeeAll,
}: {
  title: string;
  items: MiniRailItem[];
  onSeeAll: () => void;
}) {
  if (items.length === 0) return null;
  return (
    <section>
      <div className="flex items-center justify-between mb-3 px-1">
        <h2 className="text-[16px] font-bold text-white">{title}</h2>
        <button
          type="button"
          onClick={onSeeAll}
          className="text-[13px] font-medium text-white/40 flex items-center gap-1"
        >
          See all <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none]">
        {items.map((it) => (
          <button
            key={it.id}
            type="button"
            onClick={it.onClick}
            className="shrink-0 w-28 text-left active:scale-95 transition-transform group"
          >
            <span className="block w-28 h-28 rounded-[14px] overflow-hidden bg-[#141416] border border-white/5 relative">

              {it.coverUrl ? (
                <img loading="lazy" decoding="async"
                  src={it.coverUrl}
                  alt={it.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="w-full h-full flex items-center justify-center text-white/20">
                  <Newspaper className="w-7 h-7" />
                </span>
              )}
            </span>
            <span className="mt-2 block text-[12px] font-bold text-white line-clamp-1 truncate group-hover:text-[#E5484D] transition-colors">
              {it.title}
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              {(it as any).icon && <span className="text-[10px]">{(it as any).icon}</span>}
              <span className="block text-[10.5px] text-white/40 font-medium">{(it as any).meta}</span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function SubChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] bg-black/25 border border-white/10 px-2.5 py-3 min-w-0">
      <div className="text-[10px] uppercase tracking-wide text-slate-500 truncate">{label}</div>
      <div className="text-xs font-bold text-white tabular-nums truncate">{value}</div>
    </div>
  );
}
