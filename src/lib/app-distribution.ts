/**
 * Android APK + iOS PWA distribution config.
 *
 * Oventric ships Android as a directly-downloadable APK (built locally from the
 * Capacitor `android/` project) and iOS as an installable PWA. Point
 * `VITE_ANDROID_APK_URL` at wherever you host the signed APK; the default
 * assumes it is dropped into `public/downloads/`.
 */

const configuredApkUrl = (import.meta.env["VITE_ANDROID_APK_URL"] as string | undefined)?.trim();

/** True only when a real APK URL has been configured for this deployment. */
export const ANDROID_APK_AVAILABLE = Boolean(configuredApkUrl);

/** Falls back to the install guide page so the CTA is never a dead download. */
export const ANDROID_APK_URL = configuredApkUrl || "/get-app";

export const ANDROID_APP_VERSION =
  (import.meta.env["VITE_ANDROID_APK_VERSION"] as string | undefined) ?? "1.0.0";

export const ANDROID_APK_SIZE =
  (import.meta.env["VITE_ANDROID_APK_SIZE"] as string | undefined) ?? "~12 MB";

export type MobilePlatform = "android" | "ios" | "desktop";

/** Best-effort platform sniffing for choosing the right install path. */
export function detectPlatform(): MobilePlatform {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  if (/android/i.test(ua)) return "android";
  const isIpadOS =
    /Macintosh/.test(ua) && typeof document !== "undefined" && "ontouchend" in document;
  if (/iPad|iPhone|iPod/.test(ua) || isIpadOS) return "ios";
  return "desktop";
}

/** True when the site is already running as an installed PWA. */
export function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export const IOS_INSTALL_STEPS = [
  "Open oventric.com in Safari (not Chrome).",
  "Tap the Share button at the bottom of the screen.",
  "Scroll down and tap “Add to Home Screen”.",
  "Tap Add — Oventric now opens full screen like a native app.",
];

export const ANDROID_INSTALL_STEPS = [
  "Tap “Download the APK” — the file saves to your Downloads.",
  "Open the file and allow installs from your browser if prompted.",
  "Tap Install, then Open — Oventric is now on your home screen.",
];
