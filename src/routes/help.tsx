import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgeCheck,
  BookOpenCheck,
  CircleHelp,
  Download,
  FileWarning,
  Headphones,
  HeartHandshake,
  LockKeyhole,
  MessageCircleMore,
  PackageCheck,
  ReceiptText,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  UserRoundCheck,
  Users,
  WalletCards,
} from "lucide-react";
import { PublicChrome } from "@/components/oventric/PublicChrome";
import { Button } from "@/components/ui/button";
import helpImage from "@/assets/public-pages/help-editorial.jpg";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "Help Center — Answers and support from Oventric" },
      {
        name: "description",
        content:
          "Find clear Oventric guidance for accounts, digital purchases, selling, delivery, creators, wallet activity, payouts and order support.",
      },
      { property: "og:title", content: "Oventric Help Center — Find answers and get support" },
      {
        property: "og:description",
        content:
          "Practical help for using Oventric, from your account and creator profile to protected digital orders, downloads, wallet activity and payouts.",
      },
      { property: "og:url", content: "https://oventric.com/help" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://oventric.com/help" }],
  }),
  component: HelpPage,
});

const helpTopics = [
  {
    icon: UserRoundCheck,
    title: "Account & security",
    body: "Profile setup, verification, sign-in protection and account access.",
    tone: "bg-newsfeed-blue-soft text-newsfeed-blue",
    border: "border-newsfeed-blue",
  },
  {
    icon: ShoppingBag,
    title: "Buying & downloads",
    body: "Checkout, order progress, delivery confirmation and digital files.",
    tone: "bg-newsfeed-violet-soft text-newsfeed-violet",
    border: "border-newsfeed-violet",
  },
  {
    icon: Store,
    title: "Selling & delivery",
    body: "Publishing products, customer orders, fulfilment and earnings.",
    tone: "bg-newsfeed-green-soft text-newsfeed-green",
    border: "border-newsfeed-green",
  },
  {
    icon: WalletCards,
    title: "Wallet & payouts",
    body: "Balances, funding, transaction records and withdrawal progress.",
    tone: "bg-newsfeed-gold-soft text-newsfeed-gold",
    border: "border-newsfeed-gold",
  },
  {
    icon: Sparkles,
    title: "Creators & community",
    body: "Showcases, assets, links, newsfeed posts and conversations.",
    tone: "bg-newsfeed-coral-soft text-newsfeed-coral",
    border: "border-newsfeed-coral",
  },
];

const guides = [
  {
    icon: ShieldCheck,
    title: "Set up a trusted account",
    intro: "Build a complete identity before you buy, sell or offer creative work.",
    points: [
      "Complete your profile with accurate personal and professional details.",
      "Finish the required verification steps before requesting payouts.",
      "Sellers must provide a reachable WhatsApp number with country code.",
    ],
    tone: "bg-newsfeed-blue-soft text-newsfeed-blue",
  },
  {
    icon: Download,
    title: "Buy and access digital products",
    intro: "Follow the recorded order journey from payment to delivery and download.",
    points: [
      "Review the product, seller identity, delivery method and price before paying.",
      "Use the order conversation for delivery updates and questions.",
      "Return to your purchase record to confirm delivery or access an available file again.",
    ],
    tone: "bg-newsfeed-violet-soft text-newsfeed-violet",
  },
  {
    icon: PackageCheck,
    title: "Sell and fulfil responsibly",
    intro: "Publish accurate digital listings and keep every customer updated.",
    points: [
      "Oventric’s marketplace is for digital goods; physical goods cannot be published.",
      "Use instant download for ready files or manual delivery when fulfilment needs your input.",
      "Deliver through the recorded order flow so the buyer can review and confirm it.",
    ],
    tone: "bg-newsfeed-green-soft text-newsfeed-green",
  },
  {
    icon: WalletCards,
    title: "Understand money movement",
    intro: "Your wallet keeps balances and transaction activity in your home currency.",
    points: [
      "Check Recent transactions or the full ledger for the latest recorded status.",
      "A withdrawal can move from pending to processing before it is marked paid.",
      "Standard marketplace settlement allocates 80% to the seller and 20% to Oventric.",
    ],
    tone: "bg-newsfeed-gold-soft text-newsfeed-gold",
  },
  {
    icon: Users,
    title: "Showcase work and connect",
    intro: "Creators can present skills and useful work without turning the showcase into a goods catalogue.",
    points: [
      "Post image or video media as the visible showcase for your work.",
      "Add portfolio, WhatsApp, Telegram, community and professional links.",
      "Offer a separate downloadable asset for free or through protected checkout.",
    ],
    tone: "bg-newsfeed-coral-soft text-newsfeed-coral",
  },
  {
    icon: MessageCircleMore,
    title: "Keep order communication clear",
    intro: "The order conversation gives buyers, sellers and support a shared record.",
    points: [
      "Keep payment, delivery and order questions inside the relevant conversation.",
      "Oventric order updates are marked as system activity, not as a message from another person.",
      "Reviews come from eligible purchases, and sellers can reply in the product review section.",
    ],
    tone: "bg-newsfeed-violet-soft text-newsfeed-violet",
  },
];

const supportSteps = [
  {
    icon: Search,
    number: "01",
    title: "Find the closest answer",
    body: "Start with the guides here or browse frequently asked questions for a quick explanation.",
  },
  {
    icon: ReceiptText,
    number: "02",
    title: "Check the record",
    body: "For money or order concerns, review the relevant purchase, conversation or wallet transaction first.",
  },
  {
    icon: FileWarning,
    number: "03",
    title: "Report what happened",
    body: "Share the exact issue and relevant order details so the support team can investigate the right activity.",
  },
];

function HelpPage() {
  return (
    <PublicChrome lightDesktop>
      <div className="help-editorial bg-newsfeed-canvas text-newsfeed-ink">
        <section className="relative overflow-hidden border-b border-newsfeed-line bg-newsfeed-surface">
          <div className="mx-auto grid min-h-[560px] max-w-7xl lg:grid-cols-[1.02fr_0.98fr]">
            <div className="flex flex-col justify-center px-5 py-20 sm:px-8 lg:px-10 lg:py-24">
              <div className="mb-7 h-1 w-36 rounded-full about-spectrum" aria-hidden="true" />
              <p className="font-wallet-display text-sm font-bold text-newsfeed-coral">OVENTRIC SUPPORT</p>
              <h1 className="mt-4 max-w-2xl font-wallet-display text-3xl font-extrabold leading-[1.08] sm:text-4xl lg:text-6xl">
                Find the right help, without the runaround.
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-newsfeed-muted sm:text-lg sm:leading-8">
                Clear guidance for your account, creator profile, digital purchases, selling, delivery, wallet activity and payouts.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link to="/faq">Browse common answers <ArrowRight /></Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/report-problem">Contact support</Link>
                </Button>
              </div>
              <div className="mt-8 flex items-center gap-3 text-sm text-newsfeed-muted">
                <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-newsfeed-green-soft text-newsfeed-green">
                  <LockKeyhole className="size-4" />
                </span>
                <span>For order help, include only the relevant order details in your report.</span>
              </div>
            </div>
            <div className="relative min-h-[360px] overflow-hidden lg:min-h-full">
              <img
                src={helpImage}
                alt="Organised support workspace with a headset, guide and security shield"
                width={1200}
                height={900}
                fetchPriority="high"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="help-image-shade absolute inset-0" aria-hidden="true" />
              <div className="absolute bottom-5 left-5 right-5 rounded-[10px] border border-newsfeed-surface/70 bg-newsfeed-surface/90 p-4 shadow-newsfeed-panel backdrop-blur-sm sm:bottom-8 sm:left-8 sm:right-auto sm:max-w-xs">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-[10px] bg-newsfeed-blue-soft text-newsfeed-blue"><Headphones className="size-5" /></span>
                  <div>
                    <p className="font-wallet-display text-sm font-bold">Start with the full story</p>
                    <p className="mt-1 text-xs leading-5 text-newsfeed-muted">Good details help support understand the issue faster.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="about-spectrum h-1 w-full" aria-hidden="true" />

        <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-10 lg:py-24">
          <div className="max-w-3xl">
            <p className="font-wallet-display text-sm font-bold text-newsfeed-blue">CHOOSE A HELP TOPIC</p>
            <h2 className="mt-4 font-wallet-display text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">What do you need to sort out?</h2>
            <p className="mt-5 text-base leading-7 text-newsfeed-muted sm:text-lg">Each guide follows the same journey you see inside Oventric, so you can identify the right next step.</p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {helpTopics.map((topic) => (
              <article key={topic.title} className={`rounded-[10px] border border-newsfeed-line border-t-2 ${topic.border} bg-newsfeed-surface p-5 shadow-newsfeed-panel`}>
                <span className={`grid size-11 place-items-center rounded-[10px] ${topic.tone}`}><topic.icon className="size-5" /></span>
                <h3 className="mt-5 font-wallet-display text-base font-bold">{topic.title}</h3>
                <p className="mt-2 text-sm leading-6 text-newsfeed-muted">{topic.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-newsfeed-line bg-newsfeed-surface py-16 lg:py-24">
          <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
            <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16">
              <div className="lg:sticky lg:top-24 lg:self-start">
                <span className="grid size-14 place-items-center rounded-[10px] bg-newsfeed-violet-soft text-newsfeed-violet"><BookOpenCheck className="size-7" /></span>
                <p className="mt-7 font-wallet-display text-sm font-bold text-newsfeed-violet">PRACTICAL GUIDES</p>
                <h2 className="mt-4 font-wallet-display text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">The important things, explained clearly.</h2>
                <p className="mt-5 text-base leading-7 text-newsfeed-muted sm:text-lg">Use these as a checklist before you report an issue or make a decision about an order.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {guides.map((guide) => (
                  <article key={guide.title} className="rounded-[10px] border border-newsfeed-line bg-newsfeed-canvas p-5 sm:p-6">
                    <span className={`grid size-11 place-items-center rounded-[10px] ${guide.tone}`}><guide.icon className="size-5" /></span>
                    <h3 className="mt-5 font-wallet-display text-lg font-bold">{guide.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-newsfeed-muted">{guide.intro}</p>
                    <ul className="mt-5 space-y-3 border-t border-newsfeed-line pt-5">
                      {guide.points.map((point) => (
                        <li key={point} className="flex items-start gap-3 text-sm leading-6">
                          <BadgeCheck className="mt-0.5 size-4 shrink-0 text-newsfeed-green" />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-10 lg:py-24">
          <div className="text-center">
            <p className="font-wallet-display text-sm font-bold text-newsfeed-green">WHEN YOU NEED SUPPORT</p>
            <h2 className="mx-auto mt-4 max-w-3xl font-wallet-display text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">A simple path from question to resolution.</h2>
          </div>
          <div className="relative mt-12 grid gap-4 md:grid-cols-3">
            <div className="help-step-line absolute left-[16%] right-[16%] top-8 hidden h-px md:block" aria-hidden="true" />
            {supportSteps.map((step) => (
              <article key={step.number} className="relative rounded-[10px] border border-newsfeed-line bg-newsfeed-surface p-6 shadow-newsfeed-panel sm:p-7">
                <div className="flex items-center justify-between">
                  <span className="relative z-10 grid size-14 place-items-center rounded-[10px] bg-newsfeed-blue-soft text-newsfeed-blue"><step.icon className="size-6" /></span>
                  <span className="font-wallet-display text-xs font-bold text-newsfeed-muted">{step.number}</span>
                </div>
                <h3 className="mt-7 font-wallet-display text-lg font-bold">{step.title}</h3>
                <p className="mt-3 text-sm leading-7 text-newsfeed-muted">{step.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-newsfeed-line bg-newsfeed-surface py-16 lg:py-24">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 sm:px-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:px-10">
            <div>
              <p className="font-wallet-display text-sm font-bold text-newsfeed-gold">PROTECTED DIGITAL COMMERCE</p>
              <h2 className="mt-4 font-wallet-display text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">Know what Oventric records for you.</h2>
              <p className="mt-5 text-base leading-7 text-newsfeed-muted sm:text-lg sm:leading-8">Orders, conversations, delivery activity, reviews, wallet entries and payout states create a clearer record for buyers, sellers and support.</p>
              <Button asChild variant="outline" className="mt-7"><Link to="/help-board">Open the Help Board <ArrowRight /></Link></Button>
            </div>
            <div className="grid gap-px overflow-hidden rounded-[10px] border border-newsfeed-line bg-newsfeed-line sm:grid-cols-2">
              {[
                [LockKeyhole, "Escrow journey", "Payment and release activity follows recorded order stages."],
                [ReceiptText, "Transaction history", "Wallet entries show the status and reason for money movement."],
                [HeartHandshake, "Buyer and seller record", "Order conversations keep fulfilment details in one place."],
                [CircleHelp, "Support context", "Reports can be matched to the activity that needs review."],
              ].map(([Icon, title, body]) => {
                const ItemIcon = Icon as typeof LockKeyhole;
                return (
                  <article key={title as string} className="bg-newsfeed-canvas p-6">
                    <ItemIcon className="size-6 text-newsfeed-gold" />
                    <h3 className="mt-4 font-wallet-display text-base font-bold">{title as string}</h3>
                    <p className="mt-2 text-sm leading-6 text-newsfeed-muted">{body as string}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="help-cta relative overflow-hidden py-16 lg:py-24">
          <div className="relative mx-auto max-w-4xl px-5 text-center sm:px-8">
            <span className="mx-auto grid size-14 place-items-center rounded-[10px] bg-newsfeed-coral-soft text-newsfeed-coral"><Headphones className="size-7" /></span>
            <p className="mt-6 font-wallet-display text-sm font-bold text-newsfeed-coral">STILL NEED A HAND?</p>
            <h2 className="mt-4 font-wallet-display text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">Tell us exactly what happened.</h2>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-newsfeed-muted sm:text-lg">Include the relevant order or transaction details, what you expected, and what you saw. Never include your password or private sign-in codes.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg"><Link to="/report-problem">Report a problem <ArrowRight /></Link></Button>
              <Button asChild size="lg" variant="outline"><Link to="/faq">Read FAQs</Link></Button>
            </div>
          </div>
        </section>
      </div>
    </PublicChrome>
  );
}