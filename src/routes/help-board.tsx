import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Receipt,
  MessageSquareWarning,
  ShoppingBag,
  Wallet,
  ShieldAlert,
  ChevronDown,
  Star,
  MessageCircle,
  Check,
  X,
  ArrowRight,
  BadgeHelp,
  Clock3,
  HeartHandshake,
  LifeBuoy,
} from "lucide-react";
import { PublicChrome } from "@/components/oventric/PublicChrome";
import { SupportLiveChat } from "@/components/oventric/SupportLiveChat";
import { Button } from "@/components/ui/button";
import { submitSupportTicket, submitSupportFeedback } from "@/lib/support.functions";
import { useAuthGate } from "@/lib/auth-gate/AuthGateProvider";
import supportHeadset from "@/assets/support-headset.png.asset.json";

export const Route = createFileRoute("/help-board")({
  head: () => ({
    meta: [
      { title: "Oventric Help Board — 24/7 support" },
      {
        name: "description",
        content:
          "Open a dispute, share feedback, browse FAQs or start a live chat with the Oventric support team, any time of day.",
      },
      { property: "og:title", content: "Oventric Help Board" },
      {
        property: "og:description",
        content: "24/7 support: disputes, feedback, FAQs and live chat with our team.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: "https://oventric.com/help-board" },
    ],
    links: [{ rel: "canonical", href: "https://oventric.com/help-board" }],
  }),
  component: HelpBoardPage,
});

const DISPUTES = [
  {
    key: "transaction",
    label: "Transaction dispute",
    icon: Receipt,
    tint: "bg-help-teal-soft text-help-teal",
    copy: "Payment, receipt or settlement issue",
  },
  {
    key: "social_post",
    label: "Social post dispute",
    icon: MessageSquareWarning,
    tint: "bg-help-violet-soft text-help-ink",
    copy: "Report content or account activity",
  },
  {
    key: "marketplace",
    label: "Marketplace dispute",
    icon: ShoppingBag,
    tint: "bg-help-crimson-soft text-help-crimson",
    copy: "Product, delivery or seller concern",
  },
  { key: "wallet", label: "Wallet dispute", icon: Wallet, tint: "bg-help-gold-soft text-help-ink", copy: "Balance, funding or withdrawal issue" },
  { key: "scam", label: "Report a scam", icon: ShieldAlert, tint: "bg-help-crimson-soft text-help-crimson", copy: "Flag suspicious activity quickly" },
] as const;

const FAQS = [
  {
    q: "How does escrow protect my purchase?",
    a: "Digital purchases are held in escrow. Funds release to the seller when you confirm delivery, or automatically 24 hours after delivery is marked if you take no action.",
  },
  {
    q: "When do I get my cashback?",
    a: "When a seller funds cashback on a listing (up to 50%), it is credited to your cashback wallet after the purchase settles. It can be spent on digital products.",
  },
  {
    q: "Why is my price shown in a different currency?",
    a: "Every listing is converted to your home currency using near-live FX rates, and you're charged in that currency.",
  },
  {
    q: "How long do payouts take?",
    a: "Automated payouts to supported banks and mobile money usually land within minutes. Manual USD payouts are reviewed by our team.",
  },
  {
    q: "Can I change my country or currency?",
    a: "Your wallet currency is tied to your country. Contact support through live chat if you have relocated.",
  },
];

function HelpBoardPage() {
  const { isAuthenticated, openGate } = useAuthGate();
  const ticketFn = useServerFn(submitSupportTicket);
  const feedbackFn = useServerFn(submitSupportFeedback);

  const [openDispute, setOpenDispute] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [details, setDetails] = useState("");
  const [ticketBusy, setTicketBusy] = useState(false);
  const [ticketDone, setTicketDone] = useState(false);

  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [feedbackDone, setFeedbackDone] = useState(false);

  const [faqOpen, setFaqOpen] = useState<number | null>(null);
  const [chatOpen, setChatOpen] = useState(false);

  const activeDispute = DISPUTES.find((d) => d.key === openDispute);

  const startDispute = (key: string) => {
    if (!isAuthenticated) {
      openGate("generic");
      return;
    }
    setOpenDispute(key);
    setTicketDone(false);
    setSubject("");
    setDetails("");
  };

  const sendTicket = async () => {
    if (!activeDispute || ticketBusy) return;
    if (subject.trim().length < 3 || details.trim().length < 5) return;
    setTicketBusy(true);
    try {
      await ticketFn({
        data: { category: activeDispute.key, subject: subject.trim(), details: details.trim() },
      });
      setTicketDone(true);
      setOpenDispute(null);
    } catch {
      /* keep form open */
    }
    setTicketBusy(false);
  };

  const sendFeedback = async () => {
    if (feedbackBusy || rating < 1 || feedbackText.trim().length < 3) return;
    if (!isAuthenticated) {
      openGate("generic");
      return;
    }
    setFeedbackBusy(true);
    try {
      await feedbackFn({ data: { rating, message: feedbackText.trim(), topic: "help_board" } });
      setFeedbackDone(true);
      setFeedbackText("");
      setRating(0);
    } catch {
      /* ignore */
    }
    setFeedbackBusy(false);
  };

  return (
    <PublicChrome lightDesktop>
      <div className="help-board-web min-h-full bg-help-canvas text-help-ink">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8 lg:py-14">
          <header className="relative overflow-hidden rounded-[10px] border border-help-line bg-help-surface shadow-help-card lg:grid lg:grid-cols-[minmax(0,1.35fr)_minmax(21rem,0.65fr)]">
            <div className="relative z-10 px-5 py-9 sm:px-9 sm:py-12 lg:px-12 lg:py-16">
              <div className="inline-flex items-center gap-2 rounded-full bg-help-teal-soft px-3 py-1.5 text-xs font-bold text-help-teal">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-help-teal opacity-60" />
                  <span className="relative inline-flex size-2 rounded-full bg-help-teal" />
                </span>
                Support is online · 24/7
              </div>
              <h1 className="mt-5 max-w-3xl text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
                Help is closer than you think.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-help-copy sm:text-lg">
                Get quick answers, open a case, or talk with the Oventric support team whenever you need us.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button onClick={() => setChatOpen(true)} className="h-11 rounded-[10px] bg-help-crimson px-5 text-primary-foreground hover:bg-help-crimson/90">
                  <MessageCircle /> Start live chat
                </Button>
                <Button asChild variant="outline" className="h-11 rounded-[10px] border-help-line bg-help-surface px-5 text-help-ink hover:bg-help-teal-soft">
                  <Link to="/help">Browse help center <ArrowRight /></Link>
                </Button>
              </div>
            </div>
            <div className="relative min-h-64 overflow-hidden bg-help-teal-soft lg:min-h-full">
              <div className="absolute inset-x-6 bottom-0 top-5 rounded-t-[10px] bg-help-surface/60" />
              <img loading="lazy" decoding="async" src={supportHeadset.url} alt="Oventric support headset" className="absolute inset-0 h-full w-full object-contain p-8 lg:p-10" />
              <div className="absolute bottom-5 left-5 right-5 flex items-center gap-3 rounded-[10px] border border-help-line bg-help-surface/90 p-3 shadow-help-card backdrop-blur-sm">
                <span className="grid size-10 place-items-center rounded-[10px] bg-help-teal text-primary-foreground"><HeartHandshake /></span>
                <div><p className="text-sm font-bold">Human support</p><p className="text-xs text-help-copy">Clear, practical help from our team</p></div>
              </div>
            </div>
          </header>

          <section className="mt-10" aria-labelledby="open-case-title">
            <div className="flex items-end justify-between gap-4">
              <div><p className="text-xs font-bold uppercase text-help-crimson">Resolve an issue</p><h2 id="open-case-title" className="mt-2 text-2xl font-bold sm:text-3xl">Open a support case</h2></div>
              <p className="hidden max-w-md text-right text-sm text-help-copy sm:block">Choose the closest match so your case reaches the right team faster.</p>
            </div>
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
              {DISPUTES.map((d, index) => (
                <Button key={d.key} variant="outline" onClick={() => startDispute(d.key)} className={`help-board-card h-auto min-h-44 items-start justify-start whitespace-normal rounded-[10px] border-help-line bg-help-surface p-5 text-left shadow-help-card hover:bg-help-surface ${index < 2 ? "lg:col-span-2" : index === 2 ? "lg:col-span-2" : "lg:col-span-3"}`}>
                  <span className="flex h-full w-full flex-col items-start">
                    <span className={`grid size-12 place-items-center rounded-[10px] ${d.tint}`}><d.icon className="size-5" /></span>
                    <span className="mt-5 block text-base font-bold text-help-ink">{d.label}</span>
                    <span className="mt-1 block text-sm font-normal leading-6 text-help-copy">{d.copy}</span>
                    <ArrowRight className="mt-auto size-4 text-help-crimson" />
                  </span>
                </Button>
              ))}
            </div>
            {ticketDone && <p className="mt-4 flex items-center gap-2 rounded-[10px] bg-help-teal-soft px-4 py-3 text-sm font-semibold text-help-teal"><Check className="size-4" /> Case submitted. Our team will follow up shortly.</p>}
          </section>

          <div className="mt-12 grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)]">
            <section className="rounded-[10px] border border-help-line bg-help-surface p-5 shadow-help-card sm:p-7" aria-labelledby="faq-title">
              <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-[10px] bg-help-teal-soft text-help-teal"><BadgeHelp /></span><div><p className="text-xs font-bold uppercase text-help-teal">Quick answers</p><h2 id="faq-title" className="text-2xl font-bold">Frequently asked</h2></div></div>
              <div className="mt-6 divide-y divide-help-line">
                {FAQS.map((f, i) => (
                  <div key={f.q}>
                    <Button variant="ghost" onClick={() => setFaqOpen(faqOpen === i ? null : i)} className="h-auto w-full justify-between whitespace-normal rounded-none px-0 py-5 text-left text-help-ink hover:bg-transparent" aria-expanded={faqOpen === i}>
                      <span className="pr-4 text-sm font-bold sm:text-base">{f.q}</span>
                      <ChevronDown className={`size-4 shrink-0 text-help-copy transition-transform ${faqOpen === i ? "rotate-180" : ""}`} />
                    </Button>
                    {faqOpen === i && <p className="max-w-2xl pb-5 pr-8 text-sm leading-7 text-help-copy">{f.a}</p>}
                  </div>
                ))}
              </div>
              <p className="mt-5 text-sm text-help-copy">More answers in the <Link to="/faq" className="font-bold text-help-crimson underline underline-offset-4">FAQ</Link> and <Link to="/help" className="font-bold text-help-crimson underline underline-offset-4">Help center</Link>.</p>
            </section>

            <div className="space-y-6">
              <section className="overflow-hidden rounded-[10px] bg-help-teal p-6 text-primary-foreground shadow-help-card">
                <div className="flex items-center justify-between"><span className="grid size-11 place-items-center rounded-[10px] bg-help-surface/15"><LifeBuoy /></span><span className="inline-flex items-center gap-1.5 text-xs font-bold"><span className="size-2 rounded-full bg-help-surface" />Online</span></div>
                <h2 className="mt-8 text-2xl font-bold">Need a real person?</h2>
                <p className="mt-2 text-sm leading-6 text-primary-foreground/80">Start a private conversation with Oventric support. Your chat history stays available when you return.</p>
                <Button onClick={() => setChatOpen(true)} className="mt-6 h-11 w-full rounded-[10px] bg-help-surface text-help-teal hover:bg-help-canvas"><MessageCircle /> Open live chat</Button>
                <div className="mt-5 flex items-center gap-2 border-t border-help-surface/20 pt-4 text-xs text-primary-foreground/75"><Clock3 className="size-4" /> Available around the clock</div>
              </section>

              <section className="rounded-[10px] border border-help-line bg-help-surface p-6 shadow-help-card">
                <Button variant="ghost" onClick={() => setFeedbackOpen((v) => !v)} className="h-auto w-full justify-start gap-3 p-0 text-left text-help-ink hover:bg-transparent" aria-expanded={feedbackOpen}>
                  <span className="grid size-10 place-items-center rounded-[10px] bg-help-gold-soft"><Star className="text-help-crimson" /></span>
                  <span><span className="block font-bold">Share feedback</span><span className="block text-xs font-normal text-help-copy">Rate a resolved issue</span></span>
                  <ChevronDown className={`ml-auto size-4 text-help-copy transition-transform ${feedbackOpen ? "rotate-180" : ""}`} />
                </Button>
                {feedbackOpen && (
                  <div className="mt-5 border-t border-help-line pt-5">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((n) => <Button key={n} variant="ghost" size="icon" onClick={() => setRating(n)} aria-label={`${n} star`} className="text-help-copy hover:bg-help-gold-soft"><Star className={n <= rating ? "fill-help-crimson text-help-crimson" : "text-help-copy"} /></Button>)}
                    </div>
                    <textarea value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)} rows={4} placeholder="Tell us about your experience…" className="mt-3 w-full resize-none rounded-[10px] border border-help-line bg-help-canvas px-3 py-2.5 text-sm text-help-ink outline-none placeholder:text-help-copy focus:border-help-teal" />
                    <Button onClick={() => void sendFeedback()} disabled={feedbackBusy || rating < 1 || feedbackText.trim().length < 3} className="mt-3 w-full rounded-[10px] bg-help-crimson text-primary-foreground hover:bg-help-crimson/90">{feedbackBusy ? "Sending…" : "Send feedback"}</Button>
                    {feedbackDone && <p className="mt-3 text-sm font-semibold text-help-teal">Thanks for the feedback!</p>}
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      </div>

      {/* Dispute form modal */}
      {activeDispute && (
        <div className="fixed inset-0 z-[65] flex items-end sm:items-center justify-center">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setOpenDispute(null)}
            aria-hidden
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={activeDispute.label}
            className="help-board-web relative w-full rounded-t-[10px] border border-help-line bg-help-surface p-5 text-help-ink shadow-help-card sm:max-w-md sm:rounded-[10px]"
          >
            <div className="flex items-center gap-3">
              <span
                className={`w-9 h-9 grid place-items-center rounded-full ${activeDispute.tint}`}
              >
                <activeDispute.icon className="w-4 h-4" />
              </span>
                <h3 className="font-bold text-help-ink">{activeDispute.label}</h3>
               <Button variant="ghost" size="icon"
                onClick={() => setOpenDispute(null)}
                aria-label="Close"
                className="ml-auto rounded-[10px] text-help-copy hover:bg-help-canvas"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject (e.g. order number or product name)"
              className="mt-4 w-full rounded-[10px] border border-help-line bg-help-canvas px-3 py-2.5 text-sm text-help-ink outline-none placeholder:text-help-copy focus:border-help-teal"
            />
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={5}
              placeholder="What happened? Add as much detail as you can."
              className="mt-2 w-full resize-none rounded-[10px] border border-help-line bg-help-canvas px-3 py-2.5 text-sm text-help-ink outline-none placeholder:text-help-copy focus:border-help-teal"
            />
            <Button
              onClick={() => void sendTicket()}
              disabled={ticketBusy || subject.trim().length < 3 || details.trim().length < 5}
              className="mt-3 h-11 w-full rounded-[10px] bg-help-crimson font-bold text-primary-foreground hover:bg-help-crimson/90"
            >
              {ticketBusy ? "Submitting…" : "Submit case"}
            </Button>
          </div>
        </div>
      )}

      <Button
        onClick={() => setChatOpen(true)}
        className="fixed bottom-24 right-3 z-50 h-12 rounded-full bg-help-crimson px-4 font-bold text-primary-foreground shadow-help-card hover:bg-help-crimson/90 md:bottom-8 md:right-6"
        aria-label="Open live chat with support"
      >
        <MessageCircle className="w-5 h-5" />
        Live Chat
      </Button>

      <SupportLiveChat open={chatOpen} onClose={() => setChatOpen(false)} />
    </PublicChrome>
  );
}
