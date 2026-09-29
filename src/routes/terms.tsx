import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Ban,
  BookOpenCheck,
  CircleDollarSign,
  FileCheck2,
  Gavel,
  Headphones,
  KeyRound,
  Landmark,
  PackageCheck,
  ReceiptText,
  Scale,
  ShieldCheck,
  Sparkles,
  Store,
  UserRoundCheck,
  WalletCards,
} from "lucide-react";
import { PublicChrome } from "@/components/oventric/PublicChrome";
import { Button } from "@/components/ui/button";
import { useIsAppShell } from "@/hooks/use-launch-context";
import legalImage from "@/assets/public-pages/legal-editorial.jpg";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Use — Clear rules for using Oventric" },
      {
        name: "description",
        content:
          "Read the rules for Oventric accounts, digital products, creator content, checkout, escrow, delivery, refunds, wallets, payouts and community conduct.",
      },
      { property: "og:title", content: "Oventric Terms of Use — Clear rules for everyone" },
      {
        property: "og:description",
        content:
          "A plain-language guide to accounts, digital commerce, seller responsibilities, protected transactions and acceptable use on Oventric.",
      },
      { property: "og:url", content: "https://oventric.com/terms" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://oventric.com/terms" }],
  }),
  component: TermsPage,
});

const overview = [
  {
    icon: UserRoundCheck,
    title: "Use one secure account",
    body: "Keep your information accurate, protect your sign-in details and take responsibility for activity completed through your account.",
    tone: "bg-newsfeed-blue-soft text-newsfeed-blue",
    border: "border-newsfeed-blue",
  },
  {
    icon: PackageCheck,
    title: "Digital products only",
    body: "Oventric’s marketplace supports digital goods. Physical products and listings that require physical shipment are not permitted.",
    tone: "bg-newsfeed-violet-soft text-newsfeed-violet",
    border: "border-newsfeed-violet",
  },
  {
    icon: ShieldCheck,
    title: "Keep transactions on Oventric",
    body: "Checkout, delivery evidence, messages and transaction records help protect both sides when an order needs review.",
    tone: "bg-newsfeed-green-soft text-newsfeed-green",
    border: "border-newsfeed-green",
  },
  {
    icon: BadgeCheck,
    title: "Publish what you can legally offer",
    body: "Sellers and creators must own their work or have the rights and permissions required to publish and distribute it.",
    tone: "bg-newsfeed-gold-soft text-newsfeed-gold",
    border: "border-newsfeed-gold",
  },
];

const sectionLinks = [
  ["01", "Agreement and eligibility", "agreement"],
  ["02", "Accounts and verification", "accounts"],
  ["03", "Content and intellectual property", "content"],
  ["04", "Digital marketplace rules", "marketplace"],
  ["05", "Prices, checkout and cashback", "checkout"],
  ["06", "Escrow, delivery and refunds", "orders"],
  ["07", "Wallets and payouts", "wallets"],
  ["08", "Community conduct", "conduct"],
  ["09", "Enforcement and account closure", "enforcement"],
  ["10", "Service terms and liability", "service"],
  ["11", "Changes, law and support", "changes"],
] as const;

const commercialSteps = [
  {
    icon: ReceiptText,
    title: "A buyer completes checkout",
    body: "The amount, currency, item and available payment method are shown before confirmation. Oventric records the resulting transaction.",
    tone: "bg-newsfeed-blue-soft text-newsfeed-blue",
  },
  {
    icon: ShieldCheck,
    title: "Funds follow the order status",
    body: "Where escrow applies, the seller’s proceeds remain linked to the order until delivery is confirmed or the order is otherwise resolved.",
    tone: "bg-newsfeed-violet-soft text-newsfeed-violet",
  },
  {
    icon: CircleDollarSign,
    title: "The recorded split is applied",
    body: "For completed marketplace sales, the seller receives 80% and Oventric receives 20%. Any offered cashback is funded from the seller’s 80% share.",
    tone: "bg-newsfeed-green-soft text-newsfeed-green",
  },
  {
    icon: WalletCards,
    title: "The ledger keeps the record",
    body: "Settlements, refunds, cashback, reversals and withdrawals are reflected through Oventric’s transaction and wallet records.",
    tone: "bg-newsfeed-gold-soft text-newsfeed-gold",
  },
];

type TermsSectionData = {
  id: string;
  number: string;
  icon: typeof Scale;
  title: string;
  tone: string;
  paragraphs: ReactNode[];
};

const termsSections: TermsSectionData[] = [
  {
    id: "agreement",
    number: "01",
    icon: FileCheck2,
    title: "Agreement and eligibility",
    tone: "bg-newsfeed-blue-soft text-newsfeed-blue",
    paragraphs: [
      <>By creating an account, accessing Oventric or using any Oventric service, you agree to these Terms and the <Link to="/privacy" className="font-bold text-newsfeed-blue hover:underline">Privacy Policy</Link>. If you do not agree, do not use the platform.</>,
      "You must be legally able to enter this agreement. If you use Oventric for a business or organisation, you confirm that you have authority to accept these Terms for it. You are responsible for following laws and regulations that apply to you, your location and what you publish or sell.",
    ],
  },
  {
    id: "accounts",
    number: "02",
    icon: KeyRound,
    title: "Accounts, information and verification",
    tone: "bg-newsfeed-violet-soft text-newsfeed-violet",
    paragraphs: [
      "Provide accurate, current information and keep it updated. You may not impersonate another person, create an account using information you have no right to use, sell or transfer your account, or use another person’s account without permission.",
      "Keep your password and access methods confidential. Tell Oventric promptly if you believe your account has been compromised. You remain responsible for activity completed through your account unless applicable law requires otherwise.",
      "Oventric may request identity, business, contact or payout verification where needed for security, transaction review, legal compliance or access to particular features. Failure to provide required information may limit those features.",
    ],
  },
  {
    id: "content",
    number: "03",
    icon: Sparkles,
    title: "Content and intellectual property",
    tone: "bg-newsfeed-green-soft text-newsfeed-green",
    paragraphs: [
      "You keep ownership of content you create and publish. You give Oventric a non-exclusive, worldwide, royalty-free licence to host, store, reproduce, display, format and distribute that content only as needed to operate, promote and improve Oventric. This licence ends when the content is deleted, except for retained records, cached copies and content already shared as permitted by law.",
      "You must own your posts, product files, previews, artwork, videos, names and links, or have permission to use them. Do not upload material that infringes copyright, trademarks, privacy, publicity or other rights.",
      "Reviews and ratings must reflect genuine experiences. Sellers may reply to reviews, but neither side may manipulate ratings, threaten reviewers or offer deceptive incentives for a particular rating.",
    ],
  },
  {
    id: "marketplace",
    number: "04",
    icon: Store,
    title: "Digital marketplace rules",
    tone: "bg-newsfeed-gold-soft text-newsfeed-gold",
    paragraphs: [
      "Oventric’s marketplace is for digital products. Physical goods, physical shipment requirements and listings presented as digital items to bypass this restriction are prohibited.",
      "Sellers are responsible for accurate titles, descriptions, previews, prices, licence terms, compatibility details and delivery instructions. A seller must have the right to sell or license each item and must deliver the purchased file, access or agreed digital outcome.",
      "Creator showcases may include free or paid downloadable assets. Uploaded showcase media is for presentation; the designated file or external destination is what the buyer or downloader receives. Free assets may be downloaded immediately, while paid assets use the normal checkout flow.",
    ],
  },
  {
    id: "checkout",
    number: "05",
    icon: CircleDollarSign,
    title: "Prices, checkout, fees and cashback",
    tone: "bg-newsfeed-coral-soft text-newsfeed-coral",
    paragraphs: [
      "Prices and transaction totals shown at checkout are the amounts used for the order, subject to any clearly displayed fees, currency conversion or payment-provider requirements. Oventric’s records are authoritative for wallet balances, order status, settlements, cashback and refunds.",
      "For completed marketplace sales, 80% of the sale is allocated to the seller and 20% to Oventric. If a seller offers cashback, that cashback is funded from the seller’s 80% share rather than from Oventric’s share.",
      "Available payment methods can vary by country, currency, account status and provider availability. You authorise the relevant payment processing when you confirm checkout and agree not to misuse chargebacks or payment disputes.",
    ],
  },
  {
    id: "orders",
    number: "06",
    icon: ShieldCheck,
    title: "Escrow, delivery, refunds and disputes",
    tone: "bg-newsfeed-blue-soft text-newsfeed-blue",
    paragraphs: [
      "Where escrow applies, seller proceeds are held against the order until the buyer confirms delivery, the applicable confirmation period ends, or Oventric resolves the order based on available records.",
      "Buyers should inspect delivered digital items promptly and use the order conversation to raise a genuine delivery problem. Sellers should reply, provide the promised item and keep relevant delivery evidence inside Oventric.",
      "Refunds are not automatic simply because a digital item has been accessed or a buyer changes their mind. Oventric may approve, reject or adjust a refund or release after reviewing the listing, order status, delivery evidence, messages, payment status and applicable law. Payment reversals can also result in corresponding wallet adjustments.",
    ],
  },
  {
    id: "wallets",
    number: "07",
    icon: WalletCards,
    title: "Wallet records and payouts",
    tone: "bg-newsfeed-violet-soft text-newsfeed-violet",
    paragraphs: [
      "The Oventric wallet records eligible earnings, cashback, refunds, adjustments and withdrawals. It is not a bank account and does not promise interest or investment returns.",
      "Withdrawals may require identity review, sufficient available balance, accurate payout information, fraud checks and completion of pending obligations. A withdrawal marked approved may remain processing until payment is completed. Provider delays, banking schedules, compliance checks and incorrect destination details may affect timing.",
      "Oventric may correct duplicate, reversed, fraudulent or erroneous entries and may temporarily restrict funds reasonably connected to a dispute, refund, chargeback, investigation or legal requirement.",
    ],
  },
  {
    id: "conduct",
    number: "08",
    icon: Ban,
    title: "Community conduct and prohibited activity",
    tone: "bg-newsfeed-coral-soft text-newsfeed-coral",
    paragraphs: [
      "Do not use Oventric for fraud, deception, harassment, hate, threats, exploitation, illegal activity, intellectual-property infringement, malware, credential theft, spam, fake engagement, manipulated reviews, unauthorised scraping or attempts to disrupt the platform.",
      "Do not sell prohibited physical goods, unlawful material, stolen accounts, malicious files, deceptive access, content that violates another person’s rights, or any item you cannot legally provide. Do not move a protected transaction off-platform to avoid fees, records or safety controls.",
      "You may report suspected abuse through Oventric’s reporting tools. Reports must be made honestly and must not be used to harass, intimidate or knowingly submit false allegations.",
    ],
  },
  {
    id: "enforcement",
    number: "09",
    icon: Gavel,
    title: "Enforcement, suspension and account closure",
    tone: "bg-newsfeed-gold-soft text-newsfeed-gold",
    paragraphs: [
      "Oventric may remove content, limit features, hold related funds, cancel listings, reverse improper activity, suspend access or close an account when reasonably necessary to protect people, enforce these Terms, comply with law or respond to platform risk.",
      "The action taken may depend on seriousness, repetition, available evidence and immediate risk. Where appropriate, Oventric may notify you and provide a way to ask for review, but urgent protective action may happen first.",
      "You may request account deletion through the available settings. A recovery period may apply before permanent deletion. Transaction, security, dispute and legal records may be retained where reasonably required, as explained in the Privacy Policy.",
    ],
  },
  {
    id: "service",
    number: "10",
    icon: Landmark,
    title: "Service availability, disclaimers and liability",
    tone: "bg-newsfeed-green-soft text-newsfeed-green",
    paragraphs: [
      "Oventric may update, improve, restrict or discontinue features. The service can occasionally be unavailable because of maintenance, security events, network conditions, payment providers or circumstances outside Oventric’s reasonable control.",
      "To the fullest extent permitted by law, Oventric is provided on an “as available” basis without guarantees that every listing, user statement, external link or third-party service will always be accurate, available or suitable for a particular purpose.",
      "To the fullest extent permitted by law, Oventric is not responsible for indirect, incidental, special or consequential loss. Nothing in these Terms excludes rights or liability that cannot legally be excluded. You are responsible for claims and reasonable costs caused by your unlawful content, infringement or material breach of these Terms.",
    ],
  },
  {
    id: "changes",
    number: "11",
    icon: BookOpenCheck,
    title: "Changes, governing law and support",
    tone: "bg-newsfeed-blue-soft text-newsfeed-blue",
    paragraphs: [
      "Oventric may update these Terms as the service, law or operating requirements change. Material updates may be announced through the platform or another appropriate channel. Continued use after an updated version takes effect means you accept the revised Terms.",
      "These Terms are governed by the laws of the Federal Republic of Nigeria, without limiting consumer rights that must apply in your location. Before starting formal proceedings, you and Oventric should try in good faith to resolve the issue through support.",
      "If part of these Terms is unenforceable, the remaining terms continue to apply. A delay in enforcing a right does not waive it. These Terms, together with referenced policies and transaction-specific terms shown to you, form the agreement governing your use of Oventric.",
    ],
  },
];

function TermsPage() {
  const isAppShell = useIsAppShell();
  if (isAppShell) return <AppTermsPage />;

  return (
    <PublicChrome lightDesktop>
      <div className="help-editorial bg-newsfeed-canvas text-newsfeed-ink">
        <section className="relative overflow-hidden border-b border-newsfeed-line bg-newsfeed-surface">
          <div className="mx-auto grid min-h-[540px] max-w-7xl lg:grid-cols-[1.02fr_0.98fr]">
            <div className="flex flex-col justify-center px-5 py-16 sm:px-8 lg:px-10 lg:py-24">
              <div className="mb-7 h-1 w-36 rounded-full about-spectrum" aria-hidden="true" />
              <p className="font-wallet-display text-sm font-bold text-newsfeed-coral">TERMS & RESPONSIBILITIES</p>
              <h1 className="mt-4 max-w-2xl font-wallet-display text-3xl font-extrabold leading-[1.08] sm:text-4xl lg:text-6xl">
                Clear rules for building, buying and creating together.
              </h1>
              <p className="mt-6 max-w-xl font-wallet-body text-base leading-7 text-newsfeed-muted sm:text-lg">
                These Terms explain the agreement between you and Oventric, the standards that apply across the community, and how digital transactions are handled.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild className="h-11 rounded-[10px] bg-newsfeed-violet px-5 font-wallet-display font-bold text-primary-foreground hover:bg-newsfeed-violet/90">
                  <a href="#terms-sections">Read the terms <ArrowRight className="size-4" /></a>
                </Button>
                <Button asChild variant="outline" className="h-11 rounded-[10px] border-newsfeed-line bg-newsfeed-surface px-5 font-wallet-display font-bold text-newsfeed-ink hover:bg-newsfeed-blue-soft hover:text-newsfeed-blue">
                  <Link to="/privacy">Read Privacy</Link>
                </Button>
              </div>
              <p className="mt-7 font-wallet-body text-xs font-semibold text-newsfeed-muted">
                Effective and last updated: September 23, 2026
              </p>
            </div>

            <div className="relative min-h-[360px] overflow-hidden lg:min-h-full">
              <img
                src={legalImage}
                alt="Legal documents, a protective shield and balanced scales"
                className="absolute inset-0 size-full object-cover"
              />
              <div className="help-image-shade absolute inset-0" aria-hidden="true" />
              <div className="absolute inset-x-5 bottom-5 rounded-[10px] border border-newsfeed-line bg-newsfeed-surface/95 p-5 shadow-sm backdrop-blur-sm sm:inset-x-8 sm:bottom-8 sm:p-6">
                <div className="flex items-start gap-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-[10px] bg-newsfeed-coral-soft text-newsfeed-coral">
                    <Scale className="size-5" />
                  </span>
                  <div>
                    <p className="font-wallet-display text-sm font-extrabold text-newsfeed-ink">The agreement in one sentence</p>
                    <p className="mt-1 font-wallet-body text-sm leading-6 text-newsfeed-muted">
                      Use Oventric honestly, respect other people’s rights, deliver what you promise, and keep protected activity on the platform.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-newsfeed-line bg-newsfeed-surface px-5 py-14 sm:px-8 lg:py-20">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-2xl">
              <p className="font-wallet-display text-sm font-bold text-newsfeed-blue">THE SHORT VERSION</p>
              <h2 className="mt-3 font-wallet-display text-3xl font-extrabold sm:text-4xl lg:text-5xl">Start with the essentials.</h2>
              <p className="mt-4 font-wallet-body leading-7 text-newsfeed-muted">
                These summaries make the main responsibilities easier to find. The complete sections below govern your use of Oventric.
              </p>
            </div>
            <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {overview.map(({ icon: Icon, title, body, tone, border }) => (
                <article key={title} className={`rounded-[10px] border border-newsfeed-line border-t-4 ${border} bg-newsfeed-surface p-5`}>
                  <span className={`grid size-11 place-items-center rounded-[10px] ${tone}`}><Icon className="size-5" /></span>
                  <h3 className="mt-5 font-wallet-display text-base font-extrabold">{title}</h3>
                  <p className="mt-2 font-wallet-body text-sm leading-6 text-newsfeed-muted">{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="terms-sections" className="px-5 py-14 sm:px-8 lg:py-20">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-16">
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <p className="font-wallet-display text-sm font-bold text-newsfeed-violet">IN THIS AGREEMENT</p>
              <h2 className="mt-3 font-wallet-display text-2xl font-extrabold sm:text-3xl">Find a section quickly.</h2>
              <nav aria-label="Terms sections" className="mt-6 overflow-hidden rounded-[10px] border border-newsfeed-line bg-newsfeed-surface">
                {sectionLinks.map(([number, label, id]) => (
                  <a key={id} href={`#${id}`} className="flex items-center gap-3 border-b border-newsfeed-line px-4 py-3 font-wallet-body text-sm font-semibold text-newsfeed-muted transition-colors last:border-b-0 hover:bg-newsfeed-violet-soft hover:text-newsfeed-violet">
                    <span className="font-wallet-display text-xs font-extrabold text-newsfeed-violet">{number}</span>
                    <span>{label}</span>
                  </a>
                ))}
              </nav>
            </aside>

            <div className="space-y-5">
              {termsSections.map((section) => (
                <div key={section.id} className="contents">
                  <TermsSection {...section} />
                  {section.id === "checkout" && (
                    <div className="rounded-[10px] border border-newsfeed-line bg-newsfeed-surface p-5 sm:p-7">
                      <p className="font-wallet-display text-sm font-bold text-newsfeed-green">HOW A MARKETPLACE PAYMENT MOVES</p>
                      <div className="mt-6 grid gap-5 sm:grid-cols-2">
                        {commercialSteps.map(({ icon: Icon, title, body, tone }, index) => (
                          <div key={title} className="flex gap-4">
                            <span className={`grid size-10 shrink-0 place-items-center rounded-[10px] ${tone}`}><Icon className="size-5" /></span>
                            <div>
                              <p className="font-wallet-display text-xs font-extrabold text-newsfeed-muted">STEP {index + 1}</p>
                              <h3 className="mt-1 font-wallet-display text-sm font-extrabold">{title}</h3>
                              <p className="mt-2 font-wallet-body text-sm leading-6 text-newsfeed-muted">{body}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-newsfeed-line bg-newsfeed-surface px-5 py-14 sm:px-8 lg:py-20">
          <div className="help-cta mx-auto grid max-w-7xl gap-7 rounded-[10px] border border-newsfeed-line p-6 sm:p-9 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-[10px] bg-newsfeed-coral-soft text-newsfeed-coral"><Headphones className="size-5" /></span>
                <p className="font-wallet-display text-sm font-bold text-newsfeed-coral">NEED CLARITY?</p>
              </div>
              <h2 className="mt-4 font-wallet-display text-2xl font-extrabold sm:text-3xl">Ask before you act.</h2>
              <p className="mt-3 max-w-2xl font-wallet-body leading-7 text-newsfeed-muted">
                Visit the Help Center for practical guidance, or report a specific account, order or policy concern with the relevant details.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild variant="outline" className="h-11 rounded-[10px] border-newsfeed-line bg-newsfeed-surface px-5 font-wallet-display font-bold text-newsfeed-ink hover:bg-newsfeed-blue-soft hover:text-newsfeed-blue">
                <Link to="/help">Visit Help Center</Link>
              </Button>
              <Button asChild className="h-11 rounded-[10px] bg-newsfeed-coral px-5 font-wallet-display font-bold text-primary-foreground hover:bg-newsfeed-coral/90">
                <Link to="/report-problem">Report a problem <ArrowRight className="size-4" /></Link>
              </Button>
            </div>
          </div>
          <div className="mx-auto mt-5 flex max-w-7xl items-start gap-2 font-wallet-body text-xs leading-5 text-newsfeed-muted">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-newsfeed-gold" />
            <p>Never include your password, one-time code or full payment credentials in a support report.</p>
          </div>
        </section>
      </div>
    </PublicChrome>
  );
}

type TermsSectionProps = {
  id: string;
  number: string;
  icon: typeof Scale;
  title: string;
  tone: string;
  children: ReactNode;
};

function TermsSection({ id, number, icon: Icon, title, tone, children }: TermsSectionProps) {
  return (
    <article id={id} className="scroll-mt-24 rounded-[10px] border border-newsfeed-line bg-newsfeed-surface p-5 sm:p-7">
      <div className="flex items-start gap-4">
        <span className={`grid size-11 shrink-0 place-items-center rounded-[10px] ${tone}`}><Icon className="size-5" /></span>
        <div>
          <p className="font-wallet-display text-xs font-extrabold text-newsfeed-muted">SECTION {number}</p>
          <h2 className="mt-1 font-wallet-display text-xl font-extrabold sm:text-2xl">{title}</h2>
        </div>
      </div>
      <div className="mt-5 space-y-4 font-wallet-body text-sm leading-7 text-newsfeed-muted sm:text-base">{children}</div>
    </article>
  );
}

function AppTermsPage() {
  const navigate = useNavigate();
  const back = () => {
    if (window.history.length > 1) window.history.back();
    else navigate({ to: "/" });
  };

  return (
    <div className="app-connections fixed inset-0 flex h-[100dvh] flex-col overflow-hidden bg-background text-foreground">
      <header className="app-shell-header z-40 flex h-[calc(3.5rem+env(safe-area-inset-top))] shrink-0 items-center gap-3 border-b border-border bg-background px-4 pt-[env(safe-area-inset-top)]">
        <Button variant="ghost" size="icon" onClick={back} aria-label="Back" className="size-10 shrink-0 text-foreground hover:bg-muted hover:text-foreground"><ArrowLeft className="size-5" /></Button>
        <span className="font-wallet-display text-base font-bold">Terms & responsibilities</span>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-8 [scrollbar-width:none]">
        <div className="mx-auto max-w-2xl font-wallet-body">
          <div className="mb-8 border-b border-border pb-8">
            <span className="inline-flex size-12 items-center justify-center rounded-[10px] bg-primary/15 text-primary"><Scale className="size-6" /></span>
            <p className="mt-5 text-xs font-bold uppercase text-primary">Terms & responsibilities</p>
            <h1 className="mt-2 font-wallet-display text-3xl font-bold leading-tight">Clear rules for building, buying and creating together.</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">These Terms explain the agreement between you and Oventric, the standards that apply across the community, and how digital transactions are handled.</p>
            <p className="mt-4 text-xs font-semibold text-muted-foreground">Effective and last updated: September 23, 2026</p>
          </div>

          <section className="border-b border-border pb-7" aria-labelledby="terms-short-version">
            <h2 id="terms-short-version" className="font-wallet-display text-xl font-bold">The short version</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">These summaries make the main responsibilities easier to find. The complete sections below govern your use of Oventric.</p>
            <div className="mt-5 space-y-4">
              {overview.map(({ icon: Icon, title, body }) => (
                <div key={title} className="flex gap-3"><Icon className="mt-0.5 size-5 shrink-0 text-primary" /><div><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">{body}</p></div></div>
              ))}
            </div>
          </section>

          <section className="border-b border-border py-7" aria-labelledby="terms-how-payment-moves">
            <h2 id="terms-how-payment-moves" className="font-wallet-display text-xl font-bold">How a marketplace payment moves</h2>
            <div className="mt-5 space-y-4">
              {commercialSteps.map(({ icon: Icon, title, body }, index) => (
                <div key={title} className="flex gap-3"><Icon className="mt-0.5 size-5 shrink-0 text-primary" /><div><p className="text-xs font-bold uppercase text-muted-foreground">Step {index + 1}</p><h3 className="mt-0.5 text-sm font-semibold">{title}</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">{body}</p></div></div>
              ))}
            </div>
          </section>

          {termsSections.map((section) => (
            <section key={section.id} className="border-b border-border py-7 last:border-b-0" aria-labelledby={`terms-${section.id}`}>
              <h2 id={`terms-${section.id}`} className="font-wallet-display text-xl font-bold">{section.title}</h2>
              <div className="mt-4 space-y-3">
                {section.paragraphs.map((paragraph, index) => (
                  <p key={index} className="text-sm leading-6 text-muted-foreground">{paragraph}</p>
                ))}
              </div>
            </section>
          ))}

          <section className="py-7" aria-labelledby="terms-support">
            <h2 id="terms-support" className="font-wallet-display text-xl font-bold">Need clarity?</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Visit the Help Center for practical guidance, or report a specific account, order or policy concern. Never include your password, one-time code or full payment credentials in a support report.</p>
            <div className="mt-5 flex flex-wrap gap-3"><Button asChild><Link to="/report-problem">Report a problem <ArrowRight /></Link></Button><Button asChild variant="outline"><Link to="/help">Open Help Center</Link></Button></div>
          </section>
        </div>
      </main>
    </div>
  );
}
