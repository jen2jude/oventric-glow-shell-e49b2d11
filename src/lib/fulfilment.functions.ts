import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { OrderCurrency } from "@/lib/marketplace.functions";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type StepState = "done" | "active" | "pending" | "blocked";

export interface FulfilmentStep {
  key: "paid" | "delivered" | "confirmed" | "completed";
  label: string;
  hint: string;
  state: StepState;
  at: string | null;
}

export interface FulfilmentParty {
  id: string;
  name: string;
  slug: string;
  avatarUrl: string | null;
}

export interface DisputeDTO {
  id: string;
  reason: string;
  details: string | null;
  status: string;
  adminNote: string | null;
  imageUrls: string[];
  createdAt: string;
  resolvedAt: string | null;
}

export interface FulfilmentDTO {
  orderId: string;
  productId: string;
  productName: string;
  quantity: number;
  displayCurrency: OrderCurrency;
  displayTotal: number;
  totalUSD: number;
  sellerShareUSD: number;
  status: string;
  paidAt: string | null;
  createdAt: string;
  requiresManualDelivery: boolean;
  escrowStatus: "held" | "released" | "refunded";
  deliveredAt: string | null;
  deliveryNote: string | null;
  buyerConfirmedAt: string | null;
  releasedAt: string | null;
  autoReleaseAt: string | null;
  autoRefundAt: string | null;
  payoutReleaseAt: string | null;
  refundedAt: string | null;
  disputeStatus: string;
  role: "buyer" | "seller" | "admin";
  buyer: FulfilmentParty;
  seller: FulfilmentParty;
  dispute: DisputeDTO | null;
  steps: FulfilmentStep[];
}

async function party(sb: any, userId: string): Promise<FulfilmentParty> {
  const { data: p } = await sb
    .from("profiles")
    .select("user_id, display_name, username, slug, avatar_path")
    .eq("user_id", userId)
    .maybeSingle();
  let avatarUrl: string | null = null;
  if (p?.avatar_path) {
    const { data: sig } = await sb.storage.from("avatars").createSignedUrl(p.avatar_path, 60 * 60 * 24);
    avatarUrl = sig?.signedUrl ?? null;
  }
  return {
    id: userId,
    name: p?.display_name || p?.username || "Oventric user",
    slug: p?.slug ?? userId,
    avatarUrl,
  };
}

function buildSteps(o: Record<string, any>, manual: boolean): FulfilmentStep[] {
  const paidAt = o.paid_at ?? o.created_at;
  const delivered = manual ? o.delivered_at : paidAt;
  const confirmed = manual ? o.buyer_confirmed_at : paidAt;
  const completed = o.escrow_status === "released" ? o.released_at ?? confirmed : null;
  const refunded = o.escrow_status === "refunded";
  const disputed = o.dispute_status === "open";

  const state = (done: unknown, prevDone: unknown): StepState =>
    done ? "done" : disputed ? "blocked" : prevDone ? "active" : "pending";

  return [
    {
      key: "paid",
      label: "Payment received",
      hint: "The system verified your payment and secured the funds.",
      state: paidAt ? "done" : "active",
      at: paidAt ?? null,
    },
    {
      key: "delivered",
      label: delivered ? "Product delivered" : "Awaiting delivery by seller",
      hint: manual
        ? "The seller has 24 hours to deliver, or the payment is refunded automatically."
        : "Instant download — delivered the moment payment cleared.",
      state: state(delivered, paidAt),
      at: delivered ?? null,
    },
    {
      key: "confirmed",
      label: confirmed ? "Receipt confirmed" : "Buyer to confirm receipt",
      hint: "Buyer confirms the item was received and works. Auto-confirms 24 hours after delivery.",
      state: state(confirmed, delivered),
      at: confirmed ?? null,
    },
    {
      key: "completed",
      label: refunded
        ? "Refunded to buyer"
        : completed
          ? "Trade circle complete"
          : "24-hour payout hold",
      hint: refunded
        ? "The delivery window closed, so the payment went back to the buyer's wallet."
        : "Funds stay in escrow for 24 hours after confirmation, then the seller is paid.",
      state: state(completed, confirmed),
      at: completed ?? null,
    },
  ];
}

/** Buyer / seller / admin view of an order's fulfilment roadmap. */
export const getOrderFulfilment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<FulfilmentDTO> => {
    const { admin, releaseEscrow, refundBuyer, confirmReceipt } = await import("@/lib/fulfilment.server");
    const sb = await admin();

    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });

    let { data: o, error } = await sb
      .from("orders")
      .select(
        "id, buyer_id, seller_id, product_id, quantity, total_usd, display_currency, display_total, seller_share_usd, status, paid_at, created_at, escrow_status, delivered_at, delivery_note, buyer_confirmed_at, released_at, auto_release_at, auto_refund_at, payout_release_at, refunded_at, dispute_status, products:product_id (name, requires_manual_delivery)",
      )
      .eq("id", data.orderId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!o) throw new Error("Order not found");

    const isBuyer = o.buyer_id === context.userId;
    const isSeller = o.seller_id === context.userId;
    if (!isBuyer && !isSeller && !isAdmin) throw new Error("Not your order");

    // Lazy timer sweep — the escrow clocks may have elapsed since the last visit.
    if (o.escrow_status === "held" && o.dispute_status === "none") {
      const due = (iso: string | null | undefined) =>
        Boolean(iso) && new Date(iso as string).getTime() <= Date.now();
      try {
        let moved = false;
        if (!o.delivered_at && due(o.auto_refund_at)) {
          await refundBuyer(sb, o.id, "seller_missed_delivery_window");
          moved = true;
        } else if (o.delivered_at && !o.buyer_confirmed_at && due(o.auto_release_at)) {
          await confirmReceipt(sb, o.id, null, "auto");
          moved = true;
        }
        if (!moved && due(o.payout_release_at)) {
          await releaseEscrow(sb, o.id, null, "auto");
          moved = true;
        }
        if (moved) {
          const { data: fresh } = await sb
            .from("orders")
            .select(
              "id, buyer_id, seller_id, product_id, quantity, total_usd, display_currency, display_total, seller_share_usd, status, paid_at, created_at, escrow_status, delivered_at, delivery_note, buyer_confirmed_at, released_at, auto_release_at, auto_refund_at, payout_release_at, refunded_at, dispute_status, products:product_id (name, requires_manual_delivery)",
            )
            .eq("id", o.id)
            .maybeSingle();
          if (fresh) o = fresh;
        }
      } catch (e) {
        console.error("[getOrderFulfilment] timer sweep failed", e);
      }
    }

    const manual = Boolean(o.products?.requires_manual_delivery);

    const { data: dRow } = await sb
      .from("order_disputes")
      .select("id, reason, details, status, admin_note, image_paths, created_at, resolved_at")
      .eq("order_id", o.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let dispute: DisputeDTO | null = null;
    if (dRow) {
      const urls: string[] = [];
      for (const p of (dRow.image_paths ?? []) as string[]) {
        const { data: sig } = await sb.storage.from("post-media").createSignedUrl(p, 60 * 60 * 6);
        if (sig?.signedUrl) urls.push(sig.signedUrl);
      }
      dispute = {
        id: dRow.id,
        reason: dRow.reason,
        details: dRow.details ?? null,
        status: dRow.status,
        adminNote: dRow.admin_note ?? null,
        imageUrls: urls,
        createdAt: dRow.created_at,
        resolvedAt: dRow.resolved_at ?? null,
      };
    }

    return {
      orderId: o.id,
      productId: o.product_id,
      productName: (o.products?.name as string) ?? "Digital product",
      quantity: Number(o.quantity ?? 1),
      displayCurrency: (o.display_currency ?? "USD") as OrderCurrency,
      displayTotal: Number(o.display_total ?? 0),
      totalUSD: Number(o.total_usd ?? 0),
      sellerShareUSD: Number(o.seller_share_usd ?? 0),
      status: o.status,
      paidAt: o.paid_at ?? null,
      createdAt: o.created_at,
      requiresManualDelivery: manual,
      escrowStatus: (o.escrow_status ?? "released") as "held" | "released" | "refunded",
      deliveredAt: o.delivered_at ?? null,
      deliveryNote: o.delivery_note ?? null,
      buyerConfirmedAt: o.buyer_confirmed_at ?? null,
      releasedAt: o.released_at ?? null,
      autoReleaseAt: o.auto_release_at ?? null,
      autoRefundAt: o.auto_refund_at ?? null,
      payoutReleaseAt: o.payout_release_at ?? null,
      refundedAt: o.refunded_at ?? null,
      disputeStatus: o.dispute_status ?? "none",
      role: isBuyer ? "buyer" : isSeller ? "seller" : "admin",
      buyer: await party(sb, o.buyer_id),
      seller: await party(sb, o.seller_id),
      dispute,
      steps: buildSteps(o, manual),
    };
  });

/** Seller marks a manual-delivery order as delivered. Starts the 48h clock. */
export const markOrderDelivered = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ orderId: z.string().uuid(), note: z.string().trim().max(1000).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, notify, sendEmail, CONFIRM_WINDOW_HOURS } = await import("@/lib/fulfilment.server");
    const sb = await admin();
    const { data: o, error } = await sb
      .from("orders")
      .select("id, buyer_id, seller_id, delivered_at, escrow_status, products:product_id (name)")
      .eq("id", data.orderId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!o) throw new Error("Order not found");
    if (o.seller_id !== context.userId) throw new Error("Only the seller can mark this delivered");
    if (o.delivered_at) return { alreadyDelivered: true as const };

    const now = new Date();
    const autoAt = new Date(now.getTime() + CONFIRM_WINDOW_HOURS * 3600 * 1000).toISOString();
    await sb
      .from("orders")
      .update({
        delivered_at: now.toISOString(),
        delivered_by: context.userId,
        delivery_note: data.note ?? null,
        auto_release_at: autoAt,
        auto_refund_at: null,
      })
      .eq("id", data.orderId);

    const name = (o.products?.name as string) ?? "your order";
    // Deliver the hand-off inside the platform chat so the trade stays on
    // Oventric and stays protected by escrow.
    const chatBody =
      `✅ Delivered — "${name}"\n\n` +
      (data.note ? `${data.note}\n\n` : "") +
      `Please check it over and tap "Confirm receipt" to release the escrowed payment. ` +
      `It auto-confirms in ${CONFIRM_WINDOW_HOURS} hours if you don't act. ` +
      `Keep everything in this chat — we can only mediate trades completed on Oventric.`;
    try {
      await sb.from("direct_messages").insert({
        sender_id: context.userId,
        recipient_id: o.buyer_id,
        body: chatBody,
        order_id: data.orderId,
      });
    } catch (e) {
      console.error("[markOrderDelivered] delivery DM failed", e);
    }
    await notify(sb, [
      {
        user_id: o.buyer_id,
        kind: "order_delivered",
        title: "Seller marked your order delivered",
        body: `"${name}" was marked delivered. Confirm receipt to release payment — it auto-confirms in ${CONFIRM_WINDOW_HOURS} hours.`,
        link: `/order/${data.orderId}`,
        from_user_id: context.userId,
      },
    ]);
    await sendEmail(
      sb,
      o.buyer_id,
      `Your order "${name}" was marked delivered`,
      [
        `The seller marked "${name}" as delivered on Oventric.`,
        `Confirm delivery in your chat to complete the trade, or report an issue if something is wrong. It auto-confirms in ${CONFIRM_WINDOW_HOURS} hours.`,
      ],
      `/order/${data.orderId}`,
    );
    return { alreadyDelivered: false as const, autoReleaseAt: autoAt };
  });

/** Buyer confirms receipt — releases escrow and notifies seller + admins. */
export const buyerConfirmReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, confirmReceipt } = await import("@/lib/fulfilment.server");
    const sb = await admin();
    const { data: o } = await sb
      .from("orders")
      .select("id, buyer_id, delivered_at")
      .eq("id", data.orderId)
      .maybeSingle();
    if (!o) throw new Error("Order not found");
    if (o.buyer_id !== context.userId) throw new Error("Not your order");
    return confirmReceipt(sb, data.orderId, context.userId, "buyer");
  });

/** Signed upload slot for a dispute evidence image (private post-media bucket). */
export const getDisputeUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ filename: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin } = await import("@/lib/fulfilment.server");
    const sb = await admin();
    const safe = data.filename.replace(/[^a-zA-Z0-9._-]/g, "_") || "file";
    const path = `disputes/${context.userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
    const { data: signed, error } = await sb.storage.from("post-media").createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    return { path, token: signed.token as string, signedUrl: signed.signedUrl as string };
  });

/** Buyer opens a dispute against a trade. Freezes escrow and alerts admins. */
export const openOrderDispute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        orderId: z.string().uuid(),
        reason: z.enum(["not_delivered", "wrong_item", "not_working", "seller_unreachable", "other"]),
        details: z.string().trim().min(10).max(2000),
        imagePaths: z.array(z.string().max(500)).max(5).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, notify, adminUserIds, sendChat, sendEmail } = await import("@/lib/fulfilment.server");
    const sb = await admin();
    const { data: o } = await sb
      .from("orders")
      .select("id, buyer_id, seller_id, dispute_status, products:product_id (name)")
      .eq("id", data.orderId)
      .maybeSingle();
    if (!o) throw new Error("Order not found");
    if (o.buyer_id !== context.userId) throw new Error("Only the buyer can open a dispute");
    if (o.dispute_status === "open") throw new Error("A dispute is already open on this order");

    const { data: row, error } = await sb
      .from("order_disputes")
      .insert({
        order_id: data.orderId,
        opened_by: context.userId,
        against_user_id: o.seller_id,
        reason: data.reason,
        details: data.details,
        image_paths: data.imagePaths ?? [],
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await sb.from("orders").update({ dispute_status: "open" }).eq("id", data.orderId);

    const name = (o.products?.name as string) ?? "an order";
    const admins = await adminUserIds(sb);
    await notify(sb, [
      ...admins.map((uid) => ({
        user_id: uid,
        kind: "order_dispute_opened",
        title: "New marketplace dispute",
        body: `A buyer opened a dispute on "${name}" (order ${data.orderId.slice(0, 8)}). Funds are frozen.`,
        link: `/admin/disputes`,
        from_user_id: context.userId,
      })),
      {
        user_id: o.seller_id,
        kind: "order_dispute_opened",
        title: "A dispute was opened on your sale",
        body: `The buyer raised an issue with "${name}". Our team will review it.`,
        link: `/order/${data.orderId}`,
        from_user_id: context.userId,
      },
    ]);

    const reasonLabel: Record<string, string> = {
      not_delivered: "I never received the item",
      wrong_item: "I received the wrong item",
      not_working: "Received, but it isn't working",
      seller_unreachable: "The seller isn't replying",
      other: "Something else",
    };
    const label = reasonLabel[data.reason] ?? data.reason;
    await sendChat(
      sb,
      context.userId,
      o.seller_id,
      data.orderId,
      `⚠️ Issue reported — "${name}"\n\nReason: ${label}\n\n${data.details}\n\n` +
        `${(data.imagePaths ?? []).length} image(s) were attached as proof. ` +
        `Escrow on this order is frozen while our team reviews it. Please respond here as soon as you can — resolving it in chat is the fastest way to close the dispute.`,
    );
    await sendEmail(
      sb,
      o.seller_id,
      `A buyer reported an issue with "${name}"`,
      [
        `Reason: ${label}`,
        data.details,
        "The payment for this order is frozen until the issue is resolved. Reply to the buyer in your Oventric chat as soon as possible.",
      ],
      `/order/${data.orderId}`,
    );
    return { id: row.id as string };
  });

/** Seller-side order book (their sales awaiting delivery / confirmation). */
export interface SaleDTO {
  orderId: string;
  productId: string;
  productName: string;
  buyerName: string;
  buyerId: string;
  quantity: number;
  displayCurrency: OrderCurrency;
  displayTotal: number;
  sellerShareUSD: number;
  requiresManualDelivery: boolean;
  escrowStatus: string;
  deliveredAt: string | null;
  buyerConfirmedAt: string | null;
  autoReleaseAt: string | null;
  disputeStatus: string;
  createdAt: string;
}

export const listMySales = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SaleDTO[]> => {
    const { admin } = await import("@/lib/fulfilment.server");
    const sb = await admin();
    const { data, error } = await sb
      .from("orders")
      .select(
        "id, buyer_id, product_id, quantity, display_currency, display_total, seller_share_usd, escrow_status, delivered_at, buyer_confirmed_at, auto_release_at, dispute_status, created_at, products:product_id (name, requires_manual_delivery)",
      )
      .eq("seller_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Record<string, any>[];
    const buyerIds = [...new Set(rows.map((r) => r.buyer_id as string))];
    const nameMap = new Map<string, string>();
    if (buyerIds.length) {
      const { data: profs } = await sb
        .from("profiles")
        .select("user_id, display_name, username")
        .in("user_id", buyerIds);
      for (const p of (profs ?? []) as Record<string, any>[]) {
        nameMap.set(p.user_id, p.display_name || p.username || "Buyer");
      }
    }
    return rows.map((r) => ({
      orderId: r.id,
      productId: r.product_id,
      productName: (r.products?.name as string) ?? "Product",
      buyerName: nameMap.get(r.buyer_id) ?? "Buyer",
      buyerId: r.buyer_id,
      quantity: Number(r.quantity ?? 1),
      displayCurrency: (r.display_currency ?? "USD") as OrderCurrency,
      displayTotal: Number(r.display_total ?? 0),
      sellerShareUSD: Number(r.seller_share_usd ?? 0),
      requiresManualDelivery: Boolean(r.products?.requires_manual_delivery),
      escrowStatus: r.escrow_status ?? "released",
      deliveredAt: r.delivered_at ?? null,
      buyerConfirmedAt: r.buyer_confirmed_at ?? null,
      autoReleaseAt: r.auto_release_at ?? null,
      disputeStatus: r.dispute_status ?? "none",
      createdAt: r.created_at,
    }));
  });

/** ---------- Admin ---------- */
export interface AdminDisputeDTO {
  id: string;
  orderId: string;
  productName: string;
  reason: string;
  details: string | null;
  status: string;
  adminNote: string | null;
  imageUrls: string[];
  buyerName: string;
  sellerName: string;
  sellerShareUSD: number;
  escrowStatus: string;
  createdAt: string;
}

export const listOrderDisputes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminDisputeDTO[]> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { admin } = await import("@/lib/fulfilment.server");
    const sb = await admin();
    const { data, error } = await sb
      .from("order_disputes")
      .select("id, order_id, opened_by, against_user_id, reason, details, status, admin_note, image_paths, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Record<string, any>[];
    const orderIds = [...new Set(rows.map((r) => r.order_id as string))];
    const userIds = [...new Set(rows.flatMap((r) => [r.opened_by, r.against_user_id].filter(Boolean)))] as string[];

    const orderMap = new Map<string, Record<string, any>>();
    if (orderIds.length) {
      const { data: os } = await sb
        .from("orders")
        .select("id, seller_share_usd, escrow_status, products:product_id (name)")
        .in("id", orderIds);
      for (const o of (os ?? []) as Record<string, any>[]) orderMap.set(o.id, o);
    }
    const nameMap = new Map<string, string>();
    if (userIds.length) {
      const { data: profs } = await sb.from("profiles").select("user_id, display_name, username").in("user_id", userIds);
      for (const p of (profs ?? []) as Record<string, any>[]) {
        nameMap.set(p.user_id, p.display_name || p.username || "User");
      }
    }

    const out: AdminDisputeDTO[] = [];
    for (const r of rows) {
      const urls: string[] = [];
      for (const p of (r.image_paths ?? []) as string[]) {
        const { data: sig } = await sb.storage.from("post-media").createSignedUrl(p, 60 * 60 * 6);
        if (sig?.signedUrl) urls.push(sig.signedUrl);
      }
      const o = orderMap.get(r.order_id) ?? {};
      out.push({
        id: r.id,
        orderId: r.order_id,
        productName: (o.products?.name as string) ?? "Product",
        reason: r.reason,
        details: r.details ?? null,
        status: r.status,
        adminNote: r.admin_note ?? null,
        imageUrls: urls,
        buyerName: nameMap.get(r.opened_by) ?? "Buyer",
        sellerName: r.against_user_id ? nameMap.get(r.against_user_id) ?? "Seller" : "Seller",
        sellerShareUSD: Number(o.seller_share_usd ?? 0),
        escrowStatus: (o.escrow_status as string) ?? "released",
        createdAt: r.created_at,
      });
    }
    return out;
  });

/** Admin resolves a dispute — either release funds to seller or refund the buyer. */
export const resolveOrderDispute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        disputeId: z.string().uuid(),
        outcome: z.enum(["release_seller", "refund_buyer", "dismiss"]),
        note: z.string().trim().max(2000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { admin, notify, releaseEscrow, refundBuyer } = await import("@/lib/fulfilment.server");
    const sb = await admin();

    const { data: d0 } = await sb
      .from("order_disputes")
      .select("id, order_id, opened_by, against_user_id, status")
      .eq("id", data.disputeId)
      .maybeSingle();
    if (!d0) throw new Error("Dispute not found");
    if (d0.status !== "open") return { alreadyResolved: true as const };

    const { data: o } = await sb
      .from("orders")
      .select("id, buyer_id, seller_id, escrow_status, seller_share_usd, display_currency, display_total")
      .eq("id", d0.order_id)
      .maybeSingle();
    if (!o) throw new Error("Order not found");

    if (data.outcome === "refund_buyer" && o.escrow_status === "held") {
      // Reuse the single refund path: it is idempotent, posts the ledger entry,
      // reverses cashback/referral credit and notifies both parties.
      await refundBuyer(sb, o.id, "dispute_resolved_refund");
      await sb
        .from("orders")
        .update({ released_at: new Date().toISOString(), released_by: context.userId })
        .eq("id", o.id);
    }

    await sb
      .from("orders")
      .update({ dispute_status: data.outcome === "dismiss" ? "none" : "resolved" })
      .eq("id", o.id);

    if (data.outcome === "release_seller" || data.outcome === "dismiss") {
      try {
        await releaseEscrow(sb, o.id, context.userId, "admin");
      } catch (e) {
        console.error("[resolveOrderDispute] release failed", e);
      }
    }

    await sb
      .from("order_disputes")
      .update({
        status: data.outcome === "dismiss" ? "dismissed" : "resolved",
        admin_note: data.note ?? null,
        resolved_at: new Date().toISOString(),
        resolved_by: context.userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.disputeId);

    await notify(sb, [
      {
        user_id: o.buyer_id,
        kind: "order_dispute_resolved",
        title: "Your dispute was reviewed",
        body: data.note?.trim() || `Outcome: ${data.outcome.replace("_", " ")}.`,
        link: `/order/${o.id}`,
      },
      {
        user_id: o.seller_id,
        kind: "order_dispute_resolved",
        title: "A dispute on your sale was reviewed",
        body: data.note?.trim() || `Outcome: ${data.outcome.replace("_", " ")}.`,
        link: `/order/${o.id}`,
      },
    ]);

    return { alreadyResolved: false as const };
  });
