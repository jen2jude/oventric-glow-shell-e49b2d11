import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Forbidden: admin role required");
}

export const adminListSupportTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("support_tickets")
      .select("id, user_id, category, subject, details, status, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    return data ?? [];
  });

export const adminSetTicketStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["open", "in_review", "resolved", "closed"]) }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("support_tickets")
      .update({ status: data.status, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    return { ok: true as const };
  });

export const adminListSupportFeedback = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("support_feedback")
      .select("id, user_id, rating, message, topic, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    return data ?? [];
  });

export const adminListSupportChatUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("support_chat_messages")
      .select("user_id, body, sender, created_at")
      .order("created_at", { ascending: false })
      .limit(400);
    const seen = new Map<string, { user_id: string; last: string; sender: string; created_at: string }>();
    for (const row of data ?? []) {
      if (!seen.has(row.user_id)) {
        seen.set(row.user_id, { user_id: row.user_id, last: row.body, sender: row.sender, created_at: row.created_at });
      }
    }
    const users = [...seen.values()];
    const ids = users.map((u) => u.user_id);
    let names = new Map<string, string>();
    if (ids.length) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", ids);
      names = new Map((profs ?? []).map((p) => [p.user_id as string, (p.display_name as string) ?? "User"]));
    }
    return users.map((u) => ({ ...u, name: names.get(u.user_id) ?? "User" }));
  });

export const adminListSupportChat = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ userId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("support_chat_messages")
      .select("id, sender, body, created_at, read_at")
      .eq("user_id", data.userId)
      .order("created_at", { ascending: true })
      .limit(300);
    if (error) throw new Error("Could not load the conversation.");
    const unreadIds = (rows ?? [])
      .filter((row) => row.sender === "user" && row.read_at === null)
      .map((row) => row.id);
    if (unreadIds.length) {
      const { error: updateError } = await supabaseAdmin
        .from("support_chat_messages")
        .update({ read_at: new Date().toISOString() })
        .in("id", unreadIds)
        .eq("user_id", data.userId)
        .eq("sender", "user")
        .is("read_at", null);
      if (updateError) throw new Error("Could not mark the conversation as read.");
    }
    return rows ?? [];
  });

export const adminReplySupportChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({ userId: z.string().uuid(), body: z.string().trim().min(1).max(1200) }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("support_chat_messages").insert({
      user_id: data.userId,
      sender: "admin",
      body: data.body,
    });
    return { ok: true as const };
  });
