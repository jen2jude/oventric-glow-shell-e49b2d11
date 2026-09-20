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

/** Oventric's Bybit account buyers send manual transfers to. */
export const BYBIT_USER_ID = "578845976";

/**
 * Manual crypto destinations shown at checkout. They all settle through the
 * existing manual (proof-of-payment) rail — no new settlement mechanism.
 */
export interface ManualDestination {
  key: string;
  label: string;
  /** What the buyer copies: exchange user ID, on-chain wallet address or account number. */
  address: string;
  /** Row label for the copyable value. */
  addressLabel: string;
  network?: string;
  /** Extra copyable rows for bank/wire details (bank name, routing, holder, etc.). */
  extraRows?: Array<{ label: string; value: string }>;
}

/** Oventric's Grey USD virtual account buyers send manual transfers to. */
export const VIRTUAL_BANK_DESTINATIONS: Record<string, ManualDestination> = {
  "grey-usd": {
    key: "grey-usd",
    label: "Grey USD",
    address: "210478102841",
    addressLabel: "Account number",
    extraRows: [
      { label: "Bank name", value: "Lead" },
      { label: "Routing number", value: "101019644" },
      { label: "Account holder", value: "Jude Ifeanyi Chukwuaboh" },
    ],
  },
};

export const CRYPTO_DESTINATIONS: Record<string, ManualDestination> = {
  binance: {
    key: "binance",
    label: "Binance Pay",
    address: BINANCE_USER_ID,
    addressLabel: "Binance User ID",
  },
  bybit: {
    key: "bybit",
    label: "Bybit Pay",
    address: BYBIT_USER_ID,
    addressLabel: "Bybit User ID",
  },
  "usdt-trc20": {
    key: "usdt-trc20",
    label: "USDT (TRC20)",
    address: "TVecd8nE4eUPPTbtXjzPS2Mcrz7eqa2WBZ",
    addressLabel: "USDT TRC20 wallet address",
    network: "TRON (TRC20)",
  },
  "usdt-bep20": {
    key: "usdt-bep20",
    label: "USDT (BEP20)",
    address: "0xA20104107AC03DeAbDf219a484b0f1db2De428Cd",
    addressLabel: "USDT BEP20 wallet address",
    network: "BNB Smart Chain (BEP20)",
  },
  "usdc-bep20": {
    key: "usdc-bep20",
    label: "USDC (BEP20)",
    address: "0x6E0981DB0FC0679bDa1459162ae7316A1F2C271B",
    addressLabel: "USDC BEP20 wallet address",
    network: "BNB Smart Chain (BEP20)",
  },
  "usdc-solana": {
    key: "usdc-solana",
    label: "USDC (Solana)",
    address: "CrGztHnYi4S7xB7vJKUspq9tRURk6Yic2qP7eDc7XMYr",
    addressLabel: "USDC Solana wallet address",
    network: "Solana (SPL)",
  },
};

/** Fallback MiniPay handle when the settings row has none. */
export const MINIPAY_HANDLE_FALLBACK = "oventric";

export const MANUAL_RAIL_LABEL: Record<ManualRail, string> = {
  minipay: "MiniPay",
  binance: "Binance Pay",
};

/** Message used wherever a retired rail is reached defensively. */
export const RAIL_DISABLED_MESSAGE =
  "This payment method is not available. Use card, bank transfer, your wallet, MiniPay or Binance.";
