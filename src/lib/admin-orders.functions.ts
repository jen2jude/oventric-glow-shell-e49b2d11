import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Read-only admin order listing. Reuses the existing `orders` table — the one
 * authoritative order record — and performs no writes of any kind.
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

const STATUSES = ["ALL", "pending", "paid", "failed", "refunded"] as const;

export const adminListOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { status?: string; q?: string }) => ({
    status: (STATUSES as readonly string[]).includes(String(i?.status)) ? String(i!.status) : "ALL",
    q: typeof i?.q === "string" ? i.q.trim().slice(0, 120) : "",
  }))
  .handler(async ({ data, context }): Promise<AdminOrderRow[]> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { data: allowed, error: rErr } = await sb.rpc("has_any_management_role", {
      _user_id: context.userId,
    });
    if (rErr) throw new Error(rErr.message);
    if (!allowed) throw new Error("Forbidden: management role required");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (supabaseAdmin as any)
      .from("orders")
      .select(
        "id, created_at, paid_at, status, escrow_status, dispute_status, payment_method, paystack_ref, product_id, product_name_snapshot, buyer_id, seller_id, quantity, total_usd, seller_share_usd, display_currency, display_total",
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (data.status !== "ALL") q = q.eq("status", data.status);
    if (data.q) q = q.or(`paystack_ref.ilike.%${data.q}%,product_name_snapshot.ilike.%${data.q}%`);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const ids = Array.from(
      new Set(
        (rows ?? []).flatMap((r: Record<string, unknown>) =>
          [r.buyer_id, r.seller_id].filter(Boolean),
        ),
      ),
    ) as string[];

    const names = new Map<string, string>();
    if (ids.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profs } = await (supabaseAdmin as any)
        .from("profiles")
        .select("user_id, display_name, username")
        .in("user_id", ids);
      for (const p of (profs ?? []) as Array<Record<string, unknown>>) {
        names.set(
          p.user_id as string,
          ((p.display_name as string) || (p.username as string)) ?? "",
        );
      }
    }

    return ((rows ?? []) as Array<Record<string, unknown>>).map((r) => ({
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
    }));
  });
