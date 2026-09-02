import { useEffect, useRef, useState } from "react";
import {
  Eye,
  EyeOff,
  Wallet as WalletIcon,
  ChevronDown,
  Lock,
  Coins,
  TrendingUp,
  Gift,
  Store,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getWalletBalances } from "@/lib/wallet.functions";
import { useOnboarding, type Currency } from "@/lib/onboarding/OnboardingContext";
import { useAuthGate } from "@/lib/auth-gate/AuthGateProvider";
import { supabase } from "@/integrations/supabase/client";
import { usdRate, formatMoney } from "@/lib/fx-display";
import { dbCurrency } from "@/lib/currency/africa";

function fmt(n: number, c: Currency) {
  return formatMoney(n, c);
}

function fromUSD(usd: number, target: Currency): number {
  if (target === "USD") return usd;
  return usd * usdRate(target);
}

export function HeaderWalletChip({
  align = "left",
  compact = false,
}: { align?: "left" | "right"; compact?: boolean } = {}) {
  const { isAuthenticated } = useAuthGate();
  const { homeCurrency, balancesHidden, toggleBalancesHidden, country } = useOnboarding();
  const hasCountry = country != null;
  const displayCurrency: Currency = hasCountry ? homeCurrency : "USD";
  const getBalances = useServerFn(getWalletBalances);
  const [open, setOpen] = useState(false);
  const [main, setMain] = useState(0);
  const [escrow, setEscrow] = useState(0);
  const [cashback, setCashback] = useState(0);
  const [bounty, setBounty] = useState(0);
  const [seller, setSeller] = useState(0);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    const load = () => {
      getBalances()
        .then((r) => {
          if (cancelled) return;
          setMain(r.balances[homeCurrency] ?? 0);
          setEscrow(r.escrow[homeCurrency] ?? 0);
          setCashback(r.cashback ?? 0);
          setBounty(r.bountyBalance ?? 0);
        })
        .catch(() => {});
    };
    load();

    let ch: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid || cancelled) return;
      // Seller earnings quick lookup
      const { data: sales } = await supabase
        .from("wallet_transactions")
        .select("amount")
        .eq("user_id", uid)
        .eq("type", "Marketplace Sale")
        .eq("currency", dbCurrency(homeCurrency))
        .eq("inflow", true)
        .eq("status", "success");
      if (!cancelled) {
        setSeller((sales ?? []).reduce((s, r: { amount: number }) => s + Number(r.amount ?? 0), 0));
      }
      ch = supabase
        .channel(`hdr-wallet-${uid}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "wallets", filter: `user_id=eq.${uid}` },
          () => load(),
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "wallet_transactions",
            filter: `user_id=eq.${uid}`,
          },
          () => load(),
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (ch) supabase.removeChannel(ch);
    };
  }, [isAuthenticated, homeCurrency, getBalances]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!isAuthenticated) return null;

  const mainDisplay = hasCountry ? main : fromUSD(main, "USD");
  const escrowDisplay = hasCountry ? escrow : fromUSD(escrow, "USD");
  const bountyDisplay = fromUSD(bounty, displayCurrency);
  const cashbackDisplay = fromUSD(cashback, displayCurrency);
  const sellerDisplay = hasCountry ? seller : fromUSD(seller, "USD");
  const display = balancesHidden ? "••••" : fmt(mainDisplay, displayCurrency);

  return (
    <div ref={wrapRef} className="relative">
      <div
        className={`inline-flex items-center gap-1 rounded-full bg-[#1E1E24] border border-emerald-500/30 ${compact ? "h-8 pl-2 pr-1" : "h-10 pl-3 pr-1.5"}`}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Wallet balance"
          aria-expanded={open}
          className="inline-flex items-center gap-1 text-white hover:text-emerald-300 transition-colors min-w-0"
        >
          <WalletIcon className={`shrink-0 text-emerald-300 ${compact ? "w-4 h-4" : "w-5 h-5"}`} />
          <span
            className={`font-semibold tabular-nums truncate ${compact ? "text-xs max-w-[5.5rem]" : "text-sm max-w-[8rem]"}`}
          >
            {display}
          </span>
          <ChevronDown
            className={`shrink-0 text-slate-400 transition-transform ${compact ? "w-3.5 h-3.5" : "w-4 h-4"} ${open ? "rotate-180" : ""}`}
          />
        </button>
        {!compact && (
          <button
            type="button"
            onClick={toggleBalancesHidden}
            aria-label={balancesHidden ? "Show balance" : "Hide balance"}
            className="p-1 rounded-full text-slate-400 hover:text-white transition-colors"
          >
            {balancesHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>

      {open && (
        <div
          role="dialog"
          className={`absolute mt-2 w-72 max-w-[calc(100vw-1.5rem)] rounded-2xl bg-[#17171B] border border-white/10 shadow-xl p-3 z-50 animate-scale-in ${align === "right" ? "right-0 origin-top-right" : "left-0 origin-top-left"}`}
        >
          <div className="text-[11px] uppercase tracking-wide text-slate-500 px-1 pb-2">
            Sub-wallets · {displayCurrency}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <SubTile
              icon={<Lock className="w-4 h-4" />}
              label="Escrowed"
              value={balancesHidden ? "••••" : fmt(escrowDisplay, displayCurrency)}
              tint="text-amber-300"
            />
            <SubTile
              icon={<TrendingUp className="w-4 h-4" />}
              label="Bounty earnings"
              value={balancesHidden ? "••••" : fmt(bountyDisplay, displayCurrency)}
              tint="text-sky-300"
            />
            <SubTile
              icon={<Gift className="w-4 h-4" />}
              label="Cashback"
              value={balancesHidden ? "••••" : fmt(cashbackDisplay, displayCurrency)}
              tint="text-emerald-300"
            />
            <SubTile
              icon={<Store className="w-4 h-4" />}
              label="Seller earnings"
              value={balancesHidden ? "••••" : fmt(sellerDisplay, displayCurrency)}
              tint="text-fuchsia-300"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              window.dispatchEvent(
                new CustomEvent("oventric:navigate", { detail: { section: "Wallet" } }),
              );
            }}
            className="mt-3 w-full inline-flex items-center justify-center gap-2 h-9 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 text-xs font-semibold hover:bg-emerald-500/25 transition-colors"
          >
            <Coins className="w-3.5 h-3.5" /> Open Sovereign Wallet
          </button>
        </div>
      )}
    </div>
  );
}

function SubTile({
  icon,
  label,
  value,
  tint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tint: string;
}) {
  return (
    <div className="rounded-xl bg-[#0f0f13] border border-white/5 p-2.5">
      <div className={`flex items-center gap-1.5 ${tint}`}>
        {icon}
        <span className="text-[10px] uppercase tracking-wide text-slate-400">{label}</span>
      </div>
      <div className="mt-1 text-sm font-semibold text-white tabular-nums truncate">{value}</div>
    </div>
  );
}
