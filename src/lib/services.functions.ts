import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface ServiceInput {
  title: string;
  description: string;
  category?: string | null;
  startingPriceUSD: number;
  originalCurrency?: string;
  originalAmount?: number;
  fxSnapshot?: {
    base: string;
    rates: Record<string, number>;
    source?: string;
    fetched_at?: string;
  } | null;
  coverPath?: string | null;
  deliveryDays?: number | null;
}

/**
 * Authenticated member publishes a service offering. Services are stored as
 * products with kind = 'service' so they reuse orders, reviews and payouts.
 * They enter the same moderation queue as other seller listings.
 */
export const createServiceListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ServiceInput) => ({
    title: String(input.title ?? "").trim(),
    description: String(input.description ?? "").trim(),
    category: input.category ? String(input.category).trim() : "services",
    startingPriceUSD: Math.max(0, Number(input.startingPriceUSD ?? 0)),
    originalCurrency: String(input.originalCurrency ?? "USD"),
    originalAmount: Math.max(0, Number(input.originalAmount ?? input.startingPriceUSD ?? 0)),
    fxSnapshot: input.fxSnapshot ?? null,
    coverPath: input.coverPath ? String(input.coverPath) : null,
    deliveryDays: input.deliveryDays ? Math.max(1, Number(input.deliveryDays)) : null,
  }))
  .handler(async ({ data, context }) => {
    if (data.title.length < 3) throw new Error("Give your service a clear title");
    if (data.description.length < 20)
      throw new Error("Describe the service in at least 20 characters");
    if (!(data.startingPriceUSD > 0)) throw new Error("Set a starting price");

    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    const { data: prof } = await context.supabase
      .from("profiles")
      .select("display_name, username, shop_name")
      .eq("user_id", context.userId)
      .maybeSingle();
    const vendor =
      ((prof?.shop_name as string) || (prof?.display_name as string) || (prof?.username as string) || "Member").trim() || "Member";

    const description = data.deliveryDays
      ? `${data.description}\n\nTypical delivery: ${data.deliveryDays} day${data.deliveryDays === 1 ? "" : "s"}.`
      : data.description;

    const { data: row, error } = await context.supabase
      .from("products")
      .insert({
        seller_id: context.userId,
        name: data.title,
        category: data.category,
        description,
        price_usd: data.startingPriceUSD,
        original_currency: data.originalCurrency,
        original_amount: data.originalAmount,
        fx_snapshot: data.fxSnapshot ? JSON.parse(JSON.stringify(data.fxSnapshot)) : null,
        vendor,
        hue: "from-rose-500 to-red-700",
        cover_path: data.coverPath,
        image_paths: data.coverPath ? [data.coverPath] : [],
        requires_manual_delivery: true,
        promoted: false,
        kind: "service",
        status: isAdmin ? "active" : "pending",
      })
      .select("id, status")
      .single();

    if (error) throw new Error(error.message);
    return { id: row.id as string, status: row.status as string };
  });

/* ------------------------------------------------------------------ *
 * Service packages (Basic / Standard / Pro) + buyer intake brief
 * ------------------------------------------------------------------ */

export type ServiceTier = "basic" | "standard" | "pro";

export interface ServicePackage {
  id: string;
  productId: string;
  tier: ServiceTier;
  name: string;
  summary: string;
  features: string[];
  priceUsd: number;
  originalCurrency: string;
  originalAmount: number;
  deliveryDays: number | null;
  revisions: number | null;
}

export interface ServiceBrief {
  goal: string;
  timeline: string;
  audience: string;
  references: string;
}

const TIER_ORDER: ServiceTier[] = ["basic", "standard", "pro"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPackage(r: any): ServicePackage {
  return {
    id: String(r.id),
    productId: String(r.product_id),
    tier: String(r.tier) as ServiceTier,
    name: String(r.name ?? ""),
    summary: String(r.summary ?? ""),
    features: Array.isArray(r.features) ? (r.features as string[]) : [],
    priceUsd: Number(r.price_usd ?? 0),
    originalCurrency: String(r.original_currency ?? "USD"),
    originalAmount: Number(r.original_amount ?? 0),
    deliveryDays: r.delivery_days == null ? null : Number(r.delivery_days),
    revisions: r.revisions == null ? null : Number(r.revisions),
  };
}

/** Public read of the tiers attached to a service listing. */
export const getServicePackages = createServerFn({ method: "GET" })
  .inputValidator((input: { productId: string }) => ({
    productId: String(input?.productId ?? "").trim(),
  }))
  .handler(async ({ data }): Promise<ServicePackage[]> => {
    if (!data.productId) return [];
    const { createEcosystemClient } = await import("./ecosystem/public-client.server");
    const supabase = await createEcosystemClient();
    const { data: rows } = await supabase
      .from("service_packages")
      .select("*")
      .eq("product_id", data.productId)
      .order("sort_order", { ascending: true });
    return (rows ?? [])
      .map(mapPackage)
      .sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier));
  });

export interface PackageInput {
  tier: ServiceTier;
  name: string;
  summary?: string;
  features?: string[];
  priceLocal: number;
  currency: string;
  priceUsd: number;
  deliveryDays?: number | null;
  revisions?: number | null;
}

/**
 * Owner replaces the full tier set for one of their service listings.
 * Replace-all keeps the editor simple and avoids orphaned tiers.
 */
export const saveServicePackages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { productId: string; packages: PackageInput[] }) => ({
    productId: String(input?.productId ?? "").trim(),
    packages: (Array.isArray(input?.packages) ? input.packages : []).slice(0, 3).map((p) => ({
      tier: (["basic", "standard", "pro"].includes(String(p.tier))
        ? p.tier
        : "basic") as ServiceTier,
      name: String(p.name ?? "").trim().slice(0, 60),
      summary: String(p.summary ?? "").trim().slice(0, 400),
      features: (Array.isArray(p.features) ? p.features : [])
        .map((f) => String(f).trim().slice(0, 120))
        .filter(Boolean)
        .slice(0, 10),
      priceLocal: Math.max(0, Number(p.priceLocal ?? 0)),
      currency: String(p.currency ?? "USD").toUpperCase().slice(0, 5),
      priceUsd: Math.max(0, Number(p.priceUsd ?? 0)),
      deliveryDays: p.deliveryDays ? Math.max(1, Number(p.deliveryDays)) : null,
      revisions: p.revisions == null ? null : Math.max(0, Number(p.revisions)),
    })),
  }))
  .handler(async ({ data, context }) => {
    if (!data.productId) throw new Error("Missing service");
    const valid = data.packages.filter((p) => p.name.length >= 2 && p.priceUsd > 0);
    if (valid.length === 0) throw new Error("Add at least one package with a name and price");

    const { data: owned } = await context.supabase
      .from("products")
      .select("id")
      .eq("id", data.productId)
      .eq("seller_id", context.userId)
      .maybeSingle();
    if (!owned) throw new Error("You can only edit your own service");

    const { error: delErr } = await context.supabase
      .from("service_packages")
      .delete()
      .eq("product_id", data.productId);
    if (delErr) throw new Error(delErr.message);

    const { error } = await context.supabase.from("service_packages").insert(
      valid.map((p) => ({
        product_id: data.productId,
        tier: p.tier,
        name: p.name,
        summary: p.summary,
        features: p.features,
        price_usd: p.priceUsd,
        original_currency: p.currency,
        original_amount: p.priceLocal,
        delivery_days: p.deliveryDays,
        revisions: p.revisions,
        sort_order: TIER_ORDER.indexOf(p.tier),
      })),
    );
    if (error) throw new Error(error.message);

    // Keep the listing's "starting from" price in sync with the cheapest tier.
    const cheapest = valid.reduce((a, b) => (b.priceUsd < a.priceUsd ? b : a));
    await context.supabase
      .from("products")
      .update({
        price_usd: cheapest.priceUsd,
        original_currency: cheapest.currency,
        original_amount: cheapest.priceLocal,
      })
      .eq("id", data.productId);

    return { ok: true, count: valid.length };
  });
