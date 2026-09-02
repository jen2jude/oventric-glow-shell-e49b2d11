import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Smartphone, ArrowRight, ShieldCheck, Zap } from "lucide-react";

import { useLaunchContext } from "@/hooks/use-launch-context";

/**
 * The URL (browser) version of Oventric is the marketing + discovery surface.
 * Transactional, wallet, messaging and creator flows live in the app shell
 * (native build or installed PWA).
 *
 * Returns:
 *  - null    → launch context not resolved yet (avoid flashing a gate)
 *  - true    → browser visitor, feature should be gated behind "Get the app"
 *  - false   → app shell, render the real feature
 */
export function useAppOnly(): boolean | null {
  // The URL version now ships the full feature set while the native app is
  // being built elsewhere, so nothing is gated behind "get the app".
  useLaunchContext();
  return false;
}

export function GetAppButton({
  label = "Continue in the app",
  from,
  className = "",
}: {
  label?: string;
  from?: string;
  className?: string;
}) {
  return (
    <Link
      to="/get-app"
      search={from ? { from } : undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-[10px] bg-[#E5484D] px-5 py-3 text-sm font-bold text-white shadow-[0_10px_30px_-12px_rgba(229,72,77,0.9)] transition-transform active:scale-95 ${className}`}
    >
      <Smartphone className="h-4 w-4" />
      {label}
      <ArrowRight className="h-4 w-4" />
    </Link>
  );
}

/** Full-screen "this lives in the app" panel. */
export function AppOnlyScreen({
  title,
  description,
  from,
}: {
  title: string;
  description: string;
  from?: string;
}) {
  return (
    <div className="flex min-h-[70vh] w-full items-center justify-center px-5 py-16">
      <div className="w-full max-w-md rounded-[10px] border border-slate-200 bg-white p-7 text-center shadow-[0_30px_80px_-40px_rgba(15,23,42,0.35)]">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-[10px] bg-[#E5484D]/10 text-[#E5484D]">
          <Smartphone className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-extrabold tracking-tight text-slate-900">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{description}</p>

        <div className="mt-6 grid gap-2 text-left">
          <Feature icon={<ShieldCheck className="h-4 w-4" />} text="Escrow-protected payments & wallet" />
          <Feature icon={<Zap className="h-4 w-4" />} text="Instant chat, alerts and order updates" />
        </div>

        <div className="mt-6 flex flex-col items-center gap-3">
          <GetAppButton from={from} className="w-full" />
          <Link to="/" className="text-xs font-semibold text-slate-500 hover:text-slate-800">
            Keep browsing Oventric
          </Link>
        </div>
      </div>
    </div>
  );
}

function Feature({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-[10px] bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
      <span className="text-[#E5484D]">{icon}</span>
      {text}
    </div>
  );
}

/**
 * Wrap any app-only surface. On the browser it renders the "Get the app"
 * screen; inside the app shell it renders children untouched.
 */
export function AppOnlyGate({
  title,
  description,
  from,
  children,
}: {
  title: string;
  description: string;
  from?: string;
  children: ReactNode;
}) {
  const gated = useAppOnly();
  if (gated === null) return null;
  if (gated) return <AppOnlyScreen title={title} description={description} from={from} />;
  return <>{children}</>;
}
