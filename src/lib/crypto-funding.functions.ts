import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Currency } from "@/lib/onboarding/OnboardingContext";
import type { CryptoDepositDTO } from "@/lib/crypto/crypto-funding.server";

export type { CryptoDepositDTO };

export interface CryptoQuote {
  configured: boolean;
  usdAmount: number;
  rate: number;
  windowMinutes: number;
}

/** Server-side USD quote for a funding amount. Never trust a browser figure. */
export const quoteCryptoDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { amount: number; currency: Currency }) => ({
    amount: Number(input?.amount ?? 0),
    currency: (input?.currency ?? "USD") as Currency,
  }))
  .handler(async ({ data }): Promise<CryptoQuote> => {
    const { quoteUsd, DEPOSIT_WINDOW_MINUTES, cryptoFundingConfigured } = await import(
      "@/lib/crypto/crypto-funding.server"
    );
    const { usdAmount, rate } = await quoteUsd(Math.max(0, data.amount), data.currency);
    return {
      configured: cryptoFundingConfigured(),
      usdAmount,
      rate,
      windowMinutes: DEPOSIT_WINDOW_MINUTES,
    };
  });

export const createCryptoDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { amount: number; currency: Currency; payCurrency: string }) => ({
    amount: Number(input?.amount ?? 0),
    currency: (input?.currency ?? "USD") as Currency,
    payCurrency: String(input?.payCurrency ?? "usdttrc20"),
  }))
  .handler(async ({ data, context }): Promise<CryptoDepositDTO> => {
    if (!Number.isFinite(data.amount) || data.amount <= 0) throw new Error("Enter a valid amount.");
    const { isCryptoPayCurrency } = await import("@/lib/crypto/nowpayments.server");
    if (!isCryptoPayCurrency(data.payCurrency)) throw new Error("Unsupported crypto network.");
    const { startCryptoDeposit } = await import("@/lib/crypto/crypto-funding.server");
    const { inferOrigin } = await import("@/lib/payments/intent.server");
    return startCryptoDeposit({
      userId: context.userId,
      amount: data.amount,
      currency: data.currency,
      payCurrency: data.payCurrency,
      origin: inferOrigin(),
    });
  });

export const getCryptoDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => ({ id: String(input?.id ?? "") }))
  .handler(async ({ data, context }): Promise<CryptoDepositDTO | null> => {
    if (!data.id) return null;
    const { readCryptoDeposit } = await import("@/lib/crypto/crypto-funding.server");
    return readCryptoDeposit(context.userId, data.id);
  });
