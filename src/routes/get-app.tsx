import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Smartphone,
  Download,
  ShieldCheck,
  Wallet,
  MessagesSquare,
  Sparkles,
  ArrowLeft,
} from "lucide-react";

export const Route = createFileRoute("/get-app")({
  head: () => ({
    meta: [
      { title: "Get the Oventric app — wallet, chat and checkout" },
      {
        name: "description",
        content:
          "Install Oventric to buy with escrow protection, manage your multi-currency wallet, chat with sellers and publish listings, bounties and courses.",
      },
      { property: "og:title", content: "Get the Oventric app" },
      {
        property: "og:description",
        content:
          "Wallet, escrow checkout, chat and creator tools live in the Oventric app. Install it in one tap.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GetAppPage,
});

type InstallPrompt = Event & { prompt: () => Promise<void> };

function GetAppPage() {
  const [deferred, setDeferred] = useState<InstallPrompt | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl px-5 py-10">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Oventric
        </Link>

        <div className="mt-6 rounded-[10px] border border-slate-200 bg-slate-50 p-7">
          <div className="flex h-14 w-14 items-center justify-center rounded-[10px] bg-[#E5484D] text-white">
            <Smartphone className="h-7 w-7" />
          </div>
          <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-slate-900">
            Get the Oventric app
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
            Browsing works great on the web. Buying, selling, chatting and everything money-related
            lives in the app — installed in one tap, no store account needed.
          </p>

          <button
            type="button"
            onClick={async () => {
              if (deferred) {
                await deferred.prompt();
                setDeferred(null);
              }
            }}
            className="mt-6 inline-flex items-center gap-2 rounded-[10px] bg-[#E5484D] px-5 py-3 text-sm font-bold text-white shadow-[0_10px_30px_-12px_rgba(229,72,77,0.9)] transition-transform active:scale-95"
          >
            <Download className="h-4 w-4" />
            {deferred ? "Install Oventric" : "Add Oventric to your home screen"}
          </button>
          {!deferred && (
            <p className="mt-3 text-xs text-slate-500">
              On iPhone: tap Share → “Add to Home Screen”. On Android: tap the browser menu →
              “Install app”.
            </p>
          )}
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <Perk icon={<Wallet className="h-4 w-4" />} title="Sovereign wallet" text="Top up, withdraw and track earnings in your own currency." />
          <Perk icon={<ShieldCheck className="h-4 w-4" />} title="Escrow checkout" text="Funds are held safely until your order is delivered." />
          <Perk icon={<MessagesSquare className="h-4 w-4" />} title="Live chat & alerts" text="Talk to sellers and get instant order notifications." />
          <Perk icon={<Sparkles className="h-4 w-4" />} title="Creator tools" text="Publish products, bounties, courses and posts on the go." />
        </div>
      </div>
    </div>
  );
}

function Perk({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-[10px] border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
        <span className="text-[#E5484D]">{icon}</span>
        {title}
      </div>
      <p className="mt-1 text-xs leading-relaxed text-slate-600">{text}</p>
    </div>
  );
}
