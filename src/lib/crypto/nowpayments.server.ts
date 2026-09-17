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
        "That amount is below this coin's network minimum. Pick a low-minimum coin such as USDT (BEP20), TRX, LTC or SOL, or raise the amount.",
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
  /** Provider/network minimum for this coin, in coin units. */
  minAmount: number | null;
  /** True when the requested amount is below the network minimum. */
  belowMinimum: boolean;
}

/** Live send-amount estimates for every supported coin, for a USD value. */
export async function estimateCryptoAmounts(usdAmount: number): Promise<CryptoEstimate[]> {
  const key = apiKey();
  const codes = Object.keys(CRYPTO_PAY_CURRENCIES) as CryptoPayCurrency[];

  const results = await Promise.all(
    codes.map(async (code): Promise<CryptoEstimate> => {
      try {
        const [estRes, minRes] = await Promise.all([
          fetch(
            `${API_BASE}/estimate?amount=${encodeURIComponent(usdAmount.toFixed(2))}&currency_from=usd&currency_to=${code}`,
            { headers: { "x-api-key": key } },
          ),
          fetch(`${API_BASE}/min-amount?currency_from=${code}&currency_to=${code}&fiat_equivalent=usd`, {
            headers: { "x-api-key": key },
          }),
        ]);

        const est = (await estRes.json().catch(() => null)) as Record<string, unknown> | null;
        const min = (await minRes.json().catch(() => null)) as Record<string, unknown> | null;

        const payAmount = est && estRes.ok ? Number(est["estimated_amount"] ?? 0) || null : null;
        const minAmount = min && minRes.ok ? Number(min["min_amount"] ?? 0) || null : null;

        return {
          payCurrency: code,
          payAmount,
          minAmount,
          belowMinimum: Boolean(payAmount && minAmount && payAmount < minAmount),
        };
      } catch {
        return { payCurrency: code, payAmount: null, minAmount: null, belowMinimum: false };
      }
    }),
  );

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
