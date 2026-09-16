import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link } from "@tanstack/react-router";
import {
  Search,
  Send,
  Star,
  ExternalLink,
  X,
  MessageSquare,
  Loader2,
  Truck,
  ShieldAlert,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { playNotificationSound } from "@/lib/notification-sound";
import {
  ProductBubbleCard,
  extractProductId,
  stripProductLink,
} from "@/components/oventric/messaging/ProductBubbleCard";
import { useAuthGate } from "@/lib/auth-gate/AuthGateProvider";
import {
  listThreads,
  listMessages,
  sendMessage,
  markThreadRead,
  getPeerProfiles,
  type ThreadSummary,
  getPeerOrderContext,
  type DMRow,
  type PeerOrderContext,
} from "@/lib/messaging/messages.functions";
import { markOrderDelivered } from "@/lib/fulfilment.functions";
import { OrderChatActionBar } from "@/components/oventric/OrderChatActionBar";

import { AvatarImage } from "@/components/oventric/AvatarImage";
import { usePresence } from "@/hooks/use-presence";

interface OnlinePeer {
  name: string;
  slug: string;
  avatarUrl: string | null;
  gradient: string;
}

interface MessagesProps {
  variant?: "page" | "compact";
  initialThreadId?: string; // treated as peerId
  onOpenEscrow?: (bountyId: string) => void;
  onClose?: () => void;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const dayMs = 86400000;
  if (now.getTime() - d.getTime() < 7 * dayMs)
    return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString();
}

function relative(iso: string) {
  const t = new Date(iso).getTime();
  const s = Math.max(1, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
}

function EmptyChat({ hasThreads }: { hasThreads: boolean }) {
  return (
    <div className="flex flex-1 items-center justify-center p-8 text-center">
      <div className="max-w-sm">
        <div className="mx-auto mb-5 relative w-20 h-20">
          <div className="absolute inset-0 rounded-full bg-primary/5 border border-primary/15" />
          <div className="absolute inset-0 flex items-center justify-center">
            <MessageSquare className="w-8 h-8 text-primary" />
          </div>
        </div>
        <div className="font-wallet-display text-foreground font-semibold text-lg">
          {hasThreads ? "Select a conversation" : "No conversations yet"}
        </div>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          {hasThreads
            ? "Choose a conversation to continue securely."
            : "Message a buyer or seller from their profile or order to get started."}
        </p>
      </div>
    </div>
  );
}

function ThreadRow({
  thread,
  active,
  online,
  onClick,
}: {
  thread: ThreadSummary;
  active: boolean;
  online: boolean;
  onClick: () => void;
}) {
  const unread = thread.unread > 0;
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-[10px] border transition-colors ${
        active
          ? "bg-primary/5 border-primary/25"
          : unread
            ? "bg-background border-primary/20"
            : "bg-background border-transparent hover:border-border hover:bg-muted/60"
      }`}
    >
      <div
        className={`flex items-start gap-3 px-3 py-3 rounded-[10px] ${
          active
            ? ""
            : unread
              ? "bg-background hover:bg-muted/60"
              : "hover:bg-muted/60"
        }`}
      >
        <div className="relative shrink-0">
          <div className="w-10 h-10 rounded-full overflow-hidden">
            <AvatarImage
              src={thread.peerAvatarUrl}
              alt={thread.peerName}
              className="rounded-full"
            />
          </div>
          {online && (
            <span
              className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-background shadow-sm"
              title="Online"
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-foreground truncate">
              {thread.peerName}
            </span>
            <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
              {formatTime(thread.lastAt)}
            </span>
          </div>

          <div className="flex items-center gap-2 mt-0.5">
            <div className="text-xs text-muted-foreground truncate flex-1">
              {thread.preview}
            </div>
            {unread && (
              <span className="shrink-0 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                {thread.unread}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

function MessageBubble({ msg, mine }: { msg: DMRow; mine: boolean }) {
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm ${
          mine
            ? "rounded-tr-sm bg-primary text-primary-foreground shadow-sm"
            : "rounded-tl-sm bg-background text-foreground border border-border shadow-sm"
        }`}
      >
        {stripProductLink(msg.body) && (
          <div className="leading-relaxed whitespace-pre-wrap break-words">
            {stripProductLink(msg.body)}
          </div>
        )}
        {extractProductId(msg.body) && (
          <ProductBubbleCard productId={extractProductId(msg.body)!} mine={mine} />
        )}
        {msg.media_path && <div className="mt-1 text-[11px] italic opacity-80">📎 attachment</div>}
        <div
          className={`text-[10px] mt-1 flex items-center gap-1 ${mine ? "text-primary-foreground/75 justify-end" : "text-muted-foreground"}`}
        >
          <span>{formatTime(msg.created_at)}</span>
          {mine && !msg.id.startsWith("tmp-") && (
            <span
              className="text-primary-foreground/75"
              title={msg.read_at ? `Read ${formatTime(msg.read_at)}` : "Sent"}
              aria-label={msg.read_at ? "Read" : "Sent"}
            >
              {msg.read_at ? "✓✓" : "✓"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function Messages({
  variant = "page",
  initialThreadId,
  onOpenEscrow: _onOpenEscrow,
  onClose,
}: MessagesProps) {
  const { session, openGate } = useAuthGate();
  const me = session?.user?.id ?? null;

  const fetchThreads = useServerFn(listThreads);
  const fetchMessages = useServerFn(listMessages);
  const postMessage = useServerFn(sendMessage);
  const markRead = useServerFn(markThreadRead);
  const fetchPeerProfiles = useServerFn(getPeerProfiles);

  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [activePeer, setActivePeer] = useState<string | null>(initialThreadId ?? null);
  const [messages, setMessages] = useState<DMRow[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const PAGE_SIZE = 30;
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [orderCtx, setOrderCtx] = useState<PeerOrderContext | null>(null);
  const [showListOnMobile, setShowListOnMobile] = useState(!initialThreadId);
  const [onlinePeers, setOnlinePeers] = useState<Map<string, OnlinePeer>>(new Map());
  // App-wide presence: realtime peers plus anyone active in the last 5 minutes.
  const presence = usePresence();
  const isPeerOnline = useCallback(
    (id: string) => onlinePeers.has(id) || presence.isOnline(id),
    [onlinePeers, presence],
  );
  const peerCacheRef = useRef<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const [peerTyping, setPeerTyping] = useState(false);
  const typingChanRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastTypingSentRef = useRef(0);
  const peerTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeThread = useMemo(
    () => threads.find((t) => t.peerId === activePeer) ?? null,
    [threads, activePeer],
  );

  const visibleThreads = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter(
      (t) => t.peerName.toLowerCase().includes(q) || t.preview.toLowerCase().includes(q),
    );
  }, [threads, query]);

  const reloadThreads = useCallback(async () => {
    if (!me) {
      setThreads([]);
      return;
    }
    setLoadingThreads(true);
    try {
      const rows = await fetchThreads();
      setThreads(rows);
    } catch (e) {
      console.error("threads load failed", e);
    } finally {
      setLoadingThreads(false);
    }
  }, [me, fetchThreads]);

  useEffect(() => {
    void reloadThreads();
  }, [reloadThreads]);

  // Realtime presence — instantly reflects who is online / goes offline.
  useEffect(() => {
    if (!me) {
      setOnlinePeers(new Map());
      return;
    }
    let cancelled = false;
    for (const c of supabase.getChannels()) {
      if (c.topic === "realtime:oventric:presence") supabase.removeChannel(c);
    }
    const channel = supabase.channel("oventric:presence", {
      config: { presence: { key: me } },
    });

    const syncFromState = () => {
      if (cancelled) return;
      const state = channel.presenceState<{ user_id: string; name?: string; slug?: string }>();
      const ids = Object.keys(state).filter((k) => k !== me);
      setOnlinePeers((prev) => {
        const next = new Map<string, OnlinePeer>();
        for (const key of ids) {
          const meta = state[key][0];
          const cached = prev.get(key);
          next.set(key, {
            name: cached?.name || meta?.name || "Peer",
            slug: cached?.slug || meta?.slug || key,
            avatarUrl: cached?.avatarUrl ?? null,
            gradient: cached?.gradient ?? "from-emerald-400 to-teal-500",
          });
        }
        return next;
      });
      // Hydrate real avatars/names for anyone we don't have yet.
      const missing = ids.filter((id) => !peerCacheRef.current.has(id));
      if (missing.length) {
        missing.forEach((id) => peerCacheRef.current.add(id));
        fetchPeerProfiles({ data: { userIds: missing.slice(0, 100) } })
          .then((rows) => {
            if (cancelled) return;
            setOnlinePeers((prev) => {
              const next = new Map(prev);
              rows.forEach((r) => {
                if (!next.has(r.userId)) return;
                next.set(r.userId, {
                  name: r.name,
                  slug: r.slug,
                  avatarUrl: r.avatarUrl,
                  gradient: r.gradient,
                });
              });
              return next;
            });
          })
          .catch(() => {
            missing.forEach((id) => peerCacheRef.current.delete(id));
          });
      }
    };

    channel
      .on("presence", { event: "sync" }, syncFromState)
      .on("presence", { event: "join" }, syncFromState)
      .on("presence", { event: "leave" }, syncFromState)
      .subscribe(async (status) => {
        if (status !== "SUBSCRIBED" || cancelled) return;
        const { data: p } = await supabase
          .from("profiles")
          .select("display_name, username, slug")
          .eq("user_id", me)
          .maybeSingle();
        if (cancelled) return;
        const name = p?.display_name || p?.username || "Peer";
        await channel.track({
          user_id: me,
          name,
          slug: p?.slug || me,
          online_at: new Date().toISOString(),
        });
      });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [me, fetchPeerProfiles]);

  // Sync activePeer when initialThreadId changes (e.g., opening chat from a new profile)
  useEffect(() => {
    if (initialThreadId) {
      setActivePeer(initialThreadId);
      setShowListOnMobile(false);
    }
  }, [initialThreadId]);

  // If we have an activePeer but no matching thread yet (first-time chat opened
  // from a profile), synthesize a thread entry from the peer's profile so the
  // chat view opens immediately instead of showing "Select a conversation".
  useEffect(() => {
    if (!me || !activePeer) return;
    if (threads.some((t) => t.peerId === activePeer)) return;
    let cancel = false;
    (async () => {
      const [p] = await fetchPeerProfiles({ data: { userIds: [activePeer] } });
      if (cancel || !p) return;
      setThreads((prev) =>
        prev.some((t) => t.peerId === activePeer)
          ? prev
          : [
              {
                peerId: activePeer,
                peerName: p.name,
                peerSlug: p.slug,
                peerInitials: p.initials,
                peerGradient: p.gradient,
                peerAvatarUrl: p.avatarUrl,
                preview: "New conversation",
                lastAt: new Date().toISOString(),
                unread: 0,
              },
              ...prev,
            ],
      );
    })();
    return () => {
      cancel = true;
    };
  }, [me, activePeer, threads, fetchPeerProfiles]);

  // Load latest page of messages for active peer
  useEffect(() => {
    if (!me || !activePeer) {
      setMessages([]);
      setHasMoreOlder(false);
      return;
    }
    let cancel = false;
    setLoadingMessages(true);
    fetchMessages({ data: { peerId: activePeer, limit: PAGE_SIZE } })
      .then((page) => {
        if (cancel) return;
        setMessages(page.rows);
        setHasMoreOlder(page.hasMore);
      })
      .catch((e) => console.error("messages load failed", e))
      .finally(() => {
        if (!cancel) setLoadingMessages(false);
      });
    // Mark thread read
    markRead({ data: { peerId: activePeer } })
      .then(() => {
        setThreads((prev) => prev.map((t) => (t.peerId === activePeer ? { ...t, unread: 0 } : t)));
      })
      .catch(() => {});
    return () => {
      cancel = true;
    };
  }, [me, activePeer, fetchMessages, markRead]);

  const loadOlder = useCallback(async () => {
    if (!activePeer || loadingOlder || !hasMoreOlder) return;
    const oldest = messages[0];
    if (!oldest) return;
    const el = scrollRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    const prevTop = el?.scrollTop ?? 0;
    setLoadingOlder(true);
    try {
      const page = await fetchMessages({
        data: { peerId: activePeer, limit: PAGE_SIZE, before: oldest.created_at },
      });
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        const merged = [...page.rows.filter((r) => !seen.has(r.id)), ...prev];
        return merged;
      });
      setHasMoreOlder(page.hasMore);
      // Preserve scroll position after prepending
      requestAnimationFrame(() => {
        const nextEl = scrollRef.current;
        if (nextEl) nextEl.scrollTop = nextEl.scrollHeight - prevHeight + prevTop;
      });
    } catch (e) {
      console.error("load older failed", e);
    } finally {
      setLoadingOlder(false);
    }
  }, [activePeer, loadingOlder, hasMoreOlder, messages, fetchMessages]);

  // Realtime subscription
  useEffect(() => {
    if (!me) return;
    // Remove any stale channel with the same topic before resubscribing —
    // StrictMode / fast re-runs can otherwise return the still-subscribed
    // instance, and `.on()` after `.subscribe()` throws.
    const topic = `realtime:dm-${me}`;
    for (const c of supabase.getChannels()) {
      if (c.topic === topic) supabase.removeChannel(c);
    }
    const channel = supabase
      .channel(`dm-${me}`)

      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
          filter: `recipient_id=eq.${me}`,
        },
        (payload) => {
          const row = payload.new as DMRow;
          playNotificationSound("message");
          if (row.sender_id === activePeer) {
            setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
            markRead({ data: { peerId: row.sender_id } }).catch(() => {});
          }
          void reloadThreads();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
          filter: `sender_id=eq.${me}`,
        },
        (payload) => {
          const row = payload.new as DMRow;
          if (row.recipient_id === activePeer) {
            setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
          }
          void reloadThreads();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "direct_messages",
          filter: `sender_id=eq.${me}`,
        },
        (payload) => {
          const row = payload.new as DMRow;
          setMessages((prev) =>
            prev.map((m) => (m.id === row.id ? { ...m, read_at: row.read_at } : m)),
          );
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [me, activePeer, reloadThreads, markRead]);

  // Typing indicator — shared broadcast channel keyed by the sorted user-id pair.
  useEffect(() => {
    setPeerTyping(false);
    if (peerTypingTimerRef.current) {
      clearTimeout(peerTypingTimerRef.current);
      peerTypingTimerRef.current = null;
    }
    if (!me || !activePeer) {
      typingChanRef.current = null;
      return;
    }
    const key = [me, activePeer].sort().join(":");
    const channel = supabase.channel(`dm-typing:${key}`, {
      config: { broadcast: { self: false } },
    });
    channel
      .on("broadcast", { event: "typing" }, (payload) => {
        const from = (payload.payload as { from?: string } | undefined)?.from;
        if (from !== activePeer) return;
        setPeerTyping(true);
        if (peerTypingTimerRef.current) clearTimeout(peerTypingTimerRef.current);
        peerTypingTimerRef.current = setTimeout(() => setPeerTyping(false), 3500);
      })
      .on("broadcast", { event: "stop" }, (payload) => {
        const from = (payload.payload as { from?: string } | undefined)?.from;
        if (from !== activePeer) return;
        if (peerTypingTimerRef.current) clearTimeout(peerTypingTimerRef.current);
        setPeerTyping(false);
      })
      .subscribe();
    typingChanRef.current = channel;
    return () => {
      typingChanRef.current = null;
      if (peerTypingTimerRef.current) {
        clearTimeout(peerTypingTimerRef.current);
        peerTypingTimerRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [me, activePeer]);

  const emitTyping = useCallback(
    (isTyping: boolean) => {
      const chan = typingChanRef.current;
      if (!chan || !me || !activePeer) return;
      if (isTyping) {
        const now = Date.now();
        if (now - lastTypingSentRef.current < 1500) return;
        lastTypingSentRef.current = now;
        void chan.send({ type: "broadcast", event: "typing", payload: { from: me } });
        // Also fan out to the recipient's inbox channel so their Header can
        // surface an unobtrusive toast / badge when the chat isn't visible.
        const inbox = supabase.channel(`dm-typing-inbox:${activePeer}`);
        void inbox
          .send({ type: "broadcast", event: "typing", payload: { from: me } })
          .finally(() => {
            supabase.removeChannel(inbox);
          });
      } else {
        lastTypingSentRef.current = 0;
        void chan.send({ type: "broadcast", event: "stop", payload: { from: me } });
      }
    },
    [me, activePeer],
  );

  // Publish the currently-viewed peer so the Header can suppress typing
  // toasts for the chat the user is already reading.
  useEffect(() => {
    const w = window as unknown as { __oventricActiveChatPeer?: string | null };
    w.__oventricActiveChatPeer = activePeer;
    return () => {
      w.__oventricActiveChatPeer = null;
    };
  }, [activePeer]);

  const lastMsgId = messages[messages.length - 1]?.id ?? null;
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activePeer, lastMsgId]);

  const orderCtxFn = useServerFn(getPeerOrderContext);
  const refreshOrderCtx = useCallback(async () => {
    if (!me || !activePeer) {
      setOrderCtx(null);
      return;
    }
    try {
      setOrderCtx(await orderCtxFn({ data: { peerId: activePeer } }));
    } catch {
      setOrderCtx(null);
    }
  }, [me, activePeer, orderCtxFn]);

  useEffect(() => {
    void refreshOrderCtx();
  }, [refreshOrderCtx]);

  const selectThread = (peerId: string) => {
    setActivePeer(peerId);
    setShowListOnMobile(false);
  };

  const send = async () => {
    if (!activePeer) return;
    const body = draft.trim();
    if (!body) return;
    if (!me) {
      openGate("interaction");
      return;
    }
    setSending(true);
    const optimistic: DMRow = {
      id: `tmp-${Date.now()}`,
      sender_id: me,
      recipient_id: activePeer,
      body,
      media_path: null,
      media_type: null,
      created_at: new Date().toISOString(),
      read_at: null,
    };
    setMessages((prev) => [...prev, optimistic]);
    setDraft("");
    emitTyping(false);

    try {
      const row = await postMessage({ data: { recipientId: activePeer, body } });
      setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? row : m)));
      void reloadThreads();
    } catch (e) {
      console.error("send failed", e);
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setDraft(body);
    } finally {
      setSending(false);
    }
  };

  const wrapperClasses =
    "flex h-full min-h-0 max-h-full overflow-hidden bg-background text-foreground";

  if (!me) {
    return (
      <div className={wrapperClasses}>
        <div className="flex flex-1 items-center justify-center p-8 text-center">
          <div className="max-w-sm">
            <div className="mx-auto mb-5 w-20 h-20 rounded-full bg-primary/5 border border-primary/15 flex items-center justify-center">
              <MessageSquare className="w-8 h-8 text-primary" />
            </div>
            <div className="font-wallet-display text-foreground font-semibold text-lg">
              Sign in to open Messages
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Sign in to securely message buyers and sellers.
            </p>
            <button
              onClick={() => openGate("interaction")}
              className="mt-4 inline-flex items-center gap-2 px-4 py-3 rounded-[10px] bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm"
            >
              Connect account
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={wrapperClasses}>
      {/* LEFT — Thread Navigator */}
      <aside
        className={`${
          showListOnMobile ? "flex" : "hidden"
        } md:flex flex-col w-full md:w-[34%] md:min-w-[310px] md:max-w-[380px] border-r border-border bg-background`}
      >
        <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 space-y-2.5">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                type="text"
                placeholder="Search peers…"
                className="w-full h-10 pl-9 pr-3 bg-muted border border-transparent rounded-[10px] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:bg-background focus:border-primary/40"
              />
            </div>
            {variant === "compact" && onClose && (
              <button
                onClick={onClose}
                aria-label="Close messages"
                className="p-2 rounded-[10px] text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        {(() => {
          const online = [
            ...[...onlinePeers.entries()].map(([id, p]) => ({
              id,
              name: p.name,
              avatarUrl: p.avatarUrl,
              online: true,
            })),
            ...threads
              .filter((t) => !onlinePeers.has(t.peerId) && presence.isOnline(t.peerId))
              .map((t) => ({
                id: t.peerId,
                name: t.peerName,
                avatarUrl: t.peerAvatarUrl,
                online: true,
              })),
          ];
          const onlineIds = new Set(online.map((o) => o.id));
          const offline = threads
            .filter((t) => !onlineIds.has(t.peerId))
            .slice(0, 20)
            .map((t) => ({
              id: t.peerId,
              name: t.peerName,
              avatarUrl: t.peerAvatarUrl,
              online: false,
            }));
          const rail = [...online, ...offline];
          if (rail.length === 0) return null;
          return (
            <div className="border-b border-border px-4 py-3">
              <div className="text-[10px] uppercase tracking-wider font-bold text-primary mb-2">
                {online.length > 0 ? `Online now · ${online.length}` : "Recent peers"}
              </div>
              <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-0.5 px-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {rail.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => selectThread(p.id)}
                    title={p.name}
                    className="group shrink-0 flex flex-col items-center gap-1 w-14"
                  >
                    <div className="relative">
                      <div
                        className={`w-11 h-11 rounded-full overflow-hidden ring-2 transition ${
                          p.online
                            ? "ring-emerald-400/70"
                            : "ring-border group-hover:ring-primary/30"
                        }`}
                      >
                        <AvatarImage src={p.avatarUrl} alt={p.name} className="rounded-full" />
                      </div>
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background ${
                          p.online ? "bg-emerald-500 shadow-sm" : "bg-slate-300"
                        }`}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground truncate max-w-full">
                      {p.name.split(/\s+/)[0]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          );
        })()}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {loadingThreads && threads.length === 0 ? (
            <div className="text-xs text-slate-500 md:text-slate-400 text-center py-8 flex items-center justify-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading conversations…
            </div>
          ) : visibleThreads.length === 0 ? (
            <div className="text-xs text-slate-500 md:text-slate-400 text-center py-8">
              {threads.length === 0 ? "No conversations yet." : "No conversations match."}
            </div>
          ) : (
            visibleThreads.map((t) => (
              <ThreadRow
                key={t.peerId}
                thread={t}
                active={t.peerId === activePeer}
                online={isPeerOnline(t.peerId)}
                onClick={() => selectThread(t.peerId)}
              />
            ))
          )}
        </div>
      </aside>

      {/* RIGHT — Active Chat */}
      <section
        className={`${showListOnMobile ? "hidden" : "flex"} md:flex flex-1 min-w-0 min-h-0 h-full flex-col bg-muted/40`}
      >
        {!activeThread ? (
          <EmptyChat hasThreads={threads.length > 0} />
        ) : (
          <>
            <header className="shrink-0 flex items-center gap-3 px-4 sm:px-5 py-3 border-b border-border bg-background">
              <button
                onClick={() => setShowListOnMobile(true)}
                className="md:hidden text-primary text-xs font-semibold"
              >
                ← Back
              </button>
              <div className="relative shrink-0">
                <div className="w-10 h-10 rounded-full overflow-hidden">
                  <AvatarImage
                    src={activeThread.peerAvatarUrl}
                    alt={activeThread.peerName}
                    className="rounded-full"
                    loading="eager"
                  />
                </div>
                {isPeerOnline(activeThread.peerId) && (
                  <span
                    className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-background shadow-sm"
                    title="Online"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-wallet-display text-foreground font-semibold text-sm truncate">
                    {activeThread.peerName}
                  </span>
                  <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground ml-1">
                    <Star className="w-3 h-3" />
                    peer
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {peerTyping ? (
                    <span className="text-emerald-600 font-semibold">
                      typing…
                    </span>
                  ) : isPeerOnline(activeThread.peerId) ? (
                    <span className="text-emerald-600 font-semibold">
                      ● Online now
                    </span>
                  ) : (
                    <>
                      {presence.lastSeenLabel(activeThread.peerId) ??
                        `last active ${relative(activeThread.lastAt)}`}
                    </>
                  )}
                </div>
              </div>

              <Link
                to="/profile/$id"
                params={{ id: activeThread.peerSlug }}
                className="hidden sm:inline-flex items-center gap-1 text-[11px] text-primary hover:bg-primary/5 border border-primary/20 rounded-[10px] px-2.5 py-1.5"
              >
                <ExternalLink className="w-3 h-3" /> Profile
              </Link>
            </header>

            <OrderTradeBanner ctx={orderCtx} onChanged={() => void refreshOrderCtx()} />

            <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-5 space-y-3">
              {loadingMessages ? (
                <div className="text-xs text-slate-500 md:text-slate-400 text-center py-8 flex items-center justify-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading messages…
                </div>
              ) : messages.length === 0 ? (
                <div className="text-xs text-slate-500 md:text-slate-400 text-center py-8">
                  No messages yet — say hello.
                </div>
              ) : (
                <>
                  {hasMoreOlder && (
                    <div className="flex justify-center pb-2">
                      <button
                        onClick={() => void loadOlder()}
                        disabled={loadingOlder}
                        className="inline-flex items-center gap-2 text-[11px] font-semibold text-primary hover:bg-primary/5 border border-primary/20 rounded-full px-3 py-1 disabled:opacity-50"
                      >
                        {loadingOlder ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" /> Loading older…
                          </>
                        ) : (
                          <>Load older messages</>
                        )}
                      </button>
                    </div>
                  )}
                  {messages.map((m) => (
                    <MessageBubble key={m.id} msg={m} mine={m.sender_id === me} />
                  ))}
                </>
              )}
              {peerTyping && activeThread && (
                <div className="flex justify-start">
                   <div className="inline-flex items-center gap-2 rounded-xl px-3 py-3 bg-background border border-border shadow-sm">
                     <span className="text-[11px] text-muted-foreground">
                      {activeThread.peerName.split(/\s+/)[0]} is typing
                    </span>
                    <span className="flex items-end gap-0.5" aria-hidden="true">
                       <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                       <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                       <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" />
                    </span>
                  </div>
                </div>
              )}
            </div>

            <OrderChatActionBar ctx={orderCtx} onChanged={() => void refreshOrderCtx()} />

            <div
              className="relative z-10 shrink-0 border-t border-border bg-background p-3 sm:p-4"
              style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.75rem)" }}
            >
              {OFF_PLATFORM_RE.test(draft) && (
                <div className="mb-2 flex items-start gap-2 rounded-[10px] border border-amber-200 bg-amber-50 px-3 py-3 text-[11px] text-amber-800">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>
                    Heads up — trades finished off Oventric aren't covered by escrow, refunds or
                    dispute mediation. Keep the conversation and the delivery right here.
                  </span>
                </div>
              )}
              <div className="flex items-end gap-2">
                <textarea
                  value={draft}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDraft(v);
                    if (v.trim().length > 0) emitTyping(true);
                    else emitTyping(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  rows={1}
                  placeholder="Type a message…"
                  className="flex-1 resize-none max-h-32 min-h-[44px] bg-muted border border-border rounded-xl px-3.5 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:bg-background focus:border-primary/40"
                />
                <button
                  onClick={() => void send()}
                  disabled={!draft.trim() || sending}
                  className="shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Send message"
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

const OFF_PLATFORM_RE =
  /(whats\s?app|telegram|signal app|\bwa\.me\b|\bt\.me\b|\+?\d[\d\s().-]{8,}\d)/i;

function OrderTradeBanner({
  ctx,
  onChanged,
}: {
  ctx: PeerOrderContext | null;
  onChanged: () => void;
}) {
  const deliverFn = useServerFn(markOrderDelivered);
  const [busy, setBusy] = useState(false);
  if (!ctx) return null;

  const disputed = ctx.disputeStatus === "open";
  const sellerCanDeliver =
    ctx.role === "seller" && ctx.requiresManualDelivery && !ctx.deliveredAt && !disputed;

  const run = async (kind: "deliver") => {
    setBusy(true);
    try {
      if (kind === "deliver") {
        await deliverFn({ data: { orderId: ctx.orderId } });
        toast.success("Marked delivered — the buyer has been notified here.");
      }
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-b border-border bg-background px-4 sm:px-5 py-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wider text-primary mb-0.5">
            {disputed
              ? "Disputed trade"
              : ctx.deliveredAt
                ? "Delivered — awaiting confirmation"
                : "Active trade in escrow"}
          </div>
          <div className="text-sm text-foreground font-semibold truncate">
            {ctx.productName}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {ctx.displayCurrency} {ctx.displayTotal.toLocaleString()} held in escrow · Order{" "}
            {ctx.orderId.slice(0, 8)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {sellerCanDeliver && (
            <button
              onClick={() => void run("deliver")}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-xs font-bold text-primary-foreground bg-primary hover:bg-primary/90 disabled:opacity-60"
            >
              {busy ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Truck className="w-3.5 h-3.5" />
              )}{" "}
              Mark delivered
            </button>
          )}
          <Link
            to="/order/$id"
            params={{ id: ctx.orderId }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-xs font-semibold text-foreground bg-background border border-border hover:bg-muted"
          >
            <ShieldAlert className="w-3.5 h-3.5" />{" "}
            {ctx.role === "buyer" ? "Order & disputes" : "Order details"}
          </Link>
        </div>
      </div>
      <div className="mt-2 text-[11px] text-muted-foreground">
        Deliver and confirm here. Escrow, refunds and dispute mediation only cover trades completed
        on Oventric.
      </div>
    </div>
  );
}
