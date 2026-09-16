import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Home,
  Users,
  MessageSquare,
  ShoppingBag,
  Wallet,
  Target,
  Package,
  LayoutDashboard,
  Gift,
  Store,
  GraduationCap,
  BookOpen,
  Award,
  FileText,
  HelpCircle,
  Info,
  MessageCircle,
  Bug,
  type LucideIcon,
} from "lucide-react";

type Item = {
  label: string;
  desc: string;
  icon: LucideIcon;
  color: string;
  tint: string;
  section?: string;
  to?: string;
  action?: "sell";
};

type Group = { title: string; items: Item[] };

const GROUPS: Group[] = [
  {
    title: "Community",
    items: [
      {
        label: "Feed",
        desc: "Stay updated",
        icon: Home,
        color: "#5B8DEF",
        tint: "rgba(91,141,239,0.12)",
        section: "Feed",
      },
      {
        label: "Circles",
        desc: "Join communities",
        icon: Users,
        color: "#A78BFA",
        tint: "rgba(167,139,250,0.12)",
        section: "Circles",
      },
      {
        label: "Messages",
        desc: "Chat with users",
        icon: MessageSquare,
        color: "#7C6CF6",
        tint: "rgba(124,108,246,0.12)",
        section: "Messages",
      },
    ],
  },
  {
    title: "Commerce",
    items: [
      {
        label: "Market",
        desc: "Buy & sell products",
        icon: ShoppingBag,
        color: "#3B6FF6",
        tint: "rgba(59,111,246,0.12)",
        section: "Marketplace",
      },
      {
        label: "Wallet",
        desc: "Manage your funds",
        icon: Wallet,
        color: "#2BD07A",
        tint: "rgba(43,208,122,0.12)",
        section: "Wallet",
      },
      {
        label: "Bounties",
        desc: "Complete tasks",
        icon: Target,
        color: "#F7B500",
        tint: "rgba(247,181,0,0.12)",
        section: "Bounties",
      },
      {
        label: "Orders",
        desc: "Track your orders",
        icon: Package,
        color: "#D97BE8",
        tint: "rgba(217,123,232,0.12)",
        to: "/dashboard",
      },
    ],
  },
  {
    title: "Business",
    items: [
      {
        label: "Dashboard",
        desc: "Analytics overview",
        icon: LayoutDashboard,
        color: "#5B8DEF",
        tint: "rgba(91,141,239,0.12)",
        to: "/dashboard",
      },
      {
        label: "Affiliate",
        desc: "Earn with referrals",
        icon: Gift,
        color: "#E5484D",
        tint: "rgba(229,72,77,0.12)",
        to: "/affiliate",
      },
      {
        label: "Sell",
        desc: "List your products",
        icon: Store,
        color: "#E5484D",
        tint: "rgba(229,72,77,0.12)",
        action: "sell",
      },
    ],
  },
  {
    title: "Learning",
    items: [
      {
        label: "Academy",
        desc: "Online courses",
        icon: GraduationCap,
        color: "#A78BFA",
        tint: "rgba(167,139,250,0.12)",
        section: "Academy",
      },
      {
        label: "Course",
        desc: "Your learning",
        icon: BookOpen,
        color: "#5B8DEF",
        tint: "rgba(91,141,239,0.12)",
        section: "Academy",
      },
      {
        label: "Certifications",
        desc: "Get certified",
        icon: Award,
        color: "#E5484D",
        tint: "rgba(229,72,77,0.12)",
        section: "Academy",
      },
      {
        label: "Resources",
        desc: "Useful tools",
        icon: FileText,
        color: "#7C6CF6",
        tint: "rgba(124,108,246,0.12)",
        to: "/help",
      },
    ],
  },
  {
    title: "Support",
    items: [
      {
        label: "Help Center",
        desc: "Get support",
        icon: HelpCircle,
        color: "#E7E7EA",
        tint: "rgba(255,255,255,0.08)",
        to: "/help",
      },
      {
        label: "Guides",
        desc: "How it works",
        icon: Info,
        color: "#2BD07A",
        tint: "rgba(43,208,122,0.12)",
        to: "/faq",
      },
      {
        label: "Contact Us",
        desc: "Talk to us",
        icon: MessageCircle,
        color: "#2BD07A",
        tint: "rgba(43,208,122,0.12)",
        to: "/help-board",
      },
      {
        label: "Feedback",
        desc: "Share feedback",
        icon: Bug,
        color: "#E5484D",
        tint: "rgba(229,72,77,0.12)",
        to: "/report-problem",
      },
    ],
  },
];

export function AllFeaturesSheet({
  open,
  onClose,
  onSelect,
  onSell,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (section: string) => void;
  onSell: () => void;
}) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  const run = (it: Item) => {
    onClose();
    if (it.action === "sell") return onSell();
    if (it.section) return onSelect(it.section);
    if (it.to) void navigate({ to: it.to });
  };

  return createPortal(
    <div className="fixed inset-0 z-[120] overflow-y-auto bg-[#08080A]">
      <div className="mx-auto w-full max-w-2xl px-4 pb-24 pt-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            aria-label="Back"
            className="p-1 text-white active:scale-95 transition-transform"
          >
            <ArrowLeft className="h-6 w-6" strokeWidth={2} />
          </button>
          <h1 className="text-[19px] font-bold text-white">All Features</h1>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-[#0E0E11] px-4">
          {GROUPS.map((g, gi) => (
            <section
              key={g.title}
              className={gi > 0 ? "border-t border-white/[0.07] py-5" : "py-5"}
            >
              <h2 className="mb-4 text-[15px] font-semibold text-white">{g.title}</h2>
              <div className="grid grid-cols-4 gap-y-5 gap-x-2">
                {g.items.map((it) => (
                  <button
                    key={`${g.title}-${it.label}`}
                    type="button"
                    onClick={() => run(it)}
                    className="flex flex-col items-center gap-2 active:scale-95 transition-transform"
                  >
                    <span
                      className="grid h-11 w-11 place-items-center rounded-xl border border-white/10"
                      style={{ backgroundColor: it.tint }}
                    >
                      <it.icon className="h-5 w-5" style={{ color: it.color }} strokeWidth={1.8} />
                    </span>
                    <span className="text-[11.5px] font-semibold leading-tight text-white text-center">
                      {it.label}
                    </span>
                    <span className="text-[9.5px] leading-tight text-slate-500 text-center">
                      {it.desc}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
