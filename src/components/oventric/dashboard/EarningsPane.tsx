import { useServerFn } from "@tanstack/react-start";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getMyWalletSummary } from "@/lib/dashboard.functions";
import { 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight, 
  Clock, 
  CheckCircle2,
  Wallet,
  ArrowRight
} from "lucide-react";
import { formatMoney } from "@/lib/fx-display";
import { visibleMoney, usdEquivalent } from "@/lib/money-visibility";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";

export function EarningsPane() {
  const { balancesHidden } = useOnboarding();
  const fetchWallet = useServerFn(getMyWalletSummary);

  const { data: wallet } = useSuspenseQuery({
    queryKey: ["my-wallet-seller"],
    queryFn: () => fetchWallet({}),
  });

  if (!wallet) return null;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="mb-6">
        <h3 className="text-lg font-bold text-white mb-1">Financial Overview</h3>
        <p className="text-sm text-slate-500">Track your earnings, payouts, and balances.</p>
      </div>

      {/* Main Balances */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#141418] border border-white/10 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Available Balance</span>
            <Wallet className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-black text-white">
            {visibleMoney(wallet.mainBalance, wallet.homeCurrency, balancesHidden)}
          </div>
          <div className="text-xs text-slate-500">{usdEquivalent(wallet.mainBalance, wallet.homeCurrency, balancesHidden)}</div>
          <div className="mt-2 text-xs text-slate-500">
            Ready for withdrawal to your bank account.
          </div>
          <button className="mt-6 w-full py-2.5 rounded-xl bg-white text-black text-sm font-bold hover:bg-slate-200 transition-colors">
            Request Payout
          </button>
        </div>

        <div className="bg-[#141418] border border-white/10 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Escrow Balance</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-3xl font-black text-white">
            {visibleMoney(wallet.escrow, wallet.homeCurrency, balancesHidden)}
          </div>
          <div className="text-xs text-slate-500">{usdEquivalent(wallet.escrow, wallet.homeCurrency, balancesHidden)}</div>
          <div className="mt-2 text-xs text-slate-500">
            Funds held securely until buyer confirmation.
          </div>
        </div>
      </div>

      {/* Transaction History */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-bold text-white uppercase tracking-widest text-[10px]">Recent Transactions</h4>
          <button className="text-[10px] font-bold text-[#E5484D] uppercase tracking-widest hover:underline flex items-center gap-1">
            View All <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="bg-[#141418] border border-white/10 rounded-2xl overflow-hidden divide-y divide-white/5">
          {wallet.recent.map((tx) => (
            <div key={tx.id} className="p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  tx.inflow ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                }`}>
                  {tx.inflow ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-white truncate">{tx.type}</div>
                  <div className="text-[10px] text-slate-500 flex items-center gap-2">
                    {new Date(tx.occurredAt).toLocaleDateString()} · {tx.statusLabel}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className={`text-sm font-black ${tx.inflow ? "text-emerald-400" : "text-white"}`}>
                  {tx.inflow ? "+" : "-"}{visibleMoney(tx.amountHome, wallet.homeCurrency, balancesHidden)}
                </div>
                <div className="text-[10px] text-slate-500">{usdEquivalent(tx.amountHome, wallet.homeCurrency, balancesHidden)}</div>
              </div>
            </div>
          ))}

          {wallet.recent.length === 0 && (
            <div className="p-8 text-center text-slate-500 text-sm italic">
              No recent transactions found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
