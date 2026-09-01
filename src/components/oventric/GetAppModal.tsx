import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import {
  X,
  Smartphone,
  Download,
  ShieldCheck,
  Wallet,
  MessagesSquare,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { ANDROID_APK_AVAILABLE, ANDROID_APK_URL } from "@/lib/app-distribution";
import { useWebAppInstall } from "@/lib/pwa/install";


const PERKS = [
  { icon: Sparkles, title: "Creator studio", text: "Publish posts, products, bounties and courses." },
  { icon: Wallet, title: "Sovereign wallet", text: "Top up, withdraw and track earnings instantly." },
  { icon: ShieldCheck, title: "Escrow checkout", text: "Funds held safely until delivery is confirmed." },
  { icon: MessagesSquare, title: "Live chat & alerts", text: "Talk to buyers and sellers in real time." },
];

/**
 * Web-only dialog shown when a browser visitor tries to open an app-shell flow
 * (creating a post, listing, bounty or course).
 */
export function GetAppModal({
  open,
  onClose,
  from = "create",
  title = "Creating lives in the Oventric app",
  description = "The web version is for discovering. Publishing, earning and chatting happen in the app — install it in one tap, no store account needed.",
}: {
  open: boolean;
  onClose: () => void;
  from?: string;
  title?: string;
  description?: string;
}) {
  const { canInstall, install } = useWebAppInstall();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={onClose} />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="slide-up relative grid w-full max-w-3xl overflow-hidden rounded-[10px] bg-white shadow-[0_50px_120px_-40px_rgba(15,23,42,0.65)] md:grid-cols-[300px_minmax(0,1fr)]"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 md:bg-slate-100 md:text-slate-500 md:hover:bg-slate-200 md:hover:text-slate-900"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Visual panel */}
        <div className="relative hidden overflow-hidden bg-[#0A0A0B] p-7 md:block">
          <div
            className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full opacity-60 blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(229,72,77,0.55), transparent 70%)" }}
          />
          <div className="relative">
            <div className="flex h-12 w-12 items-center justify-center rounded-[10px] bg-[#E5484D] text-white shadow-[0_14px_40px_-14px_rgba(229,72,77,0.95)]">
              <Smartphone className="h-6 w-6" />
            </div>
            <p className="mt-5 text-[19px] font-black leading-tight text-white">
              Oventric,
              <br />
              in your pocket.
            </p>
            <p className="mt-2 text-[12.5px] leading-relaxed text-slate-400">
              Everything money-related, built for mobile.
            </p>
          </div>

          {/* Phone mock */}
          <div className="relative mx-auto mt-8 h-[190px] w-[132px] rounded-[18px] border border-white/12 bg-gradient-to-b from-white/[0.09] to-white/[0.02] p-2 shadow-[0_30px_70px_-30px_rgba(229,72,77,0.7)]">
            <div className="mx-auto mb-2 h-1 w-8 rounded-full bg-white/25" />
            <div className="space-y-1.5">
              <div className="h-9 rounded-[8px] bg-[#E5484D]/25" />
              <div className="grid grid-cols-2 gap-1.5">
                <div className="h-8 rounded-[8px] bg-white/[0.07]" />
                <div className="h-8 rounded-[8px] bg-white/[0.07]" />
                <div className="h-8 rounded-[8px] bg-white/[0.07]" />
                <div className="h-8 rounded-[8px] bg-white/[0.07]" />
              </div>
              <div className="h-6 rounded-[8px] bg-white/[0.05]" />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 sm:p-8">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E5484D]/10 px-2.5 py-1 text-[10.5px] font-black uppercase tracking-[0.14em] text-[#E5484D]">
            App exclusive
          </span>
          <h2 className="mt-3 text-[22px] font-black leading-tight tracking-tight text-slate-900">
            {title}
          </h2>
          <p className="mt-2 text-[13.5px] leading-relaxed text-slate-600">{description}</p>

          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {PERKS.map((p) => (
              <div key={p.title} className="rounded-[10px] border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center gap-2 text-[12.5px] font-bold text-slate-900">
                  <p.icon className="h-4 w-4 text-[#E5484D]" />
                  {p.title}
                </div>
                <p className="mt-1 text-[11.5px] leading-snug text-slate-500">{p.text}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center">
            {canInstall ? (
              <button
                type="button"
                onClick={async () => {
                  await install();
                  onClose();
                }}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-[10px] bg-[#E5484D] px-5 py-3 text-sm font-bold text-white shadow-[0_16px_40px_-16px_rgba(229,72,77,0.95)] transition-transform active:scale-95"
              >
                <Download className="h-4 w-4" /> Install the app
              </button>
            ) : ANDROID_APK_AVAILABLE ? (
              <a
                href={ANDROID_APK_URL}
                download
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-[10px] bg-[#E5484D] px-5 py-3 text-sm font-bold text-white shadow-[0_16px_40px_-16px_rgba(229,72,77,0.95)] transition-transform active:scale-95"
              >
                <Download className="h-4 w-4" /> Download for Android
              </a>
            ) : (
              <Link
                to="/get-app"
                search={{ from }}
                onClick={onClose}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-[10px] bg-[#E5484D] px-5 py-3 text-sm font-bold text-white shadow-[0_16px_40px_-16px_rgba(229,72,77,0.95)] transition-transform active:scale-95"
              >
                <Download className="h-4 w-4" /> Install on Android
              </Link>
            )}
            <button
              type="button"
              onClick={async () => {
                if (await install()) onClose();
              }}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-[10px] bg-slate-900 px-5 py-3 text-sm font-bold text-white transition-transform active:scale-95"
            >
              <Smartphone className="h-4 w-4" />
              {canInstall ? "Install Oventric" : "Install on iPhone"}
            </button>
          </div>

          <Link
            to="/get-app"
            search={{ from }}
            onClick={onClose}
            className="mt-3 inline-flex items-center justify-center gap-2 text-[12.5px] font-bold text-slate-600 transition-colors hover:text-slate-900"
          >
            See all install options <ArrowRight className="h-4 w-4" />
          </Link>


          <button
            type="button"
            onClick={onClose}
            className="mt-3 text-[12px] font-semibold text-slate-400 transition-colors hover:text-slate-700"
          >
            Keep browsing on the web
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
