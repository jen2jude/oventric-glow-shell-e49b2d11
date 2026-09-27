import { computeDisplayPrice, formatMoney, usdRate, type PriceableRow } from "@/lib/fx-display";
import type { Currency } from "@/lib/onboarding/OnboardingContext";

/** Display-only privacy. Never pass masked values into payments or calculations. */
export function visibleMoney(amount: number, currency: Currency, hidden: boolean): string {
  return hidden ? "••••" : formatMoney(amount, currency);
}

/** A small, approximate USD equivalent of the same amount, not a second wallet. */
export function usdEquivalent(amount: number, currency: Currency, hidden: boolean): string | null {
  if (currency === "USD") return null;
  return hidden ? "••••" : `≈ ${formatMoney(amount / usdRate(currency), "USD")}`;
}

/** Apply display-only privacy to a listing, without changing its checkout price. */
export function visibleProductPrice(row: PriceableRow, currency: Currency, hidden: boolean): string {
  const price = computeDisplayPrice(row, currency);
  return price.originalAmount === 0 ? "Free" : visibleMoney(price.value, currency, hidden);
}