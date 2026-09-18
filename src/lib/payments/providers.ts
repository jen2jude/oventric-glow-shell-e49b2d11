/**
 * Payment provider registry + routing rules.
 *
 * Client-safe: pure data and pure functions only. No secrets, no fetch.
 *
 * Routing policy (agreed with the operator):
 *  - Paystack stays primary for NGN / GHS / ZAR / KES because its local card
 *    fees are the cheapest there.
 *  - Flutterwave is primary everywhere else it settles natively (UGX, TZS,
 *    RWF, XAF, XOF, ZMW, MWK, EGP, MAD …) so those users are charged in their
 *    own currency instead of a cross-border USD charge.
 *  - Anything neither gateway settles natively falls back to a USD charge on
 *    whichever gateway is enabled (Flutterwave first — better global cards).
 *  - MiniPay is a manual, proof-of-payment rail. It is only ever offered for
 *    one-off item purchases (marketplace, academy, bounty funding) — never for
 *    wallet top-ups.
 */

import { ACTIVE_RAILS, type ManualRail } from "@/lib/payments/active-rails";

export type PaymentProvider = "flutterwave" | "paystack" | "minipay";

/** Currencies Flutterwave can charge/settle directly. */
export const FLUTTERWAVE_CURRENCIES = [
  "NGN",
  "GHS",
  "KES",
  "ZAR",
  "UGX",
  "TZS",
  "RWF",
  "XAF",
  "XOF",
  "ZMW",
  "MWK",
  "EGP",
  "MAD",
  "USD",
] as const;

/** Currencies Paystack can charge/settle directly. */
export const PAYSTACK_CHARGE_CURRENCIES = ["NGN", "GHS", "ZAR", "KES", "USD"] as const;

/** Where Paystack is cheaper than Flutterwave, so it keeps priority. */
const PAYSTACK_PREFERRED = ["NGN", "GHS", "ZAR", "KES"] as const;

export function isFlutterwaveCurrency(code: string): boolean {
  return (FLUTTERWAVE_CURRENCIES as readonly string[]).includes(String(code).toUpperCase());
}

export function isPaystackChargeCurrency(code: string): boolean {
  return (PAYSTACK_CHARGE_CURRENCIES as readonly string[]).includes(String(code).toUpperCase());
}

export interface GatewaySettings {
  flutterwaveEnabled: boolean;
  paystackEnabled: boolean;
  minipayEnabled: boolean;
  minipayHandle: string | null;
  minipayAccountName: string | null;
  minipayInstructions: string | null;
  /** Empty array = MiniPay accepted for every currency. */
  minipayCurrencies: string[];
}

export const DEFAULT_GATEWAY_SETTINGS: GatewaySettings = {
  flutterwaveEnabled: true,
  paystackEnabled: true,
  minipayEnabled: false,
  minipayHandle: null,
  minipayAccountName: null,
  minipayInstructions: null,
  minipayCurrencies: [],
};

export interface RouteResult {
  /** Gateway that will actually take the card/momo payment. */
  provider: Exclude<PaymentProvider, "minipay">;
  /** Currency the charge is created in (may differ from the user's currency). */
  chargeCurrency: string;
  /** True when we had to fall back to a cross-border USD charge. */
  crossBorder: boolean;
}

/**
 * Pick the automated gateway for a given home currency.
 *
 * MVP lock: Paystack is the only active automated gateway. The Flutterwave
 * branches below are retained for future development but are unreachable
 * while `ACTIVE_RAILS.flutterwave` is false.
 */
export function routeGateway(currency: string, settings: GatewaySettings): RouteResult {
  const cur = String(currency || "USD").toUpperCase();
  const fw = settings.flutterwaveEnabled && ACTIVE_RAILS.flutterwave;
  const ps = settings.paystackEnabled;

  if (!fw && !ps) throw new Error("No payment gateway is currently enabled.");

  const paystackPreferred = (PAYSTACK_PREFERRED as readonly string[]).includes(cur);

  // 1. Native settlement in the user's own currency.
  if (paystackPreferred && ps) {
    return { provider: "paystack", chargeCurrency: cur, crossBorder: false };
  }
  if (isFlutterwaveCurrency(cur) && fw) {
    return { provider: "flutterwave", chargeCurrency: cur, crossBorder: false };
  }
  if (isPaystackChargeCurrency(cur) && ps) {
    return { provider: "paystack", chargeCurrency: cur, crossBorder: false };
  }

  // 2. Cross-border USD fallback.
  if (fw) return { provider: "flutterwave", chargeCurrency: "USD", crossBorder: true };
  return { provider: "paystack", chargeCurrency: "USD", crossBorder: true };
}

/** Whether a manual (proof-of-payment) rail may be offered. */
export function manualRailAvailable(
  rail: ManualRail,
  purpose: "order" | "course" | "bounty" | "wallet_topup",
  currency: string,
  settings: GatewaySettings,
): boolean {
  if (purpose === "wallet_topup") return false; // manual rails never fund the wallet directly
  if (rail === "binance") return ACTIVE_RAILS.binance;
  return ACTIVE_RAILS.minipay && minipayAvailable(purpose, currency, settings);
}

/** Whether MiniPay may be offered for this purpose + currency. */
export function minipayAvailable(
  purpose: "order" | "course" | "bounty" | "wallet_topup",
  currency: string,
  settings: GatewaySettings,
): boolean {
  if (!settings.minipayEnabled) return false;
  if (purpose === "wallet_topup") return false; // never for funding the wallet
  if (!settings.minipayHandle) return false;
  const allow = settings.minipayCurrencies;
  if (!allow.length) return true;
  return allow.map((c) => c.toUpperCase()).includes(String(currency).toUpperCase());
}

export const PROVIDER_LABEL: Record<PaymentProvider, string> = {
  flutterwave: "Flutterwave",
  paystack: "Paystack",
  minipay: "MiniPay",
};
