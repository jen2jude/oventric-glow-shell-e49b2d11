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
  Apple,
  Share as ShareIcon,
  CheckCircle2,
  QrCode as QrIcon,
} from "lucide-react";

import { QrCode } from "@/components/oventric/QrCode";
import {
  ANDROID_APK_SIZE,
  ANDROID_APK_AVAILABLE,
  ANDROID_APK_URL,
  ANDROID_APP_VERSION,
  ANDROID_INSTALL_STEPS,
  IOS_INSTALL_STEPS,
  detectPlatform,
  isStandalonePwa,
  type MobilePlatform,
} from "@/lib/app-distribution";
import { useWebAppInstall } from "@/lib/pwa/install";

export const Route = createFileRoute("/get-app")({
  head: () => ({
    meta: [
      { title: "Install Oventric — Android APK & iPhone app" },
      {
        name: "description",
        content:
          "Install Oventric on Android with a direct APK download, or add it to your iPhone home screen. Wallet, escrow checkout, chat and creator tools in one app.",
      },
      { property: "og:title", content: "Install the Oventric app" },
      {
        property: "og:description",
        content:
          "Direct Android APK download and one-tap iPhone install. Wallet, escrow checkout, chat and creator tools.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GetAppPage,
});

type InstallPrompt = Event & { prompt: () => Promise<void> };

function GetAppPage() {
  const [platform, setPlatform] = useState<MobilePlatform>("desktop");
  const [installed, setInstalled] = useState(false);
  const [deferred, setDeferred] = useState<InstallPrompt | null>(null);
  const [pageUrl, setPageUrl] = useState("https://www.oventric.com/get-app");

  useEffect(() => {
    setPlatform(detectPlatform());
    setInstalled(isStandalonePwa());
    setPageUrl(`${window.location.origin}/get-app`);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto w-full max-w-[1100px] px-4 py-10 sm:px-6 lg:px-11">
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
            Install the Oventric app
          </h1>
          <p className="mt-2 text-[14.5px] leading-relaxed text-slate-600">
            Browsing works great on the web. Buying, selling, chatting and everything
            money-related lives in the app. Pick your device below.
          </p>
          {installed && (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" /> You’re already using the installed app
            </p>
          )}
        </header>

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <AndroidCard highlight={platform === "android"} />
          <IosCard highlight={platform === "ios"} deferred={deferred} onUsed={() => setDeferred(null)} />
        </div>

        {platform === "desktop" && (
          <section className="mt-4 flex flex-col items-start gap-6 rounded-[10px] border border-slate-200 bg-slate-50 p-6 sm:flex-row sm:items-center">
            <div className="rounded-[10px] border border-slate-200 bg-white p-3">
              <QrCode value={pageUrl} size={150} />
            </div>
            <div>
              <div className="inline-flex items-center gap-2 text-sm font-black text-slate-900">
                <QrIcon className="h-4 w-4 text-[#E5484D]" /> Scan to install on your phone
              </div>
              <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-slate-600">
                Point your phone camera at this code. Android gets the direct APK download,
                iPhone gets the one-tap home-screen install.
              </p>
            </div>
          </section>
        )}

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Perk icon={<Wallet className="h-4 w-4" />} title="Sovereign wallet" text="Top up, withdraw and track earnings in your own currency." />
          <Perk icon={<ShieldCheck className="h-4 w-4" />} title="Escrow checkout" text="Funds are held safely until your order is delivered." />
          <Perk icon={<MessagesSquare className="h-4 w-4" />} title="Live chat & alerts" text="Talk to sellers and get instant order notifications." />
          <Perk icon={<Sparkles className="h-4 w-4" />} title="Creator tools" text="Publish products, bounties, courses and posts on the go." />
        </div>
      </div>
    </div>
  );
}

function AndroidCard({ highlight }: { highlight: boolean }) {
  const { canInstall, install } = useWebAppInstall();
  return (
    <section
      className={`relative overflow-hidden rounded-[10px] border p-6 ${
        highlight ? "border-[#E5484D]/40 bg-[#E5484D]/[0.04]" : "border-slate-200 bg-white"
      }`}
    >
      {highlight && (
        <span className="absolute right-4 top-4 rounded-full bg-[#E5484D] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white">
          Your device
        </span>
      )}
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-[10px] bg-emerald-500/10 text-emerald-600">
          <Download className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-[17px] font-black tracking-tight text-slate-900">Android</h2>
          <p className="text-[11.5px] font-semibold text-slate-500">
            v{ANDROID_APP_VERSION} · {ANDROID_APK_SIZE} · Direct install
          </p>
        </div>
      </div>

      <p className="mt-3 text-[13px] leading-relaxed text-slate-600">
        {ANDROID_APK_AVAILABLE
          ? "The full native app — real push notifications, camera uploads and offline-safe navigation. Installed straight from us, no store account needed."
          : "The native Android build is getting its final signing pass. Meanwhile you can install Oventric from Chrome in two taps — same wallet, checkout, chat and creator tools."}
      </p>

      {canInstall ? (
        <button
          type="button"
          onClick={() => void install()}
          className="mt-5 inline-flex items-center gap-2 rounded-[10px] bg-[#E5484D] px-5 py-3 text-sm font-bold text-white shadow-[0_10px_30px_-12px_rgba(229,72,77,0.9)] transition-transform active:scale-95"
        >
          <Download className="h-4 w-4" /> Install the app
        </button>
      ) : ANDROID_APK_AVAILABLE ? (
        <a
          href={ANDROID_APK_URL}
          download
          className="mt-5 inline-flex items-center gap-2 rounded-[10px] bg-[#E5484D] px-5 py-3 text-sm font-bold text-white shadow-[0_10px_30px_-12px_rgba(229,72,77,0.9)] transition-transform active:scale-95"
        >
          <Download className="h-4 w-4" /> Download the APK
        </a>
      ) : (
        <span className="mt-5 inline-flex items-center gap-2 rounded-[10px] border border-slate-200 bg-slate-100 px-5 py-3 text-sm font-bold text-slate-500">
          <Download className="h-4 w-4" /> APK coming soon
        </span>
      )}

      {ANDROID_APK_AVAILABLE && (
        <ol className="mt-5 space-y-2">
          {ANDROID_INSTALL_STEPS.map((s, i) => (
            <Step key={s} n={i + 1} text={s} />
          ))}
        </ol>
      )}
    </section>
  );
}

function IosCard({
  highlight,
  deferred,
  onUsed,
}: {
  highlight: boolean;
  deferred: (Event & { prompt: () => Promise<void> }) | null;
  onUsed: () => void;
}) {
  return (
    <section
      className={`relative overflow-hidden rounded-[10px] border p-6 ${
        highlight ? "border-[#E5484D]/40 bg-[#E5484D]/[0.04]" : "border-slate-200 bg-white"
      }`}
    >
      {highlight && (
        <span className="absolute right-4 top-4 rounded-full bg-[#E5484D] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white">
          Your device
        </span>
      )}
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-[10px] bg-slate-900/5 text-slate-900">
          <Apple className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-[17px] font-black tracking-tight text-slate-900">iPhone & iPad</h2>
          <p className="text-[11.5px] font-semibold text-slate-500">
            Add to Home Screen · No App Store needed
          </p>
        </div>
      </div>

      <p className="mt-3 text-[13px] leading-relaxed text-slate-600">
        Oventric installs as a full-screen app on iOS in two taps. Wallet, checkout, chat and
        creator tools all work exactly like the Android app.
      </p>

      <button
        type="button"
        onClick={async () => {
          if (deferred) {
            await deferred.prompt();
            onUsed();
          }
        }}
        className="mt-5 inline-flex items-center gap-2 rounded-[10px] bg-slate-900 px-5 py-3 text-sm font-bold text-white transition-transform active:scale-95"
      >
        <ShareIcon className="h-4 w-4" />
        {deferred ? "Install Oventric" : "Add to Home Screen"}
      </button>

      <ol className="mt-5 space-y-2">
        {IOS_INSTALL_STEPS.map((s, i) => (
          <Step key={s} n={i + 1} text={s} />
        ))}
      </ol>
    </section>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-[1px] grid h-5 w-5 shrink-0 place-items-center rounded-full bg-slate-900 text-[10px] font-black text-white">
        {n}
      </span>
      <span className="text-[12.5px] leading-relaxed text-slate-600">{text}</span>
    </li>
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
