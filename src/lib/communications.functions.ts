import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";


/* eslint-disable @typescript-eslint/no-explicit-any */

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin role required");
}

async function writeAudit(
  _sb: any,
  actorId: string,
  action: string,
  targetKind: string | null,
  targetId: string | null,
  meta: Record<string, unknown> = {},
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await (supabaseAdmin as any).from("audit_logs").insert({
    actor_id: actorId,
    action,
    target_kind: targetKind,
    target_id: targetId,
    meta,
  });
}

export interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  audience: "everyone" | "authenticated";
  channels: string[];
  active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

/** ---------- Admin: Announcements ---------- */
export const listAnnouncements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const sb = context.supabase as any;
    const { data, error } = await sb
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as AnnouncementRow[];
  });

export const upsertAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (i: {
      id?: string;
      title: string;
      body: string;
      audience: "everyone" | "authenticated";
      channels: string[];
      active: boolean;
    }) => i,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase as any;
    if (data.id) {
      const { error } = await sb
        .from("announcements")
        .update({
          title: data.title,
          body: data.body,
          audience: data.audience,
          channels: data.channels,
          active: data.active,
        })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      await writeAudit(sb, context.userId, "announcement.update", "announcement", data.id);
      return { id: data.id };
    }
    const { data: row, error } = await sb
      .from("announcements")
      .insert({
        title: data.title,
        body: data.body,
        audience: data.audience,
        channels: data.channels,
        active: data.active,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await writeAudit(sb, context.userId, "announcement.create", "announcement", row.id as string);
    return { id: row.id as string };
  });

export const deleteAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase as any;
    const { error } = await sb.from("announcements").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await writeAudit(sb, context.userId, "announcement.delete", "announcement", data.id);
    return { ok: true };
  });

/**
 * Broadcast an announcement into every eligible user's in-app inbox.
 * The announcement row itself is the public source of truth; this fan-out
 * copies it into `notifications` so users get a personal, read/unread record.
 */
export const broadcastAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase as any;

    const { data: ann, error: annErr } = await sb
      .from("announcements")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (annErr) throw new Error(annErr.message);
    if (!ann) throw new Error("Announcement not found");
    if (!ann.active) throw new Error("Activate the announcement before broadcasting");

    // Only signed-in users have a profile row; both audience values target
    // signed-in users for in-app delivery. Anonymous visitors see active
    // public announcements on public surfaces (public policy) but do not
    // receive an inbox entry.
    const { data: profiles, error: pErr } = await sb.from("profiles").select("user_id");
    if (pErr) throw new Error(pErr.message);

    // Fan out to the inbox when the admin selected in-app OR push. Web push is
    // dispatched by the `notifications` insert trigger, so a push-only
    // announcement still needs the notification rows to exist.
    const channels = Array.isArray(ann.channels) ? (ann.channels as string[]) : [];
    const wantsInApp = channels.includes("in_app");
    const wantsPush = channels.includes("push");

    const rows =
      wantsInApp || wantsPush
        ? ((profiles ?? []) as Array<{ user_id: string }>).map((p) => ({
            user_id: p.user_id,
            kind: "announcement",
            title: ann.title,
            body: ann.body,
            from_user_id: context.userId,
          }))
        : [];



    let delivered = 0;
    if (rows.length) {
      // chunk to stay well under any request limits
      const size = 500;
      for (let i = 0; i < rows.length; i += size) {
        const chunk = rows.slice(i, i + size);
        const { error } = await sb.from("notifications").insert(chunk);
        if (error) throw new Error(error.message);
        delivered += chunk.length;
      }
    }

    await writeAudit(sb, context.userId, "announcement.broadcast", "announcement", data.id, {
      delivered,
      channels: ann.channels,
    });
    return { delivered };
  });

/** ---------- Admin: Direct messages / targeted notifications ---------- */
export const sendDirectMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (i: {
      recipients: string[]; // user_id list, or usernames if starts with '@'
      title: string;
      body: string;
      link?: string;
      kind?: "system" | "direct_message" | "alert";
    }) => i,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase as any;

    // Resolve usernames to user_ids
    const raw = data.recipients.map((r) => r.trim()).filter(Boolean);
    const usernames = raw.filter((r) => r.startsWith("@")).map((r) => r.slice(1));
    const ids = raw.filter((r) => !r.startsWith("@"));
    if (usernames.length) {
      const { data: rows, error } = await sb
        .from("profiles")
        .select("user_id, username")
        .in("username", usernames);
      if (error) throw new Error(error.message);
      for (const row of (rows ?? []) as Array<{ user_id: string }>) ids.push(row.user_id);
    }
    const unique = Array.from(new Set(ids));
    if (!unique.length) throw new Error("No valid recipients");

    const kind = data.kind ?? "direct_message";
    const rows = unique.map((uid) => ({
      user_id: uid,
      kind,
      title: data.title,
      body: data.body,
      link: data.link ?? null,
      from_user_id: context.userId,
    }));
    const { error } = await sb.from("notifications").insert(rows);
    if (error) throw new Error(error.message);

    await writeAudit(sb, context.userId, "message.direct", "notification", null, {
      count: unique.length,
      kind,
    });
    return { delivered: unique.length };
  });

export const listRecentNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const sb = context.supabase as any;
    const { data, error } = await sb
      .from("notifications")
      .select("id, user_id, kind, title, body, from_user_id, read_at, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** ---------- User-facing (used by inbox drawer, optional) ---------- */
export const myNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const { data, error } = await sb
      .from("notifications")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { error } = await sb
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const markAllNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const { error } = await sb
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", context.userId)
      .is("read_at", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** ---------- Comms Media (rich body images) ----------
 * Admin-only uploader that lands files in the private `post-media` bucket
 * under a `comms/` prefix, then returns a long-lived signed URL so the image
 * can be embedded inside announcement / DM HTML bodies.
 */
export const getCommsMediaUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ filename: z.string().min(1).max(200) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const safe = data.filename.replace(/[^a-zA-Z0-9._-]/g, "_") || "file";
    const path = `comms/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
    const { data: signed, error } = await (supabaseAdmin as any).storage
      .from("post-media")
      .createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    return { path, token: signed.token as string, signedUrl: signed.signedUrl as string };
  });

/** Long-lived (1 year) signed URL for an embedded comms image. */
export const getCommsMediaSignedUrl = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ path: z.string().min(1).max(500) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed } = await (supabaseAdmin as any).storage
      .from("post-media")
      .createSignedUrl(data.path, 60 * 60 * 24 * 365);
    return { url: signed?.signedUrl ?? null };
  });
