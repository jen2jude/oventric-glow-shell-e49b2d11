import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Read-only admin order surface. It reuses the existing `orders` table — the one
 * authoritative order record — plus the existing coupon-redemption and wallet
 * ledger rows. It performs NO writes: settlement, refunds, payouts and cashback
 * stay inside the hardened payment architecture.
 */
export interface AdminOrderRow {
  id: string;
  createdAt: string;
  paidAt: string | null;
  status: string;
  escrowStatus: string | null;
  disputeStatus: string | null;
  paymentMethod: string | null;
  reference: string | null;
  productName: string | null;
  productId: string | null;
  buyerId: string;
  buyerName: string | null;
  sellerId: string | null;
  sellerName: string | null;
  quantity: number;
  totalUsd: number;
  sellerShareUsd: number | null;
  displayCurrency: string | null;
  displayTotal: number | null;
}

export interface AdminOrderDetail extends AdminOrderRow {
  unitPriceUsd: number | null;
  fxRate: number | null;
  productCategory: string | null;
  productExists: boolean;
  deliveredAt: string | null;
  releasedAt: string | null;
  buyerConfirmedAt: string | null;
  autoReleaseAt: string | null;
  refundedAt: string | null;
  refundReason: string | null;
  deliveryNote: string | null;
  /** Platform share = total − seller share, straight off the settled record. */
  platformShareUsd: number | null;
  coupon: { code: string; discountUsd: number; redeemedAt: string } | null;
  /** Buyer cashback actually posted at settlement (spend-only ledger row). */
  cashbackUsd: number | null;
  cashbackReversedUsd: number | null;
}

const STATUSES = ["ALL", "pending", "paid", "failed", "refunded"] as const;

async function assertManagement(context: { supabase: unknown; userId: string }) {
  // Least privilege: orders carry financial detail, so `content` is excluded —
  // this mirrors SECTION_ACCESS["/admin/orders"] and is enforced server-side.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = context.supabase as any;
  for (const role of ["admin", "finance", "support", "moderator"] as const) {
    const { data, error } = await sb.rpc("has_role", { _user_id: context.userId, _role: role });
    if (error) throw new Error(error.message);
    if (data) return;
  }
  throw new Error("Forbidden: requires one of admin, finance, support, moderator");
}

const SELECT_COLS =
  "id, created_at, paid_at, status, escrow_status, dispute_status, payment_method, paystack_ref, product_id, product_name_snapshot, product_category_snapshot, buyer_id, seller_id, quantity, unit_price_usd, total_usd, seller_share_usd, display_currency, display_total, fx_rate, delivered_at, released_at, buyer_confirmed_at, auto_release_at, refunded_at, refund_reason, delivery_note";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function namesFor(sb: any, ids: string[]) {
  const map = new Map<string, string>();
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return map;
  const { data } = await sb
    .from("profiles")
    .select("user_id, display_name, username")
    .in("user_id", unique);
  for (const p of (data ?? []) as Array<Record<string, unknown>>) {
    map.set(p.user_id as string, ((p.display_name as string) || (p.username as string)) ?? "");
  }
  return map;
}

function mapRow(r: Record<string, unknown>, names: Map<string, string>): AdminOrderRow {
  return {
    id: r.id as string,
    createdAt: r.created_at as string,
    paidAt: (r.paid_at as string) ?? null,
    status: (r.status as string) ?? "pending",
    escrowStatus: (r.escrow_status as string) ?? null,
    disputeStatus: (r.dispute_status as string) ?? null,
    paymentMethod: (r.payment_method as string) ?? null,
    reference: (r.paystack_ref as string) ?? null,
    productName: (r.product_name_snapshot as string) ?? null,
    productId: (r.product_id as string) ?? null,
    buyerId: r.buyer_id as string,
    buyerName: names.get(r.buyer_id as string) || null,
    sellerId: (r.seller_id as string) ?? null,
    sellerName: r.seller_id ? names.get(r.seller_id as string) || null : null,
    quantity: Number(r.quantity ?? 1),
    totalUsd: Number(r.total_usd ?? 0),
    sellerShareUsd: r.seller_share_usd == null ? null : Number(r.seller_share_usd),
    displayCurrency: (r.display_currency as string) ?? null,
    displayTotal: r.display_total == null ? null : Number(r.display_total),
  };
}

export const adminListOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (i: {
      status?: string;
      q?: string;
      escrow?: string;
      dispute?: string;
      from?: string;
      to?: string;
    }) => ({
      status: (STATUSES as readonly string[]).includes(String(i?.status))
        ? String(i!.status)
        : "ALL",
      q: typeof i?.q === "string" ? i.q.trim().slice(0, 120) : "",
      escrow: typeof i?.escrow === "string" ? i.escrow.trim().slice(0, 32) : "",
      dispute: typeof i?.dispute === "string" ? i.dispute.trim().slice(0, 32) : "",
      from: typeof i?.from === "string" ? i.from.slice(0, 10) : "",
      to: typeof i?.to === "string" ? i.to.slice(0, 10) : "",
    }),
  )
  .handler(async ({ data, context }): Promise<AdminOrderRow[]> => {
    await assertManagement(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabaseAdmin as any;

    // A buyer/seller search term resolves to user IDs first, so admins can
    // search by handle or display name without exposing a join to the client.
    let userIds: string[] = [];
    if (data.q) {
      const { data: profs } = await sb
        .from("profiles")
        .select("user_id")
        .or(`username.ilike.%${data.q}%,display_name.ilike.%${data.q}%`)
        .limit(50);
      userIds = ((profs ?? []) as Array<{ user_id: string }>).map((p) => p.user_id);
    }

    let q = sb.from("orders").select(SELECT_COLS).order("created_at", { ascending: false }).limit(300);

    if (data.status !== "ALL") q = q.eq("status", data.status);
    if (data.escrow) q = q.eq("escrow_status", data.escrow);
    if (data.dispute) q = q.eq("dispute_status", data.dispute);
    if (data.from) q = q.gte("created_at", `${data.from}T00:00:00Z`);
    if (data.to) q = q.lte("created_at", `${data.to}T23:59:59Z`);
    if (data.q) {
      const ors = [
        `paystack_ref.ilike.%${data.q}%`,
        `product_name_snapshot.ilike.%${data.q}%`,
        ...userIds.flatMap((id) => [`buyer_id.eq.${id}`, `seller_id.eq.${id}`]),
      ];
      q = q.or(ors.join(","));
    }

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const names = await namesFor(
      sb,
      ((rows ?? []) as Array<Record<string, unknown>>).flatMap((r) =>
        [r.buyer_id, r.seller_id].filter(Boolean),
      ) as string[],
    );
    return ((rows ?? []) as Array<Record<string, unknown>>).map((r) => mapRow(r, names));
  });

export const adminGetOrderDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => ({ id: String(i?.id ?? "") }))
  .handler(async ({ data, context }): Promise<AdminOrderDetail> => {
    await assertManagement(context);
    if (!data.id) throw new Error("Order id required");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabaseAdmin as any;

    const { data: row, error } = await sb
      .from("orders")
      .select(SELECT_COLS)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Order not found");

    const names = await namesFor(sb, [row.buyer_id, row.seller_id].filter(Boolean) as string[]);
    const base = mapRow(row as Record<string, unknown>, names);

    // Coupon + cashback are read back from the records settlement actually wrote,
    // never recomputed here.
    const reference = (row.paystack_ref as string) ?? null;
    let coupon: AdminOrderDetail["coupon"] = null;
    if (reference || row.id) {
      const { data: red } = await sb
        .from("coupon_redemptions")
        .select("coupon_code, discount_usd, created_at")
        .or(`order_id.eq.${row.id}${reference ? `,reference.eq.${reference}` : ""}`)
        .maybeSingle();
      if (red)
        coupon = {
          code: red.coupon_code as string,
          discountUsd: Number(red.discount_usd ?? 0),
          redeemedAt: red.created_at as string,
        };
    }

    let cashbackUsd: number | null = null;
    let cashbackReversedUsd: number | null = null;
    if (reference) {
      const { data: cb } = await sb
        .from("wallet_transactions")
        .select("tx_hash, amount")
        .in("tx_hash", [`${reference}-CB`, `${row.id}-CBREV`]);
      for (const t of (cb ?? []) as Array<{ tx_hash: string; amount: number }>) {
        if (t.tx_hash.endsWith("-CB")) cashbackUsd = Number(t.amount);
        if (t.tx_hash.endsWith("-CBREV")) cashbackReversedUsd = Number(t.amount);
      }
    }

    let productExists = false;
    if (row.product_id) {
      const { count } = await sb
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("id", row.product_id);
      productExists = (count ?? 0) > 0;
    }

    const total = base.totalUsd;
    const sellerShare = base.sellerShareUsd;

    return {
      ...base,
      unitPriceUsd: row.unit_price_usd == null ? null : Number(row.unit_price_usd),
      fxRate: row.fx_rate == null ? null : Number(row.fx_rate),
      productCategory: (row.product_category_snapshot as string) ?? null,
      productExists,
      deliveredAt: (row.delivered_at as string) ?? null,
      releasedAt: (row.released_at as string) ?? null,
      buyerConfirmedAt: (row.buyer_confirmed_at as string) ?? null,
      autoReleaseAt: (row.auto_release_at as string) ?? null,
      refundedAt: (row.refunded_at as string) ?? null,
      refundReason: (row.refund_reason as string) ?? null,
      deliveryNote: (row.delivery_note as string) ?? null,
      platformShareUsd:
        sellerShare == null ? null : Number(Math.max(0, total - sellerShare).toFixed(2)),
      coupon,
      cashbackUsd,
      cashbackReversedUsd,
    };
  });
