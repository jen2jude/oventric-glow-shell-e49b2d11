import { useEffect, useState } from "react";
import { X, PenSquare, Target, ShoppingBag, GraduationCap, ArrowRight, Sparkles } from "lucide-react";
import { useOnboarding, type Tier } from "@/lib/onboarding/OnboardingContext";
import { SellSwitcherModal } from "./SellSwitcherModal";
import { CoursePublishWizard } from "./CoursePublishWizard";
import { BountyEditorModal } from "./BountyEditorModal";

export type ChoiceKey = "post" | "bounty" | "sell" | "course";
type Choice = {
  key: ChoiceKey;
  icon: typeof PenSquare;
  title: string;
  desc: string;
  tier: Tier;
  accent: string;
  tint: string;
  badge?: string;
};

const choices: Choice[] = [
  {
    key: "post",
    icon: PenSquare,
    title: "Drop a Post",
    desc: "Share updates, ideas, or moments with the community.",
    tier: 1,
    accent: "#A78BFA",
    tint: "rgba(167,139,250,0.10)",
    badge: "NEW",
  },
  {
    key: "bounty",
    icon: Target,
    title: "Post a Bounty ($)",
    desc: "Get expert help from the community and pay on delivery.",
    tier: 2,
    accent: "#4CC2FF",
    tint: "rgba(76,194,255,0.09)",
  },
  {
    key: "sell",
    icon: ShoppingBag,
    title: "Sell",
    desc: "List digital assets or physical products.",
    tier: 2,
    accent: "#2BD07A",
    tint: "rgba(43,208,122,0.09)",
  },
  {
    key: "course",
    icon: GraduationCap,
    title: "Publish a Course",
    desc: "Teach with video modules, free or paid.",
    tier: 2,
    accent: "#F7A50A",
    tint: "rgba(247,165,10,0.09)",
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
  const [courseOpen, setCourseOpen] = useState(false);
  const [bountyOpen, setBountyOpen] = useState(false);

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
      if (c.key === "course") {
        setCourseOpen(true);
        return;
      }
      if (c.key === "bounty") {
        setBountyOpen(true);
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

  const subOpen = sellOpen || courseOpen || bountyOpen;

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
      {open && (
        <div className="modal-light fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
          <div
            className="slide-up relative w-full max-w-2xl border border-white/10 rounded-t-[22px] sm:rounded-[22px] px-5 pt-3 pb-7 shadow-2xl"
            style={{
              background:
                "linear-gradient(180deg, #17171C 0%, #121216 55%, #0E0E12 100%)",
            }}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20 sm:hidden" />
            <div className="flex items-start justify-between gap-3 mb-5">
              <div>
                <h2 className="flex items-center gap-1.5 text-[26px] font-bold leading-tight text-white">
                  Create Something
                  <Sparkles className="h-4 w-4 text-[#A78BFA]" />
                </h2>
                <p className="mt-1 text-[13px] text-slate-400">
                  Share, earn and grow with the community.
                </p>
              </div>
              <button
                onClick={onClose}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-slate-300 hover:text-white transition-colors"
                aria-label="Close"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {choices.map((c) => (
                <button
                  key={c.key}
                  onClick={() => handleChoice(c)}
                  className="group relative overflow-hidden text-left rounded-[16px] border p-4 pb-14 transition-all active:scale-[0.98]"
                  style={{
                    borderColor: `color-mix(in oklab, ${c.accent} 40%, transparent)`,
                    background: `linear-gradient(160deg, ${c.tint}, rgba(255,255,255,0.015))`,
                  }}
                >
                  {c.badge && (
                    <span
                      className="absolute -right-8 top-2 rotate-45 px-8 py-[3px] text-[9px] font-bold tracking-wider text-white"
                      style={{ backgroundColor: c.accent }}
                    >
                      {c.badge}
                    </span>
                  )}
                  <c.icon
                    className="pointer-events-none absolute -bottom-2 right-1 h-20 w-20 opacity-[0.06]"
                    style={{ color: c.accent }}
                    strokeWidth={1.5}
                  />
                  <span
                    className="mb-3 grid h-11 w-11 place-items-center rounded-[13px] border"
                    style={{
                      borderColor: `color-mix(in oklab, ${c.accent} 55%, transparent)`,
                      backgroundColor: `color-mix(in oklab, ${c.accent} 14%, transparent)`,
                      boxShadow: `0 0 18px -6px ${c.accent}`,
                    }}
                  >
                    <c.icon className="h-5 w-5" style={{ color: c.accent }} strokeWidth={1.9} />
                  </span>
                  <div className="text-[15px] font-bold text-white leading-tight">{c.title}</div>
                  <div className="mt-1 text-[11.5px] leading-snug text-slate-400">{c.desc}</div>
                  <span
                    className="absolute bottom-3 left-1/2 grid h-8 w-8 -translate-x-1/2 place-items-center rounded-full border transition-transform group-hover:translate-y-[-2px]"
                    style={{
                      borderColor: `color-mix(in oklab, ${c.accent} 55%, transparent)`,
                      backgroundColor: `color-mix(in oklab, ${c.accent} 12%, transparent)`,
                    }}
                  >
                    <ArrowRight className="h-4 w-4" style={{ color: c.accent }} />
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

      )}
      <SellSwitcherModal open={sellOpen} onClose={() => setSellOpen(false)} />
      <CoursePublishWizard
        open={courseOpen}
        onClose={() => setCourseOpen(false)}
        onSaved={() => {
          setCourseOpen(false);
          window.dispatchEvent(
            new CustomEvent("oventric:navigate", { detail: { section: "Academy" } }),
          );
        }}
      />
      <BountyEditorModal
        open={bountyOpen}
        onClose={() => setBountyOpen(false)}
        onPublished={() => {
          window.dispatchEvent(
            new CustomEvent("oventric:navigate", { detail: { section: "Bounties" } }),
          );
        }}
      />
    </>
  );
}
