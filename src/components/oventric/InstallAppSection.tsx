import { useEffect, useState } from "react";
import { Download, Share, Plus, Smartphone, Zap, Bell, X } from "lucide-react";
import { isStandaloneDisplay } from "@/hooks/use-launch-context";
import {
  isAndroidDevice,
  isIosDevice,
  onInstallPromptChange,
  getDeferredInstallPrompt,
  triggerInstall,
} from "@/lib/install-app";

function AndroidMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M7.2 16.8c0 .66.54 1.2 1.2 1.2h.9v2.4a1.2 1.2 0 0 0 2.4 0V18h1.2v2.4a1.2 1.2 0 0 0 2.4 0V18h.3c.66 0 1.2-.54 1.2-1.2V9H7.2v7.8ZM5.4 9a1.2 1.2 0 0 0-1.2 1.2v4.8a1.2 1.2 0 0 0 2.4 0v-4.8A1.2 1.2 0 0 0 5.4 9Zm13.2 0a1.2 1.2 0 0 0-1.2 1.2v4.8a1.2 1.2 0 0 0 2.4 0v-4.8A1.2 1.2 0 0 0 18.6 9Zm-3.42-3.36.84-1.26a.3.3 0 0 0-.5-.33l-.9 1.35a7.2 7.2 0 0 0-5.64 0l-.9-1.35a.3.3 0 1 0-.5.33l.84 1.26A6.6 6.6 0 0 0 7.2 8.4h9.6a6.6 6.6 0 0 0-1.62-2.76ZM10 6.9a.6.6 0 1 1 .6-.6.6.6 0 0 1-.6.6Zm4 0a.6.6 0 1 1 .6-.6.6.6 0 0 1-.6.6Z" />
    </svg>
  );
}

function AppleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M16.36 12.76c.03 3.06 2.68 4.08 2.71 4.09-.02.07-.42 1.45-1.4 2.87-.84 1.23-1.72 2.46-3.1 2.48-1.36.03-1.79-.8-3.34-.8-1.55 0-2.04.78-3.32.83-1.33.05-2.35-1.33-3.2-2.55C2.97 17.04 1.7 12.45 3.6 9.5a4.9 4.9 0 0 1 4.12-2.5c1.29-.02 2.5.87 3.29.87.79 0 2.27-1.07 3.83-.92.65.03 2.48.26 3.65 1.98-.09.06-2.18 1.28-2.16 3.83l.03-.01ZM14.16 5.2c.7-.85 1.18-2.04 1.05-3.2-1.02.04-2.25.68-2.98 1.53-.66.76-1.23 1.97-1.08 3.13 1.14.09 2.3-.58 3.01-1.46Z" />
    </svg>
  );
}

/**
 * Website-only home page section inviting visitors to install the app.
 * One CTA works for both platforms: Android/Chrome fires the native
 * install dialog; iOS expands the Share → Add to Home Screen guide.
 * Hidden entirely once the app is installed (standalone display).
 */
export function InstallAppSection() {
  const [hidden, setHidden] = useState(true);
  const [canPrompt, setCanPrompt] = useState(false);
  const [iosGuide, setIosGuide] = useState(false);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    if (isStandaloneDisplay()) return;
    setHidden(false);
    setCanPrompt(Boolean(getDeferredInstallPrompt()));
    return onInstallPromptChange(() =>
      setCanPrompt(Boolean(getDeferredInstallPrompt())),
    );
  }, []);

  if (hidden) return null;

  const onInstall = async () => {
    if (isIosDevice()) {
      setIosGuide(true);
      setFallback(false);
      return;
    }
    const result = await triggerInstall();
    if (result === "unavailable") {
      // No native prompt available (desktop browser, or already offered).
      setFallback(true);
      setIosGuide(false);
    }
  };

  return (
    <section className="px-1">
      <div className="relative overflow-hidden rounded-[24px] bg-slate-900 text-white shadow-[0_24px_50px_-30px_rgba(15,23,42,0.8)]">
        <div className="h-1.5 w-full bg-gradient-to-r from-[#22C55E] via-[#3B82F6] to-[#F59E0B]" />
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-400">
                Better in the app
              </p>
              <h2 className="mt-1.5 text-[19px] font-black leading-tight">
                Get the Oventric app
              </h2>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-300">
                Full screen, faster, with real alerts for chats, orders and
                sales — straight from your home screen.
              </p>
            </div>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-white/10">
              <Smartphone className="h-5 w-5 text-emerald-300" />
            </span>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] font-semibold text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-amber-400" /> Opens instantly
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Bell className="h-3.5 w-3.5 text-sky-400" /> Real notifications
            </span>
          </div>

          <button
            type="button"
            onClick={() => void onInstall()}
            className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-white text-[13px] font-black uppercase tracking-widest text-slate-900 active:scale-[0.98] transition-transform"
          >
            <Download className="h-4 w-4" strokeWidth={2.6} />
            {canPrompt || isIosDevice() ? "Install the app" : "Get the app"}
          </button>

          <div className="mt-3 flex items-center justify-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-[11px] font-bold text-slate-200">
              <AndroidMark className="h-3.5 w-3.5 text-[#3DDC84]" /> Android
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-[11px] font-bold text-slate-200">
              <AppleMark className="h-3.5 w-3.5 text-white" /> iOS
            </span>
          </div>

          {iosGuide && (
            <div className="mt-3 rounded-[14px] border border-white/10 bg-white/[0.05] p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[11.5px] font-bold text-slate-200">
                  On iPhone it takes two taps:
                </p>
                <button
                  type="button"
                  aria-label="Close guide"
                  onClick={() => setIosGuide(false)}
                  className="rounded-[8px] p-0.5 text-slate-500"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-2 flex items-center gap-2 text-[11px] font-semibold text-slate-300">
                <span className="inline-flex items-center gap-1 rounded-[10px] border border-white/10 bg-white/[0.06] px-2 py-1.5">
                  <Share className="h-3.5 w-3.5" /> Share
                </span>
                <span className="text-slate-500">→</span>
                <span className="inline-flex items-center gap-1 rounded-[10px] border border-white/10 bg-white/[0.06] px-2 py-1.5">
                  <Plus className="h-3.5 w-3.5" /> Add to Home Screen
                </span>
              </div>
            </div>
          )}

          {fallback && (
            <p className="mt-3 rounded-[14px] border border-white/10 bg-white/[0.05] p-3 text-[11.5px] leading-relaxed text-slate-300">
              Open <span className="font-bold text-white">oventric.com</span> on
              your {isAndroidDevice() ? "Android" : "phone"} browser and tap
              install when prompted — the same one tap works on Android and iOS.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
