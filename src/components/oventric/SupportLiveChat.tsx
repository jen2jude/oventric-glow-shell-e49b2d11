import { useEffect, useRef, useState } from "react";
import { X, Send, Headset } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { playNotificationSound } from "@/lib/notification-sound";
import { listMySupportChat, sendSupportChatMessage } from "@/lib/support.functions";
import { useAuthGate } from "@/lib/auth-gate/AuthGateProvider";

type Msg = { id: string; sender: string; body: string; created_at: string };

export function SupportLiveChat({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { isAuthenticated, openGate } = useAuthGate();
  const listFn = useServerFn(listMySupportChat);
  const sendFn = useServerFn(sendSupportChatMessage);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !isAuthenticated) return;
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const load = async () => {
      try {
        const rows = (await listFn()) as Msg[];
        if (!cancelled) setMessages(rows);
      } catch {
        /* ignore */
      }
    };

    (async () => {
      await load();
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid || cancelled) return;
      channel = supabase
        .channel(`support-chat-${uid}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "support_chat_messages",
            filter: `user_id=eq.${uid}`,
          },
          (payload) => {
            const row = payload.new as Partial<Msg> | null;
            if (payload.eventType === "INSERT" && row?.sender && row.sender !== "user") {
              playNotificationSound("message");
            }
            void load();
          },
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [open, isAuthenticated, listFn]);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const send = async () => {
    const body = text.trim();
    if (!body || busy) return;
    if (!isAuthenticated) {
      openGate("generic");
      return;
    }
    setBusy(true);
    setText("");
    setMessages((m) => [
      ...m,
      { id: `tmp-${Date.now()}`, sender: "user", body, created_at: new Date().toISOString() },
    ]);
    try {
      await sendFn({ data: { body } });
    } catch {
      /* surfaced by realtime refresh */
    }
    setBusy(false);
  };

  return (
    <div className="support-live-web fixed inset-0 z-[70] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Live chat with support"
        className="support-live-dialog relative w-full sm:max-w-md h-[85vh] sm:h-[600px] flex flex-col rounded-t-[24px] sm:rounded-[24px] border overflow-hidden"
      >
        <div className="support-live-header flex items-center gap-3 px-4 py-3 border-b">
          <span className="relative w-10 h-10 grid place-items-center rounded-full bg-[var(--support-teal-soft)] text-[var(--support-teal)]">
            <Headset className="w-5 h-5" />
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[var(--support-teal)] border-2 border-[var(--support-surface)]" />
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-[var(--support-ink)] leading-tight">Oventric Live Support</p>
            <p className="text-[11px] text-[var(--support-teal)]">Online · 24/7 team</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close chat"
            className="support-live-close ml-auto p-2 rounded-[10px] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[var(--support-canvas)]">
          {!isAuthenticated && (
            <div className="support-live-notice rounded-2xl p-4 text-center">
              <p className="text-sm font-medium">Sign in to start a conversation with our team.</p>
            </div>
          )}
          {isAuthenticated && messages.length === 0 && (
            <div className="support-live-empty rounded-2xl border p-6 text-center shadow-sm">
              <p className="font-semibold text-[var(--support-ink)]">How can we help?</p>
              <p className="mt-1 text-sm text-[var(--support-copy)]">Send a message and an agent will pick it up.</p>
            </div>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={m.sender === "user" ? "flex justify-end" : "flex justify-start"}
            >
              <div
                className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  m.sender === "user"
                    ? "support-live-user-bubble rounded-br-md"
                    : "support-live-agent-bubble rounded-bl-md border"
                }`}
              >
                {m.body}
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        <div className="p-3 border-t border-[var(--support-line)] flex items-end gap-2 bg-[var(--support-surface)]">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={1}
            placeholder="Type your message…"
            className="support-live-input flex-1 resize-none max-h-28 rounded-2xl px-3.5 py-2.5 text-sm outline-none transition-all"
          />
          <button
            onClick={() => void send()}
            disabled={busy || !text.trim()}
            aria-label="Send message"
            className="support-live-send w-11 h-11 shrink-0 grid place-items-center rounded-full disabled:opacity-40 transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
