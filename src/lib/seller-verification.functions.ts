import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------------------------------------------------------------------------
// Seller verification requests.
// A seller becomes "verified" only when an approved request exists; sellers can
// submit a request from their storefront. All state is backend-authoritative.
// ---------------------------------------------------------------------------

export type SellerVerificationStatus =
  | "none"
  | "pending"
  | "under_review"
  | "approved"
  | "rejected";

export interface MySellerVerification {
  status: SellerVerificationStatus;
  submittedAt: string | null;
  reviewNote: string | null;
  /** Whether the caller is eligible to submit (onboarded + has a published listing). */
  eligible: boolean;
  reason: string | null;
}

export const getMySellerVerification = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MySellerVerification> => {
    const { supabase, userId } = context;

    const { data: latest } = await supabase
      .from("seller_verification_requests")
      .select("status, created_at, review_note")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: profile } = await supabase
      .from("profiles")
      .select("profile_completed_at")
      .eq("user_id", userId)
      .maybeSingle();

    const { count: listings } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("seller_id", userId)
      .eq("status", "active");

    const onboarded = !!(profile as { profile_completed_at?: string | null } | null)?.profile_completed_at;
    const hasListing = (listings ?? 0) > 0;
    const reason = !onboarded
      ? "Finish your seller onboarding before requesting verification."
      : !hasListing
        ? "Publish at least one digital product before requesting verification."
        : null;

    const row = latest as { status?: string; created_at?: string; review_note?: string | null } | null;
    return {
      status: (row?.status as SellerVerificationStatus) ?? "none",
      submittedAt: row?.created_at ?? null,
      reviewNote: row?.review_note ?? null,
      eligible: onboarded && hasListing,
      reason,
    };
  });

export const PROOF_DOC_KINDS = [
  "utility_bill",
  "electricity_bill",
  "tenancy_receipt",
  "bank_statement",
] as const;

export const PROOF_DOC_LABELS: Record<string, string> = {
  utility_bill: "Utility bill",
  electricity_bill: "Electricity bill",
  tenancy_receipt: "Signed tenancy receipt",
  bank_statement: "Bank statement",
};

const RequestInput = z
  .object({
    legalName: z.string().trim().min(2).max(120),
    brandName: z.string().trim().max(120).optional().default(""),
    contactEmail: z.string().trim().email().max(180),
    country: z.string().trim().max(80).optional().default(""),
    website: z.string().trim().max(240).optional().default(""),
    note: z.string().trim().max(1000).optional().default(""),
    businessType: z.enum(["registered", "unregistered"]),
    registrationNumber: z.string().trim().max(80).optional().default(""),
    businessAddress: z.string().trim().min(5).max(400),
    proofDocKind: z.enum(PROOF_DOC_KINDS),
    proofDocPath: z.string().trim().min(3).max(400),
    passportPhotoPath: z.string().trim().min(3).max(400),
  })
  .refine((v) => v.businessType !== "registered" || v.registrationNumber.length >= 3, {
    message: "Registration number is required for a registered business",
    path: ["registrationNumber"],
  });

export const requestSellerVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RequestInput.parse(input ?? {}))
  .handler(async ({ data, context }): Promise<{ ok: boolean; status: SellerVerificationStatus; message: string }> => {
    const { supabase, userId } = context;

    // Uploaded documents must live inside the caller's own storage folder.
    if (!data.proofDocPath.startsWith(`${userId}/`) || !data.passportPhotoPath.startsWith(`${userId}/`)) {
      return { ok: false, status: "none", message: "Invalid document upload. Please re-upload your files." };
    }

    // Server-side eligibility: onboarded seller with at least one live listing.
    const { data: profile } = await supabase
      .from("profiles")
      .select("profile_completed_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (!(profile as { profile_completed_at?: string | null } | null)?.profile_completed_at) {
      return { ok: false, status: "none", message: "Finish your seller onboarding first." };
    }

    const { count: listings } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("seller_id", userId)
      .eq("status", "active");
    if ((listings ?? 0) === 0) {
      return { ok: false, status: "none", message: "Publish at least one digital product first." };
    }

    const { data: existing } = await supabase
      .from("seller_verification_requests")
      .select("status")
      .eq("user_id", userId)
      .in("status", ["pending", "under_review", "approved"])
      .limit(1)
      .maybeSingle();
    if (existing) {
      const status = (existing as { status: string }).status as SellerVerificationStatus;
      return {
        ok: false,
        status,
        message: status === "approved" ? "Your shop is already verified." : "Your request is already under review.",
      };
    }

    const { error } = await supabase.from("seller_verification_requests").insert({
      user_id: userId,
      legal_name: data.legalName,
      brand_name: data.brandName || null,
      contact_email: data.contactEmail,
      country: data.country || null,
      website: data.website || null,
      note: data.note || null,
      business_type: data.businessType,
      registration_number: data.businessType === "registered" ? data.registrationNumber : null,
      business_address: data.businessAddress,
      proof_doc_kind: data.proofDocKind,
      proof_doc_path: data.proofDocPath,
      passport_photo_path: data.passportPhotoPath,
      status: "pending",
    });
    if (error) return { ok: false, status: "none", message: "Could not submit your request. Please try again." };

    return { ok: true, status: "pending", message: "Verification request submitted for review." };
  });
