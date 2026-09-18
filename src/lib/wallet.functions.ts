import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { dbCurrency } from "@/lib/currency/africa";
import { zeroAmounts } from "@/lib/currency/africa";

/** Any currency in the pan-African registry. */
export type WalletCurrency = string;
export type WalletTxStatus = "success" | "pending" | "failed";
export type WalletTxType =
  | "Marketplace Purchase"
  | "Marketplace Sale"
  | "Gig Bounty Escrowed"
  | "Ad Injection Charge"
  | "Affiliate Cashback Payout"
  | "Wallet Top-Up"
  | "Payout Withdrawal"
  | "Cashback Earned"
  | "Wallet Transfer Sent"
  | "Wallet Transfer Received";

export interface WalletTxDTO {
  id: string;
  txHash: string;
  type: WalletTxType;
  amount: number;
  currency: WalletCurrency;
  inflow: boolean;
  status: WalletTxStatus;
  occurredAt: string;
}

export interface ListWalletTxInput {
  search?: string;
  currency?: "ALL" | WalletCurrency;
  type?: "ALL" | WalletTxType;
  status?: "ALL" | WalletTxStatus;
  from?: string | null;
  to?: string | null;
  page?: number;
  pageSize?: number;
}

export interface ListWalletTxResult {
  items: WalletTxDTO[];
  total: number;
  page: number;
  pageSize: number;
}

export const listWalletTransactions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ListWalletTxInput) => ({
    search: typeof input?.search === "string" ? input.search.trim() : "",
    currency: (input?.currency ?? "ALL") as "ALL" | WalletCurrency,
    type: (input?.type ?? "ALL") as "ALL" | WalletTxType,
    status: (input?.status ?? "ALL") as "ALL" | WalletTxStatus,
    from: typeof input?.from === "string" && input.from ? input.from : null,
    to: typeof input?.to === "string" && input.to ? input.to : null,
    page: Math.max(1, Number(input?.page ?? 1)),
    pageSize: Math.min(1000, Math.max(1, Number(input?.pageSize ?? 6))),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    let q = supabase
      .from("wallet_transactions")
      .select("id, tx_hash, type, amount, currency, inflow, status, occurred_at", { count: "exact" })
      .eq("user_id", userId)
      .order("occurred_at", { ascending: false });

    if (data.currency !== "ALL") q = q.eq("currency", dbCurrency(data.currency));
    if (data.type !== "ALL") q = q.eq("type", data.type);
    if (data.status !== "ALL") q = q.eq("status", data.status);
    if (data.from) q = q.gte("occurred_at", data.from);
    if (data.to) q = q.lte("occurred_at", data.to);
    if (data.search) {
      const s = data.search.replace(/[%,]/g, "");
      q = q.or(`tx_hash.ilike.%${s}%,type.ilike.%${s}%`);
    }

    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;
    const { data: rows, count, error } = await q.range(from, to);
    if (error) throw new Error(error.message);

    const items: WalletTxDTO[] = (rows ?? []).map((r) => ({
      id: r.id as string,
      txHash: r.tx_hash as string,
      type: r.type as WalletTxType,
      amount: Number(r.amount),
      currency: r.currency as WalletCurrency,
      inflow: r.inflow as boolean,
      status: r.status as WalletTxStatus,
      occurredAt: r.occurred_at as string,
    }));

    return {
      items,
      total: count ?? items.length,
      page: data.page,
      pageSize: data.pageSize,
    } satisfies ListWalletTxResult;
  });

export interface WalletBalancesDTO {
  balances: Record<WalletCurrency, number>;
  escrow: Record<WalletCurrency, number>;
  cashback: number;
  bountyBalance: number;
}

export const getWalletBalances = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WalletBalancesDTO> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("wallets")
      .select("currency, available_balance, escrow_balance, accumulated_cashback, bounty_balance")
      .eq("user_id", userId);
    if (error) throw new Error(error.message);

    const balances: Record<string, number> = zeroAmounts();
    const escrow: Record<string, number> = zeroAmounts();
    let cashback = 0;
    let bountyBalance = 0;
    for (const r of (data ?? []) as Array<Record<string, unknown>>) {
      const c = r.currency as WalletCurrency;
      if (c in balances) {
        balances[c] = Number(r.available_balance ?? 0);
        escrow[c] = Number(r.escrow_balance ?? 0);
        cashback += Number(r.accumulated_cashback ?? 0);
        if (c === "USD") bountyBalance = Number(r.bounty_balance ?? 0);
      }
    }
    return { balances, escrow, cashback, bountyBalance };
  });

export const transferBountyToMain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { amount: number }) => {
    const amount = Number(i?.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Invalid amount");
    return { amount: Math.round(amount * 100) / 100 };
  })
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { error } = await sb.rpc("bounty_wallet_transfer_to_main", { _amount: data.amount });
    if (error) throw new Error(error.message);
    return { ok: true, moved: data.amount };
  });


export interface WalletEarningsDTO {
  cashbackUSD: number;
  marketplaceHome: number;
  marketplaceCurrency: WalletCurrency;
  bountyUSD: number;
  affiliateUSD: number;
}

export const getWalletEarnings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WalletEarningsDTO> => {
    const { supabase, userId } = context;

    const [walletsRes, saleRes, bountyRes, affiliateRes] = await Promise.all([
      supabase.from("wallets").select("accumulated_cashback").eq("user_id", userId),
      supabase
        .from("wallet_transactions")
        .select("amount, currency")
        .eq("user_id", userId)
        .eq("type", "Marketplace Sale")
        .eq("inflow", true)
        .eq("status", "success"),
      supabase
        .from("wallet_transactions")
        .select("amount")
        .eq("user_id", userId)
        .eq("type", "Gig Bounty Escrowed")
        .eq("inflow", true)
        .eq("status", "success"),
      supabase
        .from("wallet_transactions")
        .select("amount")
        .eq("user_id", userId)
        .eq("type", "Affiliate Cashback Payout")
        .eq("inflow", true)
        .eq("status", "success"),
    ]);

    const cashbackUSD = ((walletsRes.data ?? []) as Array<{ accumulated_cashback: number }>)
      .reduce((s, r) => s + Number(r.accumulated_cashback ?? 0), 0);
    let country = "";
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("country")
        .eq("user_id", userId)
        .maybeSingle();
      country = String((profile as { country?: string | null } | null)?.country ?? "").toUpperCase();
    } catch {
      country = "";
    }
    const marketplaceCurrency: WalletCurrency = country === "NG" ? "NGN" : country === "GH" ? "GHS" : "USD";
    const marketplaceHome = ((saleRes.data ?? []) as Array<{ amount: number; currency: WalletCurrency }>)
      .reduce((s, r) => {
        const amount = Number(r.amount ?? 0);
        if (r.currency === marketplaceCurrency) return s + amount;
        const usd = r.currency === "USD" ? amount : amount / (r.currency === "NGN" ? 1500 : 14);
        return s + (marketplaceCurrency === "USD" ? usd : usd * (marketplaceCurrency === "NGN" ? 1500 : 14));
      }, 0);
    const bountyUSD = ((bountyRes.data ?? []) as Array<{ amount: number }>)
      .reduce((s, r) => s + Number(r.amount ?? 0), 0);
    const affiliateUSD = ((affiliateRes.data ?? []) as Array<{ amount: number }>)
      .reduce((s, r) => s + Number(r.amount ?? 0), 0);

    return { cashbackUSD, marketplaceHome, marketplaceCurrency, bountyUSD, affiliateUSD };
  });
