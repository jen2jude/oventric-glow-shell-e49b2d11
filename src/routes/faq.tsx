import { createFileRoute } from "@tanstack/react-router";
import { PublicChrome } from "@/components/oventric/PublicChrome";
import { useState } from "react";
import { ChevronDown } from "lucide-react";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — Oventric" },
      {
        name: "description",
        content:
          "Frequently asked questions about Oventric — accounts, feed, marketplace, bounties, wallet, and payouts.",
      },
      { property: "og:title", content: "Oventric FAQ" },
      {
        property: "og:description",
        content: "Answers to the most common questions across Oventric.",
      },
      { property: "og:url", content: "https://oventric.com/faq" },
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
    a: "You earn 2% of the order value on every purchase, paid back to your wallet in your base currency. Cashback is not earned when a coupon is used.",
  },
  {
    q: "How do bounties work?",
    a: "Post a task with a reward. Solvers submit; when you accept a submission, the reward moves from escrow to the solver's wallet.",
  },
  {
    q: "What are circles and guilds?",
    a: "Circles are curated peer groups. Guilds are larger interest-based communities. Both surface posts to a targeted audience instead of the whole platform.",
  },
  {
    q: "How do I mention someone in a post?",
    a: "Tap the @ icon in the composer and pick a user. They get a notification with a link back to your post.",
  },
  {
    q: "Can I make my post visible to only my circle or followers?",
    a: "Yes — the audience dropdown lets you choose Public, Followers, or a specific Circle before posting.",
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
    <PublicChrome>
      <div className="max-w-3xl mx-auto px-4 py-10 text-slate-200 md:text-slate-800">
        <h1 className="text-3xl md:text-4xl font-black text-white md:text-slate-900">
          Frequently asked questions
        </h1>
        <p className="mt-2 text-slate-400 md:text-slate-500">
          Everything from accounts to escrow to payouts.
        </p>
        <div className="mt-8 divide-y divide-white/5 rounded-2xl bg-[#141418] border border-white/10 md:bg-white md:border-slate-200">
          {items.map((it, i) => {
            const open = openIdx === i;
            return (
              <button
                key={it.q}
                onClick={() => setOpenIdx(open ? null : i)}
                className="w-full text-left p-4"
                aria-expanded={open}
              >
                <div className="flex items-center gap-3">
                  <span className="flex-1 text-sm font-bold text-white md:text-slate-900">
                    {it.q}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
                  />
                </div>
                {open && (
                  <p className="mt-2 text-sm text-slate-300 leading-relaxed md:text-slate-600">
                    {it.a}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </PublicChrome>
  );
}
