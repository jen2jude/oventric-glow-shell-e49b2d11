import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Ban,
  Bug,
  Check,
  ClipboardList,
  FileSearch,
  Headset,
  HelpCircle,
  MailCheck,
  MessageCircleMore,
  PackageSearch,
  Send,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { PublicChrome } from "@/components/oventric/PublicChrome";
import { Button } from "@/components/ui/button";
import { submitReport } from "@/lib/reports.functions";
import { useAuthGate } from "@/lib/auth-gate/AuthGateProvider";
import { useIsAppShell } from "@/hooks/use-launch-context";
import helpImage from "@/assets/public-pages/help-editorial.jpg";

export const Route = createFileRoute("/report-problem")({
  head: () => ({
    meta: [
      { title: "Report a Problem — Oventric" },
      {
        name: "description",
        content:
          "Report a technical issue, unsafe behavior, infringement or payment concern on Oventric and our team will review it.",
      },
      { property: "og:title", content: "Report a Problem — Oventric" },
      {
        property: "og:description",
        content: "Tell us what went wrong so the Oventric team can review it and follow up.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://oventric.com/report-problem" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://oventric.com/report-problem" }],
  }),
  component: ReportPage,
});

type Reason = "spam" | "harassment" | "ip" | "scam";

const issues: Array<{
  key: Reason;
  icon: typeof Bug;
  title: string;
  body: string;
  tone: string;
  active: string;
}> = [
  {
    key: "spam",
    icon: AlertTriangle,
    title: "Spam or misleading content",
    body: "Fake listings, misleading claims or repeated unwanted content.",
    tone: "bg-newsfeed-gold-soft text-newsfeed-gold",
    active: "border-2 border-newsfeed-gold bg-newsfeed-gold-soft/60",
  },
  {
    key: "harassment",
    icon: ShieldAlert,
    title: "Harassment or unsafe behavior",
    body: "Abuse, hate, threats or behavior that makes someone unsafe.",
    tone: "bg-newsfeed-coral-soft text-newsfeed-coral",
    active: "border-2 border-newsfeed-coral bg-newsfeed-coral-soft/60",
  },
  {
    key: "ip",
    icon: Ban,
    title: "Copyright or IP infringement",
    body: "Content or products that copy work you own the rights to.",
    tone: "bg-newsfeed-violet-soft text-newsfeed-violet",
    active: "border-2 border-newsfeed-violet bg-newsfeed-violet-soft/60",
  },
  {
    key: "scam",
    icon: Bug,
    title: "Fraud, scam or payment issue",
    body: "Suspicious payments, non-delivery or anything that feels like a scam.",
    tone: "bg-newsfeed-blue-soft text-newsfeed-blue",
    active: "border-2 border-newsfeed-blue bg-newsfeed-blue-soft/60",
  },
];

const steps = [
  {
    title: "You describe what happened",
    body: "Pick the closest category and tell us what you saw, what you expected and what happened instead.",
  },
  {
    title: "The team reviews the record",
    body: "Reports are reviewed by people, with the order, chat or listing record attached where relevant.",
  },
  {
    title: "We follow up with you",
    body: "You are signed in when you report, so the team can reach you with the outcome or questions.",
  },
];

const includePoints = [
  "What you were doing when the problem happened.",
  "What you expected to happen, and what happened instead.",
  "The order, product or profile involved, if there is one.",
  "Screenshots or message details, when you have them.",
];

function ReportPage() {
  const submit = useServerFn(submitReport);
  const { isAuthenticated, openGate } = useAuthGate();
  const isAppShell = useIsAppShell();
  const [reason, setReason] = useState<Reason>("scam");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);

  const onSubmit = async () => {
    if (!isAuthenticated) {
      openGate("generic");
      return;
    }
    if (note.trim().length < 8) {
      toast.error("Please describe the issue in a bit more detail.");
      return;
    }
    setSending(true);
    try {
      await submit({ data: { targetId: "platform-report", targetKind: "platform", reason, note } });
      toast.success("Report received — thank you.");
      setNote("");
    } catch (e) {
      console.error(e);
      toast.error("Could not send. Please try again.");
    } finally {
      setSending(false);
    }
  };

  if (isAppShell) {
    return <AppReportPage reason={reason} setReason={setReason} note={note} setNote={setNote} sending={sending} onSubmit={onSubmit} />;
  }

  return (
    <PublicChrome lightDesktop>
      <div className="help-editorial bg-newsfeed-canvas text-newsfeed-ink">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-newsfeed-line bg-newsfeed-surface">
          <div className="mx-auto grid min-h-[540px] max-w-7xl lg:grid-cols-[1.02fr_0.98fr]">
            <div className="flex flex-col justify-center px-5 py-16 sm:px-8 lg:px-10 lg:py-24">
              <div className="mb-7 h-1 w-36 rounded-full about-spectrum" aria-hidden="true" />
              <p className="font-wallet-display text-sm font-bold text-newsfeed-coral">
                REPORT A PROBLEM
              </p>
              <h1 className="mt-4 max-w-2xl font-wallet-display text-3xl font-extrabold leading-[1.08] sm:text-4xl lg:text-6xl">
                Something wrong? Tell us and we will look into it.
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-newsfeed-muted sm:text-lg sm:leading-8">
                Report a technical issue, unsafe behavior, infringement or a payment concern.
                Every report is reviewed by a person and followed up on your account.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link to="/help">
                    Visit the Help center <ArrowRight />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-newsfeed-line bg-newsfeed-surface text-newsfeed-ink hover:bg-newsfeed-blue-soft hover:text-newsfeed-blue"
                >
                  <Link to="/faq">
                    <HelpCircle /> Browse FAQs
                  </Link>
                </Button>
              </div>
              <div className="mt-7 flex items-start gap-3 text-sm leading-6 text-newsfeed-muted">
                <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-newsfeed-green-soft text-newsfeed-green">
                  <ShieldCheck className="size-4" />
                </span>
                <span>
                  Reporting an order? Open the order page and use “Report a problem” there so the
                  full order record is attached automatically.
                </span>
              </div>
            </div>
            <div className="relative min-h-[350px] overflow-hidden lg:min-h-full">
              <img
                src={helpImage}
                alt="Support headset beside a guide and safety shield representing Oventric's review team"
                width={1200}
                height={900}
                fetchPriority="high"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="help-image-shade absolute inset-0" aria-hidden="true" />
              <div className="absolute bottom-5 left-5 right-5 rounded-[10px] border border-newsfeed-surface/70 bg-newsfeed-surface/90 p-4 shadow-newsfeed-panel backdrop-blur-sm sm:bottom-8 sm:left-8 sm:right-auto sm:max-w-xs">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-newsfeed-violet-soft text-newsfeed-violet">
                    <FileSearch className="size-5" />
                  </span>
                  <div>
                    <p className="font-wallet-display text-sm font-bold">Reviewed by people</p>
                    <p className="mt-1 text-xs leading-5 text-newsfeed-muted">
                      Every report is read and investigated by the Oventric team.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="about-spectrum h-1 w-full" aria-hidden="true" />

        <div className="mx-auto max-w-5xl px-5 py-12 sm:px-8 sm:py-16 space-y-16">
          {/* What happens next */}
          <section>
            <p className="font-wallet-display text-sm font-bold text-newsfeed-green">
              WHAT HAPPENS NEXT
            </p>
            <h2 className="mt-4 font-wallet-display text-2xl font-bold leading-tight sm:text-3xl lg:text-4xl">
              Three steps after you press send
            </h2>
            <ol className="mt-8 grid gap-4 sm:grid-cols-3">
              {steps.map((step, index) => (
                <li
                  key={step.title}
                  className="rounded-[10px] border border-newsfeed-line bg-newsfeed-surface p-5 shadow-sm"
                >
                  <span className="grid size-9 place-items-center rounded-full bg-newsfeed-green-soft font-wallet-display text-sm font-bold text-newsfeed-green">
                    {index + 1}
                  </span>
                  <h3 className="mt-3 font-wallet-display text-base font-bold">{step.title}</h3>
                  <p className="mt-1.5 text-sm leading-6 text-newsfeed-muted">{step.body}</p>
                </li>
              ))}
            </ol>
          </section>

          {/* Report form */}
          <section className="rounded-[10px] border border-newsfeed-line bg-newsfeed-surface p-6 shadow-sm sm:p-8">
            <p className="font-wallet-display text-sm font-bold text-newsfeed-violet">
              SEND A REPORT
            </p>
            <h2 className="mt-3 font-wallet-display text-2xl font-bold leading-tight sm:text-3xl">
              What are you reporting?
            </h2>
            <p className="mt-2 text-sm leading-6 text-newsfeed-muted">
              Choose the closest category, then describe the issue in your own words.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {issues.map((it) => {
                const active = reason === it.key;
                return (
                  <button
                    type="button"
                    key={it.key}
                    onClick={() => setReason(it.key)}
                    aria-pressed={active}
                    className={`flex items-start gap-3 rounded-[10px] border p-4 text-left transition-colors ${
                      active
                        ? it.active
                        : "border-newsfeed-line bg-newsfeed-surface hover:bg-newsfeed-canvas"
                    }`}
                  >
                    <span
                      className={`grid size-10 shrink-0 place-items-center rounded-[10px] ${it.tone}`}
                    >
                      <it.icon className="size-4.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 font-wallet-display text-sm font-bold">
                        {it.title}
                        {active && <Check className="size-4" />}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-newsfeed-muted">
                        {it.body}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            <label
              htmlFor="report-note"
              className="mt-8 block font-wallet-display text-sm font-bold"
            >
              What happened?
            </label>
            <textarea
              id="report-note"
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 280))}
              placeholder="Please describe the issue — what you were doing, what you expected, what happened instead."
              rows={5}
              className="mt-2 w-full rounded-[10px] border border-newsfeed-line bg-newsfeed-canvas p-4 text-sm text-newsfeed-ink outline-none transition-shadow placeholder:text-newsfeed-muted focus:border-newsfeed-violet focus:ring-2 focus:ring-newsfeed-violet/20"
            />
            <div className="mt-1 text-right text-xs text-newsfeed-muted">{note.length} / 280</div>

            <Button onClick={onSubmit} disabled={sending} className="mt-5 h-11 w-full sm:w-auto">
              <Send />
              {sending ? "Sending..." : "Send report"}
            </Button>
            <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-newsfeed-muted">
              <MailCheck className="mt-0.5 size-3.5 shrink-0" />
              You will need to sign in before submitting so we can securely follow up with you.
            </p>
          </section>

          {/* What to include */}
          <section className="grid gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
            <div>
              <p className="font-wallet-display text-sm font-bold text-newsfeed-blue">
                MAKE IT EASY TO HELP
              </p>
              <h2 className="mt-4 font-wallet-display text-2xl font-bold leading-tight sm:text-3xl lg:text-4xl">
                What a useful report includes
              </h2>
              <p className="mt-4 text-sm leading-7 text-newsfeed-muted">
                The more precise the detail, the faster the team can find the record, reproduce
                the problem and resolve it.
              </p>
            </div>
            <ul className="space-y-3">
              {includePoints.map((point) => (
                <li
                  key={point}
                  className="flex items-start gap-3 rounded-[10px] border border-newsfeed-line bg-newsfeed-surface p-4"
                >
                  <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-newsfeed-blue-soft text-newsfeed-blue">
                    <Check className="size-3.5" />
                  </span>
                  <span className="text-sm leading-6">{point}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Order note */}
          <section className="flex items-start gap-4 rounded-[10px] border border-newsfeed-line bg-newsfeed-gold-soft/50 p-5 sm:p-6">
            <span className="grid size-11 shrink-0 place-items-center rounded-[10px] bg-newsfeed-surface text-newsfeed-gold">
              <PackageSearch className="size-5" />
            </span>
            <div>
              <h3 className="font-wallet-display text-base font-bold">
                Problem with a specific order?
              </h3>
              <p className="mt-1.5 text-sm leading-6 text-newsfeed-muted">
                Message the seller from the order page first — most delivery issues are resolved
                in the order chat. If it is not resolved within 24 hours, use “Report a problem”
                on that order so the dispute team sees the full record.
              </p>
            </div>
          </section>

          {/* CTA */}
          <section className="help-cta overflow-hidden rounded-[10px] border border-newsfeed-line p-7 sm:p-10">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 text-newsfeed-coral">
                <Headset className="size-4" />
                <p className="font-wallet-display text-xs font-bold uppercase tracking-widest">
                  NOT SURE WHERE IT FITS?
                </p>
              </div>
              <h2 className="mt-3 font-wallet-display text-2xl font-bold sm:text-3xl">
                The Help center covers the everyday questions.
              </h2>
              <p className="mt-3 text-sm leading-6 text-newsfeed-muted sm:text-base">
                Guides, answers and the fastest paths to support — before you ever need to send a
                report.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link to="/help">
                    Visit the Help center <ArrowRight />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-newsfeed-line bg-newsfeed-surface text-newsfeed-ink hover:bg-newsfeed-blue-soft hover:text-newsfeed-blue"
                >
                  <Link to="/faq">
                    <MessageCircleMore /> Browse FAQs
                  </Link>
                </Button>
              </div>
              <p className="mt-5 flex items-center gap-2 text-xs text-newsfeed-muted">
                <ClipboardList className="size-3.5" /> Support will never ask for your password,
                PIN or one-time codes.
              </p>
            </div>
          </section>
        </div>
      </div>
    </PublicChrome>
  );
}

function AppReportPage({ reason, setReason, note, setNote, sending, onSubmit }: {
  reason: Reason;
  setReason: (reason: Reason) => void;
  note: string;
  setNote: (note: string) => void;
  sending: boolean;
  onSubmit: () => Promise<void>;
}) {
  const navigate = useNavigate();
  const back = () => {
    if (window.history.length > 1) window.history.back();
    else navigate({ to: "/" });
  };

  return (
    <div className="app-connections fixed inset-0 flex h-[100dvh] flex-col overflow-hidden bg-background text-foreground">
      <header className="app-shell-header z-40 flex h-[calc(3.5rem+env(safe-area-inset-top))] shrink-0 items-center gap-3 border-b border-border bg-background px-4 pt-[env(safe-area-inset-top)]">
        <Button variant="ghost" size="icon" onClick={back} aria-label="Back" className="size-10 shrink-0 text-foreground hover:bg-muted hover:text-foreground"><ArrowLeft className="size-5" /></Button>
        <span className="font-wallet-display text-base font-bold">Report a problem</span>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-8 [scrollbar-width:none]">
        <div className="mx-auto max-w-2xl font-wallet-body">
          <div className="border-b border-border pb-7">
            <span className="inline-flex size-12 items-center justify-center rounded-[10px] bg-primary/15 text-primary"><ShieldAlert className="size-6" /></span>
            <h1 className="mt-5 font-wallet-display text-3xl font-bold leading-tight">Tell us what happened.</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">Report a technical issue, unsafe behavior, infringement or a payment concern. Our team will review it and follow up with you.</p>
          </div>

          <section className="py-7" aria-labelledby="app-report-category">
            <h2 id="app-report-category" className="font-wallet-display text-lg font-bold">What are you reporting?</h2>
            <div className="mt-4 space-y-2">
              {issues.map((issue) => (
                <Button key={issue.key} type="button" variant="outline" onClick={() => setReason(issue.key)} aria-pressed={reason === issue.key}
                  className={`h-auto min-h-16 w-full justify-start gap-3 whitespace-normal rounded-[10px] px-4 py-3 text-left ${reason === issue.key ? "border-primary bg-primary/10 text-foreground" : "border-border bg-card text-foreground hover:bg-muted hover:text-foreground"}`}>
                  <issue.icon className={`size-5 shrink-0 ${reason === issue.key ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{issue.title}</span><span className="mt-0.5 block text-xs font-normal leading-5 text-muted-foreground">{issue.body}</span></span>
                  {reason === issue.key && <Check className="size-4 shrink-0 text-primary" />}
                </Button>
              ))}
            </div>
          </section>

          <section className="border-t border-border pt-7" aria-labelledby="app-report-description">
            <h2 id="app-report-description" className="font-wallet-display text-lg font-bold">What happened?</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Include the product, order or profile involved if there is one.</p>
            <label htmlFor="app-report-note" className="sr-only">Describe the issue</label>
            <textarea id="app-report-note" value={note} onChange={(event) => setNote(event.target.value.slice(0, 280))}
              placeholder="What were you doing, and what happened instead?" rows={5} maxLength={280}
              className="mt-4 w-full resize-none rounded-[10px] border border-border bg-card p-4 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20" />
            <p className="mt-1 text-right text-xs text-muted-foreground">{note.length} / 280</p>
            <Button onClick={onSubmit} disabled={sending} className="mt-5 h-11 w-full gap-2 rounded-[10px]"><Send className="size-4" />{sending ? "Sending..." : "Send report"}</Button>
            <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-muted-foreground"><MailCheck className="mt-0.5 size-4 shrink-0" />You will need to sign in before submitting so we can follow up securely.</p>
          </section>

          <div className="mt-7 border-t border-border pt-6 text-sm leading-6 text-muted-foreground">
            <p>For an order issue, use “Report a problem” on the order page to attach its record automatically.</p>
            <p className="mt-3">Never include your password, PIN or one-time codes.</p>
            <Button asChild variant="link" className="mt-3 h-auto p-0 text-primary"><Link to="/help">Visit the Help center <ArrowRight className="size-4" /></Link></Button>
          </div>
        </div>
      </main>
    </div>
  );
}
