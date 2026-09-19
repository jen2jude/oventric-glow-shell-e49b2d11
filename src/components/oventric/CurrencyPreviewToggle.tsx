import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { currencySymbol } from "@/lib/fx-display";

/**
 * Display-currency switcher: home currency ⇄ USD.
 *
 * USD is a *preview* only. Every transaction (checkout, wallet, publishing,
 * payouts) is forced back to the user's home currency, because that is the
 * only currency they can buy and sell in.
 */
export function CurrencyPreviewToggle({
  variant = "dark",
  className = "",
  compact = false,
}: {
  variant?: "dark" | "light";
  className?: string;
  compact?: boolean;
}) {
  const { homeCurrency, usdPreview, setUsdPreview } = useOnboarding();
  if (!homeCurrency || homeCurrency === "USD") return null;

  const light = variant === "light";
  const base = light
    ? "border-slate-200 bg-slate-100 text-slate-500"
    : "border-white/10 bg-white/[0.04] text-slate-400";
  const activeCls = light ? "bg-white text-slate-900 shadow-sm" : "bg-[#E5484D] text-white";

  return (
    <div
      role="group"
      aria-label="Display currency"
      title="Preview prices in USD. You always pay and get paid in your home currency."
      className={`inline-flex items-center rounded-full border ${compact ? "gap-[1px] p-[1px]" : "gap-0.5 p-0.5"} ${base} ${className}`}
    >
      <button
        type="button"
        onClick={() => setUsdPreview(false)}
        className={`rounded-full font-black transition ${compact ? "px-1.5 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]"} ${!usdPreview ? activeCls : ""}`}
      >
        {compact ? currencySymbol(homeCurrency) : `${currencySymbol(homeCurrency)} ${homeCurrency}`}
      </button>
      <button
        type="button"
        onClick={() => setUsdPreview(true)}
        className={`rounded-full font-black transition ${compact ? "px-1.5 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]"} ${usdPreview ? activeCls : ""}`}
      >
        {compact ? "$" : "$ USD"}
      </button>
    </div>
  );
}
