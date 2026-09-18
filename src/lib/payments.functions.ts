/**
 * Unified payment surface used by the app.
 *
 * Thin wrappers only — all logic lives in:
 *   src/lib/payments/providers.ts     (routing rules, client-safe)
 *   src/lib/payments/intent.server.ts (authoritative pricing)
 *   src/lib/payments/gateway.server.ts(charge creation + verification)
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildPaymentIntent, resolveUserEmail, inferOrigin, type PaymentIntentInput } from "@/lib/payments/intent.server";
import { createCharge, loadGatewaySettings, verifyAndSettle } from "@/lib/payments/gateway.server";
import { minipayAvailable, routeGateway } from "@/lib/payments/providers";

export type InitPaymentInput = PaymentIntentInput & {
  channel?: "card" | "bank_transfer" | "mobile_money" | "ussd";
  /** MVP lock: Paystack is the only automated gateway. */
  provider?: "paystack";
};

export interface InitPaymentResult {
  authorizationUrl: string;
  reference: string;
  provider: "paystack";
  chargeAmount: number;
  chargeCurrency: string;
}

export const initPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: InitPaymentInput) => input)
  .handler(async ({ data, context }): Promise<InitPaymentResult> => {
    const settings = await loadGatewaySettings();
    const email = await resolveUserEmail(context.supabase, context.userId, context.claims as { email?: string });
    const intent = await buildPaymentIntent(context.supabase, context.userId, data);
    const charge = await createCharge({
      userId: context.userId,
      email,
      origin: inferOrigin(),
      intent,
      input: data,
      settings,
      channel: data.channel,
      preferProvider: data.provider,
    });
    // MVP lock: createCharge can only ever return the active Paystack rail.
    return { ...charge, provider: "paystack" as const };
  });

export const verifyPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { reference: string }) => ({ reference: String(input?.reference ?? "").trim() }))
  .handler(async ({ data, context }) => {
    if (!data.reference) throw new Error("Missing reference");
    // Settlement itself is idempotent and provider-authoritative, so a repeat
    // call never moves money twice. Order/wallet details are only handed back
    // to the person the provider says paid.
    const result = await verifyAndSettle(data.reference);
    if (result.payerId && result.payerId !== context.userId) {
      return {
        ok: result.ok,
        status: result.status,
        redirectTo: null,
        cashbackEarnedUSD: 0,
        displayCurrency: result.displayCurrency,
      };
    }
    const { payerId: _payerId, ...safe } = result;
    return safe;
  });

export interface PaymentOptionsResult {
  provider: "paystack";
  chargeCurrency: string;
  crossBorder: boolean;
  minipay: {
    available: boolean;
    handle: string | null;
    accountName: string | null;
    instructions: string | null;
  };
}

/** What the checkout UI should offer for a given purpose + currency. */
export const getPaymentOptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { currency: string; purpose: "order" | "course" | "bounty" | "wallet_topup" }) => ({
    currency: String(input?.currency ?? "USD").toUpperCase(),
    purpose: (input?.purpose ?? "order") as "order" | "course" | "bounty" | "wallet_topup",
  }))
  .handler(async ({ data }): Promise<PaymentOptionsResult> => {
    const settings = await loadGatewaySettings();
    const route = routeGateway(data.currency, settings);
    const mp = minipayAvailable(data.purpose, data.currency, settings);
    return {
      provider: "paystack" as const,
      chargeCurrency: route.chargeCurrency,
      crossBorder: route.crossBorder,
      minipay: {
        available: mp,
        handle: mp ? settings.minipayHandle : null,
        accountName: mp ? settings.minipayAccountName : null,
        instructions: mp ? settings.minipayInstructions : null,
      },
    };
  });
