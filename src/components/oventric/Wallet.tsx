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
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  EyeOff,
  Info,
  Lock,
  Menu,
  Plus,
  ScanLine,
  Send,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Wallet as WalletIcon,
} from "lucide-react";
import { useOnboarding, type Currency } from "@/lib/onboarding/OnboardingContext";
import { useAuthGate } from "@/lib/auth-gate/AuthGateProvider";
import { getWalletBalances, listWalletTransactions, type WalletTxType } from "@/lib/wallet.functions";
import { formatMoney, usdRate } from "@/lib/fx-display";
import { MegaMenu } from "@/components/oventric/MegaMenu";
import { NotificationsDrawer, useUnreadNotificationsCount } from "@/components/oventric/NotificationsDrawer";
import { TransferModal } from "@/components/oventric/wallet/TransferModal";
import { AddCapitalModal } from "@/components/oventric/wallet/AddCapitalModal";
import { PayoutModal } from "@/components/oventric/wallet/PayoutModal";
import { Button } from "@/components/ui/button";
import logoFull from "@/assets/oventric-full-transparent.png";

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

export function Wallet() {
  const { balances: localBalances, balancesHidden: hide, toggleBalancesHidden, homeCurrency } = useOnboarding();
  const [transferOpen, setTransferOpen] = useState(false);
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
  const main = available + locked;
  const cashbackUSD = data?.cashback ?? 0;
  const bountyUSD = data?.bountyBalance ?? 0;
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

  const requireAuth = (callback: () => void) => {
    if (isAuthenticated) callback();
    else openGate("funding");
  };

  const actions = [
    { label: "Add funds", description: "Fund your balance", icon: Plus, primary: true, onClick: () => requireAuth(() => setAddFundsOpen(true)) },
    { label: "Withdraw", description: "Move money out", icon: ArrowUp, onClick: () => requireAuth(() => setPayoutOpen(true)) },
    { label: "Send", description: "Pay another user", icon: Send, onClick: () => requireAuth(() => setTransferOpen(true)) },
    { label: "Request", description: "Request a payment", icon: ArrowDown, onClick: () => requireAuth(() => toast.info("Payment requests are coming soon")) },
  ];

  const subWallets = [
    { label: "Cashback", value: fmt(cashbackUSD * rate, cur), sub: "Available at checkout", icon: Sparkles, tone: "bg-wallet-crimson-soft text-wallet-crimson", to: "/wallet/ledger" as const },
    { label: "Bounty earnings", value: fmt(bountyUSD * rate, cur), sub: "Earned from bounties", icon: Award, tone: "bg-wallet-warning-soft text-wallet-warning", to: "/wallet/ledger" as const },
    { label: "Escrow", value: fmt(locked, cur), sub: "Protected until completion", icon: Lock, tone: "bg-wallet-info-soft text-wallet-info", to: "/wallet/ledger" as const },
    { label: "Seller earnings", value: fmt(available, cur), sub: "From marketplace sales", icon: WalletIcon, tone: "bg-wallet-positive-soft text-wallet-positive", to: "/wallet/history" as const },
  ];

  return (
    <div className="wallet-shell min-h-full bg-wallet-canvas font-wallet-body text-wallet-copy">
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-wallet-line bg-wallet-panel px-4 md:hidden">
        <Button variant="ghost" size="icon" aria-label="Menu" onClick={() => setMenuOpen(true)} className="text-wallet-copy-muted hover:bg-wallet-muted hover:text-wallet-copy">
          <Menu />
        </Button>
        <Link to="/" aria-label="Oventric home"><img src={logoFull} alt="Oventric" className="h-6 w-auto" /></Link>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Notifications" onClick={() => isAuthenticated ? setNotifOpen(true) : openGate("funding")} className="relative text-wallet-copy-muted hover:bg-wallet-muted hover:text-wallet-copy">
            <Bell />
            {unreadNotifs > 0 && <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-wallet-crimson" />}
          </Button>
          <Button variant="ghost" size="icon" aria-label="Scan to pay" onClick={() => requireAuth(() => setTransferOpen(true))} className="text-wallet-copy-muted hover:bg-wallet-muted hover:text-wallet-copy"><ScanLine /></Button>
        </div>
      </header>

      <MegaMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
      <NotificationsDrawer open={notifOpen} onClose={() => setNotifOpen(false)} />

      <main className="mx-auto w-full max-w-[1360px] px-4 py-8 sm:px-6 md:px-10 md:py-14 xl:px-14">
        <div className="mb-10 flex flex-col gap-6 border-b border-wallet-line pb-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-wallet-crimson">
              <ShieldCheck className="h-4 w-4" /> Protected wallet
            </div>
            <h1 className="font-wallet-display text-3xl font-semibold text-wallet-copy sm:text-5xl">Your wallet</h1>
            <p className="mt-3 text-sm text-wallet-copy-muted sm:text-base">Balances, earnings and recent activity in {cur}.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Button variant="outline" onClick={() => requireAuth(() => setTransferOpen(true))} className="h-11 border-wallet-line bg-wallet-panel px-5 text-wallet-copy hover:bg-wallet-muted hover:text-wallet-copy"><Send /> Send</Button>
            <Button onClick={() => requireAuth(() => setAddFundsOpen(true))} className="h-11 bg-wallet-crimson px-5 text-wallet-on-crimson shadow-none hover:bg-wallet-crimson-strong"><Plus /> Add funds</Button>
          </div>
        </div>

        {!isAuthenticated && checked && (
          <button onClick={() => openGate("funding")} className="mb-6 w-full rounded-[10px] border border-wallet-crimson-line bg-wallet-crimson-soft px-4 py-3 text-left text-sm font-semibold text-wallet-crimson">
            Sign in to view your wallet balance and activity
          </button>
        )}

        <section className="relative border-y border-wallet-line bg-wallet-panel px-5 py-8 sm:px-8 sm:py-10 lg:px-12 lg:py-12">
            <div className="relative z-10 max-w-4xl">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-wallet-copy-muted">
                Total balance <span className="rounded-md bg-wallet-muted px-2 py-1 text-[10px] text-wallet-copy">{cur}</span>
              </div>
              <div className="mt-4 font-wallet-display text-4xl font-semibold tabular-nums text-wallet-copy sm:text-6xl lg:text-7xl">{mask(fmt(main, cur))}</div>
              <div className="mt-3 flex items-center gap-1.5 text-sm text-wallet-copy-muted">≈ {mask(`$${usdEquiv.toFixed(2)}`)} USD <Info className="h-3.5 w-3.5" /></div>
            </div>
            <div className="relative z-10 mt-10 grid max-w-2xl grid-cols-2 gap-8 border-t border-wallet-line pt-6">
              <div><p className="text-xs text-wallet-copy-muted">Available</p><p className="mt-1 text-lg font-semibold tabular-nums text-wallet-copy">{mask(fmt(available, cur))}</p></div>
              <div><p className="text-xs text-wallet-copy-muted">In escrow</p><p className="mt-1 text-lg font-semibold tabular-nums text-wallet-copy">{mask(fmt(locked, cur))}</p></div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => requireAuth(toggleBalancesHidden)} aria-label={hide ? "Show balances" : "Hide balances"} className="absolute right-4 top-4 z-20 border border-wallet-line bg-wallet-muted text-wallet-copy-muted hover:text-wallet-copy"><Eye className={hide ? "hidden" : "block"} /><EyeOff className={hide ? "block" : "hidden"} /></Button>
        </section>

          <section className="border-b border-wallet-line py-8">
            <div className="mb-5"><h2 className="font-wallet-display text-xl font-semibold text-wallet-copy">Move your money</h2><p className="mt-1 text-sm text-wallet-copy-muted">Manage your funds securely.</p></div>
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[10px] border border-wallet-line bg-wallet-line md:grid-cols-4">
              {actions.map((action) => (
                <Button key={action.label} variant="ghost" onClick={action.onClick} className={`h-auto min-h-28 flex-col items-start gap-3 rounded-none border-0 p-5 text-left ${action.primary ? "bg-wallet-crimson-soft text-wallet-copy hover:bg-wallet-crimson-soft" : "bg-wallet-panel text-wallet-copy hover:bg-wallet-panel-raised hover:text-wallet-copy"}`}>
                  <action.icon className={action.primary ? "text-wallet-crimson" : "text-wallet-copy-muted"} />
                  <span><span className="block text-sm font-semibold">{action.label}</span><span className="mt-0.5 block text-[11px] font-normal text-wallet-copy-muted">{action.description}</span></span>
                </Button>
              ))}
            </div>
          </section>

        <section className="py-10">
          <div className="mb-6 flex items-end justify-between"><div><h2 className="font-wallet-display text-2xl font-semibold text-wallet-copy">Balance breakdown</h2><p className="mt-2 text-sm text-wallet-copy-muted">How your Oventric funds are distributed.</p></div></div>
          <div className="grid grid-cols-1 border-y border-wallet-line sm:grid-cols-2 xl:grid-cols-4 xl:divide-x xl:divide-wallet-line">
            {subWallets.map((wallet) => {
              const content = <><div className="flex items-start justify-between"><span className={`flex h-9 w-9 items-center justify-center rounded-[10px] ${wallet.tone}`}><wallet.icon className="h-4 w-4" /></span><ChevronRight className="h-4 w-4 text-wallet-copy-faint" /></div><p className="mt-5 text-xs text-wallet-copy-muted">{wallet.label}</p><p className="mt-1 font-wallet-display text-xl font-semibold tabular-nums text-wallet-copy">{mask(wallet.value)}</p><p className="mt-1 text-[11px] text-wallet-copy-faint">{wallet.sub}</p></>;
              return isAuthenticated ? <Link key={wallet.label} to={wallet.to} className="border-b border-wallet-line bg-wallet-panel p-5 transition-colors hover:bg-wallet-panel-raised sm:nth-[3]:border-b-0 sm:nth-[4]:border-b-0 xl:border-b-0 xl:px-7">{content}</Link> : <button key={wallet.label} onClick={() => openGate("funding")} className="border-b border-wallet-line bg-wallet-panel p-5 text-left opacity-75 transition-opacity hover:opacity-100 sm:nth-[3]:border-b-0 sm:nth-[4]:border-b-0 xl:border-b-0 xl:px-7">{content}</button>;
            })}
          </div>
        </section>

        <div className="grid grid-cols-1 gap-10 border-t border-wallet-line pt-10 xl:grid-cols-12">
          <section className="overflow-hidden xl:col-span-8">
            <div className="flex items-center justify-between border-b border-wallet-line py-4">
              <div><h2 className="font-wallet-display text-2xl font-semibold text-wallet-copy">Recent activity</h2><p className="mt-1 text-sm text-wallet-copy-muted">Your latest wallet movements.</p></div>
              {isAuthenticated ? <Link to="/wallet/ledger" className="text-sm font-semibold text-wallet-crimson hover:text-wallet-crimson-strong">View all</Link> : <button onClick={() => openGate("funding")} className="text-sm font-semibold text-wallet-crimson">View all</button>}
            </div>
            <div className="hidden grid-cols-[minmax(0,1.5fr)_0.8fr_1fr] border-b border-wallet-line bg-wallet-panel-raised px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-wallet-copy-faint sm:grid"><span>Transaction</span><span>Date</span><span className="text-right">Amount</span></div>
            {txLoading ? <div className="p-10 text-center text-sm text-wallet-copy-muted">Loading activity…</div> : !isAuthenticated ? <div className="p-10 text-center"><p className="text-sm text-wallet-copy-muted">Sign in to see your recent wallet activity.</p><Button variant="ghost" onClick={() => openGate("funding")} className="mt-2 text-wallet-crimson hover:bg-wallet-crimson-soft hover:text-wallet-crimson">Sign in to view</Button></div> : recentTx.length === 0 ? <div className="p-10 text-center text-sm text-wallet-copy-muted">No transactions yet.</div> : <div className="divide-y divide-wallet-line">{recentTx.map((transaction) => { const style = txStyle(transaction.type, transaction.inflow); return <div key={transaction.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-4 sm:grid-cols-[minmax(0,1.5fr)_0.8fr_1fr]"><div className="flex min-w-0 items-center gap-3"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${style.tone}`}><style.icon className="h-4 w-4" /></span><div className="min-w-0"><p className="truncate text-sm font-semibold text-wallet-copy">{transaction.type}</p><p className="mt-0.5 text-xs capitalize text-wallet-copy-faint">{transaction.status}</p></div></div><p className="hidden text-xs text-wallet-copy-muted sm:block">{new Date(transaction.occurredAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</p><div className="text-right"><p className={`text-sm font-semibold tabular-nums ${transaction.inflow ? "text-wallet-positive" : "text-wallet-copy"}`}>{transaction.inflow ? "+ " : "- "}{mask(fmt(transaction.amount, transaction.currency))}</p><p className="mt-0.5 text-xs text-wallet-copy-faint sm:hidden">{new Date(transaction.occurredAt).toLocaleDateString()}</p></div></div>; })}</div>}
            {isAuthenticated && totalTxPages > 1 && <div className="flex items-center justify-end gap-3 border-t border-wallet-line px-5 py-3"><Button variant="ghost" size="icon" disabled={currentPage === 0} onClick={() => setTxPage((page) => Math.max(0, page - 1))} aria-label="Previous page" className="text-wallet-copy-muted hover:bg-wallet-muted hover:text-wallet-copy"><ChevronLeft /></Button><span className="text-xs tabular-nums text-wallet-copy-muted">{currentPage + 1} / {totalTxPages}</span><Button variant="ghost" size="icon" disabled={currentPage >= totalTxPages - 1} onClick={() => setTxPage((page) => Math.min(totalTxPages - 1, page + 1))} aria-label="Next page" className="text-wallet-copy-muted hover:bg-wallet-muted hover:text-wallet-copy"><ChevronRight /></Button></div>}
          </section>

          <section className="self-start border-l-2 border-wallet-crimson bg-wallet-panel-raised p-6 xl:col-span-4 xl:p-8">
            <div className="mb-6"><p className="text-xs font-semibold uppercase tracking-[0.1em] text-wallet-crimson">Cashback planner</p><h2 className="mt-2 font-wallet-display text-lg font-semibold text-wallet-copy">Estimate your earnings</h2><p className="mt-1 text-xs leading-5 text-wallet-copy-muted">See how spending volume may affect estimated annual cashback.</p></div>
            <div className="flex items-end justify-between gap-3"><label htmlFor="wallet-spend" className="text-xs text-wallet-copy-muted">Monthly volume</label><span className="font-wallet-display text-lg font-semibold tabular-nums text-wallet-copy">{fmt(spend, cur)}</span></div>
            <input id="wallet-spend" type="range" min={0} max={Math.round(tierMid * 10)} step={Math.max(1, Math.round(tierMid / 100))} value={spend} onChange={(event) => setSpend(Number(event.target.value))} className="mt-4 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-wallet-muted accent-wallet-crimson" />
            <div className="mt-5 grid grid-cols-3 gap-2">{tiers.map((item) => { const active = item.key === tier?.key; return <div key={item.key} className={`rounded-[10px] border p-2.5 text-center ${active ? "border-wallet-crimson-line bg-wallet-crimson-soft" : "border-wallet-line bg-wallet-panel-raised"}`}><p className="text-xs font-semibold text-wallet-copy">{item.label}</p><p className="mt-1 text-[10px] text-wallet-copy-faint">{item.pct}%</p></div>; })}</div>
            <div className="mt-5 rounded-[10px] border border-wallet-crimson-line bg-wallet-crimson-soft p-5"><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-wallet-copy-muted">Estimated annual cashback</p><p className="mt-2 font-wallet-display text-3xl font-semibold tabular-nums text-wallet-copy">{mask(fmt(annual, cur))}</p><p className="mt-2 text-xs text-wallet-copy-muted">At the {tier?.label ?? "Baseline"} estimate</p></div>
          </section>
        </div>
      </main>

      {transferOpen && <TransferModal onClose={() => setTransferOpen(false)} onDone={() => { setTransferOpen(false); toast.success("Transfer completed"); }} />}
      {addFundsOpen && <AddCapitalModal onClose={() => setAddFundsOpen(false)} />}
      {payoutOpen && <PayoutModal onClose={() => setPayoutOpen(false)} />}
    </div>
  );
}

export { AddCapitalModal } from "./wallet/AddCapitalModal";
export { PayoutModal } from "./wallet/PayoutModal";