import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicChrome } from "@/components/oventric/PublicChrome";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Oventric — Our story and mission" },
      {
        name: "description",
        content:
          "Oventric is a multi-vendor tech platform for builders: social feed, marketplace, academy, bounties, and a sovereign wallet.",
      },
      { property: "og:title", content: "About Oventric" },
      {
        property: "og:description",
        content: "One platform for builders — social, marketplace, academy, bounties, wallet.",
      },
      { property: "og:url", content: "https://oventric.com/about" },
    ],
    links: [{ rel: "canonical", href: "https://oventric.com/about" }],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <PublicChrome>
      <div className="max-w-3xl mx-auto px-4 py-10 text-slate-200 md:text-slate-800">
        <h1 className="text-3xl md:text-4xl font-black text-white md:text-slate-900">
          About Oventric
        </h1>
        <p className="mt-4 text-slate-300 leading-relaxed md:text-slate-600">
          Oventric is a builder-first tech platform that unifies what has always been scattered: a
          social feed for creators, a marketplace for digital products, an academy for
          teaching and learning, a bounty board for open work, and a sovereign multi-currency wallet
          for value that stays with you.
        </p>
        <h2 className="mt-8 text-xl font-bold text-white md:text-slate-900">What you get</h2>
        <ul className="mt-3 space-y-2 text-slate-300 list-disc pl-5 md:text-slate-600">
          <li>
            <b>Feed</b> — post, react, mention, and share with your circles and followers.
          </li>
          <li>
            <b>Marketplace</b> — sell digital assets with escrow protection; buyers
            reach out directly.
          </li>
          <li>
            <b>Academy</b> — publish courses, learn, and earn credentials.
          </li>
          <li>
            <b>Bounties</b> — post open work and get paid when a solution ships.
          </li>
          <li>
            <b>Sovereign Wallet</b> — NGN, GHS, or USD with cashback, affiliate, and bounty
            earnings, all in your home currency.
          </li>
        </ul>
        <h2 className="mt-8 text-xl font-bold text-white md:text-slate-900">Why we exist</h2>
        <p className="mt-3 text-slate-300 leading-relaxed md:text-slate-600">
          We believe the tools for independent builders should be composable, cross-border, and
          fair. Payouts should be automated. Digital sales should be protected by escrow. Discovery
          should reward what you make, not who you know.
        </p>
        <div className="mt-10 flex gap-3">
          <Link
            to="/"
            className="inline-flex items-center h-11 px-5 rounded-full bg-emerald-500 text-black font-bold text-sm hover:bg-emerald-400"
          >
            Explore Oventric
          </Link>
          <Link
            to="/help"
            className="inline-flex items-center h-11 px-5 rounded-full bg-[#1E1E24] border border-white/10 text-slate-200 font-semibold text-sm md:bg-white md:border-slate-200 md:text-slate-800"
          >
            Help center
          </Link>
        </div>
      </div>
    </PublicChrome>
  );
}
