import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Drawer as VaulDrawer } from "vaul";
import { Sparkles, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getCreatorCoachHistory } from "@/lib/dashboard/coach.functions";
import { getMyFullProfile } from "@/lib/profiles.functions";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputBody, PromptInputTextarea, PromptInputFooter, PromptInputSubmit } from "@/components/ai-elements/prompt-input";

const SUGGESTIONS = [
  "How did I do this week?",
  "What should I post next?",
  "When is the best time for me to post?",
  "Help me price my next product",
  "Write a caption for my new post",
];

function useAccessToken() {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (alive) setToken(data.session?.access_token ?? "");
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setToken(session?.access_token ?? "");
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  return token;
}

export function CreatorCoachChat() {
  const token = useAccessToken();
  const fetchHistory = useServerFn(getCreatorCoachHistory);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const transport = useMemo(
    () =>
      token
        ? new DefaultChatTransport({
            api: "/api/creator-coach",
            headers: { Authorization: `Bearer ${token}` },
          })
        : undefined,
    [token],
  );

  const { messages, setMessages, sendMessage, status, stop, error } = useChat({
    transport,
    onError: (e) => console.error("[creator-coach]", e),
  });

  const historyQuery = useQuery({
    queryKey: ["creator-coach-history"],
    queryFn: () => fetchHistory(),
    enabled: !!token,
    staleTime: 60_000,
  });

  const historyLoaded = useRef(false);
  useEffect(() => {
    if (historyLoaded.current || !historyQuery.data) return;
    historyLoaded.current = true;
    const restored: UIMessage[] = historyQuery.data.map((m) => ({
      id: m.id,
      role: m.role,
      parts: [{ type: "text", text: m.content }],
    }));
    if (restored.length) setMessages(restored);
  }, [historyQuery.data, setMessages]);

  const busy = status === "submitted" || status === "streaming";

  // Keep the composer focused during normal chat use.
  useEffect(() => {
    if (!busy) textareaRef.current?.focus();
  }, [busy]);

  const send = (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    sendMessage({ text: t });
  };

  if (token === null) {
    return <div className="grid h-full place-items-center"><Loader2 className="h-5 w-5 animate-spin text-white/40" /></div>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#070A08]">
      <Conversation className="flex-1">
        <ConversationContent className="gap-4 px-4 py-4">
          {messages.length === 0 && !historyQuery.isLoading && (
            <div className="flex flex-col items-center gap-3 pt-10 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-[#E5484D]">
                <Sparkles className="h-7 w-7 text-white" />
              </span>
              <div>
                <p className="text-base font-bold text-white">Your Creator Coach</p>
                <p className="mt-1 max-w-[260px] text-xs text-white/50">
                  I know your real numbers — audience, posts, watch time, downloads and sales. Ask me anything.
                </p>
              </div>
              <div className="mt-2 flex w-full flex-col gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="rounded-[10px] border border-white/10 bg-white/5 px-3 py-2.5 text-left text-[13px] text-white/80 active:bg-white/10"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m) => {
            const text = m.parts.filter((p) => p.type === "text").map((p) => p.text).join("\n");
            if (!text) return null;
            return (
              <Message key={m.id} from={m.role}>
                {m.role === "user" ? (
                  <div className="ml-auto max-w-[85%] rounded-[22px] rounded-br-lg bg-gradient-to-br from-violet-500 to-[#E5484D] px-3.5 py-2 text-[13px] leading-relaxed text-white">
                    {text}
                  </div>
                ) : (
                  <MessageContent className="max-w-[92%] text-[13px] leading-relaxed text-white/90 [&_strong]:text-white">
                    <MessageResponse>{text}</MessageResponse>
                  </MessageContent>
                )}
              </Message>
            );
          })}
          {status === "submitted" && (
            <div className="flex items-center gap-2 text-xs text-white/50">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Coach is thinking…
            </div>
          )}
          {error && (
            <p className="rounded-[10px] border border-[#E5484D]/30 bg-[#E5484D]/10 px-3 py-2 text-xs text-[#E5484D]">
              Something went wrong — please try sending again.
            </p>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <PromptInput onSubmit={(msg) => send(msg.text)} className="border-t border-white/10 bg-[#070A08] px-3 pb-3 pt-2">
        <PromptInputBody>
          <PromptInputTextarea
            ref={textareaRef}
            placeholder="Ask your coach…"
            disabled={!token}
            className="min-h-[44px] text-[13px] text-white placeholder:text-white/35"
          />
        </PromptInputBody>
        <PromptInputFooter className="justify-end">
          <PromptInputSubmit
            status={status}
            onStop={stop}
            className="h-9 w-9 rounded-full bg-gradient-to-br from-violet-500 to-[#E5484D] text-white disabled:opacity-40"
          />
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
}

export function CreatorCoachDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <VaulDrawer.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <VaulDrawer.Portal>
        <VaulDrawer.Overlay className="fixed inset-0 z-[90] bg-black/60" />
        <VaulDrawer.Content className="fixed inset-x-0 bottom-0 z-[91] flex h-[92dvh] flex-col rounded-t-3xl border-t border-white/10 bg-[#070A08] outline-none">
          <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-white/20" />
          <div className="flex shrink-0 items-center gap-2.5 border-b border-white/10 px-4 py-3">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-[#E5484D]">
              <Sparkles className="h-4 w-4 text-white" />
            </span>
            <div className="flex-1">
              <p className="text-sm font-bold text-white">Creator Coach</p>
              <p className="text-[11px] text-white/45">Knows your real numbers</p>
            </div>
            <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-white/5 text-white/60">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1">{open && <CreatorCoachChat />}</div>
        </VaulDrawer.Content>
      </VaulDrawer.Portal>
    </VaulDrawer.Root>
  );
}

/** Floating coach button, available anywhere in the app for creators. */
export function CreatorCoachLauncher() {
  const loadProfile = useServerFn(getMyFullProfile);
  const { data: prof } = useQuery({
    queryKey: ["app-account-profile"],
    queryFn: () => loadProfile(),
    staleTime: 60_000,
  });
  const [open, setOpen] = useState(false);
  if (!prof?.profile?.isCreator) return null;
  return (
    <>
      {!open && (
        <button
          type="button"
          aria-label="Open Creator Coach"
          onClick={() => setOpen(true)}
          className="fixed bottom-24 right-4 z-[70] grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-[#E5484D] shadow-lg shadow-violet-500/30 active:scale-95"
        >
          <Sparkles className="h-5 w-5 text-white" />
        </button>
      )}
      <CreatorCoachDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}
