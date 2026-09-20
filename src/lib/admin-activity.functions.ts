import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { canAccessSection, type ManagementRole } from "@/lib/admin-roles";

export const ADMIN_ACTIVITY_SECTIONS = [
  "/admin/users",
  "/admin/sellers",
  "/admin/seller-verification",
  "/admin/products",
  "/admin/orders",
  "/admin/payments",
  "/admin/ledger",
  "/admin/system-wallets",
  "/admin/payouts",
  "/admin/refunds",
  "/admin/disputes",
  "/admin/cashback-wallet",
  "/admin/reconciliation",
  "/admin/referrals",
  "/admin/reports",
  "/admin/reviews",
  "/admin/support",
] as const;

export type AdminActivitySection = (typeof ADMIN_ACTIVITY_SECTIONS)[number];
export type AdminActivityCounts = Partial<Record<AdminActivitySection, number>>;

const SectionInput = z.object({
  section: z.enum(ADMIN_ACTIVITY_SECTIONS),
});

async function managementRoles(context: { supabase: unknown; userId: string }) {
  // Read roles through the signed-in client first; the role table is intentionally auth-only.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const authDb = context.supabase as any;
  const { data: roleRows, error } = await authDb
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);
  if (error) throw new Error("Unable to verify dashboard access");
  const valid = new Set<ManagementRole>(["admin", "moderator", "finance", "content", "support"]);
  const roles = ((roleRows ?? []) as Array<{ role: ManagementRole }>)
    .map((row) => row.role)
    .filter((role) => valid.has(role));
  if (roles.length === 0) throw new Error("Forbidden: management access required");
  return roles;
}

async function exactCount(query: PromiseLike<{ count: number | null; error: { message: string } | null }>) {
  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** Role-filtered, backend-authoritative counts for every active admin work stream. */
export const getAdminActivityCounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminActivityCounts> => {
    const roles = await managementRoles(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseAdmin as any;
    const { data: markers, error: markerError } = await db
      .from("admin_activity_reads")
      .select("section, seen_at")
      .eq("user_id", context.userId);
    if (markerError) throw new Error(markerError.message);
    const seen = new Map<string, string>(
      ((markers ?? []) as Array<{ section: string; seen_at: string }>).map((row) => [
        row.section,
        row.seen_at,
      ]),
    );
    const since = (section: AdminActivitySection) => seen.get(section) ?? "1970-01-01T00:00:00.000Z";
    const allowed = (section: AdminActivitySection) => canAccessSection(section, roles);

    const tasks: Array<Promise<[AdminActivitySection, number]>> = [];
    const add = (section: AdminActivitySection, promise: Promise<number>) => {
      // One failing queue must never blank out every other badge.
      if (allowed(section)) tasks.push(promise.then((count) => [section, count] as [AdminActivitySection, number]).catch(() => [section, 0] as [AdminActivitySection, number]));
    };


    add("/admin/users", exactCount(db.from("profiles").select("user_id", { count: "exact", head: true }).gt("created_at", since("/admin/users")).is("deleted_at", null)));
    add("/admin/sellers", exactCount(db.from("profiles").select("user_id", { count: "exact", head: true }).gt("updated_at", since("/admin/sellers")).not("shop_name", "is", null).is("deleted_at", null)));
    add("/admin/seller-verification", exactCount(db.from("seller_verification_requests").select("id", { count: "exact", head: true }).in("status", ["pending", "under_review"])));
    add("/admin/products", exactCount(db.from("products").select("id", { count: "exact", head: true }).eq("status", "pending")));
    add("/admin/orders", exactCount(db.from("orders").select("id", { count: "exact", head: true }).gt("created_at", since("/admin/orders"))));
    add("/admin/payments", Promise.all([
      exactCount(db.from("orders").select("id", { count: "exact", head: true }).eq("status", "paid").gt("paid_at", since("/admin/payments"))),
      exactCount(db.from("wallet_transactions").select("id", { count: "exact", head: true }).eq("type", "Wallet Top-Up").eq("status", "success").gt("occurred_at", since("/admin/payments"))),
    ]).then(([orders, topups]) => orders + topups));
    add("/admin/ledger", exactCount(db.from("wallet_transactions").select("id", { count: "exact", head: true }).gt("occurred_at", since("/admin/ledger"))));
    add("/admin/system-wallets", exactCount(db.from("system_wallet_transactions").select("id", { count: "exact", head: true }).gt("created_at", since("/admin/system-wallets"))));
    add("/admin/payouts", exactCount(db.from("payout_requests").select("id", { count: "exact", head: true }).in("status", ["pending", "approved"])));
    add("/admin/refunds", exactCount(db.from("orders").select("id", { count: "exact", head: true }).gt("refunded_at", since("/admin/refunds"))));
    add("/admin/disputes", exactCount(db.from("order_disputes").select("id", { count: "exact", head: true }).eq("status", "open")));
    add("/admin/cashback-wallet", exactCount(db.from("wallet_transactions").select("id", { count: "exact", head: true }).eq("type", "Cashback Earned").gt("occurred_at", since("/admin/cashback-wallet"))));
    add("/admin/reconciliation", exactCount(db.from("wallet_transactions").select("id", { count: "exact", head: true }).eq("status", "failed").gt("updated_at", since("/admin/reconciliation"))));
    add("/admin/referrals", exactCount(db.from("referrals").select("invitee_id", { count: "exact", head: true }).gt("created_at", since("/admin/referrals"))));
    add("/admin/reports", exactCount(db.from("post_reports").select("id", { count: "exact", head: true }).eq("status", "pending")));
    add("/admin/reviews", exactCount(db.from("product_reviews").select("id", { count: "exact", head: true }).gt("created_at", since("/admin/reviews"))));
    add("/admin/support", Promise.all([
      exactCount(db.from("support_tickets").select("id", { count: "exact", head: true }).in("status", ["open", "in_review"])),
      exactCount(db.from("support_chat_messages").select("id", { count: "exact", head: true }).eq("sender", "user").is("read_at", null)),
    ]).then(([tickets, chats]) => tickets + chats));

    return Object.fromEntries(await Promise.all(tasks)) as AdminActivityCounts;
  });

/** Marks only the signed-in manager's current section as seen. */
export const markAdminActivitySeen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SectionInput.parse(input))
  .handler(async ({ data, context }) => {
    const roles = await managementRoles(context);
    if (!canAccessSection(data.section, roles)) throw new Error("Forbidden: section access required");
    const now = new Date().toISOString();
    // The RLS policy also enforces that managers can only write their own marker.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = context.supabase as any;
    const { error } = await db.from("admin_activity_reads").upsert(
      { user_id: context.userId, section: data.section, seen_at: now, updated_at: now },
      { onConflict: "user_id,section" },
    );
    if (error) throw new Error(error.message);
    return { ok: true as const, seenAt: now };
  });