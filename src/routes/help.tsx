import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicInfoLayout } from "@/components/oventric/PublicInfoLayout";
import { HelpCircle, MessageCircle, ShoppingBag, Wallet, Shield, Download, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import helpImage from "@/assets/public-pages/help-editorial.jpg";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "Help center — Oventric" },
      {
        name: "description",
        content: "Get help with your Oventric account, digital marketplace, purchases, wallet, and payouts.",
      },
      { property: "og:title", content: "Oventric Help Center" },
      {
        property: "og:description",
        content: "Answers about accounts, payments, digital products, downloads, wallet, and more.",
      },
      { property: "og:url", content: "https://oventric.com/help" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://oventric.com/help" }],
  }),
  component: HelpPage,
});

const sections = [
  {
    icon: Shield,
    title: "Account & KYC",
    body: "Complete your profile, upgrade verification tiers, and secure your account. KYC unlocks payouts and higher trust.",
  },
  {
    icon: MessageCircle,
    title: "Newsfeed & messages",
    body: "Publish posts, follow other builders and keep buyer or seller conversations in one place.",
  },
  {
    icon: ShoppingBag,
    title: "Marketplace",
    body: "Digital assets are protected by 80/20 escrow with buyer confirmation. Oventric is a digital-only marketplace.",
  },
  {
    icon: Download,
    title: "Purchases & downloads",
    body: "Return to My purchases to view order details, contact the seller, confirm delivery or download a digital product again.",
  },
  {
    icon: Wallet,
    title: "Wallet & Payouts",
    body: "Fund via Paystack. Payouts to NGN/GHS bank or mobile money are automated. USD payouts are handled manually by our team.",
  },
  {
    icon: HelpCircle,
    title: "Common issues",
    body: "Find quick answers in the FAQ or send a detailed report when something does not work as expected.",
  },
];

function HelpPage() {
  return (
    <PublicInfoLayout eyebrow="Support" title="How can we help?" description="Straightforward guidance for your account, digital purchases, selling, wallet and payouts." icon={HelpCircle} image={helpImage} imageAlt="Support headset, guide and safety shield on a bright desk">
      <div className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
          {sections.map((s) => (
            <article
              key={s.title}
              className="border-b border-border py-6"
            >
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-md bg-accent text-accent-foreground">
                  <s.icon className="size-4" />
                </span>
                <h2 className="font-public-display font-bold">{s.title}</h2>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {s.body}
              </p>
            </article>
          ))}
      </div>
      <section className="mt-10 rounded-lg bg-foreground px-6 py-7 text-background sm:flex sm:items-center sm:justify-between sm:gap-8">
        <div><h2 className="font-public-display text-xl font-bold">Still need a hand?</h2><p className="mt-1 text-sm leading-6 text-background/70">Check common answers or tell us exactly what happened.</p></div>
        <div className="mt-5 flex shrink-0 flex-wrap gap-2 sm:mt-0"><Button asChild variant="secondary"><Link to="/faq">Read FAQs</Link></Button><Button asChild><Link to="/report-problem">Report issue <ArrowRight /></Link></Button></div>
      </section>
    </PublicInfoLayout>
  );
}
