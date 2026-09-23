import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  BadgePercent,
  Banknote,
  Check,
  Clock3,
  FileSearch,
  GraduationCap,
  HandCoins,
  Headset,
  ListChecks,
  MessageCircleMore,
  PackageOpen,
  ReceiptText,
  RotateCcw,
  Scale,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { PublicChrome } from "@/components/oventric/PublicChrome";
import { Button } from "@/components/ui/button";
import legalImage from "@/assets/public-pages/legal-editorial.jpg";

export const Route = createFileRoute("/refunds")({
  head: () => ({
    meta: [
      { title: "Refund & Dispute Policy — Oventric" },
      {
        name: "description",
        content:
          "How refunds, order disputes, escrow releases, cashback reversals and chargebacks work on Oventric for digital products, services, courses and bounties.",
      },
      { property: "og:title", content: "Oventric Refund & Dispute Policy" },
      {
        property: "og:description",
        content:
          "A plain-language guide to buyer protection, escrow, digital-product refunds, course refunds, payout timing and dispute reviews on Oventric.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://oventric.com/refunds" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://oventric.com/refunds" }],
  }),
  component: RefundsPage,
});

const overviewCards = [
  {
    icon: ShieldCheck,
    title: "Money is held until delivery",
    body: "Marketplace payments are held by Oventric until the order is marked complete, so buyers are never left unprotected.",
    tone: "bg-newsfeed-green-soft text-newsfeed-green",
    border: "border-newsfeed-green",
  },
  {
    icon: RotateCcw,
    title: "Clear refund grounds",
    body: "Refunds follow fixed, published rules for digital products, services, bounties and Academy courses — no guesswork.",
    tone: "bg-newsfeed-blue-soft text-newsfeed-blue",
    border: "border-newsfeed-blue",
  },
  {
    icon: FileSearch,
    title: "Human dispute review",
    body: "Our team reviews the order chat, the delivery and the listing before deciding any escalated dispute.",
    tone: "bg-newsfeed-violet-soft text-newsfeed-violet",
    border: "border-newsfeed-violet",
  },
  {
    icon: Wallet,
    title: "Refunds land in your wallet",
    body: "Approved refunds are credited to your Oventric wallet in your home currency, ready to use or withdraw.",
    tone: "bg-newsfeed-gold-soft text-newsfeed-gold",
    border: "border-newsfeed-gold",
  },
];

const protectionPoints = [
  "Payments for marketplace orders are held by Oventric until the order is marked complete.",
  "If something goes wrong before completion, open a dispute from the order page.",
  "Our team reviews the chat, the delivery and the original listing before deciding.",
  "Sellers are notified and given the chance to respond with their own evidence.",
  "Every decision is recorded against the order so the full history stays visible.",
];

const digitalRefundable = [
  "The item was never delivered.",
  "The delivered file is corrupt, broken or unusable.",
  "The item is materially different from the listing description.",
];

const digitalNonRefundable = [
  "Change of mind after a working item has been delivered.",
  "Incompatibility with tools or devices the listing never claimed to support.",
  "Items already downloaded and confirmed working by the buyer.",
];

const servicePoints = [
  "Service and bounty funds sit in escrow from the moment you pay.",
  "If the provider does not start, or does not deliver within the agreed window, you can cancel and the escrowed amount returns to your wallet in full.",
  "Once delivered work is accepted, the release to the provider is final.",
  "Partial delivery disputes are reviewed against the agreed scope in the order record.",
];

const courseRules = [
  "Academy enrolments can be refunded within 7 days of purchase.",
  "You must have completed less than 20% of the course content.",
  "After 7 days, or past 20% completion, the enrolment is non-refundable.",
  "Refunded enrolments lose access to the course immediately.",
];

const refundSteps = [
  {
    title: "Message the seller first",
    body: "Open the order and message the seller directly — most delivery issues are resolved in the order chat.",
  },
  {
    title: "Escalate within 24 hours",
    body: "If it is not resolved within 24 hours, use “Report a problem” on that order to escalate to Oventric support.",
  },
  {
    title: "Support reviews the record",
    body: "The team reviews the listing, chat and delivery evidence, then approves or declines with a written reason.",
  },
  {
    title: "Refund reaches your wallet",
    body: "Approved refunds are credited to your wallet in your home currency within 1–3 business days.",
  },
];

const currencyPoints = [
  "Refunds are returned in the currency you were charged in.",
  "Conversion uses the rate captured at checkout, so you receive the same value back.",
  "Payment-processor charges already incurred on a completed payment may not be recoverable on partial refunds.",
  "Wallet funds from a refund can be withdrawn using your saved payout method.",
];

export default function Placeholder() {
  return null;
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-xs font-bold uppercase tracking-widest text-newsfeed-coral">{children}</p>
  );
}

function RefundsPage() {
  return (
    <PublicChrome lightDesktop>
      <div className="bg-background text-foreground">
        {/* Hero */}
        <header className="relative overflow-hidden">
          <div className="absolute inset-0">
            <img
              src={legalImage}
              alt="Documents on a desk representing Oventric refund and dispute records"
              className="h-full w-full object-cover"
              width={1200}
              height={900}
              fetchPriority="high"
            />
            <div className="absolute inset-0 help-image-shade" />
          </div>
          <div className="relative mx-auto max-w-5xl px-5 py-14 sm:px-8 sm:py-20 lg:py-24">
            <SectionLabel>REFUNDS &amp; DISPUTES</SectionLabel>
            <h1 className="about-hero-copy mt-4 max-w-3xl font-public-display text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
              Buyer protection, explained before you ever need it.
            </h1>
            <p className="about-hero-copy mt-4 max-w-2xl text-base leading-7 opacity-90 sm:text-lg">
              This policy applies to every purchase on Oventric — marketplace items, services,
              Academy courses and bounty escrow. It sets out when refunds apply, how disputes are
              reviewed, and where your money goes.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="rounded-[10px]">
                <Link to="/help">
                  Visit the Help center <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-[10px] border-white/70 bg-white/10 text-white hover:bg-white/20 hover:text-white"
              >
                <Link to="/report-problem">Report a problem</Link>
              </Button>
            </div>
          </div>
        </header>

        <div className="about-spectrum h-1.5 w-full" aria-hidden="true" />

        <div className="mx-auto max-w-5xl px-5 py-12 sm:px-8 sm:py-16 space-y-16">
          {/* Short version */}
          <section>
            <SectionLabel>THE SHORT VERSION</SectionLabel>
            <h2 className="mt-3 font-public-display text-2xl font-bold sm:text-3xl">
              Four things to know up front
            </h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {overviewCards.map((card) => (
                <div
                  key={card.title}
                  className={`rounded-[10px] border bg-card p-5 shadow-sm border-t-4 ${card.border}`}
                >
                  <span
                    className={`inline-grid size-10 place-items-center rounded-[10px] ${card.tone}`}
                  >
                    <card.icon className="size-5" />
                  </span>
                  <h3 className="mt-4 font-public-display text-base font-bold">{card.title}</h3>
                  <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{card.body}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Buyer protection */}
          <section className="grid gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
            <div>
              <SectionLabel>BUYER PROTECTION</SectionLabel>
              <h2 className="mt-3 font-public-display text-2xl font-bold sm:text-3xl">
                How protection works on every order
              </h2>
              <p className="mt-4 text-sm leading-7 text-muted-foreground">
                Oventric is a digital-only marketplace. Because goods cannot be physically
                returned, protection is built into how money moves: payment is held, delivery is
                verified against the record, and disputes are reviewed by people.
              </p>
            </div>
            <ul className="space-y-3">
              {protectionPoints.map((point) => (
                <li
                  key={point}
                  className="flex items-start gap-3 rounded-[10px] border border-border bg-card p-4"
                >
                  <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-newsfeed-green-soft text-newsfeed-green">
                    <Check className="size-3.5" />
                  </span>
                  <span className="text-sm leading-6 text-foreground">{point}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Digital products */}
          <section className="grid gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
            <div className="lg:sticky lg:top-24 self-start">
              <SectionLabel>DIGITAL PRODUCTS</SectionLabel>
              <h2 className="mt-3 font-public-display text-2xl font-bold sm:text-3xl">
                Files, licences, accounts and templates
              </h2>
              <p className="mt-4 text-sm leading-7 text-muted-foreground">
                Digital goods cannot be returned once delivered, so refunds focus on whether you
                actually received what was described.
              </p>
            </div>
            <div className="space-y-4">
              <div className="rounded-[10px] border border-newsfeed-green bg-card p-5 border-t-4">
                <div className="flex items-center gap-2.5">
                  <PackageOpen className="size-5 text-newsfeed-green" />
                  <h3 className="font-public-display text-base font-bold">
                    Refundable situations
                  </h3>
                </div>
                <ul className="mt-3 space-y-2.5">
                  {digitalRefundable.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm leading-6">
                      <Check className="mt-1 size-4 shrink-0 text-newsfeed-green" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-[10px] border border-newsfeed-coral bg-card p-5 border-t-4">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="size-5 text-newsfeed-coral" />
                  <h3 className="font-public-display text-base font-bold">
                    Not refundable
                  </h3>
                </div>
                <ul className="mt-3 space-y-2.5">
                  {digitalNonRefundable.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2.5 text-sm leading-6 text-muted-foreground"
                    >
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-newsfeed-coral" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* Services & bounties */}
          <section className="grid gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
            <div className="lg:sticky lg:top-24 self-start">
              <SectionLabel>SERVICES &amp; BOUNTIES</SectionLabel>
              <h2 className="mt-3 font-public-display text-2xl font-bold sm:text-3xl">
                Escrow protects both sides
              </h2>
              <p className="mt-4 text-sm leading-7 text-muted-foreground">
                Funds for services and bounties stay in escrow until work is delivered and
                accepted — so providers are paid for real work, and buyers never pay for silence.
              </p>
            </div>
            <ul className="space-y-3">
              {servicePoints.map((point) => (
                <li
                  key={point}
                  className="flex items-start gap-3 rounded-[10px] border border-border bg-card p-4"
                >
                  <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-newsfeed-violet-soft text-newsfeed-violet">
                    <HandCoins className="size-3.5" />
                  </span>
                  <span className="text-sm leading-6 text-foreground">{point}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Courses */}
          <section className="rounded-[10px] border border-newsfeed-blue border-t-4 bg-card p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-[10px] bg-newsfeed-blue-soft text-newsfeed-blue">
                <GraduationCap className="size-5" />
              </span>
              <div>
                <SectionLabel>ACADEMY COURSES</SectionLabel>
                <h2 className="mt-1 font-public-display text-xl font-bold sm:text-2xl">
                  A fair window to change your mind
                </h2>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {courseRules.map((rule) => (
                <div
                  key={rule}
                  className="flex items-start gap-3 rounded-[10px] bg-newsfeed-blue-soft/60 p-4"
                >
                  <Check className="mt-0.5 size-4 shrink-0 text-newsfeed-blue" />
                  <span className="text-sm leading-6">{rule}</span>
                </div>
              ))}
            </div>
          </section>

          {/* How to request */}
          <section>
            <SectionLabel>HOW TO REQUEST A REFUND</SectionLabel>
            <h2 className="mt-3 font-public-display text-2xl font-bold sm:text-3xl">
              Four steps, in order
            </h2>
            <ol className="mt-8 grid gap-4 sm:grid-cols-2">
              {refundSteps.map((step, index) => (
                <li
                  key={step.title}
                  className="relative rounded-[10px] border border-border bg-card p-5"
                >
                  <span className="grid size-9 place-items-center rounded-full bg-newsfeed-violet-soft font-public-display text-sm font-bold text-newsfeed-violet">
                    {index + 1}
                  </span>
                  <h3 className="mt-3 font-public-display text-base font-bold">{step.title}</h3>
                  <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{step.body}</p>
                </li>
              ))}
            </ol>
          </section>

          {/* Currency, cashback, chargebacks */}
          <section className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-[10px] border border-newsfeed-gold border-t-4 bg-card p-5">
              <Banknote className="size-5 text-newsfeed-gold" />
              <h3 className="mt-3 font-public-display text-base font-bold">Currency &amp; fees</h3>
              <ul className="mt-3 space-y-2.5">
                {currencyPoints.map((point) => (
                  <li
                    key={point}
                    className="flex items-start gap-2 text-[13px] leading-5 text-muted-foreground"
                  >
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-newsfeed-gold" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-[10px] border border-newsfeed-green border-t-4 bg-card p-5">
              <BadgePercent className="size-5 text-newsfeed-green" />
              <h3 className="mt-3 font-public-display text-base font-bold">
                Cashback &amp; coupons
              </h3>
              <p className="mt-3 text-[13px] leading-5 text-muted-foreground">
                Cashback earned on an order is reversed when that order is refunded. If a coupon
                was used, no cashback was earned in the first place — coupons and cashback are
                never combined.
              </p>
            </div>
            <div className="rounded-[10px] border border-newsfeed-coral border-t-4 bg-card p-5">
              <Scale className="size-5 text-newsfeed-coral" />
              <h3 className="mt-3 font-public-display text-base font-bold">Chargebacks</h3>
              <p className="mt-3 text-[13px] leading-5 text-muted-foreground">
                Please raise a dispute with us before contacting your bank. Accounts with
                fraudulent chargebacks may be suspended and outstanding balances withheld.
              </p>
            </div>
          </section>

          {/* Timing note */}
          <section className="flex items-start gap-4 rounded-[10px] border border-border bg-secondary p-5 sm:p-6">
            <span className="grid size-11 shrink-0 place-items-center rounded-[10px] bg-newsfeed-blue-soft text-newsfeed-blue">
              <Clock3 className="size-5" />
            </span>
            <div>
              <h3 className="font-public-display text-base font-bold">
                How long does a refund take?
              </h3>
              <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                Once approved, refunds are credited to your Oventric wallet in your home currency
                within 1–3 business days. From there you can spend the balance on Oventric or
                withdraw it using your saved payout method.
              </p>
            </div>
          </section>

          {/* CTA */}
          <section className="help-cta overflow-hidden rounded-[10px] p-7 sm:p-10">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 text-newsfeed-coral">
                <Headset className="size-4" />
                <p className="text-xs font-bold uppercase tracking-widest">STILL STUCK?</p>
              </div>
              <h2 className="mt-3 font-public-display text-2xl font-bold sm:text-3xl">
                Report the order and we will look at the full record.
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
                Include the order page, what you expected and what arrived. The dispute team
                reviews the chat, the delivery and the listing before deciding.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild size="lg" className="rounded-[10px]">
                  <Link to="/report-problem">
                    Report a problem <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="rounded-[10px] border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                >
                  <Link to="/help">
                    <MessageCircleMore className="size-4" /> Help center
                  </Link>
                </Button>
              </div>
              <p className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
                <ReceiptText className="size-3.5" /> Every decision is recorded against the order
                and visible in your history.
              </p>
            </div>
          </section>

          <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
            <ListChecks className="mt-0.5 size-3.5 shrink-0" />
            This policy works together with the Oventric Terms and Privacy Policy. Where a
            listing promises more than this policy, the written listing terms on that order are
            reviewed as part of any dispute.
          </p>
        </div>
      </div>
    </PublicChrome>
  );
}
