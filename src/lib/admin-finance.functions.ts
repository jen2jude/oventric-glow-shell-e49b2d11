import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * ADMIN STAGE 3 — read-only financial operations surface.
 *
 * Every function here READS authoritative records written by the existing
 * payment/settlement architecture (`src/lib/payments/*`, `fulfilment.server.ts`,
 * `payouts.functions.ts`, and the SECURITY DEFINER wallet RPCs). Nothing in this
 * module writes money: no wallet credit/debit, no ledger insert, no settlement,
 * no refund, no payout state change. Those paths stay where they already are.
 *
 * Access: super admin or the `finance` role. Moderator / content / support get
 * no financial visibility here, and the check is server-side on every call.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = any;

async function assertFinanceRead(context: { supabase: Sb; userId: string }) {
  const sb = context.supabase as Sb;
  const { data: isAdmin, error } = await sb.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (isAdmin) return "admin" as const;
  const { data: isFinance } = await sb.rpc("has_role", {
    _user_id: context.userId,
    _role: "finance",
  });
  if (isFinance) return "finance" as const;
  throw new Error("Forbidden: finance or admin role required");
}

async function adminDb(): Promise<Sb> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as Sb;
}

/** Gateway that owns a reference — OVF_… Flutterwave, everything else Paystack. */
function providerOf(reference: string | null): "flutterwave" | "paystack" | "unknown" {
  if (!reference) return "unknown";
  return reference.toUpperCase().startsWith("OVF") ? "flutterwave" : "paystack";
}

async function nameMap(sb: Sb, ids: string[]): Promise<Record<string, string>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return {};
  const { data } = await sb
    .from("profiles")
    .select("user_id, display_name, username")
    .in("user_id", unique);
  const out: Record<string, string> = {};
  for (const p of (data ?? []) as Array<Record<string, unknown>>) {
    out[p.user_id as string] =
      (p.display_name as string) || (p.username as string) || String(p.user_id).slice(0, 8);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export type PaymentPurpose = "order" | "wallet_funding";

export interface AdminPaymentRow {
  key: string;
  purpose: PaymentPurpose;
  reference: string | null;
  orderId: string | null;
  userId: string;
  userName: string | null;
  counterpartyName: string | null;
  amount: number | null;
  currency: string | null;
  amountUsd: number | null;
  provider: "flutterwave" | "paystack" | "unknown";
  method: string | null;
  status: string;
  settled: boolean;
  createdAt: string;
}

export interface AdminPaymentsInput {
  purpose?: "all" | PaymentPurpose;
  status?: string;
  provider?: "all" | "flutterwave" | "paystack";
  q?: string;
  from?: string;
  to?: string;
}

export const adminListPayments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: AdminPaymentsInput) => ({
    purpose: (i?.purpose ?? "all") as "all" | PaymentPurpose,
    status: String(i?.status ?? "ALL"),
    provider: (i?.provider ?? "all") as "all" | "flutterwave" | "paystack",
    q: String(i?.q ?? "").trim().slice(0, 80),
    from: String(i?.from ?? ""),
    to: String(i?.to ?? ""),
  }))
  .handler(async ({ data, context }): Promise<AdminPaymentRow[]> => {
    await assertFinanceRead(context);
    const sb = await adminDb();

    const term = data.q.toLowerCase();
    let matchedUserIds: string[] = [];
    if (term) {
      const like = `%${data.q.replace(/[%,]/g, "")}%`;
      const { data: profs } = await sb
        .from("profiles")
        .select("user_id")
        .or(`username.ilike.${like},display_name.ilike.${like}`)
        .limit(50);
      matchedUserIds = ((profs ?? []) as Array<{ user_id: string }>).map((p) => p.user_id);
    }

    const rows: AdminPaymentRow[] = [];

    // --- Marketplace payments (authoritative order records) ---
    if (data.purpose !== "wallet_funding") {
      let q = sb
        .from("orders")
        .select(
          "id, buyer_id, seller_id, paystack_ref, display_total, display_currency, total_usd, payment_method, status, escrow_status, seller_share_usd, created_at, paid_at, product_name_snapshot",
        )
        .order("created_at", { ascending: false })
        .limit(500);
      if (data.from) q = q.gte("created_at", data.from);
      if (data.to) q = q.lte("created_at", `${data.to}T23:59:59`);
      const { data: orders, error } = await q;
      if (error) throw new Error(error.message);

      const names = await nameMap(
        sb,
        ((orders ?? []) as Array<Record<string, unknown>>).flatMap((o) => [
          o.buyer_id as string,
          o.seller_id as string,
        ]),
      );

      for (const o of (orders ?? []) as Array<Record<string, unknown>>) {
        rows.push({
          key: `order:${o.id as string}`,
          purpose: "order",
          reference: (o.paystack_ref as string) ?? null,
          orderId: o.id as string,
          userId: o.buyer_id as string,
          userName: names[o.buyer_id as string] ?? null,
          counterpartyName: names[o.seller_id as string] ?? null,
          amount: o.display_total == null ? null : Number(o.display_total),
          currency: (o.display_currency as string) ?? null,
          amountUsd: o.total_usd == null ? null : Number(o.total_usd),
          provider: providerOf((o.paystack_ref as string) ?? null),
          method: (o.payment_method as string) ?? null,
          status: (o.status as string) ?? "unknown",
          settled: o.status === "paid" && o.seller_share_usd != null,
          createdAt: (o.created_at as string) ?? (o.paid_at as string),
        });
      }
    }

    // --- Wallet funding payments (ledger top-up rows carry the gateway ref) ---
    if (data.purpose !== "order") {
      let q = sb
        .from("wallet_transactions")
        .select("id, user_id, tx_hash, paystack_ref, amount, currency, status, occurred_at")
        .eq("type", "Wallet Top-Up")
        .not("paystack_ref", "is", null)
        .order("occurred_at", { ascending: false })
        .limit(500);
      if (data.from) q = q.gte("occurred_at", data.from);
      if (data.to) q = q.lte("occurred_at", `${data.to}T23:59:59`);
      const { data: tops, error } = await q;
      if (error) throw new Error(error.message);

      const names = await nameMap(
        sb,
        ((tops ?? []) as Array<Record<string, unknown>>).map((t) => t.user_id as string),
      );

      for (const t of (tops ?? []) as Array<Record<string, unknown>>) {
        rows.push({
          key: `funding:${t.id as string}`,
          purpose: "wallet_funding",
          reference: (t.paystack_ref as string) ?? null,
          orderId: null,
          userId: t.user_id as string,
          userName: names[t.user_id as string] ?? null,
          counterpartyName: null,
          amount: Number(t.amount ?? 0),
          currency: (t.currency as string) ?? null,
          amountUsd: null,
          provider: providerOf((t.paystack_ref as string) ?? null),
          method: null,
          status: (t.status as string) ?? "unknown",
          settled: t.status === "success",
          createdAt: t.occurred_at as string,
        });
      }
    }

    const filtered = rows.filter((r) => {
      if (data.status !== "ALL" && r.status !== data.status) return false;
      if (data.provider !== "all" && r.provider !== data.provider) return false;
      if (!term) return true;
      if (matchedUserIds.includes(r.userId)) return true;
      return [r.reference, r.orderId, r.userName, r.counterpartyName]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(term));
    });

    filtered.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return filtered.slice(0, 400);
  });

export interface AdminPaymentDetail {
  purpose: PaymentPurpose;
  reference: string | null;
  provider: string;
  status: string;
  order: {
    id: string;
    productName: string | null;
    buyerName: string | null;
    sellerName: string | null;
    quantity: number;
    unitPriceUsd: number | null;
    totalUsd: number | null;
    displayTotal: number | null;
    displayCurrency: string | null;
    fxRate: number | null;
    sellerShareUsd: number | null;
    platformShareUsd: number | null;
    couponCode: string | null;
    couponDiscountUsd: number | null;
    cashbackUsd: number | null;
    escrowStatus: string | null;
    disputeStatus: string | null;
    paymentMethod: string | null;
    paidAt: string | null;
    releasedAt: string | null;
    refundedAt: string | null;
    refundReason: string | null;
  } | null;
  funding: {
    userName: string | null;
    amount: number;
    currency: string | null;
    status: string;
    occurredAt: string;
  } | null;
  ledger: Array<{
    id: string;
    userName: string | null;
    txHash: string | null;
    type: string;
    amount: number;
    currency: string;
    inflow: boolean;
    status: string;
    occurredAt: string;
  }>;
  platformRevenue: Array<{ id: string; kind: string; amountUsd: number; createdAt: string }>;
  webhookEvents: Array<{ event: string; receivedAt: string | null }>;
  createdAt: string | null;
}

export const adminGetPaymentDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { reference?: string; orderId?: string }) => ({
    reference: String(i?.reference ?? ""),
    orderId: String(i?.orderId ?? ""),
  }))
  .handler(async ({ data, context }): Promise<AdminPaymentDetail> => {
    await assertFinanceRead(context);
    const sb = await adminDb();

    let order: Record<string, unknown> | null = null;
    if (data.orderId) {
      const { data: o } = await sb.from("orders").select("*").eq("id", data.orderId).maybeSingle();
      order = (o as Record<string, unknown>) ?? null;
    } else if (data.reference) {
      const { data: o } = await sb
        .from("orders")
        .select("*")
        .eq("paystack_ref", data.reference)
        .maybeSingle();
      order = (o as Record<string, unknown>) ?? null;
    }

    const reference = (order?.paystack_ref as string) ?? (data.reference || null);

    // Every ledger row tied to this gateway reference (purchase, seller share,
    // cashback, reversal, top-up …) — read straight from the ledger table.
    const ledgerRows: Array<Record<string, unknown>> = [];
    if (reference) {
      const { data: byRef } = await sb
        .from("wallet_transactions")
        .select("id, user_id, tx_hash, type, amount, currency, inflow, status, occurred_at")
        .or(`paystack_ref.eq.${reference},tx_hash.like.${reference}%`)
        .order("occurred_at", { ascending: true })
        .limit(50);
      ledgerRows.push(...((byRef ?? []) as Array<Record<string, unknown>>));
    }
    if (order?.id) {
      const { data: byOrder } = await sb
        .from("wallet_transactions")
        .select("id, user_id, tx_hash, type, amount, currency, inflow, status, occurred_at")
        .like("tx_hash", `${order.id as string}%`)
        .limit(50);
      for (const r of (byOrder ?? []) as Array<Record<string, unknown>>) {
        if (!ledgerRows.some((x) => x.id === r.id)) ledgerRows.push(r);
      }
    }

    const names = await nameMap(sb, [
      ...(order ? [order.buyer_id as string, order.seller_id as string] : []),
      ...ledgerRows.map((l) => l.user_id as string),
    ]);

    // Coupon + cashback come from their own authoritative tables.
    let couponCode: string | null = null;
    let couponDiscount: number | null = null;
    if (order?.id) {
      const { data: c } = await sb
        .from("coupon_redemptions")
        .select("coupon_code, discount_usd")
        .eq("order_id", order.id as string)
        .maybeSingle();
      if (c) {
        couponCode = c.coupon_code as string;
        couponDiscount = Number(c.discount_usd ?? 0);
      }
    }
    const cashbackRow = ledgerRows.find((l) => l.type === "Cashback Earned");

    let platformRevenue: AdminPaymentDetail["platformRevenue"] = [];
    if (order?.id) {
      const { data: rev } = await sb
        .from("system_wallet_transactions")
        .select("id, kind, amount_usd, created_at")
        .eq("ref_id", order.id as string);
      platformRevenue = ((rev ?? []) as Array<Record<string, unknown>>).map((r) => ({
        id: r.id as string,
        kind: r.kind as string,
        amountUsd: Number(r.amount_usd ?? 0),
        createdAt: r.created_at as string,
      }));
    }

    let webhookEvents: AdminPaymentDetail["webhookEvents"] = [];
    if (reference) {
      const { data: hooks } = await sb
        .from("paystack_webhook_events")
        .select("event, received_at")
        .eq("reference", reference)
        .limit(20);
      webhookEvents = ((hooks ?? []) as Array<Record<string, unknown>>).map((h) => ({
        event: (h.event as string) ?? "",
        receivedAt: (h.received_at as string) ?? null,
      }));
    }

    let funding: AdminPaymentDetail["funding"] = null;
    if (!order && reference) {
      const { data: f } = await sb
        .from("wallet_transactions")
        .select("user_id, amount, currency, status, occurred_at")
        .eq("paystack_ref", reference)
        .eq("type", "Wallet Top-Up")
        .maybeSingle();
      if (f) {
        funding = {
          userName: names[f.user_id as string] ?? null,
          amount: Number(f.amount ?? 0),
          currency: (f.currency as string) ?? null,
          status: (f.status as string) ?? "unknown",
          occurredAt: f.occurred_at as string,
        };
      }
    }

    const totalUsd = order?.total_usd == null ? null : Number(order.total_usd);
    const sellerShare = order?.seller_share_usd == null ? null : Number(order.seller_share_usd);

    return {
      purpose: order ? "order" : "wallet_funding",
      reference,
      provider: providerOf(reference),
      status: (order?.status as string) ?? funding?.status ?? "unknown",
      order: order
        ? {
            id: order.id as string,
            productName: (order.product_name_snapshot as string) ?? null,
            buyerName: names[order.buyer_id as string] ?? null,
            sellerName: names[order.seller_id as string] ?? null,
            quantity: Number(order.quantity ?? 1),
            unitPriceUsd: order.unit_price_usd == null ? null : Number(order.unit_price_usd),
            totalUsd,
            displayTotal: order.display_total == null ? null : Number(order.display_total),
            displayCurrency: (order.display_currency as string) ?? null,
            fxRate: order.fx_rate == null ? null : Number(order.fx_rate),
            sellerShareUsd: sellerShare,
            platformShareUsd:
              totalUsd != null && sellerShare != null
                ? Number((totalUsd - sellerShare).toFixed(2))
                : null,
            couponCode,
            couponDiscountUsd: couponDiscount,
            cashbackUsd: cashbackRow ? Number(cashbackRow.amount ?? 0) : null,
            escrowStatus: (order.escrow_status as string) ?? null,
            disputeStatus: (order.dispute_status as string) ?? null,
            paymentMethod: (order.payment_method as string) ?? null,
            paidAt: (order.paid_at as string) ?? null,
            releasedAt: (order.released_at as string) ?? null,
            refundedAt: (order.refunded_at as string) ?? null,
            refundReason: (order.refund_reason as string) ?? null,
          }
        : null,
      funding,
      ledger: ledgerRows.map((l) => ({
        id: l.id as string,
        userName: names[l.user_id as string] ?? null,
        txHash: (l.tx_hash as string) ?? null,
        type: l.type as string,
        amount: Number(l.amount ?? 0),
        currency: l.currency as string,
        inflow: Boolean(l.inflow),
        status: l.status as string,
        occurredAt: l.occurred_at as string,
      })),
      platformRevenue,
      webhookEvents,
      createdAt: (order?.created_at as string) ?? funding?.occurredAt ?? null,
    };
  });

// ---------------------------------------------------------------------------
// Wallet / ledger
// ---------------------------------------------------------------------------

export interface AdminLedgerRow {
  id: string;
  userId: string;
  userName: string | null;
  txHash: string | null;
  reference: string | null;
  type: string;
  amount: number;
  currency: string;
  inflow: boolean;
  status: string;
  occurredAt: string;
}

export interface AdminLedgerInput {
  q?: string;
  type?: string;
  direction?: "all" | "in" | "out";
  currency?: string;
  status?: string;
  from?: string;
  to?: string;
  page?: number;
}

export const adminListLedger = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: AdminLedgerInput) => ({
    q: String(i?.q ?? "").trim().slice(0, 80),
    type: String(i?.type ?? "ALL"),
    direction: (i?.direction ?? "all") as "all" | "in" | "out",
    currency: String(i?.currency ?? "ALL"),
    status: String(i?.status ?? "ALL"),
    from: String(i?.from ?? ""),
    to: String(i?.to ?? ""),
    page: Math.max(1, Number(i?.page ?? 1)),
  }))
  .handler(async ({ data, context }) => {
    await assertFinanceRead(context);
    const sb = await adminDb();
    const pageSize = 50;

    let userIds: string[] | null = null;
    if (data.q) {
      const like = `%${data.q.replace(/[%,]/g, "")}%`;
      const { data: profs } = await sb
        .from("profiles")
        .select("user_id")
        .or(`username.ilike.${like},display_name.ilike.${like}`)
        .limit(50);
      const ids = ((profs ?? []) as Array<{ user_id: string }>).map((p) => p.user_id);
      if (ids.length) userIds = ids;
    }

    let q = sb
      .from("wallet_transactions")
      .select("id, user_id, tx_hash, paystack_ref, type, amount, currency, inflow, status, occurred_at", {
        count: "exact",
      })
      .order("occurred_at", { ascending: false });

    if (data.type !== "ALL") q = q.eq("type", data.type);
    if (data.currency !== "ALL") q = q.eq("currency", data.currency);
    if (data.status !== "ALL") q = q.eq("status", data.status);
    if (data.direction !== "all") q = q.eq("inflow", data.direction === "in");
    if (data.from) q = q.gte("occurred_at", data.from);
    if (data.to) q = q.lte("occurred_at", `${data.to}T23:59:59`);
    if (data.q) {
      const s = data.q.replace(/[%,]/g, "");
      const clauses = [`tx_hash.ilike.%${s}%`, `paystack_ref.ilike.%${s}%`];
      if (userIds) clauses.push(`user_id.in.(${userIds.join(",")})`);
      q = q.or(clauses.join(","));
    }

    const fromIdx = (data.page - 1) * pageSize;
    const { data: rows, count, error } = await q.range(fromIdx, fromIdx + pageSize - 1);
    if (error) throw new Error(error.message);

    const names = await nameMap(
      sb,
      ((rows ?? []) as Array<Record<string, unknown>>).map((r) => r.user_id as string),
    );

    const items: AdminLedgerRow[] = ((rows ?? []) as Array<Record<string, unknown>>).map((r) => ({
      id: r.id as string,
      userId: r.user_id as string,
      userName: names[r.user_id as string] ?? null,
      txHash: (r.tx_hash as string) ?? null,
      reference: (r.paystack_ref as string) ?? null,
      type: r.type as string,
      amount: Number(r.amount ?? 0),
      currency: r.currency as string,
      inflow: Boolean(r.inflow),
      status: r.status as string,
      occurredAt: r.occurred_at as string,
    }));

    return { items, total: count ?? items.length, page: data.page, pageSize };
  });

export interface AdminWalletAccount {
  userId: string;
  userName: string | null;
  currency: string;
  available: number;
  escrow: number;
  cashback: number;
  bounty: number;
  updatedAt: string | null;
}

export const adminListWallets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { q?: string }) => ({ q: String(i?.q ?? "").trim().slice(0, 80) }))
  .handler(async ({ data, context }): Promise<AdminWalletAccount[]> => {
    await assertFinanceRead(context);
    const sb = await adminDb();

    const { data: rows, error } = await sb
      .from("wallets")
      .select("user_id, currency, available_balance, escrow_balance, accumulated_cashback, bounty_balance, updated_at")
      .limit(1000);
    if (error) throw new Error(error.message);

    const names = await nameMap(
      sb,
      ((rows ?? []) as Array<Record<string, unknown>>).map((r) => r.user_id as string),
    );
    const term = data.q.toLowerCase();

    return ((rows ?? []) as Array<Record<string, unknown>>)
      .map((r) => ({
        userId: r.user_id as string,
        userName: names[r.user_id as string] ?? null,
        currency: r.currency as string,
        available: Number(r.available_balance ?? 0),
        escrow: Number(r.escrow_balance ?? 0),
        cashback: Number(r.accumulated_cashback ?? 0),
        bounty: Number(r.bounty_balance ?? 0),
        updatedAt: (r.updated_at as string) ?? null,
      }))
      .filter((w) =>
        !term
          ? true
          : (w.userName ?? "").toLowerCase().includes(term) || w.userId.includes(term),
      )
      .sort((a, b) => b.available - a.available);
  });

// ---------------------------------------------------------------------------
// Refunds (read-only view of the authoritative refund path)
// ---------------------------------------------------------------------------

export interface AdminRefundRow {
  orderId: string;
  reference: string | null;
  buyerName: string | null;
  sellerName: string | null;
  productName: string | null;
  refundAmount: number | null;
  currency: string | null;
  totalUsd: number | null;
  reason: string | null;
  refundedAt: string | null;
  disputeStatus: string | null;
  reversals: Array<{ type: string; amount: number; currency: string; status: string }>;
}

export const adminListRefunds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminRefundRow[]> => {
    await assertFinanceRead(context);
    const sb = await adminDb();

    const { data: orders, error } = await sb
      .from("orders")
      .select(
        "id, paystack_ref, buyer_id, seller_id, product_name_snapshot, display_total, display_currency, total_usd, refund_reason, refunded_at, dispute_status",
      )
      .or("status.eq.refunded,escrow_status.eq.refunded")
      .order("refunded_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    const list = (orders ?? []) as Array<Record<string, unknown>>;
    const names = await nameMap(
      sb,
      list.flatMap((o) => [o.buyer_id as string, o.seller_id as string]),
    );

    const out: AdminRefundRow[] = [];
    for (const o of list) {
      const { data: rev } = await sb
        .from("wallet_transactions")
        .select("type, amount, currency, status, tx_hash")
        .like("tx_hash", `${o.id as string}%`)
        .limit(20);
      out.push({
        orderId: o.id as string,
        reference: (o.paystack_ref as string) ?? null,
        buyerName: names[o.buyer_id as string] ?? null,
        sellerName: names[o.seller_id as string] ?? null,
        productName: (o.product_name_snapshot as string) ?? null,
        refundAmount: o.display_total == null ? null : Number(o.display_total),
        currency: (o.display_currency as string) ?? null,
        totalUsd: o.total_usd == null ? null : Number(o.total_usd),
        reason: (o.refund_reason as string) ?? null,
        refundedAt: (o.refunded_at as string) ?? null,
        disputeStatus: (o.dispute_status as string) ?? null,
        reversals: ((rev ?? []) as Array<Record<string, unknown>>).map((r) => ({
          type: r.type as string,
          amount: Number(r.amount ?? 0),
          currency: r.currency as string,
          status: r.status as string,
        })),
      });
    }
    return out;
  });

// ---------------------------------------------------------------------------
// Financial overview
// ---------------------------------------------------------------------------

export interface AdminFinanceOverview {
  settledOrders: number;
  settledSalesUsd: number;
  platformRevenueUsd: number;
  sellerEarningsUsd: number;
  escrowHeldUsd: number;
  refundedOrders: number;
  refundedUsd: number;
  openDisputes: number;
  pendingPayouts: number;
  pendingPayoutAmounts: Record<string, number>;
  paidPayouts: number;
  fundingSuccess: number;
  fundingPending: number;
  fundingFailed: number;
  cashbackAwardedUsd: number;
  reconciliationIssues: number;
}

export const adminFinanceOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminFinanceOverview> => {
    await assertFinanceRead(context);
    const sb = await adminDb();

    const [ordersRes, revenueRes, payoutsRes, topupsRes, cashbackRes, disputesRes] =
      await Promise.all([
        sb
          .from("orders")
          .select("status, escrow_status, total_usd, seller_share_usd, display_total")
          .limit(5000),
        sb.from("system_wallet_transactions").select("amount_usd").limit(5000),
        sb.from("payout_requests").select("status, amount, currency").limit(5000),
        sb.from("wallet_transactions").select("status").eq("type", "Wallet Top-Up").limit(5000),
        sb
          .from("wallet_transactions")
          .select("amount, status")
          .eq("type", "Cashback Earned")
          .limit(5000),
        sb.from("order_disputes").select("status").eq("status", "open").limit(1000),
      ]);

    const orders = (ordersRes.data ?? []) as Array<Record<string, unknown>>;
    const paid = orders.filter((o) => o.status === "paid");
    const refunded = orders.filter((o) => o.status === "refunded" || o.escrow_status === "refunded");

    const payouts = (payoutsRes.data ?? []) as Array<Record<string, unknown>>;
    const pendingPayoutAmounts: Record<string, number> = {};
    for (const p of payouts.filter((p) => p.status === "pending" || p.status === "approved")) {
      const c = (p.currency as string) ?? "USD";
      pendingPayoutAmounts[c] = (pendingPayoutAmounts[c] ?? 0) + Number(p.amount ?? 0);
    }

    const tops = (topupsRes.data ?? []) as Array<{ status: string }>;
    const issues = await reconciliationIssueCount(sb);

    return {
      settledOrders: paid.length,
      settledSalesUsd: Number(paid.reduce((s, o) => s + Number(o.total_usd ?? 0), 0).toFixed(2)),
      platformRevenueUsd: Number(
        ((revenueRes.data ?? []) as Array<{ amount_usd: number }>)
          .reduce((s, r) => s + Number(r.amount_usd ?? 0), 0)
          .toFixed(2),
      ),
      sellerEarningsUsd: Number(
        paid.reduce((s, o) => s + Number(o.seller_share_usd ?? 0), 0).toFixed(2),
      ),
      escrowHeldUsd: Number(
        orders
          .filter((o) => o.escrow_status === "held")
          .reduce((s, o) => s + Number(o.seller_share_usd ?? 0), 0)
          .toFixed(2),
      ),
      refundedOrders: refunded.length,
      refundedUsd: Number(refunded.reduce((s, o) => s + Number(o.total_usd ?? 0), 0).toFixed(2)),
      openDisputes: (disputesRes.data ?? []).length,
      pendingPayouts: payouts.filter((p) => p.status === "pending").length,
      pendingPayoutAmounts,
      paidPayouts: payouts.filter((p) => p.status === "paid").length,
      fundingSuccess: tops.filter((t) => t.status === "success").length,
      fundingPending: tops.filter((t) => t.status === "pending").length,
      fundingFailed: tops.filter((t) => t.status === "failed").length,
      cashbackAwardedUsd: Number(
        ((cashbackRes.data ?? []) as Array<{ amount: number; status: string }>)
          .filter((r) => r.status === "success")
          .reduce((s, r) => s + Number(r.amount ?? 0), 0)
          .toFixed(2),
      ),
      reconciliationIssues: issues,
    };
  });

// ---------------------------------------------------------------------------
// Reconciliation — detect only, never repair
// ---------------------------------------------------------------------------

export interface ReconciliationFinding {
  check: string;
  severity: "high" | "medium" | "info";
  subject: string;
  detail: string;
  reference: string | null;
}

async function collectFindings(sb: Sb): Promise<ReconciliationFinding[]> {
  const findings: ReconciliationFinding[] = [];

  const { data: orders } = await sb
    .from("orders")
    .select(
      "id, paystack_ref, status, escrow_status, total_usd, seller_share_usd, created_at, buyer_id",
    )
    .limit(5000);
  const orderRows = (orders ?? []) as Array<Record<string, unknown>>;

  const { data: ledger } = await sb
    .from("wallet_transactions")
    .select("id, tx_hash, paystack_ref, type, amount, status, user_id")
    .limit(10000);
  const ledgerRows = (ledger ?? []) as Array<Record<string, unknown>>;

  const { data: revenue } = await sb
    .from("system_wallet_transactions")
    .select("ref_id, amount_usd")
    .limit(10000);
  const revenueByOrder = new Set(
    ((revenue ?? []) as Array<{ ref_id: string | null }>).map((r) => r.ref_id ?? ""),
  );

  const ledgerByRef = new Map<string, Array<Record<string, unknown>>>();
  for (const l of ledgerRows) {
    const ref = (l.paystack_ref as string) ?? "";
    if (!ref) continue;
    const arr = ledgerByRef.get(ref) ?? [];
    arr.push(l);
    ledgerByRef.set(ref, arr);
  }

  // 1. Paid order with no gateway reference → cannot be matched to a payment.
  for (const o of orderRows) {
    if (o.status === "paid" && !o.paystack_ref) {
      findings.push({
        check: "Settlement without payment reference",
        severity: "high",
        subject: `Order ${String(o.id).slice(0, 8)}`,
        detail:
          "Marked paid but carries no gateway reference, so it cannot be matched against a provider payment. Requires investigation.",
        reference: null,
      });
    }
  }

  // 2. Paid order without a settlement split.
  for (const o of orderRows) {
    if (o.status === "paid" && o.seller_share_usd == null) {
      findings.push({
        check: "Payment without settlement split",
        severity: "high",
        subject: `Order ${String(o.id).slice(0, 8)}`,
        detail: "Paid order has no seller share recorded — the 80/20 split never ran.",
        reference: (o.paystack_ref as string) ?? null,
      });
    }
  }

  // 3. Paid order with no platform revenue entry.
  for (const o of orderRows) {
    if (o.status === "paid" && !revenueByOrder.has(o.id as string)) {
      findings.push({
        check: "Settlement without platform revenue entry",
        severity: "medium",
        subject: `Order ${String(o.id).slice(0, 8)}`,
        detail: "No system revenue posting is linked to this settled order.",
        reference: (o.paystack_ref as string) ?? null,
      });
    }
  }

  // 4. Paid order with no buyer ledger entry.
  for (const o of orderRows) {
    const ref = (o.paystack_ref as string) ?? "";
    if (o.status !== "paid" || !ref) continue;
    const entries = ledgerByRef.get(ref) ?? [];
    if (!entries.some((l) => l.type === "Marketplace Purchase")) {
      findings.push({
        check: "Settlement without ledger entry",
        severity: "high",
        subject: `Order ${String(o.id).slice(0, 8)}`,
        detail: "No buyer purchase entry exists in the ledger for this settled payment.",
        reference: ref,
      });
    }
  }

  // 5. Duplicate payment reference on orders.
  const refCount = new Map<string, number>();
  for (const o of orderRows) {
    const ref = (o.paystack_ref as string) ?? "";
    if (ref) refCount.set(ref, (refCount.get(ref) ?? 0) + 1);
  }
  for (const [ref, n] of refCount) {
    if (n > 1) {
      findings.push({
        check: "Duplicate payment reference",
        severity: "high",
        subject: ref,
        detail: `${n} orders share this gateway reference — a duplicate settlement.`,
        reference: ref,
      });
    }
  }

  // 6. Duplicate ledger reference.
  const hashCount = new Map<string, number>();
  for (const l of ledgerRows) {
    const h = (l.tx_hash as string) ?? "";
    if (h) hashCount.set(h, (hashCount.get(h) ?? 0) + 1);
  }
  for (const [h, n] of hashCount) {
    if (n > 1) {
      findings.push({
        check: "Duplicate ledger reference",
        severity: "high",
        subject: h,
        detail: `${n} ledger entries share this reference.`,
        reference: h,
      });
    }
  }

  // 7. Wallet funding marked success but no wallet row for that user/currency.
  const { data: tops } = await sb
    .from("wallet_transactions")
    .select("user_id, currency, amount, status, paystack_ref")
    .eq("type", "Wallet Top-Up")
    .eq("status", "success")
    .limit(2000);
  const topRows = (tops ?? []) as Array<Record<string, unknown>>;
  if (topRows.length) {
    const { data: wallets } = await sb.from("wallets").select("user_id, currency").limit(5000);
    const walletKeys = new Set(
      ((wallets ?? []) as Array<Record<string, unknown>>).map(
        (w) => `${w.user_id as string}|${w.currency as string}`,
      ),
    );
    for (const t of topRows) {
      if (!walletKeys.has(`${t.user_id as string}|${t.currency as string}`)) {
        findings.push({
          check: "Wallet funding without wallet credit",
          severity: "high",
          subject: (t.paystack_ref as string) ?? "funding",
          detail: `A successful ${t.currency as string} funding has no matching wallet account for that user.`,
          reference: (t.paystack_ref as string) ?? null,
        });
      }
    }
  }

  // 8. Withdrawal states vs held funds and payout ledger entries.
  const { data: payouts } = await sb
    .from("payout_requests")
    .select("id, user_id, currency, amount, status")
    .limit(2000);
  const payoutRows = (payouts ?? []) as Array<Record<string, unknown>>;
  if (payoutRows.length) {
    const { data: wallets } = await sb
      .from("wallets")
      .select("user_id, currency, escrow_balance")
      .limit(5000);
    const escrowMap = new Map(
      ((wallets ?? []) as Array<Record<string, unknown>>).map((w) => [
        `${w.user_id as string}|${w.currency as string}`,
        Number(w.escrow_balance ?? 0),
      ]),
    );
    for (const p of payoutRows) {
      const key = `${p.user_id as string}|${p.currency as string}`;
      const escrow = escrowMap.get(key) ?? 0;
      if ((p.status === "pending" || p.status === "approved") && escrow + 0.001 < Number(p.amount ?? 0)) {
        findings.push({
          check: "Withdrawal without matching hold",
          severity: "high",
          subject: `Payout ${String(p.id).slice(0, 8)}`,
          detail: `Requested ${p.amount} ${p.currency} but only ${escrow} is held in escrow for that wallet.`,
          reference: null,
        });
      }
      if (p.status === "paid") {
        const hasEntry = ledgerRows.some(
          (l) =>
            l.type === "Payout Withdrawal" &&
            String(l.tx_hash ?? "").includes(String(p.id).slice(0, 8)),
        );
        if (!hasEntry) {
          findings.push({
            check: "Completed payout without financial entry",
            severity: "high",
            subject: `Payout ${String(p.id).slice(0, 8)}`,
            detail: "Marked paid but no payout ledger entry is recorded.",
            reference: null,
          });
        }
      }
    }
  }

  // 9. Ledger entry referencing a gateway payment with no order or funding row.
  const orderRefs = new Set(orderRows.map((o) => (o.paystack_ref as string) ?? ""));
  for (const l of ledgerRows) {
    const ref = (l.paystack_ref as string) ?? "";
    if (!ref || l.type === "Wallet Top-Up") continue;
    if (!orderRefs.has(ref)) {
      findings.push({
        check: "Ledger entry without related transaction",
        severity: "medium",
        subject: `${l.type as string} · ${ref}`,
        detail: "Ledger entry cites a gateway reference with no matching order or funding record.",
        reference: ref,
      });
    }
  }

  return findings;
}

async function reconciliationIssueCount(sb: Sb): Promise<number> {
  try {
    return (await collectFindings(sb)).length;
  } catch {
    return 0;
  }
}

export const adminReconciliation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ReconciliationFinding[]> => {
    await assertFinanceRead(context);
    const sb = await adminDb();
    return collectFindings(sb);
  });

// ---------------------------------------------------------------------------
// Payment rail status (operational, no secrets)
// ---------------------------------------------------------------------------

export interface PaymentRailStatus {
  paystackEnabled: boolean;
  flutterwaveEnabled: boolean;
  minipayEnabled: boolean;
  paystackKeyConfigured: boolean;
  paystackLiveKey: boolean;
  flutterwaveKeyConfigured: boolean;
  webhookEventsRecorded: number;
}

export const adminPaymentRailStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PaymentRailStatus> => {
    await assertFinanceRead(context);
    const sb = await adminDb();
    const { data: settings } = await sb
      .from("payment_gateway_settings")
      .select("paystack_enabled, flutterwave_enabled, minipay_enabled")
      .eq("id", 1)
      .maybeSingle();
    const { count } = await sb
      .from("paystack_webhook_events")
      .select("signature", { count: "exact", head: true });

    // Only booleans about credentials ever leave the server — never the keys.
    const psKey = process.env["PAYSTACK_SECRET_KEY"] ?? "";
    const flwKey = process.env["FLUTTERWAVE_SECRET_KEY"] ?? "";

    return {
      paystackEnabled: Boolean(settings?.paystack_enabled),
      flutterwaveEnabled: Boolean(settings?.flutterwave_enabled),
      minipayEnabled: Boolean(settings?.minipay_enabled),
      paystackKeyConfigured: psKey.length > 0,
      paystackLiveKey: psKey.startsWith("sk_live_"),
      flutterwaveKeyConfigured: flwKey.length > 0,
      webhookEventsRecorded: count ?? 0,
    };
  });
