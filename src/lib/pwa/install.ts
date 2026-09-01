/**
 * Global capture of the browser's `beforeinstallprompt` event so that any
 * "download the app" CTA on the URL (web) version can trigger the actual
 * web-app (PWA) install instead of a dead link.
 *
 * The listener is registered at module load — import this module once from the
 * root route so the event is never missed before a CTA mounts.
 */
import { useEffect, useState } from "react";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferredPrompt: BIPEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BIPEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    installed = true;
    emit();
  });
}

export function canInstallWebApp() {
  return deferredPrompt !== null;
}

/** Fires the native install prompt. Returns true when it was shown. */
export async function promptWebAppInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;
  const evt = deferredPrompt;
  try {
    await evt.prompt();
    await evt.userChoice.catch(() => null);
  } catch {
    return false;
  }
  deferredPrompt = null;
  emit();
  return true;
}

/** Subscribe to install availability from React. */
export function useWebAppInstall() {
  const [state, setState] = useState({ canInstall: false, installed: false });

  useEffect(() => {
    const sync = () => setState({ canInstall: canInstallWebApp(), installed });
    sync();
    listeners.add(sync);
    return () => {
      listeners.delete(sync);
    };
  }, []);

  return { ...state, install: promptWebAppInstall };
}
