import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface AdminCryptoDepositRow {
  id: string;
  userId: string;
  userName: string | null;
  currency: string;
  amount: number;
  usdAmount: number;
  payCurrency: string;
  payAmount: number | null;
  receivedAmount: number | null;
  status: string;
  providerPaymentId: string;
  creditReference: string | null;
  note: string | null;
  createdAt: string;
}

async function assertFinanceViewer(ctx: { supabase: unknown; userId: string }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = ctx.supabase as any;
  for (const role of ["admin", "finance", "support"]) {
    const { data: ok } = await sb.rpc("has_role", { _user_id: ctx.userId, _role: role });
    if (ok) return;
  }
  throw new Error("Forbidden: requires admin, finance or support");
}

/** Detection only — no crediting or editing from the admin console. */
export const adminListCryptoDeposits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { status?: string }) => ({ status: String(input?.status ?? "all") }))
  .handler(async ({ data, context }): Promise<AdminCryptoDepositRow[]> => {
    await assertFinanceViewer(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let query = supabaseAdmin
      .from("crypto_deposits")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status !== "all") query = query.eq("status", data.status);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    const list = rows ?? [];

    const ids = [...new Set(list.map((r) => String(r.user_id)))];
    const names = new Map<string, string>();
    if (ids.length) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", ids);
      for (const p of profiles ?? []) names.set(String(p.user_id), p.display_name ?? "");
    }

    return list.map((r) => ({
      id: String(r.id),
      userId: String(r.user_id),
      userName: names.get(String(r.user_id)) || null,
      currency: String(r.currency),
      amount: Number(r.amount ?? 0),
      usdAmount: Number(r.usd_amount ?? 0),
      payCurrency: String(r.pay_currency),
      payAmount: r.pay_amount === null ? null : Number(r.pay_amount),
      receivedAmount: r.received_amount === null ? null : Number(r.received_amount),
      status: String(r.status),
      providerPaymentId: String(r.provider_payment_id),
      creditReference: r.credit_reference ?? null,
      note: r.note ?? null,
      createdAt: String(r.created_at),
    }));
  });
