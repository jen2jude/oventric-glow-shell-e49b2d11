/**
 * Oventric ecosystem section registry.
 *
 * Every surface of a person's Oventric identity (posts, shop, services,
 * skills, courses, communities…) is described here once, so profiles,
 * shops and cross-entity navigation all adapt from the same source of
 * truth instead of hardcoding tab lists per screen.
 */

export type EcosystemSectionKey =
  | "posts"
  | "marketplace"
  | "services"
  | "courses"
  | "groups"
  | "posted"
  | "solved"
  | "skills"
  | "collections"
  | "photos"
  | "about";

export interface EcosystemSectionDef {
  key: EcosystemSectionKey;
  /** Short label used on the profile tab rail. */
  label: string;
  /** Plural noun used in empty states and link rows. */
  noun: string;
  /** Sections that always render, even with zero content. */
  alwaysVisible?: boolean;
  /** Sections that render for the owner even when empty (so they can fill them). */
  ownerVisible?: boolean;
}

export const ECOSYSTEM_SECTIONS: EcosystemSectionDef[] = [
  { key: "posts", label: "Posts", noun: "posts", alwaysVisible: true },
  { key: "marketplace", label: "Shop", noun: "products", ownerVisible: true },
  { key: "services", label: "Services", noun: "services", ownerVisible: true },
  { key: "skills", label: "Skills", noun: "skills", ownerVisible: true },
  { key: "courses", label: "Courses", noun: "courses" },
  { key: "collections", label: "Collections", noun: "boards", ownerVisible: true },
  { key: "groups", label: "Communities", noun: "communities" },
  { key: "posted", label: "Bounties", noun: "bounties" },
  { key: "solved", label: "Solved", noun: "solved bounties" },
  { key: "photos", label: "Photos", noun: "photos", alwaysVisible: true },
  { key: "about", label: "About", noun: "details", alwaysVisible: true },
];

export type EcosystemCounts = Partial<Record<EcosystemSectionKey, number>>;

export interface VisibleSection extends EcosystemSectionDef {
  count: number | null;
}

/**
 * Builds the adaptive section list for a profile: sections with no content
 * are dropped, so a designer, a course creator and a business each get a
 * profile shaped by what they actually do.
 */
/**
 * Paused (non-MVP) sections. Definitions stay above for future reactivation,
 * but they are never rendered on an active profile.
 */
const PAUSED_SECTIONS = new Set<EcosystemSectionKey>(["courses", "posted", "solved"]);

export function buildProfileSections(
  counts: EcosystemCounts,
  opts: { isOwner?: boolean } = {},
): VisibleSection[] {
  return ECOSYSTEM_SECTIONS.filter((s) => {
    if (PAUSED_SECTIONS.has(s.key)) return false;
    if (s.alwaysVisible) return true;
    if (opts.isOwner && s.ownerVisible) return true;
    return (counts[s.key] ?? 0) > 0;
  }).map((s) => ({ ...s, count: counts[s.key] ?? null }));
}

export function sectionLabel(key: EcosystemSectionKey): string {
  return ECOSYSTEM_SECTIONS.find((s) => s.key === key)?.label ?? key;
}

export function sectionNoun(key: EcosystemSectionKey): string {
  return ECOSYSTEM_SECTIONS.find((s) => s.key === key)?.noun ?? "items";
}
