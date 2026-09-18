import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { dbCurrency } from "@/lib/currency/africa";
import { fallbackRateTable } from "@/lib/currency/africa";
import { assertLegacyFeatureDisabled } from "@/lib/mvp-features";

export type CourseCategory = "frontend" | "uiux" | "ai" | "backend" | "security";
export type CourseLevel = "beginner" | "intermediate" | "advanced";
export type VideoProvider = "youtube" | "vimeo";

export type CourseCurrency = string;
export type CourseFxSnapshot = {
  base: string;
  rates: Record<string, number>;
  source?: string;
  fetched_at?: string;
} | null;

export interface CourseDTO {
  id: string;
  ownerId: string;
  title: string;
  slug: string;
  description: string;
  category: CourseCategory;
  level: CourseLevel;
  instructorName: string;
  coverPath: string | null;
  coverUrl: string | null;
  priceUSD: number;
  isFree: boolean;
  isPublished: boolean;
  promoted: boolean;
  createdAt: string;
  originalCurrency: CourseCurrency;
  originalAmount: number;
  fxSnapshot: CourseFxSnapshot;
  moduleCount?: number;
  enrolledCount?: number;
  ownerSlug?: string | null;
  ownerName?: string | null;
}

export interface ModuleDTO {
  id: string;
  courseId: string;
  position: number;
  title: string;
  description: string;
  body: string;
  videoUrl: string;
  videoProvider: VideoProvider;
  videoPath: string | null;
  videoFileUrl: string | null;
  durationMin: number;
  isPreview: boolean;
}

export interface CourseWithModulesDTO extends CourseDTO {
  modules: ModuleDTO[];
}

export interface EnrollmentDTO {
  id: string;
  courseId: string;
  createdAt: string;
  completedAt: string | null;
  completedModules: string[];
}

function serverPublicClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase server env missing");
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 60) || "course"
  );
}

function mapCourse(r: Record<string, unknown>, coverUrl: string | null = null): CourseDTO {
  const priceUSD = Number(r.price_usd ?? 0);
  const originalCurrency = ((r.original_currency as string) ?? "USD") as CourseCurrency;
  const originalAmount = Number(r.original_amount ?? priceUSD);
  const fxSnapshot = (r.fx_snapshot as CourseFxSnapshot) ?? null;
  return {
    id: r.id as string,
    ownerId: r.owner_id as string,
    title: r.title as string,
    slug: r.slug as string,
    description: (r.description as string) ?? "",
    category: (r.category as CourseCategory) ?? "frontend",
    level: (r.level as CourseLevel) ?? "beginner",
    instructorName: (r.instructor_name as string) ?? "",
    coverPath: (r.cover_path as string) ?? null,
    coverUrl,
    priceUSD,
    isFree: Boolean(r.is_free),
    isPublished: Boolean(r.is_published),
    promoted: Boolean(r.promoted),
    createdAt: r.created_at as string,
    originalCurrency,
    originalAmount,
    fxSnapshot,
  };
}

function mapModule(r: Record<string, unknown>, videoFileUrl: string | null = null): ModuleDTO {
  const content = (r.content_data as Record<string, unknown> | null) ?? {};
  const body = typeof content.body === "string" ? (content.body as string) : "";
  const videoPath = typeof content.video_path === "string" ? (content.video_path as string) : null;
  return {
    id: r.id as string,
    courseId: r.course_id as string,
    position: Number(r.position ?? 0),
    title: r.title as string,
    description: (r.description as string) ?? "",
    body,
    videoUrl: (r.video_url as string) ?? "",
    videoProvider: ((r.video_provider as string) ?? "youtube") as VideoProvider,
    videoPath,
    videoFileUrl,
    durationMin: Number(r.duration_min ?? 0),
    isPreview: Boolean(r.is_preview),
  };
}

async function signCourseMedia(
  sb: ReturnType<typeof serverPublicClient>,
  paths: (string | null)[],
): Promise<(string | null)[]> {
  const unique = Array.from(new Set(paths.filter((p): p is string => !!p)));
  if (unique.length === 0) return paths.map(() => null);
  
  try {
    const { data, error } = await sb.storage
      .from("course-media")
      .createSignedUrls(unique, 60 * 60 * 24 * 7);
    
    if (error) {
      console.error("[signCourseMedia] Storage error:", error);
      return paths.map(() => null);
    }

    const map = new Map<string, string>();
    (data ?? []).forEach((r) => { 
      if (r.path && r.signedUrl) map.set(r.path, r.signedUrl); 
    });
    return paths.map((p) => (p ? map.get(p) ?? null : null));
  } catch (e) {
    console.error("[signCourseMedia] Fatal error:", e);
    return paths.map(() => null);
  }
}

async function signCovers(
  _sb: ReturnType<typeof serverPublicClient>,
  paths: (string | null)[],
): Promise<(string | null)[]> {
  const unique = Array.from(new Set(paths.filter((p): p is string => !!p)));
  if (unique.length === 0) return paths.map(() => null);
  
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.storage
      .from("course-covers")
      .createSignedUrls(unique, 60 * 60 * 24 * 7);
    
    if (error) {
      console.error("[signCovers] Storage error:", error);
      return paths.map(() => null);
    }

    const map = new Map<string, string>();
    (data ?? []).forEach((r) => {
      if (r.path && r.signedUrl) map.set(r.path, r.signedUrl);
    });
    return paths.map((p) => (p ? map.get(p) ?? null : null));
  } catch (e) {
    console.error("[signCovers] Fatal error:", e);
    return paths.map(() => null);
  }
}


const COURSE_COLS =
  "id, owner_id, title, slug, description, category, level, instructor_name, cover_path, price_usd, is_free, is_published, promoted, created_at, original_currency, original_amount, fx_snapshot";

async function attachOwners(
  sb: ReturnType<typeof serverPublicClient>,
  courses: CourseDTO[],
): Promise<CourseDTO[]> {
  const ids = Array.from(new Set(courses.map((c) => c.ownerId).filter(Boolean)));
  if (ids.length === 0) return courses;
  const { data } = await sb
    .from("profiles")
    .select("user_id, slug, display_name")
    .in("user_id", ids);
  const byId = new Map(
    (data ?? []).map((r) => [
      r.user_id as string,
      { slug: (r.slug as string) ?? null, name: (r.display_name as string) ?? null },
    ]),
  );
  return courses.map((c) => {
    const o = byId.get(c.ownerId);
    return { ...c, ownerSlug: o?.slug ?? null, ownerName: o?.name ?? null };
  });
}

// ---------- PUBLIC LISTINGS ----------

export const listCourses = createServerFn({ method: "GET" }).handler(async () => {
  const sb = serverPublicClient();
  const { data, error } = await sb
    .from("courses")
    .select(COURSE_COLS)
    .eq("is_published", true)
    .order("promoted", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const urls = await signCovers(sb, rows.map((r) => (r.cover_path as string) ?? null));
  const mapped = rows.map((r, i) => mapCourse(r as Record<string, unknown>, urls[i]));
  return attachOwners(sb, mapped).catch(() => mapped);
});

export const getCourse = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string }) => ({ id: String(input?.id ?? "") }))
  .handler(async ({ data }): Promise<CourseWithModulesDTO> => {
    if (!data.id) throw new Error("Course id required");
    const sb = serverPublicClient();
    
    // Use select("*") to be safe against schema drifts
    const { data: row, error } = await sb
      .from("courses")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    
    if (error) {
      console.error("[getCourse] Course fetch error:", error);
      throw new Error(error.message);
    }
    if (!row) {
      console.error("[getCourse] Course not found:", data.id);
      throw new Error("Course not found");
    }

    const signedCovers = await signCovers(sb, [(row.cover_path as string) ?? null]).catch(err => {
      console.error("[getCourse] signCovers failed:", err);
      return [null];
    });
    const coverUrl = signedCovers[0];

    // Fetch modules
    const { data: mods, error: mErr } = await sb
      .from("course_modules")
      .select("*")
      .eq("course_id", data.id)
      .order("position", { ascending: true });

    if (mErr) {
      console.error("[getCourse] Module fetch error:", mErr);
      throw new Error(mErr.message);
    }
    
    const modRows = mods ?? [];
    const videoPaths = modRows.map((m) => {
      const cd = (m.content_data as Record<string, unknown>) ?? {};
      return typeof cd.video_path === "string" ? (cd.video_path as string) : null;
    });

    const videoUrls = await signCourseMedia(sb, videoPaths).catch(err => {
      console.error("[getCourse] signCourseMedia failed:", err);
      return videoPaths.map(() => null);
    });

    const [withOwner] = await attachOwners(sb, [
      mapCourse(row as Record<string, unknown>, coverUrl),
    ]).catch(() => [mapCourse(row as Record<string, unknown>, coverUrl)]);
    return {
      ...(withOwner as CourseDTO),
      modules: modRows.map((m, i) => mapModule(m as Record<string, unknown>, videoUrls[i])),
    };
  });

// ---------- COURSE CRUD (owner or admin) ----------

export const createCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    title: string;
    description?: string;
    category?: CourseCategory;
    level?: CourseLevel;
    instructorName?: string;
    coverPath?: string | null;
    priceUSD?: number;
    isFree?: boolean;
    isPublished?: boolean;
    promoted?: boolean;
    originalCurrency?: CourseCurrency;
    originalAmount?: number;
    fxSnapshot?: CourseFxSnapshot;
  }) => ({
    title: String(input.title ?? "").trim(),
    description: String(input.description ?? "").trim(),
    category: (input.category ?? "frontend") as CourseCategory,
    level: (input.level ?? "beginner") as CourseLevel,
    instructorName: String(input.instructorName ?? "").trim(),
    coverPath: input.coverPath ?? null,
    priceUSD: Number(input.priceUSD ?? 0),
    isFree: input.isFree ?? true,
    isPublished: input.isPublished ?? true,
    promoted: Boolean(input.promoted),
    originalCurrency: (input.originalCurrency ?? "USD") as CourseCurrency,
    originalAmount: Number(input.originalAmount ?? input.priceUSD ?? 0),
    fxSnapshot: input.fxSnapshot ?? null,
  }))
  .handler(async ({ data, context }) => {
    // Paused legacy feature: fail closed even if called directly.
    assertLegacyFeatureDisabled("academy");
    if (!data.title) throw new Error("Title required");
    if (!data.isFree && !(data.priceUSD > 0)) throw new Error("Paid courses need a price > 0");
    const base = slugify(data.title);
    const slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    const { data: row, error } = await context.supabase
      .from("courses")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert({
        owner_id: context.userId,
        title: data.title,
        slug,
        description: data.description,
        category: data.category,
        level: data.level,
        instructor_name: data.instructorName || null,
        cover_path: data.coverPath,
        price_usd: data.isFree ? 0 : data.priceUSD,
        is_free: data.isFree,
        is_published: data.isPublished,
        promoted: data.promoted,
        original_currency: data.isFree ? "USD" : data.originalCurrency,
        original_amount: data.isFree ? 0 : data.originalAmount,
        fx_snapshot: data.isFree || !data.fxSnapshot ? null : JSON.parse(JSON.stringify(data.fxSnapshot)),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      .select(COURSE_COLS)
      .single();
    if (error) throw new Error(error.message);
    return mapCourse(row as Record<string, unknown>, null);
  });

export const updateCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    id: string;
    title?: string;
    description?: string;
    category?: CourseCategory;
    level?: CourseLevel;
    instructorName?: string;
    coverPath?: string | null;
    priceUSD?: number;
    isFree?: boolean;
    isPublished?: boolean;
    promoted?: boolean;
    originalCurrency?: CourseCurrency;
    originalAmount?: number;
    fxSnapshot?: CourseFxSnapshot;
  }) => input)
  .handler(async ({ data, context }) => {
    // Paused legacy feature: fail closed even if called directly.
    assertLegacyFeatureDisabled("academy");
    if (!data.id) throw new Error("Course id required");
    const patch: Record<string, unknown> = {};
    if (data.title !== undefined) patch.title = data.title;
    if (data.description !== undefined) patch.description = data.description;
    if (data.category !== undefined) patch.category = data.category;
    if (data.level !== undefined) patch.level = data.level;
    if (data.instructorName !== undefined) patch.instructor_name = data.instructorName;
    if (data.coverPath !== undefined) patch.cover_path = data.coverPath;
    if (data.priceUSD !== undefined) patch.price_usd = data.priceUSD;
    if (data.isFree !== undefined) patch.is_free = data.isFree;
    if (data.isPublished !== undefined) patch.is_published = data.isPublished;
    if (data.promoted !== undefined) patch.promoted = data.promoted;
    if (data.originalCurrency !== undefined) patch.original_currency = data.originalCurrency;
    if (data.originalAmount !== undefined) patch.original_amount = data.originalAmount;
    if (data.fxSnapshot !== undefined) {
      patch.fx_snapshot = data.fxSnapshot ? JSON.parse(JSON.stringify(data.fxSnapshot)) : null;
    }
    const { data: row, error } = await context.supabase
      .from("courses")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(patch as any)
      .eq("id", data.id)
      .select(COURSE_COLS)
      .single();
    if (error) throw new Error(error.message);
    return mapCourse(row as Record<string, unknown>, null);
  });

export const deleteCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => ({ id: String(input.id) }))
  .handler(async ({ data, context }) => {
    // Paused legacy feature: fail closed even if called directly.
    assertLegacyFeatureDisabled("academy");
    const { error } = await context.supabase.from("courses").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- MODULES ----------

export const upsertModule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    id?: string;
    courseId: string;
    position: number;
    title: string;
    description?: string;
    body?: string;
    videoUrl?: string;
    videoProvider?: VideoProvider;
    videoPath?: string | null;
    durationMin?: number;
    isPreview?: boolean;
  }) => input)
  .handler(async ({ data, context }) => {
    // Paused legacy feature: fail closed even if called directly.
    assertLegacyFeatureDisabled("academy");
    if (!data.courseId) throw new Error("Course id required");
    if (!data.title?.trim()) throw new Error("Module title required");
    const hasUrl = !!data.videoUrl?.trim();
    const hasFile = !!data.videoPath;
    const hasBody = !!(data.body && data.body.trim());
    if (!hasUrl && !hasFile && !hasBody) {
      throw new Error("Add a video link, upload a video, or write module notes");
    }
    const contentData: Record<string, unknown> = {};
    if (data.body !== undefined) contentData.body = data.body;
    if (data.videoPath !== undefined) contentData.video_path = data.videoPath;
    const row = {
      course_id: data.courseId,
      position: data.position ?? 0,
      title: data.title.trim(),
      description: (data.description ?? "").trim(),
      video_url: (data.videoUrl ?? "").trim(),
      video_provider: (data.videoProvider ?? "youtube") as VideoProvider,
      duration_min: data.durationMin ?? 0,
      is_preview: Boolean(data.isPreview),
      content_data: contentData as unknown as import("@/integrations/supabase/types").Database["public"]["Tables"]["course_modules"]["Insert"]["content_data"],
      content_type: hasFile ? "video_file" : hasUrl ? "video" : "text",
    };
    if (data.id) {
      const { data: updated, error } = await context.supabase
        .from("course_modules")
        .update(row)
        .eq("id", data.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      const [videoFileUrl] = data.videoPath
        ? await signCourseMedia(serverPublicClient(), [data.videoPath])
        : [null];
      return mapModule(updated as Record<string, unknown>, videoFileUrl);
    }
    const { data: created, error } = await context.supabase
      .from("course_modules")
      .insert(row)
      .select()
      .single();
    if (error) throw new Error(error.message);
    const [videoFileUrl] = data.videoPath
      ? await signCourseMedia(serverPublicClient(), [data.videoPath])
      : [null];
    return mapModule(created as Record<string, unknown>, videoFileUrl);
  });

export const deleteModule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => ({ id: String(input.id) }))
  .handler(async ({ data, context }) => {
    // Paused legacy feature: fail closed even if called directly.
    assertLegacyFeatureDisabled("academy");
    const { error } = await context.supabase.from("course_modules").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- ENROLLMENT & PROGRESS ----------

export const enrollFree = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { courseId: string }) => ({ courseId: String(input.courseId) }))
  .handler(async ({ data, context }): Promise<EnrollmentDTO> => {
    // Paused legacy feature: fail closed even if called directly.
    assertLegacyFeatureDisabled("academy");
    const { data: course, error: cErr } = await context.supabase
      .from("courses")
      .select("id, is_free, is_published")
      .eq("id", data.courseId)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!course) throw new Error("Course not found");
    if (!course.is_free) throw new Error("Paid enrollment is not yet available");
    if (!course.is_published) throw new Error("Course is not published");

    const { data: row, error } = await context.supabase
      .from("course_enrollments")
      .upsert(
        {
          user_id: context.userId,
          course_id: data.courseId,
          amount_paid_usd: 0,
        },
        { onConflict: "user_id,course_id", ignoreDuplicates: false },
      )
      .select()
      .single();
    if (error) throw new Error(error.message);
    return {
      id: row.id as string,
      courseId: row.course_id as string,
      createdAt: row.created_at as string,
      completedAt: (row.completed_at as string) ?? null,
      completedModules: [],
    };
  });

export const getMyEnrollment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { courseId: string }) => ({ courseId: String(input?.courseId ?? "") }))
  .handler(async ({ data, context }): Promise<EnrollmentDTO | null> => {
    if (!data.courseId) return null;
    const { data: row, error } = await context.supabase
      .from("course_enrollments")
      .select("*")
      .eq("user_id", context.userId)
      .eq("course_id", data.courseId)
      .maybeSingle();
    
    if (error) {
      console.error("[getMyEnrollment] Enrollment fetch error:", error);
      throw new Error(`Enrollment fetch error: ${error.message}`);
    }
    if (!row) return null;
    
    const { data: prog, error: pErr } = await context.supabase
      .from("course_progress")
      .select("*")
      .eq("user_id", context.userId)
      .eq("course_id", data.courseId);

    if (pErr) {
      console.error("[getMyEnrollment] Progress fetch error:", pErr);
      // We don't throw here to allow course content to load even if progress fails
    }

    const completedModules = Array.isArray(prog) ? prog.map((p) => String(p.module_id)) : [];
    
    return {
      id: String(row.id),
      courseId: String(row.course_id),
      createdAt: String(row.created_at),
      completedAt: row.completed_at ? String(row.completed_at) : null,
      completedModules,
    };
  });

export const listMyEnrollments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const { data, error } = await sb
      .from("course_enrollments")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[listMyEnrollments] Fetch error:", error);
      throw new Error(`Enrollments list error: ${error.message}`);
    }
    return (data ?? []).map((r) => ({
      id: r.id as string,
      courseId: r.course_id as string,
      createdAt: r.created_at as string,
      completedAt: (r.completed_at as string) ?? null,
    }));
  });

export const markModuleComplete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { courseId: string; moduleId: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    // Insert progress (ignore duplicate)
    const { error } = await sb.from("course_progress").upsert(
      {
        user_id: context.userId,
        course_id: data.courseId,
        module_id: data.moduleId,
      },
      { onConflict: "user_id,module_id", ignoreDuplicates: true },
    );
    if (error && !`${error.message}`.toLowerCase().includes("duplicate")) throw new Error(error.message);

    // Check completion
    const [{ data: allMods }, { data: doneMods }] = await Promise.all([
      sb.from("course_modules").select("id").eq("course_id", data.courseId),
      sb.from("course_progress").select("module_id").eq("user_id", context.userId).eq("course_id", data.courseId),
    ]);
    const total = (allMods ?? []).length;
    const done = (doneMods ?? []).length;
    let completedAt: string | null = null;
    if (total > 0 && done >= total) {
      const { data: updated } = await sb
        .from("course_enrollments")
        .update({ completed_at: new Date().toISOString() })
        .eq("user_id", context.userId)
        .eq("course_id", data.courseId)
        .is("completed_at", null)
        .select("completed_at")
        .maybeSingle();
      completedAt = (updated?.completed_at as string) ?? null;
    }
    return { total, done, completedAt };
  });

export const unmarkModuleComplete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { courseId: string; moduleId: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("course_progress")
      .delete()
      .eq("user_id", context.userId)
      .eq("module_id", data.moduleId);
    if (error) throw new Error(error.message);
    await context.supabase
      .from("course_enrollments")
      .update({ completed_at: null })
      .eq("user_id", context.userId)
      .eq("course_id", data.courseId);
    return { ok: true };
  });

// ---------- OWNER / ADMIN LISTS ----------

export const listMyCourses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("courses")
      .select(COURSE_COLS)
      .eq("owner_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => mapCourse(r as Record<string, unknown>, null));
  });

export const adminListCourses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { data: isAdmin } = await sb.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { data, error } = await sb
      .from("courses")
      .select(COURSE_COLS)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: Record<string, unknown>) => mapCourse(r, null));
  });

// ---------- UPLOAD HELPER ----------

/** Returns a signed upload URL for a cover in course-covers/<uid>/<filename>. */
export const getCourseCoverUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { filename: string }) => ({ filename: String(input.filename) }))
  .handler(async ({ data, context }) => {
    // Paused legacy feature: fail closed even if called directly.
    assertLegacyFeatureDisabled("academy");
    const safe = data.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${context.userId}/${Date.now()}-${safe}`;
    const { data: signed, error } = await context.supabase.storage
      .from("course-covers")
      .createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    return { path, token: signed.token, signedUrl: signed.signedUrl };
  });

/** Signed upload URL for a module video or inline body image in course-media/<uid>/<kind>/<file>. */
export const getCourseMediaUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { filename: string; kind?: "video" | "image" }) => ({
    filename: String(input.filename ?? ""),
    kind: input.kind === "video" ? "video" : "image",
  }))
  .handler(async ({ data, context }) => {
    // Paused legacy feature: fail closed even if called directly.
    assertLegacyFeatureDisabled("academy");
    const safe = data.filename.replace(/[^a-zA-Z0-9._-]/g, "_") || "file";
    const path = `${context.userId}/${data.kind}/${Date.now()}-${safe}`;
    const { data: signed, error } = await context.supabase.storage
      .from("course-media")
      .createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    return { path, token: signed.token, signedUrl: signed.signedUrl };
  });

/** Signed download URL for a course-media asset. */
export const getCourseMediaSignedUrl = createServerFn({ method: "POST" })
  .inputValidator((input: { path: string }) => ({ path: String(input.path ?? "") }))
  .handler(async ({ data }) => {
    if (!data.path) return { url: null };
    const sb = serverPublicClient();
    const { data: signed } = await sb.storage
      .from("course-media")
      .createSignedUrl(data.path, 60 * 60 * 24 * 7);
    return { url: signed?.signedUrl ?? null };
  });



export const getCourseCoverViewUrl = createServerFn({ method: "POST" })
  .inputValidator((input: { path: string }) => ({ path: String(input.path) }))
  .handler(async ({ data }) => {
    if (!data.path) return { url: null };
    const sb = serverPublicClient();
    const { data: signed } = await sb.storage
      .from("course-covers")
      .createSignedUrl(data.path, 60 * 60 * 24 * 7);
    return { url: signed?.signedUrl ?? null };
  });

// ---------- PAID ENROLLMENT ----------

export type EnrollCurrency = string;
export type EnrollPaymentMethod = "wallet" | "card" | "bank_transfer" | "mobile_money";

export const FX_FROM_USD_ACADEMY: Record<EnrollCurrency, number> = fallbackRateTable();
export const INSTRUCTOR_SHARE = 0.8;
export const PLATFORM_ACADEMY_SHARE = 0.2;
export const WALLET_CASHBACK_PCT_ACADEMY = 0.02;

export interface EnrollPaidInput {
  courseId: string;
  displayCurrency: EnrollCurrency;
  paymentMethod: EnrollPaymentMethod;
  couponCode?: string | null;
  /** Amount of Cashback Wallet (USD) to spend on this enrollment. */
  applyCashbackUSD?: number | null;
}

export interface EnrollPaidResult {
  enrollment: EnrollmentDTO | null;
  totalUSD: number;
  displayTotal: number;
  displayCurrency: EnrollCurrency;
  discountUSD?: number;
  cashbackAppliedUSD?: number;
  cashbackUSD?: number;
  /** Shortfall expressed in USD (legacy). */
  walletShortfallUSD?: number;
  /** Shortfall expressed in the user's display currency (what the wallet is actually debited in). */
  walletShortfallDisplay?: number;
}

export const enrollPaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: EnrollPaidInput) => ({
    courseId: String(input.courseId ?? ""),
    displayCurrency: (input.displayCurrency ?? "USD") as EnrollCurrency,
    paymentMethod: (input.paymentMethod ?? "wallet") as EnrollPaymentMethod,
    couponCode: input.couponCode ? String(input.couponCode).trim().toUpperCase() : null,
    applyCashbackUSD: Math.max(0, Number(input.applyCashbackUSD ?? 0)),
  }))
  .handler(async ({ data, context }): Promise<EnrollPaidResult> => {
    // Paused legacy feature: fail closed even if called directly.
    assertLegacyFeatureDisabled("academy");
    const { supabase, userId } = context;
    if (!data.courseId) throw new Error("Course id required");

    const { data: course, error: cErr } = await supabase
      .from("courses")
      .select("id, owner_id, price_usd, is_free, is_published, original_currency")
      .eq("id", data.courseId)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!course) throw new Error("Course not found");
    if (!course.is_published) throw new Error("Course is not published");
    if (course.is_free) throw new Error("Course is free — use enrollFree");
    if ((course.owner_id as string) === userId) throw new Error("You already own this course");

    // Global catalogue: any learner can enroll. The charge is always created in
    // the buyer's own home currency, converted from the USD base price.



    // Already enrolled?
    const { data: existing } = await supabase
      .from("course_enrollments")
      .select("id")
      .eq("user_id", userId)
      .eq("course_id", data.courseId)
      .maybeSingle();
    if (existing) throw new Error("You're already enrolled in this course");

    const grossUSD = Number(Number(course.price_usd).toFixed(2));

    // Coupon only for non-wallet payments (matches marketplace policy).
    let discountUSD = 0;
    if (data.couponCode && data.paymentMethod !== "wallet") {
      const { data: c } = await supabase
        .from("coupons")
        .select("discount_pct")
        .eq("code", data.couponCode)
        .eq("active", true)
        .maybeSingle();
      if (c) {
        const pct = Number(c.discount_pct);
        discountUSD = Number(((grossUSD * pct) / 100).toFixed(2));
      }
    }
    const afterCouponUSD = Number((grossUSD - discountUSD).toFixed(2));

    // Cashback Wallet spend — clamp to (a) requested amount, (b) available
    // cashback balance, (c) remaining total. Must be debited atomically via
    // the SECURITY DEFINER `cashback_debit` RPC so a race can't overspend.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let cashbackAppliedUSD = 0;
    if (data.applyCashbackUSD > 0) {
      const { data: wRow } = await supabaseAdmin
        .from("wallets")
        .select("accumulated_cashback")
        .eq("user_id", userId)
        .eq("currency", "USD")
        .maybeSingle();
      const availableCB = Number(wRow?.accumulated_cashback ?? 0);
      const want = Math.min(data.applyCashbackUSD, availableCB, afterCouponUSD);
      const spend = Number(want.toFixed(2));
      if (spend > 0) {
        const { data: cbOk, error: cbErr } = await supabaseAdmin.rpc("cashback_debit", {
          _user_id: userId,
          _amount: spend,
        });
        if (cbErr) throw new Error(cbErr.message);
        if (cbOk) cashbackAppliedUSD = spend;
      }
    }

    const totalUSD = Number((afterCouponUSD - cashbackAppliedUSD).toFixed(2));
    const fx = FX_FROM_USD_ACADEMY[data.displayCurrency];
    const displayTotal = Number((totalUSD * fx).toFixed(2));

    // Wallet debit path — debit the buyer's wallet in their DISPLAY currency
    // (matches how top-ups credit per-currency), not USD. This is what the user
    // funded in via Paystack, so the "true balance" they see is used.
    if (data.paymentMethod === "wallet" && totalUSD > 0) {
      const { data: ok, error: dErr } = await supabaseAdmin.rpc("wallet_debit_currency", {
        _user_id: userId,
        _amount: displayTotal,
        _currency: data.displayCurrency,
      });
      if (dErr) throw new Error(dErr.message);
      if (!ok) {
        // Refund cashback we just debited so the user isn't out-of-pocket on a
        // failed enrollment.
        if (cashbackAppliedUSD > 0) {
          await supabaseAdmin.rpc("cashback_credit", { _user_id: userId, _amount: cashbackAppliedUSD });
        }
        const { data: w } = await supabaseAdmin
          .from("wallets")
          .select("available_balance")
          .eq("user_id", userId)
          .eq("currency", data.displayCurrency)
          .maybeSingle();
        const bal = Number(w?.available_balance ?? 0);
        const shortDisplay = Number((displayTotal - bal).toFixed(2));
        return {
          enrollment: null,
          totalUSD,
          displayTotal,
          displayCurrency: data.displayCurrency,
          walletShortfallUSD: Number((shortDisplay / fx).toFixed(2)),
          walletShortfallDisplay: shortDisplay,
        };
      }
    }

    // Insert enrollment
    const { data: eRow, error: eErr } = await supabase
      .from("course_enrollments")
      .insert({
        user_id: userId,
        course_id: data.courseId,
        amount_paid_usd: totalUSD,
        payment_method: data.paymentMethod,
        display_currency: data.displayCurrency,
        display_total: displayTotal,
        coupon_code: data.couponCode,
        discount_usd: discountUSD,
        paid_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (eErr) throw new Error(eErr.message);

    // Buyer wallet ledger
    await supabaseAdmin.from("wallet_transactions").insert({
      user_id: userId,
      tx_hash: `0x${Math.random().toString(16).slice(2, 6).toUpperCase()}-${Date.now().toString(16).toUpperCase()}`,
      type: "Marketplace Purchase",
      amount: displayTotal,
      currency: dbCurrency(data.displayCurrency),
      inflow: false,
      status: "success",
      occurred_at: new Date().toISOString(),
    });

    // 80/20 split — instructor gets 80%, platform academy wallet gets 20%.
    // ALWAYS computed on the full post-coupon price. Applying cashback only
    // shifts value from wallet debit to Cashback Wallet debit; instructor +
    // platform are made whole on the true sale price.
    const splitBaseUSD = afterCouponUSD;
    const instructorCutUSD = Number((splitBaseUSD * INSTRUCTOR_SHARE).toFixed(2));
    const platformCutUSD = Number((splitBaseUSD - instructorCutUSD).toFixed(2));

    await supabaseAdmin.rpc("wallet_credit", {
      _user_id: course.owner_id as string,
      _amount: instructorCutUSD,
    });

    await supabaseAdmin.rpc("system_wallet_credit", {
      _kind: "academy",
      _amount: platformCutUSD,
      _source: "course_enrollment",
      _ref: eRow.id as string,
      _meta: {
        enrollment_id: eRow.id,
        course_id: data.courseId,
        buyer_id: userId,
        instructor_id: course.owner_id,
      },
    });

    // 2% cashback credited to the SPEND-ONLY Cashback Wallet on EVERY paid
    // enrollment (wallet or card), based on the full post-coupon price —
    // regardless of whether the buyer applied cashback this time.
    const cashbackUSD = Number((splitBaseUSD * WALLET_CASHBACK_PCT_ACADEMY).toFixed(2));
    if (cashbackUSD > 0) {
      await supabaseAdmin.rpc("cashback_credit", { _user_id: userId, _amount: cashbackUSD });
      await supabaseAdmin.from("wallet_transactions").insert({
        user_id: userId,
        tx_hash: `0x${Math.random().toString(16).slice(2, 6).toUpperCase()}-${Date.now().toString(16).toUpperCase()}`,
        type: "Affiliate Cashback Payout",
        amount: Number((cashbackUSD * fx).toFixed(2)),
        currency: dbCurrency(data.displayCurrency),
        inflow: true,
        status: "success",
        occurred_at: new Date().toISOString(),
      });
      await supabaseAdmin
        .from("course_enrollments")
        .update({ cashback_usd: cashbackUSD })
        .eq("id", eRow.id);
    }

    return {
      enrollment: {
        id: eRow.id as string,
        courseId: eRow.course_id as string,
        createdAt: eRow.created_at as string,
        completedAt: null,
        completedModules: [],
      },
      totalUSD,
      displayTotal,
      displayCurrency: data.displayCurrency,
      discountUSD: discountUSD || undefined,
      cashbackAppliedUSD: cashbackAppliedUSD || undefined,
      cashbackUSD: cashbackUSD || undefined,
    };
  });

// ---------- WIZARD (5-step publish flow) ----------

export type LessonType = "video" | "text" | "pdf";

export interface WizardLessonInput {
  title: string;
  type: LessonType;
  isPreview?: boolean;
  durationMin?: number;
  // For video: { url, provider }; text: { html }; pdf: { url }
  content: Record<string, unknown>;
}

export interface WizardSectionInput {
  title: string;
  lessons: WizardLessonInput[];
}

export interface WizardQuizQuestion {
  text: string;
  type: "multiple" | "boolean";
  options: { text: string; correct: boolean }[];
}

export interface WizardQuizInput {
  title: string;
  passingGrade: number; // 0-100
  questions: WizardQuizQuestion[];
}

export interface SaveCourseWizardInput {
  id?: string; // update if provided
  // Basics
  title: string;
  subtitle?: string;
  description?: string; // short
  longDescription?: string;
  category?: CourseCategory;
  level?: CourseLevel;
  instructorName?: string;
  coverPath?: string | null;
  // Curriculum
  sections: WizardSectionInput[];
  // Quizzes (course-level, plus optional per-module quizzes future work)
  quizzes: WizardQuizInput[];
  // Access & settings
  isFree: boolean;
  priceUSD?: number;
  originalCurrency?: CourseCurrency;
  originalAmount?: number;
  fxSnapshot?: CourseFxSnapshot;
  requireLinear?: boolean;
  issueCertificate?: boolean;
  certificateTemplate?: string | null;
  // Launch
  isPublished: boolean;
}

export const saveCourseWizard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: SaveCourseWizardInput) => input)
  .handler(async ({ data, context }) => {
    // Paused legacy feature: fail closed even if called directly.
    assertLegacyFeatureDisabled("academy");
    if (!data.title?.trim()) throw new Error("Course title is required");
    const totalLessons = (data.sections ?? []).reduce((n, s) => n + (s.lessons?.length ?? 0), 0);
    if (data.isPublished && totalLessons === 0) throw new Error("Add at least one lesson before publishing");
    if (!data.isFree && !(Number(data.priceUSD ?? 0) > 0)) throw new Error("Paid courses require a price");

    const sb = context.supabase;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sbAny = sb as any;

    const patch: Record<string, unknown> = {
      title: data.title.trim(),
      subtitle: data.subtitle ?? null,
      description: (data.description ?? "").trim(),
      long_description: data.longDescription ?? null,
      category: data.category ?? "frontend",
      level: data.level ?? "beginner",
      instructor_name: data.instructorName?.trim() || null,
      cover_path: data.coverPath ?? null,
      is_free: data.isFree,
      price_usd: data.isFree ? 0 : Number(data.priceUSD ?? 0),
      original_currency: data.isFree ? "USD" : (data.originalCurrency ?? "USD"),
      original_amount: data.isFree ? 0 : Number(data.originalAmount ?? data.priceUSD ?? 0),
      fx_snapshot: data.isFree || !data.fxSnapshot ? null : JSON.parse(JSON.stringify(data.fxSnapshot)),
      require_linear: Boolean(data.requireLinear),
      issue_certificate: Boolean(data.issueCertificate),
      certificate_template: data.certificateTemplate ?? null,
      quizzes: JSON.parse(JSON.stringify(data.quizzes ?? [])),
      is_published: Boolean(data.isPublished),
    };

    let courseId = data.id ?? "";
    if (courseId) {
      const { data: existing } = await sb
        .from("courses")
        .select("owner_id")
        .eq("id", courseId)
        .maybeSingle();
      if (!existing) throw new Error("Course not found");
      const { error } = await sbAny.from("courses").update(patch).eq("id", courseId);
      if (error) throw new Error(error.message);
    } else {
      const base = slugify(data.title);
      const slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
      const insertRow = { ...patch, owner_id: context.userId, slug };
      const { data: row, error } = await sbAny
        .from("courses")
        .insert(insertRow)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      courseId = row.id as string;
    }

    // Replace curriculum: delete existing modules for this course, then re-insert.
    await sb.from("course_modules").delete().eq("course_id", courseId);

    const rows: Record<string, unknown>[] = [];
    let pos = 0;
    (data.sections ?? []).forEach((section, sIdx) => {
      (section.lessons ?? []).forEach((lesson) => {
        const type: LessonType = lesson.type === "text" || lesson.type === "pdf" ? lesson.type : "video";
        const isVideo = type === "video";
        const videoUrl = isVideo ? String((lesson.content?.url as string) ?? "") : null;
        const provider =
          isVideo && /vimeo\.com/i.test(videoUrl ?? "") ? "vimeo" : "youtube";
        rows.push({
          course_id: courseId,
          position: pos++,
          title: (lesson.title ?? "Untitled lesson").trim() || "Untitled lesson",
          description: "",
          video_url: videoUrl,
          video_provider: provider,
          duration_min: Number(lesson.durationMin ?? 0),
          is_preview: Boolean(lesson.isPreview),
          section_title: section.title ?? null,
          section_position: sIdx,
          content_type: type,
          content_data: JSON.parse(JSON.stringify(lesson.content ?? {})),
        });
      });
    });
    if (rows.length > 0) {
      const { error: mErr } = await sbAny.from("course_modules").insert(rows);
      if (mErr) throw new Error(mErr.message);
    }

    return { id: courseId };
  });
