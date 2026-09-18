import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Receipt,
  MessageSquareWarning,
  Target,
  ShoppingBag,
  Wallet,
  ShieldAlert,
  ChevronDown,
  Star,
  MessageCircle,
  Send,
  Check,
  X,
} from "lucide-react";
import { PublicChrome } from "@/components/oventric/PublicChrome";
import { SupportLiveChat } from "@/components/oventric/SupportLiveChat";
import { submitSupportTicket, submitSupportFeedback } from "@/lib/support.functions";
import { useAuthGate } from "@/lib/auth-gate/AuthGateProvider";

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
    tint: "text-sky-300 bg-sky-500/15",
  },
  {
    key: "social_post",
    label: "Social post dispute",
    icon: MessageSquareWarning,
    tint: "text-violet-300 bg-violet-500/15",
  },
  {
    key: "marketplace",
    label: "Marketplace dispute",
    icon: ShoppingBag,
    tint: "text-emerald-300 bg-emerald-500/15",
  },
  { key: "wallet", label: "Wallet dispute", icon: Wallet, tint: "text-cyan-300 bg-cyan-500/15" },
  { key: "scam", label: "Report a scam", icon: ShieldAlert, tint: "text-rose-300 bg-rose-500/15" },
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
    <PublicChrome>
      <div className="max-w-3xl mx-auto px-4 py-8 md:py-12 text-slate-200 md:text-slate-800">
        <header className="text-center">
          <h1 className="text-3xl md:text-4xl font-black text-white md:text-slate-900">
            Oventric Help Board
          </h1>
          <p className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-emerald-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            24/7 Service for you
          </p>
        </header>

        {/* Dispute grid */}
        <section className="mt-8">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400 md:text-slate-500">
            Open a case
          </h2>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {DISPUTES.map((d) => (
              <button
                key={d.key}
                onClick={() => startDispute(d.key)}
                className="p-3 rounded-2xl bg-[#141418] border border-white/10 text-left hover:border-emerald-500/40 transition-colors md:bg-white md:border-slate-200"
              >
                <span className={`w-9 h-9 grid place-items-center rounded-full ${d.tint}`}>
                  <d.icon className="w-4 h-4" />
                </span>
                <span className="mt-2 block text-sm font-semibold text-white leading-snug md:text-slate-900">
                  {d.label}
                </span>
              </button>
            ))}
          </div>
          {ticketDone && (
            <p className="mt-3 flex items-center gap-2 text-sm text-emerald-300">
              <Check className="w-4 h-4" /> Case submitted. Our team will follow up shortly.
            </p>
          )}
        </section>

        {/* Feedback */}
        <section className="mt-8">
          <button
            onClick={() => setFeedbackOpen((v) => !v)}
            className="w-full flex items-center gap-3 p-4 rounded-2xl bg-[#141418] border border-white/10 md:bg-white md:border-slate-200"
            aria-expanded={feedbackOpen}
          >
            <Star className="w-4 h-4 text-amber-300" />
            <span className="font-bold text-white md:text-slate-900">My Feedback</span>
            <ChevronDown
              className={`ml-auto w-4 h-4 text-slate-400 transition-transform ${feedbackOpen ? "rotate-180" : ""}`}
            />
          </button>
          {feedbackOpen && (
            <div className="mt-2 p-4 rounded-2xl bg-[#141418] border border-white/10 md:bg-white md:border-slate-200">
              <p className="text-sm text-slate-400 md:text-slate-500">
                Rate your experience with an issue we resolved.
              </p>
              <div className="mt-3 flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} onClick={() => setRating(n)} aria-label={`${n} star`}>
                    <Star
                      className={`w-6 h-6 ${n <= rating ? "text-amber-300 fill-amber-300" : "text-slate-600"}`}
                    />
                  </button>
                ))}
              </div>
              <textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                rows={4}
                placeholder="Tell us about your experience…"
                className="mt-3 w-full resize-none rounded-xl bg-[#1E1E24] border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-emerald-500/50 md:bg-white md:border-slate-200 md:text-slate-900"
              />
              <div className="mt-3 flex items-center gap-3">
                <button
                  onClick={() => void sendFeedback()}
                  disabled={feedbackBusy || rating < 1 || feedbackText.trim().length < 3}
                  className="px-4 py-2 rounded-full bg-emerald-500 text-black font-bold text-sm disabled:opacity-40"
                >
                  {feedbackBusy ? "Sending…" : "Send feedback"}
                </button>
                {feedbackDone && (
                  <span className="text-sm text-emerald-300">Thanks for the feedback!</span>
                )}
              </div>
            </div>
          )}
        </section>

        {/* FAQs */}
        <section className="mt-8">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400 md:text-slate-500">
            Relevant FAQs
          </h2>
          <div className="mt-3 grid gap-2">
            {FAQS.map((f, i) => (
              <div
                key={f.q}
                className="rounded-2xl bg-[#141418] border border-white/10 overflow-hidden md:bg-white md:border-slate-200"
              >
                <button
                  onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                  className="w-full flex items-center gap-3 p-4 text-left"
                  aria-expanded={faqOpen === i}
                >
                  <span className="text-sm font-semibold text-white md:text-slate-900">{f.q}</span>
                  <ChevronDown
                    className={`ml-auto w-4 h-4 shrink-0 text-slate-400 transition-transform ${faqOpen === i ? "rotate-180" : ""}`}
                  />
                </button>
                {faqOpen === i && (
                  <p className="px-4 pb-4 text-sm text-slate-300 leading-relaxed md:text-slate-600">
                    {f.a}
                  </p>
                )}
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-slate-400 md:text-slate-500">
            More answers in the{" "}
            <Link to="/faq" className="text-emerald-300 underline">
              FAQ
            </Link>{" "}
            and{" "}
            <Link to="/help" className="text-emerald-300 underline">
              Help center
            </Link>
            .
          </p>
        </section>
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
            className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-[#141418] border border-white/10 p-4 md:bg-white md:border-slate-200"
          >
            <div className="flex items-center gap-3">
              <span
                className={`w-9 h-9 grid place-items-center rounded-full ${activeDispute.tint}`}
              >
                <activeDispute.icon className="w-4 h-4" />
              </span>
              <h3 className="font-bold text-white md:text-slate-900">{activeDispute.label}</h3>
              <button
                onClick={() => setOpenDispute(null)}
                aria-label="Close"
                className="ml-auto p-2 rounded-[10px] text-slate-300 hover:bg-white/5 md:text-slate-600 md:hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject (e.g. order number or product name)"
              className="mt-4 w-full rounded-xl bg-[#1E1E24] border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-emerald-500/50 md:bg-white md:border-slate-200 md:text-slate-900"
            />
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={5}
              placeholder="What happened? Add as much detail as you can."
              className="mt-2 w-full resize-none rounded-xl bg-[#1E1E24] border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-emerald-500/50 md:bg-white md:border-slate-200 md:text-slate-900"
            />
            <button
              onClick={() => void sendTicket()}
              disabled={ticketBusy || subject.trim().length < 3 || details.trim().length < 5}
              className="mt-3 w-full py-3 rounded-full bg-emerald-500 text-black font-bold text-sm disabled:opacity-40"
            >
              {ticketBusy ? "Submitting…" : "Submit case"}
            </button>
          </div>
        </div>
      )}

      {/* Live chat side button */}
      <button
        onClick={() => setChatOpen(true)}
        className="fixed right-3 bottom-24 md:bottom-8 z-50 inline-flex items-center gap-2 pl-3 pr-4 py-3 rounded-full bg-emerald-500 text-black font-bold text-sm shadow-lg shadow-emerald-500/25 active:scale-95 transition-transform"
        aria-label="Open live chat with support"
      >
        <MessageCircle className="w-5 h-5" />
        Live Chat
      </button>

      <SupportLiveChat open={chatOpen} onClose={() => setChatOpen(false)} />
    </PublicChrome>
  );
}
