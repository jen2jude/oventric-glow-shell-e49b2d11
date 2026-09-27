import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Drawer as VaulDrawer } from "vaul";
import { motion, useReducedMotion } from "motion/react";
import { Sparkles, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getCreatorCoachHistory } from "@/lib/dashboard/coach.functions";
import { getMyFullProfile } from "@/lib/profiles.functions";
import { useAuthGate } from "@/lib/auth-gate/AuthGateProvider";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputBody, PromptInputTextarea, PromptInputFooter, PromptInputSubmit } from "@/components/ai-elements/prompt-input";
import { coachPageKey, pickCoachPrompt, type CoachPrompt } from "@/lib/coach-page-prompts";
import { playNotificationSound } from "@/lib/notification-sound";

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

export function CreatorCoachChat({ starter }: { starter?: string | null } = {}) {
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

  // Tapping a page nudge starts the conversation once history is ready.
  const starterSent = useRef(false);
  useEffect(() => {
    if (!starter || starterSent.current || !transport || historyQuery.isLoading) return;
    if (historyQuery.data && !historyLoaded.current) return;
    starterSent.current = true;
    sendMessage({ text: starter });
  }, [starter, transport, historyQuery.isLoading, historyQuery.data, sendMessage]);

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

export function CreatorCoachDrawer({ open, onClose, starter }: { open: boolean; onClose: () => void; starter?: string | null }) {
  return (
    <VaulDrawer.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <VaulDrawer.Portal>
        <VaulDrawer.Overlay className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-md" />
        <VaulDrawer.Content className="fixed inset-x-0 bottom-0 z-[91] flex h-[92dvh] flex-col rounded-t-3xl border-t border-white/10 bg-[#070A08] outline-none">
          <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-white/20" />
          <div className="flex shrink-0 items-center gap-2.5 border-b border-white/10 px-4 py-3">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-[#E5484D]">
              <Sparkles className="h-4 w-4 text-white" />
            </span>
            <div className="flex-1">
              <p className="text-sm font-bold text-white">Oventric Coach</p>
              <p className="text-[11px] text-white/45">Knows your real numbers</p>
            </div>
            <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-white/5 text-white/60">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1">{open && <CreatorCoachChat starter={starter} />}</div>
        </VaulDrawer.Content>
      </VaulDrawer.Portal>
    </VaulDrawer.Root>
  );
}

/** Floating coach button, available anywhere in the app for every signed-in user. */
export function CreatorCoachLauncher({ section = "Home" }: { section?: string }) {
  const loadProfile = useServerFn(getMyFullProfile);
  const { isAuthenticated } = useAuthGate();
  const { data: prof, refetch } = useQuery({
    queryKey: ["app-account-profile"],
    queryFn: () => loadProfile(),
    enabled: isAuthenticated,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
  const [open, setOpen] = useState(false);
  const [greeting, setGreeting] = useState<"welcome" | "hourly" | null>(null);
  const [nudge, setNudge] = useState<CoachPrompt | null>(null);
  const [starter, setStarter] = useState<string | null>(null);
  const [feedTab, setFeedTab] = useState<string | null>(null);
  const reducedMotion = useReducedMotion();
  const user = prof?.profile;
  const name = user?.displayName?.trim().split(/\s+/)[0] || "there";

  useEffect(() => {
    setFeedTab((window as unknown as { __oventricFeedTab?: string }).__oventricFeedTab ?? null);
    const onTab = (e: Event) => setFeedTab((e as CustomEvent<string | null>).detail ?? null);
    window.addEventListener("oventric:feed-tab", onTab);
    return () => window.removeEventListener("oventric:feed-tab", onTab);
  }, []);

  useEffect(() => {
    const onComplete = () => { void refetch(); };
    window.addEventListener("oventric:creator-onboarded", onComplete);
    return () => window.removeEventListener("oventric:creator-onboarded", onComplete);
  }, [refetch]);

  useEffect(() => {
    if (!user?.isCreator) { setGreeting(null); return; }
    const chooseGreeting = () => {
      if (document.visibilityState !== "visible" || open) return;
      if (document.querySelector('[data-oventric-boot="react"], [aria-label="Cashback offer: the more you shop, the less you pay"]')) return;
      const pendingKey = `oventric:coach-welcome-pending:${user.userId}`;
      const welcomedKey = `oventric:coach-welcomed:v2:${user.userId}`;
      const hourKey = `oventric:coach-hour:${user.userId}`;
      const now = new Date();
      const currentHour = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}`;
      try {
        if (window.sessionStorage.getItem(pendingKey) === "waiting") return;
        if (window.sessionStorage.getItem(pendingKey) === "ready") {
          window.sessionStorage.removeItem(pendingKey);
          window.localStorage.setItem(welcomedKey, "1");
          window.localStorage.setItem(hourKey, currentHour);
          setGreeting("welcome");
        } else if (window.localStorage.getItem(welcomedKey) !== "1") {
          window.localStorage.setItem(welcomedKey, "1");
          window.localStorage.setItem(hourKey, currentHour);
          setGreeting("welcome");
        }
      } catch {
        // Storage may be disabled; the button still opens the coach.
      }
    };
    chooseGreeting();
    document.addEventListener("visibilitychange", chooseGreeting);
    window.addEventListener("oventric:creator-welcome-ready", chooseGreeting);
    const interval = window.setInterval(chooseGreeting, 1_000);
    return () => {
      document.removeEventListener("visibilitychange", chooseGreeting);
      window.removeEventListener("oventric:creator-welcome-ready", chooseGreeting);
      window.clearInterval(interval);
    };
  }, [user?.userId, user?.isCreator, open]);

  // Page-aware nudge: after 5s on a page, once per page per session.
  const pageKey = coachPageKey(section, feedTab);
  useEffect(() => {
    setNudge(null);
    if (!user?.userId || open) return;
    const seenKey = `oventric:coach-page-seen:${user.userId}:${pageKey}`;
    try { if (window.sessionStorage.getItem(seenKey)) return; } catch { /* ignore */ }
    let timer = window.setTimeout(function tryShow() {
      const blocked =
        document.visibilityState !== "visible" ||
        document.querySelector('[data-oventric-boot="react"], [aria-label="Cashback offer: the more you shop, the less you pay"], [role="dialog"], [vaul-drawer]');
      if (blocked) { timer = window.setTimeout(tryShow, 2_000); return; }
      try { window.sessionStorage.setItem(seenKey, "1"); } catch { /* ignore */ }
      setGreeting(null);
      setNudge(pickCoachPrompt(pageKey, name));
      playNotificationSound("coach");
    }, 5_000);
    return () => window.clearTimeout(timer);
  }, [pageKey, user?.userId, open, name]);

  useEffect(() => {
    if (!greeting && !nudge) return;
    const timeout = window.setTimeout(() => { setGreeting(null); setNudge(null); }, 10_000);
    return () => window.clearTimeout(timeout);
  }, [greeting, nudge]);

  useEffect(() => {
    if (greeting) playNotificationSound("coach");
  }, [greeting]);

  if (!user) return null;
  const hour = new Date().getHours();
  const timeOfDay = hour >= 5 && hour < 12 ? "morning" : hour >= 12 && hour < 17 ? "afternoon" : hour >= 17 && hour < 21 ? "evening" : "night";
  const bubble = nudge || greeting;
  const openCoach = () => {
    setStarter(nudge?.reply ?? null);
    setGreeting(null);
    setNudge(null);
    setOpen(true);
  };
  return (
    <>
      {!open && (
        <motion.div
          initial={false}
          animate={{ width: bubble ? "min(320px, calc(100vw - 32px))" : 48, height: bubble ? (nudge ? 96 : 116) : 48, borderRadius: bubble ? 22 : 999 }}
          transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 210, damping: 24 }}
          className="fixed bottom-24 right-4 z-[70] overflow-hidden border border-newsfeed-violet/35 bg-card text-card-foreground shadow-xl shadow-newsfeed-violet/20"
        >
          {nudge ? (
            <motion.button
              type="button"
              onClick={openCoach}
              initial={reducedMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute inset-0 flex flex-col justify-center px-4 pr-14 text-left"
            >
              <span className="text-[13px] font-semibold leading-snug text-foreground">{nudge.ask}</span>
              <span className="mt-1 text-[11px] text-muted-foreground">Tap to chat with your Coach</span>
            </motion.button>
          ) : greeting ? (
            <motion.div
              initial={reducedMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="pointer-events-none absolute inset-0 flex flex-col justify-center px-4 pr-14"
            >
              <span className="text-[13px] font-bold leading-tight text-foreground">
                {greeting === "welcome" ? `Hi ${name}, welcome to your Creator Hub!` : `Good ${timeOfDay}, ${name}.`}
              </span>
              <span className="mt-1 text-[11px] leading-snug text-muted-foreground">
                I’m your Coach. I’m here to help you make the most of your work.
              </span>
            </motion.div>
          ) : null}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open Oventric Coach"
            title="Open Oventric Coach"
            onClick={openCoach}
            className="absolute bottom-0 right-0 h-12 w-12 rounded-full bg-gradient-to-br from-newsfeed-violet to-newsfeed-coral text-primary-foreground hover:opacity-90"
          >
            <Sparkles className="h-5 w-5" />
          </Button>
        </motion.div>
      )}
      <CreatorCoachDrawer open={open} starter={starter} onClose={() => { setOpen(false); setStarter(null); }} />
    </>
  );
}
