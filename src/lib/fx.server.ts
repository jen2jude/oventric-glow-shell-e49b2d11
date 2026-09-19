import { createClient } from "@supabase/supabase-js";
import { setRuntimeFxRates } from "@/lib/fx-display";
import type { Database } from "@/integrations/supabase/types";
import { CURRENCY_CODES, fallbackRateTable } from "@/lib/currency/africa";

export type FxRates = Record<string, number>;

export interface FxSnapshotResult {
  base: "USD";
  rates: FxRates;
  source: "live" | "admin" | "fallback";
  fetched_at: string;
}

/** Last-resort rates if every provider and the admin table are unreachable. */
const HARD_FALLBACK: FxRates = fallbackRateTable();

/** Keep only the currencies we support, filling gaps from the fallback table. */
function normalizeRates(raw: Record<string, unknown>, lowercase = false): FxRates | null {
  const out: FxRates = { USD: 1 };
  let hits = 0;
  for (const code of CURRENCY_CODES) {
    if (code === "USD") continue;
    const v = Number(raw[lowercase ? code.toLowerCase() : code]);
    if (v > 0) {
      out[code] = v;
      hits += 1;
    } else {
      out[code] = HARD_FALLBACK[code] ?? 1;
    }
  }
  // Require the two core markets plus a reasonable spread before trusting it.
  if (!(Number(out.NGN) > 0 && Number(out.GHS) > 0) || hits < 10) return null;
  return out;
}

/** Server-side memory cache so we don't hit the FX provider on every publish/view. */
const CACHE_TTL_MS = 15 * 60 * 1000;
let cache: { at: number; value: FxSnapshotResult } | null = null;

async function getJson(url: string, ms = 4500): Promise<unknown | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function build(rates: FxRates | null): FxSnapshotResult | null {
  if (!rates) return null;
  return {
    base: "USD",
    rates,
    source: "live",
    fetched_at: new Date().toISOString(),
  };
}

/** Try several key-less providers in order until one returns sane USD-base rates. */
async function fetchLiveRates(): Promise<FxSnapshotResult | null> {
  const a = (await getJson("https://open.er-api.com/v6/latest/USD")) as
    | { result?: string; rates?: Record<string, number> }
    | null;
  if (a?.rates) {
    const built = build(normalizeRates(a.rates));
    if (built) return built;
  }

  const b = (await getJson(
    "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json",
  )) as { usd?: Record<string, number> } | null;
  if (b?.usd) {
    const built = build(normalizeRates(b.usd, true));
    if (built) return built;
  }

  return null;
}

async function fetchAdminRates(): Promise<FxSnapshotResult> {
  const fetched_at = new Date().toISOString();
  try {
    // platform_settings is admin-only; read it with the service role.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabaseAdmin as any).from("platform_settings").select("fx_rates").maybeSingle();
    const rates = (data?.fx_rates ?? null) as Record<string, number> | null;
    if (!rates) return { base: "USD", rates: HARD_FALLBACK, source: "fallback", fetched_at };
    const merged: FxRates = { ...HARD_FALLBACK, USD: 1 };
    for (const code of CURRENCY_CODES) {
      const v = Number(rates[code]);
      if (v > 0) merged[code] = v;
    }
    return { base: "USD", rates: merged, source: "admin", fetched_at };
  } catch {
    return { base: "USD", rates: HARD_FALLBACK, source: "fallback", fetched_at };
  }
}

/** Current USD-base rates, cached in memory for 15 minutes. */
export async function resolveFxRates(): Promise<FxSnapshotResult> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.value;
  const live = await fetchLiveRates();
  const value = live ?? (await fetchAdminRates());
  // Only cache successful live pulls for the full TTL; retry fallbacks sooner.
  cache = { at: value.source === "live" ? Date.now() : Date.now() - CACHE_TTL_MS + 60_000, value };
  return value;
}

/**
 * Load current rates and publish them to the shared display layer so
 * server-side charge amounts match what the buyer saw in the UI.
 */
export async function primeRuntimeFxRates(): Promise<FxSnapshotResult> {
  const r = await resolveFxRates();
  setRuntimeFxRates(r.rates);
  return r;
}
