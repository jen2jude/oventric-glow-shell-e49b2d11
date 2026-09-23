import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  Check,
  CircleDollarSign,
  Download,
  Globe2,
  HeartHandshake,
  Landmark,
  LockKeyhole,
  MessageCircleMore,
  PackageCheck,
  Palette,
  ReceiptText,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Users,
  WalletCards,
  Zap,
} from "lucide-react";
import { PublicChrome } from "@/components/oventric/PublicChrome";
import { Button } from "@/components/ui/button";
import buildersStudio from "@/assets/about/oventric-builders-studio.jpg";
import registrationOffice from "@/assets/about/oventric-registration-office.jpg";
import marketplaceCreator from "@/assets/how-marketplace-creator.jpg";
import paidCreator from "@/assets/how-paid-creator.jpg";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Oventric — Built for digital creators, sellers and buyers" },
      {
        name: "description",
        content:
          "Meet Oventric: a legally registered Nigerian technology and digital-commerce platform connecting professional identity, community, creator discovery, protected trade and a multi-currency wallet.",
      },
      { property: "og:title", content: "About Oventric — Built for digital opportunity" },
      {
        property: "og:description",
        content:
          "Oventric brings creators, community, digital commerce, escrow and wallet tools into one connected platform.",
      },
      { property: "og:url", content: "https://oventric.com/about" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://oventric.com/about" }],
  }),
  component: AboutPage,
});

const ecosystem = [
  {
    icon: Users,
    title: "Identity & community",
    body: "Profiles, skills, services, follows, conversations and a living newsfeed help people build trusted professional visibility.",
    tone: "bg-newsfeed-blue-soft text-newsfeed-blue",
  },
  {
    icon: Palette,
    title: "Creator showcase",
    body: "Creators publish image and video work, share portfolio and community links, and offer free or paid digital assets.",
    tone: "bg-newsfeed-violet-soft text-newsfeed-violet",
  },
  {
    icon: ShoppingBag,
    title: "Digital marketplace",
    body: "Seller-led storefronts make digital products discoverable, purchasable and deliverable without mixing creator assets into product discovery.",
    tone: "bg-newsfeed-green-soft text-newsfeed-green",
  },
  {
    icon: ShieldCheck,
    title: "Protected transactions",
    body: "Order records, escrow, delivery confirmation, reviews, seller replies, refunds and support create a clearer path from payment to completion.",
    tone: "bg-newsfeed-gold-soft text-newsfeed-gold",
  },
  {
    icon: WalletCards,
    title: "Wallet & payouts",
    body: "Balances, funding, transaction history and withdrawals are organised around each member’s home currency while listings remain open to everyone.",
    tone: "bg-newsfeed-coral-soft text-newsfeed-coral",
  },
];

const trustPoints = [
  { icon: LockKeyhole, title: "Escrow by default", body: "Funds stay protected through the order journey and are released through recorded fulfilment steps." },
  { icon: PackageCheck, title: "Digital goods only", body: "Oventric’s marketplace is purpose-built for digital products, with physical goods blocked from publication." },
  { icon: ReceiptText, title: "Clear records", body: "Buyers and sellers can follow payment, delivery, chat, review, refund and payout activity." },
  { icon: BadgeCheck, title: "Proof-led reputation", body: "Verified-purchase reviews, real sales activity and visible seller identity support better decisions." },
];

const principles = [
  { icon: HeartHandshake, number: "01", title: "People before transactions", body: "Commerce works better when it begins with identity, skill, conversation and trust." },
  { icon: Search, number: "02", title: "Discovery should be open", body: "Strong work deserves a path to the right audience, regardless of location or existing reach." },
  { icon: CircleDollarSign, number: "03", title: "Money should be understandable", body: "Prices, fees, cashback, order states and payouts should be visible before people commit." },
  { icon: Zap, number: "04", title: "One connected journey", body: "Creators should not need a patchwork of disconnected tools to showcase, sell, communicate and earn." },
];

function AboutPage() {
  return (
    <PublicChrome lightDesktop>
      <div className="about-editorial bg-newsfeed-canvas text-newsfeed-ink">
        <section className="relative min-h-[680px] overflow-hidden sm:min-h-[720px] lg:min-h-[760px]">
          <img
            src={buildersStudio}
            alt="African digital creators collaborating in a bright studio"
            width={1600}
            height={1008}
            fetchPriority="high"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="about-hero-shade absolute inset-0" />
          <div className="relative mx-auto flex min-h-[680px] max-w-7xl flex-col justify-end px-5 pb-16 pt-24 sm:min-h-[720px] sm:px-8 sm:pb-20 lg:min-h-[760px] lg:px-10 lg:pb-24">
            <div className="mb-7 h-1 w-36 rounded-full bg-newsfeed-coral" aria-hidden="true" />
            <p className="font-wallet-display text-sm font-bold uppercase tracking-normal text-primary-foreground">
              Built in Africa. Open to digital ambition everywhere.
            </p>
            <h1 className="mt-5 max-w-5xl font-wallet-display text-5xl font-extrabold leading-[1.02] text-primary-foreground sm:text-7xl lg:text-8xl">
              Oventric connects identity, community and digital opportunity.
            </h1>
            <p className="mt-7 max-w-3xl text-base leading-7 text-primary-foreground sm:text-xl sm:leading-8">
              One dependable place for creators to be seen, sellers to build trusted businesses, buyers to discover useful digital work, and communities to grow around real people.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-newsfeed-coral text-primary-foreground hover:bg-newsfeed-coral/90">
                <Link to="/explore">Explore Oventric <ArrowRight /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-primary-foreground/60 bg-newsfeed-surface/90 text-newsfeed-ink hover:bg-newsfeed-surface">
                <Link to="/marketplace">Visit marketplace</Link>
              </Button>
            </div>
          </div>
        </section>

        <div className="about-spectrum h-1 w-full" aria-hidden="true" />

        <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10 lg:py-28">
          <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
            <div>
              <p className="font-wallet-display text-sm font-bold text-newsfeed-violet">WHY OVENTRIC EXISTS</p>
              <h2 className="mt-4 font-wallet-display text-4xl font-bold leading-tight sm:text-5xl">
                Digital builders deserve a connected path from skill to income.
              </h2>
            </div>
            <div className="space-y-5 text-base leading-8 text-newsfeed-muted sm:text-lg">
              <p>
                Talent is everywhere, but opportunity is often fragmented. People build a profile in one place, find an audience somewhere else, sell through another tool and manage payment in yet another system.
              </p>
              <p>
                Oventric brings those moments together. Professional identity leads into discovery. Discovery leads into conversation, storefronts and protected orders. Completed work builds reputation, relationships and a stronger digital business.
              </p>
            </div>
          </div>
        </section>

        <section className="border-y border-newsfeed-line bg-newsfeed-surface py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
            <div className="max-w-3xl">
              <p className="font-wallet-display text-sm font-bold text-newsfeed-blue">ONE CONNECTED ECOSYSTEM</p>
              <h2 className="mt-4 font-wallet-display text-4xl font-bold sm:text-5xl">Everything is designed to work together.</h2>
              <p className="mt-5 text-lg leading-8 text-newsfeed-muted">
                Oventric is not only a marketplace or social network. It is the shared layer between who people are, what they create, how they trade and how they get paid.
              </p>
            </div>

            <div className="relative mt-14 grid gap-4 md:grid-cols-5">
              <div className="about-ecosystem-line absolute left-[10%] right-[10%] top-8 hidden h-px md:block" />
              {ecosystem.map((item, index) => (
                <article key={item.title} className="relative border-t border-newsfeed-line pt-5 md:border-t-0 md:pt-0">
                  <span className={`relative z-10 grid size-16 place-items-center rounded-[10px] ${item.tone}`}>
                    <item.icon className="size-7" />
                  </span>
                  <p className="mt-6 text-xs font-bold text-newsfeed-muted">0{index + 1}</p>
                  <h3 className="mt-2 font-wallet-display text-lg font-bold">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-newsfeed-muted">{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10 lg:py-28">
          <div className="grid gap-14 lg:grid-cols-2 lg:items-center">
            <div className="overflow-hidden rounded-[10px] border border-newsfeed-line bg-newsfeed-surface shadow-newsfeed-panel">
              <img loading="lazy" decoding="async" src={marketplaceCreator} alt="Creator preparing digital work for an online marketplace" width={1104} height={768} className="aspect-[4/3] w-full object-cover" />
            </div>
            <div>
              <p className="font-wallet-display text-sm font-bold text-newsfeed-green">BUILT AROUND THE SELLER</p>
              <h2 className="mt-4 font-wallet-display text-4xl font-bold leading-tight sm:text-5xl">A storefront with a person behind it.</h2>
              <p className="mt-6 text-lg leading-8 text-newsfeed-muted">
                Oventric helps sellers turn useful knowledge and digital work into organised businesses—without losing the identity and conversation that make customers trust them.
              </p>
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {[
                  [Store, "Seller storefronts", "Products live under a recognisable seller and shop identity."],
                  [BriefcaseBusiness, "Skills and services", "Profiles show what people can do, not only what they sell."],
                  [MessageCircleMore, "Order conversations", "Buyers and sellers stay connected throughout fulfilment."],
                  [Banknote, "Seller earnings", "The marketplace’s standard settlement allocates 80% to the seller and 20% to Oventric."],
                ].map(([Icon, title, body]) => {
                  const ItemIcon = Icon as typeof Store;
                  return (
                    <div key={title as string} className="border-l-2 border-newsfeed-green pl-4">
                      <ItemIcon className="size-5 text-newsfeed-green" />
                      <h3 className="mt-3 font-wallet-display font-bold">{title as string}</h3>
                      <p className="mt-1 text-sm leading-6 text-newsfeed-muted">{body as string}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-newsfeed-ink py-20 text-primary-foreground lg:py-28">
          <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
            <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
              <div>
                <p className="font-wallet-display text-sm font-bold text-newsfeed-gold">COMMERCE WITH GUARDRAILS</p>
                <h2 className="mt-4 font-wallet-display text-4xl font-bold leading-tight sm:text-5xl">Trust is part of the product.</h2>
                <p className="mt-6 max-w-xl text-lg leading-8 text-primary-foreground/75">
                  Oventric records the journey around a purchase so that buyers, sellers and support teams can understand what happened and what comes next.
                </p>
              </div>
              <div className="grid gap-px overflow-hidden rounded-[10px] bg-primary-foreground/15 sm:grid-cols-2">
                {trustPoints.map((point) => (
                  <article key={point.title} className="bg-newsfeed-ink p-6 sm:p-8">
                    <point.icon className="size-7 text-newsfeed-gold" />
                    <h3 className="mt-5 font-wallet-display text-xl font-bold">{point.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-primary-foreground/70">{point.body}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10 lg:py-28">
          <div className="grid gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <p className="font-wallet-display text-sm font-bold text-newsfeed-violet">CREATORS ARE MORE THAN LISTINGS</p>
              <h2 className="mt-4 font-wallet-display text-4xl font-bold leading-tight sm:text-5xl">Show the work. Share the story. Offer the asset.</h2>
              <p className="mt-6 text-lg leading-8 text-newsfeed-muted">
                Creator spaces are built for skills, services and proof of work. Images and short video previews present the work itself, while portfolio, community and external video links help people explore further.
              </p>
              <ul className="mt-8 space-y-4">
                {[
                  "Publish visual and video showcases with real view activity",
                  "Connect WhatsApp, Telegram, portfolio and professional links",
                  "Offer a downloadable asset for free or through protected checkout",
                  "Keep creator assets distinct from ordinary marketplace products",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm leading-6">
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-newsfeed-violet-soft text-newsfeed-violet"><Check className="size-3" /></span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative overflow-hidden rounded-[10px] border border-newsfeed-line bg-newsfeed-surface shadow-newsfeed-panel">
              <img loading="lazy" decoding="async" src={paidCreator} alt="Digital creator presenting work and managing earnings" width={1104} height={768} className="aspect-[4/3] w-full object-cover" />
              <div className="grid grid-cols-2 gap-px bg-newsfeed-line">
                <div className="bg-newsfeed-surface p-5"><Download className="size-5 text-newsfeed-blue" /><p className="mt-2 font-wallet-display text-sm font-bold">Free instant assets</p></div>
                <div className="bg-newsfeed-surface p-5"><ShieldCheck className="size-5 text-newsfeed-violet" /><p className="mt-2 font-wallet-display text-sm font-bold">Paid protected assets</p></div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-newsfeed-line bg-newsfeed-surface py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
            <div className="max-w-3xl">
              <p className="font-wallet-display text-sm font-bold text-newsfeed-coral">LEGAL IDENTITY</p>
              <h2 className="mt-4 font-wallet-display text-4xl font-bold leading-tight sm:text-5xl">Registered to do business in Nigeria.</h2>
              <p className="mt-6 text-lg leading-8 text-newsfeed-muted">
                Oventric is legally registered under the Companies and Allied Matters Act and with Nigeria’s Corporate Affairs Commission (CAC) to conduct business in Retail, Trade &amp; E-Commerce, including digital products of all kinds.
              </p>
            </div>

            <div className="mt-12 grid overflow-hidden rounded-[10px] border border-newsfeed-line bg-newsfeed-canvas shadow-newsfeed-panel lg:grid-cols-[1.18fr_0.82fr]">
              <div className="relative min-h-[420px] overflow-hidden lg:min-h-[570px]">
                <img loading="lazy" decoding="async" src={registrationOffice} alt="A framed registration display in a modern Oventric office reception" width={1504} height={1104} className="absolute inset-0 h-full w-full object-cover" />
                <div className="about-certificate-panel absolute left-[42.2%] top-[13.6%] flex h-[35.3%] w-[19.9%] flex-col items-center justify-center px-2 text-center">
                  <Landmark className="size-6 text-newsfeed-coral sm:size-8" />
                  <span className="mt-2 font-wallet-display text-[7px] font-bold uppercase leading-tight text-newsfeed-ink sm:text-[10px]">CAC Registered</span>
                  <span className="mt-1 text-[6px] leading-tight text-newsfeed-muted sm:text-[8px]">Federal Republic of Nigeria</span>
                </div>
              </div>
              <div className="flex flex-col justify-center p-7 sm:p-10 lg:p-12">
                <span className="grid size-14 place-items-center rounded-[10px] bg-newsfeed-coral-soft text-newsfeed-coral"><Building2 className="size-7" /></span>
                <h3 className="mt-7 font-wallet-display text-2xl font-bold">A formal foundation for digital commerce</h3>
                <p className="mt-4 text-sm leading-7 text-newsfeed-muted">
                  Registration gives Oventric a clear legal footing for the retail, trade and e-commerce activities that support its marketplace and digital-product ecosystem.
                </p>
                <div className="mt-7 space-y-3 border-t border-newsfeed-line pt-6 text-sm">
                  <p className="flex items-center gap-3"><Check className="size-4 text-newsfeed-green" /> Companies and Allied Matters Act</p>
                  <p className="flex items-center gap-3"><Check className="size-4 text-newsfeed-green" /> Corporate Affairs Commission, Nigeria</p>
                  <p className="flex items-center gap-3"><Check className="size-4 text-newsfeed-green" /> Retail, Trade &amp; E-Commerce</p>
                  <p className="flex items-center gap-3"><Check className="size-4 text-newsfeed-green" /> Digital products of all kinds</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10 lg:py-28">
          <div className="text-center">
            <p className="font-wallet-display text-sm font-bold text-newsfeed-blue">HOW WE BUILD</p>
            <h2 className="mx-auto mt-4 max-w-3xl font-wallet-display text-4xl font-bold sm:text-5xl">Principles that keep the platform human.</h2>
          </div>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {principles.map((principle, index) => {
              const tones = ["text-newsfeed-blue bg-newsfeed-blue-soft", "text-newsfeed-violet bg-newsfeed-violet-soft", "text-newsfeed-green bg-newsfeed-green-soft", "text-newsfeed-gold bg-newsfeed-gold-soft"];
              return (
                <article key={principle.title} className="rounded-[10px] border border-newsfeed-line bg-newsfeed-surface p-6 shadow-newsfeed-panel">
                  <div className="flex items-center justify-between">
                    <span className={`grid size-11 place-items-center rounded-[10px] ${tones[index]}`}><principle.icon className="size-5" /></span>
                    <span className="font-wallet-display text-xs font-bold text-newsfeed-muted">{principle.number}</span>
                  </div>
                  <h3 className="mt-8 font-wallet-display text-lg font-bold">{principle.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-newsfeed-muted">{principle.body}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="about-cta relative overflow-hidden py-20 lg:py-28">
          <div className="relative mx-auto max-w-5xl px-5 text-center sm:px-8">
            <Globe2 className="mx-auto size-9 text-newsfeed-blue" />
            <p className="mt-6 font-wallet-display text-sm font-bold text-newsfeed-violet">NIGERIA TO THE DIGITAL WORLD</p>
            <h2 className="mt-4 font-wallet-display text-4xl font-bold leading-tight sm:text-6xl">Come build, discover and earn with Oventric.</h2>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-newsfeed-muted">
              Whether you are presenting your first project, growing a digital storefront or looking for useful work from trusted people, there is a place for you here.
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg"><Link to="/explore">Start exploring <ArrowRight /></Link></Button>
              <Button asChild size="lg" variant="outline"><Link to="/help">Visit help centre <BookOpen /></Link></Button>
            </div>
          </div>
        </section>
      </div>
    </PublicChrome>
  );
}