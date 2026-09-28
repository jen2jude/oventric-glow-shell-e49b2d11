import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Cookie,
  Database,
  Eye,
  FileKey,
  Fingerprint,
  Globe2,
  Headphones,
  KeyRound,
  LockKeyhole,
  MessageCircleMore,
  ReceiptText,
  ServerCog,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UserRoundCheck,
} from "lucide-react";
import { PublicChrome } from "@/components/oventric/PublicChrome";
import { Button } from "@/components/ui/button";
import { useIsAppShell } from "@/hooks/use-launch-context";
import legalImage from "@/assets/public-pages/legal-editorial.jpg";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — How Oventric protects your information" },
      {
        name: "description",
        content:
          "Understand what information Oventric collects, why it is used, when it is shared, how long it is kept, and the choices available to you.",
      },
      { property: "og:title", content: "Oventric Privacy Policy — Privacy explained clearly" },
      {
        property: "og:description",
        content:
          "A plain-language guide to information collection, account security, transaction records, retention, cookies and your privacy choices on Oventric.",
      },
      { property: "og:url", content: "https://oventric-glow-shell.lovable.app/privacy" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://oventric-glow-shell.lovable.app/privacy" }],
  }),
  component: PrivacyPage,
});

const privacyOverview = [
  {
    icon: Database,
    title: "We collect what Oventric needs",
    body: "Account, profile, marketplace, wallet and verification information supports the services you choose to use.",
    tone: "bg-newsfeed-blue-soft text-newsfeed-blue",
    border: "border-newsfeed-blue",
  },
  {
    icon: ShieldCheck,
    title: "We use it for clear purposes",
    body: "Information helps operate accounts, protect transactions, fulfil orders, prevent abuse and provide support.",
    tone: "bg-newsfeed-violet-soft text-newsfeed-violet",
    border: "border-newsfeed-violet",
  },
  {
    icon: Eye,
    title: "You control what is public",
    body: "Profile details, posts, showcases and listings you publish may be visible to people using Oventric.",
    tone: "bg-newsfeed-green-soft text-newsfeed-green",
    border: "border-newsfeed-green",
  },
  {
    icon: SlidersHorizontal,
    title: "You have privacy choices",
    body: "You can review and correct profile information, manage published content and request help with your data.",
    tone: "bg-newsfeed-gold-soft text-newsfeed-gold",
    border: "border-newsfeed-gold",
  },
];

const informationGroups = [
  {
    icon: UserRoundCheck,
    title: "Account and identity",
    body: "Your name, email address, phone number, country, profile details and sign-in information. When verification is required, Oventric also processes the details and documents you provide for that review.",
    tone: "bg-newsfeed-blue-soft text-newsfeed-blue",
  },
  {
    icon: MessageCircleMore,
    title: "Content and communication",
    body: "Posts, comments, creator showcases, media, links, product listings, reviews, reports and messages you choose to add. Public content can be seen by other people as indicated in the experience.",
    tone: "bg-newsfeed-violet-soft text-newsfeed-violet",
  },
  {
    icon: ReceiptText,
    title: "Orders and wallet activity",
    body: "Purchase, delivery, refund, cashback, settlement, wallet and payout records. These records help show what happened, protect buyers and sellers, and support financial reconciliation.",
    tone: "bg-newsfeed-green-soft text-newsfeed-green",
  },
  {
    icon: ServerCog,
    title: "Device and service activity",
    body: "Technical information such as session activity, browser or device details, security events and service interactions may be processed to keep Oventric reliable and prevent misuse.",
    tone: "bg-newsfeed-gold-soft text-newsfeed-gold",
  },
];

const useCases = [
  "Create and maintain your Oventric account and profile.",
  "Display products, creator work, community activity and professional links you publish.",
  "Process and record digital orders, delivery, refunds, wallet entries and payouts.",
  "Verify identity where needed and protect accounts, transactions and the wider community.",
  "Send service notices, order updates and support responses connected to your activity.",
  "Understand performance, diagnose problems and improve Oventric’s reliability and usability.",
  "Meet legal, accounting, fraud-prevention and dispute-resolution obligations.",
];

const rights = [
  {
    icon: Eye,
    title: "Access",
    body: "Review the personal information and activity available through your profile, orders and wallet.",
    tone: "bg-newsfeed-blue-soft text-newsfeed-blue",
  },
  {
    icon: SlidersHorizontal,
    title: "Correct",
    body: "Update inaccurate profile information through available account settings or ask support for help.",
    tone: "bg-newsfeed-violet-soft text-newsfeed-violet",
  },
  {
    icon: FileKey,
    title: "Request a copy",
    body: "Ask for a copy of personal information associated with your account where applicable.",
    tone: "bg-newsfeed-green-soft text-newsfeed-green",
  },
  {
    icon: Trash2,
    title: "Delete your account",
    body: "Start account deletion from Settings & Privacy, subject to the recovery period and required legal retention.",
    tone: "bg-newsfeed-coral-soft text-newsfeed-coral",
  },
];

function PrivacyPage() {
  const isAppShell = useIsAppShell();
  if (isAppShell) return <AppPrivacyPage />;

  return (
    <PublicChrome lightDesktop>
      <div className="help-editorial bg-newsfeed-canvas text-newsfeed-ink">
        <section className="relative overflow-hidden border-b border-newsfeed-line bg-newsfeed-surface">
          <div className="mx-auto grid min-h-[540px] max-w-7xl lg:grid-cols-[1.02fr_0.98fr]">
            <div className="flex flex-col justify-center px-5 py-16 sm:px-8 lg:px-10 lg:py-24">
              <div className="mb-7 h-1 w-36 rounded-full about-spectrum" aria-hidden="true" />
              <p className="font-wallet-display text-sm font-bold text-newsfeed-coral">PRIVACY & TRUST</p>
              <h1 className="mt-4 max-w-2xl font-wallet-display text-3xl font-extrabold leading-[1.08] sm:text-4xl lg:text-6xl">
                Your information. Clearly explained.
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-newsfeed-muted sm:text-lg sm:leading-8">
                This policy explains what Oventric collects, why it is needed, how it supports your experience, and the choices available to you.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg"><Link to="/report-problem">Ask a privacy question <ArrowRight /></Link></Button>
                <Button asChild size="lg" variant="outline" className="border-newsfeed-line bg-newsfeed-surface text-newsfeed-ink hover:bg-newsfeed-blue-soft hover:text-newsfeed-blue"><Link to="/terms">Read Terms</Link></Button>
              </div>
              <div className="mt-7 flex items-start gap-3 text-sm leading-6 text-newsfeed-muted">
                <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-newsfeed-green-soft text-newsfeed-green"><LockKeyhole className="size-4" /></span>
                <span>Oventric does not sell your personal information.</span>
              </div>
            </div>
            <div className="relative min-h-[350px] overflow-hidden lg:min-h-full">
              <img
                src={legalImage}
                alt="Privacy and security documents arranged with a protective lock and shield"
                width={1200}
                height={900}
                fetchPriority="high"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="help-image-shade absolute inset-0" aria-hidden="true" />
              <div className="absolute bottom-5 left-5 right-5 rounded-[10px] border border-newsfeed-surface/70 bg-newsfeed-surface/90 p-4 shadow-newsfeed-panel backdrop-blur-sm sm:bottom-8 sm:left-8 sm:right-auto sm:max-w-xs">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-newsfeed-blue-soft text-newsfeed-blue"><Fingerprint className="size-5" /></span>
                  <div>
                    <p className="font-wallet-display text-sm font-bold">Privacy follows the service</p>
                    <p className="mt-1 text-xs leading-5 text-newsfeed-muted">The information used depends on the Oventric features you choose.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="about-spectrum h-1 w-full" aria-hidden="true" />

        <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-10 lg:py-24">
          <div className="max-w-3xl">
            <p className="font-wallet-display text-sm font-bold text-newsfeed-blue">THE SHORT VERSION</p>
            <h2 className="mt-4 font-wallet-display text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">Privacy should be understandable.</h2>
            <p className="mt-5 text-base leading-7 text-newsfeed-muted sm:text-lg">Oventric processes information to provide the experience you use, maintain trustworthy records and protect the people taking part.</p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {privacyOverview.map((item) => (
              <article key={item.title} className={`rounded-[10px] border border-newsfeed-line border-t-2 ${item.border} bg-newsfeed-surface p-5 shadow-newsfeed-panel`}>
                <span className={`grid size-11 place-items-center rounded-[10px] ${item.tone}`}><item.icon className="size-5" /></span>
                <h3 className="mt-5 font-wallet-display text-base font-bold">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-newsfeed-muted">{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-newsfeed-line bg-newsfeed-surface py-16 lg:py-24">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 sm:px-8 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16 lg:px-10">
            <div className="lg:sticky lg:top-24 lg:self-start">
              <span className="grid size-14 place-items-center rounded-[10px] bg-newsfeed-violet-soft text-newsfeed-violet"><Database className="size-7" /></span>
              <p className="mt-7 font-wallet-display text-sm font-bold text-newsfeed-violet">INFORMATION WE PROCESS</p>
              <h2 className="mt-4 font-wallet-display text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">Different actions create different records.</h2>
              <p className="mt-5 text-base leading-7 text-newsfeed-muted sm:text-lg">You do not provide every type of information simply by visiting. Records depend on whether you create an account, publish, buy, sell, communicate or request a payout.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {informationGroups.map((group) => (
                <article key={group.title} className="rounded-[10px] border border-newsfeed-line bg-newsfeed-canvas p-5 sm:p-6">
                  <span className={`grid size-11 place-items-center rounded-[10px] ${group.tone}`}><group.icon className="size-5" /></span>
                  <h3 className="mt-5 font-wallet-display text-lg font-bold">{group.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-newsfeed-muted">{group.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-10 lg:py-24">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start lg:gap-16">
            <div>
              <p className="font-wallet-display text-sm font-bold text-newsfeed-green">WHY INFORMATION IS USED</p>
              <h2 className="mt-4 font-wallet-display text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">To run Oventric and protect the journey.</h2>
              <p className="mt-5 text-base leading-7 text-newsfeed-muted sm:text-lg">Oventric uses personal information only for legitimate operational, safety, support and legal purposes connected to the platform.</p>
            </div>
            <div className="overflow-hidden rounded-[10px] border border-newsfeed-line bg-newsfeed-surface shadow-newsfeed-panel">
              {useCases.map((item) => (
                <div key={item} className="flex items-start gap-3 border-b border-newsfeed-line px-5 py-4 last:border-b-0 sm:px-6">
                  <BadgeCheck className="mt-0.5 size-5 shrink-0 text-newsfeed-green" />
                  <p className="text-sm leading-6">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-newsfeed-line bg-newsfeed-surface py-16 lg:py-24">
          <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
            <div className="max-w-3xl">
              <p className="font-wallet-display text-sm font-bold text-newsfeed-gold">SHARING & VISIBILITY</p>
              <h2 className="mt-4 font-wallet-display text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">Who may receive information?</h2>
              <p className="mt-5 text-base leading-7 text-newsfeed-muted sm:text-lg">Oventric limits sharing to what is needed for the service, required by law, or intentionally made public by you.</p>
            </div>
            <div className="mt-10 grid gap-px overflow-hidden rounded-[10px] border border-newsfeed-line bg-newsfeed-line md:grid-cols-3">
              {[
                [Globe2, "People using Oventric", "Profile information, posts, listings, creator showcases, reviews and other content you publish may be visible to others as shown in the experience.", "bg-newsfeed-blue-soft text-newsfeed-blue"],
                [ServerCog, "Service providers", "Limited information may be handled by vetted providers supporting payments, hosting, storage, authentication, communications, analytics and platform operations.", "bg-newsfeed-violet-soft text-newsfeed-violet"],
                [ShieldCheck, "Legal and safety needs", "Information may be preserved or disclosed when reasonably necessary to comply with law, prevent fraud, protect rights or investigate harmful activity.", "bg-newsfeed-coral-soft text-newsfeed-coral"],
              ].map(([Icon, title, body, tone]) => {
                const ItemIcon = Icon as typeof Globe2;
                return (
                  <article key={title as string} className="bg-newsfeed-canvas p-6 sm:p-7">
                    <span className={`grid size-11 place-items-center rounded-[10px] ${tone as string}`}><ItemIcon className="size-5" /></span>
                    <h3 className="mt-5 font-wallet-display text-lg font-bold">{title as string}</h3>
                    <p className="mt-3 text-sm leading-7 text-newsfeed-muted">{body as string}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-10 lg:py-24">
          <div className="text-center">
            <p className="font-wallet-display text-sm font-bold text-newsfeed-coral">YOUR CHOICES</p>
            <h2 className="mx-auto mt-4 max-w-3xl font-wallet-display text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">Practical ways to manage your information.</h2>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {rights.map((right) => (
              <article key={right.title} className="rounded-[10px] border border-newsfeed-line bg-newsfeed-surface p-5 shadow-newsfeed-panel sm:p-6">
                <span className={`grid size-11 place-items-center rounded-[10px] ${right.tone}`}><right.icon className="size-5" /></span>
                <h3 className="mt-5 font-wallet-display text-base font-bold">{right.title}</h3>
                <p className="mt-2 text-sm leading-6 text-newsfeed-muted">{right.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-newsfeed-line bg-newsfeed-surface py-16 lg:py-24">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 sm:px-8 lg:grid-cols-3 lg:px-10">
            <article>
              <span className="grid size-12 place-items-center rounded-[10px] bg-newsfeed-blue-soft text-newsfeed-blue"><KeyRound className="size-6" /></span>
              <h2 className="mt-5 font-wallet-display text-xl font-bold">Security</h2>
              <p className="mt-3 text-sm leading-7 text-newsfeed-muted">Oventric uses access controls, authentication protections and restricted data access to protect accounts and platform records. No online service can promise absolute security, so keep your own sign-in details private.</p>
            </article>
            <article>
              <span className="grid size-12 place-items-center rounded-[10px] bg-newsfeed-gold-soft text-newsfeed-gold"><Cookie className="size-6" /></span>
              <h2 className="mt-5 font-wallet-display text-xl font-bold">Cookies and sessions</h2>
              <p className="mt-3 text-sm leading-7 text-newsfeed-muted">Essential cookies and similar technologies keep you signed in, maintain sessions and protect the service. Limited analytics may help Oventric understand performance and improve the experience.</p>
            </article>
            <article>
              <span className="grid size-12 place-items-center rounded-[10px] bg-newsfeed-green-soft text-newsfeed-green"><Trash2 className="size-6" /></span>
              <h2 className="mt-5 font-wallet-display text-xl font-bold">Retention</h2>
              <p className="mt-3 text-sm leading-7 text-newsfeed-muted">Information is kept while your account is active and as needed for the purposes described here. Account deletion includes a 30-day recovery period. Some transaction, fraud-prevention or legal records may be retained where required.</p>
            </article>
          </div>
        </section>

        <section className="help-cta relative overflow-hidden py-16 lg:py-24">
          <div className="relative mx-auto max-w-4xl px-5 text-center sm:px-8">
            <span className="mx-auto grid size-14 place-items-center rounded-[10px] bg-newsfeed-coral-soft text-newsfeed-coral"><Headphones className="size-7" /></span>
            <p className="mt-6 font-wallet-display text-sm font-bold text-newsfeed-coral">PRIVACY SUPPORT</p>
            <h2 className="mt-4 font-wallet-display text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">Have a question about your information?</h2>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-newsfeed-muted sm:text-lg">Use the support form to ask about access, correction, deletion or another privacy concern. Do not include passwords or private sign-in codes.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg"><Link to="/report-problem">Contact support <ArrowRight /></Link></Button>
              <Button asChild size="lg" variant="outline" className="border-newsfeed-line bg-newsfeed-surface text-newsfeed-ink hover:bg-newsfeed-violet-soft hover:text-newsfeed-violet"><Link to="/help">Open Help Center</Link></Button>
            </div>
            <p className="mt-7 text-xs leading-5 text-newsfeed-muted">This policy may be updated as Oventric changes. Material updates will be reflected on this page.</p>
          </div>
        </section>
      </div>
    </PublicChrome>
  );
}

const sharing = [
  { icon: Globe2, title: "People using Oventric", body: "Profile information, posts, listings, creator showcases, reviews and other content you publish may be visible to others as shown in the experience." },
  { icon: ServerCog, title: "Service providers", body: "Limited information may be handled by vetted providers supporting payments, hosting, storage, authentication, communications, analytics and platform operations." },
  { icon: ShieldCheck, title: "Legal and safety needs", body: "Information may be preserved or disclosed when reasonably necessary to comply with law, prevent fraud, protect rights or investigate harmful activity." },
];

const safeguards = [
  { icon: KeyRound, title: "Security", body: "Oventric uses access controls, authentication protections and restricted data access to protect accounts and platform records. No online service can promise absolute security, so keep your own sign-in details private." },
  { icon: Cookie, title: "Cookies and sessions", body: "Essential cookies and similar technologies keep you signed in, maintain sessions and protect the service. Limited analytics may help Oventric understand performance and improve the experience." },
  { icon: Trash2, title: "Retention", body: "Information is kept while your account is active and as needed for the purposes described here. Account deletion includes a 30-day recovery period. Some transaction, fraud-prevention or legal records may be retained where required." },
];

function AppPrivacyPage() {
  const navigate = useNavigate();
  const back = () => {
    if (window.history.length > 1) window.history.back();
    else navigate({ to: "/" });
  };

  return (
    <div className="app-connections fixed inset-0 flex h-[100dvh] flex-col overflow-hidden bg-background text-foreground">
      <header className="app-shell-header z-40 flex h-[calc(3.5rem+env(safe-area-inset-top))] shrink-0 items-center gap-3 border-b border-border bg-background px-4 pt-[env(safe-area-inset-top)]">
        <Button variant="ghost" size="icon" onClick={back} aria-label="Back" className="size-10 shrink-0 text-foreground hover:bg-muted hover:text-foreground"><ArrowLeft className="size-5" /></Button>
        <span className="font-wallet-display text-base font-bold">Privacy policy</span>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-8 [scrollbar-width:none]">
        <div className="mx-auto max-w-2xl font-wallet-body">
          <div className="mb-8 border-b border-border pb-8">
            <span className="inline-flex size-12 items-center justify-center rounded-[10px] bg-primary/15 text-primary"><ShieldCheck className="size-6" /></span>
            <p className="mt-5 text-xs font-bold uppercase text-primary">Privacy & trust</p>
            <h1 className="mt-2 font-wallet-display text-3xl font-bold leading-tight">Your information. Clearly explained.</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">This policy explains what Oventric collects, why it is needed, how it supports your experience, and the choices available to you.</p>
            <p className="mt-4 flex items-center gap-2 text-sm text-foreground"><LockKeyhole className="size-4 text-primary" /> Oventric does not sell your personal information.</p>
          </div>

          <section className="border-b border-border pb-7" aria-labelledby="privacy-summary">
            <h2 id="privacy-summary" className="font-wallet-display text-xl font-bold">The short version</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Oventric processes information to provide the experience you use, maintain trustworthy records and protect the people taking part.</p>
            <div className="mt-5 space-y-4">
              {privacyOverview.map(({ icon: Icon, title, body }) => (
                <div key={title} className="flex gap-3"><Icon className="mt-0.5 size-5 shrink-0 text-primary" /><div><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">{body}</p></div></div>
              ))}
            </div>
          </section>

          <section className="border-b border-border py-7" aria-labelledby="privacy-information">
            <h2 id="privacy-information" className="font-wallet-display text-xl font-bold">Information we process</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Records depend on whether you create an account, publish, buy, sell, communicate or request a payout.</p>
            <div className="mt-5 divide-y divide-border border-y border-border">
              {informationGroups.map(({ icon: Icon, title, body }) => (
                <article key={title} className="flex gap-3 py-4"><Icon className="mt-0.5 size-5 shrink-0 text-primary" /><div><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">{body}</p></div></article>
              ))}
            </div>
          </section>

          <section className="border-b border-border py-7" aria-labelledby="privacy-use">
            <h2 id="privacy-use" className="font-wallet-display text-xl font-bold">Why information is used</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">To run Oventric and protect the journey.</p>
            <ul className="mt-5 space-y-3">{useCases.map((item) => <li key={item} className="flex gap-3 text-sm leading-6"><BadgeCheck className="mt-1 size-4 shrink-0 text-primary" /><span>{item}</span></li>)}</ul>
          </section>

          <section className="border-b border-border py-7" aria-labelledby="privacy-sharing">
            <h2 id="privacy-sharing" className="font-wallet-display text-xl font-bold">Sharing & visibility</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Oventric limits sharing to what is needed for the service, required by law, or intentionally made public by you.</p>
            <div className="mt-5 space-y-5">{sharing.map(({ icon: Icon, title, body }) => <article key={title} className="flex gap-3"><Icon className="mt-0.5 size-5 shrink-0 text-primary" /><div><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">{body}</p></div></article>)}</div>
          </section>

          <section className="border-b border-border py-7" aria-labelledby="privacy-choices">
            <h2 id="privacy-choices" className="font-wallet-display text-xl font-bold">Your choices</h2>
            <div className="mt-5 space-y-5">{rights.map(({ icon: Icon, title, body }) => <article key={title} className="flex gap-3"><Icon className="mt-0.5 size-5 shrink-0 text-primary" /><div><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">{body}</p></div></article>)}</div>
          </section>

          <section className="border-b border-border py-7" aria-labelledby="privacy-protection">
            <h2 id="privacy-protection" className="font-wallet-display text-xl font-bold">Protection & retention</h2>
            <div className="mt-5 space-y-5">{safeguards.map(({ icon: Icon, title, body }) => <article key={title} className="flex gap-3"><Icon className="mt-0.5 size-5 shrink-0 text-primary" /><div><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">{body}</p></div></article>)}</div>
          </section>

          <section className="py-7" aria-labelledby="privacy-support">
            <h2 id="privacy-support" className="font-wallet-display text-xl font-bold">Questions about your information?</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Ask about access, correction, deletion or another privacy concern. Do not include passwords or private sign-in codes. This policy may be updated as Oventric changes; material updates will be reflected here.</p>
            <div className="mt-5 flex flex-wrap gap-3"><Button asChild><Link to="/report-problem">Contact support <ArrowRight /></Link></Button><Button asChild variant="outline"><Link to="/terms">Read Terms</Link></Button></div>
          </section>
        </div>
      </main>
    </div>
  );
}