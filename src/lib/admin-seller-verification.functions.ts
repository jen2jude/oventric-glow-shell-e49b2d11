import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Admin review surface for seller verification requests. Reads and decisions are
 * backend-authoritative: the browser never sets a verified flag directly, and
 * each decision writes an audit entry plus a notification to the seller.
 */

export type AdminVerificationDecision = "approved" | "rejected" | "under_review";

export interface AdminVerificationRow {
  id: string;
  userId: string;
  username: string | null;
  displayName: string | null;
  legalName: string | null;
  brandName: string | null;
  contactEmail: string | null;
  country: string | null;
  website: string | null;
  note: string | null;
  businessType: string | null;
  registrationNumber: string | null;
  businessAddress: string | null;
  proofDocKind: string | null;
  proofDocUrl: string | null;
  passportPhotoUrl: string | null;
  status: string;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

async function assertReviewer(
  ctx: { supabase: unknown; userId: string },
  allowed: readonly string[],
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = ctx.supabase as any;
  const { data: isSuper, error } = await sb.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (isSuper) return;
  for (const role of allowed) {
    const { data: ok } = await sb.rpc("has_role", { _user_id: ctx.userId, _role: role });
    if (ok) return;
  }
  throw new Error(`Forbidden: requires one of admin, ${allowed.join(", ")}`);
}

export const adminListSellerVerifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminVerificationRow[]> => {
    await assertReviewer(context, ["moderator", "support"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabaseAdmin as any;

    const { data, error } = await sb
      .from("seller_verification_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Array<Record<string, unknown>>;

    const ids = Array.from(new Set(rows.map((r) => r.user_id as string)));
    const profiles = new Map<string, { username: string | null; display_name: string | null }>();
    if (ids.length) {
      const { data: profs } = await sb
        .from("profiles")
        .select("user_id, username, display_name")
        .in("user_id", ids);
      for (const p of (profs ?? []) as Array<Record<string, unknown>>) {
        profiles.set(p.user_id as string, {
          username: (p.username as string) ?? null,
          display_name: (p.display_name as string) ?? null,
        });
      }
    }

    const paths = rows
      .flatMap((r) => [r.proof_doc_path, r.passport_photo_path])
      .filter((p): p is string => typeof p === "string" && p.length > 0);
    const signed = new Map<string, string>();
    if (paths.length) {
      const { data: urls } = await sb.storage
        .from("seller-verification")
        .createSignedUrls(Array.from(new Set(paths)), 60 * 60);
      for (const u of (urls ?? []) as Array<{ path: string | null; signedUrl: string | null }>) {
        if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
      }
    }

    return rows.map((r) => {
      const prof = profiles.get(r.user_id as string);
      return {
        id: r.id as string,
        userId: r.user_id as string,
        username: prof?.username ?? null,
        displayName: prof?.display_name ?? null,
        legalName: (r.legal_name as string) ?? null,
        brandName: (r.brand_name as string) ?? null,
        contactEmail: (r.contact_email as string) ?? null,
        country: (r.country as string) ?? null,
        website: (r.website as string) ?? null,
        note: (r.note as string) ?? null,
        businessType: (r.business_type as string) ?? null,
        registrationNumber: (r.registration_number as string) ?? null,
        businessAddress: (r.business_address as string) ?? null,
        proofDocKind: (r.proof_doc_kind as string) ?? null,
        proofDocUrl: signed.get(r.proof_doc_path as string) ?? null,
        passportPhotoUrl: signed.get(r.passport_photo_path as string) ?? null,
        status: r.status as string,
        reviewNote: (r.review_note as string) ?? null,
        reviewedAt: (r.reviewed_at as string) ?? null,
        createdAt: r.created_at as string,
      };
    });
  });

const DecisionInput = z.object({
  id: z.string().uuid(),
  decision: z.enum(["approved", "rejected", "under_review"]),
  note: z.string().trim().max(1000).optional().default(""),
});

export const adminDecideSellerVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => DecisionInput.parse(i ?? {}))
  .handler(async ({ data, context }) => {
    await assertReviewer(context, ["moderator"]);
    if (data.decision === "rejected" && !data.note) {
      throw new Error("A reason is required when rejecting a request");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabaseAdmin as any;

    const { data: row, error } = await sb
      .from("seller_verification_requests")
      .update({
        status: data.decision,
        review_note: data.note || null,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .select("id, user_id, brand_name")
      .single();
    if (error) throw new Error(error.message);

    const copy: Record<AdminVerificationDecision, { title: string; body: string }> = {
      approved: {
        title: "Your shop is verified",
        body: `Your seller verification was approved. The verified badge now shows on your storefront.${data.note ? `\n\nNote: ${data.note}` : ""}`,
      },
      rejected: {
        title: "Verification not approved",
        body: `Your seller verification request was not approved.\n\nReason: ${data.note}\n\nYou can submit a new request once the issue is resolved.`,
      },
      under_review: {
        title: "Verification under review",
        body: `Your seller verification request is now under review by our team.${data.note ? `\n\nNote: ${data.note}` : ""}`,
      },
    };

    await sb.from("notifications").insert({
      user_id: row.user_id,
      kind: "system",
      title: copy[data.decision].title,
      body: copy[data.decision].body,
    });

    await sb.from("audit_logs").insert({
      actor_id: context.userId,
      action: `seller_verification.${data.decision}`,
      target_kind: "seller_verification_request",
      target_id: data.id,
      meta: { note: data.note || null, seller: row.user_id },
    });

    return { ok: true as const };
  });
