import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  BadgeCheck,
  Bell,
  ChevronRight,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Package,
  Settings,
  ShieldCheck,
  Sparkles,
  Store,
  User,
  Wallet as WalletIcon,
  FileText,
  LifeBuoy,
  Eye,
  EyeOff,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getMyFullProfile } from "@/lib/profiles.functions";
import { getWalletBalances } from "@/lib/wallet.functions";
import { getSellerMetrics } from "@/lib/dashboard/seller.functions";
import { getCreatorHub } from "@/lib/dashboard/creator.functions";
import { formatMoney, computeDisplayPrice } from "@/lib/fx-display";
import { usdEquivalent, visibleMoney } from "@/lib/money-visibility";
import { useOnboarding, type Currency } from "@/lib/onboarding/OnboardingContext";
import { useAuthGate } from "@/lib/auth-gate/AuthGateProvider";
import { OPEN_PROFILE_SETTINGS_EVENT } from "@/components/oventric/ProfileDropdown";
import { NotificationSettingsPanel } from "@/components/oventric/dashboard/NotificationSettingsPanel";
import { AppSheet } from "./AppSheet";
import { haptic } from "@/lib/haptics";

function tierInfo(tier: string | undefined) {
  const n = Number(/TIER_(\d)/.exec(tier ?? "")?.[1] ?? 0);
  if (n >= 3) return { label: "Tier 3 · Fully verified", cls: "text-emerald-300 bg-emerald-400/10" };
  if (n === 2) return { label: "Tier 2 · Commerce ready", cls: "text-sky-300 bg-sky-400/10" };
  if (n === 1) return { label: "Tier 1 · Email verified", cls: "text-amber-300 bg-amber-400/10" };
  return { label: "Tier 0 · Guest", cls: "text-white/60 bg-white/5" };
}

/** Native app Account hub — identity, shortcuts and settings in one compact screen. */
export function AppAccount({ onSelect }: { onSelect: (section: string) => void }) {
  const navigate = useNavigate();
  const { isAuthenticated, openGate } = useAuthGate();
  const { baseCurrency, balancesHidden, toggleBalancesHidden } = useOnboarding();
  const currency = (baseCurrency ?? "USD") as Currency;
  const [notifOpen, setNotifOpen] = useState(false);
  const [sheet, setSheet] = useState<"wallet" | "seller" | "creator" | null>(null);

  const loadProfile = useServerFn(getMyFullProfile);
  const fetchBalances = useServerFn(getWalletBalances);
  const fetchSellerMetrics = useServerFn(getSellerMetrics);
  const fetchCreatorHub = useServerFn(getCreatorHub);

  const { data: prof } = useQuery({
    queryKey: ["app-account-profile"],
    queryFn: () => loadProfile(),
    enabled: isAuthenticated,
    staleTime: 60_000,
  });
  const { data: balances } = useQuery({
    queryKey: ["app-wallet-balances"],
    queryFn: () => fetchBalances(),
    enabled: isAuthenticated,
    staleTime: 30_000,
  });
  const { data: sellerMetrics } = useQuery({
    queryKey: ["app-seller-metrics"],
    queryFn: () => fetchSellerMetrics(),
    enabled: isAuthenticated && sheet === "seller",
    staleTime: 60_000,
  });
  const { data: creatorHub } = useQuery({
    queryKey: ["app-creator-hub-summary"],
    queryFn: () => fetchCreatorHub({ data: { tzOffset: -new Date().getTimezoneOffset() } }),
    enabled: isAuthenticated && sheet === "creator",
    staleTime: 60_000,
  });

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-4 px-8 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-white/[0.05]">
          <User className="h-7 w-7 text-white/60" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-white">Your Oventric account</h1>
          <p className="mt-1 text-[13px] text-white/50">
            Sign in to manage your profile, shop, wallet and settings.
          </p>
        </div>
        <button
          type="button"
          onClick={() => openGate("generic")}
          className="rounded-[10px] bg-[#E5484D] px-6 py-2.5 text-sm font-semibold text-white"
        >
          Sign in
        </button>
      </div>
    );
  }

  const p = prof?.profile;
  const tier = tierInfo(p?.verificationTier);
  const verified = !!p?.verificationTier && p.verificationTier !== "TIER_0";
  const available = balances ? (balances.balances[currency] ?? 0) : null;
  const escrow = balances ? (balances.escrow[currency] ?? 0) : null;
  const money = (n: number | null) => n == null ? "—" : visibleMoney(n, currency, balancesHidden);
  const initials =
    (p?.displayName || "OV")
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "OV";

  const openSettings = () => window.dispatchEvent(new Event(OPEN_PROFILE_SETTINGS_EVENT));

  const signOut = async () => {
    haptic("medium");
    const { error } = await supabase.auth.signOut();
    if (error) return toast.error("Sign-out failed", { description: error.message });
    toast.success("Signed out");
    navigate({ to: "/" });
  };

  type Row = { icon: typeof User; label: string; hint?: string; run: () => void; tone?: string };
  const groups: { title: string; rows: Row[] }[] = [
    {
      title: "You",
      rows: [
        { icon: User, label: "My profile", hint: "Posts, skills, collections", tone: "text-sky-300",
          run: () => p && navigate({ to: "/profile/$id", params: { id: p.userId } }) },
        { icon: Store, label: "My shop", hint: "Storefront and products", tone: "text-violet-300",
          run: () => p && navigate({ to: "/shop/$id", params: { id: p.userId } }) },
        { icon: LayoutDashboard, label: "Seller dashboard", hint: "Sales, earnings, shop tools", tone: "text-amber-300",
          run: () => navigate({ to: "/dashboard" }) },
      ],
    },
    {
      title: "Money & orders",
      rows: [
        { icon: WalletIcon, label: "Wallet", hint: "Top up, withdraw, payouts", tone: "text-emerald-300", run: () => onSelect("Wallet") },
        { icon: Package, label: "Purchases & sales", hint: "Track every order", tone: "text-orange-300", run: () => onSelect("Purchases") },
      ],
    },
    {
      title: "Settings",
      rows: [
        { icon: Settings, label: "Edit profile & verification", hint: "Name, avatar, contact, KYC, password", tone: "text-white/80", run: openSettings },
        { icon: Bell, label: "Notifications", hint: "Choose what pings you", tone: "text-white/80", run: () => setNotifOpen(true) },
      ],
    },
    {
      title: "Support",
      rows: [
        { icon: HelpCircle, label: "Help centre", tone: "text-white/80", run: () => navigate({ to: "/help" }) },
        { icon: LifeBuoy, label: "Report a problem", tone: "text-white/80", run: () => navigate({ to: "/report-problem" }) },
        { icon: FileText, label: "Privacy policy", tone: "text-white/80", run: () => navigate({ to: "/privacy" }) },
      ],
    },
  ];

  return (
    <div className="px-4 pb-28 pt-[calc(1rem+env(safe-area-inset-top))] text-white">
      {/* Identity card */}
      <button
        type="button"
        onClick={() => p && navigate({ to: "/profile/$id", params: { id: p.userId } })}
        className="flex w-full items-center gap-3 rounded-[16px] border border-white/[0.06] bg-white/[0.03] p-3.5 text-left active:bg-white/[0.06]"
      >
        <span className="relative shrink-0">
          {p?.avatarUrl ? (
            <img src={p.avatarUrl} alt="" className="h-14 w-14 rounded-full object-cover" />
          ) : (
            <span className="grid h-14 w-14 place-items-center rounded-full bg-[#E5484D]/20 text-sm font-bold text-[#E5484D]">
              {initials}
            </span>
          )}
          {verified && (
            <BadgeCheck className="absolute -bottom-0.5 -right-0.5 h-5 w-5 fill-sky-500 text-[#070A08]" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold">{p?.displayName || "Your account"}</span>
          <span className="block truncate text-[12px] text-white/45">{p?.email ?? (p?.username ? `@${p.username}` : "")}</span>
          <span className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${tier.cls}`}>
            <ShieldCheck className="h-3 w-3" /> {tier.label}
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-white/30" />
      </button>

      {/* Balance strip */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          haptic("select");
          setSheet("wallet");
        }}
        className="mt-3 flex w-full items-center rounded-[16px] border border-white/[0.06] bg-gradient-to-br from-[#E5484D]/15 to-transparent py-3 text-left active:bg-white/[0.05]"
      >
        <span className="grid flex-1 grid-cols-2 divide-x divide-white/[0.06]">
          <span className="px-4">
            <span className="block text-[10px] uppercase tracking-wider text-white/45">Available</span>
            <span className="block text-[16px] font-semibold tabular-nums">{money(available)}</span>
            {available !== null && usdEquivalent(available, currency, balancesHidden) && <span className="block text-[10px] text-white/45">{usdEquivalent(available, currency, balancesHidden)}</span>}
          </span>
          <span className="px-4">
            <span className="block text-[10px] uppercase tracking-wider text-white/45">In escrow</span>
            <span className="block text-[16px] font-semibold tabular-nums">{money(escrow)}</span>
            {escrow !== null && usdEquivalent(escrow, currency, balancesHidden) && <span className="block text-[10px] text-white/45">{usdEquivalent(escrow, currency, balancesHidden)}</span>}
          </span>
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            haptic("select");
            toggleBalancesHidden();
          }}
          aria-label={balancesHidden ? "Show amounts" : "Hide amounts"}
          className="mr-3 grid size-8 shrink-0 place-items-center rounded-full bg-white/[0.06] text-white/70"
        >
          {balancesHidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>

      {/* Seller Hub spotlight — visible to any signed-in user */}
      {isAuthenticated && (
        <button
          type="button"
          onClick={() => {
            haptic("select");
            setSheet("seller");
          }}
          className="mt-3 flex w-full items-center gap-3 rounded-[16px] border border-violet-400/20 bg-gradient-to-br from-violet-500/20 via-[#E5484D]/10 to-transparent p-3.5 text-left active:bg-violet-500/25"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-gradient-to-br from-violet-500 to-[#E5484D]">
            <Sparkles className="h-5 w-5 text-white" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold">Seller Hub</span>
            <span className="block truncate text-[11px] text-white/50">
              Revenue, shop visits, engagement and growth
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-white/40" />
        </button>
      )}

      {/* Creator Hub spotlight */}
      {p?.isCreator && (
        <button
          type="button"
          onClick={() => {
            haptic("select");
            setSheet("creator");
          }}
          className="mt-2 flex w-full items-center gap-3 rounded-[16px] border border-fuchsia-400/20 bg-gradient-to-br from-fuchsia-500/20 via-violet-500/10 to-transparent p-3.5 text-left active:bg-fuchsia-500/25"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-gradient-to-br from-fuchsia-500 to-violet-500">
            <Sparkles className="h-5 w-5 text-white" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold">Creator's Dashboard</span>
            <span className="block truncate text-[11px] text-white/50">
              Audience, post performance, reach and sales from posts
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-white/40" />
        </button>
      )}

      {groups.map((g) => (
        <section key={g.title} className="mt-5">
          <h2 className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-white/35">{g.title}</h2>
          <div className="overflow-hidden rounded-[16px] border border-white/[0.06] bg-white/[0.03]">
            {g.rows.map((r, i) => (
              <button
                key={r.label}
                type="button"
                onClick={() => {
                  haptic("select");
                  r.run();
                }}
                className={`flex w-full items-center gap-3 px-3.5 py-3 text-left active:bg-white/[0.06] ${i > 0 ? "border-t border-white/[0.05]" : ""}`}
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-white/[0.05]">
                  <r.icon className={`h-4 w-4 ${r.tone ?? ""}`} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium">{r.label}</span>
                  {r.hint && <span className="block truncate text-[11px] text-white/40">{r.hint}</span>}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-white/25" />
              </button>
            ))}
          </div>
        </section>
      ))}

      <button
        type="button"
        onClick={signOut}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-[16px] border border-[#E5484D]/30 py-3 text-[14px] font-semibold text-[#E5484D] active:bg-[#E5484D]/10"
      >
        <LogOut className="h-4 w-4" /> Sign out
      </button>

      {/* Wallet quick glance */}
      <AppSheet open={sheet === "wallet"} onClose={() => setSheet(null)}
        header={<h2 className="px-4 pb-2 text-[15px] font-semibold text-white">Your wallet</h2>}>
        <div className="px-4 pb-8">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-[14px] border border-white/[0.06] bg-gradient-to-br from-[#E5484D]/15 to-transparent p-3.5">
              <div className="text-[10px] uppercase tracking-wider text-white/45">Available</div>
              <div className="mt-1 text-[18px] font-semibold tabular-nums">{money(available)}</div>
              {available !== null && usdEquivalent(available, currency, balancesHidden) && <div className="text-[10px] text-white/45">{usdEquivalent(available, currency, balancesHidden)}</div>}
            </div>
            <div className="rounded-[14px] border border-white/[0.06] bg-white/[0.03] p-3.5">
              <div className="text-[10px] uppercase tracking-wider text-white/45">In escrow</div>
              <div className="mt-1 text-[18px] font-semibold tabular-nums">{money(escrow)}</div>
              {escrow !== null && usdEquivalent(escrow, currency, balancesHidden) && <div className="text-[10px] text-white/45">{usdEquivalent(escrow, currency, balancesHidden)}</div>}
            </div>
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-white/45">
            Top up, withdraw, set your payout details and see every transaction in your full wallet.
          </p>
          <button
            type="button"
            onClick={() => {
              haptic("select");
              setSheet(null);
              onSelect("Wallet");
            }}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-[12px] bg-[#E5484D] py-3 text-[14px] font-semibold text-white active:bg-[#E5484D]/85"
          >
            Explore your wallet <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </AppSheet>

      {/* Seller Hub quick glance */}
      <AppSheet open={sheet === "seller"} onClose={() => setSheet(null)}
        header={<h2 className="px-4 pb-2 text-[15px] font-semibold text-white">Seller Hub</h2>}>
        <div className="px-4 pb-8">
          <div className="rounded-[14px] border border-violet-400/20 bg-gradient-to-br from-violet-500/20 via-[#E5484D]/10 to-transparent p-4">
            <div className="text-[10px] uppercase tracking-wider text-white/45">Total revenue</div>
            <div className="mt-1 text-[22px] font-bold tabular-nums">
              {sellerMetrics
                ? visibleMoney(computeDisplayPrice({ original_currency: "USD", original_amount: sellerMetrics.totalRevenueUSD }, currency).value, currency, balancesHidden)
                : "—"}
            </div>
            {sellerMetrics && currency !== "USD" && (
              <div className="text-[11px] text-white/45">{balancesHidden ? "••••" : `≈ ${formatMoney(sellerMetrics.totalRevenueUSD, "USD")}`}</div>
            )}
          </div>
          <div className="mt-2.5 grid grid-cols-3 gap-2.5">
            {[
              { label: "Sales", value: sellerMetrics?.totalSales },
              { label: "Shop visits", value: sellerMetrics?.shopVisits },
              { label: "Products", value: sellerMetrics?.totalProducts },
              { label: "Product views", value: sellerMetrics?.totalViews },
              { label: "Conversations", value: sellerMetrics?.conversations },
              { label: "Conversion", value: sellerMetrics ? `${sellerMetrics.conversionRate}%` : undefined },
            ].map((s) => (
              <div key={s.label} className="rounded-[12px] border border-white/[0.06] bg-white/[0.03] p-3">
                <div className="text-[15px] font-semibold tabular-nums">{s.value ?? "—"}</div>
                <div className="mt-0.5 text-[10px] uppercase tracking-wider text-white/40">{s.label}</div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              haptic("select");
              setSheet(null);
              navigate({ to: "/seller-hub" });
            }}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-[12px] bg-gradient-to-r from-violet-500 to-[#E5484D] py-3 text-[14px] font-semibold text-white active:opacity-85"
          >
            Explore your Seller Hub <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </AppSheet>

      {/* Creator Hub quick glance */}
      <AppSheet open={sheet === "creator"} onClose={() => setSheet(null)}
        header={<h2 className="px-4 pb-2 text-[15px] font-semibold text-white">Creator's Dashboard</h2>}>
        <div className="px-4 pb-8">
          <div className="rounded-[14px] border border-fuchsia-400/20 bg-gradient-to-br from-fuchsia-500/20 via-violet-500/10 to-transparent p-4">
            <div className="text-[10px] uppercase tracking-wider text-white/45">Sales from your showcase</div>
            <div className="mt-1 text-[22px] font-bold tabular-nums">
              {creatorHub
                ? visibleMoney(computeDisplayPrice({ original_currency: "USD", original_amount: creatorHub.postSales.revenueUSD }, currency).value, currency, balancesHidden)
                : "—"}
            </div>
            {creatorHub && currency !== "USD" && (
              <div className="text-[11px] text-white/45">{balancesHidden ? "••••" : `≈ ${formatMoney(creatorHub.postSales.revenueUSD, "USD")}`}</div>
            )}
          </div>
          <div className="mt-2.5 grid grid-cols-3 gap-2.5">
            {[
              { label: "Followers", value: creatorHub?.followers },
              { label: "New this week", value: creatorHub?.newFollowers7d },
              { label: "Engagement", value: creatorHub ? `${creatorHub.engagementRate}%` : undefined },
              { label: "Post views", value: creatorHub?.reach.postViews },
              { label: "Showcase views", value: creatorHub?.showcase.views },
              { label: "Watch time", value: creatorHub ? `${Math.round(creatorHub.showcase.watchSeconds / 60)}m` : undefined },
            ].map((s) => (
              <div key={s.label} className="rounded-[12px] border border-white/[0.06] bg-white/[0.03] p-3">
                <div className="text-[15px] font-semibold tabular-nums">{s.value ?? "—"}</div>
                <div className="mt-0.5 text-[10px] uppercase tracking-wider text-white/40">{s.label}</div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              haptic("select");
              setSheet(null);
              navigate({ to: "/creator-hub" });
            }}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-[12px] bg-gradient-to-r from-fuchsia-500 to-violet-500 py-3 text-[14px] font-semibold text-white active:opacity-85"
          >
            Explore your Creator's Dashboard <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </AppSheet>

      <AppSheet open={notifOpen} onClose={() => setNotifOpen(false)} tall
        header={<h2 className="px-4 pb-2 text-[15px] font-semibold text-white">Notifications</h2>}>
        <div className="px-4 pb-8">
          <NotificationSettingsPanel />
        </div>
      </AppSheet>
    </div>
  );
}
