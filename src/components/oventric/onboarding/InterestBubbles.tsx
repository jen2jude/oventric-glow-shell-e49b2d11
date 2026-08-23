import { ShoppingCart, Trophy, Sparkles, Puzzle, Users, Cpu, Wallet, GraduationCap } from "lucide-react";

import mockCashback from "@/assets/mock-cashback.jpg";
import mockFeed from "@/assets/mock-feed.jpg";
import mockMarketplace from "@/assets/mock-marketplace.jpg";
import mockAcademy from "@/assets/mock-academy.jpg";
import mockBounties from "@/assets/mock-bounties.jpg";
import mockWallet from "@/assets/mock-wallet.jpg";
import face1 from "@/assets/onboarding/face-1.jpg";
import face2 from "@/assets/onboarding/face-2.jpg";
import face3 from "@/assets/onboarding/face-3.jpg";
import face4 from "@/assets/onboarding/face-4.jpg";

type Bubble = {
  id: string;
  label: string;
  /** percentage of container width */
  size: number;
  left: number;
  top: number;
  delay: number;
  image?: string;
  color?: string;
  icon?: typeof ShoppingCart;
};

/**
 * Floating interest bubbles — fluid, organic cluster of Oventric's worlds.
 * Sizes/positions are percentages of the container so it scales on any phone.
 */
const BUBBLES: Bubble[] = [
  { id: "creators", label: "Creators", size: 26, left: 2, top: 2, delay: 0, image: face1 },
  { id: "food", label: "Food", size: 20, left: 62, top: 0, delay: 1.4, color: "#f59e0b", icon: Sparkles },
  { id: "marketplace", label: "Marketplace", size: 38, left: 4, top: 22, delay: 0.6, color: "#E5484D", icon: ShoppingCart },
  { id: "tech", label: "Tech", size: 22, left: 46, top: 21, delay: 2.1, image: mockMarketplace },
  { id: "ai", label: "AI", size: 24, left: 72, top: 26, delay: 0.9, color: "#3b82f6", icon: Cpu },
  { id: "lifestyle", label: "Lifestyle", size: 25, left: 0, top: 52, delay: 1.8, image: face2 },
  { id: "bounties", label: "Bounties", size: 40, left: 27, top: 45, delay: 0.3, color: "#7c3aed", icon: Trophy },
  { id: "plugins", label: "Plugins", size: 21, left: 70, top: 56, delay: 2.4, image: mockWallet },
  { id: "academy", label: "Academy", size: 26, left: 4, top: 76, delay: 1.1, image: face3 },
  { id: "community", label: "Community", size: 22, left: 36, top: 80, delay: 2.7, color: "#00c2ff", icon: Users },
  { id: "cashback", label: "Cashback", size: 25, left: 63, top: 78, delay: 0.5, image: face4 },
  { id: "wallet", label: "Wallet", size: 18, left: 88, top: 6, delay: 1.6, color: "#10b981", icon: Wallet },
  { id: "courses", label: "Courses", size: 17, left: 88, top: 46, delay: 2.9, color: "#ffb020", icon: GraduationCap },
  { id: "themes", label: "Themes", size: 16, left: 20, top: 4, delay: 2.2, color: "#ec4899", icon: Puzzle },
];

export function InterestBubbles() {
  return (
    <div className="relative w-full aspect-[1/1.15] max-w-[420px] mx-auto select-none" aria-hidden>
      {BUBBLES.map((b) => {
        const Icon = b.icon;
        return (
          <div
            key={b.id}
            className="absolute rounded-full overflow-hidden flex flex-col items-center justify-center text-center"
            style={{
              width: `${b.size}%`,
              height: 0,
              paddingBottom: `${b.size}%`,
              left: `${b.left}%`,
              top: `${b.top}%`,
              animation: `ov-bubble-float ${6 + (b.delay % 3)}s ease-in-out ${b.delay}s infinite`,
              willChange: "transform",
            }}
          >
            <div
              className="absolute inset-0 rounded-full overflow-hidden flex flex-col items-center justify-center gap-1 border border-white/60"
              style={{
                background: b.color
                  ? `radial-gradient(circle at 30% 25%, ${b.color}, ${b.color}bb 60%, ${b.color}88)`
                  : "#E4DDF7",
                boxShadow: `0 16px 34px -18px ${b.color ?? "#1E1B4B"}66`,
              }}
            >
              {b.image && (
                <img
                  src={b.image}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              )}
              {b.image && <div className="absolute inset-0 bg-black/35" />}
              {Icon && !b.image && (
                <Icon className="relative w-[22%] h-[22%] text-white" strokeWidth={2.2} />
              )}
              <span
                className={`relative font-semibold leading-tight px-1 ${b.color || b.image ? "text-white" : "text-[#1E1B4B]"}`}
                style={{ fontSize: `clamp(9px, ${b.size * 0.13}vw + 5px, 14px)` }}
              >
                {b.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
