import { createFileRoute } from "@tanstack/react-router";
import { PublicInfoLayout } from "@/components/oventric/PublicInfoLayout";
import { useState } from "react";
import { ChevronDown, MessageCircleQuestion } from "lucide-react";
import helpImage from "@/assets/public-pages/help-editorial.jpg";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — Oventric" },
      {
        name: "description",
        content:
          "Frequently asked questions about Oventric — accounts, feed, marketplace, wallet, and payouts.",
      },
      { property: "og:title", content: "Oventric FAQ" },
      {
        property: "og:description",
        content: "Answers to the most common questions across Oventric.",
      },
      { property: "og:url", content: "https://oventric.com/faq" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://oventric.com/faq" }],
  }),
  component: FaqPage,
});

const items = [
  {
    q: "How do I sign up?",
    a: "Tap Connect Account, use Google or email, then complete a short onboarding to pick your country and base currency (NGN, GHS, or USD).",
  },
  {
    q: "What is my base currency and can I change it?",
    a: "Your base currency is set from your country during onboarding — Nigeria = NGN, Ghana = GHS, everywhere else = USD. It anchors your wallet balances and cashback earnings.",
  },
  {
    q: "How does the marketplace escrow work?",
    a: "For digital assets, 80% of the sale price is held for the seller until the buyer confirms delivery. Once confirmed, funds unlock for withdrawal. Admins can also verify delivery if needed.",
  },
  {
    q: "Does Oventric sell physical goods?",
    a: "No. Oventric is a purely digital marketplace — templates, software, courses, accounts and other downloadable or licensed assets only.",
  },
  {
    q: "How do I get paid out?",
    a: "For NGN and GHS, request a payout in the wallet — Paystack Transfers sends it to your bank or mobile money. USD payouts are processed manually by our team.",
  },
  {
    q: "What is cashback?",
    a: "Sellers can fund cashback of up to 50% on a digital product. When a listing offers it, the cashback is credited to your cashback wallet in your base currency after the purchase settles. Cashback is not earned when a coupon is used.",
  },
  {
    q: "How do I mention someone in a post?",
    a: "Tap the @ icon in the composer and pick a user. They get a notification with a link back to your post.",
  },
  {
    q: "How do I delete my account?",
    a: "Menu → Settings & Privacy → Danger zone. Deletion is soft for 30 days — sign in during that window to reactivate. After 30 days, it becomes permanent.",
  },
  {
    q: "How do I report abuse or a problem?",
    a: "Use Report a problem from the menu, or the three-dot menu on any post or listing to file a targeted report.",
  },
];

function FaqPage() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  return (
    <PublicInfoLayout eyebrow="Common questions" title="Frequently asked questions" description="Clear answers about accounts, digital products, payments, escrow, downloads and payouts." icon={MessageCircleQuestion} image={helpImage} imageAlt="A support guide, headset and safety shield">
        <div className="divide-y divide-border border-y border-border">
          {items.map((it, i) => {
            const open = openIdx === i;
            return (
              <button
                key={it.q}
                onClick={() => setOpenIdx(open ? null : i)}
                className="group w-full py-5 text-left"
                aria-expanded={open}
              >
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
                  <span className="min-w-0 font-public-display text-sm font-bold text-foreground sm:text-base">
                    {it.q}
                  </span>
                  <ChevronDown
                    className={`size-5 shrink-0 text-muted-foreground transition-transform group-hover:text-primary ${open ? "rotate-180" : ""}`}
                  />
                </div>
                {open && (
                  <p className="mt-3 max-w-2xl pr-8 text-sm leading-7 text-muted-foreground">
                    {it.a}
                  </p>
                )}
              </button>
            );
          })}
        </div>
    </PublicInfoLayout>
  );
}
