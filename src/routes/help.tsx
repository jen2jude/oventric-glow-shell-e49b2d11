import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicChrome } from "@/components/oventric/PublicChrome";
import { HelpCircle, MessageCircle, ShoppingBag, Wallet, Target, Shield } from "lucide-react";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "Help center — Oventric" },
      {
        name: "description",
        content: "Get help with your Oventric account, marketplace, wallet, bounties, and academy.",
      },
      { property: "og:title", content: "Oventric Help Center" },
      {
        property: "og:description",
        content: "Answers about accounts, payments, marketplace, wallet, bounties, and more.",
      },
      { property: "og:url", content: "https://oventric.com/help" },
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
    title: "Social & Circles",
    body: "Post, mention (@) other users, join circles and guilds, and message people directly.",
  },
  {
    icon: ShoppingBag,
    title: "Marketplace",
    body: "Digital assets are protected by 80/20 escrow with buyer confirmation. Oventric is a digital-only marketplace.",
  },
  {
    icon: Target,
    title: "Bounties",
    body: "Post work with a reward. Winners are paid from escrow once accepted.",
  },
  {
    icon: Wallet,
    title: "Wallet & Payouts",
    body: "Fund via Paystack. Payouts to NGN/GHS bank or mobile money are automated. USD payouts are handled manually by our team.",
  },
  {
    icon: HelpCircle,
    title: "Common issues",
    body: "If media fails to render on Android, pull-to-refresh a second time or restart the app. Buttons that require sign-in will prompt you.",
  },
];

function HelpPage() {
  return (
    <PublicChrome>
      <div className="max-w-3xl mx-auto px-4 py-10 text-slate-200 md:text-slate-800">
        <h1 className="text-3xl md:text-4xl font-black text-white md:text-slate-900">
          Help center
        </h1>
        <p className="mt-3 text-slate-400 md:text-slate-500">
          Quick answers to get you unstuck. If you can't find what you need,{" "}
          <Link to="/report-problem" className="text-emerald-300 underline">
            report a problem
          </Link>
          .
        </p>
        <div className="mt-8 grid gap-3">
          {sections.map((s) => (
            <div
              key={s.title}
              className="p-4 rounded-2xl bg-[#141418] border border-white/10 md:bg-white md:border-slate-200"
            >
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 grid place-items-center rounded-full bg-emerald-500/15 text-emerald-300">
                  <s.icon className="w-4 h-4" />
                </span>
                <h2 className="font-bold text-white md:text-slate-900">{s.title}</h2>
              </div>
              <p className="mt-2 text-sm text-slate-300 leading-relaxed md:text-slate-600">
                {s.body}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-10 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
          <p className="text-sm text-emerald-100">
            Still stuck? Head to{" "}
            <Link to="/faq" className="underline">
              FAQ
            </Link>{" "}
            or{" "}
            <Link to="/report-problem" className="underline">
              Report a problem
            </Link>
            .
          </p>
        </div>
      </div>
    </PublicChrome>
  );
}
