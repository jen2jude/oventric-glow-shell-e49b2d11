import { useEffect, useState } from "react";
import { X, PenSquare, ShoppingBag, ArrowUpRight } from "lucide-react";
import { useOnboarding, type Tier } from "@/lib/onboarding/OnboardingContext";
import { Button } from "@/components/ui/button";
import { SellSwitcherModal } from "./SellSwitcherModal";

// Academy (courses) and Bounties are not active MVP features: their creation
// entry points are removed here. Legacy modules remain for future reactivation.
export type ChoiceKey = "post" | "sell";
type Choice = {
  key: ChoiceKey;
  icon: typeof PenSquare;
  title: string;
  desc: string;
  tier: Tier;
  iconClass: string;
  iconSurfaceClass: string;
  badge?: string;
};

const choices: Choice[] = [
  {
    key: "post",
    icon: PenSquare,
    title: "Drop a Post",
    desc: "Share updates, ideas, or moments with the community.",
    tier: 1,
    iconClass: "text-create-post",
    iconSurfaceClass: "bg-create-post-soft",
    badge: "NEW",
  },
  {
    key: "sell",
    icon: ShoppingBag,
    title: "Sell a digital product",
    desc: "List digital assets, templates and downloads.",
    tier: 2,
    iconClass: "text-create-sell",
    iconSurfaceClass: "bg-create-sell-soft",
  },
];


export function CreatePanel({
  open,
  onClose,
  initialChoice,
}: {
  open: boolean;
  onClose: () => void;
  initialChoice?: ChoiceKey | null;
}) {
  const { require } = useOnboarding();
  const [sellOpen, setSellOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // NOTE: the parent often unmounts <CreatePanel /> as soon as onClose() runs,
  // which would destroy the sub-modal state below. So for sell/course/bounty we
  // keep this component mounted and only hide the chooser, calling onClose()
  // once the sub-modal itself closes.
  const handleChoice = (c: Choice) => {
    require(c.tier, () => {
      if (c.key === "sell") {
        setSellOpen(true);
        return;
      }
      onClose();
      window.dispatchEvent(new CustomEvent("oventric:navigate", { detail: { section: "Feed" } }));
      // Delay so Feed can mount before we scroll/focus its composer.
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("oventric:create", { detail: { kind: c.key } }));
      }, 80);
    });
  };

  const subOpen = sellOpen;

  useEffect(() => {
    if (!open || !initialChoice) return;
    const choice = choices.find((item) => item.key === initialChoice);
    if (!choice) return;
    handleChoice(choice);
    // The requested choice is intentionally handled once when the panel opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialChoice]);

  return (
    <>
      {open && !subOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-6">
          <Button
            type="button"
            variant="ghost"
            className="absolute inset-0 cursor-default bg-create-overlay backdrop-blur-[2px]"
            onClick={onClose}
            aria-label="Close create menu"
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-panel-title"
            className="slide-up relative w-full max-w-[620px] overflow-hidden rounded-t-[10px] border border-create-border bg-create-surface px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3 shadow-create-panel sm:rounded-[10px] sm:p-6"
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-create-handle sm:hidden" />
            <div className="mb-5 flex items-start justify-between gap-4 sm:mb-6">
              <div>
                <span className="mb-1 block text-[11px] font-bold uppercase text-create-brand">
                  Create on Oventric
                </span>
                <h2 id="create-panel-title" className="text-[24px] font-extrabold leading-tight text-create-title sm:text-[28px]">
                  Create something
                </h2>
                <p className="mt-1.5 text-[13px] leading-relaxed text-create-copy sm:text-sm">
                  Share, earn and grow with the community.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-10 w-10 shrink-0 rounded-full border border-create-border bg-create-muted text-create-copy shadow-none hover:bg-create-hover hover:text-create-title"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3">
              {choices.map((c) => (
                <Button
                  key={c.key}
                  type="button"
                  variant="ghost"
                  onClick={() => handleChoice(c)}
                  className="group relative h-auto min-h-[92px] w-full justify-start whitespace-normal rounded-[10px] border border-create-border bg-create-card px-3.5 py-3 text-left shadow-none transition-[border-color,background-color,transform,box-shadow] hover:border-create-border-strong hover:bg-create-hover hover:text-create-title hover:shadow-create-card active:scale-[0.99] sm:min-h-[132px] sm:flex-col sm:items-start sm:p-4"
                >
                  <span
                    className={`grid h-11 w-11 shrink-0 place-items-center rounded-[10px] ${c.iconSurfaceClass} ${c.iconClass}`}
                  >
                    <c.icon className="h-5 w-5" strokeWidth={2} />
                  </span>
                  <span className="min-w-0 flex-1 sm:mt-1">
                    <span className="flex items-center gap-2 text-[15px] font-bold leading-tight text-create-title">
                      {c.title}
                      {c.badge && (
                        <span className="rounded-full bg-create-brand-soft px-2 py-0.5 text-[9px] font-extrabold uppercase text-create-brand">
                          {c.badge}
                        </span>
                      )}
                    </span>
                    <span className="mt-1 block text-[11.5px] font-normal leading-snug text-create-copy sm:text-xs">
                      {c.desc}
                    </span>
                  </span>
                  <ArrowUpRight className="ml-auto h-4 w-4 shrink-0 text-create-arrow transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 sm:absolute sm:right-4 sm:top-4" />
                </Button>
              ))}
            </div>
          </section>
        </div>

      )}
      <SellSwitcherModal
        open={sellOpen}
        onClose={() => {
          setSellOpen(false);
          onClose();
        }}
      />
    </>
  );
}
