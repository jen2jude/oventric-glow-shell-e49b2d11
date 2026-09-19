import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { OrderCurrency } from "@/lib/marketplace.functions";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface EscrowInboxItem {
  orderId: string;
  role: "buyer" | "seller";
  productId: string;
  productName: string;
  counterpartyId: string;
  counterpartyName: string;
  quantity: number;
  displayCurrency: OrderCurrency;
  displayTotal: number;
  totalUSD: number;
  sellerShareUSD: number;
  requiresManualDelivery: boolean;
  escrowStatus: "held" | "released" | "refunded";
  status: string;
  createdAt: string;
  paidAt: string | null;
  deliveredAt: string | null;
  buyerConfirmedAt: string | null;
  releasedAt: string | null;
  autoRefundAt: string | null;
  autoReleaseAt: string | null;
  payoutReleaseAt: string | null;
  disputeStatus: string;
  lastMessage: {
    body: string;
    createdAt: string;
    fromMe: boolean;
    unread: boolean;
  } | null;
}

const ORDER_COLS =
  "id, buyer_id, seller_id, product_id, quantity, display_currency, display_total, total_usd, seller_share_usd, escrow_status, status, created_at, paid_at, delivered_at, buyer_confirmed_at, released_at, auto_refund_at, auto_release_at, payout_release_at, dispute_status, products:product_id (name, requires_manual_delivery)";

/**
 * Every order the signed-in user is a party to, as buyer or seller, with the
 * latest order-tagged chat message. Read-only: all escrow state stays server
 * authoritative and is never recomputed here.
 */
export const listEscrowInbox = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EscrowInboxItem[]> => {
    const { admin, settleDueForUser } = await import("@/lib/fulfilment.server");
    const sb = await admin();
    const me = context.userId;

    // Apply any escrow clock that matured since the last visit before reading.
    await settleDueForUser(sb, me);

    const { data, error } = await sb
      .from("orders")
      .select(ORDER_COLS)
      .or(`buyer_id.eq.${me},seller_id.eq.${me}`)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as Record<string, any>[];
    if (!rows.length) return [];

    const others = [
      ...new Set(rows.map((r) => (r.buyer_id === me ? r.seller_id : r.buyer_id) as string)),
    ];
    const nameMap = new Map<string, string>();
    if (others.length) {
      const { data: profs } = await sb
        .from("profiles")
        .select("user_id, display_name, username, shop_name")
        .in("user_id", others);
      for (const p of (profs ?? []) as Record<string, any>[]) {
        nameMap.set(p.user_id, p.shop_name || p.display_name || p.username || "Oventric user");
      }
    }

    // Latest order-tagged message per order.
    const orderIds = rows.map((r) => r.id as string);
    const msgMap = new Map<string, Record<string, any>>();
    const { data: msgs } = await sb
      .from("direct_messages")
      .select("order_id, sender_id, body, created_at, read_at")
      .in("order_id", orderIds)
      .order("created_at", { ascending: false })
      .limit(1000);
    for (const m of (msgs ?? []) as Record<string, any>[]) {
      if (!msgMap.has(m.order_id)) msgMap.set(m.order_id, m);
    }

    return rows.map((r) => {
      const role: "buyer" | "seller" = r.buyer_id === me ? "buyer" : "seller";
      const other = (role === "buyer" ? r.seller_id : r.buyer_id) as string;
      const m = msgMap.get(r.id as string);
      return {
        orderId: r.id,
        role,
        productId: r.product_id,
        productName: (r.products?.name as string) ?? "Product",
        counterpartyId: other,
        counterpartyName: nameMap.get(other) ?? "Oventric user",
        quantity: Number(r.quantity ?? 1),
        displayCurrency: (r.display_currency ?? "USD") as OrderCurrency,
        displayTotal: Number(r.display_total ?? 0),
        totalUSD: Number(r.total_usd ?? 0),
        sellerShareUSD: Number(r.seller_share_usd ?? 0),
        requiresManualDelivery: Boolean(r.products?.requires_manual_delivery),
        escrowStatus: (r.escrow_status ?? "released") as "held" | "released" | "refunded",
        status: String(r.status ?? "paid"),
        createdAt: r.created_at,
        paidAt: r.paid_at ?? null,
        deliveredAt: r.delivered_at ?? null,
        buyerConfirmedAt: r.buyer_confirmed_at ?? null,
        releasedAt: r.released_at ?? null,
        autoRefundAt: r.auto_refund_at ?? null,
        autoReleaseAt: r.auto_release_at ?? null,
        payoutReleaseAt: r.payout_release_at ?? null,
        disputeStatus: String(r.dispute_status ?? "none"),
        lastMessage: m
          ? {
              body: String(m.body ?? "").slice(0, 300),
              createdAt: m.created_at,
              fromMe: m.sender_id === me,
              unread: m.sender_id !== me && !m.read_at,
            }
          : null,
      };
    });
  });
