/**
 * Server-only helpers for the marketplace payment-fulfilment roadmap.
 * Never import this from a component — only from `.handler()` bodies.
 *
 * Escrow state machine (manual-delivery orders):
 *
 *   paid ──(seller marks delivered)──▶ delivered ──(buyer confirms)──▶ confirmed ──▶ released
 *     │                                    │
 *     │ 24h with no delivery               │ 24h with no buyer action
 *     ▼                                    ▼
 *   refunded to buyer                 auto-confirmed (seller wins)
 *
 * A confirmed order still sits in escrow for a further 24h payout hold before
 * the seller share is credited. An open dispute freezes every timer.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

/** Seller must deliver within this many hours of payment, or the buyer is refunded. */
export const DELIVER_DEADLINE_HOURS = 24;
/** Buyer has this long after delivery to confirm or report an issue. */
export const CONFIRM_WINDOW_HOURS = 24;
/** Funds stay held this long after confirmation before the seller is paid. */
export const PAYOUT_HOLD_HOURS = 24;
/** Legacy alias kept for existing copy/imports. */
export const AUTO_RELEASE_HOURS = CONFIRM_WINDOW_HOURS;

export const hoursFromNow = (h: number) => new Date(Date.now() + h * 3600 * 1000).toISOString();

export async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export async function adminUserIds(sb: any): Promise<string[]> {
  const { data } = await sb.from("user_roles").select("user_id").eq("role", "admin");
  return ((data ?? []) as Array<{ user_id: string }>).map((r) => r.user_id);
}

export async function notify(
  sb: any,
  rows: Array<{
    user_id: string;
    kind: string;
    title: string;
    body: string;
    link?: string | null;
    from_user_id?: string | null;
  }>,
) {
  if (!rows.length) return;
  try {
    await sb.from("notifications").insert(
      rows.map((r) => ({ ...r, link: r.link ?? null, from_user_id: r.from_user_id ?? null })),
    );
  } catch (e) {
    console.error("[fulfilment] notify failed", e);
  }
}

/** Post an order-tagged direct message. Never throws. */
export async function sendChat(
  sb: any,
  senderId: string,
  recipientId: string,
  orderId: string,
  body: string,
) {
  try {
    await sb.from("direct_messages").insert({
      sender_id: senderId,
      recipient_id: recipientId,
      order_id: orderId,
      body,
    });
  } catch (e) {
    console.error("[fulfilment] chat insert failed", e);
  }
}

/** Queue a transactional email. Never throws. */
export async function sendEmail(
  sb: any,
  userId: string,
  subject: string,
  lines: string[],
  ctaUrl?: string,
) {
  try {
    const { data: authUser } = await sb.auth.admin.getUserById(userId);
    const to = authUser?.user?.email as string | undefined;
    if (!to) return;
    const origin = process.env.VITE_SITE_URL || "https://oventric.com";
    const html =
      `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#0A0A0B;color:#e5e7eb;padding:24px">` +
      `<h2 style="color:#E5484D;margin:0 0 12px">${subject}</h2>` +
      lines.map((l) => `<p style="margin:0 0 10px;line-height:1.55">${l}</p>`).join("") +
      (ctaUrl
        ? `<p style="margin:18px 0 0"><a href="${origin}${ctaUrl}" style="background:#E5484D;color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none;font-weight:700">Open on Oventric</a></p>`
        : "") +
      `</div>`;
    const messageId = `ovt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await sb.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        message_id: messageId,
        idempotency_key: messageId,
        to,
        from: "Oventric <noreply@oventric.com>",
        sender_domain: "notify.oventric.com",
        subject,
        html,
        text: lines.join("\n\n"),
        purpose: "transactional",
        label: "order_update",
        queued_at: new Date().toISOString(),
      },
    });
  } catch (e) {
    console.error("[fulfilment] email enqueue failed", e);
  }
}

const ORDER_SELECT =
  "id, buyer_id, seller_id, escrow_status, seller_share_usd, product_id, dispute_status, display_currency, display_total, buyer_confirmed_at, delivered_at, paystack_ref, products:product_id (name)";

/**
 * Buyer confirmation. Funds stay in escrow for a further payout hold, then the
 * seller share is credited. Idempotent.
 */
export async function confirmReceipt(
  sb: any,
  orderId: string,
  _by: string | null,
  mode: "buyer" | "auto",
) {
  const { data: o, error } = await sb.from("orders").select(ORDER_SELECT).eq("id", orderId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!o) throw new Error("Order not found");
  if (o.escrow_status !== "held") return { alreadyConfirmed: true as const };
  if (o.buyer_confirmed_at) return { alreadyConfirmed: true as const };
  if (o.dispute_status === "open")
    throw new Error("This order has an open dispute. Funds stay held until it is resolved.");

  const now = new Date().toISOString();
  const payoutAt = hoursFromNow(PAYOUT_HOLD_HOURS);
  // Atomic claim: only one caller (buyer click, cron sweep, admin) can win the
  // confirmation, so the payout hold can never be started twice.
  const { data: claimed } = await sb
    .from("orders")
    .update({
      buyer_confirmed_at: now,
      payout_release_at: payoutAt,
      auto_refund_at: null,
    })
    .eq("id", orderId)
    .eq("escrow_status", "held")
    .is("buyer_confirmed_at", null)
    .select("id");
  if (!claimed || (claimed as unknown[]).length === 0) return { alreadyConfirmed: true as const };

  const name = (o.products?.name as string) ?? "your order";

  await sendChat(
    sb,
    o.buyer_id,
    o.seller_id,
    orderId,
    mode === "auto"
      ? `⏱️ Auto-confirmed — "${name}"\n\nThe buyer's ${CONFIRM_WINDOW_HOURS}-hour confirmation window closed with no issue reported, so Oventric confirmed delivery on their behalf. Your earnings clear into your wallet in ${PAYOUT_HOLD_HOURS} hours.`
      : `✅ Delivery confirmed — "${name}"\n\nThe buyer confirmed they received and tested the item. Your earnings clear into your wallet in ${PAYOUT_HOLD_HOURS} hours.`,
  );
  await sendChat(
    sb,
    o.seller_id,
    o.buyer_id,
    orderId,
    `🙏 Thank you for shopping on Oventric!\n\nYou confirmed "${name}". Payment clears to the seller in ${PAYOUT_HOLD_HOURS} hours.\n\nWould you take a moment to leave a review for this product and seller? It helps the next buyer decide — and it helps this seller grow.`,
  );

  await notify(sb, [
    {
      user_id: o.seller_id,
      kind: mode === "auto" ? "order_auto_confirmed" : "order_confirmed",
      title: mode === "auto" ? "Order auto-confirmed" : "Buyer confirmed delivery",
      body: `"${name}" is confirmed. Your earnings clear in ${PAYOUT_HOLD_HOURS} hours.`,
      link: `/order/${orderId}`,
    },
    {
      user_id: o.buyer_id,
      kind: mode === "auto" ? "order_auto_confirmed" : "order_confirmed",
      title: mode === "auto" ? "Your order was auto-confirmed" : "You confirmed delivery",
      body:
        mode === "auto"
          ? `"${name}" auto-confirmed because the confirmation window closed. Payment clears to the seller in ${PAYOUT_HOLD_HOURS} hours.`
          : `You confirmed delivery of "${name}". Payment clears to the seller in ${PAYOUT_HOLD_HOURS} hours.`,
      link: `/order/${orderId}`,
    },
    {
      user_id: o.buyer_id,
      kind: "order_review_prompt",
      title: "Thanks for your purchase",
      body: `Leave a review for "${name}" and help other buyers.`,
      link: `/product/${o.product_id}`,
    },
  ]);
  await sendEmail(
    sb,
    o.seller_id,
    mode === "auto" ? "Order auto-confirmed" : "Your buyer confirmed delivery",
    [
      `Good news — "${name}" has been confirmed.`,
      `Your share clears into your Oventric wallet in ${PAYOUT_HOLD_HOURS} hours.`,
    ],
    `/order/${orderId}`,
  );

  return { alreadyConfirmed: false as const, payoutReleaseAt: payoutAt };
}

/**
 * Final payout: credit the escrowed seller share. Idempotent.
 * `by` is the actor: admin id, or null for the automatic payout sweep.
 */
export async function releaseEscrow(
  sb: any,
  orderId: string,
  by: string | null,
  mode: "buyer" | "admin" | "auto",
) {
  const { data: o, error } = await sb.from("orders").select(ORDER_SELECT).eq("id", orderId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!o) throw new Error("Order not found");
  if (o.escrow_status !== "held") return { alreadyReleased: true as const };
  if (o.dispute_status === "open")
    throw new Error("This order has an open dispute. Funds stay held until it is resolved.");

  const share = Number(o.seller_share_usd ?? 0);
  if (share > 0) {
    const { error: cErr } = await sb.rpc("wallet_credit", { _user_id: o.seller_id, _amount: share });
    if (cErr) throw new Error(cErr.message);
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    escrow_status: "released",
    released_at: now,
    released_by: by,
    payout_release_at: null,
    auto_refund_at: null,
  };
  if (!o.buyer_confirmed_at) patch.buyer_confirmed_at = now;
  await sb.from("orders").update(patch).eq("id", orderId);

  if (o.paystack_ref) {
    try {
      await sb
        .from("wallet_transactions")
        .update({ status: "success" })
        .eq("tx_hash", `${o.paystack_ref}-S`);
    } catch (e) {
      console.error("[releaseEscrow] ledger update failed", e);
    }
  }

  const productName = (o.products?.name as string) ?? "your product";
  const admins = await adminUserIds(sb);
  await sendChat(
    sb,
    o.buyer_id,
    o.seller_id,
    orderId,
    `💰 Payment released — "${productName}"\n\nThe escrow hold has ended and your earnings are now available in your Oventric wallet.`,
  );
  await notify(sb, [
    {
      user_id: o.seller_id,
      kind: "order_payout_released",
      title: "Earnings released",
      body: `Escrow for "${productName}" has been released into your wallet.`,
      link: `/order/${orderId}`,
    },
    ...admins.map((uid) => ({
      user_id: uid,
      kind: "order_completed",
      title: "Trade circle completed",
      body: `Order ${orderId.slice(0, 8)} — "${productName}" completed and seller wallet funded.`,
      link: `/order/${orderId}`,
    })),
  ]);
  await sendEmail(
    sb,
    o.seller_id,
    "Your Oventric earnings have been released",
    [`Escrow on "${productName}" has cleared.`, `The funds are now available in your wallet.`],
    `/order/${orderId}`,
  );

  return { alreadyReleased: false as const };
}

/** Refund the buyer's payment back into their wallet. Idempotent. */
export async function refundBuyer(sb: any, orderId: string, reason: string) {
  const { data: o, error } = await sb.from("orders").select(ORDER_SELECT).eq("id", orderId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!o) throw new Error("Order not found");
  if (o.escrow_status !== "held") return { alreadyRefunded: true as const };

  const amount = Number(o.display_total ?? 0);
  const currency = String(o.display_currency ?? "USD");
  if (amount > 0) {
    const { error: cErr } = await sb.rpc("wallet_credit_currency", {
      _user_id: o.buyer_id,
      _amount: amount,
      _currency: currency,
    });
    if (cErr) throw new Error(cErr.message);
    try {
      await sb.from("wallet_transactions").insert({
        user_id: o.buyer_id,
        tx_hash: `${orderId}-REFUND`,
        type: "Wallet Top-Up",
        amount,
        currency,
        inflow: true,
        status: "success",
        occurred_at: new Date().toISOString(),
      });
    } catch (e) {
      console.error("[refundBuyer] ledger insert failed", e);
    }
  }

  // Stage 5 — the promotional credits this order created are reversed with
  // compensating ledger entries. Historical rows are never deleted.
  try {
    const { reverseOrderPromotions } = await import("@/lib/promotions.server");
    await reverseOrderPromotions(sb, {
      orderId,
      buyerId: o.buyer_id,
      reference: o.paystack_ref ?? null,
    });
  } catch (e) {
    console.error("[refundBuyer] promotion reversal failed", e);
  }

  // Platform revenue reversal — the 20% booked at settlement must not survive a
  // refund. Keyed on the order id, so replays cannot debit revenue twice.
  try {
    const { data: revRows } = await sb
      .from("system_wallet_transactions")
      .select("amount_usd, source")
      .eq("kind", "marketplace")
      .eq("ref_id", orderId);
    const booked = ((revRows ?? []) as Array<{ amount_usd: number }>).reduce(
      (sum, r) => sum + Number(r.amount_usd ?? 0),
      0,
    );
    if (booked > 0) {
      await sb.rpc("system_wallet_debit", {
        _kind: "marketplace",
        _amount: Number(booked.toFixed(2)),
        _source: "marketplace_order_refund",
        _ref: orderId,
        _meta: { order_id: orderId, reason },
      });
    }
  } catch (e) {
    console.error("[refundBuyer] platform revenue reversal failed", e);
  }

  const now = new Date().toISOString();
  await sb
    .from("orders")
    .update({
      escrow_status: "refunded",
      status: "refunded",
      refunded_at: now,
      refund_reason: reason,
      auto_refund_at: null,
      payout_release_at: null,
    })
    .eq("id", orderId);

  if (o.paystack_ref) {
    try {
      await sb
        .from("wallet_transactions")
        .update({ status: "failed" })
        .eq("tx_hash", `${o.paystack_ref}-S`);
    } catch (e) {
      console.error("[refundBuyer] seller ledger update failed", e);
    }
  }

  const name = (o.products?.name as string) ?? "the order";
  await sendChat(
    sb,
    o.seller_id,
    o.buyer_id,
    orderId,
    `↩️ Refunded — "${name}"\n\nThe delivery window closed without a confirmed hand-off, so Oventric returned ${currency} ${amount.toLocaleString()} to your wallet.`,
  );
  await notify(sb, [
    {
      user_id: o.buyer_id,
      kind: "order_refunded",
      title: "You've been refunded",
      body: `${currency} ${amount.toLocaleString()} for "${name}" is back in your wallet.`,
      link: `/order/${orderId}`,
    },
    {
      user_id: o.seller_id,
      kind: "order_refunded",
      title: "Order refunded to buyer",
      body: `"${name}" was not delivered within ${DELIVER_DEADLINE_HOURS} hours, so the buyer was refunded.`,
      link: `/order/${orderId}`,
    },
  ]);
  await sendEmail(
    sb,
    o.buyer_id,
    "Your Oventric order was refunded",
    [
      `"${name}" was not delivered within ${DELIVER_DEADLINE_HOURS} hours.`,
      `We've returned ${currency} ${amount.toLocaleString()} to your Oventric wallet.`,
    ],
    `/order/${orderId}`,
  );

  return { alreadyRefunded: false as const };
}

/**
 * Sweep every escrow timer: undelivered refunds, silent-buyer auto-confirms,
 * and matured payout holds. Disputed orders are always skipped.
 */
export async function sweepEscrowTimers() {
  const sb = await admin();
  const nowIso = new Date().toISOString();
  const out = { refunded: 0, autoConfirmed: 0, released: 0 };

  const run = async (
    query: any,
    fn: (id: string) => Promise<unknown>,
    counter: "refunded" | "autoConfirmed" | "released",
  ) => {
    const { data, error } = await query;
    if (error) {
      console.error("[sweepEscrowTimers] query failed", error);
      return;
    }
    for (const r of (data ?? []) as Array<{ id: string }>) {
      try {
        await fn(r.id);
        out[counter] += 1;
      } catch (e) {
        console.error("[sweepEscrowTimers]", counter, "failed for", r.id, e);
      }
    }
  };

  // 1. Paid but never delivered → refund the buyer.
  await run(
    sb
      .from("orders")
      .select("id")
      .eq("escrow_status", "held")
      .eq("dispute_status", "none")
      .is("delivered_at", null)
      .not("auto_refund_at", "is", null)
      .lte("auto_refund_at", nowIso)
      .limit(200),
    (id) => refundBuyer(sb, id, "seller_missed_delivery_window"),
    "refunded",
  );

  // 2. Delivered but the buyer went quiet → auto-confirm for the seller.
  await run(
    sb
      .from("orders")
      .select("id")
      .eq("escrow_status", "held")
      .eq("dispute_status", "none")
      .is("buyer_confirmed_at", null)
      .not("delivered_at", "is", null)
      .not("auto_release_at", "is", null)
      .lte("auto_release_at", nowIso)
      .limit(200),
    (id) => confirmReceipt(sb, id, null, "auto"),
    "autoConfirmed",
  );

  // 3. Confirmed and the payout hold has matured → pay the seller.
  await run(
    sb
      .from("orders")
      .select("id")
      .eq("escrow_status", "held")
      .eq("dispute_status", "none")
      .not("payout_release_at", "is", null)
      .lte("payout_release_at", nowIso)
      .limit(200),
    (id) => releaseEscrow(sb, id, null, "auto"),
    "released",
  );

  return out;
}

/** Back-compat wrapper used by the older cron entry point. */
export async function autoReleaseDueOrders() {
  const { released, autoConfirmed, refunded } = await sweepEscrowTimers();
  return { released, autoConfirmed, refunded };
}

/**
 * Warn buyers a few hours before their confirmation window closes so they can
 * confirm or report an issue in time. Idempotent via `prerelease_notified_at`.
 */
export async function notifyPreReleaseDue() {
  const sb = await admin();
  const cutoff = hoursFromNow(6);
  const { data, error } = await sb
    .from("orders")
    .select("id, buyer_id, auto_release_at, products:product_id (name)")
    .eq("escrow_status", "held")
    .eq("dispute_status", "none")
    .is("buyer_confirmed_at", null)
    .not("delivered_at", "is", null)
    .is("prerelease_notified_at", null)
    .not("auto_release_at", "is", null)
    .lte("auto_release_at", cutoff)
    .gt("auto_release_at", new Date().toISOString())
    .limit(200);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<Record<string, any>>;
  for (const r of rows) {
    const name = (r.products?.name as string) ?? "your order";
    await notify(sb, [
      {
        user_id: r.buyer_id,
        kind: "order_auto_release_soon",
        title: "Auto-confirms in a few hours",
        body: `"${name}" auto-confirms soon. Confirm delivery, or report an issue if something is wrong.`,
        link: `/order/${r.id}`,
      },
    ]);
    await sb.from("orders").update({ prerelease_notified_at: new Date().toISOString() }).eq("id", r.id);
  }
  return { warned: rows.length };
}
