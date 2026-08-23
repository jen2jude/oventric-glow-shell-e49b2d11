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

type Node = { id: string; x: number; y: number; r: number; image?: string; color?: string; delay: number };

/** Coordinates are in a 200x200 viewBox space. */
const CENTER = { x: 100, y: 100 };

const NODES: Node[] = [
  // center
  { id: "c", x: 100, y: 100, r: 15, image: face1, delay: 0 },
  // inner ring
  { id: "i1", x: 100, y: 62, r: 14, image: face2, delay: 0.5 },
  { id: "i2", x: 137, y: 118, r: 13, image: mockAcademy, delay: 1.1 },
  { id: "i3", x: 63, y: 122, r: 13, image: face3, delay: 0.8 },
  // outer ring
  { id: "o1", x: 152, y: 66, r: 13, image: mockBounties, delay: 1.4 },
  { id: "o2", x: 46, y: 72, r: 13, image: face4, delay: 0.3 },
  { id: "o3", x: 168, y: 128, r: 12, image: mockFeed, delay: 1.8 },
  { id: "o4", x: 34, y: 136, r: 12, image: mockCashback, delay: 0.9 },
  { id: "o5", x: 76, y: 166, r: 13, image: mockMarketplace, delay: 2.1 },
  { id: "o6", x: 130, y: 172, r: 12, image: mockWallet, delay: 1.6 },

  // accent dots
  { id: "d1", x: 66, y: 96, r: 6, color: "#22c55e", delay: 0.2 },
  { id: "d2", x: 40, y: 108, r: 4, color: "#f59e0b", delay: 1.5 },
  { id: "d3", x: 174, y: 96, r: 5, color: "#ec4899", delay: 0.7 },
  { id: "d4", x: 104, y: 186, r: 4, color: "#3b82f6", delay: 2.0 },
];

/**
 * Orbit of Oventric worlds — soft concentric rings with floating avatar nodes,
 * mirroring the onboarding reference.
 */
export function JourneyOrbit() {
  return (
    <div className="relative w-full max-w-[340px] mx-auto aspect-square select-none" aria-hidden>
      <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full ov-orbit">
        <defs>
          {NODES.filter((n) => n.image).map((n) => (
            <clipPath key={n.id} id={`clip-${n.id}`}>
              <circle cx={n.x} cy={n.y} r={n.r} />
            </clipPath>
          ))}
        </defs>

        {/* Soft filled orbit rings */}
        <circle cx={CENTER.x} cy={CENTER.y} r={86} fill="rgba(124,58,237,0.05)" stroke="rgba(124,58,237,0.18)" strokeWidth={0.7} />
        <circle cx={CENTER.x} cy={CENTER.y} r={58} fill="rgba(124,58,237,0.08)" stroke="rgba(124,58,237,0.22)" strokeWidth={0.7} />
        <circle cx={CENTER.x} cy={CENTER.y} r={32} fill="rgba(124,58,237,0.14)" stroke="rgba(124,58,237,0.28)" strokeWidth={0.7} />

        {/* Nodes */}
        {NODES.map((n) => (
          <g key={n.id} style={{ animation: `ov-node-float ${5 + (n.delay % 3)}s ease-in-out ${n.delay}s infinite` }}>
            {n.image ? (
              <>
                <circle cx={n.x} cy={n.y} r={n.r + 1.6} fill="#ffffff" />
                <image
                  href={n.image}
                  x={n.x - n.r}
                  y={n.y - n.r}
                  width={n.r * 2}
                  height={n.r * 2}
                  preserveAspectRatio="xMidYMid slice"
                  clipPath={`url(#clip-${n.id})`}
                />
              </>
            ) : (
              <circle cx={n.x} cy={n.y} r={n.r} fill={n.color} />
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}
