/**
 * NOWPayments integration for crypto wallet funding.
 *
 * The provider issues a one-time deposit address per payment, watches the
 * chain itself, and calls our signed IPN webhook when the payment confirms.
 * We never custody keys and never poll the chain.
 */
import { createHmac, timingSafeEqual } from "crypto";

const API_BASE = "https://api.nowpayments.io/v1";

/** Chains we accept. Keys are the NOWPayments `pay_currency` codes. */
export const CRYPTO_PAY_CURRENCIES = {
  usdtbsc: { label: "USDT (BEP20)", network: "BNB Smart Chain (BEP20)" },
  usdcbsc: { label: "USDC (BEP20)", network: "BNB Smart Chain (BEP20)" },
  usdttrc20: { label: "USDT (TRC20)", network: "Tron (TRC20)" },
  usdterc20: { label: "USDT (ERC20)", network: "Ethereum (ERC20)" },
  trx: { label: "TRON (TRX)", network: "Tron" },
  ltc: { label: "Litecoin (LTC)", network: "Litecoin" },
  sol: { label: "Solana (SOL)", network: "Solana" },
  eth: { label: "Ethereum (ETH)", network: "Ethereum" },
  bnbbsc: { label: "BNB", network: "BNB Smart Chain" },
} as const;

export type CryptoPayCurrency = keyof typeof CRYPTO_PAY_CURRENCIES;

export function isCryptoPayCurrency(value: string): value is CryptoPayCurrency {
  return Object.prototype.hasOwnProperty.call(CRYPTO_PAY_CURRENCIES, value);
}

function apiKey(): string {
  const key = process.env["NOWPAYMENTS_API_KEY"];
  if (!key) throw new Error("Crypto funding is not configured yet.");
  return key;
}

export function ipnSecret(): string {
  const secret = process.env["NOWPAYMENTS_IPN_SECRET"];
  if (!secret) throw new Error("Crypto funding webhook is not configured yet.");
  return secret;
}

export interface CreatedCryptoPayment {
  paymentId: string;
  payAddress: string;
  payAmount: number;
  payCurrency: string;
  status: string;
}

export async function createCryptoPayment(args: {
  usdAmount: number;
  payCurrency: CryptoPayCurrency;
  orderId: string;
  description: string;
  callbackUrl: string;
}): Promise<CreatedCryptoPayment> {
  const res = await fetch(`${API_BASE}/payment`, {
    method: "POST",
    headers: { "x-api-key": apiKey(), "Content-Type": "application/json" },
    body: JSON.stringify({
      price_amount: Number(args.usdAmount.toFixed(2)),
      price_currency: "usd",
      pay_currency: args.payCurrency,
      order_id: args.orderId,
      order_description: args.description,
      ipn_callback_url: args.callbackUrl,
      is_fixed_rate: true,
    }),
  });

  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok || !body || !body["payment_id"]) {
    console.error("[crypto] create payment failed", res.status, body);
    const providerMessage = body && typeof body["message"] === "string" ? body["message"] : "";
    if (providerMessage.toLowerCase().includes("too small")) {
      throw new Error(
        "That amount is below the crypto payment minimum (about $12 at the moment). Raise the amount, or fund with bank transfer or card instead.",
      );
    }
    throw new Error("Could not start the crypto payment. Please try again.");
  }

  return {
    paymentId: String(body["payment_id"]),
    payAddress: String(body["pay_address"] ?? ""),
    payAmount: Number(body["pay_amount"] ?? 0),
    payCurrency: String(body["pay_currency"] ?? args.payCurrency),
    status: String(body["payment_status"] ?? "waiting"),
  };
}

export interface CryptoEstimate {
  payCurrency: CryptoPayCurrency;
  /** Estimated coin amount the buyer must send for the requested USD value. */
  payAmount: number | null;
  /** Provider minimum for this coin, in coin units. */
  minAmount: number | null;
  /** The same minimum expressed in USD, so the UI can state a usable figure. */
  minUsd: number | null;
  /** True when the requested amount is below the provider minimum. */
  belowMinimum: boolean;
}

/**
 * The provider's real minimum is the conversion floor between the coin the
 * buyer sends and the payout currency our merchant account settles into —
 * not the coin's own network dust limit. Querying `currency_to=<coin>` gave
 * a far smaller figure than the API actually accepts, which is why payments
 * were rejected with "amountTo is too small" well above the displayed floor.
 */
const PAYOUT_CURRENCY = process.env["NOWPAYMENTS_PAYOUT_CURRENCY"] || "usdttrc20";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** NOWPayments rate-limits bursts, so fetch one coin at a time with retries. */
async function fetchJsonWithRetry(url: string, key: string, attempts = 6): Promise<Record<string, unknown> | null> {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { headers: { "x-api-key": key } });
      if (res.status === 429) {
        await sleep(700 * (i + 1));
        continue;
      }
      if (!res.ok) return null;
      return (await res.json().catch(() => null)) as Record<string, unknown> | null;
    } catch {
      await sleep(400 * (i + 1));
    }
  }
  return null;
}

interface MinEntry {
  coin: number | null;
  usd: number | null;
}

/** Minimums change rarely — cache them briefly to halve the request count. */
const MIN_CACHE_TTL_MS = 10 * 60 * 1000;
let minAmountsCache: { at: number; values: Partial<Record<CryptoPayCurrency, MinEntry>> } | null = null;

async function getMinAmounts(
  key: string,
  codes: CryptoPayCurrency[],
): Promise<Partial<Record<CryptoPayCurrency, MinEntry>>> {
  if (minAmountsCache && Date.now() - minAmountsCache.at < MIN_CACHE_TTL_MS) return minAmountsCache.values;
  const values: Partial<Record<CryptoPayCurrency, MinEntry>> = {};
  for (const code of codes) {
    const min = await fetchJsonWithRetry(
      `${API_BASE}/min-amount?currency_from=${code}&currency_to=${PAYOUT_CURRENCY}&fiat_equivalent=usd`,
      key,
    );
    values[code] = {
      coin: min ? Number(min["min_amount"] ?? 0) || null : null,
      usd: min ? Number(min["fiat_equivalent"] ?? 0) || null : null,
    };
    await sleep(150);
  }
  minAmountsCache = { at: Date.now(), values };
  return values;
}

/** Live send-amount estimates for every supported coin, for a USD value. */
export async function estimateCryptoAmounts(usdAmount: number): Promise<CryptoEstimate[]> {
  const key = apiKey();
  const codes = Object.keys(CRYPTO_PAY_CURRENCIES) as CryptoPayCurrency[];
  const minAmounts = await getMinAmounts(key, codes);

  const results: CryptoEstimate[] = [];
  for (const code of codes) {
    const est = await fetchJsonWithRetry(
      `${API_BASE}/estimate?amount=${encodeURIComponent(usdAmount.toFixed(2))}&currency_from=usd&currency_to=${code}`,
      key,
    );
    const payAmount = est ? Number(est["estimated_amount"] ?? 0) || null : null;
    const minAmount = minAmounts[code]?.coin ?? null;
    const minUsd = minAmounts[code]?.usd ?? null;
    results.push({
      payCurrency: code,
      payAmount,
      minAmount,
      minUsd,
      belowMinimum: Boolean(payAmount && minAmount && payAmount < minAmount),
    });
    await sleep(150);
  }
  return results;
}

export async function fetchCryptoPayment(paymentId: string): Promise<Record<string, unknown> | null> {
  const res = await fetch(`${API_BASE}/payment/${encodeURIComponent(paymentId)}`, {
    headers: { "x-api-key": apiKey() },
  });
  if (!res.ok) return null;
  return (await res.json().catch(() => null)) as Record<string, unknown> | null;
}

/** NOWPayments signs the JSON body with keys sorted alphabetically (HMAC-SHA512). */
function sortedStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(sortedStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${sortedStringify(obj[k])}`).join(",")}}`;
  }
  return JSON.stringify(value === undefined ? null : value);
}

export function verifyIpnSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return false;
  }
  const expected = createHmac("sha512", ipnSecret()).update(sortedStringify(parsed)).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature.trim(), "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Map a NOWPayments payment_status onto our deposit status. */
export function mapProviderStatus(
  providerStatus: string,
): "awaiting_payment" | "confirming" | "credited" | "underpaid" | "expired" | "failed" {
  switch (providerStatus) {
    case "waiting":
      return "awaiting_payment";
    case "confirming":
    case "sending":
    case "confirmed":
      return "confirming";
    case "finished":
      return "credited";
    case "partially_paid":
      return "underpaid";
    case "expired":
      return "expired";
    case "failed":
    case "refunded":
      return "failed";
    default:
      return "awaiting_payment";
  }
}
