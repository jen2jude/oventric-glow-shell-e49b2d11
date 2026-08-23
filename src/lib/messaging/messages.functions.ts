import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { signAvatars } from "./avatars.server";

export interface ThreadSummary {
  peerId: string;
  peerName: string;
  peerSlug: string;
  peerInitials: string;
  peerGradient: string;
  peerAvatarUrl: string | null;
  preview: string;
  lastAt: string;
  unread: number;
}

export interface PeerProfileLite {
  userId: string;
  name: string;
  slug: string;
  initials: string;
  gradient: string;
  avatarUrl: string | null;
}

export interface DMRow {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string | null;
  media_path: string | null;
  media_type: string | null;
  created_at: string;
  read_at: string | null;
  order_id?: string | null;
}

const GRADIENTS = [
  "from-purple-500 to-pink-500",
  "from-emerald-400 to-teal-500",
  "from-sky-400 to-indigo-500",
  "from-amber-400 to-orange-500",
  "from-fuchsia-500 to-pink-500",
  "from-rose-400 to-red-500",
  "from-cyan-400 to-blue-500",
  "from-lime-400 to-emerald-500",
];

function gradientFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "??";
}

export const listThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ThreadSummary[]> => {
    const me = context.userId;
    const { data: rows, error } = await context.supabase
      .from("direct_messages")
      .select("id, sender_id, recipient_id, body, media_path, created_at, read_at")
      .or(`sender_id.eq.${me},recipient_id.eq.${me}`)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;

    const byPeer = new Map<string, { last: typeof rows[number]; unread: number }>();
    for (const r of rows ?? []) {
      const peer = r.sender_id === me ? r.recipient_id : r.sender_id;
      const cur = byPeer.get(peer);
      const isUnread = r.recipient_id === me && !r.read_at;
      if (!cur) byPeer.set(peer, { last: r, unread: isUnread ? 1 : 0 });
      else if (isUnread) cur.unread += 1;
    }
    if (byPeer.size === 0) return [];

    const peerIds = [...byPeer.keys()];
    const { data: profs, error: pErr } = await context.supabase
      .from("profiles")
      .select("user_id, display_name, username, slug, avatar_path")
      .in("user_id", peerIds);
    if (pErr) throw pErr;

    const avatarByPath = await signAvatars(
      context.supabase,
      (profs ?? []).map((p) => (p as { avatar_path?: string | null }).avatar_path ?? null),
    );

    const pMap = new Map((profs ?? []).map((p) => [p.user_id, p]));
    const out: ThreadSummary[] = peerIds.map((id) => {
      const p = pMap.get(id);
      const name = p?.display_name || p?.username || "Unknown peer";
      const entry = byPeer.get(id)!;
      const preview = entry.last.body ?? (entry.last.media_path ? "📎 Attachment" : "…");
      const ap = (p as { avatar_path?: string | null } | undefined)?.avatar_path ?? null;
      return {
        peerId: id,
        peerName: name,
        peerSlug: p?.slug ?? id,
        peerInitials: initialsFor(name),
        peerGradient: gradientFor(id),
        peerAvatarUrl: ap ? (avatarByPath.get(ap) ?? null) : null,
        preview: preview.length > 90 ? preview.slice(0, 87) + "…" : preview,
        lastAt: entry.last.created_at,
        unread: entry.unread,
      };
    });
    out.sort((a, b) => b.lastAt.localeCompare(a.lastAt));
    return out;
  });

export interface MessagePage {
  rows: DMRow[];
  hasMore: boolean;
}

export const listMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        peerId: z.string().uuid(),
        limit: z.number().int().min(1).max(200).optional(),
        before: z.string().datetime().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<MessagePage> => {
    const me = context.userId;
    const limit = data.limit ?? 30;
    let q = context.supabase
      .from("direct_messages")
      .select("id, sender_id, recipient_id, body, media_path, media_type, created_at, read_at, order_id")
      .or(
        `and(sender_id.eq.${me},recipient_id.eq.${data.peerId}),and(sender_id.eq.${data.peerId},recipient_id.eq.${me})`,
      )
      .order("created_at", { ascending: false })
      .limit(limit + 1);
    if (data.before) q = q.lt("created_at", data.before);
    const { data: rows, error } = await q;
    if (error) throw error;
    const list = (rows ?? []) as DMRow[];
    const hasMore = list.length > limit;
    const page = hasMore ? list.slice(0, limit) : list;
    // Return ascending (oldest → newest) for easy append/prepend in UI.
    page.reverse();
    return { rows: page, hasMore };
  });

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        recipientId: z.string().uuid(),
        body: z.string().trim().max(4000).optional(),
        mediaPath: z.string().max(500).optional(),
        mediaType: z.string().max(64).optional(),
        orderId: z.string().uuid().optional(),
      })
      .refine((v) => (v.body && v.body.length > 0) || v.mediaPath, {
        message: "Message must have a body or media attachment",
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<DMRow> => {
    const { data: row, error } = await context.supabase
      .from("direct_messages")
      .insert({
        sender_id: context.userId,
        recipient_id: data.recipientId,
        body: data.body ?? null,
        media_path: data.mediaPath ?? null,
        media_type: data.mediaType ?? null,
        order_id: data.orderId ?? null,
      })
      .select("id, sender_id, recipient_id, body, media_path, media_type, created_at, read_at, order_id")
      .single();
    if (error) throw error;
    return row as DMRow;
  });

export const markThreadRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ peerId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("direct_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("recipient_id", context.userId)
      .eq("sender_id", data.peerId)
      .is("read_at", null);
    if (error) throw error;
    return { ok: true };
  });

/** Lightweight profile cards (name + real avatar) for a set of user ids. */
export const getPeerProfiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ userIds: z.array(z.string().uuid()).max(100) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<PeerProfileLite[]> => {
    if (!data.userIds.length) return [];
    const { data: profs, error } = await context.supabase
      .from("profiles")
      .select("user_id, display_name, username, slug, avatar_path")
      .in("user_id", data.userIds);
    if (error) throw error;
    const rows = (profs ?? []) as Array<{
      user_id: string;
      display_name: string | null;
      username: string | null;
      slug: string | null;
      avatar_path: string | null;
    }>;
    const avatarByPath = await signAvatars(context.supabase, rows.map((r) => r.avatar_path));
    return rows.map((r) => {
      const name = r.display_name || r.username || "Peer";
      return {
        userId: r.user_id,
        name,
        slug: r.slug ?? r.user_id,
        initials: initialsFor(name),
        gradient: gradientFor(r.user_id),
        avatarUrl: r.avatar_path ? (avatarByPath.get(r.avatar_path) ?? null) : null,
      };
    });
  });


export const resolvePeer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ slug: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: p, error } = await context.supabase
      .from("profiles")
      .select("user_id, display_name, username, slug")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw error;
    if (!p) return null;
    const name = p.display_name || p.username || "Unknown peer";
    return {
      peerId: p.user_id,
      peerName: name,
      peerSlug: p.slug,
      peerInitials: initialsFor(name),
      peerGradient: gradientFor(p.user_id),
    };
  });

/* ------------------------------------------------------------------ *
 * Order-aware chat context
 * ------------------------------------------------------------------ */

export interface PeerOrderContext {
  orderId: string;
  productName: string;
  role: "buyer" | "seller";
  requiresManualDelivery: boolean;
  escrowStatus: string;
  deliveredAt: string | null;
  disputeStatus: string;
  autoReleaseAt: string | null;
  autoRefundAt: string | null;
  payoutReleaseAt: string | null;
  buyerConfirmedAt: string | null;
  displayCurrency: string;
  displayTotal: number;
}

/**
 * The most recent still-open trade between the signed-in user and a peer.
 * Powers the in-chat delivery / confirm-receipt banner so buyers and sellers
 * never need to leave Oventric to complete a digital trade.
 */
export const getPeerOrderContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ peerId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<PeerOrderContext | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const me = context.userId;
    const { data: rows, error } = await supabaseAdmin
      .from("orders")
      .select(
        "id, buyer_id, seller_id, escrow_status, delivered_at, dispute_status, auto_release_at, auto_refund_at, payout_release_at, buyer_confirmed_at, display_currency, display_total, products:product_id (name, requires_manual_delivery)",
      )
      .or(
        `and(buyer_id.eq.${me},seller_id.eq.${data.peerId}),and(buyer_id.eq.${data.peerId},seller_id.eq.${me})`,
      )
      .eq("escrow_status", "held")
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) throw new Error(error.message);
    const o = (rows ?? [])[0] as Record<string, unknown> | undefined;
    if (!o) return null;
    const products = o.products as { name?: string; requires_manual_delivery?: boolean } | null;
    return {
      orderId: o.id as string,
      productName: products?.name ?? "Order",
      role: o.buyer_id === me ? "buyer" : "seller",
      requiresManualDelivery: Boolean(products?.requires_manual_delivery),
      escrowStatus: (o.escrow_status as string) ?? "held",
      deliveredAt: (o.delivered_at as string) ?? null,
      disputeStatus: (o.dispute_status as string) ?? "none",
      autoReleaseAt: (o.auto_release_at as string) ?? null,
      displayCurrency: (o.display_currency as string) ?? "USD",
      displayTotal: Number(o.display_total ?? 0),
    };
  });

/* ------------------------------------------------------------------ *
 * Profile-to-profile composer support (find-or-create DM "thread" +
 * attachment upload/signing). The schema has no explicit threads table —
 * a thread is simply the (me, peer) message pair, so "ensuring" one just
 * resolves the peer's profile and returns the existing history.
 * ------------------------------------------------------------------ */

export interface DirectThreadInfo {
  peerId: string;
  peerName: string;
  peerSlug: string;
  peerInitials: string;
  peerGradient: string;
  peerAvatarUrl: string | null;
  messages: DMRow[];
  hasMore: boolean;
}

export const ensureDirectThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ peerId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<DirectThreadInfo> => {
    const me = context.userId;
    if (data.peerId === me) throw new Error("You cannot message yourself");

    const { data: p, error } = await context.supabase
      .from("profiles")
      .select("user_id, display_name, username, slug, avatar_path")
      .eq("user_id", data.peerId)
      .maybeSingle();
    if (error) throw error;
    if (!p) throw new Error("Peer profile not found");

    const name = p.display_name || p.username || "Peer";
    const avatarByPath = await signAvatars(context.supabase, [p.avatar_path]);

    const limit = 30;
    const { data: rows, error: mErr } = await context.supabase
      .from("direct_messages")
      .select("id, sender_id, recipient_id, body, media_path, media_type, created_at, read_at, order_id")
      .or(
        `and(sender_id.eq.${me},recipient_id.eq.${data.peerId}),and(sender_id.eq.${data.peerId},recipient_id.eq.${me})`,
      )
      .order("created_at", { ascending: false })
      .limit(limit + 1);
    if (mErr) throw mErr;
    const list = (rows ?? []) as DMRow[];
    const hasMore = list.length > limit;
    const page = hasMore ? list.slice(0, limit) : list;
    page.reverse();

    // Mark any unread messages from this peer as read as soon as the thread opens.
    await context.supabase
      .from("direct_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("recipient_id", me)
      .eq("sender_id", data.peerId)
      .is("read_at", null);

    return {
      peerId: data.peerId,
      peerName: name,
      peerSlug: p.slug ?? data.peerId,
      peerInitials: initialsFor(name),
      peerGradient: gradientFor(data.peerId),
      peerAvatarUrl: p.avatar_path ? (avatarByPath.get(p.avatar_path) ?? null) : null,
      messages: page,
      hasMore,
    };
  });

/** Signed upload slot for a DM attachment (private post-media bucket, reused across features). */
export const getMessageMediaUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ filename: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const safe = data.filename.replace(/[^a-zA-Z0-9._-]/g, "_") || "file";
    const path = `dm/${context.userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
    const { data: signed, error } = await context.supabase.storage
      .from("post-media")
      .createSignedUploadUrl(path);
    if (error) throw error;
    return { path, token: signed.token as string, signedUrl: signed.signedUrl as string };
  });

/** Batch-sign DM attachment paths for inline preview/download. */
export const getMessageAttachmentUrls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ paths: z.array(z.string().max(500)).max(50) }).parse(d))
  .handler(async ({ data, context }): Promise<Record<string, string>> => {
    const unique = [...new Set(data.paths)];
    if (!unique.length) return {};
    const { data: signed, error } = await context.supabase.storage
      .from("post-media")
      .createSignedUrls(unique, 60 * 60 * 6);
    if (error) throw error;
    const out: Record<string, string> = {};
    (signed ?? []).forEach((s, i) => {
      if (s.signedUrl) out[unique[i]] = s.signedUrl;
    });
    return out;
  });
