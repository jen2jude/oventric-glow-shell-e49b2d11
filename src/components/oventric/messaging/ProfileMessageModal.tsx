import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Paperclip, Send, X, FileText, AlertTriangle, ShoppingBag } from "lucide-react";
import {
  ProductBubbleCard,
  extractProductId,
  stripProductLink,
} from "@/components/oventric/messaging/ProductBubbleCard";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuthGate } from "@/lib/auth-gate/AuthGateProvider";
import { AvatarImage } from "@/components/oventric/AvatarImage";
import {
  ensureDirectThread,
  sendMessage,
  markThreadRead,
  getMessageMediaUploadUrl,
  getMessageAttachmentUrls,
  type DMRow,
} from "@/lib/messaging/messages.functions";

export interface ProfileMessageRecipient {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  slug?: string | null;
}

/** A product "clipped" into the conversation (marketplace → chat with seller). */
export interface ChatProductPin {
  id: string;
  name: string;
  coverUrl?: string | null;
  priceLabel?: string | null;
}

interface ProfileMessageModalProps {
  open: boolean;
  onClose: () => void;
  recipient: ProfileMessageRecipient;
  /** Pre-filled composer text (e.g. the product enquiry line). */
  initialDraft?: string;
  /** Product card clipped to the composer and sent with the first message. */
  pinnedProduct?: ChatProductPin | null;
}

const MAX_BODY = 4000;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

interface PendingAttachment {
  file: File;
  previewUrl: string | null;
  path: string | null;
  uploading: boolean;
  error: string | null;
}

export function ProfileMessageModal({
  open,
  onClose,
  recipient,
  initialDraft,
  pinnedProduct,
}: ProfileMessageModalProps) {
  const { session } = useAuthGate();
  const me = session?.user?.id ?? null;

  const fetchThread = useServerFn(ensureDirectThread);
  const postMessage = useServerFn(sendMessage);
  const markRead = useServerFn(markThreadRead);
  const getUploadUrl = useServerFn(getMessageMediaUploadUrl);
  const getAttachmentUrls = useServerFn(getMessageAttachmentUrls);

  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<DMRow[]>([]);
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState<PendingAttachment | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const bodyTooLong = draft.length > MAX_BODY;
  const canSend =
    !sending &&
    !attachment?.uploading &&
    !bodyTooLong &&
    (draft.trim().length > 0 || !!attachment?.path);

  // Load / create thread on open
  useEffect(() => {
    if (!open || !me) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchThread({ data: { peerId: recipient.userId } })
      .then((info) => {
        if (cancelled) return;
        setMessages(info.messages);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load conversation");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, me, recipient.userId, fetchThread]);

  // Reset local composer state each time the modal opens
  useEffect(() => {
    if (!open) return;
    setDraft(initialDraft ?? "");
    setAttachment(null);
    setError(null);
  }, [open, initialDraft]);

  // Sign any attachment paths present in loaded history
  useEffect(() => {
    const paths = messages.map((m) => m.media_path).filter((p): p is string => !!p);
    const missing = paths.filter((p) => !attachmentUrls[p]);
    if (!missing.length) return;
    getAttachmentUrls({ data: { paths: missing } })
      .then((map) => setAttachmentUrls((prev) => ({ ...prev, ...map })))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  // Scroll to bottom whenever the message list changes / modal opens
  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (el) requestAnimationFrame(() => (el.scrollTop = el.scrollHeight));
  }, [open, messages, loading]);

  // Realtime: live delivery of new messages in this DM pair + read receipts
  useEffect(() => {
    if (!open || !me) return;
    const topic = `realtime:dm-modal-${me}-${recipient.userId}`;
    for (const c of supabase.getChannels()) {
      if (c.topic === topic) supabase.removeChannel(c);
    }
    const channel = supabase
      .channel(`dm-modal-${me}-${recipient.userId}`)
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
          if (row.sender_id !== recipient.userId) return;
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
          markRead({ data: { peerId: recipient.userId } }).catch(() => {});
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
          if (row.recipient_id !== recipient.userId) return;
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
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
  }, [open, me, recipient.userId, markRead]);

  // Focus trap + Escape + scroll lock
  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtnRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const root = dialogRef.current;
      if (!root) return;
      const focusables = root.querySelectorAll<HTMLElement>(
        'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])',
      );
      const list = Array.from(focusables).filter((el) => !el.hasAttribute("disabled"));
      if (!list.length) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
      previousFocusRef.current?.focus?.();
    };
  }, [open, onClose]);

  const clearAttachment = useCallback(() => {
    setAttachment((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const onPickFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      if (!ALLOWED_TYPES.includes(file.type)) {
        setAttachment({
          file,
          previewUrl: null,
          path: null,
          uploading: false,
          error: "Unsupported file type.",
        });
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        setAttachment({
          file,
          previewUrl: null,
          path: null,
          uploading: false,
          error: "File exceeds the 10MB limit.",
        });
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
    [getUploadUrl],
  );

  const send = useCallback(async () => {
    if (!me || sending) return;
    const body = draft.trim();
    if (!body && !attachment?.path) {
      setError("Write a message or attach a file before sending.");
      return;
    }
    if (bodyTooLong) {
      setError(`Message is too long (max ${MAX_BODY} characters).`);
      return;
    }
    if (attachment?.uploading) {
      setError("Please wait for the attachment to finish uploading.");
      return;
    }
    setError(null);
    setSending(true);
    const tempId = `tmp-${Date.now()}`;
    const optimistic: DMRow = {
      id: tempId,
      sender_id: me,
      recipient_id: recipient.userId,
      body: body || null,
      media_path: attachment?.path ?? null,
      media_type: attachment?.file.type ?? null,
      created_at: new Date().toISOString(),
      read_at: null,
      is_system: false,
    };
    setMessages((prev) => [...prev, optimistic]);
    const draftBackup = draft;
    const attachmentBackup = attachment;
    setDraft("");
    clearAttachment();
    try {
      const row = await postMessage({
        data: {
          recipientId: recipient.userId,
          body: body || undefined,
          mediaPath: attachment?.path ?? undefined,
          mediaType: attachment?.file.type ?? undefined,
        },
      });
      setMessages((prev) => prev.map((m) => (m.id === tempId ? row : m)));
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setDraft(draftBackup);
      setAttachment(attachmentBackup);
      toast.error(e instanceof Error ? e.message : "Failed to send message.");
    } finally {
      setSending(false);
    }
  }, [me, sending, draft, attachment, bodyTooLong, recipient.userId, postMessage, clearAttachment]);

  const initials = useMemo(
    () =>
      recipient.displayName
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase() ?? "")
        .join("") || "??",
    [recipient.displayName],
  );

  if (!open) return null;

  return createPortal(
    <>
      <div onClick={onClose} aria-hidden="true" className="fixed inset-0 z-[70] bg-black/60" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Message ${recipient.displayName}`}
        className="fixed z-[71] inset-0 md:flex md:items-center md:justify-center"
      >
        <div className="w-full h-full md:w-[880px] md:max-w-full md:h-[88vh] flex flex-col rounded-none md:rounded-2xl bg-[#16161B] md:bg-white border-0 md:border border-white/10 md:border-slate-200 shadow-2xl overflow-hidden">
          <header className="flex items-center gap-3 px-4 py-3 border-b border-white/10 md:border-slate-200 bg-[#1A1A1F] md:bg-white shrink-0">
            <div className="w-9 h-9 rounded-full overflow-hidden shrink-0">
              <AvatarImage
                src={recipient.avatarUrl ?? null}
                alt={recipient.displayName}
                className="rounded-full"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-black text-white md:text-slate-900 truncate">
                Message {recipient.displayName}
              </div>
              <div className="text-[11px] text-slate-500 md:text-slate-400">Direct message</div>
            </div>
            <button
              ref={closeBtnRef}
              onClick={onClose}
              aria-label="Close message composer"
              className="p-1.5 rounded-[10px] text-slate-400 hover:text-white md:hover:text-slate-900 hover:bg-white/5 md:hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
          </header>

          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-4 space-y-2.5 min-h-[220px] bg-[#121214] md:bg-slate-50"
          >
            {loading ? (
              <div className="flex items-center justify-center h-full text-xs text-slate-400 gap-2 py-10">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading conversation…
              </div>
            ) : error && messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-xs text-red-400 gap-2 py-10">
                <AlertTriangle className="w-4 h-4" /> {error}
              </div>
            ) : messages.length === 0 ? (
              <div className="text-xs text-slate-500 md:text-slate-400 text-center py-10">
                No messages yet — say hello to {recipient.displayName.split(/\s+/)[0]}.
              </div>
            ) : (
              messages.map((m) => {
                if (m.is_system) {
                  return (
                    <div key={m.id} role="note" aria-label="Oventric order update" className="mx-auto w-full max-w-md rounded-[10px] border border-chat-blue/25 bg-chat-blue-soft px-4 py-3 text-chat-ink">
                      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-chat-blue">
                        <ShoppingBag className="size-3.5" aria-hidden="true" /> Oventric update
                      </div>
                      <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">{m.body}</div>
                      <div className="mt-2 text-[10px] text-chat-muted">{formatTime(m.created_at)}</div>
                    </div>
                  );
                }
                const mine = m.sender_id === me;
                const isTmp = m.id.startsWith("tmp-");
                const url = m.media_path ? attachmentUrls[m.media_path] : null;
                const isImage = m.media_type?.startsWith("image/");
                let statusLabel: string | null = null;
                if (mine && !isTmp) statusLabel = m.read_at ? "Seen" : "Sent";
                else if (mine && isTmp) statusLabel = "Sending…";
                return (
                  <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[80%] rounded-xl px-3.5 py-2.5 text-sm text-white ${mine ? "" : "md:text-slate-800"} ${
                        mine
                          ? "bg-gradient-to-br from-emerald-500 to-emerald-600 border border-emerald-400/60"
                          : "bg-[#2A2A32] md:bg-slate-100 border border-white/5 md:border-slate-200"
                      } ${isTmp ? "opacity-70" : ""}`}
                    >
                      {(() => {
                        const pid = extractProductId(m.body);
                        const text = stripProductLink(m.body);
                        return (
                          <>
                            {text && (
                              <div className="leading-relaxed whitespace-pre-wrap break-words">
                                {text}
                              </div>
                            )}
                            {pid && (
                              <ProductBubbleCard productId={pid} mine={mine} onNavigate={onClose} />
                            )}
                          </>
                        );
                      })()}
                      {m.media_path && (
                        <div className="mt-1.5">
                          {isImage && url ? (
                            <img loading="lazy" decoding="async"
                              src={url}
                              alt="attachment"
                              className="max-h-40 rounded-[10px] border border-white/10"
                            />
                          ) : url ? (
                            <a
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 text-[11px] underline underline-offset-2 opacity-90"
                            >
                              <FileText className="w-3.5 h-3.5" /> Attachment
                            </a>
                          ) : (
                            <div className="inline-flex items-center gap-1.5 text-[11px] italic opacity-80">
                              <FileText className="w-3.5 h-3.5" /> Attachment
                            </div>
                          )}
                        </div>
                      )}
                      <div
                        className={`text-[10px] mt-1 flex items-center gap-1 ${
                          mine
                            ? "text-emerald-100/80 justify-end"
                            : "text-slate-500 md:text-slate-400"
                        }`}
                      >
                        <span>{formatTime(m.created_at)}</span>
                        {statusLabel && (
                          <span
                            className={
                              isTmp
                                ? "text-emerald-100/60"
                                : m.read_at
                                  ? "text-sky-200"
                                  : "text-emerald-100/60"
                            }
                            title={statusLabel}
                            aria-label={statusLabel}
                          >
                            {isTmp ? "…" : m.read_at ? "✓✓ Seen" : "✓ Sent"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="border-t border-white/10 md:border-slate-200 bg-[#16161B] md:bg-white p-3 shrink-0">
            {pinnedProduct && (
              <div className="mb-2 flex items-center gap-2 rounded-[10px] border border-emerald-500/30 bg-emerald-500/10 md:bg-emerald-50 px-2.5 py-2">
                <div className="w-9 h-9 rounded overflow-hidden bg-white/10 md:bg-slate-100 shrink-0 flex items-center justify-center">
                  {pinnedProduct.coverUrl ? (
                    <img loading="lazy" decoding="async"
                      src={pinnedProduct.coverUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ShoppingBag className="w-4 h-4 text-emerald-400" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold">
                    Product clipped
                  </div>
                  <div className="text-xs text-slate-200 md:text-slate-800 font-semibold truncate">
                    {pinnedProduct.name}
                  </div>
                </div>
                {pinnedProduct.priceLabel && (
                  <div className="text-xs font-black text-emerald-300 md:text-emerald-600 shrink-0">
                    {pinnedProduct.priceLabel}
                  </div>
                )}
              </div>
            )}
            {attachment && (
              <div className="mb-2 flex items-center gap-2 rounded-[10px] border border-white/10 md:border-slate-200 bg-white/5 md:bg-slate-50 px-2.5 py-2">
                {attachment.previewUrl ? (
                  <img loading="lazy" decoding="async"
                    src={attachment.previewUrl}
                    alt=""
                    className="w-9 h-9 rounded object-cover shrink-0"
                  />
                ) : (
                  <FileText className="w-5 h-5 text-slate-400 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-slate-200 md:text-slate-700 truncate">
                    {attachment.file.name}
                  </div>
                  {attachment.uploading && (
                    <div className="text-[10px] text-slate-500 flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Uploading…
                    </div>
                  )}
                  {attachment.error && (
                    <div className="text-[10px] text-red-400 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> {attachment.error}
                    </div>
                  )}
                </div>
                <button
                  onClick={clearAttachment}
                  aria-label="Remove attachment"
                  className="p-1 rounded text-slate-400 hover:text-white md:hover:text-slate-900"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {error && (
              <div className="mb-2 text-[11px] text-red-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> {error}
              </div>
            )}

            <div className="flex items-end gap-2">
              <input
                id={`profile-chat-attachment-${recipient.userId}`}
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf,.zip,.txt,.doc,.docx"
                className="hidden"
                onChange={(e) => void onPickFile(e.target.files?.[0])}
              />
              <label
                htmlFor={`profile-chat-attachment-${recipient.userId}`}
                aria-label="Attach a file"
                aria-disabled={sending || !!attachment}
                className={`shrink-0 cursor-pointer p-2.5 rounded-[10px] text-slate-400 hover:text-white md:hover:text-slate-900 hover:bg-white/5 md:hover:bg-slate-100 ${sending || attachment ? "pointer-events-none opacity-40" : ""}`}
              >
                <Paperclip className="w-4 h-4" />
              </label>
              <textarea
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  if (error) setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                rows={1}
                placeholder="Type a message…"
                aria-label="Message body"
                className="flex-1 resize-none max-h-28 min-h-[40px] bg-[#1E1E24] md:bg-slate-100 border border-white/10 md:border-transparent rounded-[10px] px-3 py-3 text-sm text-slate-200 md:text-slate-800 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
              <button
                onClick={() => void send()}
                disabled={!canSend}
                aria-label="Send message"
                className="shrink-0 inline-flex items-center justify-center gap-1.5 rounded-[10px] bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 disabled:cursor-not-allowed text-black disabled:text-slate-400 font-bold text-sm px-3.5 py-2.5"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
            <div
              className={`mt-1 text-right text-[10px] ${bodyTooLong ? "text-red-400" : "text-slate-500"}`}
            >
              {draft.length}/{MAX_BODY}
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
