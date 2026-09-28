import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuthGate } from "@/lib/auth-gate/AuthGateProvider";
import { AvatarImage } from "@/components/oventric/AvatarImage";
import { topicForKind, isNotificationTopic } from "@/lib/notifications/topics";
import { isSoundMuted, playNotificationSound } from "@/lib/notification-sound";
import {
  Bell,
  MessageCircle,
  Wallet,
  Trophy,
  ShoppingBag,
  Users,
  GraduationCap,
} from "lucide-react";

type NotifRow = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  from_user_id: string | null;
};

/** Icon + accent colour per notification family. */
function styleForKind(kind: string) {
  if (kind === "direct_message")
    return { Icon: MessageCircle, ring: "bg-sky-500", label: "Message" };
  if (kind.startsWith("bounty")) return { Icon: Trophy, ring: "bg-amber-500", label: "Bounty" };
  if (kind.startsWith("circle")) return { Icon: Users, ring: "bg-violet-500", label: "Circle" };
  if (kind.startsWith("payout") || kind.startsWith("wallet") || kind.startsWith("cashback"))
    return { Icon: Wallet, ring: "bg-emerald-500", label: "Wallet" };
  if (kind.startsWith("order") || kind.startsWith("product") || kind.startsWith("sale"))
    return { Icon: ShoppingBag, ring: "bg-rose-500", label: "Marketplace" };
  if (kind.startsWith("course") || kind.startsWith("academy") || kind.startsWith("enrol"))
    return { Icon: GraduationCap, ring: "bg-indigo-500", label: "Academy" };
  return { Icon: Bell, ring: "bg-blue-500", label: "Oventric" };
}

/**
 * Global in-app notification "pop": every new row in `notifications` for the
 * signed-in user slides in as a tappable card, wherever they are in the app.
 * The chime itself is already handled by the existing sound layer (throttled),
 * so this component is purely visual.
 */
export function LiveNotificationToasts() {
  const { isAuthenticated } = useAuthGate();
  const router = useRouter();
  const seen = useRef<Set<string>>(new Set());
  const mutedTopics = useRef<Set<string>>(new Set());

  // Keep the muted-topic set fresh (initial load + whenever settings change).
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    const load = async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid || cancelled) return;
      const { data } = await supabase
        .from("notification_preferences")
        .select("topic, in_app")
        .eq("user_id", uid);
      if (cancelled) return;
      const muted = new Set<string>();
      for (const r of (data ?? []) as { topic: string; in_app: boolean }[]) {
        if (!r.in_app) muted.add(r.topic);
      }
      mutedTopics.current = muted;
    };
    void load();
    const onChange = () => void load();
    window.addEventListener("oventric:notif-prefs-changed", onChange);
    return () => {
      cancelled = true;
      window.removeEventListener("oventric:notif-prefs-changed", onChange);
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    let ch: ReturnType<typeof supabase.channel> | null = null;

    const go = (link: string | null) => {
      if (!link) return;
      try {
        void router.navigate({ href: link });
      } catch {
        window.location.assign(link);
      }
    };

    const pop = async (row: NotifRow) => {
      if (seen.current.has(row.id)) return;
      // Respect the member's per-topic in-app alert preference.
      const topic = topicForKind(row.kind ?? "");
      if (isNotificationTopic(topic) && mutedTopics.current.has(topic)) return;
      seen.current.add(row.id);
      if (seen.current.size > 200) seen.current.clear();

      let avatar: string | null = null;
      let name: string | null = null;
      if (row.from_user_id) {
        const { data } = await supabase
          .from("profiles")
          .select("display_name, username, avatar_url")
          .eq("user_id", row.from_user_id)
          .maybeSingle();
        avatar = (data as { avatar_url?: string | null } | null)?.avatar_url ?? null;
        name =
          (data as { display_name?: string | null; username?: string | null } | null)
            ?.display_name ??
          (data as { username?: string | null } | null)?.username ??
          null;
      }
      if (cancelled) return;

      const { Icon, ring, label } = styleForKind(row.kind ?? "");

      // Sound + gentle buzz for every live alert (respects the mute switch).
      playNotificationSound(row.kind === "direct_message" ? "message" : "notification");
      try {
        if (!isSoundMuted()) navigator.vibrate?.([30, 40, 30]);
      } catch {
        /* ignore */
      }

      toast.custom(
        (id) => (
          <button
            type="button"
            onClick={() => {
              toast.dismiss(id);
              go(row.link);
            }}
            style={{ marginTop: "env(safe-area-inset-top)" }}
            className="w-[calc(100vw-24px)] max-w-md text-left flex items-start gap-3 rounded-[14px] border border-white/10 border-l-[3px] border-l-[#E5484D] bg-[#151619] px-3.5 py-3 text-white shadow-2xl shadow-black/50 transition-transform active:scale-[0.98] animate-in slide-in-from-top-4 fade-in duration-300"
          >
            <span className="relative shrink-0">
              <span className="block h-11 w-11 rounded-full overflow-hidden">
                {avatar ? (
                  <AvatarImage src={avatar} alt={name ?? "User"} loading="eager" />
                ) : (
                  <span
                    className={`flex h-11 w-11 items-center justify-center rounded-full ${ring}`}
                  >
                    <Icon className="h-5 w-5 text-white" strokeWidth={2.5} />
                  </span>
                )}
              </span>
              {avatar && (
                <span
                  className={`absolute -bottom-0.5 -right-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full ring-2 ring-popover ${ring}`}
                  style={{ height: 18, width: 18 }}
                >
                  <Icon className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                </span>
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {label}
              </span>
              <span className="block text-sm font-semibold leading-snug text-foreground line-clamp-2">
                {row.title}
              </span>
              {row.body && (
                <span className="mt-0.5 block text-xs leading-snug text-muted-foreground line-clamp-2">
                  {row.body}
                </span>
              )}
            </span>
          </button>
        ),
        { duration: 6000 },
      );
    };

    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid || cancelled) return;
      const topic = `realtime:notif-toast-${uid}`;
      for (const c of supabase.getChannels()) {
        if (c.topic === topic) supabase.removeChannel(c);
      }
      ch = supabase
        .channel(`notif-toast-${uid}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${uid}`,
          },
          (payload) => {
            void pop(payload.new as NotifRow);
          },
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (ch) supabase.removeChannel(ch);
    };
  }, [isAuthenticated, router]);

  return null;
}
