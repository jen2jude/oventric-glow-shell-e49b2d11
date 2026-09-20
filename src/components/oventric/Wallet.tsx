import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  Award,
  Bell,
  CircleDollarSign,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Compass,
  Download,
  Eye,
  EyeOff,
  Gift,
  History,
  Home,
  Info,
  Lock,
  Menu,
  MessageSquare,
  Newspaper,
  Package,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Store,
  Sparkles,
  Wallet as WalletIcon,
} from "lucide-react";
import { useOnboarding, type Currency } from "@/lib/onboarding/OnboardingContext";
import { useAuthGate } from "@/lib/auth-gate/AuthGateProvider";
import { getWalletBalances, listWalletTransactions, type WalletTxType } from "@/lib/wallet.functions";
import { formatMoney, usdRate } from "@/lib/fx-display";
import { MegaMenu } from "@/components/oventric/MegaMenu";
import { NotificationsDrawer, useUnreadNotificationsCount } from "@/components/oventric/NotificationsDrawer";
import { AddCapitalModal } from "@/components/oventric/wallet/AddCapitalModal";
import { PayoutModal } from "@/components/oventric/wallet/PayoutModal";
import { WalletCreditSplash } from "@/components/oventric/wallet/WalletCreditSplash";
import { Button } from "@/components/ui/button";
import logo from "@/assets/oventric-logo-dark.png";
import { walletTxLabel } from "@/lib/wallet-tx-labels";

function fmt(value: number, currency: Currency) {
  return formatMoney(value, currency);
}

function txStyle(type: WalletTxType, inflow: boolean) {
  if (type === "Marketplace Purchase" || type === "Ad Injection Charge") {
    return { icon: ShoppingCart, tone: "bg-wallet-crimson-soft text-wallet-crimson" };
  }
  if (type === "Cashback Earned" || type === "Affiliate Cashback Payout") {
    return { icon: Download, tone: "bg-wallet-positive-soft text-wallet-positive" };
  }
  if (type === "Gig Bounty Escrowed") {
    return { icon: Award, tone: "bg-wallet-warning-soft text-wallet-warning" };
  }
  if (type === "Wallet Transfer Sent" || type === "Wallet Transfer Received") {
    return { icon: ArrowLeftRight, tone: "bg-wallet-info-soft text-wallet-info" };
  }
  return inflow
    ? { icon: ArrowDown, tone: "bg-wallet-positive-soft text-wallet-positive" }
    : { icon: ArrowUp, tone: "bg-wallet-muted text-wallet-copy" };
}

export function Wallet({ onSelect }: { onSelect?: (section: string) => void }) {
  const { balances: localBalances, balancesHidden: hide, toggleBalancesHidden, homeCurrency } = useOnboarding();
  const [addFundsOpen, setAddFundsOpen] = useState(false);
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [txPage, setTxPage] = useState(0);
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

  const cur = homeCurrency;
  const available = data?.balances?.[cur] ?? localBalances[cur] ?? 0;
  const locked = data?.escrow?.[cur] ?? 0;
  // Pending withdrawals are held in escrow, so the primary figure must show
  // what the user can actually spend or withdraw rather than adding held funds back.
  const main = available;
  const cashbackUSD = data?.cashback ?? 0;
  const usdEquiv = main / (usdRate(cur) || 1);
  const allTx = txData?.items ?? [];
  const pageSize = 5;
  const totalTxPages = Math.max(1, Math.ceil(allTx.length / pageSize));
  const currentPage = Math.min(txPage, totalTxPages - 1);
  const recentTx = allTx.slice(currentPage * pageSize, currentPage * pageSize + pageSize);
  const mask = (value: string) => (hide || !isAuthenticated ? "••••••" : value);

  const rate = usdRate(cur) || 1;
  const tierMid = 1000 * rate;
  const tierTop = 5000 * rate;
  const [spend, setSpend] = useState(() => Math.round(tierMid * 2.5));
  const tiers = [
    { key: "base", label: "Baseline", range: `< ${fmt(tierMid, cur)}`, pct: 2 },
    { key: "elite", label: "Elite", range: `${fmt(tierMid, cur)} – ${fmt(tierTop, cur)}`, pct: 3.5 },
    { key: "apex", label: "Apex", range: `> ${fmt(tierTop, cur)}`, pct: 5 },
  ];
  const tier = spend < tierMid ? tiers[0] : spend <= tierTop ? tiers[1] : tiers[2];
  const annual = spend * 12 * (tier?.pct ?? 0) / 100;
  const completedTx = allTx.filter((transaction) => transaction.status === "success");
  const sumTx = (test: (transaction: (typeof completedTx)[number]) => boolean) =>
    completedTx.filter(test).reduce((sum, transaction) => sum + transaction.amount, 0);
  const totalEarned = sumTx((transaction) => transaction.inflow);
  const totalWithdrawn = sumTx((transaction) => !transaction.inflow && transaction.type.toLowerCase().includes("withdraw"));
  const salesEarned = sumTx((transaction) => transaction.inflow && transaction.type.toLowerCase().includes("sale"));
  const referralEarned = sumTx((transaction) => transaction.inflow && transaction.type.toLowerCase().includes("affiliate"));

  const requireAuth = (callback: () => void) => {
    if (isAuthenticated) callback();
    else openGate("funding");
  };

  const actions = [
    { label: "Add funds", icon: Plus, tone: "bg-wallet-positive-soft text-wallet-positive", onClick: () => requireAuth(() => setAddFundsOpen(true)) },
    { label: "Withdraw", icon: ArrowUp, tone: "bg-wallet-info-soft text-wallet-info", onClick: () => requireAuth(() => setPayoutOpen(true)) },
  ];

  const subWallets = [
    { label: "Cashback", value: fmt(cashbackUSD * rate, cur), sub: "Available at checkout", icon: Sparkles, tone: "bg-wallet-violet-soft text-wallet-violet", to: "/wallet/ledger" as const },
    { label: "Escrow", value: fmt(locked, cur), sub: "Protected until completion", icon: Lock, tone: "bg-wallet-warning-soft text-wallet-warning", to: "/wallet/ledger" as const },
    { label: "Seller earnings", value: fmt(available, cur), sub: "From marketplace sales", icon: WalletIcon, tone: "bg-wallet-positive-soft text-wallet-positive", to: "/wallet/history" as const },
  ];
  const walletNav = [
    { label: "Home", section: "Home", icon: Home },
    { label: "Explore", section: "Explore", icon: Compass },
    { label: "Marketplace", section: "Marketplace", icon: Store },
    { label: "Feed", section: "Feed", icon: Newspaper },
    { label: "Messages", section: "Messages", icon: MessageSquare },
    { label: "Wallet", section: "Wallet", icon: WalletIcon },
    { label: "Orders", section: "Orders", icon: Package },
    { label: "My products", section: "Marketplace", icon: ShoppingCart },
    { label: "Settings", section: "Settings", icon: Settings },
  ];

  return (
    <div className="wallet-shell min-h-full bg-wallet-canvas font-wallet-body text-wallet-copy">
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-wallet-line bg-wallet-panel px-4 md:hidden">
        <Button variant="ghost" size="icon" aria-label="Menu" onClick={() => setMenuOpen(true)} className="text-wallet-copy-muted hover:bg-wallet-muted hover:text-wallet-copy">
          <Menu />
        </Button>
        <Link to="/" aria-label="Oventric home"><img src={logo} alt="Oventric" className="h-6 w-auto" /></Link>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Notifications" onClick={() => isAuthenticated ? setNotifOpen(true) : openGate("funding")} className="relative text-wallet-copy-muted hover:bg-wallet-muted hover:text-wallet-copy">
            <Bell />
            {unreadNotifs > 0 && <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-wallet-crimson" />}
          </Button>
        </div>
      </header>
      <header className="wallet-desktop-header hidden h-[72px] items-center border-b border-wallet-line bg-wallet-panel px-6 md:flex">
        <Link to="/" aria-label="Oventric home" className="w-[150px] shrink-0"><img src={logo} alt="Oventric" className="h-8 w-auto" /></Link>
        <div className="mx-auto flex h-10 w-full max-w-xl items-center gap-3 rounded-full bg-wallet-panel-raised px-4 text-wallet-copy-muted"><Search className="h-4 w-4" /><span className="text-xs">Search for products, creators, shops...</span></div>
        <div className="ml-5 flex w-[150px] shrink-0 justify-end gap-2">
          <Button variant="ghost" size="icon" aria-label="Notifications" onClick={() => isAuthenticated ? setNotifOpen(true) : openGate("funding")} className="text-wallet-copy hover:bg-wallet-muted"><Bell /></Button>
          <Button variant="ghost" size="icon" aria-label="Open menu" onClick={() => setMenuOpen(true)} className="text-wallet-copy hover:bg-wallet-muted"><Menu /></Button>
        </div>
      </header>

      <MegaMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
      <NotificationsDrawer open={notifOpen} onClose={() => setNotifOpen(false)} />

      <main className="wallet-main mx-auto grid w-full max-w-[1320px] gap-4 px-4 py-5 sm:px-6 md:grid-cols-[140px_minmax(0,1fr)_180px] md:px-5 md:py-6 lg:grid-cols-[160px_minmax(0,1fr)_210px] xl:grid-cols-[180px_minmax(0,1fr)_240px] xl:gap-5 xl:px-7">
        <aside className="wallet-reference-nav hidden md:flex md:flex-col">
          <nav className="space-y-1">
            {walletNav.map((item) => (
              <Button key={item.label} variant="ghost" onClick={() => onSelect?.(item.section)} className={`h-10 w-full justify-start gap-3 px-3 text-xs ${item.section === "Wallet" ? "bg-wallet-copy text-wallet-panel hover:bg-wallet-copy hover:text-wallet-panel" : "text-wallet-copy hover:bg-wallet-muted"}`}>
                <item.icon className="h-4 w-4" /> {item.label}
              </Button>
            ))}
          </nav>
          <div className="mt-auto rounded-[10px] border border-wallet-line bg-wallet-panel p-4 text-center shadow-wallet-card">
            <span className="wallet-icon-halo mx-auto grid h-10 w-10 place-items-center rounded-[10px] bg-wallet-violet-soft text-wallet-violet"><WalletIcon /></span>
            <p className="mt-3 text-sm font-bold text-wallet-copy">Shop, Earn, Grow</p>
            <p className="mt-1 text-[10px] text-wallet-copy-muted">Your wallet powers a bigger you.</p>
            <Button asChild className="mt-3 h-8 w-full bg-wallet-copy text-[10px] text-wallet-panel hover:bg-wallet-copy"><Link to="/marketplace">Start shopping</Link></Button>
          </div>
        </aside>

        <div className="wallet-center min-w-0">
        <div className="wallet-page-heading mb-3 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-wallet-display text-3xl font-bold text-wallet-copy sm:text-4xl">Wallet</h1>
            <p className="mt-1 text-sm text-wallet-copy-muted">Manage your balance, transactions and payouts all in one place.</p>
          </div>
          <Button variant="outline" className="wallet-how-button h-9 border-wallet-line bg-wallet-panel text-xs text-wallet-copy hover:bg-wallet-muted" onClick={() => toast.info("Your available balance can be spent or withdrawn. Escrow is released after order completion.")}><Info /> How it works?</Button>
        </div>

        {!isAuthenticated && checked && (
          <Button variant="outline" onClick={() => openGate("funding")} className="mb-5 h-auto w-full justify-start border-wallet-crimson-line bg-wallet-crimson-soft px-4 py-3 text-left text-sm font-semibold text-wallet-crimson hover:bg-wallet-crimson-soft">Sign in to view your wallet balance and activity</Button>
        )}

        <div className="wallet-hero-grid grid gap-3 lg:grid-cols-[minmax(0,1.7fr)_minmax(190px,1fr)]">
          <section className="wallet-balance-card relative overflow-hidden rounded-[10px] bg-wallet-rich px-5 py-5 text-wallet-on-rich sm:px-6 sm:py-6">
            <div aria-hidden="true" className="wallet-balance-glow wallet-balance-glow-one" />
            <div aria-hidden="true" className="wallet-balance-glow wallet-balance-glow-two" />
            <div className="relative z-10">
              <div className="flex items-center gap-2 text-sm font-medium text-wallet-on-rich-muted">
                 Available balance <span className="rounded-md bg-wallet-rich-muted px-2 py-1 text-[10px] font-semibold text-wallet-on-rich">{cur}</span>
              </div>
              <div className="mt-3 font-wallet-display text-4xl font-bold tabular-nums sm:text-[2.65rem]">{mask(fmt(main, cur))}</div>
              <div className="mt-2 flex items-center gap-1.5 text-xs text-wallet-on-rich-muted">≈ {mask(`$${usdEquiv.toFixed(2)}`)} USD</div>
            </div>
               <div className="wallet-balance-split relative z-10 mt-5 grid grid-cols-3 divide-x divide-wallet-rich-line border-t border-wallet-rich-line pt-4">
              <div className="pr-3"><p className="text-sm font-semibold tabular-nums">{mask(fmt(locked, cur))}</p><p className="mt-1 text-[10px] text-wallet-on-rich-muted">Pending balance</p></div>
              <div className="px-3"><p className="text-sm font-semibold tabular-nums">{mask(fmt(totalEarned, cur))}</p><p className="mt-1 text-[10px] text-wallet-on-rich-muted">Total earned</p></div>
              <div className="pl-3"><p className="text-sm font-semibold tabular-nums">{mask(fmt(totalWithdrawn, cur))}</p><p className="mt-1 text-[10px] text-wallet-on-rich-muted">Total withdrawn</p></div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => requireAuth(toggleBalancesHidden)} aria-label={hide ? "Show balances" : "Hide balances"} className="absolute right-4 top-4 z-20 text-wallet-on-rich-muted hover:bg-wallet-rich-muted hover:text-wallet-on-rich"><Eye className={hide ? "hidden" : "block"} /><EyeOff className={hide ? "block" : "hidden"} /></Button>
          </section>

          <section className="wallet-actions-section">
            <div className="wallet-actions-grid grid h-full grid-cols-2 gap-3">
              {actions.slice(0, 2).map((action) => (
                <Button key={action.label} variant="ghost" onClick={action.onClick} className="wallet-action-button h-auto min-h-24 flex-col gap-2 rounded-[10px] border border-wallet-line bg-wallet-panel p-3 text-wallet-copy shadow-wallet-card hover:bg-wallet-panel-raised hover:text-wallet-copy">
                  <span className={`wallet-action-icon wallet-icon-halo ${action.tone}`}><action.icon /></span>
                  <span className="text-xs font-semibold">{action.label}</span>
                </Button>
              ))}
              <Button asChild variant="ghost" className="wallet-action-button h-auto min-h-24 flex-col gap-2 rounded-[10px] border border-wallet-line bg-wallet-panel p-3 text-wallet-copy shadow-wallet-card hover:bg-wallet-panel-raised hover:text-wallet-copy">
                <Link to="/wallet/ledger"><span className="wallet-action-icon wallet-icon-halo bg-wallet-violet-soft text-wallet-violet"><History /></span><span className="text-xs font-semibold">Transaction history</span></Link>
              </Button>
              <Button variant="ghost" onClick={() => requireAuth(() => toast.info("Payment methods are managed during checkout"))} className="wallet-action-button h-auto min-h-24 flex-col gap-2 rounded-[10px] border border-wallet-line bg-wallet-panel p-3 text-wallet-copy shadow-wallet-card hover:bg-wallet-panel-raised hover:text-wallet-copy">
                <span className="wallet-action-icon wallet-icon-halo bg-wallet-warning-soft text-wallet-warning"><CircleDollarSign /></span><span className="text-xs font-semibold">Payment methods</span>
              </Button>
            </div>
          </section>
        </div>

        <section className="wallet-shop-banner my-3 flex items-center justify-between gap-4 rounded-[10px] border border-wallet-warm-line bg-wallet-panel px-4 py-3 shadow-wallet-card sm:px-5">
          <div className="flex min-w-0 items-center gap-3"><span className="wallet-icon-halo grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-wallet-warning-soft text-wallet-warning"><Gift /></span><p className="text-xs font-medium text-wallet-copy sm:text-sm">Use your wallet to pay for digital products and enjoy a faster checkout.</p></div>
          <Button asChild className="shrink-0 bg-wallet-copy text-wallet-panel shadow-none hover:bg-wallet-copy"><Link to="/marketplace">Shop now <ChevronRight /></Link></Button>
        </section>

        <section className="wallet-breakdown-section py-3 md:hidden">
          <div className="wallet-breakdown-grid grid grid-cols-1 gap-3 sm:grid-cols-3">
            {subWallets.map((wallet) => {
              const content = <><div className="flex items-center justify-between"><span className={`flex h-9 w-9 items-center justify-center rounded-[10px] ${wallet.tone}`}><wallet.icon className="h-4 w-4" /></span><ChevronRight className="h-4 w-4 text-wallet-copy-faint" /></div><p className="mt-3 text-[11px] text-wallet-copy-muted">{wallet.label}</p><p className="mt-1 font-wallet-display text-lg font-bold tabular-nums text-wallet-copy">{mask(wallet.value)}</p><p className="mt-1 text-[10px] text-wallet-copy-faint">{wallet.sub}</p></>;
              return isAuthenticated ? <Link key={wallet.label} to={wallet.to} className="wallet-breakdown-card rounded-[10px] border border-wallet-line bg-wallet-panel p-4 shadow-wallet-card transition-colors hover:bg-wallet-panel-raised">{content}</Link> : <Button key={wallet.label} variant="ghost" onClick={() => openGate("funding")} className="wallet-breakdown-card h-auto items-stretch rounded-[10px] border border-wallet-line bg-wallet-panel p-4 text-left opacity-75 shadow-wallet-card hover:bg-wallet-panel-raised">{content}</Button>;
            })}
          </div>
        </section>

        <div className="pt-2">
          <section className="overflow-hidden rounded-[10px] border border-wallet-line bg-wallet-panel shadow-wallet-card">
            <div className="flex items-center justify-between px-4 py-4 sm:px-5">
              <div><h2 className="font-wallet-display text-lg font-bold text-wallet-copy">Recent transactions</h2></div>
              {isAuthenticated ? <Link to="/wallet/ledger" className="text-sm font-semibold text-wallet-crimson hover:text-wallet-crimson-strong">View all</Link> : <button onClick={() => openGate("funding")} className="text-sm font-semibold text-wallet-crimson">View all</button>}
            </div>
            <div className="hidden grid-cols-[minmax(0,1.5fr)_0.8fr_1fr] border-y border-wallet-line bg-wallet-panel-raised px-5 py-2.5 text-[10px] font-semibold uppercase text-wallet-copy-faint sm:grid"><span>Description</span><span>Date</span><span className="text-right">Amount</span></div>
            {txLoading ? <div className="p-10 text-center text-sm text-wallet-copy-muted">Loading activity…</div> : !isAuthenticated ? <div className="p-10 text-center"><p className="text-sm text-wallet-copy-muted">Sign in to see your recent wallet activity.</p><Button variant="ghost" onClick={() => openGate("funding")} className="mt-2 text-wallet-crimson hover:bg-wallet-crimson-soft hover:text-wallet-crimson">Sign in to view</Button></div> : recentTx.length === 0 ? <div className="p-10 text-center text-sm text-wallet-copy-muted">No transactions yet.</div> : <div className="divide-y divide-wallet-line">{recentTx.map((transaction) => { const style = txStyle(transaction.type, transaction.inflow); return <div key={transaction.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-4 sm:grid-cols-[minmax(0,1.5fr)_0.8fr_1fr]"><div className="flex min-w-0 items-center gap-3"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${style.tone}`}><style.icon className="h-4 w-4" /></span><div className="min-w-0"><p className="truncate text-sm font-semibold text-wallet-copy">{walletTxLabel(transaction.type)}</p><p className="mt-0.5 text-xs capitalize text-wallet-copy-faint">{transaction.status}</p></div></div><p className="hidden text-xs text-wallet-copy-muted sm:block">{new Date(transaction.occurredAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</p><div className="text-right"><p className={`text-sm font-semibold tabular-nums ${transaction.inflow ? "text-wallet-positive" : "text-wallet-copy"}`}>{transaction.inflow ? "+ " : "- "}{mask(fmt(transaction.amount, transaction.currency))}</p><p className="mt-0.5 text-xs text-wallet-copy-faint sm:hidden">{new Date(transaction.occurredAt).toLocaleDateString()}</p></div></div>; })}</div>}
            {isAuthenticated && totalTxPages > 1 && <div className="flex items-center justify-end gap-3 border-t border-wallet-line px-5 py-3"><Button variant="ghost" size="icon" disabled={currentPage === 0} onClick={() => setTxPage((page) => Math.max(0, page - 1))} aria-label="Previous page" className="text-wallet-copy-muted hover:bg-wallet-muted hover:text-wallet-copy"><ChevronLeft /></Button><span className="text-xs tabular-nums text-wallet-copy-muted">{currentPage + 1} / {totalTxPages}</span><Button variant="ghost" size="icon" disabled={currentPage >= totalTxPages - 1} onClick={() => setTxPage((page) => Math.min(totalTxPages - 1, page + 1))} aria-label="Next page" className="text-wallet-copy-muted hover:bg-wallet-muted hover:text-wallet-copy"><ChevronRight /></Button></div>}
          </section>

        </div>
        </div>

        <aside className="wallet-right-column hidden space-y-4 md:block">
          <section className="rounded-[10px] border border-wallet-line bg-wallet-panel p-4 shadow-wallet-card">
            <div className="flex items-center justify-between"><h2 className="text-sm font-bold text-wallet-copy">Quick stats</h2><span className="text-[9px] text-wallet-copy-faint">All time</span></div>
            <div className="mt-4 space-y-4">
              {[
                { label: "Sales earnings", value: salesEarned, icon: Store, tone: "bg-wallet-positive-soft text-wallet-positive" },
                { label: "Cashback earned", value: cashbackUSD * rate, icon: Sparkles, tone: "bg-wallet-violet-soft text-wallet-violet" },
                { label: "Referral rewards", value: referralEarned, icon: Award, tone: "bg-wallet-warning-soft text-wallet-warning" },
                { label: "Withdrawals", value: totalWithdrawn, icon: ArrowUp, tone: "bg-wallet-info-soft text-wallet-info" },
              ].map((stat) => <div key={stat.label} className="flex items-center gap-3"><span className={`wallet-icon-halo grid h-8 w-8 shrink-0 place-items-center rounded-[10px] ${stat.tone}`}><stat.icon className="h-4 w-4" /></span><div><p className="text-sm font-bold tabular-nums text-wallet-copy">{mask(fmt(stat.value, cur))}</p><p className="text-[10px] text-wallet-copy-muted">{stat.label}</p></div></div>)}
            </div>
          </section>
          <section className="rounded-[10px] border border-wallet-line bg-wallet-panel p-4 shadow-wallet-card">
            <h2 className="flex items-center gap-2 text-sm font-bold text-wallet-copy"><CircleDollarSign className="text-wallet-info" /> Wallet tips</h2>
            <ul className="mt-3 space-y-2 text-[10px] text-wallet-copy-muted"><li className="flex gap-2"><ShieldCheck className="h-3.5 w-3.5 shrink-0 text-wallet-positive" />Use your wallet for faster checkout.</li><li className="flex gap-2"><Clock3 className="h-3.5 w-3.5 shrink-0 text-wallet-warning" />Escrow stays protected until completion.</li><li className="flex gap-2"><Sparkles className="h-3.5 w-3.5 shrink-0 text-wallet-violet" />Earn cashback on eligible purchases.</li></ul>
          </section>
          <section className="rounded-[10px] border border-wallet-line bg-wallet-panel p-4 shadow-wallet-card">
            <div className="mb-5"><p className="text-[10px] font-semibold uppercase text-wallet-crimson">Cashback planner</p><h2 className="mt-1 font-wallet-display text-base font-bold text-wallet-copy">Estimate your earnings</h2></div>
            <div className="flex items-end justify-between gap-3"><label htmlFor="wallet-spend" className="text-xs text-wallet-copy-muted">Monthly volume</label><span className="font-wallet-display text-lg font-semibold tabular-nums text-wallet-copy">{fmt(spend, cur)}</span></div>
            <input id="wallet-spend" type="range" min={0} max={Math.round(tierMid * 10)} step={Math.max(1, Math.round(tierMid / 100))} value={spend} onChange={(event) => setSpend(Number(event.target.value))} className="mt-4 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-wallet-muted accent-wallet-crimson" />
            <div className="mt-5 grid grid-cols-3 gap-2">{tiers.map((item) => { const active = item.key === tier?.key; return <div key={item.key} className={`rounded-[10px] border p-2.5 text-center ${active ? "border-wallet-crimson-line bg-wallet-crimson-soft" : "border-wallet-line bg-wallet-panel-raised"}`}><p className="text-xs font-semibold text-wallet-copy">{item.label}</p><p className="mt-1 text-[10px] text-wallet-copy-faint">{item.pct}%</p></div>; })}</div>
            <div className="mt-5 rounded-[10px] border border-wallet-crimson-line bg-wallet-crimson-soft p-5"><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-wallet-copy-muted">Estimated annual cashback</p><p className="mt-2 font-wallet-display text-3xl font-semibold tabular-nums text-wallet-copy">{mask(fmt(annual, cur))}</p><p className="mt-2 text-xs text-wallet-copy-muted">At the {tier?.label ?? "Baseline"} estimate</p></div>
          </section>
        </aside>
      </main>

      {addFundsOpen && <AddCapitalModal onClose={() => setAddFundsOpen(false)} />}
      {payoutOpen && <PayoutModal onClose={() => setPayoutOpen(false)} />}
      <WalletCreditSplash enabled={isAuthenticated} />
    </div>
  );
}

export { AddCapitalModal } from "./wallet/AddCapitalModal";
export { PayoutModal } from "./wallet/PayoutModal";