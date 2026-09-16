import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { currencyForCountry, dbCurrency } from "@/lib/currency/africa";

const Input = z.object({
  username: z.string().trim().min(2).max(24).optional(),
  displayName: z.string().trim().min(1).max(80).optional(),
});

// Every new user gets a USD rail; their home-currency wallet is created
// when they complete their profile (see completeProfile below).
const WALLET_CURRENCIES = ["USD", "NGN", "GHS"] as const;

/**
 * Idempotently seeds a profile row and the three multi-currency wallet rows for
 * the authenticated user. Safe to call multiple times (after signup, on
 * first sign-in, or as a self-heal path from the app shell).
 */
export const seedNewUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    const isAnonymous = Boolean(
      (claims as { is_anonymous?: boolean } | undefined)?.is_anonymous,
    );

    const email = (claims as { email?: string } | undefined)?.email ?? "";
    // For real (email) users the local-part is a reasonable seed; for
    // anonymous browse-only sessions there is no email, so we use a stable
    // per-user token and leave display_name blank until they finish onboarding.
    const emailLocal = email.split("@")[0] || `user-${userId.slice(0, 8)}`;
    const fallbackName = data.displayName ?? (email ? emailLocal : "");
    const desiredUsername = data.username ?? emailLocal;
    const slugBase =
      desiredUsername
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "")
        .slice(0, 24) || `user${userId.slice(0, 8)}`;

    // 1. Profile (insert-if-missing; do NOT overwrite existing user edits).
    // Use the admin client for the seed row: the caller identity is already
    // verified by requireSupabaseAuth (userId comes from the bearer token),
    // and RLS now blocks anonymous JWTs from touching profiles directly.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing, error: readErr } = await supabaseAdmin
      .from("profiles")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (readErr) {
      console.error("[seedNewUser] profile read failed", readErr);
      throw new Error("Failed to prepare profile");
    }

    if (!existing) {
      const tryInsert = async (slug: string, uname: string) =>
        supabaseAdmin.from("profiles").insert({
          user_id: userId,
          slug,
          display_name: fallbackName,
          username: uname,
          verification_tier: "TIER_0",
          reputation_stars: 0,
        });

      let { error: insErr } = await tryInsert(slugBase, desiredUsername);
      for (let i = 0; insErr && (insErr as { code?: string }).code === "23505" && i < 3; i++) {
        const { data: found } = await supabaseAdmin
          .from("profiles")
          .select("user_id")
          .eq("user_id", userId)
          .maybeSingle();
        if (found) {
          insErr = null as unknown as typeof insErr;
          break;
        }
        const suffix = Math.random().toString(36).slice(2, 6);
        ({ error: insErr } = await tryInsert(`${slugBase}${suffix}`, `${desiredUsername}-${suffix}`));
      }
      if (insErr) {
        // 23503: the bearer token references an auth user that no longer
        // exists (deleted account / reset backend). Signal the client to
        // clear the stale session instead of hard-failing the app shell.
        if ((insErr as { code?: string }).code === "23503") {
          return { ok: false as const, staleSession: true, userId };
        }
        console.error("[seedNewUser] profile insert failed", insErr);
        throw new Error("Failed to create profile");
      }
    }



    // 2. Wallets (only for real, non-anonymous users — RLS blocks anon inserts,
    // and anon browse-only sessions don't need wallet rows until they upgrade).
    if (!isAnonymous) {
      // Balances are DB-defaulted to 0; the browser role has no INSERT
      // privilege on balance columns.
      const rows = WALLET_CURRENCIES.map((currency) => ({ user_id: userId, currency }));
      // Wallet rows are not browser-writable (Stage 2 revoked client INSERT on
      // public.wallets); seed them with the service client, scoped to the
      // already-verified caller's own user id.
      const { supabaseAdmin: walletAdmin } = await import("@/integrations/supabase/client.server");
      const { error: walletErr } = await walletAdmin
        .from("wallets")
        .upsert(rows, { onConflict: "user_id,currency", ignoreDuplicates: true });
      if (walletErr) {
        // Non-fatal: profile is seeded; wallets can be created on first
        // commerce action. Do not blank the app shell over this.
        console.error("[seedNewUser] wallet upsert failed (non-fatal)", walletErr);
      }
    }

    return { ok: true as const, staleSession: false, userId };
  });

const FullNameInput = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(80),
});

/**
 * Persists the user's full name onto their profile's display_name. Used by
 * the "fill your full name" gate that fires before create actions.
 */
export const updateFullName = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => FullNameInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: data.fullName })
      .eq("user_id", userId);
    if (error) {
      console.error("[updateFullName] update failed", error);
      throw new Error("Failed to save full name");
    }
    return { ok: true, fullName: data.fullName };
  });

const CompleteProfileInput = z.object({
  fullName: z.string().trim().min(2).max(80),
  // Country is stored as either the ISO-ish code "NG"/"GH", or — for users
  // who selected "Other" — the free-form country name they typed. This is
  // deliberately a permissive string so we can grow the country list without
  // migrations; the client coerces anything outside NG/GH into the "OTHER"
  // bucket (USD baseline).
  country: z.string().trim().min(2).max(60),
  address: z.string().trim().min(4).max(240).optional(),
  phone: z.string().trim().min(6).max(24).optional(),
});

/**
 * Stage 2 onboarding: persists full name and country (plus optional address
 * and phone if the caller collected them), and promotes verification_tier
 * from TIER_1 → TIER_2 so commerce actions unlock. Address and phone are
 * captured during the KYC step, so they are not required here.
 */
export const completeProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CompleteProfileInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch: {
      display_name: string;
      country: string;
      verification_tier: string;
      profile_completed_at: string;
      address?: string;
      phone?: string;
    } = {
      display_name: data.fullName,
      country: data.country,
      verification_tier: "TIER_2",
      profile_completed_at: new Date().toISOString(),
    };
    if (data.address) patch.address = data.address;
    if (data.phone) patch.phone = data.phone;
    // verification_tier / profile_completed_at are not browser-writable columns;
    // they are set here only after the authenticated caller has been verified,
    // and always scoped to that caller's own row.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update(patch)
      .eq("user_id", userId);
    if (error) {
      console.error("[completeProfile] update failed", error);
      throw new Error("Failed to save profile");
    }

    // Make sure the user's home-currency wallet exists so funding, payouts,
    // marketplace and bounty settlement all have a rail to land on.
    const homeCurrency = dbCurrency(currencyForCountry(data.country));
    const { error: wErr } = await supabaseAdmin.from("wallets").upsert(
      [{ user_id: userId, currency: homeCurrency }],
      { onConflict: "user_id,currency", ignoreDuplicates: true },
    );
    if (wErr) console.error("[completeProfile] home wallet upsert failed (non-fatal)", wErr);

    return { ok: true, homeCurrency };
  });


/**
 * Reads the current user's profile-completion + kyc status. Used by gates to
 * decide whether to show the setup / kyc modals.
 */
export const getOnboardingStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select(
        "display_name, country, phone, profile_completed_at, kyc_completed_at, kyc_selfie_path, kyc_id_path, verification_tier",
      )
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      console.error("[getOnboardingStatus] read failed", error);
      throw new Error("Failed to read profile status");
    }
    return {
      profileCompleted: !!data?.profile_completed_at,
      kycCompleted: !!data?.kyc_completed_at,
      displayName: data?.display_name ?? null,
      country: data?.country ?? null,
      phone: data?.phone ?? null,
      kycSelfiePath: data?.kyc_selfie_path ?? null,
      kycIdPath: (data as { kyc_id_path?: string | null } | null)?.kyc_id_path ?? null,
      verificationTier: (data as { verification_tier?: string } | null)?.verification_tier ?? "TIER_0",
    };
  });


const SaveKycInput = z.object({
  phone: z.string().trim().min(6).max(24),
  selfiePath: z.string().trim().min(1).max(400),
  idPath: z.string().trim().min(1).max(400),
});

/**
 * Persists the KYC selfie + government ID paths and phone, marks
 * kyc_completed_at, and promotes verification_tier to TIER_5.
 * Both images are uploaded from the browser to the private `kyc-selfies`
 * bucket (paths: `<user_id>/selfie_<ts>.jpg` and `<user_id>/id_<ts>.jpg`).
 */
export const saveKyc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SaveKycInput.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    // kyc_completed_at / verification_tier are server-only columns.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        phone: data.phone,
        kyc_selfie_path: data.selfiePath,
        kyc_id_path: data.idPath,
        kyc_completed_at: new Date().toISOString(),
        verification_tier: "TIER_3",
      })
      .eq("user_id", userId);
    if (error) {
      console.error("[saveKyc] update failed", error);
      throw new Error("Failed to save KYC");
    }
    return { ok: true };
  });


/**
 * Mints a short-lived, server-recorded liveness attestation for the signed-in
 * user. Called immediately after a successful face re-match. Withdrawal
 * creation (payout_request_create*) refuses to run unless this attestation is
 * less than 15 minutes old, so the check cannot be skipped by calling the
 * payout server function directly.
 */
export const recordLivenessAttestation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase.rpc("record_liveness_attestation");
    if (error) {
      console.error("[recordLivenessAttestation] failed", error.message);
      throw new Error("Identity re-check could not be recorded");
    }
    return { verifiedAt: data as unknown as string };
  });
