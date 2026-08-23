import type { Currency } from "@/lib/onboarding/OnboardingContext";
import {
  CURRENCY_CODES,
  CURRENCY_META,
  currencyDecimals,
  fallbackRateTable,
  isSupportedCurrency,
} from "@/lib/currency/africa";

/**
 * Snapshot object stored on rows (products/bounties/courses). Rates are always
 * USD-base ("1 USD = X <currency>"). See src/lib/fx.functions.ts for how these
 * are minted at publish time.
 */
export interface FxSnapshot {
  base: "USD";
  rates: Partial<Record<Currency, number>>;
  source?: string;
  fetched_at?: string;
}

/**
 * Fallback rates used ONLY when no live rate has been fetched yet (first paint,
 * offline, provider outage) and the row carries no snapshot. Covers every
 * currency in the pan-African registry.
 */
export const LEGACY_USD_RATES: Record<Currency, number> = fallbackRateTable();

/**
 * Live USD-base rates, refreshed periodically by useLiveFx() at the app root.
 * Every conversion prefers these so buyers and sellers in different countries
 * see near-accurate, current conversions.
 */
let RUNTIME_RATES: Partial<Record<Currency, number>> | null = null;

export function setRuntimeFxRates(rates: Partial<Record<Currency, number>> | null | undefined) {
  if (!rates) return;
  const next: Partial<Record<Currency, number>> = { USD: 1 };
  for (const c of CURRENCY_CODES) {
    const v = Number(rates[c]);
    if (v > 0) next[c] = v;
  }
  RUNTIME_RATES = next;
}

/** Current USD → `currency` rate (live when available, otherwise fallback). */
export function usdRate(currency: Currency): number {
  const live = RUNTIME_RATES?.[currency];
  return Number(live) > 0 ? Number(live) : (LEGACY_USD_RATES[currency] ?? 1);
}

export function formatMoney(amount: number, currency: Currency): string {
  const value = Number(amount) || 0;
  const dp = currencyDecimals(currency);
  const rounded =
    dp === 2
      ? value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : Math.round(value).toLocaleString();
  return `${currencySymbol(currency)}${rounded}`;
}

export function currencySymbol(currency: Currency): string {
  if (typeof currency !== "string") return "";
  return CURRENCY_META[currency]?.symbol ?? `${currency} `;
}

function isCurrency(c: unknown): c is Currency {
  return isSupportedCurrency(c);
}


function normalizeSnapshot(raw: unknown): FxSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const rates = obj.rates as Record<string, number> | undefined;
  if (!rates || typeof rates !== "object") return null;
  const usd = Number(rates.USD ?? 1);
  const ngn = Number(rates.NGN);
  const ghs = Number(rates.GHS);
  return {
    base: "USD",
    rates: {
      USD: usd > 0 ? usd : 1,
      NGN: ngn > 0 ? ngn : undefined,
      GHS: ghs > 0 ? ghs : undefined,
    },
    source: typeof obj.source === "string" ? (obj.source as string) : undefined,
    fetched_at: typeof obj.fetched_at === "string" ? (obj.fetched_at as string) : undefined,
  };
}

export type FxValidation =
  | { ok: true; snapshot: FxSnapshot; missingRateFor: null }
  | { ok: false; reason: "missing" | "malformed" | "missing_rate"; missingRateFor: Currency | null };

/**
 * Validate a row's FX snapshot against the viewer's currency. Returns a
 * structured result so the UI can decide whether to warn or block checkout.
 */
export function validateFxSnapshot(row: PriceableRow | null | undefined, viewer: Currency): FxValidation {
  if (!row) return { ok: false, reason: "missing", missingRateFor: null };
  const raw = row.fx_snapshot;
  if (raw === null || raw === undefined) return { ok: false, reason: "missing", missingRateFor: null };
  const snapshot = normalizeSnapshot(raw);
  if (!snapshot) return { ok: false, reason: "malformed", missingRateFor: null };
  const originalCurrency: Currency = isCurrency(row.original_currency) ? row.original_currency : "USD";
  const fromRate = snapshot.rates[originalCurrency];
  const toRate = snapshot.rates[viewer];
  if (!(Number(fromRate) > 0)) return { ok: false, reason: "missing_rate", missingRateFor: originalCurrency };
  if (!(Number(toRate) > 0)) return { ok: false, reason: "missing_rate", missingRateFor: viewer };
  return { ok: true, snapshot, missingRateFor: null };
}

/**
 * Convert an amount between two currencies. Prefers current live rates (so a
 * Ghanaian buyer sees today's true GHS value of a Nigerian seller's price),
 * then the row's publish-time snapshot, then the static fallback.
 */
export function convertViaSnapshot(
  amount: number,
  from: Currency,
  to: Currency,
  snapshot: FxSnapshot | null | undefined,
): number {
  if (from === to || !(amount > 0)) return amount;
  const snapRates = snapshot?.rates ?? {};
  const pick = (c: Currency) => {
    const live = RUNTIME_RATES?.[c];
    if (Number(live) > 0) return Number(live);
    const snap = snapRates[c];
    if (Number(snap) > 0) return Number(snap);
    return Number(LEGACY_USD_RATES[c]);
  };
  const fromRate = pick(from);
  const toRate = pick(to);
  if (!(fromRate > 0) || !(toRate > 0)) return amount;
  return (amount / fromRate) * toRate;
}

/**
 * A minimal shape describing any listing row. All three snapshot fields are
 * optional — legacy rows fall back to `price_usd` interpreted as USD.
 */
export interface PriceableRow {
  original_currency?: string | null;
  original_amount?: number | null;
  fx_snapshot?: unknown;
  price_usd?: number | null;
}

export interface DisplayPrice {
  /** Value in viewer's currency. */
  value: number;
  currency: Currency;
  formatted: string;
  /** e.g. "≈ ₵850" when the row's original currency differs from the viewer's. */
  originalFormatted: string | null;
  originalCurrency: Currency;
  originalAmount: number;
  /** USD equivalent from the snapshot (canonical amount used for wallets/orders). */
  usd: number;
  /** True when the row has a real FX snapshot (locked at publish). */
  isLocked: boolean;
}

/**
 * Compute how a listing should be displayed in the viewer's base currency.
 *
 * - If the row has a snapshot: convert from `original_currency` → viewer using
 *   the snapshot rates. The amount is truly locked.
 * - Otherwise: treat `price_usd` as USD-native and convert with fallback rates.
 */
export function computeDisplayPrice(row: PriceableRow, viewer: Currency): DisplayPrice {
  // Defensive: any malformed input should still yield a renderable price so
  // the UI (and checkout) never crashes on a bad/missing fx_snapshot.
  try {
    const safeViewer: Currency = isCurrency(viewer) ? viewer : "USD";
    const snapshot = normalizeSnapshot(row?.fx_snapshot);
    const originalCurrency: Currency = isCurrency(row?.original_currency)
      ? row.original_currency
      : "USD";
    const rawAmount = Number(row?.original_amount ?? row?.price_usd ?? 0);
    const originalAmount = Number.isFinite(rawAmount) && rawAmount >= 0 ? rawAmount : 0;

    const value = convertViaSnapshot(originalAmount, originalCurrency, safeViewer, snapshot);
    const usd =
      originalCurrency === "USD"
        ? originalAmount
        : convertViaSnapshot(originalAmount, originalCurrency, "USD", snapshot);

    const safeValue = Number.isFinite(value) ? value : originalAmount;
    const safeUsd = Number.isFinite(usd) ? usd : originalAmount;

    return {
      value: safeValue,
      currency: safeViewer,
      formatted: originalAmount === 0 ? "Free" : formatMoney(safeValue, safeViewer),
      originalFormatted:
        originalCurrency !== safeViewer && originalAmount > 0
          ? formatMoney(originalAmount, originalCurrency)
          : null,
      originalCurrency,
      originalAmount,
      usd: safeUsd,
      isLocked: snapshot !== null,
    };
  } catch {
    const fallbackAmount = Number(row?.price_usd ?? row?.original_amount ?? 0) || 0;
    const safeViewer: Currency = isCurrency(viewer) ? viewer : "USD";
    const converted = fallbackAmount * usdRate(safeViewer);
    return {
      value: converted,
      currency: safeViewer,
      formatted: formatMoney(converted, safeViewer),
      originalFormatted: null,
      originalCurrency: "USD",
      originalAmount: fallbackAmount,
      usd: fallbackAmount,
      isLocked: false,
    };
  }
}

/**
 * Safe wrapper for callers that want a plain formatted string. Guarantees a
 * renderable value even when `row` is null/undefined or the snapshot is junk.
 */
export function safeFormatDisplayPrice(row: PriceableRow | null | undefined, viewer: Currency): string {
  if (!row) return formatMoney(0, isCurrency(viewer) ? viewer : "USD");
  return computeDisplayPrice(row, viewer).formatted;
}
