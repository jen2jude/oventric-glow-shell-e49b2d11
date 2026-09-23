import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgeCheck,
  ChevronDown,
  CircleDollarSign,
  Download,
  Headphones,
  LockKeyhole,
  MessageCircleQuestion,
  PackageCheck,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  UserRoundCheck,
  WalletCards,
} from "lucide-react";
import { PublicChrome } from "@/components/oventric/PublicChrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import helpImage from "@/assets/public-pages/help-editorial.jpg";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "Frequently Asked Questions — Oventric" },
      {
        name: "description",
        content:
          "Clear answers about Oventric accounts, digital purchases, selling, delivery, creators, wallet activity, cashback and payouts.",
      },
      { property: "og:title", content: "Oventric FAQ — Clear answers for buyers, sellers and creators" },
      {
        property: "og:description",
        content:
          "Find practical answers about accounts, protected digital orders, downloads, selling, creators, wallet activity and support.",
      },
      { property: "og:url", content: "https://oventric.com/faq" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://oventric.com/faq" }],
  }),
  component: FaqPage,
});

type FaqTone = "blue" | "violet" | "green" | "gold" | "coral";

type FaqGroup = {
  id: string;
  title: string;
  description: string;
  icon: typeof UserRoundCheck;
  tone: FaqTone;
  items: Array<{ q: string; a: string }>;
};

const toneStyles: Record<FaqTone, { soft: string; text: string; border: string }> = {
  blue: { soft: "bg-newsfeed-blue-soft", text: "text-newsfeed-blue", border: "border-newsfeed-blue" },
  violet: { soft: "bg-newsfeed-violet-soft", text: "text-newsfeed-violet", border: "border-newsfeed-violet" },
  green: { soft: "bg-newsfeed-green-soft", text: "text-newsfeed-green", border: "border-newsfeed-green" },
  gold: { soft: "bg-newsfeed-gold-soft", text: "text-newsfeed-gold", border: "border-newsfeed-gold" },
  coral: { soft: "bg-newsfeed-coral-soft", text: "text-newsfeed-coral", border: "border-newsfeed-coral" },
};

const faqGroups: FaqGroup[] = [
  {
    id: "account",
    title: "Account & security",
    description: "Signing in, profile setup, verification and account control.",
    icon: UserRoundCheck,
    tone: "blue",
    items: [
      {
        q: "How do I create an Oventric account?",
        a: "Choose Connect Account, continue with Google or email, then complete the onboarding steps. Your country helps Oventric display money in your home currency.",
      },
      {
        q: "Why does Oventric ask sellers for a WhatsApp number?",
        a: "A reachable WhatsApp number with country code is required before selling so the Oventric team can contact a seller when an order needs delivery support. A second phone number is optional.",
      },
      {
        q: "How do I keep my account secure?",
        a: "Keep sign-in codes and passwords private, use accurate account details, and review unfamiliar activity promptly. Oventric support will never ask you to share a private sign-in code in a report or order conversation.",
      },
      {
        q: "How do I delete my account?",
        a: "Open Settings & Privacy and use the account deletion option in the danger zone. A deleted account can be restored by signing in during the 30-day recovery period; after that, deletion becomes permanent.",
      },
    ],
  },
  {
    id: "buying",
    title: "Buying & downloads",
    description: "Checkout, protected orders, delivery and digital files.",
    icon: ShoppingBag,
    tone: "violet",
    items: [
      {
        q: "What can I buy on Oventric?",
        a: "Oventric’s marketplace is for digital products and downloadable or licensed assets. Physical goods are not supported and cannot be published through the product flow.",
      },
      {
        q: "How does a protected marketplace order work?",
        a: "Your payment creates a recorded order. The seller fulfils it through instant download or manual digital delivery, and the order record tracks payment, messages, delivery and settlement activity for both sides.",
      },
      {
        q: "Where do I find a purchased download?",
        a: "Open your purchase or order record. When the product uses instant delivery, the available file is linked there. For manual delivery, use the order conversation and wait for the seller’s recorded delivery update.",
      },
      {
        q: "When can I rate or review a purchase?",
        a: "You can review an eligible paid purchase after it reaches a completed delivery state. Your real rating and comment appear in the product review section, and the seller can reply there.",
      },
    ],
  },
  {
    id: "selling",
    title: "Selling & delivery",
    description: "Publishing, fulfilment, earnings and seller responsibilities.",
    icon: Store,
    tone: "green",
    items: [
      {
        q: "How do I publish a digital product?",
        a: "Open the Marketplace and use the floating plus button. Complete seller contact setup if prompted, add accurate product details, choose instant or manual digital delivery, and publish when the listing is ready.",
      },
      {
        q: "Will an unfinished product listing be saved?",
        a: "Yes. An unfinished listing is saved privately on the seller’s current device and can be restored when the product form is opened again. It clears after a successful publication or when the seller chooses Discard.",
      },
      {
        q: "How are marketplace sale proceeds divided?",
        a: "For a standard marketplace sale, 80% is allocated to the seller and 20% to Oventric. Any cashback offered by the seller is funded from the seller’s share, not added to the buyer’s price.",
      },
      {
        q: "How should I deliver a manually fulfilled product?",
        a: "Use the relevant order conversation and delivery action so the buyer and Oventric have a clear record. Do not move order fulfilment into an unrelated chat or post comment.",
      },
    ],
  },
  {
    id: "wallet",
    title: "Wallet, cashback & payouts",
    description: "Home currency, transaction states, rewards and withdrawals.",
    icon: WalletCards,
    tone: "gold",
    items: [
      {
        q: "Which currency does Oventric use for me?",
        a: "Prices, earnings, wallet activity, funding and withdrawals are shown and transacted in your home currency. You can discover products from every seller; Oventric converts their published price for you using the live exchange-rate model.",
      },
      {
        q: "What is cashback?",
        a: "A seller can offer cashback of up to 50% on a digital product. When an eligible purchase settles, that reward is credited in the buyer’s home currency. Cashback is seller-funded and is not earned when a coupon is used.",
      },
      {
        q: "What do Pending, Processing and Paid mean for a withdrawal?",
        a: "Pending means the request still needs approval. Processing means it has been approved but payment is not yet complete. Paid means the payout has been completed and recorded as such.",
      },
      {
        q: "Where can I track money movement?",
        a: "Open Wallet and review Recent transactions or the full transaction history. Each entry shows the latest recorded status for payments, settlements, cashback, refunds and withdrawals.",
      },
    ],
  },
  {
    id: "creators",
    title: "Creators & community",
    description: "Showcases, assets, profiles, posts and conversations.",
    icon: Sparkles,
    tone: "coral",
    items: [
      {
        q: "What belongs in the Creators section?",
        a: "Creators is a skills, services and work-showcase space. The image or video you upload is the visible media, while a separate file or external destination is what people receive when they choose Download or Buy.",
      },
      {
        q: "Can creator assets appear in the regular marketplace?",
        a: "No. Assets attached to creator showcases stay in the Creators experience and do not appear in marketplace, search, new-arrival or storefront product discovery.",
      },
      {
        q: "How do free and paid creator assets work?",
        a: "A free asset downloads immediately. A paid creator asset uses the normal protected checkout and the same 80/20 marketplace settlement rules. Views, downloads and sales shown on posts are real recorded counts.",
      },
      {
        q: "How can people explore a creator’s work and links?",
        a: "A creator can add portfolio, job, WhatsApp, Telegram, Discord, YouTube, Vimeo, TikTok, Instagram, Behance, Dribbble, GitHub and other professional links to their profile and showcase journey.",
      },
    ],
  },
];

function FaqPage() {
  const [query, setQuery] = useState("");
  const [activeGroup, setActiveGroup] = useState("all");
  const [openQuestion, setOpenQuestion] = useState("account-0");

  const visibleGroups = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return faqGroups
      .filter((group) => activeGroup === "all" || group.id === activeGroup)
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) =>
            !normalizedQuery ||
            item.q.toLowerCase().includes(normalizedQuery) ||
            item.a.toLowerCase().includes(normalizedQuery),
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [activeGroup, query]);

  const answerCount = visibleGroups.reduce((total, group) => total + group.items.length, 0);

  return (
    <PublicChrome lightDesktop>
      <div className="help-editorial bg-newsfeed-canvas text-newsfeed-ink">
        <section className="relative overflow-hidden border-b border-newsfeed-line bg-newsfeed-surface">
          <div className="mx-auto grid min-h-[520px] max-w-7xl lg:grid-cols-[1.05fr_0.95fr]">
            <div className="flex flex-col justify-center px-5 py-16 sm:px-8 lg:px-10 lg:py-24">
              <div className="mb-7 h-1 w-36 rounded-full about-spectrum" aria-hidden="true" />
              <p className="font-wallet-display text-sm font-bold text-newsfeed-coral">COMMON QUESTIONS</p>
              <h1 className="mt-4 max-w-2xl font-wallet-display text-3xl font-extrabold leading-[1.08] sm:text-4xl lg:text-6xl">
                Answers that get you moving again.
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-newsfeed-muted sm:text-lg sm:leading-8">
                Search practical answers for your account, digital orders, selling, creator showcases, wallet activity and support.
              </p>
              <div className="relative mt-8 max-w-xl">
                <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-newsfeed-muted" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search questions or topics"
                  aria-label="Search frequently asked questions"
                  className="h-14 rounded-[10px] border-newsfeed-line bg-newsfeed-surface pl-12 pr-4 text-base shadow-newsfeed-panel focus-visible:border-newsfeed-violet focus-visible:ring-newsfeed-violet/20"
                />
              </div>
              <div className="mt-5 flex items-center gap-3 text-sm text-newsfeed-muted">
                <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-newsfeed-green-soft text-newsfeed-green"><BadgeCheck className="size-4" /></span>
                <span>Guidance for Oventric’s current digital marketplace and creator experience.</span>
              </div>
            </div>
            <div className="relative min-h-[340px] overflow-hidden lg:min-h-full">
              <img
                src={helpImage}
                alt="Organised Oventric help workspace with support and security tools"
                width={1200}
                height={900}
                fetchPriority="high"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="help-image-shade absolute inset-0" aria-hidden="true" />
              <div className="absolute bottom-5 left-5 right-5 rounded-[10px] border border-newsfeed-surface/70 bg-newsfeed-surface/90 p-4 shadow-newsfeed-panel backdrop-blur-sm sm:bottom-8 sm:left-8 sm:right-auto sm:max-w-xs">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-newsfeed-violet-soft text-newsfeed-violet"><MessageCircleQuestion className="size-5" /></span>
                  <div>
                    <p className="font-wallet-display text-sm font-bold">Short question. Clear next step.</p>
                    <p className="mt-1 text-xs leading-5 text-newsfeed-muted">Start here, then contact support if your situation needs review.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="about-spectrum h-1 w-full" aria-hidden="true" />

        <section className="mx-auto max-w-7xl px-5 py-14 sm:px-8 lg:px-10 lg:py-20">
          <div className="max-w-3xl">
            <p className="font-wallet-display text-sm font-bold text-newsfeed-blue">BROWSE BY TOPIC</p>
            <h2 className="mt-4 font-wallet-display text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">Choose the part of Oventric you’re using.</h2>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {faqGroups.map((group) => {
              const tone = toneStyles[group.tone];
              const active = activeGroup === group.id;
              return (
                <Button
                  key={group.id}
                  type="button"
                  variant="outline"
                  onClick={() => setActiveGroup(active ? "all" : group.id)}
                  className={`h-auto min-h-28 justify-start rounded-[10px] border-newsfeed-line border-t-2 ${tone.border} p-4 text-left shadow-none ${active ? tone.soft : "bg-newsfeed-surface"}`}
                >
                  <span className={`grid size-10 shrink-0 place-items-center rounded-[10px] ${tone.soft} ${tone.text}`}><group.icon className="size-5" /></span>
                  <span className="min-w-0 whitespace-normal">
                    <span className="block font-wallet-display text-sm font-bold text-newsfeed-ink">{group.title}</span>
                    <span className="mt-1 block text-xs font-normal leading-5 text-newsfeed-muted">{group.items.length} answers</span>
                  </span>
                </Button>
              );
            })}
          </div>
          {(activeGroup !== "all" || query) && (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-newsfeed-line bg-newsfeed-surface px-4 py-3">
              <p className="text-sm text-newsfeed-muted">Showing {answerCount} {answerCount === 1 ? "answer" : "answers"}</p>
              <Button type="button" variant="ghost" size="sm" onClick={() => { setActiveGroup("all"); setQuery(""); }} className="text-newsfeed-violet hover:bg-newsfeed-violet-soft hover:text-newsfeed-violet">
                Clear filters
              </Button>
            </div>
          )}
        </section>

        <section className="border-y border-newsfeed-line bg-newsfeed-surface py-14 lg:py-20">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 sm:px-8 lg:grid-cols-[0.7fr_1.3fr] lg:gap-16 lg:px-10">
            <div className="lg:sticky lg:top-24 lg:self-start">
              <span className="grid size-14 place-items-center rounded-[10px] bg-newsfeed-gold-soft text-newsfeed-gold"><CircleDollarSign className="size-7" /></span>
              <p className="mt-7 font-wallet-display text-sm font-bold text-newsfeed-gold">QUICK ANSWERS</p>
              <h2 className="mt-4 font-wallet-display text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">The details people ask about most.</h2>
              <p className="mt-5 text-base leading-7 text-newsfeed-muted">Open a question for a concise answer. Use the search above to find a word or feature across every topic.</p>
            </div>

            <div className="space-y-8">
              {visibleGroups.map((group) => {
                const tone = toneStyles[group.tone];
                return (
                  <section key={group.id} aria-labelledby={`${group.id}-title`}>
                    <div className="mb-4 flex items-center gap-3">
                      <span className={`grid size-11 shrink-0 place-items-center rounded-[10px] ${tone.soft} ${tone.text}`}><group.icon className="size-5" /></span>
                      <div>
                        <h3 id={`${group.id}-title`} className="font-wallet-display text-lg font-bold">{group.title}</h3>
                        <p className="mt-1 text-xs leading-5 text-newsfeed-muted">{group.description}</p>
                      </div>
                    </div>
                    <div className="overflow-hidden rounded-[10px] border border-newsfeed-line bg-newsfeed-canvas">
                      {group.items.map((item, index) => {
                        const key = `${group.id}-${faqGroups.find((candidate) => candidate.id === group.id)?.items.indexOf(item) ?? index}`;
                        const open = openQuestion === key;
                        return (
                          <div key={item.q} className="border-b border-newsfeed-line last:border-b-0">
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => setOpenQuestion(open ? "" : key)}
                              aria-expanded={open}
                              className="h-auto min-h-16 w-full justify-between rounded-none px-4 py-4 text-left hover:bg-newsfeed-surface sm:px-5"
                            >
                              <span className="min-w-0 whitespace-normal pr-4 font-wallet-display text-sm font-bold leading-6 text-newsfeed-ink sm:text-base">{item.q}</span>
                              <ChevronDown className={`size-5 shrink-0 ${tone.text} transition-transform ${open ? "rotate-180" : ""}`} />
                            </Button>
                            {open && (
                              <div className="px-4 pb-5 sm:px-5">
                                <p className="max-w-3xl border-l-2 border-newsfeed-line pl-4 text-sm leading-7 text-newsfeed-muted">{item.a}</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}

              {visibleGroups.length === 0 && (
                <div className="rounded-[10px] border border-newsfeed-line bg-newsfeed-canvas p-8 text-center sm:p-12">
                  <span className="mx-auto grid size-12 place-items-center rounded-[10px] bg-newsfeed-coral-soft text-newsfeed-coral"><Search className="size-5" /></span>
                  <h3 className="mt-5 font-wallet-display text-lg font-bold">No matching answer yet</h3>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-newsfeed-muted">Try a shorter search, browse all topics, or tell support what happened.</p>
                  <Button type="button" variant="outline" className="mt-5" onClick={() => { setQuery(""); setActiveGroup("all"); }}>Show all questions</Button>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-14 sm:px-8 lg:px-10 lg:py-20">
          <div className="grid gap-px overflow-hidden rounded-[10px] border border-newsfeed-line bg-newsfeed-line sm:grid-cols-3">
            {[
              [ShieldCheck, "Protected records", "Keep order, payment and delivery details inside the relevant Oventric journey.", "text-newsfeed-blue", "bg-newsfeed-blue-soft"],
              [PackageCheck, "Digital delivery", "Use the purchase record for available downloads and the order conversation for manual delivery.", "text-newsfeed-green", "bg-newsfeed-green-soft"],
              [LockKeyhole, "Private information", "Never include passwords, sign-in codes or unrelated personal information in a support report.", "text-newsfeed-coral", "bg-newsfeed-coral-soft"],
            ].map(([Icon, title, body, text, soft]) => {
              const ItemIcon = Icon as typeof ShieldCheck;
              return (
                <article key={title as string} className="bg-newsfeed-surface p-6 sm:p-7">
                  <span className={`grid size-11 place-items-center rounded-[10px] ${soft as string} ${text as string}`}><ItemIcon className="size-5" /></span>
                  <h3 className="mt-5 font-wallet-display text-base font-bold">{title as string}</h3>
                  <p className="mt-2 text-sm leading-6 text-newsfeed-muted">{body as string}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="help-cta relative overflow-hidden border-t border-newsfeed-line py-16 lg:py-24">
          <div className="relative mx-auto max-w-4xl px-5 text-center sm:px-8">
            <span className="mx-auto grid size-14 place-items-center rounded-[10px] bg-newsfeed-coral-soft text-newsfeed-coral"><Headphones className="size-7" /></span>
            <p className="mt-6 font-wallet-display text-sm font-bold text-newsfeed-coral">NEED A CLOSER LOOK?</p>
            <h2 className="mt-4 font-wallet-display text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">Your question may need the full context.</h2>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-newsfeed-muted sm:text-lg">Read the Help Center for step-by-step guidance, or send support the relevant order or transaction details.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg"><Link to="/help">Open Help Center <ArrowRight /></Link></Button>
              <Button asChild size="lg" variant="outline" className="border-newsfeed-line bg-newsfeed-surface text-newsfeed-ink hover:bg-newsfeed-blue-soft hover:text-newsfeed-blue"><Link to="/report-problem">Contact support</Link></Button>
            </div>
          </div>
        </section>
      </div>
    </PublicChrome>
  );
}