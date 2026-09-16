import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function serverPublicClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase server env missing");
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

export interface HomeStatsDTO {
  creators: number;
  products: number;
  customers: number;
  countries: number;
}

/**
 * Live, real platform counters for the public home page.
 * Nothing here is estimated or fabricated — every number is a row count.
 */
export const getHomeStats = createServerFn({ method: "GET" }).handler(
  async (): Promise<HomeStatsDTO> => {
    const sb = serverPublicClient();

    const [{ data: sellerRows }, { count: productCount }, { data: buyerRows }, { data: countryRows }] =
      await Promise.all([
        sb.from("products").select("seller_id").eq("status", "active"),
        sb.from("products").select("id", { count: "exact", head: true }).eq("status", "active"),
        sb.from("orders").select("buyer_id").eq("status", "paid"),
        sb.from("profiles").select("country"),
      ]);

    const creators = new Set((sellerRows ?? []).map((r: { seller_id: string }) => r.seller_id)).size;
    const customers = new Set((buyerRows ?? []).map((r: { buyer_id: string }) => r.buyer_id)).size;
    const countries = new Set(
      (countryRows ?? [])
        .map((r: { country: string | null }) => r.country)
        .filter((c): c is string => Boolean(c)),
    ).size;

    return {
      creators,
      products: productCount ?? 0,
      customers,
      countries,
    };
  },
);
