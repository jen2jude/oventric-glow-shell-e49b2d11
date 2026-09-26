import { useEffect, useState } from "react";
import { Download, Share, Plus, X, Sparkles } from "lucide-react";
import { isStandaloneDisplay } from "@/hooks/use-launch-context";

const DISMISS_KEY = "oventric:install-dismissed";
const DISMISS_DAYS = 7;

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function dismissedRecently(): boolean {
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const at = Number(raw);
    if (!Number.isFinite(at)) return false;
    return Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function inIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/**
 * Invites phone visitors to install Oventric to their home screen.
 * Android/Chrome gets the real one-tap install dialog; iOS gets the
 * two-step Share → Add to Home Screen guide (the only route Safari allows).
 */
export function AppInstallPrompt() {
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);
  const [show, setShow] = useState(false);
  const [iosMode, setIosMode] = useState(false);

  useEffect(() => {
    if (inIframe()) return;
    if (isStandaloneDisplay()) return;
    if (dismissedRecently()) return;

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as InstallEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    // iOS never fires beforeinstallprompt — show the manual guide instead.
    let timer = 0;
    if (isIos()) {
      timer = window.setTimeout(() => {
        setIosMode(true);
        setShow(true);
      }, 4000);
    }

    const onInstalled = () => setShow(false);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setShow(false);
  };

  const install = async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      await deferred.userChoice;
    } catch {
      /* ignore */
    }
    setDeferred(null);
    dismiss();
  };

  if (!show) return null;

  return (
    <div className="fixed inset-x-3 bottom-[5.5rem] z-[75] md:left-auto md:right-6 md:bottom-6 md:w-[22rem]">
      <div className="overflow-hidden rounded-[18px] border border-white/10 bg-[#0E0E12] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)]">
        <div className="h-1 w-full bg-gradient-to-r from-[#E5484D] via-[#F5A524] to-[#3E63DD]" />
        <div className="flex items-start gap-3 p-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-gradient-to-br from-[#E5484D] to-[#F5A524]">
            <Sparkles className="h-5 w-5 text-white" strokeWidth={2.4} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-bold" style={{ color: "#ffffff" }}>
              Install the Oventric app
            </p>
            <p className="mt-1 text-[12px] leading-snug text-white/55">
              {iosMode
                ? "Tap Share, then “Add to Home Screen” to open Oventric like a real app — full screen, instant, with alerts."
                : "One tap puts Oventric on your home screen — full screen, faster, with real alerts for chats and sales."}
            </p>

            {iosMode ? (
              <div className="mt-3 flex items-center gap-2 text-[11px] font-semibold text-white/70">
                <span className="inline-flex items-center gap-1 rounded-[10px] border border-white/10 bg-white/[0.04] px-2 py-1.5">
                  <Share className="h-3.5 w-3.5" /> Share
                </span>
                <span className="text-white/30">→</span>
                <span className="inline-flex items-center gap-1 rounded-[10px] border border-white/10 bg-white/[0.04] px-2 py-1.5">
                  <Plus className="h-3.5 w-3.5" /> Add to Home Screen
                </span>
              </div>
            ) : null}

            <div className="mt-3 flex items-center gap-2">
              {iosMode ? (
                <button
                  type="button"
                  onClick={dismiss}
                  className="rounded-[12px] bg-white px-4 py-2.5 text-[12px] font-bold text-black"
                >
                  Got it
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void install()}
                  className="inline-flex items-center gap-1.5 rounded-[12px] bg-white px-4 py-2.5 text-[12px] font-bold text-black"
                >
                  <Download className="h-3.5 w-3.5" strokeWidth={2.6} /> Install app
                </button>
              )}
              <button
                type="button"
                onClick={dismiss}
                className="rounded-[12px] px-3 py-2.5 text-[12px] font-semibold text-white/45"
              >
                Not now
              </button>
            </div>
          </div>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={dismiss}
            className="shrink-0 rounded-[10px] p-1 text-white/35"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
