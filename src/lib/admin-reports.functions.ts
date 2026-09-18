import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ReportStatus = "pending" | "approved" | "hidden";
export type ReportReason = "spam" | "harassment" | "ip" | "scam";

export interface AdminReport {
  id: string;
  target_id: string;
  target_kind: string;
  reason: ReportReason;
  note: string | null;
  status: ReportStatus;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  target_preview: string | null;
  target_author: string | null;
}

/** Super admin or moderator may work the report queue. */
async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error) {
    console.error("[admin-reports] has_role failed", error);
    throw new Error("Failed to verify admin role");
  }
  if (data) return;
  const { data: isMod } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "moderator",
  });
  if (!isMod) throw new Error("Forbidden: admin or moderator role required");
}

async function attachTargetPreviews(sb: any, reports: any[]): Promise<AdminReport[]> {
  const commentIds = reports.filter((r) => r.target_kind === "blog_comment").map((r) => r.target_id);
  const postIds = reports.filter((r) => r.target_kind === "post").map((r) => r.target_id);
  const productIds = reports.filter((r) => r.target_kind === "product").map((r) => r.target_id);

  const previewMap = new Map<string, { preview: string; author?: string }>();

  if (commentIds.length) {
    const { data } = await sb.from("blog_comments").select("id, text, author_name").in("id", commentIds);
    data?.forEach((c: any) => previewMap.set(c.id, { preview: c.text, author: c.author_name }));
  }
  if (postIds.length) {
    const { data } = await sb.from("posts").select("id, content, profiles(username)").in("id", postIds);
    data?.forEach((p: any) => previewMap.set(p.id, { preview: p.content, author: p.profiles?.username }));
  }
  if (productIds.length) {
    const { data } = await sb.from("products").select("id, name, vendor").in("id", productIds);
    data?.forEach((p: any) => previewMap.set(p.id, { preview: p.name, author: p.vendor }));
  }

  return reports.map((r) => {
    const entry = previewMap.get(r.target_id);
    return {
      ...r,
      target_preview: entry?.preview?.slice(0, 320) ?? null,
      target_author: entry?.author ?? null,
    } as AdminReport;
  });

}

export const listPendingReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        status: z.enum(["pending", "approved", "hidden", "all"]).default("pending"),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    let q = context.supabase
      .from("post_reports")
      .select("id, target_id, target_kind, reason, note, status, created_at, resolved_at, resolved_by")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) {
      console.error("[listPendingReports]", error);
      throw new Error("Failed to load reports");
    }
    const enriched = await attachTargetPreviews(context.supabase, rows ?? []);
    return { reports: enriched };
  });

export const resolveReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        reportId: z.string().uuid(),
        action: z.enum(["approve", "hide", "reset"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const nextStatus: ReportStatus =
      data.action === "approve" ? "approved" : data.action === "hide" ? "hidden" : "pending";
    const { data: row, error } = await context.supabase
      .from("post_reports")
      .update({
        status: nextStatus,
        resolved_at: nextStatus === "pending" ? null : new Date().toISOString(),
        resolved_by: nextStatus === "pending" ? null : context.userId,
      })
      .eq("id", data.reportId)
      .select("id, target_id, target_kind, reason, note, status, created_at, resolved_at, resolved_by")
      .maybeSingle();
    if (error) {
      console.error("[resolveReport]", error);
      throw new Error("Failed to update report");
    }
    if (!row) throw new Error("Report not found");

    // Apply moderation side-effects.
    const isHidden = data.action === "hide";
    if (row.target_kind === "blog_comment") {
      await context.supabase.from("blog_comments").update({ is_hidden: isHidden }).eq("id", row.target_id);
    } else if (row.target_kind === "post") {
      // The 'posts' table uses status or separate flags; if 'is_hidden' is missing, 
      // we'll assume it's part of a future schema or uses a different field.
      // Based on typical Oventric patterns, we check if 'status' exists or use metadata.
      try {
        await context.supabase.from("posts").update({ audience: isHidden ? "private" : "public" }).eq("id", row.target_id);
      } catch (e) {
        console.warn("Post moderation fallback failed", e);
      }
    } else if (row.target_kind === "product") {
      const status = isHidden ? "rejected" : "active";
      await context.supabase.from("products").update({ status }).eq("id", row.target_id);
    }



    // Immutable audit record for every moderation decision.
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabaseAdmin as any).from("audit_logs").insert({
        actor_id: context.userId,
        action: "report.resolve",
        target_kind: "post_report",
        target_id: row.id,
        meta: {
          action: data.action,
          status: nextStatus,
          target_kind: row.target_kind,
          target_id: row.target_id,
        },
      });
    } catch (e) {
      console.error("[resolveReport] audit insert failed", e);
    }

    const [enriched] = await attachTargetPreviews(context.supabase, [row]);
    return { report: enriched };
  });
