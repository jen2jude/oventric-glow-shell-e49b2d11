import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import DOMPurify from "dompurify";

import {
  X,
  Bell,
  Wallet as WalletIcon,
  Users,
  Timer,
  ShieldAlert,
  Megaphone,
  Mail,
  ArrowRight,
  Volume2,
  VolumeX,
  BellRing,
  BellOff,
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuthGate } from "@/lib/auth-gate/AuthGateProvider";
import { isSoundMuted, playNotificationSound, setSoundMuted } from "@/lib/notification-sound";
import {
  disablePush,
  enablePush,
  isPushEnabled,
  pushAllowedHere,
  pushSupported,
} from "@/lib/push/client";
import {
  myNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/communications.functions";

type Channel = "all" | "financials" | "circles" | "bounties" | "system";

interface DbNotif {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  from_user_id: string | null;
  read_at: string | null;
  created_at: string;
  user_id: string;
}

const CHANNELS: { key: Channel; label: string }[] = [
  { key: "all", label: "All" },
  { key: "financials", label: "💳 Financials" },
  { key: "circles", label: "👥 Circles" },
  { key: "bounties", label: "🎯 Bounties" },
  { key: "system", label: "📢 System" },
];

function channelForKind(kind: string): Exclude<Channel, "all"> {
  if (/wallet|payout|escrow|order|payment|cashback/i.test(kind)) return "financials";
  if (/circle|peer|follow/i.test(kind)) return "circles";
  if (/bounty/i.test(kind)) return "bounties";
  // System bucket = admin-originated only: announcements, admin direct
  // messages, alerts, and anything explicitly marked system.
  return "system";
}

function iconForKind(kind: string) {
  const c = channelForKind(kind);
  if (c === "financials") return <WalletIcon className="w-4 h-4 text-emerald-600" />;
  if (c === "circles") return <Users className="w-4 h-4 text-sky-600" />;
  if (c === "bounties") return <Timer className="w-4 h-4 text-amber-600" />;
  if (kind === "announcement") return <Megaphone className="w-4 h-4 text-fuchsia-600" />;
  if (kind === "direct_message") return <Mail className="w-4 h-4 text-primary" />;
  if (kind === "alert") return <ShieldAlert className="w-4 h-4 text-destructive" />;
  return <Bell className="w-4 h-4 text-muted-foreground" />;
}

function timeAgo(iso: string): string {
  const d = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - d);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString();
}

function isHtml(s: string | null | undefined): boolean {
  return !!s && /<\/?[a-z][^>]*>/i.test(s);
}

function plainPreview(s: string | null | undefined): string {
  if (!s) return "";
  if (!isHtml(s)) return s;
  if (typeof document === "undefined")
    return s
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const div = document.createElement("div");
  div.innerHTML = DOMPurify.sanitize(s);
  return (div.textContent || div.innerText || "").replace(/\s+/g, " ").trim();
}

function renderLinkified(text: string) {
  // Detects http(s) URLs and internal paths starting with '/'.
  const parts = text.split(/(\bhttps?:\/\/[^\s]+|(?:^|\s)\/[A-Za-z0-9/_\-?=&.#%]+)/g);
  return parts.map((part, i) => {
    if (!part) return null;
    const trimmed = part.trim();
    const isExternal = /^https?:\/\//i.test(trimmed);
    const isInternal = trimmed.startsWith("/");
    if (isExternal) {
      return (
        <a
          key={i}
          href={trimmed}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2 hover:opacity-80 break-all"
        >
          {trimmed}
        </a>
      );
    }
    if (isInternal) {
      const leading = part.startsWith(" ") ? " " : "";
      return (
        <span key={i}>
          {leading}
          <a
            href={trimmed}
            className="text-primary underline underline-offset-2 hover:opacity-80 break-all"
          >
            {trimmed}
          </a>
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export function NotificationsDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { isAuthenticated } = useAuthGate();
  const [channel, setChannel] = useState<Channel>("all");
  const [items, setItems] = useState<DbNotif[]>([]);
  const [loading, setLoading] = useState(false);
  const [muted, setMuted] = useState(false);
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushAvailable, setPushAvailable] = useState(false);

  // localStorage is client-only — read after hydration.
  useEffect(() => setMuted(isSoundMuted()), []);

  useEffect(() => {
    if (!pushSupported() || !pushAllowedHere()) return;
    setPushAvailable(true);
    void isPushEnabled().then(setPushOn);
  }, []);

  const togglePush = async () => {
    setPushBusy(true);
    try {
      if (pushOn) {
        await disablePush();
        setPushOn(false);
        toast.success("Background alerts turned off on this device.");
      } else {
        const res = await enablePush();
        if (res.ok) {
          setPushOn(true);
          toast.success("Background alerts on for this device.");
        } else if (res.reason === "install-required") {
          toast.error(
            "On iPhone, add Oventric to your Home Screen first, then open it from the icon.",
          );
        } else if (res.reason === "denied") {
          toast.error("Notifications are blocked in your browser settings.");
        } else {
          toast.error("Couldn't turn on background alerts.");
        }
      }
    } catch {
      toast.error("Couldn't update background alerts.");
    } finally {
      setPushBusy(false);
    }
  };

  const toggleSound = () => {
    const next = !muted;
    setMuted(next);
    setSoundMuted(next);
    if (!next) playNotificationSound("success");
  };

  const fetchList = useServerFn(myNotifications);
  const markOne = useServerFn(markNotificationRead);
  const markAll = useServerFn(markAllNotificationsRead);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const rows = (await fetchList()) as DbNotif[];
      setItems(rows);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [fetchList, isAuthenticated]);

  const [viewing, setViewing] = useState<DbNotif | null>(null);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  // Realtime subscription — always on while authenticated so unread badge stays live.
  // Also raises a native browser push notification for new admin-originated items
  // (announcements, system messages, alerts, admin DMs) when permission is granted.
  useEffect(() => {
    if (!isAuthenticated) return;
    let userId: string | null = null;
    let channelSub: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    const raisePush = (row: DbNotif) => {
      if (typeof window === "undefined" || !("Notification" in window)) return;
      if (Notification.permission !== "granted") return;
      const pushKinds = ["announcement", "system", "alert", "direct_message", "order_message"];
      if (!pushKinds.includes(row.kind)) return;
      try {
        const n = new Notification(row.title, {
          body: row.body ?? "",
          icon: "/favicon.ico",
          tag: row.id,
        });
        n.onclick = () => {
          window.focus();
          if (row.link) window.location.href = row.link;
          n.close();
        };
      } catch {
        /* ignore */
      }
    };

    (async () => {
      const { data } = await supabase.auth.getUser();
      userId = data.user?.id ?? null;
      if (!userId || cancelled) return;
      // Ask for notification permission opportunistically (idempotent).
      if ("Notification" in window && Notification.permission === "default") {
        try {
          void Notification.requestPermission();
        } catch {
          /* ignore */
        }
      }
      channelSub = supabase
        .channel(`notif-${userId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            const row = payload.new as DbNotif;
            playNotificationSound(
              row.kind === "direct_message" || row.kind === "order_message"
                ? "message"
                : "notification",
            );
            raisePush(row);
            void refresh();
          },
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${userId}`,
          },
          () => {
            void refresh();
          },
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channelSub) supabase.removeChannel(channelSub);
    };
  }, [isAuthenticated, refresh]);

  const filtered = useMemo(
    () => (channel === "all" ? items : items.filter((n) => channelForKind(n.kind) === channel)),
    [items, channel],
  );

  const handleOpenItem = async (n: DbNotif) => {
    if (!n.read_at) {
      setItems((prev) =>
        prev.map((p) => (p.id === n.id ? { ...p, read_at: new Date().toISOString() } : p)),
      );
      try {
        await markOne({ data: { id: n.id } });
      } catch {
        /* ignore */
      }
    }
    setViewing({ ...n, read_at: n.read_at ?? new Date().toISOString() });
  };

  const handleMarkAll = async () => {
    setItems((prev) => prev.map((p) => ({ ...p, read_at: p.read_at ?? new Date().toISOString() })));
    try {
      await markAll({});
    } catch {
      /* ignore */
    }
  };

  const handleSelectChannel = async (next: Channel) => {
    setChannel(next);
    const unread = items.filter(
      (n) => !n.read_at && (next === "all" || channelForKind(n.kind) === next),
    );
    if (unread.length === 0) return;
    const now = new Date().toISOString();
    const ids = new Set(unread.map((n) => n.id));
    setItems((prev) => prev.map((p) => (ids.has(p.id) ? { ...p, read_at: p.read_at ?? now } : p)));
    try {
      if (next === "all") {
        await markAll({});
      } else {
        await Promise.all(unread.map((n) => markOne({ data: { id: n.id } }).catch(() => {})));
      }
    } catch {
      /* ignore */
    }
  };

  if (!open) return null;

  return (
    <>
      <div
        className="modal-light fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-40 animate-fade-in"
        onClick={onClose}
        aria-hidden
      />
      <aside
        className="web-notifications w-full sm:w-[420px] h-screen border-l shadow-2xl z-50 fixed right-0 top-0 animate-in slide-in-from-right duration-300"
        role="dialog"
        aria-modal="true"
        aria-label="Notifications"
      >
        <div className="flex items-center justify-between px-5 h-16 border-b">
          <div>
            <h2 className="font-wallet-display text-foreground font-semibold text-base">
              Notifications
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {isAuthenticated
                ? "Live activity across your workspace"
                : "Connect your account to receive alerts"}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {pushAvailable && (
              <button
                onClick={() => void togglePush()}
                disabled={pushBusy}
                aria-label={pushOn ? "Turn off background alerts" : "Turn on background alerts"}
                title={pushOn ? "Background alerts on" : "Background alerts off"}
                aria-pressed={pushOn}
                className={`p-2 rounded-[10px] hover:bg-muted transition-colors disabled:opacity-50 ${
                  pushOn ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {pushOn ? <BellRing className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
              </button>
            )}
            <button
              onClick={toggleSound}
              aria-label={muted ? "Unmute notification sound" : "Mute notification sound"}
              title={muted ? "Sound off" : "Sound on"}
              aria-pressed={!muted}
              className="p-2 rounded-[10px] hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              aria-label="Close notifications"
              className="p-2 rounded-[10px] hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="px-5 pt-3 pb-3 flex items-center gap-2 overflow-x-auto no-scrollbar border-b">
          {CHANNELS.map((c) => {
            const active = channel === c.key;
            const chanCount =
              c.key === "all"
                ? items.filter((n) => !n.read_at).length
                : items.filter((n) => !n.read_at && channelForKind(n.kind) === c.key).length;
            return (
              <button
                key={c.key}
                onClick={() => void handleSelectChannel(c.key)}
                className={`relative shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors border inline-flex items-center gap-1.5 ${
                  active
                    ? "bg-primary text-primary-foreground border-transparent"
                    : "bg-muted text-muted-foreground border-border hover:text-foreground"
                }`}
              >
                <span>{c.label}</span>
                {chanCount > 0 && (
                  <span
                    className={`min-w-[16px] h-4 px-1 rounded-full text-[9px] font-black inline-flex items-center justify-center ${
                      active ? "bg-white/25 text-primary-foreground" : "bg-primary text-primary-foreground"
                    }`}
                    aria-label={`${chanCount} unread`}
                  >
                    {chanCount > 99 ? "99+" : chanCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div
          className="overflow-y-auto px-5 py-4"
          style={{ maxHeight: "calc(100vh - 8.75rem - 3.75rem)" }}
        >
          {!isAuthenticated ? (
            <div className="text-center text-xs text-muted-foreground py-12">
              Sign in to view your notifications.
            </div>
          ) : loading && items.length === 0 ? (
            <div className="text-center text-xs text-muted-foreground py-12">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-xs text-muted-foreground py-12">
              You're all caught up in this channel.
            </div>
          ) : (
            filtered.map((n) => (
              <button
                key={n.id}
                onClick={() => void handleOpenItem(n)}
                className={`w-full text-left rounded-xl mb-2.5 p-3.5 border transition-all hover:shadow-[0_6px_18px_-12px_rgba(15,23,42,0.45)] ${
                  !n.read_at
                    ? "bg-primary/[0.04] border-primary/25"
                    : "bg-card border-border hover:border-foreground/15"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 shrink-0 rounded-[10px] flex items-center justify-center bg-muted border">
                    {iconForKind(n.kind)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-semibold text-foreground truncate">{n.title}</p>
                      {!n.read_at && (
                        <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" aria-hidden />
                      )}
                    </div>
                    {n.body && (
                      <p className="text-[12px] leading-snug text-muted-foreground mt-1 line-clamp-3">
                        {plainPreview(n.body)}
                      </p>
                    )}
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                        {timeAgo(n.created_at)}
                      </span>
                      {n.link && (
                        <span className="text-[11px] font-semibold text-primary inline-flex items-center gap-1">
                          Open <ArrowRight className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        <div className="absolute bottom-0 inset-x-0 px-5 py-3 border-t bg-background">
          <button
            onClick={handleMarkAll}
            disabled={!isAuthenticated || items.every((n) => n.read_at)}
            className="w-full py-3 rounded-[10px] text-xs font-semibold text-foreground bg-muted border hover:border-primary/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Mark all as read
          </button>
        </div>
      </aside>

      {viewing &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="modal-light fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-900/50 backdrop-blur-[2px] animate-fade-in p-4"
            onClick={() => setViewing(null)}
            role="dialog"
            aria-modal="true"
            aria-label={viewing.title}
          >
            <div
              className="web-notifications w-full max-w-lg my-auto border rounded-2xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3 px-5 py-4 border-b">
                <div className="w-9 h-9 rounded-[10px] flex items-center justify-center bg-muted border shrink-0">
                  {iconForKind(viewing.kind)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-wallet-display text-foreground font-semibold text-base">
                    {viewing.title}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
                    {viewing.kind.replace(/_/g, " ")} · {timeAgo(viewing.created_at)}
                  </p>
                </div>
                <button
                  onClick={() => setViewing(null)}
                  className="p-1.5 rounded-[10px] hover:bg-muted text-muted-foreground hover:text-foreground"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="px-5 py-4 max-h-[60vh] overflow-y-auto">
                {viewing.body ? (
                  isHtml(viewing.body) ? (
                    <div
                      className="rich-comms text-sm text-foreground leading-relaxed break-words"
                      dangerouslySetInnerHTML={{
                        __html: DOMPurify.sanitize(viewing.body, {
                          ALLOWED_TAGS: [
                            "a",
                            "p",
                            "br",
                            "strong",
                            "em",
                            "b",
                            "i",
                            "u",
                            "ul",
                            "ol",
                            "li",
                            "h1",
                            "h2",
                            "h3",
                            "h4",
                            "blockquote",
                            "code",
                            "pre",
                            "img",
                            "hr",
                            "span",
                            "div",
                          ],
                          ALLOWED_ATTR: [
                            "href",
                            "target",
                            "rel",
                            "src",
                            "alt",
                            "title",
                            "class",
                            "style",
                          ],
                          ALLOWED_URI_REGEXP: /^(https?:|mailto:|\/)/i,
                        }),
                      }}
                    />
                  ) : (
                    <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                      {renderLinkified(viewing.body)}
                    </p>
                  )
                ) : (
                  <p className="text-sm text-muted-foreground italic">No additional content.</p>
                )}
              </div>

              {viewing.link && (
                <div className="px-5 py-3 border-t bg-muted">
                  <button
                    onClick={() => {
                      const url = viewing.link!;
                      setViewing(null);
                      onClose();
                      if (/^https?:\/\//i.test(url)) {
                        window.open(url, "_blank", "noopener,noreferrer");
                      } else {
                        window.location.href = url;
                      }
                    }}
                    className="w-full py-2.5 rounded-[10px] bg-primary hover:opacity-90 text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 transition-opacity"
                  >
                    Open link <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

/**
 * Lightweight hook that keeps an unread count in sync via realtime, for the
 * header bell badge. Returns 0 when the user is not authenticated.
 */
export function useUnreadNotificationsCount() {
  const { isAuthenticated } = useAuthGate();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) {
      setCount(0);
      return;
    }
    let cancelled = false;
    let userId: string | null = null;
    let channelSub: ReturnType<typeof supabase.channel> | null = null;

    const load = async () => {
      if (!userId) return;
      const { count: c } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .is("read_at", null);
      if (!cancelled) setCount(c ?? 0);
    };

    (async () => {
      const { data } = await supabase.auth.getUser();
      userId = data.user?.id ?? null;
      if (!userId || cancelled) return;
      await load();
      channelSub = supabase
        .channel(`notif-count-${userId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
          () => {
            void load();
          },
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channelSub) supabase.removeChannel(channelSub);
    };
  }, [isAuthenticated]);

  return count;
}
