import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

import { isStableBucket, stableImageUrl, stableImageUrls } from "@/lib/storage/stable-image";
import type {
  ProfileArticle,
  ProfileBounty,
  ProfileGroup,
  ProfileListing,
  ProfilePost,
} from "./profiles/mockProfiles";

const TabEnum = z.enum([
  "posts",
  "groups",
  "marketplace",
  "services",
  "courses",
  "posted",
  "solved",
  "blog",
]);

const SortEnum = z.enum([
  "newest",
  "most_liked",
  "most_commented",
  "most_members",
  "alpha",
  "price_low",
  "price_high",
  "most_sold",
  "highest_bounty",
  "lowest_bounty",
  "most_applicants",
]);
export type ProfileSortKey = z.infer<typeof SortEnum>;

const TabInput = z.object({
  profileId: z.string().trim().min(1).max(120),
  tab: TabEnum,
  page: z.number().int().min(1).max(200).default(1),
  pageSize: z.number().int().min(1).max(50).default(6),
  q: z.string().trim().max(120).optional().default(""),
  sort: SortEnum.optional().default("newest"),
});

export type ProfileTabItem =
  | ProfilePost
  | ProfileGroup
  | ProfileListing
  | ProfileBounty
  | ProfileArticle;

export interface ProfileTabPage {
  items: ProfileTabItem[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export const getProfileTab = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => TabInput.parse(input))
  .handler(async ({ data }): Promise<ProfileTabPage> => {
    const { loadProfileTab } = await import("@/lib/profiles/data.server");
    // Small artificial latency so pagination UX is observable in the demo.
    await new Promise((r) => setTimeout(r, 120));
    if (data.tab === "blog" || data.tab === "services" || data.tab === "courses") {
      return { items: [], total: 0, page: data.page, pageSize: data.pageSize, hasMore: false };
    }

    return loadProfileTab(data.profileId, data.tab, data.page, data.pageSize, {
      q: data.q,
      sort: data.sort,
    });
  });


const KindEnum = z.enum(["post", "group", "listing", "bounty", "solved"]);
const ItemInput = z.object({
  profileId: z.string().trim().min(1).max(120),
  kind: KindEnum,
  itemId: z.string().trim().min(1).max(200),
});

export type ProfileItemKind = z.infer<typeof KindEnum>;

export const getProfileItem = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => ItemInput.parse(input))
  .handler(async ({ data }): Promise<{ item: ProfileTabItem | null }> => {
    const { loadProfileItem } = await import("@/lib/profiles/data.server");
    const item = loadProfileItem(data.profileId, data.kind, data.itemId);
    return { item };
  });


// ---------------------------------------------------------------------------
// Real profile view (by user_id UUID or slug/username). Falls back cleanly
// when nothing matches so the route can render an empty state.
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    if (isNewSupabaseApiKey(supabaseKey) && headers.get("Authorization") === `Bearer ${supabaseKey}`) {
      headers.delete("Authorization");
    }

    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

async function createServerPublicClient(): Promise<SupabaseClient<Database>> {
  const { createClient } = await import("@supabase/supabase-js");
  const supabaseUrl = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !publishableKey) throw new Error("Backend is not configured");
  return createClient<Database>(supabaseUrl, publishableKey, {
    global: { fetch: createSupabaseFetch(publishableKey) },
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Profile imagery lives in private, owner-bound buckets, so signing must be
 * done with the privileged storage client — the publishable/anon client can
 * only sign its own files and would otherwise return broken URLs.
 */
async function resolveProfileImageUrl(
  _supabase: SupabaseClient<Database> | null,
  bucket: "avatars" | "profile-covers",
  path: string | null,
): Promise<string | null> {
  if (!path) return null;
  const stable = stableImageUrl(bucket, path);
  if (stable) return stable;

  const storage = await imageStorage();
  const { data: signed, error } = await storage
    .from(bucket)
    .createSignedUrl(path, 60 * 60 * 24 * 7);
  if (signed?.signedUrl) return signed.signedUrl;

  if (error) console.error(`[profiles] ${bucket} signed URL failed`, error);
  const { data } = storage.from(bucket).getPublicUrl(path);
  return data.publicUrl || null;
}

import { normaliseTools, normaliseSkillLevels } from "./profiles/tools";
import { imageStorage } from "@/lib/storage/images.server";

export interface SocialLinks {
  website?: string;
  x?: string;
  instagram?: string;
  linkedin?: string;
  github?: string;
  youtube?: string;
  tiktok?: string;
  facebook?: string;
  whatsapp?: string;
  telegram?: string;
}

/** Normalises an unknown jsonb blob into a safe SocialLinks object. */
export function normaliseSocialLinks(raw: unknown): SocialLinks {
  const out: SocialLinks = {};
  if (!raw || typeof raw !== "object") return out;
  const keys: Array<keyof SocialLinks> = [
    "website",
    "x",
    "instagram",
    "linkedin",
    "github",
    "youtube",
    "tiktok",
    "facebook",
    "whatsapp",
    "telegram",
  ];
  for (const k of keys) {
    const v = (raw as Record<string, unknown>)[k];
    if (typeof v === "string" && v.trim()) out[k] = v.trim().slice(0, 200);
  }
  return out;
}

/** Pulls the optional creator work/portfolio links off the profile JSON. */
function readWorkLinks(raw: unknown): string[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const v = (raw as Record<string, unknown>)["work_links"];
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).slice(0, 3);
}

/** Normalises an unknown value into a clean, de-duped skills/tags list. */
export function normaliseSkills(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v !== "string") continue;
    const tag = v.trim().replace(/\s+/g, " ").slice(0, 32);
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (out.length >= 20) break;
  }
  return out;
}

export interface RealProfileView {
  userId: string;
  slug: string;
  displayName: string;
  username: string | null;
  bio: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  socialLinks: SocialLinks;
  skills: string[];
  interests: string[];
  skillLevels: Record<string, number>;
  tools: string[];
  /** Optional creator showcase links ("Work & portfolio"). */
  workLinks: string[];
  /** True once the user finished the creator onboarding workflow. */
  isCreator: boolean;


  verificationTier: string;
  reputationStars: number;
  country: string | null;
  address: string | null;
  addressPublic: boolean;
  dateOfBirth: string | null;
  dobPublic: boolean;
  joined: string; // ISO
}


const ViewInput = z.object({ idOrSlug: z.string().trim().min(1).max(120) });

export const getProfileByIdOrSlug = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => ViewInput.parse(input))
  .handler(async ({ data }): Promise<{ profile: RealProfileView | null }> => {
    const supabase = await createServerPublicClient();
    // Use admin for country/address which are restricted columns.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const looksLikeUuid = UUID_RE.test(data.idOrSlug);
    const query = supabaseAdmin
      .from("profiles")
      .select(
        "user_id, slug, display_name, username, bio, avatar_path, cover_path, social_links, skills, interests, skill_levels, tools, creator_profile, verification_tier, reputation_stars, country, address, address_public, date_of_birth, dob_public, created_at",
      )
      .limit(1);

    const { data: row, error } = looksLikeUuid
      ? await query.eq("user_id", data.idOrSlug).maybeSingle()
      : await query.or(`slug.eq.${data.idOrSlug},username.eq.${data.idOrSlug}`).maybeSingle();

    if (error) {
      console.error("[getProfileByIdOrSlug] read failed", error);
      return { profile: null };
    }
    if (!row) return { profile: null };

    const [avatarUrl, coverUrl] = await Promise.all([
      resolveProfileImageUrl(supabase, "avatars", row.avatar_path),
      resolveProfileImageUrl(supabase, "profile-covers", row.cover_path),
    ]);

    const cleanDisplay = (row.display_name ?? "").trim();
    const cleanUsername = (row.username ?? "").trim();
    const addressPublic = !!(row as { address_public?: boolean }).address_public;
    const dobPublic = !!(row as { dob_public?: boolean }).dob_public;
    return {
      profile: {
        userId: row.user_id,
        slug: row.slug,
        displayName: cleanDisplay || cleanUsername || row.slug,
        username: row.username,
        bio: row.bio,
        avatarUrl,
        coverUrl,
        socialLinks: normaliseSocialLinks((row as { social_links?: unknown }).social_links),
        skills: normaliseSkills((row as { skills?: unknown }).skills),
        interests: normaliseSkills((row as { interests?: unknown }).interests),
        skillLevels: normaliseSkillLevels((row as { skill_levels?: unknown }).skill_levels),
        tools: normaliseTools((row as { tools?: unknown }).tools),
        workLinks: readWorkLinks((row as { creator_profile?: unknown }).creator_profile),
        isCreator:
          ((row as { creator_profile?: { is_creator?: unknown } | null }).creator_profile?.is_creator) === true,
        verificationTier: row.verification_tier,
        reputationStars: Number(row.reputation_stars ?? 0),
        country: (row as { country?: string | null }).country ?? null,
        // Private-by-default: never leak address / DOB unless the owner opted in.
        address: addressPublic ? ((row as { address?: string | null }).address ?? null) : null,
        addressPublic,
        dateOfBirth: dobPublic ? ((row as { date_of_birth?: string | null }).date_of_birth ?? null) : null,
        dobPublic,
        joined: row.created_at,
      },
    };
  });





// ---------------------------------------------------------------------------
// Live social counts (followers, circle members) for a profile slug.
// Backed by a security-definer SQL function so counts are accurate even
// when RLS hides individual circle_requests rows from the viewer.
// ---------------------------------------------------------------------------

export interface ProfileSocialCounts {
  followers: number;
  following: number;
  circleMembers: number;
  userId: string | null;
}

export const getProfileSocialCounts = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => ViewInput.parse(input))
  .handler(async ({ data }): Promise<ProfileSocialCounts> => {
    const supabase = await createServerPublicClient();

    // Resolve to a slug + user_id. Accept slug/username directly; look up by user_id UUID.
    let slug = data.idOrSlug;
    let userId: string | null = null;
    if (UUID_RE.test(data.idOrSlug)) {
      userId = data.idOrSlug;
      const { data: row } = await supabase
        .from("profiles")
        .select("slug")
        .eq("user_id", data.idOrSlug)
        .maybeSingle();
      if (!row?.slug) return { followers: 0, following: 0, circleMembers: 0, userId };
      slug = row.slug;
    } else {
      const { data: row } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("slug", data.idOrSlug)
        .maybeSingle();
      userId = row?.user_id ?? null;
    }

    const { data: rows, error } = await supabase.rpc("profile_social_counts", { _slug: slug });
    if (error) console.error("[getProfileSocialCounts] rpc failed", error);
    const first = Array.isArray(rows) ? rows[0] : rows;
    return {
      followers: Number(first?.followers ?? 0),
      following: Number((first as { following?: number } | null)?.following ?? 0),
      circleMembers: Number(first?.circle_members ?? 0),
      userId,
    };
  });





// ---------------------------------------------------------------------------
// Update the authenticated user's own profile (name, bio, avatar path).
// ---------------------------------------------------------------------------

const NotificationPrefsInput = z.object({
  email_digest: z.boolean(),
  dm_pings: z.boolean(),
  bounty_invites: z.boolean(),
});
export type NotificationPreferences = z.infer<typeof NotificationPrefsInput>;
export const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  email_digest: true,
  dm_pings: true,
  bounty_invites: true,
};

const UpdateInput = z.object({
  displayName: z.string().trim().min(1).max(80).optional(),
  bio: z.string().trim().max(280).optional().nullable(),
  avatarPath: z.string().trim().max(300).optional().nullable(),
  coverPath: z.string().trim().max(300).optional().nullable(),

  username: z
    .string()
    .trim()
    .min(3)
    .max(24)
    .regex(/^[a-zA-Z0-9_]+$/, "Letters, numbers, and underscore only")
    .optional()
    .nullable(),
  phone: z.string().trim().min(6).max(24).optional().nullable(),
  country: z.string().trim().max(60).optional().nullable(),
  address: z.string().trim().max(200).optional().nullable(),
  addressPublic: z.boolean().optional(),
  dateOfBirth: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .optional()
    .nullable(),
  dobPublic: z.boolean().optional(),
  socialLinks: z
    .object({
      website: z.string().trim().max(200).optional(),
      x: z.string().trim().max(200).optional(),
      instagram: z.string().trim().max(200).optional(),
      linkedin: z.string().trim().max(200).optional(),
      github: z.string().trim().max(200).optional(),
      youtube: z.string().trim().max(200).optional(),
      tiktok: z.string().trim().max(200).optional(),
      facebook: z.string().trim().max(200).optional(),
      whatsapp: z.string().trim().max(200).optional(),
      telegram: z.string().trim().max(200).optional(),
    })
    .optional(),
  skills: z.array(z.string().trim().max(32)).max(20).optional(),
  interests: z.array(z.string().trim().max(32)).max(20).optional(),
  skillLevels: z.record(z.string(), z.number()).optional(),
  tools: z.array(z.string().trim().max(40)).max(12).optional(),
  notificationPreferences: NotificationPrefsInput.optional(),

});


export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpdateInput.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch: {
      display_name?: string;
      bio?: string | null;
      avatar_path?: string | null;
      cover_path?: string | null;
      username?: string | null;
      phone?: string | null;
      country?: string | null;
      address?: string | null;
      address_public?: boolean;
      date_of_birth?: string | null;
      dob_public?: boolean;
      social_links?: Record<string, string>;
      skills?: string[];
      interests?: string[];
      skill_levels?: Record<string, number>;
      tools?: string[];
      notification_preferences?: NotificationPreferences;
    } = {};
    if (data.displayName !== undefined) patch.display_name = data.displayName;
    if (data.bio !== undefined) patch.bio = data.bio;
    if (data.avatarPath !== undefined) patch.avatar_path = data.avatarPath;
    if (data.coverPath !== undefined) patch.cover_path = data.coverPath;

    if (data.username !== undefined) patch.username = data.username;
    if (data.phone !== undefined) patch.phone = data.phone;
    if (data.country !== undefined) patch.country = data.country;
    if (data.address !== undefined) patch.address = data.address;
    if (data.addressPublic !== undefined) patch.address_public = data.addressPublic;
    if (data.dateOfBirth !== undefined) patch.date_of_birth = data.dateOfBirth;
    if (data.dobPublic !== undefined) patch.dob_public = data.dobPublic;
    if (data.socialLinks !== undefined) patch.social_links = normaliseSocialLinks(data.socialLinks) as Record<string, string>;
    if (data.skills !== undefined) patch.skills = normaliseSkills(data.skills);
    if (data.interests !== undefined) patch.interests = normaliseSkills(data.interests);
    if (data.skillLevels !== undefined) patch.skill_levels = normaliseSkillLevels(data.skillLevels);
    if (data.tools !== undefined) patch.tools = normaliseTools(data.tools);
    if (data.notificationPreferences !== undefined) patch.notification_preferences = data.notificationPreferences;


    if (Object.keys(patch).length === 0) return { ok: true };

    const { error } = await supabase.from("profiles").update(patch).eq("user_id", userId);
    if (error) {
      console.error("[updateMyProfile] update failed", error);
      // Unique-violation on username
      if ((error as { code?: string }).code === "23505") {
        throw new Error("That username is taken. Try another.");
      }
      throw new Error("Failed to update profile");
    }
    return { ok: true };
  });


// ---------------------------------------------------------------------------
// Full self-profile fetch for the settings modal — includes editable fields
// plus live verification tier and KYC state (with signed avatar URL).
// ---------------------------------------------------------------------------

export interface MyFullProfile {
  userId: string;
  slug: string;
  email: string | null;
  displayName: string;
  username: string | null;
  bio: string | null;
  phone: string | null;
  country: string | null;
  address: string | null;
  addressPublic: boolean;
  dateOfBirth: string | null;
  dobPublic: boolean;
  socialLinks: SocialLinks;
  skills: string[];
  interests: string[];
  skillLevels: Record<string, number>;
  tools: string[];

  avatarUrl: string | null;
  /** True once the user finished the creator onboarding workflow. */
  isCreator: boolean;
  verificationTier: string;
  reputationStars: number;
  kycCompletedAt: string | null;
  kycSelfieUploaded: boolean;
  kycIdUploaded: boolean;
  profileCompletedAt: string | null;
  joined: string;
  notificationPreferences: NotificationPreferences;
}


export const getMyFullProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ profile: MyFullProfile | null }> => {
    const { supabase, userId } = context;
    // Sensitive columns (phone, country, address, kyc_*) are not exposed through
    // column-level grants for `authenticated`. Owner reads the full row via the
    // service-role client, strictly scoped to their own user_id.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("profiles")
      .select(
        "user_id, slug, display_name, username, bio, phone, country, address, address_public, date_of_birth, dob_public, avatar_path, social_links, skills, interests, skill_levels, tools, creator_profile, verification_tier, reputation_stars, kyc_completed_at, kyc_selfie_path, kyc_id_path, profile_completed_at, notification_preferences, created_at",
      )
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      console.error("[getMyFullProfile] read failed", error);
      return { profile: null };
    }
    if (!row) return { profile: null };
    let avatarUrl: string | null = null;
    if (row.avatar_path) avatarUrl = stableImageUrl("avatars", row.avatar_path);
    const { data: userRes } = await supabase.auth.getUser();
    const email = userRes?.user?.email ?? null;
    return {
      profile: {
        userId: row.user_id,
        slug: row.slug,
        email,
        displayName: (row.display_name ?? "").trim() || (row.username ?? "").trim() || row.slug,
        username: row.username,
        bio: row.bio,
        phone: row.phone,
        country: row.country,
        address: (row as { address?: string | null }).address ?? null,
        addressPublic: !!(row as { address_public?: boolean }).address_public,
        dateOfBirth: (row as { date_of_birth?: string | null }).date_of_birth ?? null,
        dobPublic: !!(row as { dob_public?: boolean }).dob_public,
        socialLinks: normaliseSocialLinks((row as { social_links?: unknown }).social_links),
        skills: normaliseSkills((row as { skills?: unknown }).skills),
        interests: normaliseSkills((row as { interests?: unknown }).interests),
        skillLevels: normaliseSkillLevels((row as { skill_levels?: unknown }).skill_levels),
        tools: normaliseTools((row as { tools?: unknown }).tools),
        avatarUrl,
        isCreator:
          ((row as { creator_profile?: { is_creator?: unknown } | null }).creator_profile?.is_creator) === true,
        verificationTier: row.verification_tier,
        reputationStars: Number(row.reputation_stars ?? 0),
        kycCompletedAt: row.kyc_completed_at,
        kycSelfieUploaded: !!row.kyc_selfie_path,
        kycIdUploaded: !!(row as { kyc_id_path?: string | null }).kyc_id_path,
        profileCompletedAt: row.profile_completed_at,
        joined: row.created_at,
        notificationPreferences: {
          ...DEFAULT_NOTIFICATION_PREFS,
          ...((row as { notification_preferences?: Partial<NotificationPreferences> }).notification_preferences ?? {}),
        },

      },
    };
  });


// ---------------------------------------------------------------------------
// Danger zone — soft-delete the authenticated user's account. Requires the
// caller to type their exact email as confirmation. Uses the admin client
// with `shouldSoftDelete: true` so the auth row is retained for 30 days and
// can be restored on request.
// ---------------------------------------------------------------------------

const DeleteAccountInput = z.object({
  confirmEmail: z.string().trim().email().max(255),
  reason: z.string().trim().min(4).max(1000),
  livenessPath: z.string().trim().min(1).max(500),
});

/**
 * Soft-delete the current user's account.
 * Sets `deleted_at = now()` on their profile. A daily cron job hard-deletes
 * accounts whose `deleted_at` is older than 30 days. Users can log in during
 * the grace window and reactivate.
 */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DeleteAccountInput.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes?.user) throw new Error("Not authenticated");
    const email = userRes.user.email ?? "";
    if (email.toLowerCase() !== data.confirmEmail.toLowerCase()) {
      throw new Error("Email confirmation does not match your account.");
    }

    const { error: upErr } = await supabase
      .from("profiles")
      .update({
        deleted_at: new Date().toISOString(),
        deletion_reason: data.reason,
        deletion_liveness_path: data.livenessPath,
      })
      .eq("user_id", userId);
    if (upErr) {
      console.error("[deleteMyAccount] soft-delete failed", upErr);
      throw new Error("Could not schedule deletion. Please try again.");
    }
    return { ok: true, scheduledFor: new Date(Date.now() + 30 * 86400_000).toISOString() };
  });

/**
 * Check whether the currently-signed-in user has scheduled their account
 * for deletion. Used to show the reactivation prompt on sign-in.
 */
export const getMyDeletionStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("profiles")
      .select("deleted_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) return { deletedAt: null as string | null, daysRemaining: null as number | null };
    const deletedAt = (data?.deleted_at as string | null) ?? null;
    if (!deletedAt) return { deletedAt: null, daysRemaining: null };
    const ms = new Date(deletedAt).getTime() + 30 * 86400_000 - Date.now();
    const daysRemaining = Math.max(0, Math.ceil(ms / 86400_000));
    return { deletedAt, daysRemaining };
  });

const ReactivateInput = z.object({
  livenessPath: z.string().trim().min(1).max(500),
});

/**
 * Cancel a pending soft-delete. Requires a fresh liveness selfie upload
 * to prove the same user is present.
 */
export const reactivateMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ReactivateInput.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("profiles")
      .update({
        deleted_at: null,
        deletion_reason: null,
        deletion_liveness_path: data.livenessPath,
      })
      .eq("user_id", userId);
    if (error) throw new Error("Could not reactivate. Please try again.");
    return { ok: true };
  });







// ---------------------------------------------------------------------------
// Live profile tab / item — queries the real Supabase tables tied to the
// resolved profile owner. Falls back cleanly to empty pages when a tab has
// no real data source (groups, solved).
// ---------------------------------------------------------------------------

const LiveTabInput = z.object({
  idOrSlug: z.string().trim().min(1).max(120),
  tab: TabEnum,
  page: z.number().int().min(1).max(200).default(1),
  pageSize: z.number().int().min(1).max(50).default(6),
  q: z.string().trim().max(120).optional().default(""),
  sort: SortEnum.optional().default("newest"),
});

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

async function resolveUserId(
  supabase: any,
  idOrSlug: string,
): Promise<string | null> {
  if (UUID_RE.test(idOrSlug)) return idOrSlug;
  const { data } = await supabase
    .from("profiles")
    .select("user_id")
    .or(`slug.eq.${idOrSlug},username.eq.${idOrSlug}`)
    .maybeSingle();
  return (data as { user_id?: string } | null)?.user_id ?? null;
}

async function signPaths(
  _supabase: any,
  bucket: string,
  paths: (string | null)[],
): Promise<(string | null)[]> {
  if (isStableBucket(bucket)) return stableImageUrls(bucket, paths);
  const unique = Array.from(new Set(paths.filter((p): p is string => !!p)));
  if (unique.length === 0) return paths.map(() => null);
  const storage = await imageStorage();
  const { data } = await storage.from(bucket).createSignedUrls(unique, 60 * 60 * 24 * 7);
  const map = new Map<string, string>();
  for (const r of (data ?? []) as { path?: string; signedUrl?: string }[]) {
    if (r.path && r.signedUrl) map.set(r.path, r.signedUrl);
  }
  return paths.map((p) => (p ? map.get(p) ?? null : null));
}


export const getLiveProfileTab = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => LiveTabInput.parse(input))
  .handler(async ({ data }): Promise<ProfileTabPage> => {
    const supabase = await createServerPublicClient();

    const userId = await resolveUserId(supabase, data.idOrSlug);
    const empty: ProfileTabPage = {
      items: [],
      total: 0,
      page: data.page,
      pageSize: data.pageSize,
      hasMore: false,
    };
    if (!userId) return empty;

    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;

    if (data.tab === "posts") {
      let q = supabase
        .from("posts")
        .select("id, text, created_at, media_path, media_paths, media_type", { count: "exact" })
        .eq("author_id", userId);
      if (data.q) q = q.ilike("text", `%${data.q}%`);
      q = q.order("created_at", { ascending: false }).range(from, to);
      const { data: rows, count } = await q;
      const ids = (rows ?? []).map((r) => r.id as string);
      const [likesRes, commentsRes] = await Promise.all([
        ids.length
          ? supabase.from("post_likes").select("post_id").in("post_id", ids)
          : Promise.resolve({ data: [] as { post_id: string }[] }),
        ids.length
          ? supabase.from("post_comments").select("post_id").in("post_id", ids)
          : Promise.resolve({ data: [] as { post_id: string }[] }),
      ]);
      const likeMap = new Map<string, number>();
      const commentMap = new Map<string, number>();
      for (const r of (likesRes.data ?? []) as { post_id: string }[])
        likeMap.set(r.post_id, (likeMap.get(r.post_id) ?? 0) + 1);
      for (const r of (commentsRes.data ?? []) as { post_id: string }[])
        commentMap.set(r.post_id, (commentMap.get(r.post_id) ?? 0) + 1);

      // Sign attached post media so the wall can render a real feed.
      const mediaPaths = new Set<string>();
      for (const r of (rows ?? []) as any[]) {
        const arr = Array.isArray(r.media_paths) ? (r.media_paths as string[]) : [];
        arr.forEach((p) => p && mediaPaths.add(p));
        if (r.media_path) mediaPaths.add(r.media_path as string);
      }
      const signedMedia = new Map<string, string>();
      for (const p of mediaPaths) {
        const url = stableImageUrl("post-media", p);
        if (url) signedMedia.set(p, url);
      }

      let items: ProfilePost[] = (rows ?? []).map((r: any) => {
        const paths: string[] = Array.isArray(r.media_paths) && r.media_paths.length
          ? r.media_paths
          : r.media_path
            ? [r.media_path]
            : [];
        return {
          id: r.id as string,
          content: (r.text as string) ?? "",
          timeAgo: timeAgo(r.created_at as string),
          likes: likeMap.get(r.id as string) ?? 0,
          comments: commentMap.get(r.id as string) ?? 0,
          mediaUrls: paths.map((p) => signedMedia.get(p)).filter((u): u is string => !!u),
          mediaType: (r.media_type as string | null) ?? null,
        };
      });

      if (data.sort === "most_liked") items = [...items].sort((a, b) => b.likes - a.likes);
      else if (data.sort === "most_commented")
        items = [...items].sort((a, b) => b.comments - a.comments);
      const total = count ?? items.length;
      return { items, total, page: data.page, pageSize: data.pageSize, hasMore: from + items.length < total };
    }

    if (data.tab === "marketplace" || data.tab === "services") {
      let q = supabase
        .from("products")
        .select(
          "id, name, category, price_usd, original_currency, original_amount, fx_snapshot, created_at, cover_path, image_paths, rating, description, promoted, cashback_pct, in_stock",
          { count: "exact" },
        )
        .eq("seller_id", userId)
        // Creator showcase assets belong to the Creators tab, not the storefront.
        .eq("creator_asset", false);
      q = data.tab === "services" ? q.eq("kind", "service") : q.neq("kind", "service");

      if (data.q) q = q.ilike("name", `%${data.q}%`);
      if (data.sort === "price_low") q = q.order("price_usd", { ascending: true });
      else if (data.sort === "price_high") q = q.order("price_usd", { ascending: false });
      else if (data.sort === "alpha") q = q.order("name", { ascending: true });
      else q = q.order("created_at", { ascending: false });
      const { data: rows, count } = await q.range(from, to);
      const ids = (rows ?? []).map((r) => r.id as string);
      const salesRes = ids.length
        ? await supabase
            .from("orders")
            .select("product_id")
            .in("product_id", ids)
            .eq("status", "paid")
        : { data: [] as { product_id: string }[] };
      const salesMap = new Map<string, number>();
      for (const r of (salesRes.data ?? []) as { product_id: string }[])
        salesMap.set(r.product_id, (salesMap.get(r.product_id) ?? 0) + 1);

      const coverPaths = (rows ?? []).map((r: any) => {
        const cp = typeof r.cover_path === "string" && r.cover_path ? r.cover_path : null;
        const imgs = Array.isArray(r.image_paths) ? (r.image_paths as unknown[]).filter((v): v is string => typeof v === "string") : [];
        return cp ?? imgs[0] ?? null;
      });
      const coverUrls = await signPaths(supabase, "product-covers", coverPaths);

      let items: ProfileListing[] = (rows ?? []).map((r, i) => ({
        id: r.id as string,
        title: (r.name as string) ?? "Untitled",
        category: (r.category as string) ?? "General",
        priceUsd: Number(r.price_usd ?? 0),
        originalCurrency: ((r as any).original_currency as string) ?? null,
        originalAmount:
          (r as any).original_amount != null ? Number((r as any).original_amount) : null,
        fxSnapshot: (r as any).fx_snapshot ?? null,
        sales: salesMap.get(r.id as string) ?? 0,
        coverUrl: coverUrls[i],
        rating: Number((r as { rating?: number }).rating ?? 0),
        blurb: ((r as { description?: string | null }).description ?? null),
        promoted: !!(r as { promoted?: boolean }).promoted,
        cashbackPct: Math.max(0, Math.min(50, Number((r as { cashback_pct?: number }).cashback_pct ?? 0))),
        inStock: (r as { in_stock?: boolean }).in_stock !== false,
      }));
      if (data.sort === "most_sold") items = [...items].sort((a, b) => b.sales - a.sales);
      const total = count ?? items.length;
      return { items, total, page: data.page, pageSize: data.pageSize, hasMore: from + items.length < total };
    }

    if (data.tab === "courses") {
      let q = supabase
        .from("courses")
        .select("id, title, category, price_usd, is_free, cover_path, created_at", {
          count: "exact",
        })
        .eq("owner_id", userId)
        .eq("is_published", true);
      if (data.q) q = q.ilike("title", `%${data.q}%`);
      if (data.sort === "price_low") q = q.order("price_usd", { ascending: true });
      else if (data.sort === "price_high") q = q.order("price_usd", { ascending: false });
      else if (data.sort === "alpha") q = q.order("title", { ascending: true });
      else q = q.order("created_at", { ascending: false });
      const { data: rows, count } = await q.range(from, to);
      const coverUrls = await signPaths(
        supabase,
        "course-covers",
        (rows ?? []).map((r: any) =>
          typeof r.cover_path === "string" && r.cover_path ? r.cover_path : null,
        ),
      );
      const items: ProfileListing[] = (rows ?? []).map((r: any, i: number) => ({
        id: r.id as string,
        title: (r.title as string) ?? "Untitled",
        category: (r.category as string) ?? "Course",
        priceUsd: r.is_free ? 0 : Number(r.price_usd ?? 0),
        sales: 0,
        coverUrl: coverUrls[i],
      }));
      const total = count ?? items.length;
      return {
        items,
        total,
        page: data.page,
        pageSize: data.pageSize,
        hasMore: from + items.length < total,
      };
    }


    if (data.tab === "posted") {
      let q = supabase
        .from("bounties")
        .select("id, title, price_usd, applicant_limit, status, created_at, cover_path, image_paths", { count: "exact" })
        .eq("poster_id", userId)
        .neq("status", "solved");
      if (data.q) q = q.ilike("title", `%${data.q}%`);
      if (data.sort === "highest_bounty") q = q.order("price_usd", { ascending: false });
      else if (data.sort === "lowest_bounty") q = q.order("price_usd", { ascending: true });
      else q = q.order("created_at", { ascending: false });
      const { data: rows, count } = await q.range(from, to);
      const coverPaths = (rows ?? []).map((r: any) => {
        const cp = typeof r.cover_path === "string" && r.cover_path ? r.cover_path : null;
        const imgs = Array.isArray(r.image_paths) ? (r.image_paths as unknown[]).filter((v): v is string => typeof v === "string") : [];
        return cp ?? imgs[0] ?? null;
      });
      const coverUrls = await signPaths(supabase, "bounty-covers", coverPaths);
      const items: ProfileBounty[] = (rows ?? []).map((r: any, i) => ({
        id: r.id as string,
        title: (r.title as string) ?? "Untitled",
        amountUsd: Number(r.price_usd ?? 0),
        applicants: Number(r.applicant_limit ?? 0),
        status: "open",
        coverUrl: coverUrls[i],
      }));
      const total = count ?? items.length;
      return { items, total, page: data.page, pageSize: data.pageSize, hasMore: from + items.length < total };
    }

    if (data.tab === "solved") {
      let q = supabase
        .from("bounties")
        .select("id, title, price_usd, status, updated_at, cover_path, image_paths", { count: "exact" })
        .eq("poster_id", userId)
        .eq("status", "solved");
      if (data.q) q = q.ilike("title", `%${data.q}%`);
      if (data.sort === "highest_bounty") q = q.order("price_usd", { ascending: false });
      else if (data.sort === "lowest_bounty") q = q.order("price_usd", { ascending: true });
      else q = q.order("updated_at", { ascending: false });
      const { data: rows, count } = await q.range(from, to);
      const coverPaths = (rows ?? []).map((r: any) => {
        const cp = typeof r.cover_path === "string" && r.cover_path ? r.cover_path : null;
        const imgs = Array.isArray(r.image_paths) ? (r.image_paths as unknown[]).filter((v): v is string => typeof v === "string") : [];
        return cp ?? imgs[0] ?? null;
      });
      const coverUrls = await signPaths(supabase, "bounty-covers", coverPaths);
      const items: ProfileBounty[] = (rows ?? []).map((r: any, i) => ({
        id: r.id as string,
        title: (r.title as string) ?? "Untitled",
        amountUsd: Number(r.price_usd ?? 0),
        proof: "Marked solved on Oventric.",
        status: "solved",
        coverUrl: coverUrls[i],
      }));
      const total = count ?? items.length;
      return { items, total, page: data.page, pageSize: data.pageSize, hasMore: from + items.length < total };
    }

    if (data.tab === "blog") {
      let q = supabase
        .from("blog_posts")
        .select("id, slug, title, excerpt, cover_path, category_id, published_at", { count: "exact" })
        .eq("author_id", userId)
        .eq("status", "published");
      if (data.q) q = q.ilike("title", `%${data.q}%`);
      if (data.sort === "alpha") q = q.order("title", { ascending: true });
      else q = q.order("published_at", { ascending: false, nullsFirst: false });
      const { data: rows, count } = await q.range(from, to);

      const ids = (rows ?? []).map((r: any) => r.id as string);
      const catIds = Array.from(
        new Set((rows ?? []).map((r: any) => r.category_id).filter((v: any): v is string => !!v)),
      );
      const [catsRes, reactRes, commentRes] = await Promise.all([
        catIds.length
          ? supabase.from("blog_categories").select("id, name").in("id", catIds)
          : Promise.resolve({ data: [] as any[] }),
        ids.length
          ? supabase.from("blog_reactions").select("post_id").in("post_id", ids)
          : Promise.resolve({ data: [] as { post_id: string }[] }),
        ids.length
          ? supabase.from("blog_comments").select("post_id").in("post_id", ids)
          : Promise.resolve({ data: [] as { post_id: string }[] }),
      ]);
      const catName = new Map<string, string>();
      for (const c of (catsRes.data ?? []) as any[]) catName.set(c.id, c.name);
      const reactMap = new Map<string, number>();
      for (const r of (reactRes.data ?? []) as { post_id: string }[])
        reactMap.set(r.post_id, (reactMap.get(r.post_id) ?? 0) + 1);
      const commentMap = new Map<string, number>();
      for (const r of (commentRes.data ?? []) as { post_id: string }[])
        commentMap.set(r.post_id, (commentMap.get(r.post_id) ?? 0) + 1);

      const coverUrls = await signPaths(
        supabase,
        "blog-covers",
        (rows ?? []).map((r: any) => (typeof r.cover_path === "string" && r.cover_path ? r.cover_path : null)),
      );

      let items: ProfileArticle[] = (rows ?? []).map((r: any, i: number) => ({
        id: r.id as string,
        slug: (r.slug as string) ?? "",
        title: (r.title as string) ?? "Untitled",
        excerpt: (r.excerpt as string) ?? "",
        category: r.category_id ? catName.get(r.category_id) ?? null : null,
        timeAgo: r.published_at ? timeAgo(r.published_at as string) : "Unpublished",
        reactions: reactMap.get(r.id as string) ?? 0,
        comments: commentMap.get(r.id as string) ?? 0,
        coverUrl: coverUrls[i],
      }));
      if (data.sort === "most_liked") items = [...items].sort((a, b) => b.reactions - a.reactions);
      else if (data.sort === "most_commented")
        items = [...items].sort((a, b) => b.comments - a.comments);
      const total = count ?? items.length;
      return { items, total, page: data.page, pageSize: data.pageSize, hasMore: from + items.length < total };
    }

    if (data.tab === "groups") {
      // Resolve profile's own slug so we can find inbound circle requests too.
      const { data: prof } = await supabase
        .from("profiles")
        .select("slug")
        .eq("user_id", userId)
        .maybeSingle();
      const mySlug = (prof as { slug?: string } | null)?.slug ?? null;

      let q = supabase
        .from("circle_requests")
        .select("id, requester_id, target_slug, created_at", { count: "exact" })
        .eq("status", "accepted");
      q = mySlug
        ? q.or(`requester_id.eq.${userId},target_slug.eq.${mySlug}`)
        : q.eq("requester_id", userId);
      q = q.order("created_at", { ascending: false }).range(from, to);
      const { data: rows, count } = await q;

      // Collect peer identifiers to resolve friendly names.
      const peerSlugs: string[] = [];
      const peerIds: string[] = [];
      for (const r of (rows ?? []) as any[]) {
        if (r.requester_id === userId) peerSlugs.push(r.target_slug);
        else peerIds.push(r.requester_id);
      }
      const [bySlug, byId] = await Promise.all([
        peerSlugs.length
          ? supabase.from("profiles").select("slug, display_name").in("slug", peerSlugs)
          : Promise.resolve({ data: [] as any[] }),
        peerIds.length
          ? supabase.from("profiles").select("user_id, display_name, slug").in("user_id", peerIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const slugName = new Map<string, string>();
      for (const p of (bySlug.data ?? []) as any[])
        slugName.set(p.slug, p.display_name ?? p.slug);
      const idName = new Map<string, string>();
      for (const p of (byId.data ?? []) as any[])
        idName.set(p.user_id, p.display_name ?? p.slug ?? "Member");

      let items: ProfileGroup[] = (rows ?? []).map((r: any) => {
        const name =
          r.requester_id === userId
            ? slugName.get(r.target_slug) ?? r.target_slug
            : idName.get(r.requester_id) ?? "Member";
        return { id: r.id as string, name, members: 2, tag: "Circle" };
      });
      if (data.q) items = items.filter((g) => g.name.toLowerCase().includes(data.q.toLowerCase()));
      if (data.sort === "alpha") items = [...items].sort((a, b) => a.name.localeCompare(b.name));
      const total = count ?? items.length;
      return { items, total, page: data.page, pageSize: data.pageSize, hasMore: from + items.length < total };
    }

    return empty;

  });

const LiveItemInput = z.object({
  idOrSlug: z.string().trim().min(1).max(120),
  kind: KindEnum,
  itemId: z.string().trim().min(1).max(200),
});

export const getLiveProfileItem = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => LiveItemInput.parse(input))
  .handler(async ({ data }): Promise<{ item: ProfileTabItem | null }> => {
    const supabase = await createServerPublicClient();

    if (data.kind === "post") {
      const { data: row } = await supabase
        .from("posts")
        .select("id, text, created_at")
        .eq("id", data.itemId)
        .maybeSingle();
      if (!row) return { item: null };
      const [likes, comments] = await Promise.all([
        supabase.from("post_likes").select("post_id", { count: "exact", head: true }).eq("post_id", row.id),
        supabase.from("post_comments").select("post_id", { count: "exact", head: true }).eq("post_id", row.id),
      ]);
      const item: ProfilePost = {
        id: row.id as string,
        content: (row.text as string) ?? "",
        timeAgo: timeAgo(row.created_at as string),
        likes: likes.count ?? 0,
        comments: comments.count ?? 0,
      };
      return { item };
    }

    if (data.kind === "listing") {
      const { data: row } = await supabase
        .from("products")
        .select("id, name, category, price_usd")
        .eq("id", data.itemId)
        .maybeSingle();
      if (!row) return { item: null };
      const { count } = await supabase
        .from("orders")
        .select("product_id", { count: "exact", head: true })
        .eq("product_id", row.id)
        .eq("status", "paid");
      const item: ProfileListing = {
        id: row.id as string,
        title: (row.name as string) ?? "Untitled",
        category: (row.category as string) ?? "General",
        priceUsd: Number(row.price_usd ?? 0),
        sales: count ?? 0,
      };
      return { item };
    }

    if (data.kind === "bounty" || data.kind === "solved") {
      const { data: row } = await supabase
        .from("bounties")
        .select("id, title, price_usd, applicant_limit, status")
        .eq("id", data.itemId)
        .maybeSingle();
      if (!row) return { item: null };
      const item: ProfileBounty = {
        id: row.id as string,
        title: (row.title as string) ?? "Untitled",
        amountUsd: Number(row.price_usd ?? 0),
        applicants: Number(row.applicant_limit ?? 0),
        status: data.kind === "solved" ? "solved" : "open",
      };
      return { item };
    }

    return { item: null };
  });


// ---------------------------------------------------------------------------
// Live reputation — real metrics derived from public tables (bounties, posts,
// products). Returns a normalized breakdown consumable by the profile UI.
// ---------------------------------------------------------------------------

export interface LiveReputationItem {
  key: string;
  label: string;
  detail: string;
  weight: number; // 0-1
  score: number; // 0-1 normalized
  raw: string;
}

export interface LiveReputation {
  stars: number; // 0-5
  items: LiveReputationItem[];
  metrics: {
    bountiesSolved: number;
    bountiesPosted: number;
    productsListed: number;
    avgProductRating: number;
    productReviewCount: number;
    postsTotal: number;
    postsLast30d: number;
  };
}

const RepInput = z.object({ idOrSlug: z.string().trim().min(1).max(120) });

export const getLiveReputation = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => RepInput.parse(input))
  .handler(async ({ data }): Promise<{ reputation: LiveReputation | null }> => {
    const supabase = await createServerPublicClient();

    const userId = await resolveUserId(supabase, data.idOrSlug);
    if (!userId) return { reputation: null };

    const since30d = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

    const [bountiesSolvedRes, bountiesPostedRes, productsRes, postsTotalRes, posts30dRes] =
      await Promise.all([
        supabase
          .from("bounties")
          .select("id", { count: "exact", head: true })
          .eq("poster_id", userId)
          .eq("status", "solved"),
        supabase
          .from("bounties")
          .select("id", { count: "exact", head: true })
          .eq("poster_id", userId),
        supabase.from("products").select("rating, reviews").eq("seller_id", userId),
        supabase
          .from("posts")
          .select("id", { count: "exact", head: true })
          .eq("author_id", userId),
        supabase
          .from("posts")
          .select("id", { count: "exact", head: true })
          .eq("author_id", userId)
          .gte("created_at", since30d),
      ]);

    const bountiesSolved = bountiesSolvedRes.count ?? 0;
    const bountiesPosted = bountiesPostedRes.count ?? 0;
    const productsRows = (productsRes.data ?? []) as Array<{
      rating: number | null;
      reviews: number | null;
    }>;
    const productsListed = productsRows.length;
    let ratingWeighted = 0;
    let reviewSum = 0;
    for (const p of productsRows) {
      const r = Number(p.rating ?? 0);
      const rv = Number(p.reviews ?? 0);
      if (rv > 0 && r > 0) {
        ratingWeighted += r * rv;
        reviewSum += rv;
      }
    }
    const avgProductRating = reviewSum > 0 ? ratingWeighted / reviewSum : 0;
    const postsTotal = postsTotalRes.count ?? 0;
    const postsLast30d = posts30dRes.count ?? 0;

    const clamp = (n: number) => Math.max(0, Math.min(1, n));
    const ratingScore = clamp(avgProductRating / 5);
    const solvedScore = clamp(bountiesSolved / 15);
    const marketScore = clamp(productsListed / 10);
    const activityScore = clamp(postsLast30d / 20);
    const contribScore = clamp((postsTotal + bountiesPosted) / 60);

    const items: LiveReputationItem[] = [
      {
        key: "rating",
        label: "Product rating",
        detail: "Weighted average of reviews on your marketplace listings",
        weight: 0.3,
        score: ratingScore,
        raw:
          reviewSum > 0
            ? `${avgProductRating.toFixed(1)} ★ · ${reviewSum} review${reviewSum === 1 ? "" : "s"}`
            : "No reviews yet",
      },
      {
        key: "solved",
        label: "Bounties solved",
        detail: "Bounties you posted that reached a solved state",
        weight: 0.25,
        score: solvedScore,
        raw: `${bountiesSolved} solved`,
      },
      {
        key: "market",
        label: "Marketplace listings",
        detail: "Digital products currently published under your account",
        weight: 0.15,
        score: marketScore,
        raw: `${productsListed} listed`,
      },
      {
        key: "activity",
        label: "Recent activity",
        detail: "Posts published in the last 30 days",
        weight: 0.15,
        score: activityScore,
        raw: `${postsLast30d} in 30d`,
      },
      {
        key: "contrib",
        label: "Overall contribution",
        detail: "Lifetime posts + bounties posted on Oventric",
        weight: 0.15,
        score: contribScore,
        raw: `${postsTotal + bountiesPosted} total`,
      },
    ];

    const weighted = items.reduce((s, i) => s + i.score * i.weight, 0);
    const stars = Math.round(weighted * 5 * 10) / 10;

    return {
      reputation: {
        stars,
        items,
        metrics: {
          bountiesSolved,
          bountiesPosted,
          productsListed,
          avgProductRating: Math.round(avgProductRating * 10) / 10,
          productReviewCount: reviewSum,
          postsTotal,
          postsLast30d,
        },
      },
    };
  });





