import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Smartphone,
  ShieldCheck,
  Wallet,
  MessagesSquare,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  Apple,
  CheckCircle2,
} from "lucide-react";

export const Route = createFileRoute("/get-app")({
  head: () => ({
    meta: [
      { title: "Oventric mobile apps — coming soon" },
      {
        name: "description",
        content:
          "Native Oventric apps for Android and iPhone are in the works. Everything — wallet, escrow checkout, chat, bounties and courses — already works right here on the web.",
      },
      { property: "og:title", content: "Oventric mobile apps — coming soon" },
      {
        property: "og:description",
        content:
          "Native Android and iPhone apps are on the way. The full Oventric experience is already live on the web.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GetAppPage,
});

const PERKS = [
  { icon: Wallet, title: "Sovereign wallet", text: "Top up, withdraw and track earnings in your own currency." },
  { icon: ShieldCheck, title: "Escrow checkout", text: "Funds are held safely until your order is delivered." },
  { icon: MessagesSquare, title: "Live chat & alerts", text: "Talk to sellers and get instant order updates." },
  { icon: Sparkles, title: "Creator tools", text: "Publish products, bounties, courses and posts." },
];

function GetAppPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto w-full max-w-[900px] px-4 py-12 sm:px-6 lg:px-11">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Oventric
        </Link>

        <header className="mt-6 max-w-2xl">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E5484D]/10 px-2.5 py-1 text-[10.5px] font-black uppercase tracking-[0.14em] text-[#E5484D]">
            Coming soon
          </span>
          <div className="mt-5 flex h-14 w-14 items-center justify-center rounded-[10px] bg-[#E5484D] text-white shadow-[0_16px_40px_-16px_rgba(229,72,77,0.9)]">
            <Smartphone className="h-7 w-7" />
          </div>
          <h1 className="mt-5 text-[30px] font-black leading-tight tracking-tight text-slate-900">
            Native Oventric apps are on the way
          </h1>
          <p className="mt-2 text-[14.5px] leading-relaxed text-slate-600">
            We&rsquo;re building proper Android and iPhone apps. Until they land, nothing is locked
            away — the complete Oventric experience runs right here in your browser.
          </p>

          <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> Wallet, checkout, chat and creator tools are all live on the web
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              to="/marketplace"
              className="inline-flex items-center gap-2 rounded-[10px] bg-[#E5484D] px-5 py-3 text-sm font-bold text-white shadow-[0_10px_30px_-12px_rgba(229,72,77,0.9)] transition-transform active:scale-95"
            >
              Continue on the web <ArrowRight className="h-4 w-4" />
            </Link>
            <span className="inline-flex items-center gap-2 rounded-[10px] border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-bold text-slate-500">
              <Apple className="h-4 w-4" /> App Store &amp; Play Store soon
            </span>
          </div>
        </header>

        <div className="mt-10 grid gap-3 sm:grid-cols-2">
          {PERKS.map((p) => (
            <div key={p.title} className="rounded-[10px] border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <p.icon className="h-4 w-4 text-[#E5484D]" />
                {p.title}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">{p.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
