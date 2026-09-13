import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Smartphone,
  ShieldCheck,
  Wallet,
  MessagesSquare,
  Sparkles,
  ArrowLeft,
  Download,
  Share,
  MoreVertical,
  Apple,
} from "lucide-react";

import { useWebAppInstall } from "@/lib/pwa/install";

export const Route = createFileRoute("/get-app")({
  head: () => ({
    meta: [
      { title: "Get the Oventric app — wallet, escrow checkout and chat" },
      {
        name: "description",
        content:
          "Install the Oventric app on your phone or computer for the full experience: sovereign wallet, escrow checkout, live chat, bounties and creator tools.",
      },
      { property: "og:title", content: "Get the Oventric app" },
      {
        property: "og:description",
        content:
          "Install Oventric for the full experience — wallet, escrow checkout, chat, bounties and creator tools.",
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
  const { canInstall, installed, install } = useWebAppInstall();

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
          <div className="flex h-14 w-14 items-center justify-center rounded-[10px] bg-[#E5484D] text-white shadow-[0_16px_40px_-16px_rgba(229,72,77,0.9)]">
            <Smartphone className="h-7 w-7" />
          </div>
          <h1 className="mt-5 text-[30px] font-black leading-tight tracking-tight text-slate-900">
            Get the Oventric app
          </h1>
          <p className="mt-2 text-[14.5px] leading-relaxed text-slate-600">
            The wallet, escrow checkout, live chat, bounties and creator tools live in the Oventric
            app. Install it free — it takes seconds and works on any phone or computer.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            {canInstall ? (
              <button
                type="button"
                onClick={() => void install()}
                className="inline-flex items-center gap-2 rounded-[10px] bg-[#E5484D] px-5 py-3 text-sm font-bold text-white shadow-[0_10px_30px_-12px_rgba(229,72,77,0.9)] transition-transform active:scale-95"
              >
                <Download className="h-4 w-4" /> Install the app
              </button>
            ) : installed ? (
              <span className="inline-flex items-center gap-2 rounded-[10px] bg-emerald-50 px-5 py-3 text-sm font-bold text-emerald-700">
                Installed — open Oventric from your home screen
              </span>
            ) : null}
            <span className="inline-flex items-center gap-2 rounded-[10px] border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-bold text-slate-500">
              <Apple className="h-4 w-4" /> Native App Store &amp; Play Store apps coming soon
            </span>
          </div>
        </header>

        {/* Manual install instructions (shown when the browser doesn't offer a prompt) */}
        {!canInstall && !installed && (
          <div className="mt-10 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[10px] border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <Share className="h-4 w-4 text-[#E5484D]" /> iPhone &amp; iPad
              </div>
              <ol className="mt-3 space-y-2 text-[13px] leading-relaxed text-slate-600">
                <li>1. Open oventric.com in <strong>Safari</strong>.</li>
                <li>2. Tap the <strong>Share</strong> button (square with an arrow).</li>
                <li>3. Scroll and tap <strong>Add to Home Screen</strong>.</li>
                <li>4. Tap <strong>Add</strong> — done.</li>
              </ol>
            </div>
            <div className="rounded-[10px] border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <MoreVertical className="h-4 w-4 text-[#E5484D]" /> Android &amp; desktop
              </div>
              <ol className="mt-3 space-y-2 text-[13px] leading-relaxed text-slate-600">
                <li>1. Open oventric.com in <strong>Chrome</strong>.</li>
                <li>2. Tap the <strong>⋮ menu</strong> (or the install icon in the address bar).</li>
                <li>3. Choose <strong>Add to Home screen</strong> / <strong>Install app</strong>.</li>
                <li>4. Confirm — the app appears on your home screen.</li>
              </ol>
            </div>
          </div>
        )}

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
