import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertLegacyFeatureDisabled } from "@/lib/mvp-features";

const BUCKET = "bounty-submissions";
const MAX_BYTES = 10 * 1024 * 1024;

export interface SubmissionFile {
  path: string;
  name: string;
  size: number;
  type: string;
}

export interface SubmissionView {
  summary: string;
  timeline: string;
  files: Array<SubmissionFile & { url: string | null }>;
  submitted_at: string | null;
  updated_at: string | null;
  can_edit: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadBounty(sb: any, bountyId: string) {
  const { data, error } = await sb
    .from("bounties")
    .select("id, title, poster_id, accepted_applicant_id, status, released_at")
    .eq("id", bountyId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Bounty not found");
  return data as {
    id: string;
    title: string;
    poster_id: string;
    accepted_applicant_id: string | null;
    status: string;
    released_at: string | null;
  };
}

export const getBountySubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { bounty_id: string }) => i)
  .handler(async ({ data, context }): Promise<SubmissionView | null> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const b = await loadBounty(sb, data.bounty_id);
    const isSolver = b.accepted_applicant_id === context.userId;
    const isPoster = b.poster_id === context.userId;
    if (!isSolver && !isPoster) {
      const { data: adm } = await sb.rpc("has_role", { _user_id: context.userId, _role: "admin" });
      if (!adm) throw new Error("Forbidden");
    }
    const { data: row, error } = await sb
      .from("bounty_submissions")
      .select("summary, timeline, files, submitted_at, updated_at")
      .eq("bounty_id", data.bounty_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) {
      return isSolver
        ? { summary: "", timeline: "", files: [], submitted_at: null, updated_at: null, can_edit: true }
        : null;
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const files = (row.files ?? []) as SubmissionFile[];
    const withUrls = await Promise.all(
      files.map(async (f) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: s } = await (supabaseAdmin as any).storage
          .from(BUCKET)
          .createSignedUrl(f.path, 3600);
        return { ...f, url: s?.signedUrl ?? null };
      }),
    );
    return {
      summary: row.summary ?? "",
      timeline: row.timeline ?? "",
      files: withUrls,
      submitted_at: row.submitted_at ?? null,
      updated_at: row.updated_at ?? null,
      can_edit: isSolver && !b.released_at,
    };
  });

export const uploadSubmissionFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { bounty_id: string; name: string; type: string; data_base64: string }) => i)
  .handler(async ({ data, context }): Promise<SubmissionFile> => {
    // Paused legacy feature: fail closed even if called directly.
    assertLegacyFeatureDisabled("bounties");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const b = await loadBounty(sb, data.bounty_id);
    if (b.accepted_applicant_id !== context.userId) throw new Error("Only the assigned solver can attach files");
    if (b.released_at) throw new Error("Bounty already settled");

    const binary = Uint8Array.from(atob(data.data_base64), (c) => c.charCodeAt(0));
    if (binary.byteLength > MAX_BYTES) throw new Error("File too large (max 10MB)");

    const safe = data.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
    const path = `${data.bounty_id}/${context.userId}/${Date.now()}-${safe}`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabaseAdmin as any).storage
      .from(BUCKET)
      .upload(path, binary, { contentType: data.type || "application/octet-stream", upsert: false });
    if (error) throw new Error(error.message);
    return { path, name: data.name, size: binary.byteLength, type: data.type || "" };
  });

export const saveBountySubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (i: {
      bounty_id: string;
      summary: string;
      timeline: string;
      files: SubmissionFile[];
      submit: boolean;
    }) => i,
  )
  .handler(async ({ data, context }) => {
    // Paused legacy feature: fail closed even if called directly.
    assertLegacyFeatureDisabled("bounties");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const b = await loadBounty(sb, data.bounty_id);
    if (b.accepted_applicant_id !== context.userId) throw new Error("Only the assigned solver can submit work");
    if (b.released_at) throw new Error("Bounty already settled");

    const summary = (data.summary ?? "").trim().slice(0, 8000);
    const timeline = (data.timeline ?? "").trim().slice(0, 200);
    if (data.submit && summary.length < 20) {
      throw new Error("Describe your solution in at least 20 characters before submitting");
    }
    const files = (data.files ?? []).slice(0, 10);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabaseAdmin as any).from("bounty_submissions").upsert(
      {
        bounty_id: data.bounty_id,
        solver_id: context.userId,
        summary,
        timeline,
        files,
        submitted_at: data.submit ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "bounty_id,solver_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
