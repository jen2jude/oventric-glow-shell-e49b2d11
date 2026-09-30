import { Fragment, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link } from "@tanstack/react-router";
import { Drawer as VaulDrawer } from "vaul";
import { Drawer, DrawerOverlay, DrawerPortal } from "@/components/ui/drawer";
import {
  ArrowLeft,
  Search,
  Send,
  X,
  MessageSquare,
  Loader2,
  Truck,
  ShieldAlert,
  AlertTriangle,
  ShieldCheck,
  FileText,
  Paperclip,
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
  getMessageMediaUploadUrl,
  getMessageAttachmentUrls,
  type DMRow,
  type PeerOrderContext,
} from "@/lib/messaging/messages.functions";
import { markOrderDelivered } from "@/lib/fulfilment.functions";
import { OrderChatActionBar } from "@/components/oventric/OrderChatActionBar";
import { AvatarImage } from "@/components/oventric/AvatarImage";
import { usePresence } from "@/hooks/use-presence";
import { setChatOpen } from "@/hooks/use-chat-open";

interface OnlinePeer {
  name: string;
  slug: string;
  avatarUrl: string | null;
  gradient: string;
}

interface AppMessagesProps {
  initialThreadId?: string; // treated as peerId
  onClose?: () => void;
}

const OFF_PLATFORM_RE =
  /(whats\s?app|telegram|signal app|\bwa\.me\b|\bt\.me\b|\+?\d[\d\s().-]{8,}\d)/i;

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

// Grouping key + label for chat time dividers: one section per minute.
function formatStamp(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const time = d
    .toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    .toLowerCase()
    .replace(/\s/g, " ");
  if (d.toDateString() === now.toDateString()) return time;
  const dayMs = 86400000;
  if (now.getTime() - d.getTime() < 7 * dayMs)
    return `${d.toLocaleDateString([], { weekday: "short" })} ${time}`;
  return `${d.toLocaleDateString()} ${time}`;
}

function TimeDivider({ label }: { label: string }) {
  return (
    <div className="my-2.5 flex justify-center" aria-hidden="true">
      <span className="text-[10px] font-medium tracking-wide text-[#E5484D]/80">{label}</span>
    </div>
  );
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

function Bubble({
  msg,
  mine,
  attachmentUrl,
}: {
  msg: DMRow;
  mine: boolean;
  attachmentUrl?: string | null;
}) {
  const productId = extractProductId(msg.body);

  if (msg.is_system) {
    return (
      <div
        role="note"
        aria-label="Oventric order update"
        className="mx-auto my-3 w-full max-w-md rounded-[10px] border border-sky-400/25 bg-sky-400/10 px-4 py-3 text-slate-100"
      >
        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-sky-300">
          <ShieldCheck className="size-3.5" aria-hidden="true" /> Oventric update
        </div>
        <div {...pressCopy} className="chat-selectable whitespace-pre-wrap break-words text-sm leading-relaxed">{msg.body}</div>
      </div>
    );
  }
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[78%] rounded-[22px] px-3.5 py-2 text-sm ${
          mine
            ? "rounded-br-lg bg-[#E5484D] text-white shadow-sm"
            : "rounded-bl-lg border border-white/10 bg-white/[0.06] text-slate-100 shadow-sm"
        }`}
      >
        {stripProductLink(msg.body) && (
          <div {...pressCopy} className="chat-selectable leading-relaxed whitespace-pre-wrap break-words">
            {stripProductLink(msg.body)}
          </div>
        )}
        {productId && <ProductBubbleCard productId={productId} mine={mine} />}
        {msg.media_path && (
          <div className="mt-1.5">
            {msg.media_type?.startsWith("image/") && attachmentUrl ? (
              <a href={attachmentUrl} target="_blank" rel="noreferrer">
                <img
                  loading="lazy"
                  decoding="async"
                  src={attachmentUrl}
                  alt="attachment"
                  className="max-h-56 rounded-[10px] border border-white/10"
                />
              </a>
            ) : attachmentUrl ? (
              <a
                href={attachmentUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[11px] underline underline-offset-2 opacity-90"
              >
                <FileText className="w-3.5 h-3.5" /> Open attachment
              </a>
            ) : (
              <div className="inline-flex items-center gap-1.5 text-[11px] italic opacity-80">
                <FileText className="w-3.5 h-3.5" /> Attachment
              </div>
            )}
          </div>
        )}
        {mine && !msg.id.startsWith("tmp-") && (
          <div className="mt-0.5 flex justify-end">
            <span
              className="text-[9px] leading-none text-white/60"
              title={msg.read_at ? `Read ${formatTime(msg.read_at)}` : "Sent"}
              aria-label={msg.read_at ? "Read" : "Sent"}
            >
              {msg.read_at ? "✓✓" : "✓"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function TradeBanner({
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

  const run = async () => {
    setBusy(true);
    try {
      await deliverFn({ data: { orderId: ctx.orderId } });
      toast.success("Marked delivered — the buyer has been notified here.");
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="shrink-0 border-b border-amber-400/20 bg-amber-400/[0.08] px-4 py-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-300 mb-0.5">
            {disputed
              ? "Disputed trade"
              : ctx.deliveredAt
                ? "Delivered — awaiting confirmation"
                : "Active trade in escrow"}
          </div>
          <div className="text-sm text-slate-100 font-semibold truncate">{ctx.productName}</div>
          <div className="text-[11px] text-slate-400">
            {ctx.displayCurrency} {ctx.displayTotal.toLocaleString()} held in escrow · Order{" "}
            {ctx.orderId.slice(0, 8)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {sellerCanDeliver && (
            <button
              onClick={() => void run()}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-xs font-bold text-white bg-[#E5484D] hover:bg-[#d13a3f] disabled:opacity-60"
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
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-xs font-semibold text-slate-200 bg-white/[0.06] border border-white/10 hover:bg-white/10"
          >
            <ShieldAlert className="w-3.5 h-3.5" />{" "}
            {ctx.role === "buyer" ? "Order & disputes" : "Order details"}
          </Link>
        </div>
      </div>
    </div>
  );
}

export function AppMessages({ initialThreadId, onClose }: AppMessagesProps) {
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
  const [attachment, setAttachment] = useState<{
    file: File;
    previewUrl: string | null;
    path: string | null;
    uploading: boolean;
    error: string | null;
  } | null>(null);
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const getUploadUrl = useServerFn(getMessageMediaUploadUrl);
  const getAttachmentUrls = useServerFn(getMessageAttachmentUrls);
  const [orderCtx, setOrderCtx] = useState<PeerOrderContext | null>(null);
  const [onlinePeers, setOnlinePeers] = useState<Map<string, OnlinePeer>>(new Map());
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

  // Hide the app tab bar while a conversation is open so the composer is clear.
  useEffect(() => {
    if (!activePeer) return;
    document.body.setAttribute("data-chat-open", "1");
    setChatOpen(true);
    return () => {
      document.body.removeAttribute("data-chat-open");
      setChatOpen(false);
    };
  }, [activePeer]);

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

  // Realtime presence
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

  useEffect(() => {
    if (initialThreadId) setActivePeer(initialThreadId);
  }, [initialThreadId]);

  // Synthesize a thread entry for first-time chats opened from a profile.
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
        return [...page.rows.filter((r) => !seen.has(r.id)), ...prev];
      });
      setHasMoreOlder(page.hasMore);
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

  // Typing indicator
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

  const clearAttachment = useCallback(() => {
    setAttachment((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const onPickFile = useCallback(
    async (file?: File) => {
      if (!file) return;
      if (!me) {
        openGate("interaction");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File is too large", { description: "Attachments must be 10MB or smaller." });
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
      setAttachment({ file, previewUrl, path: null, uploading: true, error: null });
      try {
        const { path, token } = await getUploadUrl({ data: { filename: file.name } });
        const { error: upErr } = await supabase.storage
          .from("post-media")
          .uploadToSignedUrl(path, token, file);
        if (upErr) throw new Error(upErr.message);
        setAttachment({ file, previewUrl, path, uploading: false, error: null });
      } catch (e) {
        setAttachment({
          file,
          previewUrl,
          path: null,
          uploading: false,
          error: e instanceof Error ? e.message : "Upload failed.",
        });
      }
    },
    [me, openGate, getUploadUrl],
  );

  // Sign attachment paths so images/files in the thread can be previewed.
  useEffect(() => {
    const paths = messages.map((m) => m.media_path).filter((p): p is string => !!p);
    const missing = paths.filter((p) => !attachmentUrls[p]);
    if (!missing.length) return;
    getAttachmentUrls({ data: { paths: missing.slice(0, 50) } })
      .then((map) => setAttachmentUrls((prev) => ({ ...prev, ...map })))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  const send = async () => {
    if (!activePeer) return;
    const body = draft.trim();
    const mediaPath = attachment?.path ?? null;
    if (!body && !mediaPath) return;
    if (attachment?.uploading) {
      toast.error("Attachment is still uploading");
      return;
    }
    if (!me) {
      openGate("interaction");
      return;
    }
    setSending(true);
    const mediaType = attachment?.file.type ?? null;
    const optimistic: DMRow = {
      id: `tmp-${Date.now()}`,
      sender_id: me,
      recipient_id: activePeer,
      body: body || null,
      media_path: mediaPath,
      media_type: mediaType,
      created_at: new Date().toISOString(),
      read_at: null,
      is_system: false,
    };
    if (mediaPath && attachment?.previewUrl) {
      const localPreview = attachment.previewUrl;
      setAttachmentUrls((prev) => ({ ...prev, [mediaPath]: prev[mediaPath] ?? localPreview }));
    }
    setMessages((prev) => [...prev, optimistic]);
    setDraft("");
    setAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    emitTyping(false);

    try {
      const row = await postMessage({
        data: {
          recipientId: activePeer,
          body: body || undefined,
          mediaPath: mediaPath ?? undefined,
          mediaType: mediaType ?? undefined,
        },
      });
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

  const closeAll = () => {
    if (activePeer) {
      setActivePeer(null);
      return;
    }
    onClose?.();
  };

  if (!me) {
    return (
      <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[#070A08] text-slate-200">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close messages"
            className="absolute right-4 top-4 z-10 grid size-9 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-slate-300 hover:bg-white/10 hover:text-white active:scale-95 transition-transform"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        <div className="flex flex-1 items-center justify-center p-8 text-center">
          <div className="max-w-sm">
            <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full border border-white/10 bg-white/[0.06]">
              <MessageSquare className="size-7 text-[#E5484D]" />
            </div>
            <div className="text-slate-100 font-semibold text-lg">Sign in to open Messages</div>
            <p className="text-sm text-slate-400 mt-2">
              Sign in to securely message buyers and sellers.
            </p>
            <button
              onClick={() => openGate("interaction")}
              className="mt-5 h-11 rounded-[10px] px-5 font-bold bg-[#E5484D] text-white hover:bg-[#d13a3f]"
            >
              Connect account
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Keep the inbox mounted underneath the conversation sheet.
  const conversation = activePeer && activeThread ? (
      <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[#070A08] text-slate-200">
        <header
          className="shrink-0 flex items-center gap-3 px-3 py-3 border-b border-white/10 bg-[#070A08]/95 backdrop-blur"
        >
          <button
            type="button"
            onClick={closeAll}
            aria-label="Back to conversations"
            className="grid size-9 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-slate-300"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <Link
            to="/profile/$id"
            params={{ id: activeThread.peerSlug }}
            className="relative shrink-0"
          >
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
                className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#070A08]"
                title="Online"
              />
            )}
          </Link>
          <div className="min-w-0 flex-1">
            <div className="text-slate-100 font-semibold text-sm truncate">
              {activeThread.peerName}
            </div>
            <div className="text-[11px] text-slate-500">
              {peerTyping ? (
                <span className="text-emerald-400 font-semibold">typing…</span>
              ) : isPeerOnline(activeThread.peerId) ? (
                <span className="text-emerald-400 font-semibold">● Online now</span>
              ) : (
                (presence.lastSeenLabel(activeThread.peerId) ??
                `last active ${relative(activeThread.lastAt)}`)
              )}
            </div>
          </div>
        </header>

        <TradeBanner ctx={orderCtx} onChanged={() => void refreshOrderCtx()} />

        <div
          ref={scrollRef}
          className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-4 py-5 space-y-1.5"
        >
          {loadingMessages ? (
            <div className="text-xs text-slate-500 text-center py-8 flex items-center justify-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading messages…
            </div>
          ) : messages.length === 0 ? (
            <div className="text-xs text-slate-500 text-center py-8">
              No messages yet — say hello.
            </div>
          ) : (
            <>
              {hasMoreOlder && (
                <div className="flex justify-center pb-2">
                  <button
                    onClick={() => void loadOlder()}
                    disabled={loadingOlder}
                    className="inline-flex items-center gap-2 text-[11px] font-semibold text-[#E5484D] border border-[#E5484D]/30 rounded-full px-3 py-1 disabled:opacity-50"
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
              {messages.map((m, i) => {
                const stamp = formatStamp(m.created_at);
                const prevStamp = i > 0 ? formatStamp(messages[i - 1].created_at) : null;
                return (
                  <Fragment key={m.id}>
                    {stamp !== prevStamp && <TimeDivider label={stamp} />}
                    <Bubble
                      msg={m}
                      mine={m.sender_id === me}
                      attachmentUrl={m.media_path ? (attachmentUrls[m.media_path] ?? null) : null}
                    />
                  </Fragment>
                );
              })}
            </>
          )}
          {peerTyping && (
            <div className="flex justify-start">
              <div className="inline-flex items-center gap-2 rounded-[22px] px-3 py-3 bg-white/[0.06] border border-white/10">
                <span className="text-[11px] text-slate-400">
                  {activeThread.peerName.split(/\s+/)[0]} is typing
                </span>
                <span className="flex items-end gap-0.5" aria-hidden="true">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#E5484D] animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#E5484D] animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#E5484D] animate-bounce" />
                </span>
              </div>
            </div>
          )}
        </div>

        <OrderChatActionBar ctx={orderCtx} onChanged={() => void refreshOrderCtx()} />

        <div
          className="shrink-0 border-t border-white/10 bg-[#070A08] p-3"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.75rem)" }}
        >
          {OFF_PLATFORM_RE.test(draft) && (
            <div className="mb-2 flex items-start gap-2 rounded-[10px] border border-amber-400/25 bg-amber-400/10 px-3 py-3 text-[11px] text-amber-200">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>
                Heads up — trades finished off Oventric aren't covered by escrow, refunds or
                dispute mediation. Keep the conversation and the delivery right here.
              </span>
            </div>
          )}
          {attachment && (
            <div className="mb-2 flex items-center gap-2 rounded-[10px] border border-white/10 bg-white/[0.06] px-2.5 py-2">
              {attachment.previewUrl ? (
                <img
                  loading="lazy"
                  decoding="async"
                  src={attachment.previewUrl}
                  alt=""
                  className="size-10 rounded-[8px] object-cover border border-white/10"
                />
              ) : (
                <span className="grid size-10 place-items-center rounded-[8px] border border-white/10 bg-white/[0.06] text-slate-400">
                  <FileText className="w-4 h-4" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium text-slate-200">
                  {attachment.file.name}
                </div>
                {attachment.uploading ? (
                  <div className="flex items-center gap-1 text-[10px] text-slate-500">
                    <Loader2 className="w-3 h-3 animate-spin" /> Uploading…
                  </div>
                ) : attachment.error ? (
                  <div className="flex items-center gap-1 text-[10px] text-red-400">
                    <AlertTriangle className="w-3 h-3" /> {attachment.error}
                  </div>
                ) : (
                  <div className="text-[10px] text-slate-500">Ready to send</div>
                )}
              </div>
              <button
                type="button"
                onClick={clearAttachment}
                aria-label="Remove attachment"
                className="rounded-[8px] p-1 text-slate-400 hover:bg-white/10"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <label
              aria-label="Attach a photo, video or file"
              title="Attach a photo, video or file"
              aria-disabled={sending || !!attachment}
              className={`relative overflow-hidden grid size-10 shrink-0 cursor-pointer place-items-center rounded-full border border-white/10 bg-white/[0.06] text-slate-400 hover:text-slate-200 ${sending || attachment ? "pointer-events-none opacity-50" : ""}`}
            >
              <Paperclip className="w-4 h-4" />
                <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              onChange={(e) => void onPickFile(e.target.files?.[0])}
                              disabled={sending || !!attachment}
                />
            </label>
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
              placeholder="Write a message…"
              className="flex-1 min-h-10 max-h-32 resize-none rounded-[10px] border border-white/10 bg-white/[0.06] px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-[#E5484D]/50"
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={(!draft.trim() && !attachment?.path) || sending || !!attachment?.uploading}
              aria-label="Send message"
              className="grid size-10 shrink-0 place-items-center rounded-full bg-[#E5484D] text-white hover:bg-[#d13a3f] disabled:opacity-40"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    ) : (
      <div className="flex h-full items-center justify-center bg-[#070A08] text-slate-400">
        <Loader2 className="size-5 animate-spin" aria-label="Opening conversation" />
      </div>
    );

  // ---------- Thread list view ----------
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
    .map((t) => ({ id: t.peerId, name: t.peerName, avatarUrl: t.peerAvatarUrl, online: false }));
  const rail = [...online, ...offline];

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[#070A08] text-slate-200">
      <header
        className="shrink-0 border-b border-white/10 bg-[#070A08]/95 backdrop-blur px-4 pb-3 space-y-3"
        style={{ paddingTop: "max(env(safe-area-inset-top), 0.75rem)" }}
      >
        <div className="flex items-center gap-3">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close messages"
              className="grid size-9 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-slate-300"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <h1 className="text-lg font-bold text-slate-100">Messages</h1>
            <p className="text-[11px] text-slate-500">Secure buyer and seller conversations</p>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            type="text"
            placeholder="Search conversations…"
            className="w-full h-11 pl-9 pr-3 bg-white/[0.06] border border-white/10 rounded-[10px] text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-[#E5484D]/50"
          />
        </div>
      </header>

      {rail.length > 0 && (
        <div className="shrink-0 border-b border-white/10 px-4 py-3">
          <div className="text-[10px] uppercase tracking-wider font-bold text-emerald-400 mb-2">
            {online.length > 0 ? `Online now · ${online.length}` : "Recent peers"}
          </div>
          <div className="flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {rail.map((p) => (
              <button
                key={p.id}
                onClick={() => setActivePeer(p.id)}
                title={p.name}
                className="group shrink-0 flex flex-col items-center gap-1 w-14"
              >
                <div className="relative">
                  <div
                    className={`w-11 h-11 rounded-full overflow-hidden ring-2 transition ${
                      p.online ? "ring-emerald-400/70" : "ring-white/10 group-hover:ring-white/25"
                    }`}
                  >
                    <AvatarImage src={p.avatarUrl} alt={p.name} className="rounded-full" />
                  </div>
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#070A08] ${
                      p.online ? "bg-emerald-500" : "bg-slate-600"
                    }`}
                  />
                </div>
                <span className="text-[10px] text-slate-400 truncate max-w-full">
                  {p.name.split(/\s+/)[0]}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain p-3 space-y-1.5 pb-24">
        {loadingThreads && threads.length === 0 ? (
          <div className="text-xs text-slate-500 text-center py-8 flex items-center justify-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading conversations…
          </div>
        ) : visibleThreads.length === 0 ? (
          <div className="text-xs text-slate-500 text-center py-8">
            {threads.length === 0 ? "No conversations yet." : "No conversations match."}
          </div>
        ) : (
          visibleThreads.map((t) => {
            const unread = t.unread > 0;
            return (
              <button
                key={t.peerId}
                onClick={() => setActivePeer(t.peerId)}
                className={`w-full text-left rounded-[10px] border transition-all ${
                  unread
                    ? "border-[#E5484D]/25 bg-[#E5484D]/[0.08]"
                    : "border-transparent bg-white/[0.03] hover:border-white/10 hover:bg-white/[0.06]"
                }`}
              >
                <div className="flex items-start gap-3 px-3 py-3">
                  <div className="relative shrink-0">
                    <div className="w-10 h-10 rounded-full overflow-hidden">
                      <AvatarImage src={t.peerAvatarUrl} alt={t.peerName} className="rounded-full" />
                    </div>
                    {isPeerOnline(t.peerId) && (
                      <span
                        className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#070A08]"
                        title="Online"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-slate-100 truncate">
                        {t.peerName}
                      </span>
                      <span className="ml-auto shrink-0 text-[10px] text-slate-500">
                        {formatTime(t.lastAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="text-xs text-slate-400 truncate flex-1">{t.preview}</div>
                      {unread && (
                        <span className="shrink-0 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-[#E5484D] text-white text-[10px] font-bold">
                          {t.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
      <Drawer repositionInputs={false} open={!!activePeer} onOpenChange={(open) => { if (!open) setActivePeer(null); }}>
        <DrawerPortal>
          <DrawerOverlay className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-md" />
          <VaulDrawer.Content
            aria-label="Conversation"
            className="fixed inset-x-0 bottom-0 z-[91] mx-auto flex h-[94dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl border border-b-0 border-white/10 bg-[#070A08] outline-none"
          >
            <div className="mx-auto my-2.5 h-1.5 w-10 shrink-0 rounded-full bg-white/20" aria-hidden="true" />
            <div className="min-h-0 flex-1">{conversation}</div>
          </VaulDrawer.Content>
        </DrawerPortal>
      </Drawer>
    </div>
  );
}
