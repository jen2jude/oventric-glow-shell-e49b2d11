/**
 * Shared "install the app" plumbing. One global listener captures the
 * browser's beforeinstallprompt event so any surface (the floating invite
 * card, the home-page install section) can trigger the native dialog.
 */

export type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferred: InstallPromptEvent | null = null;
let listening = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

export function ensureInstallListener() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event as InstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
}

export function getDeferredInstallPrompt(): InstallPromptEvent | null {
  ensureInstallListener();
  return deferred;
}

export function onInstallPromptChange(fn: () => void): () => void {
  ensureInstallListener();
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function triggerInstall(): Promise<"prompted" | "unavailable"> {
  const event = getDeferredInstallPrompt();
  if (!event) return "unavailable";
  try {
    await event.prompt();
    await event.userChoice;
  } catch {
    /* ignore */
  }
  deferred = null;
  notify();
  return "prompted";
}

export function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function isAndroidDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}
