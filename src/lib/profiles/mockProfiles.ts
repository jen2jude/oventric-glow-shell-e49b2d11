export interface ProfilePost {
  id: string;
  content: string;
  timeAgo: string;
  likes: number;
  comments: number;
  /** Signed media URLs attached to the post (images or a video). */
  mediaUrls?: string[];
  mediaType?: string | null;
}

export interface ProfileGroup {
  id: string;
  name: string;
  members: number;
  tag: string;
}
export interface ProfileListing {
  id: string;
  title: string;
  category: string;
  priceUsd: number;
  sales: number;
  coverUrl?: string | null;
  rating?: number;
  blurb?: string | null;
  promoted?: boolean;
  cashbackPct?: number;
  /** Publish-time currency + FX snapshot so prices match the marketplace. */
  originalCurrency?: string | null;
  originalAmount?: number | null;
  /** False when the seller marked the listing out of stock. */
  inStock?: boolean;
  fxSnapshot?: {
    base?: string;
    rates?: Record<string, number>;
    source?: string;
    fetched_at?: string;
  } | null;
}
export interface ProfileBounty {
  id: string;
  title: string;
  amountUsd: number;
  applicants?: number;
  proof?: string;
  status: "open" | "solved";
  coverUrl?: string | null;
}
export interface ProfileArticle {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string | null;
  timeAgo: string;
  reactions: number;
  comments: number;
  coverUrl?: string | null;
}
export interface Profile {
  id: string;
  name: string;
  initials: string;
  role: string;
  bio: string;
  avatarGradient: string;
  joined: string;
  followers: number;
  reputation: {
    bountiesSolved: number;
    coursesCompleted: number;
    salesCount: number;
    disputeRate: number; // percent (lower is better)
    retentionRate: number; // percent of buyers/students who stay active (higher is better)
    refundRate: number; // percent of orders refunded (lower is better)
    activityScore: number; // 0-100, platform usage frequency (days active in last 30)
  };
  posts: ProfilePost[];
  groups: ProfileGroup[];
  listings: ProfileListing[];
  bountiesPosted: ProfileBounty[];
  bountiesSolved: ProfileBounty[];
  dm: { from: "them" | "me"; text: string; time: string }[];
}

const base: Record<string, Profile> = {
  "aria-kessler": {
    id: "aria-kessler",
    name: "Aria Kessler",
    initials: "AK",
    role: "Staff Engineer · Kessler Labs",
    bio: "Postgres-obsessed backend engineer. I ship RLS-first multi-tenant systems and mentor devs on scaling data layers.",
    avatarGradient: "from-purple-500 to-pink-500",
    joined: "March 2023",
    followers: 4820,
    reputation: {
      bountiesSolved: 27,
      coursesCompleted: 12,
      salesCount: 341,
      disputeRate: 0.4,
      retentionRate: 92,
      refundRate: 1.2,
      activityScore: 88,
    },
    posts: [
      {
        id: "p1",
        content:
          "Just shipped a zero-downtime migration on our multi-tenant Postgres cluster. RLS + logical replication saved us weeks.",
        timeAgo: "2h ago",
        likes: 128,
        comments: 24,
      },
      {
        id: "p2",
        content: "Hot take: most 'realtime' features are just polling with extra steps. Fight me in the comments.",
        timeAgo: "1d ago",
        likes: 412,
        comments: 89,
      },
      {
        id: "p3",
        content: "Dropped v2 of my Postgres RLS Starter Kit — now with typed policy helpers and audit log middleware.",
        timeAgo: "3d ago",
        likes: 256,
        comments: 41,
      },
    ],
    groups: [
      { id: "g1", name: "Postgres Power Users", members: 12400, tag: "Database" },
      { id: "g2", name: "SaaS Architects Circle", members: 8200, tag: "Architecture" },
      { id: "g3", name: "Edge Runtime Builders", members: 5100, tag: "Infra" },
      { id: "g4", name: "Women in Backend", members: 9700, tag: "Community" },
    ],
    listings: [
      { id: "l1", title: "Postgres RLS Starter Kit", category: "Scripts", priceUsd: 49, sales: 341 },
      { id: "l2", title: "Supabase Audit Log Middleware", category: "Plugins", priceUsd: 29, sales: 128 },
      { id: "l3", title: "Multi-tenant Schema Blueprint", category: "HTML Blocks", priceUsd: 79, sales: 62 },
    ],
    bountiesPosted: [
      { id: "b1", title: "Convert Prisma schema to Drizzle w/ RLS policies", amountUsd: 450, applicants: 12, status: "open" },
      { id: "b2", title: "Write a pgvector migration tool", amountUsd: 900, applicants: 6, status: "open" },
    ],
    bountiesSolved: [
      {
        id: "s1",
        title: "Realtime notification fan-out on Cloudflare Workers",
        amountUsd: 1200,
        proof: "PR merged, 99.98% delivery, <40ms p95 across 12 regions.",
        status: "solved",
      },
      {
        id: "s2",
        title: "Zero-downtime pg_dump replacement",
        amountUsd: 800,
        proof: "Open-sourced tool, benchmarked 3x faster on 400GB dataset.",
        status: "solved",
      },
    ],
    dm: [
      { from: "them", text: "Hey! Loved your RLS post — do you consult?", time: "10:14" },
      { from: "me", text: "Thanks! Occasionally — DM me your scope.", time: "10:22" },
      { from: "them", text: "Cool, sending a brief later today.", time: "10:23" },
    ],
  },
};

export function getProfile(id: string): Profile {
  if (base[id]) return base[id];
  // fallback generated profile so any id routes cleanly
  const pretty = id
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
  const initials = pretty
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return {
    id,
    name: pretty || "Anonymous Builder",
    initials: initials || "??",
    role: "Independent Builder",
    bio: "Building in public on Oventric.",
    avatarGradient: "from-emerald-400 to-emerald-600",
    joined: "2024",
    followers: 128,
    reputation: {
      bountiesSolved: 3,
      coursesCompleted: 2,
      salesCount: 14,
      disputeRate: 1.1,
      retentionRate: 70,
      refundRate: 3.5,
      activityScore: 55,
    },
    posts: [
      { id: "p1", content: "New here — shipping small things every day.", timeAgo: "5h ago", likes: 12, comments: 3 },
    ],
    groups: [{ id: "g1", name: "Indie Hackers", members: 2100, tag: "Community" }],
    listings: [{ id: "l1", title: "Starter Template", category: "Themes", priceUsd: 19, sales: 4 }],
    bountiesPosted: [],
    bountiesSolved: [],
    dm: [{ from: "them", text: "Hey, thanks for connecting!", time: "09:00" }],
  };
}

export interface StarBreakdownItem {
  key: string;
  label: string;
  detail: string;
  weight: number; // 0-1
  score: number; // 0-1 normalized contribution
  raw: string; // human-friendly raw value
}

export interface StarBreakdown {
  stars: number; // 0-5
  items: StarBreakdownItem[];
}

/**
 * Derive a 0-5 star rating from utility metrics. Each component is
 * normalized to 0-1, weighted, then scaled to 5.
 */
export function computeStarBreakdown(rep: Profile["reputation"]): StarBreakdown {
  const clamp = (n: number) => Math.max(0, Math.min(1, n));

  const bountyScore = clamp(rep.bountiesSolved / 30);
  const retentionScore = clamp(rep.retentionRate / 100);
  const refundScore = clamp(1 - (rep.refundRate + rep.disputeRate) / 20); // 0% -> 1, 20%+ -> 0
  const coursesScore = clamp(rep.coursesCompleted / 15);
  const activityScore = clamp(rep.activityScore / 100);

  const items: StarBreakdownItem[] = [
    {
      key: "bounties",
      label: "Completed bounties",
      detail: "Verified paid work delivered on-platform",
      weight: 0.25,
      score: bountyScore,
      raw: `${rep.bountiesSolved} solved`,
    },
    {
      key: "retention",
      label: "Customer retention",
      detail: "Share of buyers & students who stay active after 30 days",
      weight: 0.2,
      score: retentionScore,
      raw: `${rep.retentionRate}%`,
    },
    {
      key: "refunds",
      label: "Refunds & disputes",
      detail: "Lower is better — inverse of refund + dispute rate",
      weight: 0.2,
      score: refundScore,
      raw: `${rep.refundRate}% refunds · ${rep.disputeRate}% disputes`,
    },
    {
      key: "courses",
      label: "Learning progress",
      detail: "Courses completed on Academy",
      weight: 0.1,
      score: coursesScore,
      raw: `${rep.coursesCompleted} courses`,
    },
    {
      key: "activity",
      label: "Platform activity",
      detail: "How often the user shows up (active days in last 30)",
      weight: 0.25,
      score: activityScore,
      raw: `${rep.activityScore}/100`,
    },
  ];

  const weighted = items.reduce((sum, i) => sum + i.score * i.weight, 0);
  const stars = Math.round(weighted * 5 * 10) / 10;
  return { stars, items };
}


export interface CircleMember {
  id: string;
  name: string;
  initials: string;
  avatarGradient: string;
}

export interface CircleMembersPreview {
  total: number;
  preview: CircleMember[];
}

const CIRCLE_POOL: CircleMember[] = [
  { id: "mira-okonkwo", name: "Mira Okonkwo", initials: "MO", avatarGradient: "from-emerald-400 to-teal-500" },
  { id: "jules-tan", name: "Jules Tan", initials: "JT", avatarGradient: "from-sky-400 to-indigo-500" },
  { id: "devon-ray", name: "Devon Ray", initials: "DR", avatarGradient: "from-amber-400 to-orange-500" },
  { id: "sana-iqbal", name: "Sana Iqbal", initials: "SI", avatarGradient: "from-fuchsia-500 to-pink-500" },
  { id: "kai-mendez", name: "Kai Mendez", initials: "KM", avatarGradient: "from-rose-400 to-red-500" },
  { id: "elena-vos", name: "Elena Vos", initials: "EV", avatarGradient: "from-lime-400 to-green-500" },
  { id: "priya-shah", name: "Priya Shah", initials: "PS", avatarGradient: "from-violet-500 to-purple-500" },
  { id: "leo-arden", name: "Leo Arden", initials: "LA", avatarGradient: "from-cyan-400 to-blue-500" },
];

/** Deterministic circle preview derived from profile id + follower count. */
export function getCircleMembersPreview(profile: Profile): CircleMembersPreview {
  let seed = 0;
  for (const ch of profile.id) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const pool = [...CIRCLE_POOL];
  for (let i = pool.length - 1; i > 0; i--) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    const j = seed % (i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const preview = pool.slice(0, 5);
  const total = Math.max(12, Math.min(480, Math.round(profile.followers * 0.02) + preview.length));
  return { total, preview };
}
