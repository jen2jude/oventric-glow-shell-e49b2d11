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
}: {
  variant?: "dark" | "light";
  className?: string;
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
      className={`inline-flex items-center gap-0.5 rounded-full border p-0.5 ${base} ${className}`}
    >
      <button
        type="button"
        onClick={() => setUsdPreview(false)}
        className={`px-2.5 py-1 rounded-full text-[11px] font-black transition ${!usdPreview ? activeCls : ""}`}
      >
        {currencySymbol(homeCurrency)} {homeCurrency}
      </button>
      <button
        type="button"
        onClick={() => setUsdPreview(true)}
        className={`px-2.5 py-1 rounded-full text-[11px] font-black transition ${usdPreview ? activeCls : ""}`}
      >
        $ USD
      </button>
    </div>
  );
}
