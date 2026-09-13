import { X, Smartphone, ArrowRight, Download } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { useWebAppInstall } from "@/lib/pwa/install";

/**
 * Modal shown on the browser (URL) version when a visitor tries to use an
 * app-only feature. Offers the one-tap PWA install when the browser allows
 * it, otherwise deep-links to the /get-app page with full instructions.
 */
export function GetAppModal({
  open,
  onClose,
  title = "This lives in the Oventric app",
  description = "Install the Oventric app to use your wallet, checkout, chat, bounties and creator tools.",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
}) {
  const { canInstall, install } = useWebAppInstall();
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-[16px] border border-slate-200 bg-white p-6 shadow-2xl sm:rounded-[10px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-[10px] bg-[#E5484D]/10 text-[#E5484D]">
            <Smartphone className="h-6 w-6" />
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <h2 className="mt-4 text-lg font-extrabold tracking-tight text-slate-900">{title}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{description}</p>

        <div className="mt-5 grid gap-2">
          {canInstall && (
            <button
              type="button"
              onClick={() => void install()}
              className="inline-flex items-center justify-center gap-2 rounded-[10px] bg-[#E5484D] px-5 py-3 text-sm font-bold text-white shadow-[0_10px_30px_-12px_rgba(229,72,77,0.9)] transition-transform active:scale-95"
            >
              <Download className="h-4 w-4" /> Install the app now
            </button>
          )}
          <Link
            to="/get-app"
            className={`inline-flex items-center justify-center gap-2 rounded-[10px] px-5 py-3 text-sm font-bold transition-transform active:scale-95 ${
              canInstall
                ? "border border-slate-200 bg-slate-50 text-slate-700"
                : "bg-[#E5484D] text-white shadow-[0_10px_30px_-12px_rgba(229,72,77,0.9)]"
            }`}
          >
            How to install <ArrowRight className="h-4 w-4" />
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800"
          >
            Keep browsing
          </button>
        </div>
      </div>
    </div>
  );
}
