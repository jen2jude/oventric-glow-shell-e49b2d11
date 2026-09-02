import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  Menu,
  Bell,
  ScanLine,
  Eye,
  EyeOff,
  ShieldCheck,
  Info,
  Plus,
  ArrowUp,
  Send,
  ArrowDown,
  Sparkle,
  Zap,
  Lock,
  Wallet as WalletIcon,
  ChevronRight,
  ChevronUp,
  TrendingUp,
  ShoppingCart,
  Download,
  Award,
  ArrowLeftRight,
} from "lucide-react";
import { useOnboarding, type Currency } from "@/lib/onboarding/OnboardingContext";
import { useAuthGate } from "@/lib/auth-gate/AuthGateProvider";
import { getWalletBalances, listWalletTransactions, type WalletTxType } from "@/lib/wallet.functions";
import { formatMoney, usdRate } from "@/lib/fx-display";
import { MegaMenu } from "@/components/oventric/MegaMenu";
import {
  NotificationsDrawer,
  useUnreadNotificationsCount,
} from "@/components/oventric/NotificationsDrawer";

import { TransferModal } from "@/components/oventric/wallet/TransferModal";
import { AddCapitalModal } from "@/components/oventric/wallet/AddCapitalModal";
import { PayoutModal } from "@/components/oventric/wallet/PayoutModal";
import logoFull from "@/assets/oventric-full-transparent.png";
import wallet3d from "@/assets/wallet-hero-3d.png.asset.json";

function fmt(n: number, c: Currency) {
  return formatMoney(n, c);
}

function txStyle(type: WalletTxType, inflow: boolean) {
  if (type === "Marketplace Purchase" || type === "Ad Injection Charge")
    return { icon: ShoppingCart, tone: "bg-[#3B1030] text-[#F472B6]" };
  if (type === "Cashback Earned" || type === "Affiliate Cashback Payout")
    return { icon: Download, tone: "bg-[#0F2E23] text-[#34D399]" };
  if (type === "Gig Bounty Escrowed") return { icon: Award, tone: "bg-[#3A2A12] text-[#FBBF24]" };
  if (type === "Wallet Transfer Sent" || type === "Wallet Transfer Received")
    return { icon: ArrowLeftRight, tone: "bg-[#12283A] text-[#60A5FA]" };
  return inflow
    ? { icon: ArrowDown, tone: "bg-[#0F2E23] text-[#34D399]" }
    : { icon: ArrowUp, tone: "bg-[#2A1B3D] text-[#C084FC]" };
}

export function Wallet() {
  const { balances: localBalances, balancesHidden: hide, toggleBalancesHidden, homeCurrency } = useOnboarding();
  const [transferOpen, setTransferOpen] = useState(false);
  const [addFundsOpen, setAddFundsOpen] = useState(false);
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [subOpen, setSubOpen] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const { isAuthenticated, checked, openGate } = useAuthGate();
  const unreadNotifs = useUnreadNotificationsCount();

  const fetchBalances = useServerFn(getWalletBalances);
  const { data } = useQuery({
    queryKey: ["wallet-balances"],
    queryFn: () => fetchBalances({}),
    enabled: isAuthenticated,
    retry: false,
  });

  const fetchTx = useServerFn(listWalletTransactions);
  const { data: txData, isLoading: txLoading } = useQuery({
    queryKey: ["wallet-recent-tx"],
    queryFn: () => fetchTx({ data: { page: 1, pageSize: 50 } }),
    enabled: isAuthenticated,
    retry: false,
  });
  const allTx = txData?.items ?? [];

  const PAGE_SIZE = 5;
  const [txPage, setTxPage] = useState(0);
  const totalTxPages = Math.max(1, Math.ceil(allTx.length / PAGE_SIZE));
  const currentPage = Math.min(txPage, totalTxPages - 1);
  const recentTx = allTx.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE);

  // Group the current page's transactions by month
  const monthGroups = (() => {
    const map = new Map<string, { label: string; items: typeof recentTx }>();
    for (const t of recentTx) {
      const d = new Date(t.occurredAt);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const label = d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
      if (!map.has(key)) map.set(key, { label, items: [] });
      map.get(key)!.items.push(t);
    }
    return Array.from(map.values());
  })();

  const cur = homeCurrency;
  const available = data?.balances?.[cur] ?? localBalances[cur] ?? 0;
  const locked = data?.escrow?.[cur] ?? 0;
  const main = available + locked;
  const cashbackUSD = data?.cashback ?? 0;
  const bountyUSD = data?.bountyBalance ?? 0;
  const usdEquiv = main / (usdRate(cur) || 1);

  // Cashback estimator (tiers defined in USD, displayed in the user's currency)
  const rate = usdRate(cur) || 1;
  const tierMid = 1000 * rate;
  const tierTop = 5000 * rate;
  const [spend, setSpend] = useState(() => Math.round(tierMid * 2.5));
  const tiers = [
    { key: "base", label: "Baseline", range: `< ${fmt(tierMid, cur)}`, pct: 2 },
    { key: "elite", label: "Elite Tier", range: `${fmt(tierMid, cur)} – ${fmt(tierTop, cur)}`, pct: 3.5 },
    { key: "apex", label: "Apex Tier", range: `> ${fmt(tierTop, cur)}`, pct: 5 },
  ];
  const tier = spend < tierMid ? tiers[0] : spend <= tierTop ? tiers[1] : tiers[2];
  const annual = spend * 12 * (tier.pct / 100);
  const sliderPct = Math.min(100, (spend / (tierMid * 10)) * 100);

  const mask = (v: string) => (hide || !isAuthenticated ? "••••••" : v);

  const requireAuth = (cb: () => void) => {
    if (isAuthenticated) cb();
    else openGate("funding");
  };

  const actions = [
    {
      label: "Add Funds",
      icon: Plus,
      ring: "bg-[#8B5CF6]",
      text: "text-white",
      onClick: () => requireAuth(() => setAddFundsOpen(true)),
    },
    {
      label: "Withdraw",
      icon: ArrowUp,
      ring: "bg-transparent",
      text: "text-[#60A5FA]",
      onClick: () => requireAuth(() => setPayoutOpen(true)),
    },
    {
      label: "Send",
      icon: Send,
      ring: "bg-transparent",
      text: "text-emerald-400",
      onClick: () => requireAuth(() => setTransferOpen(true)),
    },
    {
      label: "Request",
      icon: ArrowDown,
      ring: "bg-[#6366F1]",
      text: "text-white",
      onClick: () => requireAuth(() => toast.info("Payment requests are coming soon")),
    },
  ];

  const subWallets = [
    {
      label: "Cashback Wallet",
      value: fmt(cashbackUSD * (usdRate(cur) || 1), cur),
      sub: "Redeem at checkout",
      icon: Sparkle,
      tone: "bg-[#2A1B3D] text-[#C084FC]",
      to: "/wallet/ledger" as const,
    },
    {
      label: "Bounty Earnings",
      value: fmt(bountyUSD * (usdRate(cur) || 1), cur),
      sub: "Earned from bounties",
      icon: Zap,
      tone: "bg-[#3A2A12] text-[#FBBF24]",
      to: "/wallet/ledger" as const,
    },
    {
      label: "Escrow Wallet",
      value: fmt(locked, cur),
      sub: "Locked in contracts",
      icon: Lock,
      tone: "bg-[#12283A] text-[#60A5FA]",
      to: "/wallet/ledger" as const,
    },
    {
      label: "Seller Earnings",
      value: fmt(available, cur),
      sub: "From marketplace sales",
      icon: WalletIcon,
      tone: "bg-[#0F2E23] text-[#34D399]",
      to: "/wallet/history" as const,
    },
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0B] pb-24 md:pb-10">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0A0A0B] px-4 h-14 flex items-center justify-between">
        <button
          aria-label="Menu"
          onClick={() => setMenuOpen(true)}
          className="text-white/80 hover:text-white active:scale-95 transition-transform"
        >
          <Menu className="w-6 h-6" />
        </button>
        <Link to="/" className="flex items-center">
          <img src={logoFull} alt="Oventric" className="h-6 w-auto" />
        </Link>
        <div className="flex items-center gap-4">
          <button
            aria-label="Notifications"
            onClick={() => (isAuthenticated ? setNotifOpen(true) : openGate("funding"))}
            className="relative text-white/80 hover:text-white active:scale-95 transition-transform"
          >
            <Bell className="w-5 h-5" />
            {unreadNotifs > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#E5484D]" />
            )}
          </button>
          <button
            aria-label="Scan to pay"
            onClick={() => requireAuth(() => setTransferOpen(true))}
            className="text-white/80 hover:text-white active:scale-95 transition-transform"
          >
            <ScanLine className="w-5 h-5" />
          </button>
        </div>
      </header>

      <MegaMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
      <NotificationsDrawer open={notifOpen} onClose={() => setNotifOpen(false)} />

      <main className="max-w-2xl mx-auto px-5 pt-3 space-y-5">
        {/* Title row */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-white text-2xl font-black tracking-tight">Sovereign Wallet</h1>
              <ShieldCheck className="w-5 h-5 text-[#F5A524]" />
            </div>
            <p className="text-[13px] text-slate-500 mt-1">
              Multi-currency · Cashback engine · Payout controls
            </p>
          </div>
          <button
            onClick={() => requireAuth(toggleBalancesHidden)}
            aria-label={hide ? "Show balances" : "Hide balances"}
            className="w-11 h-11 shrink-0 rounded-[10px] bg-[#141418] border border-white/10 flex items-center justify-center text-white/80 hover:text-white"
          >
            {hide ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>

        {/* Sign-in prompt for anonymous visitors */}
        {!isAuthenticated && checked && (
          <button
            onClick={() => openGate("funding")}
            className="w-full rounded-[10px] border border-[#E5484D]/30 bg-[#E5484D]/10 px-4 py-3 text-left"
          >
            <span className="text-[14px] font-semibold text-[#E5484D]">
              Wallet is Locked, Sign in to view
            </span>
          </button>
        )}

        {/* Main balance card */}
        <div className="relative overflow-hidden rounded-[10px] border border-white/10 bg-gradient-to-br from-[#151327] via-[#101020] to-[#0C0C16] p-5">
          <span className="absolute top-5 right-5 w-2.5 h-2.5 rounded-full bg-[#3B82F6]" />
          <img
            src={wallet3d.url}
            alt=""
            aria-hidden
            width={1024}
            height={1024}
            className="pointer-events-none absolute right-2 top-8 w-[42%] max-w-[170px] select-none drop-shadow-[0_12px_24px_rgba(0,0,0,0.45)]"
          />

          <div className="flex items-center gap-2">
            <span className="text-[13px] text-slate-400">Main Balance</span>
            <span className="px-2 py-0.5 rounded-md bg-white/10 text-[11px] font-bold text-white">
              {cur}
            </span>
          </div>

          <div className="mt-2 text-[40px] leading-none font-black text-white tabular-nums">
            {mask(fmt(main, cur))}
          </div>

          <div className="mt-2 flex items-center gap-1.5 text-[13px] text-slate-500">
            <span>≈ {mask(`$${usdEquiv.toFixed(2)}`)} USD</span>
            <Info className="w-3.5 h-3.5" />
          </div>

          <div className="mt-6 pt-4 border-t border-white/10 grid grid-cols-2 gap-4">
            <div>
              <div className="text-[13px] text-slate-500">Available Balance</div>
              <div className="text-lg font-bold text-white tabular-nums">{mask(fmt(available, cur))}</div>
            </div>
            <div>
              <div className="text-[13px] text-slate-500">Locked Balance</div>
              <div className="text-lg font-bold text-white tabular-nums">{mask(fmt(locked, cur))}</div>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-4 gap-3">
          {actions.map((a) => (
            <button
              key={a.label}
              onClick={a.onClick}
              className="rounded-[10px] bg-[#141418] border border-white/5 py-4 flex flex-col items-center gap-2 hover:bg-[#1A1A20] transition-colors"
            >
              <span
                className={`w-9 h-9 rounded-full flex items-center justify-center ${a.ring} ${a.text}`}
              >
                <a.icon className="w-5 h-5" />
              </span>
              <span className="text-[12px] font-semibold text-white">{a.label}</span>
            </button>
          ))}
        </div>

        {/* Sub-wallets */}
        <section className="rounded-[10px] bg-[#111114] border border-white/5 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white text-base font-bold">My Sub-Wallets</h2>
            <button
              onClick={() => setSubOpen((v) => !v)}
              className="flex items-center gap-1 text-[13px] font-semibold text-[#60A5FA]"
            >
              {subOpen ? "Hide" : "Show"}
              <ChevronUp className={`w-4 h-4 transition-transform ${subOpen ? "" : "rotate-180"}`} />
            </button>
          </div>

          {subOpen && (
            <div className="grid grid-cols-2 gap-3">
              {subWallets.map((s) => {
                const body = (
                  <>
                    <div className="flex items-center gap-2.5">
                      <span className={`w-8 h-8 rounded-[10px] flex items-center justify-center ${s.tone}`}>
                        <s.icon className="w-4 h-4" />
                      </span>
                      <span className="text-[13px] font-semibold text-white leading-tight">{s.label}</span>
                    </div>
                    <div className="mt-3 flex items-end justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xl font-black text-white tabular-nums truncate">
                          {mask(s.value)}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1 truncate">{s.sub}</div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-600 shrink-0 mb-1" />
                    </div>
                  </>
                );
                return isAuthenticated ? (
                  <Link
                    key={s.label}
                    to={s.to}
                    className="rounded-[10px] bg-[#17171C] border border-white/5 p-3.5 hover:border-white/15 transition-colors"
                  >
                    {body}
                  </Link>
                ) : (
                  <button
                    key={s.label}
                    onClick={() => openGate("funding")}
                    className="rounded-[10px] bg-[#17171C] border border-white/5 p-3.5 text-left opacity-70 hover:opacity-100 transition-opacity"
                  >
                    {body}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Cashback Optimization Estimator */}
        <section className="rounded-[10px] bg-[#111114] border border-white/5 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <TrendingUp className="w-4 h-4 text-[#818CF8] shrink-0" />
              <h2 className="text-white text-[13px] font-bold uppercase tracking-wide truncate">
                Cashback Optimization Estimator
              </h2>
            </div>
            <button
              onClick={() => toast.info("Cashback tiers scale with your monthly volume on Oventric")}
              className="shrink-0 px-2.5 py-1 rounded-md bg-white/10 text-[11px] font-semibold text-white/80 hover:text-white"
            >
              Learn more
            </button>
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-slate-500">
            Plan your spending or gigs to estimate your monthly cashback and yearly earnings on
            Oventric.
          </p>

          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="text-[13px] text-slate-400">Projected Monthly Spend / Gig Volume</span>
            <span className="text-lg font-black text-white tabular-nums">{fmt(spend, cur)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={Math.round(tierMid * 10)}
            step={Math.max(1, Math.round(tierMid / 100))}
            value={spend}
            onChange={(e) => setSpend(Number(e.target.value))}
            aria-label="Projected monthly spend"
            className="mt-3 w-full h-1.5 appearance-none rounded-full bg-white/10 accent-[#6366F1]
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4
              [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:bg-[#818CF8] [&::-webkit-slider-thumb]:border-2
              [&::-webkit-slider-thumb]:border-white/70"
            style={{
              background: `linear-gradient(to right, #6366F1 ${sliderPct}%, rgba(255,255,255,0.1) ${sliderPct}%)`,
            }}
          />

          <div className="mt-4 grid grid-cols-3 gap-2.5">
            {tiers.map((t) => {
              const active = t.key === tier.key;
              return (
                <div
                  key={t.key}
                  className={`rounded-[10px] p-3 text-center border ${
                    active
                      ? "bg-[#12122A] border-[#6366F1]"
                      : "bg-[#17171C] border-white/5"
                  }`}
                >
                  <div className="text-[13px] font-semibold text-white">{t.label}</div>
                  <div className="mt-1 text-[11px] text-slate-500 leading-snug">{t.range}</div>
                  <div className={`mt-1 text-[13px] font-bold ${active ? "text-white" : "text-slate-400"}`}>
                    {t.pct}%
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 rounded-[10px] border border-[#6366F1]/30 bg-gradient-to-b from-[#14142B] to-[#0F0F1C] p-5 text-center">
            <div className="text-[11px] font-bold uppercase tracking-widest text-slate-300">
              Estimated Annual Cashback Earnings
            </div>
            <div className="mt-2 text-[34px] leading-none font-black text-[#818CF8] tabular-nums">
              {mask(fmt(annual, cur))}
            </div>
            <div className="mt-2 text-[13px] text-slate-400">
              at <span className="text-[#818CF8] font-semibold">{tier.pct}%</span> {tier.label}{" "}
              multiplier
            </div>
          </div>
        </section>

        {/* Recent transactions */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white text-lg font-bold">Recent Transactions</h2>
            {isAuthenticated ? (
              <Link to="/wallet/ledger" className="text-[13px] font-semibold text-[#60A5FA]">
                View all
              </Link>
            ) : (
              <button
                onClick={() => openGate("funding")}
                className="text-[13px] font-semibold text-[#60A5FA]"
              >
                View all
              </button>
            )}
          </div>
          {txLoading ? (
            <div className="rounded-[10px] bg-[#111114] border border-white/5 p-6 text-center text-[13px] text-slate-500">
              Loading activity…
            </div>
          ) : !isAuthenticated ? (
            <div className="rounded-[10px] bg-[#111114] border border-white/5 p-6 text-center">
              <div className="text-[13px] text-slate-400">
                Sign in to see your recent wallet activity.
              </div>
              <button
                onClick={() => openGate("funding")}
                className="mt-3 text-[13px] font-semibold text-[#E5484D] hover:text-[#F87171]"
              >
                Sign in to view
              </button>
            </div>
          ) : monthGroups.length === 0 ? (
            <div className="rounded-[10px] bg-[#111114] border border-white/5 p-6 text-center text-[13px] text-slate-500">
              No transactions yet.
            </div>
          ) : (
            <div className="space-y-5">
              {monthGroups.map((g) => (
                <div key={g.label}>
                  <div className="mb-2 text-[13px] font-semibold text-slate-400">{g.label}</div>
                  <div className="rounded-[10px] bg-[#111114] border border-white/5 divide-y divide-white/5">
                    {g.items.map((t) => {
                      const style = txStyle(t.type, t.inflow);
                      return (
                        <div key={t.id} className="p-3.5 flex items-center gap-3">
                          <span
                            className={`w-10 h-10 rounded-full shrink-0 flex items-center justify-center ${style.tone}`}
                          >
                            <style.icon className="w-5 h-5" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="text-[14px] font-semibold text-white truncate">
                              {t.type}
                            </div>
                            <div className="text-[12px] text-slate-500 truncate capitalize">
                              {t.status}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div
                              className={`text-[14px] font-bold tabular-nums ${
                                t.inflow ? "text-emerald-400" : "text-white"
                              }`}
                            >
                              {t.inflow ? "+ " : "- "}
                              {mask(fmt(t.amount, t.currency))}
                            </div>
                            <div className="text-[12px] text-slate-500">
                              {new Date(t.occurredAt).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {totalTxPages > 1 && (
                <div className="flex items-center justify-between gap-3 pt-1">
                  <button
                    onClick={() => setTxPage((p) => Math.max(0, p - 1))}
                    disabled={currentPage === 0}
                    className="px-4 py-2 rounded-[10px] bg-[#141418] border border-white/10 text-[13px] font-semibold text-white disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <span className="text-[12px] text-slate-500 tabular-nums">
                    {currentPage + 1} / {totalTxPages}
                  </span>
                  <button
                    onClick={() => setTxPage((p) => Math.min(totalTxPages - 1, p + 1))}
                    disabled={currentPage >= totalTxPages - 1}
                    className="px-4 py-2 rounded-[10px] bg-[#141418] border border-white/10 text-[13px] font-semibold text-white disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      </main>


      {transferOpen && (
        <TransferModal
          onClose={() => setTransferOpen(false)}
          onDone={() => {
            setTransferOpen(false);
            toast.success("Transfer completed");
          }}
        />
      )}
      {addFundsOpen && <AddCapitalModal onClose={() => setAddFundsOpen(false)} />}
      {payoutOpen && <PayoutModal onClose={() => setPayoutOpen(false)} />}
    </div>
  );
}

export { AddCapitalModal } from "./wallet/AddCapitalModal";
export { PayoutModal } from "./wallet/PayoutModal";
