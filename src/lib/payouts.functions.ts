import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isSupportedCurrency } from "@/lib/currency/africa";

export type TransferCurrency = "NGN" | "GHS";
export type TransferMethod = "bank" | "momo";

async function writePayoutAudit(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _sb: any,
  actorId: string,
  action: "payout.approve" | "payout.reject" | "payout.mark_paid",
  payoutId: string,
  meta: Record<string, unknown>,
) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await (supabaseAdmin as any).from("audit_logs").insert({
      actor_id: actorId,
      action,
      target_kind: "payout_request",
      target_id: payoutId,
      meta,
    });
  } catch (e) {
    // Never let audit failure block the action; log server-side.
    console.error("[payout audit] insert failed", e);
  }
}

export interface PayoutAuditEntry {
  id: string;
  action: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_username: string | null;
  created_at: string;
  meta: Record<string, string | number | boolean | null>;
}

export type PayoutCurrency = string;
export type PayoutMethod = "bank" | "momo" | "wire";
export type PayoutStatus = "pending" | "approved" | "rejected" | "paid" | "cancelled";

export interface PayoutDestination {
  // NGN bank
  bank_name?: string;
  bank_code?: string;
  account_number?: string;
  account_name?: string;
  // GHS momo
  network?: "MTN" | "Vodafone" | "AirtelTigo";
  phone?: string;
  // USD wire
  beneficiary_name?: string;
  beneficiary_address?: string;
  swift?: string;
  routing?: string;
  iban?: string;
  bank_country?: string;
}

export interface PayoutDTO {
  id: string;
  user_id: string;
  currency: PayoutCurrency;
  amount: number;
  method: PayoutMethod;
  destination: PayoutDestination;
  status: PayoutStatus;
  admin_note: string | null;
  reject_reason: string | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
  requester_name?: string | null;
  requester_username?: string | null;
  requester_email?: string | null;
  requester_country?: string | null;
  kyc_completed_at?: string | null;
  verification_tier?: number | null;
  wallet_available_now?: number | null;
  wallet_escrow_now?: number | null;
  balance_before_request?: number | null;
}


export interface CreatePayoutInput {
  currency: PayoutCurrency;
  amount: number;
  method: PayoutMethod;
  destination: PayoutDestination;
}

function sanitizeDestination(m: PayoutMethod, d: PayoutDestination): PayoutDestination {
  const clean: PayoutDestination = {};
  const s = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 200) : undefined);
  if (m === "bank") {
    clean.bank_name = s(d.bank_name);
    clean.bank_code = s(d.bank_code);
    clean.account_number = s(d.account_number);
    clean.account_name = s(d.account_name);
    if (!clean.bank_name || !clean.account_number || !clean.account_name) {
      throw new Error("Bank name, account number and account name are required");
    }
    if (!/^\d{6,20}$/.test(clean.account_number)) {
      throw new Error("Account number must be 6–20 digits");
    }
  } else if (m === "momo") {
    clean.network = (["MTN", "Vodafone", "AirtelTigo"] as const).includes(d.network as never)
      ? (d.network as PayoutDestination["network"])
      : undefined;
    clean.phone = s(d.phone);
    clean.account_name = s(d.account_name);
    if (!clean.network || !clean.phone || !clean.account_name) {
      throw new Error("Network, phone number and account name are required");
    }
    if (!/^\+?\d{9,15}$/.test(clean.phone.replace(/\s/g, ""))) {
      throw new Error("Enter a valid mobile money phone number");
    }
  } else if (m === "wire") {
    clean.beneficiary_name = s(d.beneficiary_name);
    clean.bank_name = s(d.bank_name);
    clean.account_number = s(d.account_number) || s(d.iban);
    clean.iban = s(d.iban);
    clean.swift = s(d.swift);
    clean.routing = s(d.routing);
    clean.bank_country = s(d.bank_country);
    clean.beneficiary_address = s(d.beneficiary_address);
    if (!clean.beneficiary_name || !clean.bank_name || !clean.account_number || !clean.swift) {
      throw new Error("Beneficiary name, bank name, account/IBAN and SWIFT are required");
    }
  }
  return clean;
}

export const createPayoutRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: CreatePayoutInput) => {
    const currency = input?.currency;
    const method = input?.method;
    const amount = Number(input?.amount);
    if (!isSupportedCurrency(currency)) throw new Error("Invalid currency");
    if (!["bank", "momo", "wire"].includes(method)) throw new Error("Invalid method");
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Amount must be positive");
    const destination = sanitizeDestination(method, input?.destination ?? {});
    return { currency, method, amount: Math.round(amount * 100) / 100, destination };
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: newId, error } = await supabase.rpc("payout_request_create", {
      _currency: data.currency,
      _amount: data.amount,
      _method: data.method,
      _destination: data.destination as never,
    });
    if (error) throw new Error(error.message);
    return { id: newId as unknown as string };
  });

export const listMyPayouts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("payout_requests")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as PayoutDTO[];
  });

export const cancelMyPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => ({ id: String(input?.id ?? "") }))
  .handler(async ({ data, context }) => {
    // Ownership, pending-state, escrow refund and ledger update all happen
    // inside one SECURITY DEFINER transaction — the client only names the id.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { error } = await sb.rpc("payout_request_cancel_own", { _id: data.id });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export interface AdminListPayoutsInput {
  status?: PayoutStatus | "ALL";
}

export const adminListPayouts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: AdminListPayoutsInput) => ({
    status: (input?.status ?? "ALL") as PayoutStatus | "ALL",
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin, error: roleErr } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Forbidden");

    let q = supabase
      .from("payout_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status !== "ALL") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const userIds = Array.from(new Set((rows ?? []).map((r) => r.user_id as string)));
    let profileMap: Record<string, {
      display_name: string | null;
      username: string | null;
      country: string | null;

      kyc_completed_at: string | null;
      verification_tier: number | null;
    }> = {};
    let walletMap: Record<string, { available: number; escrow: number }> = {};
    if (userIds.length) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const [profRes, walletRes] = await Promise.all([
        supabaseAdmin
          .from("profiles")
          .select("user_id, display_name, username, country, kyc_completed_at, verification_tier")
          .in("user_id", userIds),
        supabaseAdmin
          .from("wallets")
          .select("user_id, currency, available_balance, escrow_balance")
          .in("user_id", userIds),
      ]);
      profileMap = Object.fromEntries(
        (profRes.data ?? []).map((p) => [
          p.user_id as string,
          {
            display_name: (p.display_name as string) ?? null,
            username: (p.username as string) ?? null,
            
            country: (p.country as string) ?? null,
            kyc_completed_at: (p.kyc_completed_at as string) ?? null,
            verification_tier: p.verification_tier == null ? null : Number(p.verification_tier),
          },
        ]),
      );
      for (const w of walletRes.data ?? []) {
        const key = `${w.user_id}|${w.currency}`;
        walletMap[key] = {
          available: Number(w.available_balance ?? 0),
          escrow: Number(w.escrow_balance ?? 0),
        };
      }
    }

    return (rows ?? []).map((r) => {
      const p = profileMap[r.user_id as string];
      const w = walletMap[`${r.user_id}|${r.currency}`];
      const available = w?.available ?? 0;
      const escrow = w?.escrow ?? 0;
      const amount = Number(r.amount ?? 0);
      // For pending/approved requests, escrow contains this payout — balance before = available + amount
      const balanceBefore = ["pending", "approved"].includes(r.status as string)
        ? available + amount
        : available;
      return {
        ...(r as unknown as PayoutDTO),
        requester_name: p?.display_name ?? null,
        requester_username: p?.username ?? null,
        
        requester_country: p?.country ?? null,
        kyc_completed_at: p?.kyc_completed_at ?? null,
        verification_tier: p?.verification_tier ?? null,
        wallet_available_now: available,
        wallet_escrow_now: escrow,
        balance_before_request: balanceBefore,
      };
    }) as PayoutDTO[];
  });


export const adminApprovePayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; note?: string }) => ({
    id: String(input?.id ?? ""),
    note: typeof input?.note === "string" ? input.note.trim().slice(0, 500) : "",
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { error } = await supabase
      .from("payout_requests")
      .update({ status: "approved", admin_note: data.note || null, processed_by: userId })
      .eq("id", data.id)
      .in("status", ["pending"]);
    if (error) throw new Error(error.message);
    await writePayoutAudit(supabase, userId, "payout.approve", data.id, {
      note: data.note || null,
    });
    return { ok: true };
  });

export const adminRejectPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; reason: string }) => ({
    id: String(input?.id ?? ""),
    reason: String(input?.reason ?? "").trim().slice(0, 500) || "Rejected by admin",
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { error } = await supabase.rpc("payout_request_reject", {
      _id: data.id,
      _reason: data.reason,
    });
    if (error) throw new Error(error.message);
    await writePayoutAudit(supabase, userId, "payout.reject", data.id, {
      reason: data.reason,
    });
    return { ok: true };
  });

export const adminMarkPayoutPaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; note?: string }) => ({
    id: String(input?.id ?? ""),
    note: typeof input?.note === "string" ? input.note.trim().slice(0, 500) : "",
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { error } = await supabase.rpc("payout_request_mark_paid", {
      _id: data.id,
      _note: data.note,
    });
    if (error) throw new Error(error.message);
    await writePayoutAudit(supabase, userId, "payout.mark_paid", data.id, {
      note: data.note || null,
    });
    return { ok: true };
  });

/**
 * Return the audit trail for a single payout request, most-recent first,
 * enriched with the acting admin's display name / username when available.
 */
export const adminListPayoutAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { payoutId: string }) => ({
    payoutId: String(input?.payoutId ?? ""),
  }))
  .handler(async ({ data, context }): Promise<PayoutAuditEntry[]> => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    if (!data.payoutId) return [];

    const { data: rows, error } = await supabase
      .from("audit_logs")
      .select("id, action, actor_id, created_at, meta")
      .eq("target_kind", "payout_request")
      .eq("target_id", data.payoutId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);

    const actorIds = Array.from(
      new Set((rows ?? []).map((r) => r.actor_id as string | null).filter((v): v is string => !!v)),
    );
    let nameMap: Record<string, { display_name: string | null; username: string | null }> = {};
    if (actorIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, display_name, username")
        .in("user_id", actorIds);
      nameMap = Object.fromEntries(
        (profs ?? []).map((p) => [
          p.user_id as string,
          {
            display_name: (p.display_name as string) ?? null,
            username: (p.username as string) ?? null,
          },
        ]),
      );
    }

    return (rows ?? []).map((r) => ({
      id: r.id as string,
      action: r.action as string,
      actor_id: (r.actor_id as string | null) ?? null,
      actor_name: r.actor_id ? nameMap[r.actor_id as string]?.display_name ?? null : null,
      actor_username: r.actor_id ? nameMap[r.actor_id as string]?.username ?? null : null,
      created_at: r.created_at as string,
      meta: (r.meta as Record<string, string | number | boolean | null>) ?? {},
    }));
  });

// ─────────────────────────────────────────────────────────────────────────────
// Live Paystack payout flow (NGN / GHS)
// ─────────────────────────────────────────────────────────────────────────────

export interface PayoutRecipientDTO {
  id: string;
  currency: TransferCurrency;
  method: TransferMethod;
  bank_name: string | null;
  bank_code: string | null;
  account_number: string | null;
  account_name: string;
  momo_network: string | null;
  phone: string | null;
  paystack_recipient_code: string;
  is_default: boolean;
  created_at: string;
}

export const listBanksForCurrency = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { currency: TransferCurrency }) => ({
    currency: (input?.currency === "GHS" ? "GHS" : "NGN") as TransferCurrency,
  }))
  .handler(async ({ data }) => {
    const { listBanks: psListBanks } = await import("./paystack-transfers.server");
    const banks = await psListBanks(data.currency);
    return banks.map((b) => ({ name: b.name, code: b.code, type: b.type }));
  });

export const resolveBankAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { account_number: string; bank_code: string }) => ({
    account_number: String(input?.account_number ?? "").replace(/\D/g, "").slice(0, 20),
    bank_code: String(input?.bank_code ?? "").trim(),
  }))
  .handler(async ({ data }) => {
    if (!data.account_number || !data.bank_code) throw new Error("Bank and account number required");
    const { resolveAccount: psResolveAccount } = await import("./paystack-transfers.server");
    const res = await psResolveAccount(data);
    return { account_number: res.account_number, account_name: res.account_name };
  });

export const listMyRecipients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PayoutRecipientDTO[]> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("payout_recipients")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      id: r.id as string,
      currency: r.currency as TransferCurrency,
      method: r.method as TransferMethod,
      bank_name: (r.bank_name as string) ?? null,
      bank_code: (r.bank_code as string) ?? null,
      account_number: (r.account_number as string) ?? null,
      account_name: r.account_name as string,
      momo_network: (r.momo_network as string) ?? null,
      phone: (r.phone as string) ?? null,
      paystack_recipient_code: r.paystack_recipient_code as string,
      is_default: !!r.is_default,
      created_at: r.created_at as string,
    }));
  });

export interface CreateRecipientInput {
  currency: TransferCurrency;
  method: TransferMethod;
  bank_code?: string;
  bank_name?: string;
  account_number?: string;
  account_name: string;
  momo_network?: "MTN" | "Vodafone" | "AirtelTigo";
  phone?: string;
}

export const createMyRecipient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: CreateRecipientInput) => {
    const currency: TransferCurrency = input?.currency === "GHS" ? "GHS" : "NGN";
    const method: TransferMethod = input?.method === "momo" ? "momo" : "bank";
    const account_name = String(input?.account_name ?? "").trim().slice(0, 200);
    if (!account_name) throw new Error("Account name required");
    if (method === "bank") {
      const bank_code = String(input?.bank_code ?? "").trim();
      const bank_name = String(input?.bank_name ?? "").trim().slice(0, 120);
      const account_number = String(input?.account_number ?? "").replace(/\D/g, "").slice(0, 20);
      if (!bank_code || !bank_name || !account_number) throw new Error("Bank name, code and account number required");
      return { currency, method, bank_code, bank_name, account_number, account_name } as const;
    }
    if (currency !== "GHS") throw new Error("Mobile money is only supported for GHS");
    const momo_network = input?.momo_network;
    const phone = String(input?.phone ?? "").replace(/\D/g, "").slice(0, 20);
    if (!momo_network || !phone) throw new Error("Network and phone number required");
    return { currency, method, momo_network, phone, account_name } as const;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { createTransferRecipient: psCreateRecipient } = await import("./paystack-transfers.server");

    let recipientCode: string;
    if (data.method === "bank") {
      const type = data.currency === "NGN" ? "nuban" : "ghipss";
      const res = await psCreateRecipient({
        type,
        name: data.account_name,
        account_number: data.account_number,
        bank_code: data.bank_code,
        currency: data.currency,
      });
      recipientCode = res.recipient_code;
    } else {
      const netMap: Record<string, string> = { MTN: "MTN", Vodafone: "VOD", AirtelTigo: "ATL" };
      const res = await psCreateRecipient({
        type: "mobile_money",
        name: data.account_name,
        account_number: data.phone,
        bank_code: netMap[data.momo_network] ?? "MTN",
        currency: "GHS",
      });
      recipientCode = res.recipient_code;
    }

    const row = {
      user_id: userId,
      currency: data.currency,
      method: data.method,
      bank_name: data.method === "bank" ? data.bank_name : null,
      bank_code: data.method === "bank" ? data.bank_code : null,
      account_number: data.method === "bank" ? data.account_number : null,
      account_name: data.account_name,
      momo_network: data.method === "momo" ? data.momo_network : null,
      phone: data.method === "momo" ? data.phone : null,
      paystack_recipient_code: recipientCode,
      verified_at: new Date().toISOString(),
    };

    const { data: inserted, error } = await supabase
      .from("payout_recipients")
      .insert(row)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted.id as string, paystack_recipient_code: recipientCode };
  });

export const deleteMyRecipient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => ({ id: String(input?.id ?? "") }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("payout_recipients")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const estimatePayoutFee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { currency: TransferCurrency; method: TransferMethod; amount: number }) => ({
    currency: (input?.currency === "GHS" ? "GHS" : "NGN") as TransferCurrency,
    method: (input?.method === "momo" ? "momo" : "bank") as TransferMethod,
    amount: Math.max(0, Number(input?.amount ?? 0)),
  }))
  .handler(async ({ data }) => {
    const { estimateTransferFee } = await import("./paystack-transfers.server");
    const fee = estimateTransferFee(data.currency, data.method, data.amount);
    const net = Math.max(0, Number((data.amount - fee).toFixed(2)));
    return { fee, net };
  });

export interface CreateLivePayoutInput {
  recipientId: string;
  amount: number;
}

export const createLivePayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: CreateLivePayoutInput) => ({
    recipientId: String(input?.recipientId ?? ""),
    amount: Math.round(Number(input?.amount ?? 0) * 100) / 100,
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!data.recipientId) throw new Error("Recipient required");
    if (!(data.amount > 0)) throw new Error("Amount must be greater than zero");
    const { estimateTransferFee, initiateTransfer: psInitiateTransfer, toSubunit } = await import(
      "./paystack-transfers.server"
    );

    const { data: rec, error: recErr } = await supabase
      .from("payout_recipients")
      .select("*")
      .eq("id", data.recipientId)
      .eq("user_id", userId)
      .maybeSingle();
    if (recErr) throw new Error(recErr.message);
    if (!rec) throw new Error("Recipient not found");

    const currency = rec.currency as TransferCurrency;
    const method = rec.method as TransferMethod;
    const fee = estimateTransferFee(currency, method, data.amount);
    const net = Number((data.amount - fee).toFixed(2));
    if (net <= 0) throw new Error("Amount is too small to cover the transfer fee");

    const { data: prof } = await supabase
      .from("profiles")
      .select("kyc_completed_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (!prof || !prof.kyc_completed_at) {
      throw new Error("Complete identity verification before requesting a payout");
    }

    const destination: PayoutDestination =
      method === "bank"
        ? {
            bank_name: rec.bank_name as string,
            bank_code: rec.bank_code as string,
            account_number: rec.account_number as string,
            account_name: rec.account_name as string,
          }
        : {
            network: rec.momo_network as PayoutDestination["network"],
            phone: rec.phone as string,
            account_name: rec.account_name as string,
          };

    const { data: newId, error } = await supabase.rpc("payout_request_create_live", {
      _currency: currency,
      _amount: data.amount,
      _fee: fee,
      _net: net,
      _method: method,
      _destination: destination as never,
      _recipient_id: rec.id as string,
      _recipient_code: rec.paystack_recipient_code as string,
    });
    if (error) throw new Error(error.message);
    const payoutId = newId as unknown as string;

    try {
      const ref = `PYT_${payoutId.replace(/-/g, "").slice(0, 24)}`;
      const result = await new Promise<Awaited<ReturnType<typeof psInitiateTransfer>>>((resolve, reject) => {
        const controller = new AbortController();
        const timer = setTimeout(() => {
          controller.abort();
          reject(new Error("Transfer provider timed out. Your wallet was refunded; please try again."));
        }, 25_000);
        psInitiateTransfer({
          amountSubunit: toSubunit(net),
          recipient_code: rec.paystack_recipient_code as string,
          reason: `Oventric payout ${payoutId.slice(0, 8)}`,
          reference: ref,
          signal: controller.signal,
        })
          .then((value) => {
            clearTimeout(timer);
            resolve(value);
          })
          .catch((err) => {
            clearTimeout(timer);
            reject(err);
          });
      });
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("payout_requests")
        .update({ paystack_transfer_code: result.transfer_code })
        .eq("id", payoutId);
      return { id: payoutId, status: result.status, fee, net, currency };
    } catch (transferErr) {
      const reason =
        transferErr instanceof Error
          ? transferErr.message.slice(0, 200)
          : "Transfer initialisation failed";
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: payoutRow } = await supabaseAdmin
          .from("payout_requests")
          .select("user_id, amount, currency")
          .eq("id", payoutId)
          .maybeSingle();
        if (payoutRow) {
          const { data: walletRow } = await supabaseAdmin
            .from("wallets")
            .select("available_balance, escrow_balance")
            .eq("user_id", payoutRow.user_id as string)
            .eq("currency", payoutRow.currency as string)
            .maybeSingle();
          const amount = Number(payoutRow.amount ?? 0);
          if (walletRow && amount > 0) {
            const currentAvailable = Number(walletRow.available_balance ?? 0);
            const currentEscrow = Number(walletRow.escrow_balance ?? 0);
            await supabaseAdmin
              .from("wallets")
              .update({
                available_balance: Number((currentAvailable + amount).toFixed(2)),
                escrow_balance: Number(Math.max(0, currentEscrow - amount).toFixed(2)),
                updated_at: new Date().toISOString(),
              })
              .eq("user_id", payoutRow.user_id as string)
              .eq("currency", payoutRow.currency as string);
          }
          await supabaseAdmin
            .from("wallet_transactions")
            .update({ status: "failed" })
            .eq("user_id", payoutRow.user_id as string)
            .eq("type", "Payout Withdrawal")
            .eq("tx_hash", `PYT-${payoutId.slice(0, 8)}`);
        }
        await supabaseAdmin
          .from("payout_requests")
          .update({
            status: "rejected",
            reject_reason: reason,
            processed_at: new Date().toISOString(),
          })
          .eq("id", payoutId);
      } catch (rollbackErr) {
        console.error("[createLivePayout] refund rollback failed", rollbackErr);
      }
      throw transferErr;
    }
  });



export const adminGetPendingPayoutCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) return { count: 0 };
    const { count, error } = await supabase
      .from("payout_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    if (error) return { count: 0 };
    return { count: count ?? 0 };
  });

/* ------------------------------------------------------------------ *
 * USD withdrawals
 *
 * Wallets are always held in the user's home currency. A USD withdrawal
 * converts the requested USD amount back into the home currency at live
 * FX, debits that wallet and files a USD payout request for finance to
 * settle off-platform (Binance / Bybit / wallet address).
 * ------------------------------------------------------------------ */

export type UsdPayoutChannel = "binance" | "bybit" | "wallet";

export interface CreateUsdPayoutInput {
  channel: UsdPayoutChannel;
  /** Binance ID, Bybit UID or wallet address. */
  identifier: string;
  accountName?: string;
  /** Optional network label for raw wallet payouts, e.g. TRC20. */
  network?: string;
  /** Amount in USD the user wants to receive. */
  amountUsd: number;
}

export const createUsdPayoutRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: CreateUsdPayoutInput) => {
    const channel = input?.channel;
    if (!["binance", "bybit", "wallet"].includes(channel)) {
      throw new Error("Choose a USD payout destination");
    }
    const identifier = String(input?.identifier ?? "").trim().slice(0, 200);
    if (identifier.length < 4) throw new Error("Enter a valid account ID or wallet address");
    const amountUsd = Math.round(Number(input?.amountUsd ?? 0) * 100) / 100;
    if (!Number.isFinite(amountUsd) || amountUsd <= 0) throw new Error("Amount must be positive");
    if (amountUsd < 5) throw new Error("Minimum USD withdrawal is $5");
    return {
      channel: channel as UsdPayoutChannel,
      identifier,
      accountName: String(input?.accountName ?? "").trim().slice(0, 200),
      network: String(input?.network ?? "").trim().slice(0, 40),
      amountUsd,
    };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { currencyForCountry } = await import("@/lib/currency/africa");
    const { resolveFxRates } = await import("./fx.server");

    const { data: prof } = await supabase
      .from("profiles")
      .select("country")
      .eq("user_id", userId)
      .maybeSingle();
    const homeCurrency = currencyForCountry((prof?.country as string) ?? null);

    const fx = await resolveFxRates();
    const rate = homeCurrency === "USD" ? 1 : Number(fx.rates?.[homeCurrency] ?? 0);
    if (!(rate > 0)) throw new Error("Exchange rate unavailable, please try again shortly");
    const sourceAmount = Math.round(data.amountUsd * rate * 100) / 100;

    const { data: newId, error } = await supabase.rpc("payout_request_create_usd", {
      _usd_amount: data.amountUsd,
      _source_currency: homeCurrency,
      _source_amount: sourceAmount,
      _channel: data.channel,
      _destination: {
        identifier: data.identifier,
        account_name: data.accountName || null,
        network: data.network || null,
        rate_used: rate,
      } as never,
    });
    if (error) throw new Error(error.message);
    return {
      id: newId as unknown as string,
      amountUsd: data.amountUsd,
      sourceCurrency: homeCurrency,
      sourceAmount,
      rate,
    };
  });
