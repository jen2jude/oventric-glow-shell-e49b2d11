/**
 * Provider-agnostic settlement.
 *
 * Both Paystack and Flutterwave (and admin-approved MiniPay transfers) funnel
 * into these two functions once a payment is confirmed. The `reference` is the
 * gateway reference and is what makes settlement idempotent.
 */
import { FX_FROM_USD, SELLER_SHARE, type OrderCurrency, type PaymentMethod } from "@/lib/marketplace.functions";
import { primeRuntimeFxRates } from "@/lib/fx.server";
import { convertViaSnapshot } from "@/lib/fx-display";
import { dbCurrency } from "@/lib/currency/africa";
import {
  validateCouponServer,
  recordCouponRedemption,
  sellerFundedCashbackUSD,
  qualifyReferralOnSettledPurchase,
} from "@/lib/promotions.server";

export async function settleWalletTopup(
  buyerId: string,
  reference: string,
  amount: number,
  currency: OrderCurrency,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const now = new Date().toISOString();

  // Exactly-once claim BEFORE any money moves. The ledger row for this gateway
  // reference is flipped pending -> success atomically (and the DB carries a
  // unique index on the reference), so two concurrent verifications — e.g. the
  // Paystack webhook and the buyer's return page — can never credit twice.
  const existing = await supabaseAdmin
    .from("wallet_transactions")
    .select("id, status")
    .eq("paystack_ref", reference)
    .eq("type", "Wallet Top-Up")
    .maybeSingle();

  if (existing.data?.id) {
    if (existing.data.status === "success") return { alreadySettled: true as const };
    const claim = await supabaseAdmin
      .from("wallet_transactions")
      .update({ status: "success", occurred_at: now, amount, currency: dbCurrency(currency) })
      .eq("id", existing.data.id)
      .neq("status", "success")
      .select("id")
      .maybeSingle();
    if (claim.error) throw new Error(claim.error.message);
    if (!claim.data) return { alreadySettled: true as const };
  } else {
    const ins = await supabaseAdmin.from("wallet_transactions").insert({
      user_id: buyerId,
      paystack_ref: reference,
      tx_hash: reference,
      type: "Wallet Top-Up",
      amount,
      currency: dbCurrency(currency),
      inflow: true,
      status: "success",
      occurred_at: now,
    });
    if (ins.error) {
      // Unique index on the reference: another settlement already credited it.
      if ((ins.error as { code?: string }).code === "23505") {
        return { alreadySettled: true as const };
      }
      throw new Error(ins.error.message);
    }
  }

  // Credit the wallet in the currency the user actually paid in, so the
  // primary balance shown on the Sovereign Wallet page updates immediately.
  // The USD equivalent card is derived on the client from FX rates.
  const { error: cErr } = await supabaseAdmin.rpc("wallet_credit_currency", {
    _user_id: buyerId,
    _amount: amount,
    _currency: currency,
  });
  if (cErr) {
    // The claim is only valid if the money actually landed — release it so the
    // next verification (webhook retry) can settle cleanly.
    await supabaseAdmin
      .from("wallet_transactions")
      .update({ status: "pending" })
      .eq("paystack_ref", reference)
      .eq("type", "Wallet Top-Up");
    throw new Error(cErr.message);
  }

  return { alreadySettled: false as const, creditedAmount: amount, creditedCurrency: currency };
}

interface SettledServicePackage {
  id: string;
  tier: string;
  name: string;
  price_usd: number;
  original_currency: string;
  original_amount: number;
  delivery_days: number | null;
  revisions: number | null;
}

export async function settleOrder(
  buyerId: string,
  reference: string,
  meta: {
    productId: string;
    quantity: number;
    displayCurrency: OrderCurrency;
    couponCode: string | null;
    deliveryEmail?: string | null;
    deliveryWhatsapp?: string | null;
    cashbackAppliedUSD?: number;
    servicePackageId?: string | null;
    serviceBrief?: Record<string, string> | null;
  },
) {
  await primeRuntimeFxRates();

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const existing = await supabaseAdmin
    .from("orders")
    .select("id, total_usd, display_total, display_currency")
    .eq("paystack_ref", reference)
    .maybeSingle();
  if (existing.data?.id) {
    // Replay path (webhook already settled). Read back the cashback that was
    // actually awarded — never recompute a fresh award.
    const { data: cbRow } = await supabaseAdmin
      .from("wallet_transactions")
      .select("amount")
      .eq("tx_hash", `${reference}-CB`)
      .maybeSingle();
    const cashbackEarnUSD = Number(cbRow?.amount ?? 0);
    return { alreadySettled: true as const, orderId: existing.data.id as string, cashbackEarnUSD };
  }

  const { data: pRow, error: pErr } = await supabaseAdmin
    .from("products")
    .select("id, name, seller_id, price_usd, original_currency, original_amount, fx_snapshot, requires_manual_delivery, cashback_pct")
    .eq("id", meta.productId)
    .maybeSingle();
  if (pErr) throw new Error(pErr.message);
  if (!pRow) throw new Error("Product not found");

  const qty = Math.max(1, Math.min(20, Number(meta.quantity)));

  // A chosen service tier is the authoritative unit price for this order.
  let pkgRow: SettledServicePackage | null = null;
  if (meta.servicePackageId) {
    const { data: pk } = await supabaseAdmin
      .from("service_packages")
      .select("id, tier, name, price_usd, original_currency, original_amount, delivery_days, revisions")
      .eq("id", meta.servicePackageId)
      .eq("product_id", pRow.id)
      .maybeSingle();
    pkgRow = (pk as SettledServicePackage | null) ?? null;
  }
  const priceUSD = pkgRow ? Number(pkgRow.price_usd) : Number(pRow.price_usd);
  const grossUSD = Number((priceUSD * qty).toFixed(2));
  let discountUSD = 0;
  let appliedCouponCode: string | null = null;
  if (meta.couponCode) {
    const check = await validateCouponServer(supabaseAdmin, meta.couponCode, {
      userId: buyerId,
      productId: pRow.id as string,
      sellerId: pRow.seller_id as string,
      grossUSD,
    });
    if (check.valid) {
      discountUSD = check.discountUSD;
      appliedCouponCode = check.code;
    }
  }
  const afterCouponUSD = Number((grossUSD - discountUSD).toFixed(2));
  const cashbackAppliedUSD = Math.max(0, Number(meta.cashbackAppliedUSD ?? 0));
  const totalUSD = Number((afterCouponUSD - cashbackAppliedUSD).toFixed(2));
  const snapRaw = (pRow.fx_snapshot as { base?: string; rates?: Record<string, number> } | null) ?? null;
  const snap = snapRaw && snapRaw.rates ? { base: "USD" as const, rates: snapRaw.rates } : null;
  const originalCurrency = ((pkgRow?.original_currency ?? (pRow.original_currency as string) ?? "USD")) as OrderCurrency;
  const originalAmount = Number(pkgRow?.original_amount ?? pRow.original_amount ?? 0);
  const convertedTotal =
    originalAmount > 0 && meta.displayCurrency === originalCurrency && afterCouponUSD > 0
      ? originalAmount * qty * (totalUSD / afterCouponUSD)
      : convertViaSnapshot(totalUSD, "USD", meta.displayCurrency, snap);
  const displayTotal = Number((convertedTotal > 0 ? convertedTotal : totalUSD * FX_FROM_USD[meta.displayCurrency]).toFixed(2));
  const fx = displayTotal && totalUSD > 0 ? displayTotal / totalUSD : FX_FROM_USD[meta.displayCurrency];


  const { data: oRow, error: oErr } = await supabaseAdmin
    .from("orders")
    .insert({
      buyer_id: buyerId,
      product_id: pRow.id,
      seller_id: pRow.seller_id,
      quantity: qty,
      unit_price_usd: priceUSD,
      total_usd: totalUSD,
      display_currency: dbCurrency(meta.displayCurrency),
      display_total: displayTotal,
      fx_rate: fx,
      payment_method: "card" satisfies PaymentMethod,
      status: "paid",
      paid_at: new Date().toISOString(),
      paystack_ref: reference,
      delivery_email: meta.deliveryEmail ?? null,
      delivery_whatsapp: meta.deliveryWhatsapp ?? null,
      service_package_id: pkgRow?.id ?? null,
      service_package_snapshot: pkgRow
        ? JSON.parse(JSON.stringify({
            tier: pkgRow.tier,
            name: pkgRow.name,
            priceUsd: Number(pkgRow.price_usd),
            deliveryDays: pkgRow.delivery_days,
            revisions: pkgRow.revisions,
          }))
        : null,
      service_brief: meta.serviceBrief ? JSON.parse(JSON.stringify(meta.serviceBrief)) : null,
    })
    .select()
    .single();
  if (oErr) {
    // Unique index on orders.paystack_ref: a concurrent verification already
    // settled this payment. Return that order instead of paying anyone twice.
    if ((oErr as { code?: string }).code === "23505") {
      const { data: raced } = await supabaseAdmin
        .from("orders")
        .select("id")
        .eq("paystack_ref", reference)
        .maybeSingle();
      const { data: cbRow } = await supabaseAdmin
        .from("wallet_transactions")
        .select("amount")
        .eq("tx_hash", `${reference}-CB`)
        .maybeSingle();
      if (raced?.id) {
        return {
          alreadySettled: true as const,
          orderId: raced.id as string,
          cashbackEarnUSD: Number(cbRow?.amount ?? 0),
        };
      }
    }
    throw new Error(oErr.message);
  }

  await supabaseAdmin.from("wallet_transactions").insert({
    user_id: buyerId,
    paystack_ref: reference,
    tx_hash: reference,
    type: "Marketplace Purchase",
    amount: displayTotal,
    currency: dbCurrency(meta.displayCurrency),
    inflow: false,
    status: "success",
    occurred_at: new Date().toISOString(),
  });

  // Platform keeps a flat 20% of the post-coupon sale price. The seller's 80%
  // funds any product-level cashback the seller configured — the platform's
  // share is never touched by cashback, and the seller's net can never go
  // below zero (the reward is capped at their own share).
  const splitBaseUSD = afterCouponUSD;
  const sellerGrossUSD = Number((splitBaseUSD * SELLER_SHARE).toFixed(2));
  const platformCutUSD = Number((splitBaseUSD - sellerGrossUSD).toFixed(2));
  const cashbackEarnUSD = sellerFundedCashbackUSD(
    pRow.cashback_pct as number | null,
    splitBaseUSD,
    sellerGrossUSD,
  );
  const sellerCutUSD = Number(Math.max(0, sellerGrossUSD - cashbackEarnUSD).toFixed(2));
  const sellerNetRatio = sellerGrossUSD > 0 ? sellerCutUSD / sellerGrossUSD : 1;

  const { data: sellerProfile } = await supabaseAdmin
    .from("profiles")
    .select("country")
    .eq("user_id", pRow.seller_id as string)
    .maybeSingle();
  const sellerCountry = String(sellerProfile?.country ?? "").toUpperCase();
  const sellerCurrency: OrderCurrency = sellerCountry === "NG" ? "NGN" : sellerCountry === "GH" ? "GHS" : "USD";
  const grossOriginalUSD = priceUSD * qty;
  const saleRatio = grossOriginalUSD > 0 ? afterCouponUSD / grossOriginalUSD : 1;
  const sellerCutLocalRaw =
    originalAmount > 0 && sellerCurrency === originalCurrency
      ? originalAmount * qty * saleRatio * SELLER_SHARE * sellerNetRatio
      : convertViaSnapshot(sellerCutUSD, "USD", sellerCurrency, snap);
  const sellerCutLocal = Number(sellerCutLocalRaw.toFixed(sellerCurrency === "USD" ? 2 : 0));
  const manualDelivery = Boolean(pRow.requires_manual_delivery);
  // A paid listing remains escrowed even when the buyer covers the checkout
  // total with wallet cashback. Only genuinely free downloads bypass escrow.
  const holdEscrow = afterCouponUSD > 0;
  const settledAt = new Date().toISOString();
  const { DELIVER_DEADLINE_HOURS, PAYOUT_HOLD_HOURS, hoursFromNow } = await import("@/lib/fulfilment.server");

  await supabaseAdmin
    .from("orders")
    .update({
      escrow_status: holdEscrow ? "held" : "released",
      seller_share_usd: sellerCutUSD,
      delivered_at: holdEscrow && !manualDelivery ? settledAt : null,
      buyer_confirmed_at: holdEscrow && !manualDelivery ? settledAt : null,
      released_at: holdEscrow ? null : settledAt,
      // Seller has a fixed window to deliver, or the buyer is refunded.
      auto_refund_at: holdEscrow && manualDelivery ? hoursFromNow(DELIVER_DEADLINE_HOURS) : null,
      payout_release_at: holdEscrow && !manualDelivery ? hoursFromNow(PAYOUT_HOLD_HOURS) : null,
    })
    .eq("id", oRow.id as string);


  await supabaseAdmin.from("wallet_transactions").insert({
    user_id: pRow.seller_id as string,
    paystack_ref: reference,
    tx_hash: `${reference}-S`,
    type: "Marketplace Sale",
    amount: sellerCutLocal,
    currency: dbCurrency(sellerCurrency),
    inflow: true,
    status: holdEscrow ? "pending" : "success",
    occurred_at: new Date().toISOString(),
  });

  await supabaseAdmin.rpc("system_wallet_credit", {
    _kind: "marketplace",
    _amount: platformCutUSD,
    _source: "marketplace_order_paystack",
    _ref: oRow.id as string,
    _meta: { order_id: oRow.id, product_id: pRow.id, buyer_id: buyerId, seller_id: pRow.seller_id, paystack_ref: reference, seller_cut_local: sellerCutLocal, seller_cut_currency: sellerCurrency, escrow: holdEscrow },
  });

  // Seller-funded cashback → buyer's spend-only Cashback Wallet. Funded from
  // the seller's share above, so this posts no extra platform expense.
  if (cashbackEarnUSD > 0) {
    await supabaseAdmin.rpc("cashback_credit", { _user_id: buyerId, _amount: cashbackEarnUSD });
    await supabaseAdmin.from("wallet_transactions").insert({
      user_id: buyerId,
      tx_hash: `${reference}-CB`,
      type: "Cashback Earned",
      amount: cashbackEarnUSD,
      currency: "USD",
      inflow: true,
      status: "success",
      occurred_at: new Date().toISOString(),
    });
  }

  // Coupon use is only burned once the payment has actually settled.
  if (appliedCouponCode && discountUSD > 0) {
    await recordCouponRedemption(supabaseAdmin, {
      code: appliedCouponCode,
      userId: buyerId,
      orderId: oRow.id as string,
      reference,
      discountUSD,
    });
  }

  // Referral reward — only on the invitee's first settled purchase.
  await qualifyReferralOnSettledPurchase(supabaseAdmin, {
    buyerId,
    orderId: oRow.id as string,
    orderTotalUSD: afterCouponUSD,
  });

  // Paid sales stay escrow-protected until the payout hold ends. Manual orders
  // need seller delivery; instant downloads are delivered and confirmed at once,
  // while the seller's 80% share stays pending until release.
  if (holdEscrow) {
    const orderId = oRow.id as string;
    const productName = (pRow.name as string) ?? "your listing";
    try {
      await supabaseAdmin.from("direct_messages").insert({
        sender_id: buyerId,
        recipient_id: pRow.seller_id as string,
        order_id: orderId,
        is_system: true,
        body: manualDelivery
          ? `📦 Payment confirmed — "${productName}" (Qty ${qty})\n\n` +
            `Oventric has verified this payment and it is held in escrow. Please deliver as soon as possible — ` +
            `share the file, link or setup steps right here in this chat, then tap "Delivered".\n\n` +
            `You have ${DELIVER_DEADLINE_HOURS} hours to deliver, otherwise the payment is automatically refunded to the buyer. ` +
            `Once the buyer confirms (or the confirmation window closes), your earnings clear into your wallet.\n\n` +
            `Order ref: ${orderId.slice(0, 8)}`
          : `✅ Instant download sold — "${productName}" (Qty ${qty})\n\n` +
            `The buyer can download from their receipt and My purchases. Your seller share is held under Oventric escrow and clears after the ${PAYOUT_HOLD_HOURS}-hour payout hold if there is no dispute.\n\n` +
            `Order ref: ${orderId.slice(0, 8)}`,
      });

      await supabaseAdmin.from("direct_messages").insert({
        sender_id: pRow.seller_id as string,
        recipient_id: buyerId,
        order_id: orderId,
        is_system: true,
        body: manualDelivery
          ? `✅ Payment confirmed — "${productName}"\n\n` +
            `Thank you! Your payment is confirmed and safely held in escrow. The seller has been notified and will deliver as soon as possible.\n\n` +
            `When you receive it, tap "Confirm delivery" below. If anything goes wrong, tap "Report issue". ` +
            `Keep the whole trade in this chat — escrow, refunds and mediation only cover deals completed on Oventric.`
          : `✅ Payment confirmed — "${productName}"\n\n` +
            `Your instant download is ready on the confirmation page and in My purchases. The trade remains protected on Oventric during the payout hold. If anything goes wrong, report it from the order page.`,
      });
    } catch (e) {
      console.error("[settleOrder] order DMs failed", e);
    }

    try {
      await supabaseAdmin.from("notifications").insert({
        user_id: pRow.seller_id as string,
        kind: manualDelivery ? "order_manual_delivery" : "order_instant_download",
        title: manualDelivery ? `New order — deliver "${productName}"` : `Instant download sold — "${productName}"`,
        body: manualDelivery
          ? `${displayTotal.toLocaleString()} ${meta.displayCurrency} is held in escrow. Deliver in chat to get paid.`
          : `${displayTotal.toLocaleString()} ${meta.displayCurrency} is held in escrow until the payout hold ends.`,
        link: `/order/${orderId}`,
        from_user_id: buyerId,
      });
    } catch (e) {
      console.error("[settleOrder] seller notification failed", e);
    }
  }

  return { alreadySettled: false as const, orderId: oRow.id as string, cashbackEarnUSD };
}


