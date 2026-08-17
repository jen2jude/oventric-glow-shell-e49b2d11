import { SiteFooter } from "@/components/oventric/desktop/SiteFooter";
import { useOnboarding } from "@/lib/onboarding/OnboardingProvider";
import { COUNTRY_META } from "@/lib/currency/africa";
import { useIsAppShell } from "@/hooks/use-launch-context";

/**
 * Footer for the URL (web) version. Renders on browse/content pages only —
 * it is hidden inside the mobile app shell so the app keeps its bottom nav.
 * Section links route back to the home route with ?section=<name>.
 */
export function SiteFooterAuto({ className = "" }: { className?: string }) {
  const isAppShell = useIsAppShell();
  const { baseCurrency, country } = useOnboarding();

  if (isAppShell) return null;

  const currency = country ? baseCurrency : "USD";
  const flag = country ? (COUNTRY_META[country]?.flag ?? "") : "";

  const onSelect = (section: string) => {
    if (typeof window === "undefined") return;
    if (window.location.pathname === "/") {
      window.dispatchEvent(new CustomEvent("oventric:navigate", { detail: { section } }));
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    window.location.href = `/?section=${encodeURIComponent(section)}`;
  };

  return (
    <div className={`hidden md:block ${className}`}>
      <SiteFooter onSelect={onSelect} currency={currency ?? "USD"} flag={flag} />
    </div>
  );
}
