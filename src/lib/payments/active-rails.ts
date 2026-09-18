/**
 * MVP payment architecture lock.
 *
 * Exactly four rails are active:
 *   1. Paystack        — automated gateway
 *   2. Oventric Wallet — internal balance
 *   3. Binance User ID — manual, admin/finance approved
 *   4. MiniPay         — manual, admin/finance approved
 *
 * Flutterwave, NOWPayments and all crypto-wallet deposit funding are OFF.
 * Their code is retained for future development but must never be reachable
 * from an active workflow. Every active surface reads these flags.
 */

export const ACTIVE_RAILS = {
  paystack: true,
  wallet: true,
  binance: true,
  minipay: true,
  /** Legacy — not active in the MVP. */
  flutterwave: false,
  /** NOWPayments / multi-chain deposit funding — not active in the MVP. */
  crypto: false,
} as const;

/** Manual rails: buyer pays out of band, admin/finance verifies. */
export type ManualRail = "minipay" | "binance";

export const MANUAL_RAILS: readonly ManualRail[] = ["minipay", "binance"];

export function isManualRail(value: string): value is ManualRail {
  return (MANUAL_RAILS as readonly string[]).includes(value);
}

/** Oventric's Binance account buyers send manual transfers to. */
export const BINANCE_USER_ID = "542612773";

/** Fallback MiniPay handle when the settings row has none. */
export const MINIPAY_HANDLE_FALLBACK = "oventric";

export const MANUAL_RAIL_LABEL: Record<ManualRail, string> = {
  minipay: "MiniPay",
  binance: "Binance Pay",
};

/** Message used wherever a retired rail is reached defensively. */
export const RAIL_DISABLED_MESSAGE =
  "This payment method is not available. Use card, bank transfer, your wallet, MiniPay or Binance.";
