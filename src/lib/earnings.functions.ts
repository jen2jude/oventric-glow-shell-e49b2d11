import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { currencyForCountry, fallbackRateTable } from "@/lib/currency/africa";

/* -------------------------------------------------------------------------- */
/*  Earnings breakdown                                                         */
/* -------------------------------------------------------------------------- */

export type EarningsRange = "30d" | "90d" | "ytd" | "all";
export type EarningsSource = "marketplace" | "affiliate" | "other";

export interface EarningsSourceBreakdown {
  source: EarningsSource;
  label: string;
  amountHome: number;
  pct: number;
}

export interface EarningsBreakdownDTO {
  homeCurrency: string;
  totalHome: number;
  range: EarningsRange;
  breakdown: EarningsSourceBreakdown[];
}

const FX_FALLBACK: Record<string, number> = fallbackRateTable();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadUsdRates(sb: any): Promise<Record<string, number>> {
  try {
    const { data } = await sb.from("platform_settings").select("fx_rates").maybeSingle();
    const r = (data?.fx_rates ?? null) as Record<string, number> | null;
    if (!r) return FX_FALLBACK;
    const merged: Record<string, number> = { ...FX_FALLBACK, USD: 1 };
    for (const code of Object.keys(merged)) {
      const v = Number(r[code]);
      if (v > 0) merged[code] = v;
    }
    return merged;
  } catch {
    return FX_FALLBACK;
  }
}

function rangeSinceISO(range: EarningsRange): string | null {
  const now = new Date();
  if (range === "30d") return new Date(now.getTime() - 30 * 86400000).toISOString();
  if (range === "90d") return new Date(now.getTime() - 90 * 86400000).toISOString();
  if (range === "ytd") return new Date(now.getFullYear(), 0, 1).toISOString();
  return null;
}

const SOURCE_LABELS: Record<EarningsSource, string> = {
  marketplace: "Marketplace sales",
  affiliate: "Affiliate cashback",
  other: "Other",
};

export const getMyEarningsBreakdown = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { range?: EarningsRange }) => ({
    range: (["30d", "90d", "ytd", "all"] as const).includes(input?.range as never)
      ? (input!.range as EarningsRange)
      : "all",
  }))
  .handler(async ({ data, context }): Promise<EarningsBreakdownDTO> => {
    const { supabase, userId } = context;
    const since = rangeSinceISO(data.range);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: profile }, rates] = await Promise.all([
      supabaseAdmin.from("profiles").select("country").eq("user_id", userId).maybeSingle(),
      loadUsdRates(supabase),
    ]);
    const homeCurrency = currencyForCountry(
      (profile as { country?: string | null } | null)?.country ?? null,
    );
    const homeRate = rates[homeCurrency] ?? 1;

    const buildQuery = (type: Database["public"]["Enums"]["wallet_tx_type"]) => {
      let q = supabase
        .from("wallet_transactions")
        .select("amount, currency")
        .eq("user_id", userId)
        .eq("type", type)
        .eq("inflow", true)
        .eq("status", "success");
      if (since) q = q.gte("occurred_at", since);
      return q;
    };

    const [marketplaceRes, bountyRes, affiliateRes, cashbackRes] = await Promise.all([
      buildQuery("Marketplace Sale"),
      buildQuery("Bounty Payout"),
      buildQuery("Affiliate Cashback Payout"),
      buildQuery("Cashback Earned"),
    ]);

    const sumHome = (rows: Array<{ amount: number; currency: string }> | null | undefined) =>
      (rows ?? []).reduce((s, r) => {
        const amount = Number(r.amount ?? 0);
        const rowRate = rates[r.currency] ?? 1;
        const usd = amount / (rowRate || 1);
        return s + usd * homeRate;
      }, 0);

    const marketplaceHome = sumHome(marketplaceRes.data as never);
    const bountyHome = sumHome(bountyRes.data as never);
    const affiliateHome = sumHome(affiliateRes.data as never);
    const otherHome = sumHome(cashbackRes.data as never);
    // No dedicated seller-side ledger entry exists yet for course/academy
    // sales (instructor payouts are credited via RPC only), so this bucket
    // is included for completeness and will populate once that ledger entry
    // ships.
    const academyHome = 0;

    const totalHome = marketplaceHome + bountyHome + academyHome + affiliateHome + otherHome;
    const pct = (v: number) => (totalHome > 0 ? Math.round((v / totalHome) * 1000) / 10 : 0);

    const breakdown: EarningsSourceBreakdown[] = [
      { source: "marketplace", label: SOURCE_LABELS.marketplace, amountHome: marketplaceHome, pct: pct(marketplaceHome) },
      { source: "bounty", label: SOURCE_LABELS.bounty, amountHome: bountyHome, pct: pct(bountyHome) },
      { source: "academy", label: SOURCE_LABELS.academy, amountHome: academyHome, pct: pct(academyHome) },
      { source: "affiliate", label: SOURCE_LABELS.affiliate, amountHome: affiliateHome, pct: pct(affiliateHome) },
      { source: "other", label: SOURCE_LABELS.other, amountHome: otherHome, pct: pct(otherHome) },
    ];

    return {
      homeCurrency,
      totalHome: Number(totalHome.toFixed(homeCurrency === "USD" ? 2 : 0)),
      range: data.range,
      breakdown: breakdown.map((b) => ({
        ...b,
        amountHome: Number(b.amountHome.toFixed(homeCurrency === "USD" ? 2 : 0)),
      })),
    };
  });

/* -------------------------------------------------------------------------- */
/*  Payout timeline                                                            */
/* -------------------------------------------------------------------------- */

export type PayoutTimelineStatus = "ALL" | "pending" | "paid" | "failed";

export interface PayoutTimelineItem {
  id: string;
  amount: number;
  currency: string;
  method: string;
  status: string;
  createdAt: string;
  processedAt: string | null;
}

export const getMyPayoutTimeline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { status?: PayoutTimelineStatus }) => ({
    status: (["ALL", "pending", "paid", "failed"] as const).includes(input?.status as never)
      ? (input!.status as PayoutTimelineStatus)
      : "ALL",
  }))
  .handler(async ({ data, context }): Promise<PayoutTimelineItem[]> => {
    const { supabase, userId } = context;
    let q = supabase
      .from("payout_requests")
      .select("id, amount, currency, method, status, created_at, processed_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);
    // "failed" maps to the "rejected" payout_requests status for the timeline UI.
    if (data.status === "pending") q = q.eq("status", "pending");
    else if (data.status === "paid") q = q.eq("status", "paid");
    else if (data.status === "failed") q = q.eq("status", "rejected");

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    return ((rows ?? []) as Array<Record<string, unknown>>).map((r) => ({
      id: r.id as string,
      amount: Number(r.amount ?? 0),
      currency: r.currency as string,
      method: r.method as string,
      status: r.status as string,
      createdAt: r.created_at as string,
      processedAt: (r.processed_at as string | null) ?? null,
    }));
  });
