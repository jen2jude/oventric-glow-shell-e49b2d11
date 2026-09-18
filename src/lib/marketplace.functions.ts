import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { dbCurrency } from "@/lib/currency/africa";
import { fallbackRateTable } from "@/lib/currency/africa";

export type ProductCategory = string;
/** Oventric is digital-only; physical goods are no longer supported. */
export type ProductKind = "digital" | "service";
export type ProductStatus = "pending" | "active" | "rejected";
/** Any currency in the pan-African registry (see @/lib/currency/africa). */
export type OrderCurrency = string;
export type PaymentMethod = "wallet" | "card" | "bank_transfer" | "mobile_money";
export type OrderStatus = "pending" | "paid" | "failed" | "refunded";

export interface ProductDTO {
  id: string;
  slug: string | null;
  sellerId: string;
  sellerSlug: string | null;
  name: string;
  category: ProductCategory;
  subcategory: string | null;
  description: string;
  priceUSD: number;
  originalCurrency: OrderCurrency;
  originalAmount: number;
  fxSnapshot: { base: string; rates: Record<string, number>; source?: string; fetched_at?: string } | null;
  hue: string;
  vendor: string;
  rating: number;
  reviews: number;
  promoted: boolean;
  externalUrl: string | null;
  filePath: string | null;
  coverPath: string | null;
  coverUrl: string | null;
  createdAt: string;
  // Kind + moderation
  kind: ProductKind;
  status: ProductStatus;
  rejectReason: string | null;
  // Legacy listing attributes (retained for historical rows only)
  condition: string | null;
  brand: string | null;
  location: string | null;
  negotiable: string | null;
  delivery: string | null;
  sellerPhone: string | null;
  whatsappNumber: string | null;
  socialLink: string | null;
  imagePaths: string[];
  imageUrls: string[];
  requiresManualDelivery: boolean;
  inStock: boolean;
  /** Seller-funded cashback percentage (0–50), display only. */
  cashbackPct: number;
  salesCount?: number;
  basicInfo: string | null;
  activationGuide: string | null;
}


export interface OrderDTO {
  id: string;
  productId: string;
  productName: string;
  category: ProductCategory;
  vendor: string;
  hue: string;
  quantity: number;
  unitPriceUSD: number;
  totalUSD: number;
  displayCurrency: OrderCurrency;
  displayTotal: number;
  paymentMethod: PaymentMethod;
  status: OrderStatus;
  downloadToken: string;
  createdAt: string;
  paidAt: string | null;
  externalUrl: string | null;
  filePath: string | null;
  deliveryEmail: string | null;
  deliveryWhatsapp: string | null;
  requiresManualDelivery: boolean;
  servicePackage: { name: string; tier: string; features: string[]; deliveryDays: number | null; revisions: number | null } | null;
  serviceBrief: Record<string, string> | null;
}

export const FX_FROM_USD: Record<OrderCurrency, number> = fallbackRateTable();

function serverPublicClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase server env missing");
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

function mapProduct(
  r: Record<string, unknown>,
  coverUrl: string | null = null,
  imageUrls: string[] = [],
  sellerSlug: string | null = null,
): ProductDTO {
  const originalCurrency = ((r.original_currency as string) ?? "USD") as OrderCurrency;
  const originalAmount = Number(r.original_amount ?? r.price_usd ?? 0);
  const snap = r.fx_snapshot as ProductDTO["fxSnapshot"] | null | undefined;
  return {
    id: r.id as string,
    slug: (r.slug as string) ?? null,
    sellerId: r.seller_id as string,
    sellerSlug,
    name: r.name as string,
    category: r.category as ProductCategory,
    subcategory: (r.subcategory as string) ?? null,
    description: (r.description as string) ?? "",
    priceUSD: Number(r.price_usd),
    originalCurrency,
    originalAmount,
    fxSnapshot: snap ?? null,
    hue: (r.hue as string) ?? "from-emerald-500 to-teal-700",
    vendor: r.vendor as string,
    rating: Number(r.rating),
    reviews: Number(r.reviews),
    promoted: Boolean(r.promoted),
    externalUrl: (r.external_url as string) ?? null,
    filePath: (r.file_path as string) ?? null,
    coverPath: (r.cover_path as string) ?? null,
    coverUrl,
    createdAt: r.created_at as string,
    kind: ((r.kind as string) ?? "digital") as ProductKind,
    status: ((r.status as string) ?? "active") as ProductStatus,
    rejectReason: (r.reject_reason as string) ?? null,
    condition: (r.condition as string) ?? null,
    brand: (r.brand as string) ?? null,
    location: (r.location as string) ?? null,
    negotiable: (r.negotiable as string) ?? null,
    delivery: (r.delivery as string) ?? null,
    sellerPhone: (r.seller_phone as string) ?? null,
    whatsappNumber: (r.whatsapp_number as string) ?? null,
    socialLink: (r.social_link as string) ?? null,
    imagePaths: Array.isArray(r.image_paths) ? (r.image_paths as string[]) : [],
    imageUrls,
    requiresManualDelivery: Boolean(r.requires_manual_delivery),
    inStock: r.in_stock === false ? false : true,
    // Seller-funded cashback rate (Stage 3). Display only — settlement always
    // recomputes this from the product row on the server.
    cashbackPct: Math.max(0, Math.min(50, Number(r.cashback_pct ?? 0))),
    basicInfo: (r.basic_info as string) ?? null,
    activationGuide: (r.activation_guide as string) ?? null,
  };
}

async function signCovers(
  sb: ReturnType<typeof serverPublicClient>,
  paths: (string | null)[],
): Promise<(string | null)[]> {
  const unique = Array.from(new Set(paths.filter((p): p is string => !!p)));
  if (unique.length === 0) return paths.map(() => null);
  const { data } = await sb.storage.from("product-covers").createSignedUrls(unique, 60 * 60 * 24 * 7);
  const map = new Map<string, string>();
  (data ?? []).forEach((r) => { if (r.path && r.signedUrl) map.set(r.path, r.signedUrl); });
  return paths.map((p) => (p ? map.get(p) ?? null : null));
}

/** Sign paths from any bucket; passes through absolute URLs and falls back to public URLs. */
async function signBucket(
  sb: ReturnType<typeof serverPublicClient>,
  bucket: string,
  paths: (string | null)[],
): Promise<(string | null)[]> {
  const unique = Array.from(new Set(paths.filter((p): p is string => !!p && !/^https?:\/\//i.test(p))));
  const map = new Map<string, string>();
  if (unique.length > 0) {
    const { data } = await sb.storage.from(bucket).createSignedUrls(unique, 60 * 60 * 24 * 7);
    (data ?? []).forEach((r) => { if (r.path && r.signedUrl) map.set(r.path, r.signedUrl); });
    for (const p of unique) {
      if (!map.has(p)) {
        const pub = sb.storage.from(bucket).getPublicUrl(p).data.publicUrl;
        if (pub) map.set(p, pub);
      }
    }
  }
  return paths.map((p) => (!p ? null : /^https?:\/\//i.test(p) ? p : map.get(p) ?? null));
}

// Sensitive contact columns (seller_phone, whatsapp_number, social_link) are excluded here;
// anon has no column-level grant on them. Owner/admin flows fetch them via dedicated RPCs
// or the authenticated context.supabase client (see PRODUCT_COLS_OWNER).
const PRODUCT_COLS = "id, slug, seller_id, name, category, subcategory, description, price_usd, original_currency, original_amount, fx_snapshot, hue, vendor, rating, reviews, promoted, external_url, file_path, cover_path, created_at, kind, status, reject_reason, condition, brand, location, negotiable, delivery, image_paths, requires_manual_delivery, in_stock, cashback_pct, basic_info, activation_guide";
const PRODUCT_COLS_OWNER = "id, slug, seller_id, name, category, subcategory, description, price_usd, original_currency, original_amount, fx_snapshot, hue, vendor, rating, reviews, promoted, external_url, file_path, cover_path, created_at, kind, status, reject_reason, condition, brand, location, negotiable, delivery, image_paths, requires_manual_delivery, in_stock, cashback_pct, seller_phone, whatsapp_number, social_link, basic_info, activation_guide";

async function signImagePaths(
  sb: ReturnType<typeof serverPublicClient>,
  paths: string[],
): Promise<string[]> {
  if (paths.length === 0) return [];
  const { data } = await sb.storage.from("product-covers").createSignedUrls(paths, 60 * 60 * 24 * 7);
  const map = new Map<string, string>();
  (data ?? []).forEach((r) => { if (r.path && r.signedUrl) map.set(r.path, r.signedUrl); });
  return paths.map((p) => map.get(p) ?? "").filter(Boolean);
}

/** Public catalog. Anyone (including anon) can list. RLS filters to status='active'. */
export const listProducts = createServerFn({ method: "GET" })
  .handler(async () => {
    const sb = serverPublicClient();
    let q = sb
      .from("products")
      .select(PRODUCT_COLS)
      .eq("status", "active")
      .order("promoted", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(400);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const items = rows ?? [];
    const urls = await signCovers(sb, items.map((r) => (r.cover_path as string) ?? null));

    // Aggregate paid sales per product so the catalog can sort by best-selling.
    const salesMap = new Map<string, number>();
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: orderRows } = await supabaseAdmin
        .from("orders")
        .select("product_id, quantity, status")
        .in("status", ["paid", "delivered", "completed", "released"])
        .limit(5000);
      (orderRows ?? []).forEach((o: any) => {
        const pid = o.product_id as string | null;
        if (!pid) return;
        salesMap.set(pid, (salesMap.get(pid) ?? 0) + Number(o.quantity ?? 1));
      });
    } catch {
      /* sales metrics are best-effort */
    }

    return items.map((r, i) => ({
      ...mapProduct(r as Record<string, unknown>, urls[i]),
      salesCount: salesMap.get(r.id as string) ?? 0,
    }));
  });

export interface CategoryNode {
  id: string;
  slug: string;
  name: string;
  description: string;
  kind: "digital";
  parentId: string | null;
  sortOrder: number;
  children: CategoryNode[];
}

/** Public list of enabled marketplace categories (with subcategories). */
export const listMarketplaceCategories = createServerFn({ method: "GET" }).handler(async () => {
  const sb = serverPublicClient();
  const { data, error } = await sb
    .from("marketplace_categories")
    .select("id, slug, name, description, kind, parent_id, sort_order, enabled")
    .eq("enabled", true)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const map = new Map<string, CategoryNode>();
  rows.forEach((r) => {
    map.set(r.id as string, {
      id: r.id as string,
      slug: r.slug as string,
      name: r.name as string,
      description: (r.description as string) ?? "",
      kind: "digital" as const,
      parentId: (r.parent_id as string) ?? null,
      sortOrder: Number(r.sort_order ?? 0),
      children: [],
    });
  });
  const roots: CategoryNode[] = [];
  map.forEach((node) => {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
});

/** Public product detail. */
export const getProduct = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string }) => ({ id: String(input?.id ?? "") }))
  .handler(async ({ data }) => {
    if (!data.id) throw new Error("Product id required");
    const sb = serverPublicClient();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.id);
    const base = sb.from("products").select(PRODUCT_COLS);
    const { data: row, error } = isUuid
      ? await base.eq("id", data.id).maybeSingle()
      : await base.eq("slug", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Product not found");
    const [url] = await signCovers(sb, [(row.cover_path as string) ?? null]);
    const imgs = Array.isArray(row.image_paths) ? (row.image_paths as string[]) : [];
    const imgUrls = await signImagePaths(sb, imgs);
    const { data: prof } = await sb
      .from("profiles")
      .select("slug")
      .eq("user_id", row.seller_id as string)
      .maybeSingle();
    const sellerSlug = (prof?.slug as string) ?? null;
    return mapProduct(row as Record<string, unknown>, url, imgUrls, sellerSlug);
  });

/** Authenticated seller creates a digital-asset product (goes to pending for admin review). */
export const createProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    name: string;
    category: ProductCategory;
    subcategory?: string | null;
    description: string;
    priceUSD: number;
    vendor: string;
    hue?: string;
    externalUrl?: string | null;
    filePath?: string | null;
    coverPath?: string | null;
    imagePaths?: string[];
    requiresManualDelivery?: boolean;
    inStock?: boolean;
    basicInfo?: string | null;
    activationGuide?: string | null;
    originalCurrency?: OrderCurrency;
    originalAmount?: number;
    fxSnapshot?: { base: string; rates: Record<string, number>; source?: string; fetched_at?: string } | null;
    /** Seller-funded cashback rate (%) for this product — paid out of the seller's 80%. */
    cashbackPct?: number | null;
  }) => ({
    name: String(input.name ?? "").trim(),
    category: input.category,
    subcategory: input.subcategory ? String(input.subcategory).trim() : null,
    description: String(input.description ?? "").trim(),
    priceUSD: Math.max(0, Number(input.priceUSD ?? 0)),
    vendor: String(input.vendor ?? "").trim(),
    hue: input.hue ?? "from-emerald-500 to-teal-700",
    externalUrl: input.externalUrl ?? null,
    filePath: input.filePath ?? null,
    coverPath: input.coverPath ?? null,
    imagePaths: (input.imagePaths ?? []).filter(Boolean),
    requiresManualDelivery: Boolean(input.requiresManualDelivery),
    inStock: input.inStock !== false,
    basicInfo: input.basicInfo ? String(input.basicInfo).trim() : null,
    activationGuide: input.activationGuide ? String(input.activationGuide).trim() : null,
    originalCurrency: (input.originalCurrency ?? "USD") as OrderCurrency,
    originalAmount: Math.max(0, Number(input.originalAmount ?? input.priceUSD ?? 0)),
    fxSnapshot: input.fxSnapshot ?? null,
    cashbackPct: Math.max(0, Math.min(50, Number(input.cashbackPct ?? 0))),
  }))
  .handler(async ({ data, context }) => {
    if (!data.name) throw new Error("Name required");
    if (data.priceUSD < 0) throw new Error("Price cannot be negative");

    // Admins publish directly; regular sellers enter the moderation queue.
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    const initialStatus = isAdmin ? "active" : "pending";

    const cover = data.coverPath ?? data.imagePaths[0] ?? null;
    const { data: row, error } = await context.supabase
      .from("products")
      .insert({
        seller_id: context.userId,
        name: data.name,
        category: data.category,
        subcategory: data.subcategory,
        description: data.description,
        price_usd: data.priceUSD,
        original_currency: data.originalCurrency,
        original_amount: data.originalAmount,
        fx_snapshot: data.fxSnapshot ? JSON.parse(JSON.stringify(data.fxSnapshot)) : null,
        cashback_pct: data.cashbackPct,
        vendor: data.vendor,
        hue: data.hue,
        external_url: data.externalUrl,
        file_path: data.filePath,
        cover_path: cover,
        image_paths: data.imagePaths,
        requires_manual_delivery: data.requiresManualDelivery,
        in_stock: data.inStock,
        basic_info: data.basicInfo,
        activation_guide: data.activationGuide,
        promoted: false,
        kind: "digital",
        status: initialStatus,
      })
      .select("id, seller_id, name, category, subcategory, description, price_usd, original_currency, original_amount, fx_snapshot, hue, vendor, rating, reviews, promoted, external_url, file_path, cover_path, image_paths, created_at, updated_at, kind, status, reject_reason, requires_manual_delivery, in_stock, basic_info, activation_guide")
      .single();


    if (error) throw new Error(error.message);
    let coverUrl: string | null = null;
    if (cover) {
      const { data: signed } = await context.supabase.storage
        .from("product-covers")
        .createSignedUrl(cover, 60 * 60 * 24 * 7);
      coverUrl = signed?.signedUrl ?? null;
    }
    return mapProduct(row as Record<string, unknown>, coverUrl);
  });


export const listMyProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Seller contact columns are not readable by the `authenticated` role
    // (column-level grants keep them out of bulk scraping). The caller is
    // verified by the middleware and the query is hard-scoped to their own
    // rows, so the service client is used strictly for own-row reads.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("products")
      .select(PRODUCT_COLS_OWNER)
      .eq("seller_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as Record<string, unknown>[];
    const out: ProductDTO[] = [];
    for (const r of rows) {
      const cover = (r.cover_path as string) ?? null;
      let coverUrl: string | null = null;
      if (cover) {
        const { data: sig } = await context.supabase.storage
          .from("product-covers")
          .createSignedUrl(cover, 60 * 60 * 24);
        coverUrl = sig?.signedUrl ?? null;
      }
      const paths = Array.isArray(r.image_paths) ? (r.image_paths as string[]) : [];
      const imageUrls: string[] = [];
      for (const p of paths) {
        const { data: sig } = await context.supabase.storage
          .from("product-covers")
          .createSignedUrl(p, 60 * 60 * 24);
        imageUrls.push(sig?.signedUrl ?? "");
      }
      out.push(mapProduct(r, coverUrl, imageUrls));
    }
    return out;
  });

/**
 * Update a rejected listing and resubmit it for review. Only the owner can call
 * this, and only when the product is currently in the `rejected` state.
 * Status transitions back to `pending`, reject_reason is cleared, and the admin
 * team receives a system notification (with the seller's optional response).
 */
export const updateAndResubmitProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    id: string;
    name?: string;
    category?: string;
    subcategory?: string | null;
    description?: string;
    priceUSD?: number;
    originalCurrency?: OrderCurrency;
    originalAmount?: number;
    fxSnapshot?: { base: string; rates: Record<string, number>; source?: string; fetched_at?: string } | null;
    externalUrl?: string | null;
    filePath?: string | null;
    coverPath?: string | null;
    imagePaths?: string[];
    condition?: string | null;
    brand?: string | null;
    location?: string | null;
    negotiable?: string | null;
    delivery?: string | null;
    sellerPhone?: string | null;
    whatsappNumber?: string | null;
    socialLink?: string | null;
    inStock?: boolean;
    basicInfo?: string | null;
    activationGuide?: string | null;
    sellerResponse?: string | null;
    cashbackPct?: number | null;
  }) => ({
    id: String(input.id ?? ""),
    name: input.name !== undefined ? String(input.name).trim() : undefined,
    category: input.category !== undefined ? String(input.category).trim() : undefined,
    subcategory: input.subcategory !== undefined ? (input.subcategory ? String(input.subcategory).trim() : null) : undefined,
    description: input.description !== undefined ? String(input.description).trim() : undefined,
    priceUSD: input.priceUSD !== undefined ? Number(input.priceUSD) : undefined,
    originalCurrency: input.originalCurrency,
    originalAmount: input.originalAmount !== undefined ? Number(input.originalAmount) : undefined,
    fxSnapshot: input.fxSnapshot ?? undefined,
    externalUrl: input.externalUrl,
    filePath: input.filePath,
    coverPath: input.coverPath,
    imagePaths: input.imagePaths,
    condition: input.condition,
    brand: input.brand,
    location: input.location,
    negotiable: input.negotiable,
    delivery: input.delivery,
    sellerPhone: input.sellerPhone !== undefined && input.sellerPhone !== null
      ? String(input.sellerPhone).replace(/\D/g, "")
      : input.sellerPhone,
    whatsappNumber: input.whatsappNumber !== undefined && input.whatsappNumber !== null
      ? String(input.whatsappNumber).replace(/\D/g, "")
      : input.whatsappNumber,
    socialLink: input.socialLink,
    inStock: input.inStock,
    basicInfo: input.basicInfo !== undefined ? (input.basicInfo ? String(input.basicInfo).trim() : null) : undefined,
    activationGuide: input.activationGuide !== undefined ? (input.activationGuide ? String(input.activationGuide).trim() : null) : undefined,
    sellerResponse: input.sellerResponse ? String(input.sellerResponse).trim().slice(0, 1000) : null,
    cashbackPct:
      input.cashbackPct !== undefined && input.cashbackPct !== null
        ? Math.max(0, Math.min(50, Number(input.cashbackPct)))
        : undefined,
  }))
  .handler(async ({ data, context }) => {
    if (!data.id) throw new Error("Product id required");

    // Load and verify ownership. Owners may edit pending, rejected AND live
    // listings; live listings only fall back into moderation when the actual
    // deliverable (file / delivery URL) changes and needs a fresh scan.
    const { data: current, error: loadErr } = await context.supabase
      .from("products")
      .select("id, seller_id, status, kind, name, file_path, external_url")
      .eq("id", data.id)
      .maybeSingle();
    if (loadErr) throw new Error(loadErr.message);
    if (!current) throw new Error("Listing not found");
    if ((current.seller_id as string) !== context.userId) throw new Error("You can only edit your own listings");
    if (!["rejected", "pending", "active"].includes(current.status as string)) {
      throw new Error("This listing can no longer be edited");
    }

    const isLive = (current.status as string) === "active";
    const deliverableChanged =
      (data.filePath !== undefined && data.filePath !== (current.file_path as string | null)) ||
      (data.externalUrl !== undefined &&
        (data.externalUrl || null) !== ((current.external_url as string | null) || null));
    const nextStatus = isLive && !deliverableChanged ? "active" : "pending";

    const patch: Record<string, unknown> = {
      status: nextStatus,
      reject_reason: null,
    };

    if (data.name !== undefined) patch.name = data.name;
    if (data.category !== undefined) patch.category = data.category;
    if (data.subcategory !== undefined) patch.subcategory = data.subcategory;
    if (data.description !== undefined) patch.description = data.description;
    if (data.priceUSD !== undefined) patch.price_usd = data.priceUSD;
    if (data.cashbackPct !== undefined) patch.cashback_pct = data.cashbackPct;
    if (data.originalCurrency !== undefined) patch.original_currency = data.originalCurrency;
    if (data.originalAmount !== undefined) patch.original_amount = data.originalAmount;
    if (data.fxSnapshot !== undefined) patch.fx_snapshot = data.fxSnapshot ? JSON.parse(JSON.stringify(data.fxSnapshot)) : null;
    if (data.externalUrl !== undefined) patch.external_url = data.externalUrl;
    if (data.filePath !== undefined) patch.file_path = data.filePath;
    if (data.coverPath !== undefined) patch.cover_path = data.coverPath;
    if (data.imagePaths !== undefined) {
      patch.image_paths = data.imagePaths;
      if (data.imagePaths.length > 0) patch.cover_path = data.imagePaths[0];
    }
    if (data.condition !== undefined) patch.condition = data.condition;
    if (data.brand !== undefined) patch.brand = data.brand;
    if (data.location !== undefined) patch.location = data.location;
    if (data.negotiable !== undefined) patch.negotiable = data.negotiable;
    if (data.delivery !== undefined) patch.delivery = data.delivery;
    if (data.sellerPhone !== undefined) patch.seller_phone = data.sellerPhone;
    if (data.whatsappNumber !== undefined) patch.whatsapp_number = data.whatsappNumber;
    if (data.socialLink !== undefined) patch.social_link = data.socialLink;
    if (data.inStock !== undefined) patch.in_stock = data.inStock;
    if (data.basicInfo !== undefined) patch.basic_info = data.basicInfo;
    if (data.activationGuide !== undefined) patch.activation_guide = data.activationGuide;

    const { error: updErr } = await context.supabase
      .from("products")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(patch as any)
      .eq("id", data.id)
      .eq("seller_id", context.userId);
    if (updErr) throw new Error(updErr.message);

    // Notify admins only when the edit actually needs moderation.
    if (nextStatus === "pending") {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: admins } = await supabaseAdmin
          .from("user_roles")
          .select("user_id")
          .eq("role", "admin");
        const body = data.sellerResponse
          ? `Seller resubmitted "${current.name as string}" for review. Response: ${data.sellerResponse}`
          : `Seller resubmitted "${current.name as string}" for review.`;
        const rows = (admins ?? []).map((a) => ({
          user_id: a.user_id as string,
          kind: "system" as const,
          title: "Listing resubmitted for review",
          body,
          link: `/admin/products`,
          from_user_id: context.userId,
        }));
        if (rows.length > 0) {
          await supabaseAdmin.from("notifications").insert(rows);
        }
      } catch (err) {
        console.error("[updateAndResubmitProduct] admin notify failed", err);
      }
    }

    return { id: data.id, status: nextStatus as "pending" | "active" };

  });



/**
 * REMOVED (financial hardening): the legacy mock `topUpWallet` endpoint credited
 * a caller-supplied amount to their own wallet with no payment behind it.
 * Wallet funding now happens exclusively through gateway settlement
 * (`settleWalletTopup`) or admin-approved manual payments.
 */

export interface CreateOrderInput {
  productId: string;
  quantity: number;
  displayCurrency: OrderCurrency;
  paymentMethod: PaymentMethod;
  couponCode?: string | null;
  deliveryEmail?: string | null;
  deliveryWhatsapp?: string | null;
  /** Amount of Cashback Wallet (USD) to spend on this order. */
  applyCashbackUSD?: number | null;
}

export interface CreateOrderResult {
  order: OrderDTO;
  walletShortfallUSD?: number;
  walletShortfallDisplay?: number;
  walletShortfallCurrency?: OrderCurrency;
  cashbackUSD?: number;
  cashbackAppliedUSD?: number;
  discountUSD?: number;
}

export const SELLER_SHARE = 0.8;
export const PLATFORM_SHARE = 0.2;
export const WALLET_CASHBACK_PCT = 0.02;

/**
 * Estimate the Paystack processing fee in USD for a given order.
 * Buyer pays the sticker price; this fee is skimmed off the top before the
 * platform/seller split (buyer never sees a surcharge line at checkout).
 * Rates are Paystack's standard published rates as of 2025.
 *   NGN: 1.5%, +₦100 if txn ≥ ₦2,500, capped at ₦2,000
 *   GHS: 1.95%
 *   USD/international: 3.9% + $0.30
 * Wallet payments settle internally with no gateway fee.
 */
export function estimatePaystackFeeUSD(
  totalUSD: number,
  displayCurrency: OrderCurrency,
  paymentMethod: PaymentMethod,
  fxFromUSD: number,
): number {
  if (paymentMethod === "wallet") return 0;
  if (totalUSD <= 0) return 0;
  if (displayCurrency === "NGN") {
    const ngn = totalUSD * fxFromUSD;
    let feeNgn = ngn * 0.015 + (ngn >= 2500 ? 100 : 0);
    if (feeNgn > 2000) feeNgn = 2000;
    return Number((feeNgn / fxFromUSD).toFixed(2));
  }
  if (displayCurrency === "GHS") {
    return Number((totalUSD * 0.0195).toFixed(2));
  }
  return Number((totalUSD * 0.039 + 0.30).toFixed(2));
}

/**
 * What the seller actually receives, in USD, for a sale at `totalUSD`.
 * The gateway fee is absorbed before the split so the seller shares in it
 * (industry-standard on Selar / Paystack Storefront / Gumroad).
 */
export function estimateSellerNetUSD(
  totalUSD: number,
  displayCurrency: OrderCurrency,
  paymentMethod: PaymentMethod,
  fxFromUSD: number,
): number {
  const fee = estimatePaystackFeeUSD(totalUSD, displayCurrency, paymentMethod, fxFromUSD);
  const net = Math.max(0, totalUSD - fee);
  return Number((net * SELLER_SHARE).toFixed(2));
}


/**
 * Validate a coupon against a real cart context. The server owns every part of
 * this decision (existence, active window, product/seller eligibility, minimum
 * spend, total and per-user usage limits) and returns the discount it computed.
 */
export const validateCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { code: string; productId?: string | null; quantity?: number | null }) => ({
    code: String(i?.code ?? "").trim().toUpperCase(),
    productId: i?.productId ? String(i.productId) : null,
    quantity: Math.max(1, Math.min(20, Number(i?.quantity ?? 1))),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!data.code) return { valid: false as const, reason: "Enter a coupon code" };

    let grossUSD = 0;
    let sellerId: string | null = null;
    if (data.productId) {
      const { data: p } = await supabase
        .from("products")
        .select("id, seller_id, price_usd")
        .eq("id", data.productId)
        .maybeSingle();
      if (!p) return { valid: false as const, reason: "Product not found" };
      sellerId = (p.seller_id as string) ?? null;
      grossUSD = Number((Number(p.price_usd) * data.quantity).toFixed(2));
    }

    const { validateCouponServer } = await import("@/lib/promotions.server");
    const check = await validateCouponServer(supabase, data.code, {
      userId,
      productId: data.productId,
      sellerId,
      grossUSD,
    });
    if (!check.valid) return { valid: false as const, reason: check.reason };
    return {
      valid: true as const,
      code: check.code,
      discountPct: check.discountPct,
      discountUSD: check.discountUSD,
    };
  });

/** Create + settle an order. Wallet method debits balance atomically. */
export const createOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: CreateOrderInput) => ({
    productId: String(input.productId ?? ""),
    quantity: Math.max(1, Math.min(20, Number(input.quantity ?? 1))),
    displayCurrency: (input.displayCurrency ?? "USD") as OrderCurrency,
    // Wallet is the ONLY method this endpoint may settle. Card / bank / momo
    // orders are created exclusively by gateway settlement (settle.server.ts)
    // after the provider confirms the payment — never from a client request.
    paymentMethod: ((): PaymentMethod => {
      const m = (input.paymentMethod ?? "wallet") as PaymentMethod;
      if (m !== "wallet") {
        throw new Error("Card payments must be completed through the payment gateway.");
      }
      return "wallet";
    })(),
    couponCode: input.couponCode ? String(input.couponCode).trim().toUpperCase() : null,
    deliveryEmail: input.deliveryEmail ? String(input.deliveryEmail).trim().slice(0, 320) : null,
    deliveryWhatsapp: input.deliveryWhatsapp ? String(input.deliveryWhatsapp).replace(/\D/g, "").slice(0, 20) : null,
    applyCashbackUSD: Math.max(0, Number(input.applyCashbackUSD ?? 0)),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: pRow, error: pErr } = await supabase
      .from("products")
      .select("id, seller_id, name, category, description, price_usd, original_currency, original_amount, fx_snapshot, hue, vendor, rating, reviews, promoted, external_url, file_path, created_at, requires_manual_delivery, in_stock, cashback_pct")
      .eq("id", data.productId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!pRow) throw new Error("Product not found");
    if ((pRow as Record<string, unknown>).in_stock === false) {
      throw new Error("This product is currently out of stock");
    }
    const product = mapProduct(pRow as Record<string, unknown>);
    const productCashbackPct = Number((pRow as Record<string, unknown>).cashback_pct ?? 0);

    // Global catalogue: listings are sold across regions. The buyer is charged
    // in their own home currency (displayCurrency), converted from the USD
    // base price, so no cross-currency block is applied here.



    const grossUSD = Number((product.priceUSD * data.quantity).toFixed(2));

    // Coupon — validated server-side against the real cart. An invalid coupon
    // is refused outright rather than silently ignored.
    const { validateCouponServer, sellerFundedCashbackUSD, recordCouponRedemption, qualifyReferralOnSettledPurchase } =
      await import("@/lib/promotions.server");
    let discountUSD = 0;
    let discountPct = 0;
    let appliedCouponCode: string | null = null;
    if (data.couponCode) {
      const check = await validateCouponServer(supabase, data.couponCode, {
        userId,
        productId: product.id,
        sellerId: product.sellerId,
        grossUSD,
      });
      if (!check.valid) throw new Error(check.reason);
      discountPct = check.discountPct;
      discountUSD = check.discountUSD;
      appliedCouponCode = check.code;
    }
    const afterCouponUSD = Number((grossUSD - discountUSD).toFixed(2));

    // Cashback Wallet spend — clamp requested amount to available cashback
    // and remaining total; debit atomically via SECURITY DEFINER helper.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let cashbackAppliedUSD = 0;
    if (data.applyCashbackUSD > 0 && discountUSD <= 0) {
      const { data: wRow } = await supabaseAdmin
        .from("wallets")
        .select("accumulated_cashback")
        .eq("user_id", userId)
        .eq("currency", "USD")
        .maybeSingle();
      const availableCB = Number(wRow?.accumulated_cashback ?? 0);
      const want = Math.min(data.applyCashbackUSD, availableCB, afterCouponUSD);
      const spend = Number(want.toFixed(2));
      if (spend > 0) {
        const { data: cbOk, error: cbErr } = await supabaseAdmin.rpc("cashback_debit", {
          _user_id: userId,
          _amount: spend,
        });
        if (cbErr) throw new Error(cbErr.message);
        if (cbOk) cashbackAppliedUSD = spend;
      }
    }

    const totalUSD = Number((afterCouponUSD - cashbackAppliedUSD).toFixed(2));
    // Charge exactly what the buyer was shown: use the listing's locked FX
    // snapshot (and the seller's published amount when the buyer's currency is
    // the listing currency) instead of the stale fallback rate table.
    const { convertViaSnapshot } = await import("@/lib/fx-display");
    const snapRaw = (pRow as Record<string, unknown>).fx_snapshot as
      | { base?: string; rates?: Record<string, number> }
      | null;
    const snap = snapRaw && snapRaw.rates ? { base: "USD" as const, rates: snapRaw.rates } : null;
    const convertedTotal =
      product.originalAmount > 0 &&
      data.displayCurrency === product.originalCurrency &&
      afterCouponUSD > 0
        ? product.originalAmount * data.quantity * (totalUSD / afterCouponUSD)
        : convertViaSnapshot(totalUSD, "USD", data.displayCurrency, snap);
    const displayTotal = Number(
      (convertedTotal > 0 ? convertedTotal : totalUSD * FX_FROM_USD[data.displayCurrency]).toFixed(2),
    );
    const fx = displayTotal > 0 && totalUSD > 0 ? displayTotal / totalUSD : FX_FROM_USD[data.displayCurrency];

    // Wallet debit — debit the buyer's per-currency wallet (matches how
    // Paystack top-ups credit per currency), not USD. This makes the balance
    // the buyer sees at checkout equal the "true" amount they funded.
    if (data.paymentMethod === "wallet" && totalUSD > 0) {
      // Double-submit guard: an identical wallet purchase inside 90s is treated
      // as a replay of the same click and must never debit the wallet twice.
      const { data: recent } = await supabaseAdmin
        .from("orders")
        .select("id")
        .eq("buyer_id", userId)
        .eq("product_id", product.id)
        .eq("payment_method", "wallet")
        .eq("display_total", displayTotal)
        .gte("created_at", new Date(Date.now() - 90_000).toISOString())
        .limit(1);
      if (recent && recent.length > 0) {
        throw new Error("This wallet payment was already processed — check your orders.");
      }
      const { data: ok, error: dErr } = await supabaseAdmin.rpc("wallet_debit_currency", {
        _user_id: userId,
        _amount: displayTotal,
        _currency: data.displayCurrency,
      });
      if (dErr) throw new Error(dErr.message);
      if (!ok) {
        if (cashbackAppliedUSD > 0) {
          await supabaseAdmin.rpc("cashback_credit", { _user_id: userId, _amount: cashbackAppliedUSD });
        }
        const { data: w } = await supabaseAdmin
          .from("wallets")
          .select("available_balance")
          .eq("user_id", userId)
          .eq("currency", data.displayCurrency)
          .maybeSingle();
        const bal = Number(w?.available_balance ?? 0);
        const shortDisplay = Number((displayTotal - bal).toFixed(2));
        return {
          order: null as unknown as OrderDTO,
          walletShortfallUSD: Number((shortDisplay / fx).toFixed(2)),
          walletShortfallDisplay: shortDisplay,
          walletShortfallCurrency: data.displayCurrency,
        } as CreateOrderResult;
      }
    }

    // Manual-delivery products hold the seller's share in escrow until the
    // buyer confirms receipt (or an admin releases). Instant-download products
    // release immediately.
    const holdEscrow = Boolean(product.requiresManualDelivery);

    // Orders are written with the service client only: `authenticated` has no
    // INSERT privilege on public.orders, so no browser can forge a paid order.
    const { data: oRow, error: oErr } = await supabaseAdmin
      .from("orders")
      .insert({
        buyer_id: userId,
        product_id: product.id,
        product_name_snapshot: product.name,
        product_category_snapshot: product.category,
        seller_id: product.sellerId,
        quantity: data.quantity,
        unit_price_usd: product.priceUSD,
        total_usd: totalUSD,
        display_currency: dbCurrency(data.displayCurrency),
        display_total: displayTotal,
        fx_rate: fx,
        payment_method: data.paymentMethod,
        status: "paid",
        paid_at: new Date().toISOString(),
        delivery_email: data.deliveryEmail,
        delivery_whatsapp: data.deliveryWhatsapp,
      })
      .select()
      .single();
    if (oErr) {
      // The order never came into existence, so no money may stay taken:
      // return the wallet debit and any cashback spend before failing.
      if (data.paymentMethod === "wallet" && totalUSD > 0) {
        await supabaseAdmin.rpc("wallet_credit_currency", {
          _user_id: userId,
          _amount: displayTotal,
          _currency: data.displayCurrency,
        });
      }
      if (cashbackAppliedUSD > 0) {
        await supabaseAdmin.rpc("cashback_credit", { _user_id: userId, _amount: cashbackAppliedUSD });
      }
      throw new Error(oErr.message);
    }

    // Ledger entry for buyer.
    await supabaseAdmin.from("wallet_transactions").insert({
      user_id: userId,
      tx_hash: `0x${Math.random().toString(16).slice(2, 6).toUpperCase()}-${Date.now().toString(16).toUpperCase()}`,
      type: "Marketplace Purchase",
      amount: displayTotal,
      currency: dbCurrency(data.displayCurrency),
      inflow: false,
      status: "success",
      occurred_at: new Date().toISOString(),
    });

    // Buyer pays the exact sticker price. Wallet payments settle internally
    // with no gateway fee, so seller/platform split the full paid amount.
    const gatewayFeeUSD = estimatePaystackFeeUSD(totalUSD, data.displayCurrency, data.paymentMethod, fx);
    const netAfterGatewayUSD = Number(Math.max(0, totalUSD - gatewayFeeUSD).toFixed(2));
    const sellerGrossUSD = Number((netAfterGatewayUSD * SELLER_SHARE).toFixed(2));
    // Platform keeps a flat 20%; product-level cashback is funded out of the
    // seller's own share only.
    const platformCutUSD = Number((netAfterGatewayUSD - sellerGrossUSD).toFixed(2));
    const cashbackUSD = sellerFundedCashbackUSD(productCashbackPct, netAfterGatewayUSD, sellerGrossUSD);
    const sellerCutUSD = Number(Math.max(0, sellerGrossUSD - cashbackUSD).toFixed(2));
    const sellerNetRatio = sellerGrossUSD > 0 ? sellerCutUSD / sellerGrossUSD : 1;

    // Persist escrow state + seller share on the order.
    await supabaseAdmin
      .from("orders")
      .update({
        escrow_status: holdEscrow ? "held" : "released",
        seller_share_usd: sellerCutUSD,
        released_at: holdEscrow ? null : new Date().toISOString(),
      })
      .eq("id", oRow.id as string);

    const { data: sellerProfile } = await supabaseAdmin
      .from("profiles")
      .select("country")
      .eq("user_id", product.sellerId)
      .maybeSingle();
    const sellerCountry = String(sellerProfile?.country ?? "").toUpperCase();
    const sellerCurrency: OrderCurrency = sellerCountry === "NG" ? "NGN" : sellerCountry === "GH" ? "GHS" : "USD";
    const sellerCutLocalRaw =
      product.originalAmount > 0 && product.originalCurrency === sellerCurrency
        ? product.originalAmount * data.quantity * SELLER_SHARE * sellerNetRatio
        : sellerCutUSD * FX_FROM_USD[sellerCurrency];
    const sellerCutLocal = Number(sellerCutLocalRaw.toFixed(sellerCurrency === "USD" ? 2 : 0));

    if (!holdEscrow) {
      await supabaseAdmin.rpc("wallet_credit_currency", {
        _user_id: product.sellerId,
        _amount: sellerCutLocal,
        _currency: sellerCurrency,
      });
    }
    await supabaseAdmin.from("wallet_transactions").insert({
      user_id: product.sellerId,
      tx_hash: `${oRow.id}-S`,
      type: "Marketplace Sale",
      amount: sellerCutLocal,
      currency: dbCurrency(sellerCurrency),
      inflow: true,
      status: holdEscrow ? "pending" : "success",
      occurred_at: new Date().toISOString(),
    });

    // Credit the admin marketplace revenue wallet via SECURITY DEFINER helper.
    await supabaseAdmin.rpc("system_wallet_credit", {
      _kind: "marketplace",
      _amount: platformCutUSD,
      _source: "marketplace_order",
      _ref: oRow.id as string,
      _meta: { order_id: oRow.id, product_id: product.id, buyer_id: userId, seller_id: product.sellerId, cashback_usd: cashbackUSD, gateway_fee_usd: gatewayFeeUSD, payment_method: data.paymentMethod, escrow: holdEscrow, seller_cut_local: sellerCutLocal, seller_cut_currency: sellerCurrency },
    });


    // Seller-funded, product-level cashback → buyer's SPEND-ONLY Cashback
    // Wallet (accumulated_cashback). Withdraw functions read available_balance
    // only, so this pot can be spent at checkout but never cashed out to bank.
    if (cashbackUSD > 0) {
      await supabaseAdmin.rpc("cashback_credit", { _user_id: userId, _amount: cashbackUSD });
      await supabaseAdmin.from("wallet_transactions").insert({
        user_id: userId,
        tx_hash: `${oRow.id}-CB`,
        type: "Cashback Earned",
        amount: Number((cashbackUSD * fx).toFixed(2)),
        currency: dbCurrency(data.displayCurrency),
        inflow: true,
        status: "success",
        occurred_at: new Date().toISOString(),
      });
    }

    if (appliedCouponCode && discountUSD > 0) {
      await recordCouponRedemption(supabaseAdmin, {
        code: appliedCouponCode,
        userId,
        orderId: oRow.id as string,
        reference: `ORDER_${oRow.id}`,
        discountUSD,
      });
    }

    // Referral reward — only on the invitee's first settled purchase.
    await qualifyReferralOnSettledPurchase(supabaseAdmin, {
      buyerId: userId,
      orderId: oRow.id as string,
      orderTotalUSD: afterCouponUSD,
    });

    // Manual-delivery flow: notify the seller in-platform via DM + inbox so they
    // know a paid order is waiting for them to deliver via URL, file upload, or
    // chat. Escrow stays "held" until the buyer confirms receipt.
    if (holdEscrow) {
      const origin = process.env.VITE_SITE_URL || "https://oventric.com";
      const productLink = `${origin}/product/${product.id}`;

      // Automatic Buyer to Seller message
      await supabaseAdmin.from("direct_messages").insert({
        sender_id: userId,
        recipient_id: product.sellerId,
        order_id: oRow.id as string,
        body: `hey i just paid for ${product.name} please deliver as soon as possible. ${productLink}`,
      });

      // Automatic Seller to Buyer reply
      await supabaseAdmin.from("direct_messages").insert({
        sender_id: product.sellerId,
        recipient_id: userId,
        order_id: oRow.id as string,
        body: `Thank you for your payment!. We are preparing your order and will ship it as soon as possible. Thank you and we will make sure everything goes smoothly. ${productLink}`,
      });

      const dmBody =
        `📦 New paid order — "${product.name}" (Qty ${data.quantity})\n\n` +
        `The buyer has paid and is waiting for delivery. Please deliver here on Oventric ` +
        `(share a link, upload a file, or attach it in this chat) so the platform can protect both sides. ` +
        `Payment will only be released to your wallet after the buyer confirms they received the goods.\n\n` +
        `Buyer contact on file:\n` +
        `• Email: ${data.deliveryEmail ?? "—"}\n\n` +
        `Order ref: ${(oRow.id as string).slice(0, 8)}`;
      await supabaseAdmin.from("direct_messages").insert({
        sender_id: userId,
        recipient_id: product.sellerId,
        order_id: oRow.id as string,
        body: dmBody,
      });
      await supabaseAdmin.from("notifications").insert({
        user_id: product.sellerId,
        kind: "order_manual_delivery",
        title: `Deliver "${product.name}"`,
        body: `A buyer paid and is waiting for you to deliver on-platform. Escrow releases after they confirm receipt.`,
        link: `/order/${oRow.id as string}`,
        from_user_id: userId,
      });
    }


    return {
      order: {
        id: oRow.id as string,
        productId: product.id,
        productName: product.name,
        category: product.category,
        vendor: product.vendor,
        hue: product.hue,
        quantity: data.quantity,
        unitPriceUSD: product.priceUSD,
        totalUSD,
        displayCurrency: data.displayCurrency,
        displayTotal,
        paymentMethod: data.paymentMethod,
        status: "paid",
        downloadToken: oRow.download_token as string,
        createdAt: oRow.created_at as string,
        paidAt: oRow.paid_at as string,
        externalUrl: product.externalUrl,
        filePath: product.filePath,
        deliveryEmail: data.deliveryEmail,
        deliveryWhatsapp: data.deliveryWhatsapp,
        requiresManualDelivery: product.requiresManualDelivery,
      },
      cashbackUSD: cashbackUSD || undefined,
      cashbackAppliedUSD: cashbackAppliedUSD || undefined,
      discountUSD: discountUSD || undefined,
    } as CreateOrderResult;
  });


/** Load an order for the buyer, with a signed download URL if applicable. */
export const getOrderWithDownload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderId: string }) => ({ orderId: String(input.orderId ?? "") }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: o, error } = await supabase
      .from("orders")
      .select("*, products:product_id (name, category, vendor, hue, external_url, file_path, requires_manual_delivery)")
      .eq("id", data.orderId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!o) throw new Error("Order not found");
    if ((o.buyer_id as string) !== userId) throw new Error("Not your order");

    const product = (o.products ?? {}) as Record<string, unknown>;
    let downloadUrl: string | null = null;
    const filePath = (product.file_path as string) ?? null;
    const manual = Boolean(product.requires_manual_delivery);
    if (o.status === "paid" && filePath && !manual) {
      // Use service-role client so RLS on storage.objects cannot silently strip
      // the signed URL for the legitimate buyer we've already authorized above.
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: signed } = await supabaseAdmin.storage
        .from("product-files")
        .createSignedUrl(filePath, 60 * 60);
      downloadUrl = signed?.signedUrl ?? null;
    }

    return {
      order: {
        id: o.id as string,
        productId: o.product_id as string,
        productName: (product.name as string) ?? (o.product_name_snapshot as string) ?? "Digital product",
        category: ((product.category as ProductCategory) ?? (o.product_category_snapshot as ProductCategory)) ?? "themes",
        vendor: (product.vendor as string) ?? "",
        hue: (product.hue as string) ?? "from-emerald-500 to-teal-700",
        quantity: Number(o.quantity),
        unitPriceUSD: Number(o.unit_price_usd),
        totalUSD: Number(o.total_usd),
        displayCurrency: o.display_currency as OrderCurrency,
        displayTotal: Number(o.display_total),
        paymentMethod: o.payment_method as PaymentMethod,
        status: o.status as OrderStatus,
        downloadToken: o.download_token as string,
        createdAt: o.created_at as string,
        paidAt: (o.paid_at as string) ?? null,
        externalUrl: (product.external_url as string) ?? null,
        filePath,
        deliveryEmail: (o.delivery_email as string) ?? null,
        deliveryWhatsapp: (o.delivery_whatsapp as string) ?? null,
        requiresManualDelivery: Boolean(product.requires_manual_delivery),
        servicePackage: (() => {
          const snap = o.service_package_snapshot as Record<string, unknown> | null;
          if (!snap) return null;
          return {
            name: String(snap.name ?? "Package"),
            tier: String(snap.tier ?? ""),
            features: Array.isArray(snap.features) ? (snap.features as string[]) : [],
            deliveryDays: snap.delivery_days == null ? null : Number(snap.delivery_days),
            revisions: snap.revisions == null ? null : Number(snap.revisions),
          };
        })(),
        serviceBrief: (o.service_brief as Record<string, string> | null) ?? null,
      } satisfies OrderDTO,
      downloadUrl,
    };
  });

export interface PurchaseDTO {
  orderId: string;
  productId: string;
  productName: string;
  category: string;
  vendor: string;
  hue: string;
  coverUrl: string | null;
  quantity: number;
  totalUSD: number;
  displayCurrency: OrderCurrency;
  displayTotal: number;
  status: OrderStatus;
  paidAt: string | null;
  createdAt: string;
  hasFile: boolean;
  externalUrl: string | null;
  requiresManualDelivery: boolean;
  escrowStatus: "held" | "released" | "refunded";
  buyerConfirmedAt: string | null;
}

/** All digital purchases for the signed-in buyer. */
export const listMyPurchases = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PurchaseDTO[]> => {
    const { data, error } = await context.supabase
      .from("orders")
      .select("id, product_id, product_name_snapshot, product_category_snapshot, quantity, unit_price_usd, total_usd, display_currency, display_total, status, paid_at, created_at, escrow_status, buyer_confirmed_at, products:product_id (name, category, vendor, hue, cover_path, file_path, external_url, requires_manual_delivery)")
      .eq("buyer_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Record<string, unknown>[];
    const out: PurchaseDTO[] = [];
    for (const r of rows) {
      const p = (r.products ?? {}) as Record<string, unknown>;
      const coverPath = (p.cover_path as string) ?? null;
      let coverUrl: string | null = null;
      if (coverPath) {
        const { data: sig } = await context.supabase.storage
          .from("product-covers")
          .createSignedUrl(coverPath, 60 * 60 * 24);
        coverUrl = sig?.signedUrl ?? null;
      }
      out.push({
        orderId: r.id as string,
        productId: r.product_id as string,
        productName: (p.name as string) ?? (r.product_name_snapshot as string) ?? "Digital product",
        category: (p.category as string) ?? (r.product_category_snapshot as string) ?? "themes",
        vendor: (p.vendor as string) ?? "",
        hue: (p.hue as string) ?? "from-emerald-500 to-teal-700",
        coverUrl,
        quantity: Number(r.quantity),
        totalUSD: Number(r.total_usd),
        displayCurrency: (r.display_currency as OrderCurrency) ?? "USD",
        displayTotal: Number(r.display_total ?? 0),
        status: (r.status as OrderStatus) ?? "pending",
        paidAt: (r.paid_at as string) ?? null,
        createdAt: r.created_at as string,
        hasFile: !!(p.file_path as string),
        externalUrl: (p.external_url as string) ?? null,
        requiresManualDelivery: Boolean(p.requires_manual_delivery),
        escrowStatus: ((r.escrow_status as string) ?? "released") as "held" | "released" | "refunded",
        buyerConfirmedAt: (r.buyer_confirmed_at as string) ?? null,
      });
    }
    return out;
  });

/**
 * Buyer confirms they've received a manual-delivery digital product. Releases
 * the escrowed seller share (80% cut) into the seller's available balance.
 * Idempotent: no-op if already released.
 */
export const confirmOrderReceived = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderId: string }) => ({ orderId: String(input.orderId ?? "") }))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { admin, confirmReceipt } = await import("@/lib/fulfilment.server");
    const sb = await admin();
    const { data: o, error } = await sb
      .from("orders")
      .select("id, buyer_id")
      .eq("id", data.orderId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!o) throw new Error("Order not found");
    if ((o.buyer_id as string) !== userId) throw new Error("Not your order");
    // Single authoritative path: starts the payout hold, no direct crediting.
    const res = await confirmReceipt(sb, data.orderId, userId, "buyer");
    return { alreadyReleased: res.alreadyConfirmed };
  });

/** Admin manually releases escrow for a stuck order. */
export const adminReleaseOrderEscrow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderId: string }) => ({ orderId: String(input.orderId ?? "") }))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { admin, releaseEscrow } = await import("@/lib/fulfilment.server");
    const sb = await admin();
    const res = await releaseEscrow(sb, data.orderId, userId, "admin");
    return { alreadyReleased: res.alreadyReleased };
  });

/** Admin list of orders currently holding seller funds in escrow. */
export interface HeldEscrowOrderDTO {
  orderId: string;
  productName: string;
  buyerId: string;
  sellerId: string;
  sellerShareUSD: number;
  totalUSD: number;
  paidAt: string | null;
  createdAt: string;
}
export const listHeldEscrowOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<HeldEscrowOrderDTO[]> => {
    const { userId, supabase } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("orders")
      .select("id, buyer_id, seller_id, seller_share_usd, total_usd, paid_at, created_at, products:product_id (name)")
      .eq("escrow_status", "held")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
      orderId: r.id as string,
      productName: (((r.products as Record<string, unknown>) ?? {}).name as string) ?? "Product",
      buyerId: r.buyer_id as string,
      sellerId: r.seller_id as string,
      sellerShareUSD: Number(r.seller_share_usd ?? 0),
      totalUSD: Number(r.total_usd ?? 0),
      paidAt: (r.paid_at as string) ?? null,
      createdAt: r.created_at as string,
    }));
  });





/** Search current seller's active products for tagging in a post. */
export const searchMyProductsForTagging = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ q: z.string().trim().max(100) }).parse(input))
  .handler(async ({ data, context }) => {
    const { sb } = await (async () => {
       // We need to use the admin client or similar because of RLS restrictions on seller contact info
       // But wait, for tagging we only need basic info. The authenticated client is fine.
       return { sb: context.supabase };
    })();
    
    let query = sb
      .from("products")
      .select("id, name, vendor, price_usd, cover_path, category")
      .eq("seller_id", context.userId)
      .eq("status", "active");

    if (data.q) {
      query = query.ilike("name", `%${data.q}%`);
    }

    const { data: rows, error } = await query.limit(20);
    if (error) throw new Error(error.message);

    const paths = (rows ?? []).map((r) => r.cover_path as string | null);
    const urls = await signCovers(sb as any, paths);

    return {
      products: (rows ?? []).map((r, i) => ({
        id: r.id,
        name: r.name,
        vendor: r.vendor,
        priceUsd: Number(r.price_usd),
        coverUrl: urls[i],
        category: r.category,
      })),
    };
  });

/** Discovery data for the new marketplace: Featured, Trending, New, Top Sellers. */
export const getMarketplaceDiscovery = createServerFn({ method: "GET" })
  .handler(async () => {
    const sb = serverPublicClient();
    const withKind = (q: any) => q;

    // 1. Featured Products (promoted or top rated)
    const { data: featuredRows } = await withKind(
      sb
        .from("products")
        .select(PRODUCT_COLS)
        .eq("status", "active")
        .eq("promoted", true)
        .order("rating", { ascending: false })
        .limit(6),
    );

    // 2. Trending (most reviews/high rating)
    const { data: trendingRows } = await withKind(
      sb
        .from("products")
        .select(PRODUCT_COLS)
        .eq("status", "active")
        .order("reviews", { ascending: false, nullsFirst: false })
        .limit(10),
    );

    // 3. New Arrivals
    const { data: newRows } = await withKind(
      sb
        .from("products")
        .select(PRODUCT_COLS)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(10),
    );

    // 4. Sellers (profiles that actually have active products)
    const { data: sellerIdRows } = await sb
      .from("products")
      .select("seller_id")
      .eq("status", "active")
      .limit(500);
    const sellerCounts = new Map<string, number>();
    (sellerIdRows ?? []).forEach((r) => {
      const id = r.seller_id as string;
      sellerCounts.set(id, (sellerCounts.get(id) ?? 0) + 1);
    });
    const sellerIds = Array.from(sellerCounts.keys())
      .sort((a, b) => (sellerCounts.get(b) ?? 0) - (sellerCounts.get(a) ?? 0))
      .slice(0, 12);

    const { data: sellerRowsRaw } = sellerIds.length
      ? await sb
          .from("profiles")
          .select(
            "user_id, slug, display_name, username, avatar_path, cover_path, verification_tier, reputation_stars, bio, profile_completed_at, banned_at, deleted_at",
          )
          .in("user_id", sellerIds)
      : { data: [] as any[] };

    // Only onboarded, active accounts with published listings are sellers.
    const sellerRows = (sellerRowsRaw ?? []).filter(
      (s: any) => !!s.profile_completed_at && !s.banned_at && !s.deleted_at,
    );

    // "Verified" requires an admin-approved seller verification request.
    const verifiedSellerIds = new Set<string>();
    if (sellerRows.length) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: vRows } = await supabaseAdmin
        .from("seller_verification_requests")
        .select("user_id")
        .eq("status", "approved")
        .in("user_id", sellerRows.map((s: any) => s.user_id as string));
      (vRows ?? []).forEach((v: any) => verifiedSellerIds.add(v.user_id as string));
    }

    // 5. Live category counts (products.category stores the category slug)
    const { data: catCountRows } = await sb
      .from("products")
      .select("category")
      .eq("status", "active")
      .limit(1000);
    const categoryCounts: Record<string, number> = {};
    (catCountRows ?? []).forEach((r) => {
      const c = (r.category as string) ?? "";
      if (!c) return;
      categoryCounts[c] = (categoryCounts[c] ?? 0) + 1;
    });

    const allProductRows = [...(featuredRows ?? []), ...(trendingRows ?? []), ...(newRows ?? [])];
    const uniquePaths = Array.from(new Set(allProductRows.map(r => r.cover_path as string | null)));
    const signedUrls = await signCovers(sb, uniquePaths);
    const urlMap = new Map(uniquePaths.map((p, i) => [p, signedUrls[i]]));

    const mapRow = (r: any) => mapProduct(r, urlMap.get(r.cover_path as string | null) ?? null);

    const sellerAvatars = await signBucket(sb, "avatars", (sellerRows ?? []).map((s: any) => s.avatar_path ?? null));
    const sellerCovers = await signBucket(sb, "profile-covers", (sellerRows ?? []).map((s: any) => s.cover_path ?? null));

    const sellers = await Promise.all((sellerRows ?? []).map(async (s: any, i: number) => {
      const { count: followers } = await sb
        .from("follows")
        .select("follower_id", { count: "exact", head: true })
        .eq("followee_id", s.user_id);
      return {
        id: s.user_id as string,
        name: (s.display_name || s.username || s.slug) as string,
        slug: s.slug as string,
        bio: (s.bio as string) ?? "",
        avatarUrl: sellerAvatars[i] ?? null,
        coverUrl: sellerCovers[i] ?? null,
        verified: verifiedSellerIds.has(s.user_id as string),
        rating: Number(s.reputation_stars ?? 0),
        followersCount: followers ?? 0,
        productsCount: sellerCounts.get(s.user_id as string) ?? 0,
      };
    }));

    sellers.sort((a, b) => b.productsCount - a.productsCount);

    return {
      featured: (featuredRows ?? []).map(mapRow),
      trending: (trendingRows ?? []).map(mapRow),
      newArrivals: (newRows ?? []).map(mapRow),
      topSellers: sellers,
      categoryCounts,
    };
  });



export interface TopSellerDTO {
  id: string;
  name: string;
  slug: string;
  bio: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  verified: boolean;
  rating: number;
  reviewsCount: number;
  followersCount: number;
  productsCount: number;
  salesCount: number;
}

/** Live leaderboard of sellers ranked by paid sales, with live ratings and follower counts. */
export const getTopSellers = createServerFn({ method: "GET" })
  .handler(async (): Promise<TopSellerDTO[]> => {
    const sb = serverPublicClient();

    const { data: productRows } = await sb
      .from("products")
      .select("id, seller_id")
      .eq("status", "active")
      .limit(2000);

    const productsBySeller = new Map<string, string[]>();
    const sellerByProduct = new Map<string, string>();
    (productRows ?? []).forEach((r: any) => {
      const sid = r.seller_id as string;
      if (!sid) return;
      sellerByProduct.set(r.id as string, sid);
      productsBySeller.set(sid, [...(productsBySeller.get(sid) ?? []), r.id as string]);
    });
    const sellerIds = Array.from(productsBySeller.keys()).slice(0, 200);
    if (sellerIds.length === 0) return [];

    // Paid sales per seller (best-effort).
    const salesBySeller = new Map<string, number>();
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: orderRows } = await supabaseAdmin
        .from("orders")
        .select("product_id, quantity, status")
        .in("status", ["paid", "delivered", "completed", "released"])
        .limit(5000);
      (orderRows ?? []).forEach((o: any) => {
        const sid = sellerByProduct.get(o.product_id as string);
        if (!sid) return;
        salesBySeller.set(sid, (salesBySeller.get(sid) ?? 0) + Number(o.quantity ?? 1));
      });
    } catch {
      /* best-effort */
    }

    // Live ratings from product reviews.
    const ratingSum = new Map<string, number>();
    const ratingCount = new Map<string, number>();
    const productIds = Array.from(sellerByProduct.keys()).slice(0, 1000);
    if (productIds.length > 0) {
      const { data: reviewRows } = await sb
        .from("product_reviews")
        .select("product_id, rating")
        .in("product_id", productIds)
        .limit(5000);
      (reviewRows ?? []).forEach((r: any) => {
        const sid = sellerByProduct.get(r.product_id as string);
        if (!sid) return;
        ratingSum.set(sid, (ratingSum.get(sid) ?? 0) + Number(r.rating ?? 0));
        ratingCount.set(sid, (ratingCount.get(sid) ?? 0) + 1);
      });
    }

    const { data: sellerRows } = await sb
      .from("profiles")
      .select(
        "user_id, slug, display_name, username, avatar_path, cover_path, verification_tier, bio, profile_completed_at, banned_at, deleted_at",
      )
      .in("user_id", sellerIds);

    // Only onboarded, active accounts with published listings count as sellers.
    const rows = (sellerRows ?? []).filter(
      (s: any) => !!s.profile_completed_at && !s.banned_at && !s.deleted_at,
    );

    // "Verified" means an admin-approved seller verification request exists.
    const verifiedIds = new Set<string>();
    {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: vRows } = await supabaseAdmin
        .from("seller_verification_requests")
        .select("user_id")
        .eq("status", "approved")
        .in("user_id", rows.map((s: any) => s.user_id as string));
      (vRows ?? []).forEach((v: any) => verifiedIds.add(v.user_id as string));
    }
    const avatars = await signBucket(sb, "avatars", rows.map((s: any) => s.avatar_path ?? null));
    const covers = await signBucket(sb, "profile-covers", rows.map((s: any) => s.cover_path ?? null));

    const followers = new Map<string, number>();
    const { data: followRows } = await sb
      .from("follows")
      .select("followee_id")
      .in("followee_id", sellerIds)
      .limit(10000);
    (followRows ?? []).forEach((f: any) => {
      const id = f.followee_id as string;
      followers.set(id, (followers.get(id) ?? 0) + 1);
    });

    const sellers: TopSellerDTO[] = rows.map((s: any, i: number) => {
      const id = s.user_id as string;
      const count = ratingCount.get(id) ?? 0;
      return {
        id,
        name: (s.display_name || s.username || s.slug) as string,
        slug: s.slug as string,
        bio: (s.bio as string) ?? "",
        avatarUrl: avatars[i] ?? null,
        coverUrl: covers[i] ?? null,
        verified: verifiedIds.has(id),
        rating: count > 0 ? Math.round(((ratingSum.get(id) ?? 0) / count) * 10) / 10 : 0,
        reviewsCount: count,
        followersCount: followers.get(id) ?? 0,
        productsCount: (productsBySeller.get(id) ?? []).length,
        salesCount: salesBySeller.get(id) ?? 0,
      };
    });

    sellers.sort(
      (a, b) => b.salesCount - a.salesCount || b.productsCount - a.productsCount || b.followersCount - a.followersCount,
    );
    return sellers;
  });
