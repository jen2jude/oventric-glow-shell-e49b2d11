import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useAuthGate, type AuthGateContextKey } from "@/lib/auth-gate/AuthGateProvider";
import { currencyForCountry, normalizeCountryCode, zeroAmounts } from "@/lib/currency/africa";

export type Tier = 0 | 1 | 2 | 3 | 4 | 5;
export type Stage = 1 | 2 | 3 | 4 | 5;
/** ISO-2 country code of any African country, or "OTHER" for rest-of-world. */
export type Country = string;
/** Any currency in the pan-African registry (see @/lib/currency/africa). */
export type Currency = string;

/**
 * Country → base currency map. Every African country maps to its own national
 * currency (NGN, GHS, KES, ZAR, XOF, …); rest-of-world falls back to USD.
 * Single source of truth for onboarding, wallets, marketplace, bounties,
 * academy and funding/withdrawal.
 */
export function countryToCurrency(country: Country | null | undefined): Currency {
  return currencyForCountry(country);
}

/**
 * Parses a raw country value from the database into a known country code.
 * Unrecognised free-form values collapse into "OTHER" (USD baseline).
 */
export function parseCountry(raw: string | null | undefined): Country | null {
  return normalizeCountryCode(raw);
}

/**
 * Countries whose native currency is USD — i.e. rest-of-world members.
 */
export function isUsdNativeCountry(country: Country | null | undefined): boolean {
  return currencyForCountry(country) === "USD";
}

export function canTransactInUsd(country: Country | null | undefined): boolean {
  // USD is a global rail — always available. Non-USD-native countries get it
  // as a secondary transaction currency alongside their base currency.
  return true;
}

export type PayoutBank =
  | { country: "NG"; bank: string; accountNumber: string; accountName: string }
  | { country: "GH"; network: string; momoNumber: string; walletName: string }
  | null;

interface OnboardingState {
  tier: Tier;
  country: Country | null;
  fullName: string;
  storeName: string;
  phone: string;
  baseCurrency: Currency;
  payoutBank: PayoutBank;
  balances: Record<string, number>;
  escrow: Record<string, number>;
  cashback: number;
  balancesHidden: boolean;
}

interface OnboardingContextValue extends OnboardingState {
  /**
   * The user's real, transactional currency (derived from their country).
   * Every money movement — checkout, wallet, publishing, payouts — MUST use
   * this, never the preview currency.
   */
  homeCurrency: Currency;
  /** True while the user is previewing prices in USD. Display-only. */
  usdPreview: boolean;
  setUsdPreview: (on: boolean) => void;
  openStage: Stage | null;
  setOpenStage: (s: Stage | null) => void;
  require: (minTier: Tier, onSuccess?: () => void, authContext?: AuthGateContextKey) => void;
  advanceTo: (t: Tier, patch?: Partial<OnboardingState>) => void;
  setBaseCurrency: (c: Currency) => void;
  updateBalance: (c: Currency, delta: number) => void;
  setBalances: (
    balances: Record<string, number>,
    escrow?: Record<string, number>,
    cashback?: number,
  ) => void;
  setBalancesHidden: (hidden: boolean) => void;
  toggleBalancesHidden: () => void;
}


const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OnboardingState>({
    tier: 0,
    country: null,
    fullName: "",
    storeName: "",
    phone: "",
    baseCurrency: "USD",
    payoutBank: null,
    balances: { USD: 0, NGN: 0, GHS: 0 },
    escrow: { USD: 0, NGN: 0, GHS: 0 },
    cashback: 0,
    balancesHidden: false,
  });
  const [openStage, setOpenStage] = useState<Stage | null>(null);
  const [usdPreview, setUsdPreview] = useState(false);
  const [pending, setPending] = useState<{ minTier: Tier; cb?: () => void } | null>(null);


  const { ensureUserAuthenticated } = useAuthGate();

  const require = useCallback(
    (minTier: Tier, onSuccess?: () => void, authContext: AuthGateContextKey = "generic") => {
      // Global auth gate always fires first. If the user is already signed in
      // this resolves synchronously and we fall straight through to the tier
      // ladder; otherwise the OTP modal opens and the pending callback
      // re-enters this branch after SIGNED_IN.
      ensureUserAuthenticated(() => {
        if (state.tier >= minTier || minTier <= 1) {
          onSuccess?.();
          return;
        }
        // Stage 1 (email verification) is fully owned by the AuthGate — the
        // progressive Stage 1 modal is removed. Open at Stage 2 or later.
        const nextStage = Math.max(state.tier + 1, 2) as Stage;
        setPending({ minTier, cb: onSuccess });
        setOpenStage(nextStage);
      }, authContext);
    },
    [state.tier, ensureUserAuthenticated],
  );

  const advanceTo = useCallback((t: Tier, patch?: Partial<OnboardingState>) => {
    setState((s) => {
      const merged = { ...s, ...patch, tier: t };
      // Re-derive base currency from country whenever country is set/changed
      // so the wallet + top-up currency stay locked to the profile country.
      if (patch && "country" in patch) {
        merged.baseCurrency = countryToCurrency(merged.country);
      }
      return merged;
    });
    // If reached the pending target, run callback and close.
    setPending((p) => {
      if (p && t >= p.minTier) {
        setOpenStage(null);
        setTimeout(() => p.cb?.(), 50);
        return null;
      }
      // otherwise auto-advance to next stage
      if (p) {
        setOpenStage(((t + 1) as Stage) <= 5 ? ((t + 1) as Stage) : null);
      } else {
        setOpenStage(null);
      }
      return p;
    });
  }, []);

  // Base currency is LOCKED to the user's country: US/UK/OTHER → USD, NG → NGN,
  // GH → GHS. The setter is retained for backwards compatibility but silently
  // enforces the country-derived value — passing a different currency is a
  // no-op. Country changes flow through advanceTo / profile hydration.
  const setBaseCurrency = useCallback(
    (_c: Currency) => setState((s) => ({ ...s, baseCurrency: countryToCurrency(s.country) })),
    [],
  );
  const updateBalance = useCallback(
    (c: Currency, delta: number) =>
      setState((s) => ({ ...s, balances: { ...s.balances, [c]: (s.balances[c] ?? 0) + delta } })),
    [],
  );
  const setBalances = useCallback(
    (balances: Record<string, number>, escrow?: Record<string, number>, cashback?: number) =>
      setState((s) => ({
        ...s,
        balances,
        escrow: escrow ?? s.escrow,
        cashback: cashback ?? s.cashback,
      })),
    [],
  );
  const setBalancesHidden = useCallback(
    (hidden: boolean) => setState((s) => ({ ...s, balancesHidden: hidden })),
    [],
  );
  const toggleBalancesHidden = useCallback(
    () => setState((s) => ({ ...s, balancesHidden: !s.balancesHidden })),
    [],
  );

  const value = useMemo<OnboardingContextValue>(
    () => ({
      ...state,
      // Display currency: the user's home currency, or USD while previewing.
      baseCurrency: usdPreview && state.baseCurrency !== "USD" ? "USD" : state.baseCurrency,
      homeCurrency: state.baseCurrency,
      usdPreview,
      setUsdPreview,
      openStage,
      setOpenStage: (s) => {
        if (s === null) setPending(null);
        setOpenStage(s);
      },
      require,
      advanceTo,
      setBaseCurrency,
      updateBalance,
      setBalances,
      setBalancesHidden,
      toggleBalancesHidden,
    }),
    [
      state,
      usdPreview,
      openStage,
      require,
      advanceTo,
      setBaseCurrency,
      updateBalance,
      setBalances,
      setBalancesHidden,
      toggleBalancesHidden,
    ],

  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used inside OnboardingProvider");
  return ctx;
}
