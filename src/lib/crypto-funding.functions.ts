/**
 * Crypto wallet funding (NOWPayments) — DISABLED in the Oventric MVP.
 *
 * The implementation is retained under `src/lib/crypto/*` for future
 * development, but every RPC entry point below fails closed so the rail is
 * unreachable even if an endpoint is called directly. No deposit address, QR,
 * estimate or wallet credit can be produced while `ACTIVE_RAILS.crypto` is
 * false.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ACTIVE_RAILS, RAIL_DISABLED_MESSAGE } from "@/lib/payments/active-rails";
import type { CryptoDepositDTO } from "@/lib/crypto/crypto-funding.server";

export type { CryptoDepositDTO };

export interface CryptoQuote {
  configured: boolean;
  usdAmount: number;
  rate: number;
  windowMinutes: number;
}

export interface CryptoEstimateDTO {
  payCurrency: string;
  payAmount: number | null;
  minAmount: number | null;
  minUsd: number | null;
  belowMinimum: boolean;
}

function disabled(): never {
  throw new Error(RAIL_DISABLED_MESSAGE);
}

export const quoteCryptoDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<CryptoQuote> => {
    if (!ACTIVE_RAILS.crypto) disabled();
    return { configured: false, usdAmount: 0, rate: 0, windowMinutes: 0 };
  });

export const estimateCryptoDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<{ usdAmount: number; estimates: CryptoEstimateDTO[] }> => {
    if (!ACTIVE_RAILS.crypto) disabled();
    return { usdAmount: 0, estimates: [] };
  });

export const createCryptoDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<CryptoDepositDTO> => disabled());

export const getCryptoDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<CryptoDepositDTO | null> => {
    if (!ACTIVE_RAILS.crypto) disabled();
    return null;
  });
