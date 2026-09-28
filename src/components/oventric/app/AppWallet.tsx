import { useState } from "react";
import { AppAddFundsSheet } from "@/components/oventric/app/AppAddFundsSheet";
import { AppWalletHistorySheet } from "@/components/oventric/app/AppWalletHistorySheet";
import { AppWalletLedgerSheet } from "@/components/oventric/app/AppWalletLedgerSheet";
import { PayoutModal } from "@/components/oventric/wallet/PayoutModal";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronRight,
  History,
  ReceiptText,
  Eye,
  EyeOff,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";

import {
  getWalletBalances,
  listWalletTransactions,
} from "@/lib/wallet.functions";
import { usdEquivalent, visibleMoney } from "@/lib/money-visibility";
import type { Currency } from "@/lib/onboarding/OnboardingContext";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { useAuthGate } from "@/lib/auth-gate/AuthGateProvider";
import { haptic } from "@/lib/haptics";

/**
 * Native app Wallet — compact dark balance card plus a tight activity list.
 * Full management (funding rails, withdrawals, ledger) lives on the wallet
 * pages, one tap deeper.
 */
export function AppWallet() {
  const { homeCurrency, balancesHidden, toggleBalancesHidden } = useOnboarding();
  const { isAuthenticated, openGate } = useAuthGate();
  const currency = (homeCurrency ?? "USD") as Currency;

  const [fundOpen, setFundOpen] = useState(false);
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const fetchBalances = useServerFn(getWalletBalances);
  const fetchTx = useServerFn(listWalletTransactions);

  const { data: balances } = useQuery({
    queryKey: ["app-wallet-balances"],
    queryFn: () => fetchBalances(),
    enabled: isAuthenticated,
    staleTime: 30_000,
  });

  const { data: tx } = useQuery({
    queryKey: ["app-wallet-tx"],
    queryFn: () => fetchTx({ data: { page: 1, pageSize: 12 } }),
    enabled: isAuthenticated,
    staleTime: 30_000,
  });

  const available = balances ? (balances.balances[currency] ?? 0) : null;
  const inEscrow = balances ? (balances.escrow[currency] ?? 0) : null;

  const guard = (run: () => void) => () => {
    haptic("select");
    if (!isAuthenticated) {
      openGate("funding");
      return;
    }
    run();
  };

  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-28 pt-4 text-white">
      {/* Balance card with crimson glow */}
      <div className="relative mt-4 overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#17171B] to-[#0C0C0E] p-5">
        <div
          className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(229,72,77,0.35), transparent 70%)" }}
        />
        <div className="relative">
          <div className="flex items-center justify-between"><p className="text-[11px] font-medium uppercase tracking-widest text-white/40">Available balance</p><button type="button" onClick={toggleBalancesHidden} aria-label={balancesHidden ? "Show amounts" : "Hide amounts"} className="grid size-8 place-items-center text-white/60">{balancesHidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div>
          <p className="mt-1 text-[30px] font-extrabold tracking-tight">
            {available === null ? "—" : visibleMoney(available, currency, balancesHidden)}
          </p>
          {available !== null && usdEquivalent(available, currency, balancesHidden) && <p className="text-[11px] text-white/45">{usdEquivalent(available, currency, balancesHidden)}</p>}
          {inEscrow !== null && inEscrow > 0 && (
            <p className="mt-0.5 text-[11px] font-medium text-white/45">
              {visibleMoney(inEscrow, currency, balancesHidden)} held in escrow
            </p>
          )}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={guard(() => setFundOpen(true))}
              className="nav-tap flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#E5484D] py-2.5 text-[13px] font-bold text-white shadow-[0_8px_24px_-8px_rgba(229,72,77,0.6)]"
            >
              <ArrowDownToLine className="h-4 w-4" /> Top up
            </button>
            <button
              type="button"
              onClick={guard(() => setPayoutOpen(true))}
              className="nav-tap flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.06] py-2.5 text-[13px] font-bold text-white"
            >
              <ArrowUpFromLine className="h-4 w-4" /> Withdraw
            </button>
          </div>
        </div>
      </div>

      {/* Shortcuts */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={guard(() => setHistoryOpen(true))}
          className="nav-tap flex items-center gap-2.5 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3.5 py-3 text-left"
        >
          <History className="h-[18px] w-[18px] shrink-0 text-[#E5484D]" />
          <span className="flex-1 text-[12px] font-semibold text-white/80">History</span>
          <ChevronRight className="h-4 w-4 text-white/25" />
        </button>
        <button
          type="button"
          onClick={guard(() => setLedgerOpen(true))}
          className="nav-tap flex items-center gap-2.5 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3.5 py-3 text-left"
        >
          <ReceiptText className="h-[18px] w-[18px] shrink-0 text-[#E5484D]" />
          <span className="flex-1 text-[12px] font-semibold text-white/80">Ledger</span>
          <ChevronRight className="h-4 w-4 text-white/25" />
        </button>
      </div>

      {/* Recent activity */}
      <h2 className="mb-2 mt-6 text-[14px] font-bold tracking-tight">Recent activity</h2>
      {!isAuthenticated ? (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6 text-center">
          <p className="text-[13px] text-white/40">Sign in to see your wallet activity.</p>
          <button
            type="button"
            onClick={() => openGate("funding")}
            className="nav-tap mt-3 rounded-xl bg-[#E5484D] px-5 py-2 text-[13px] font-bold text-white"
          >
            Sign in
          </button>
        </div>
      ) : (tx?.items ?? []).length === 0 ? (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6 text-center text-[13px] text-white/40">
          No transactions yet.
        </div>
      ) : (
        <div className="divide-y divide-white/[0.05] overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.03]">
          {(tx?.items ?? []).map((t) => (
            <div key={t.id} className="flex items-center gap-3 px-4 py-3">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                  t.inflow ? "bg-emerald-500/15 text-emerald-400" : "bg-white/[0.06] text-white/50"
                }`}
              >
                {t.inflow ? (
                  <ArrowDownToLine className="h-3.5 w-3.5" />
                ) : (
                  <ArrowUpFromLine className="h-3.5 w-3.5" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-semibold">{t.type}</p>
                <p className="text-[10px] capitalize text-white/35">
                  {t.statusLabel || t.status} ·{" "}
                  {new Date(t.occurredAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              </div>
              <div
                className={`text-[12px] font-bold tabular-nums ${
                  t.inflow ? "text-emerald-400" : "text-white/80"
                }`}
              >
                {t.inflow ? "+" : "−"}
                {visibleMoney(t.amount, t.currency as Currency, balancesHidden)}
                {usdEquivalent(t.amount, t.currency as Currency, balancesHidden) && <span className="block text-[10px] font-normal text-white/40">{usdEquivalent(t.amount, t.currency as Currency, balancesHidden)}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
      {fundOpen && <AppAddFundsSheet onClose={() => setFundOpen(false)} />}
      {payoutOpen && <PayoutModal onClose={() => setPayoutOpen(false)} />}
      {historyOpen && <AppWalletHistorySheet onClose={() => setHistoryOpen(false)} />}
      {ledgerOpen && <AppWalletLedgerSheet onClose={() => setLedgerOpen(false)} />}
    </div>
  );
}
