import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type CollectionItemKind = "product" | "post" | "course" | "bounty" | "link" | "image";

export interface CollectionItemDTO {
  id: string;
  kind: CollectionItemKind;
  refId: string | null;
  url: string | null;
  title: string | null;
  imageUrl: string | null;
  note: string | null;
}

export interface CollectionDTO {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  coverUrl: string | null;
  isPublic: boolean;
  category: string | null;
  itemCount: number;
  items: CollectionItemDTO[];
}

type Row = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  cover_url: string | null;
  is_public: boolean;
  category?: string | null;
};

type ItemRow = {
  id: string;
  collection_id: string;
  kind: string;
  ref_id: string | null;
  url: string | null;
  title: string | null;
  image_url: string | null;
  note: string | null;
};

function shape(boards: Row[], items: ItemRow[]): CollectionDTO[] {
  return boards.map((b) => {
    const own = items.filter((i) => i.collection_id === b.id);
    return {
      id: b.id,
      title: b.title,
      slug: b.slug,
      description: b.description,
      coverUrl: b.cover_url ?? own.find((i) => i.image_url)?.image_url ?? null,
      isPublic: b.is_public,
      category: b.category ?? null,
      itemCount: own.length,
      items: own.map((i) => ({
        id: i.id,
        kind: (i.kind as CollectionItemKind) ?? "link",
        refId: i.ref_id,
        url: i.url,
        title: i.title,
        imageUrl: i.image_url,
        note: i.note,
      })),
    };
  });
}

/** Public curated boards for a person's profile (public boards only). */
export const listPublicCollections = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ idOrSlug: z.string().trim().min(1).max(120) }).parse(input),
  )
  .handler(async ({ data }): Promise<CollectionDTO[]> => {
    const { createEcosystemClient } = await import("./ecosystem/public-client.server");
    const supabase = await createEcosystemClient();

    let userId = data.idOrSlug;
    if (!UUID_RE.test(userId)) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("slug", data.idOrSlug)
        .maybeSingle();
      if (!prof?.user_id) return [];
      userId = prof.user_id as string;
    }

    const { data: boards } = await supabase
      .from("collections")
      .select("id, title, slug, description, cover_url, is_public, category")
      .eq("user_id", userId)
      .eq("is_public", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    const list = (boards ?? []) as Row[];
    if (!list.length) return [];

    const { data: items } = await supabase
      .from("collection_items")
      .select("id, collection_id, kind, ref_id, url, title, image_url, note")
      .in(
        "collection_id",
        list.map((b) => b.id),
      )
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    return shape(list, (items ?? []) as ItemRow[]);
  });

/** Owner view — includes private boards. */
export const listMyCollections = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CollectionDTO[]> => {
    const { data: boards } = await context.supabase
      .from("collections")
      .select("id, title, slug, description, cover_url, is_public, category")
      .eq("user_id", context.userId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    const list = (boards ?? []) as Row[];
    if (!list.length) return [];

    const { data: items } = await context.supabase
      .from("collection_items")
      .select("id, collection_id, kind, ref_id, url, title, image_url, note")
      .in(
        "collection_id",
        list.map((b) => b.id),
      )
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    return shape(list, (items ?? []) as ItemRow[]);
  });

const slugify = (v: string) =>
  v
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "board";

const BoardInput = z.object({
  id: z.string().uuid().optional().nullable(),
  title: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).optional().nullable(),
  coverUrl: z.string().trim().max(1000).optional().nullable(),
  isPublic: z.boolean().optional(),
  category: z.string().trim().max(40).optional().nullable(),
});

/** Create or update one of the signed-in member's boards. */
export const saveCollection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => BoardInput.parse(input))
  .handler(async ({ data, context }) => {
    const payload = {
      user_id: context.userId,
      title: data.title,
      slug: `${slugify(data.title)}-${Math.random().toString(36).slice(2, 6)}`,
      description: data.description || null,
      cover_url: data.coverUrl || null,
      is_public: data.isPublic ?? false,
      category: data.category || null,
    };

    if (data.id) {
      const { slug: _slug, user_id: _u, ...patch } = payload;
      const { error } = await context.supabase
        .from("collections")
        .update(patch)
        .eq("id", data.id)
        .eq("user_id", context.userId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }

    const { data: row, error } = await context.supabase
      .from("collections")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const deleteCollection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("collections")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const ItemInput = z.object({
  collectionId: z.string().uuid(),
  kind: z.enum(["product", "post", "course", "bounty", "link", "image"]).default("link"),
  refId: z.string().uuid().optional().nullable(),
  url: z.string().trim().max(1000).optional().nullable(),
  title: z.string().trim().max(160).optional().nullable(),
  imageUrl: z.string().trim().max(1000).optional().nullable(),
  note: z.string().trim().max(400).optional().nullable(),
});

export const addCollectionItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ItemInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: board } = await context.supabase
      .from("collections")
      .select("id")
      .eq("id", data.collectionId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!board) throw new Error("Board not found");

    const { count } = await context.supabase
      .from("collection_items")
      .select("id", { count: "exact", head: true })
      .eq("collection_id", data.collectionId);

    const { data: row, error } = await context.supabase
      .from("collection_items")
      .insert({
        collection_id: data.collectionId,
        user_id: context.userId,
        kind: data.kind,
        ref_id: data.refId || null,
        url: data.url || null,
        title: data.title || null,
        image_url: data.imageUrl || null,
        note: data.note || null,
        sort_order: count ?? 0,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const deleteCollectionItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("collection_items")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
