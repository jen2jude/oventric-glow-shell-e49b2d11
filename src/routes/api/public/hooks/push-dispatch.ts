import { createFileRoute } from "@tanstack/react-router";
import { buildPushPayload, type PushSubscription } from "@block65/webcrypto-web-push";

type Row = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

/**
 * Called by a database trigger whenever a notification row is created.
 * Encrypts and fans the notification out to every device the recipient has
 * registered, so it lands in the phone's notification bar even when the app
 * is closed. Authenticated with a shared bearer secret.
 */
export const Route = createFileRoute("/api/public/hooks/push-dispatch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["PUSH_HOOK_SECRET"];
        const auth = request.headers.get("authorization") ?? "";
        if (!secret || auth !== `Bearer ${secret}`) {
          return new Response("unauthorized", { status: 401 });
        }

        const vapid = {
          subject: process.env["VAPID_SUBJECT"] ?? "mailto:support@oventric.com",
          publicKey: process.env["VAPID_PUBLIC_KEY"] ?? "",
          privateKey: process.env["VAPID_PRIVATE_KEY"] ?? "",
        };
        if (!vapid.publicKey || !vapid.privateKey) {
          return new Response("misconfigured", { status: 500 });
        }

        let body: { notification_id?: string };
        try {
          body = (await request.json()) as { notification_id?: string };
        } catch {
          return new Response("bad request", { status: 400 });
        }
        const notificationId = body.notification_id;
        if (!notificationId) return new Response("bad request", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: notif } = await supabaseAdmin
          .from("notifications")
          .select("id, user_id, title, body, link, kind")
          .eq("id", notificationId)
          .maybeSingle();
        if (!notif) return Response.json({ ok: true, sent: 0 });

        // Respect the recipient's per-topic push preference.
        const { topicForKind } = await import("@/lib/notifications/topics");
        const topic = topicForKind((notif as { kind?: string }).kind ?? "");
        const { data: pref } = await supabaseAdmin
          .from("notification_preferences")
          .select("push")
          .eq("user_id", notif.user_id)
          .eq("topic", topic)
          .maybeSingle();
        if (pref && (pref as { push: boolean }).push === false) {
          return Response.json({ ok: true, sent: 0, skipped: "topic-muted" });
        }


        const { data: subs } = await supabaseAdmin
          .from("push_subscriptions")
          .select("id, endpoint, p256dh, auth")
          .eq("user_id", notif.user_id);

        const rows = (subs ?? []) as Row[];
        if (rows.length === 0) return Response.json({ ok: true, sent: 0 });

        const [nCount, dCount] = await Promise.all([
          supabaseAdmin
            .from("notifications")
            .select("id", { count: "exact", head: true })
            .eq("user_id", notif.user_id)
            .is("read_at", null),
          supabaseAdmin
            .from("direct_messages")
            .select("id", { count: "exact", head: true })
            .eq("recipient_id", notif.user_id)
            .is("read_at", null),
        ]);
        const badge = (nCount.count ?? 0) + (dCount.count ?? 0);

        const message = {
          data: {
            title: notif.title ?? "Oventric",
            body: (notif.body ?? "").slice(0, 180),
            link: notif.link ?? "/",
            id: notif.id,
            tag: notif.id,
            badge,
          },
          options: { ttl: 60 * 60 * 24, urgency: "high" as const },
        };

        let sent = 0;
        const stale: string[] = [];

        await Promise.all(
          rows.map(async (row) => {
            const subscription: PushSubscription = {
              endpoint: row.endpoint,
              expirationTime: null,
              keys: { p256dh: row.p256dh, auth: row.auth },
            };
            try {
              const payload = await buildPushPayload(message, subscription, vapid);
              const res = await fetch(row.endpoint, payload as unknown as RequestInit);
              if (res.status === 404 || res.status === 410) {
                stale.push(row.id);
              } else if (res.ok) {
                sent += 1;
              } else {
                console.error("[push-dispatch] send failed", res.status, await res.text());
              }
            } catch (e) {
              console.error("[push-dispatch] error", e);
            }
          }),
        );

        if (stale.length > 0) {
          await supabaseAdmin.from("push_subscriptions").delete().in("id", stale);
        }
        if (sent > 0) {
          await supabaseAdmin
            .from("push_subscriptions")
            .update({ last_success_at: new Date().toISOString() })
            .eq("user_id", notif.user_id);
        }

        return Response.json({ ok: true, sent, removed: stale.length });
      },
    },
  },
});
