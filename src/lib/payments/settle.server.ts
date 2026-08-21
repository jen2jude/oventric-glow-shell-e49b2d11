/**
 * Provider-agnostic settlement.
 *
 * Both Paystack and Flutterwave (and admin-approved MiniPay transfers) funnel
 * into these two functions once a payment is confirmed. The `reference` is the
 * gateway reference and is what makes settlement idempotent.
 */
import { FX_FROM_USD, SELLER_SHARE, WALLET_CASHBACK_PCT, type OrderCurrency, type PaymentMethod } from "@/lib/marketplace.functions";
import { primeRuntimeFxRates } from "@/lib/fx.server";
import { convertViaSnapshot } from "@/lib/fx-display";
import { dbCurrency } from "@/lib/currency/africa";

export async function settleWalletTopup(
  buyerId: string,
  reference: string,
  amount: number,
  currency: OrderCurrency,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // Idempotency guard.
  const existing = await supabaseAdmin
    .from("wallet_transactions")
    .select("id, status")
    .eq("paystack_ref", reference)
    .eq("type", "Wallet Top-Up")
    .maybeSingle();
  if (existing.data && existing.data.status === "success") {
    return { alreadySettled: true as const };
  }

  // Credit the wallet in the currency the user actually paid in, so the
  // primary balance shown on the Sovereign Wallet page updates immediately.
  // The USD equivalent card is derived on the client from FX rates.
  const { data: wRow } = await supabaseAdmin
    .from("wallets")
    .select("id, available_balance")
    .eq("user_id", buyerId)
    .eq("currency", currency)
    .maybeSingle();
  const now = new Date().toISOString();
  if (wRow?.id) {
    const nextBal = Number(wRow.available_balance ?? 0) + amount;
    const { error: uErr } = await supabaseAdmin
      .from("wallets")
      .update({ available_balance: nextBal, updated_at: now })
      .eq("id", wRow.id);
    if (uErr) throw new Error(uErr.message);
  } else {
    const { error: iErr } = await supabaseAdmin
      .from("wallets")
      .insert({ user_id: buyerId, currency, available_balance: amount });
    if (iErr) throw new Error(iErr.message);
  }

  if (existing.data?.id) {
    await supabaseAdmin
      .from("wallet_transactions")
      .update({ status: "success", occurred_at: now, amount, currency: dbCurrency(currency) })
      .eq("id", existing.data.id);
  } else {
    await supabaseAdmin.from("wallet_transactions").insert({
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
    // Replay path (webhook already settled). Recompute cashback so the return
    // page can still play the celebratory splash.
    const gross = Number(existing.data.total_usd ?? 0);
    const cashbackEarnUSD = Number((gross * WALLET_CASHBACK_PCT).toFixed(2));
    return { alreadySettled: true as const, orderId: existing.data.id as string, cashbackEarnUSD };
  }

  const { data: pRow, error: pErr } = await supabaseAdmin
    .from("products")
    .select("id, name, seller_id, price_usd, original_currency, original_amount, fx_snapshot, requires_manual_delivery")
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
  if (meta.couponCode) {
    const { data: c } = await supabaseAdmin
      .from("coupons")
      .select("discount_pct")
      .eq("code", meta.couponCode)
      .eq("active", true)
      .maybeSingle();
    if (c) discountUSD = Number(((grossUSD * Number(c.discount_pct)) / 100).toFixed(2));
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
  if (oErr) throw new Error(oErr.message);

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

  // Seller 80% + platform 20% always computed on the FULL gross sale price
  // (post-coupon, pre-cashback). Applying cashback only shifts value from the
  // buyer's card charge to their Cashback Wallet debit — the sale price the
  // seller/platform see is unchanged.
  const splitBaseUSD = afterCouponUSD;
  const sellerCutUSD = Number((splitBaseUSD * SELLER_SHARE).toFixed(2));
  const platformCutUSD = Number((splitBaseUSD - sellerCutUSD).toFixed(2));

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
      ? originalAmount * qty * saleRatio * SELLER_SHARE
      : convertViaSnapshot(sellerCutUSD, "USD", sellerCurrency, snap);
  const sellerCutLocal = Number(sellerCutLocalRaw.toFixed(sellerCurrency === "USD" ? 2 : 0));
  const holdEscrow = Boolean(pRow.requires_manual_delivery);

  await supabaseAdmin
    .from("orders")
    .update({
      escrow_status: holdEscrow ? "held" : "released",
      seller_share_usd: sellerCutUSD,
      released_at: holdEscrow ? null : new Date().toISOString(),
    })
    .eq("id", oRow.id as string);

  if (!holdEscrow) {
    await supabaseAdmin.rpc("wallet_credit_currency", {
      _user_id: pRow.seller_id as string,
      _amount: sellerCutLocal,
      _currency: sellerCurrency,
    });
  }
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

  // Credit 2% cashback of the FULL gross sale price into the buyer's spend-only
  // Cashback Wallet — regardless of whether they applied cashback this time.
  // Coupon purchases do not earn cashback.
  const cashbackEarnUSD = discountUSD > 0 ? 0 : Number((splitBaseUSD * WALLET_CASHBACK_PCT).toFixed(2));
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

  // Escrowed (manual-delivery) sale: tell the seller immediately and open the
  // order-tagged chat thread so the whole hand-off happens on Oventric.
  if (holdEscrow) {
    const orderId = oRow.id as string;
    const productName = (pRow.name as string) ?? "your listing";
    try {
      const origin = process.env.VITE_SITE_URL || "https://oventric.com";
      const productLink = `${origin}/product/${pRow.id}`;

      // Automatic Buyer to Seller message
      await supabaseAdmin.from("direct_messages").insert({
        sender_id: buyerId,
        recipient_id: pRow.seller_id as string,
        order_id: orderId,
        body: `hey i just paid for ${productName} please deliver as soon as possible. ${productLink}`,
      });

      // Automatic Seller to Buyer reply
      await supabaseAdmin.from("direct_messages").insert({
        sender_id: pRow.seller_id as string,
        recipient_id: buyerId,
        order_id: orderId,
        body: `Thank you for your payment!. We are preparing your order and will ship it as soon as possible. Thank you and we will make sure everything goes smoothly. ${productLink}`,
      });

      // Detailed escrow instructions for the seller
      await supabaseAdmin.from("direct_messages").insert({
        sender_id: buyerId,
        recipient_id: pRow.seller_id as string,
        order_id: orderId,
        body:
          `📦 New paid order — "${productName}" (Qty ${qty})\n\n` +
          `Payment is verified and held in escrow. Deliver right here in this chat ` +
          `(share the link, upload the file, or send the setup steps), then tap "Mark as delivered".\n\n` +
          `Your wallet is funded once the buyer confirms receipt — or automatically after 48 hours. ` +
          `Keep the trade on Oventric; we can't protect either side off-platform.\n\n` +
          `Order ref: ${orderId.slice(0, 8)}`,
      });
    } catch (e) {
      console.error("[settleOrder] seller DM failed", e);
    }
    try {
      await supabaseAdmin.from("notifications").insert({
        user_id: pRow.seller_id as string,
        kind: "order_manual_delivery",
        title: `New order — deliver "${productName}"`,
        body: `${displayTotal.toLocaleString()} ${meta.displayCurrency} is held in escrow. Deliver in chat to get paid.`,
        link: `/order/${orderId}`,
        from_user_id: buyerId,
      });
    } catch (e) {
      console.error("[settleOrder] seller notification failed", e);
    }
  }

  return { alreadySettled: false as const, orderId: oRow.id as string, cashbackEarnUSD };
}


