import mockCashback from "@/assets/mock-cashback.jpg";
import mockFeed from "@/assets/mock-feed.jpg";
import mockMarketplace from "@/assets/mock-marketplace.jpg";
import mockAcademy from "@/assets/mock-academy.jpg";
import mockBounties from "@/assets/mock-bounties.jpg";
import mockWallet from "@/assets/mock-wallet.jpg";

type Node = { id: string; x: number; y: number; r: number; image?: string; color?: string; delay: number };

/** Coordinates are in a 200x200 viewBox space. */
const CENTER = { x: 100, y: 100 };

const NODES: Node[] = [
  { id: "n1", x: 100, y: 100, r: 17, image: mockMarketplace, delay: 0 },
  { id: "n2", x: 72, y: 62, r: 15, image: mockFeed, delay: 0.4 },
  { id: "n3", x: 140, y: 58, r: 14, image: mockAcademy, delay: 0.9 },
  { id: "n4", x: 46, y: 106, r: 13, image: mockCashback, delay: 1.3 },
  { id: "n5", x: 156, y: 112, r: 12, image: mockWallet, delay: 0.6 },
  { id: "n6", x: 74, y: 150, r: 14, image: mockBounties, delay: 1.7 },
  { id: "n7", x: 132, y: 152, r: 13, image: mockFeed, delay: 1.1 },
  { id: "n8", x: 58, y: 42, r: 6, color: "#22c55e", delay: 0.2 },
  { id: "n9", x: 168, y: 74, r: 5, color: "#f59e0b", delay: 1.5 },
  { id: "n10", x: 36, y: 148, r: 5, color: "#E5484D", delay: 0.8 },
  { id: "n11", x: 172, y: 148, r: 6, color: "#3b82f6", delay: 2.0 },
];

const LINKS: Array<[string, string]> = [
  ["n1", "n2"],
  ["n1", "n3"],
  ["n1", "n4"],
  ["n1", "n5"],
  ["n1", "n6"],
  ["n1", "n7"],
  ["n2", "n3"],
  ["n2", "n4"],
  ["n3", "n5"],
  ["n4", "n6"],
  ["n5", "n7"],
  ["n6", "n7"],
];

const byId = (id: string) => NODES.find((n) => n.id === id)!;

/**
 * Interconnected orbit of Oventric worlds — nodes gently float while animated
 * RGB lines travel between them.
 */
export function JourneyOrbit() {
  return (
    <div className="relative w-full max-w-[360px] mx-auto aspect-square select-none" aria-hidden>
      <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full ov-orbit">
        <defs>
          <linearGradient id="ovRgb" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#E5484D" />
            <stop offset="35%" stopColor="#7c3aed" />
            <stop offset="70%" stopColor="#00c2ff" />
            <stop offset="100%" stopColor="#22c55e" />
          </linearGradient>
          {NODES.filter((n) => n.image).map((n) => (
            <clipPath key={n.id} id={`clip-${n.id}`}>
              <circle cx={n.x} cy={n.y} r={n.r} />
            </clipPath>
          ))}
        </defs>

        {/* Orbit rings */}
        {[38, 60, 82].map((r) => (
          <circle
            key={r}
            cx={CENTER.x}
            cy={CENTER.y}
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.07)"
            strokeWidth={0.6}
          />
        ))}

        {/* RGB connective tissue */}
        <g className="ov-orbit-lines">
          {LINKS.map(([a, b], i) => {
            const na = byId(a);
            const nb = byId(b);
            return (
              <line
                key={`${a}-${b}`}
                x1={na.x}
                y1={na.y}
                x2={nb.x}
                y2={nb.y}
                stroke="url(#ovRgb)"
                strokeWidth={0.9}
                strokeLinecap="round"
                strokeDasharray="6 10"
                style={{ animation: `ov-line-dash ${3 + (i % 4)}s linear ${i * 0.18}s infinite` }}
              />
            );
          })}
        </g>

        {/* Nodes */}
        {NODES.map((n) => (
          <g key={n.id} style={{ animation: `ov-node-float ${5 + (n.delay % 3)}s ease-in-out ${n.delay}s infinite` }}>
            {n.image ? (
              <>
                <image
                  href={n.image}
                  x={n.x - n.r}
                  y={n.y - n.r}
                  width={n.r * 2}
                  height={n.r * 2}
                  preserveAspectRatio="xMidYMid slice"
                  clipPath={`url(#clip-${n.id})`}
                />
                <circle cx={n.x} cy={n.y} r={n.r} fill="none" stroke="url(#ovRgb)" strokeWidth={1.2} />
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
