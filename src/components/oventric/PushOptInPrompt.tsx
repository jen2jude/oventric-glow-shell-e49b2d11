import { useEffect, useState } from "react";
import { Bell, X, Share } from "lucide-react";
import { toast } from "sonner";
import { useAuthGate } from "@/lib/auth-gate/AuthGateProvider";
import {
  PUSH_DISMISS_KEY,
  enablePush,
  isPushEnabled,
  needsHomeScreenInstall,
  permissionState,
  pushAllowedHere,
  pushSupported,
  syncExistingPush,
} from "@/lib/push/client";

/**
 * Soft opt-in for background (notification-bar) alerts. Explains the benefit
 * first, then triggers the browser permission prompt on tap — far better
 * opt-in rates than firing the native prompt straight after sign-in.
 */
export function PushOptInPrompt() {
  const { isAuthenticated } = useAuthGate();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setShow(false);
      return;
    }
    if (!pushSupported() || !pushAllowedHere()) return;
    // iPhone browser alerts require installation; do not suggest it during the app pause.
    if (needsHomeScreenInstall()) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          if (window.localStorage.getItem(PUSH_DISMISS_KEY) === "1") return;
        } catch {
          /* ignore */
        }
        const state = permissionState();
        if (state === "granted") {
          // Already allowed — make sure the backend still knows this device.
          void syncExistingPush();
          return;
        }
        if (state === "denied") return;
        if (await isPushEnabled()) return;
        if (!cancelled) {
          setIosHint(needsHomeScreenInstall());
          setShow(true);
        }
      })();
    }, 6000);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isAuthenticated]);

  const dismiss = () => {
    try {
      window.localStorage.setItem(PUSH_DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setShow(false);
  };

  const allow = async () => {
    setBusy(true);
    try {
      const res = await enablePush();
      if (res.ok) {
        toast.success("Notifications on — we'll alert you even when the app is closed.");
        dismiss();
      } else if (res.reason === "install-required") {
        setIosHint(true);
      } else if (res.reason === "denied") {
        toast.error("Notifications blocked. Enable them in your browser settings.");
        dismiss();
      } else {
        toast.error("Couldn't turn on notifications. Try again later.");
      }
    } catch {
      toast.error("Couldn't turn on notifications. Try again later.");
    } finally {
      setBusy(false);
    }
  };

  if (!show) return null;

  return (
    <div className="fixed inset-x-3 bottom-24 z-[70] md:left-auto md:right-6 md:bottom-6 md:w-96">
      <div className="rounded-2xl border border-border bg-popover p-4 shadow-xl shadow-black/25">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary">
            <Bell className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-foreground">Never miss a message</p>
            <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
              {iosHint
                ? "On iPhone, add Oventric to your Home Screen first (tap Share, then “Add to Home Screen”), then open it from the icon to turn on alerts."
                : "Get chats, bounty updates, sales and payouts in your notification bar — even when the app is closed."}
            </p>
            <div className="mt-3 flex items-center gap-2">
              {iosHint ? (
                <button
                  type="button"
                  onClick={dismiss}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-3 text-xs font-bold text-primary-foreground"
                >
                  <Share className="h-3.5 w-3.5" /> Got it
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void allow()}
                  disabled={busy}
                  className="rounded-xl bg-primary px-3.5 py-3 text-xs font-bold text-primary-foreground disabled:opacity-60"
                >
                  {busy ? "Turning on…" : "Turn on alerts"}
                </button>
              )}
              <button
                type="button"
                onClick={dismiss}
                className="rounded-xl px-3 py-3 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                Not now
              </button>
            </div>
          </div>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={dismiss}
            className="shrink-0 rounded-[10px] p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
