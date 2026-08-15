import { createFileRoute, useNavigate, useParams, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Link2,
  Image as ImageIcon,
  Quote,
  Code,
  Loader2,
  ArrowLeft,
  Save,
  X,
  Plus,
  Strikethrough,
  Undo,
  Redo,
  Eye,
  Pencil,
  Youtube,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ResponsiveImage } from "@/components/ui/responsive-image";
import {
  getBlogAdmin,
  upsertBlogPost,
  upsertBlogCategory,
  upsertBlogTag,
  listBlogCategories,
  listBlogTags,
} from "@/lib/blog.functions";

export const Route = createFileRoute("/admin/blog/$id")({
  head: () => ({
    meta: [{ title: "Edit blog · Admin" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: BlogEditorPage,
});

type Status = "draft" | "published" | "scheduled";

function BlogEditorPage() {
  const { id: routeId } = useParams({ from: "/admin/blog/$id" });
  const isNew = routeId === "new";
  const navigate = useNavigate();

  const getFn = useServerFn(getBlogAdmin);
  const upsertFn = useServerFn(upsertBlogPost);
  const catFn = useServerFn(listBlogCategories);
  const tagFn = useServerFn(listBlogTags);
  const newCatFn = useServerFn(upsertBlogCategory);
  const newTagFn = useServerFn(upsertBlogTag);

  const [id, setId] = useState<string | undefined>(isNew ? undefined : routeId);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [coverPath, setCoverPath] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("draft");
  const [scheduledAt, setScheduledAt] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [categories, setCategories] = useState<{ id: string; slug: string; name: string }[]>([]);
  const [tags, setTags] = useState<{ id: string; slug: string; name: string }[]>([]);
  const [newCat, setNewCat] = useState("");
  const [newTag, setNewTag] = useState("");
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [autosavedAt, setAutosavedAt] = useState<number | null>(null);
  const [bodyHtml, setBodyHtml] = useState<string>("");
  const [showPreview, setShowPreview] = useState(false);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [imgMenu, setImgMenu] = useState<{ top: number; left: number; width: number } | null>(null);
  const activeImgRef = useRef<HTMLImageElement | null>(null);

  const openImgMenuFor = (img: HTMLImageElement) => {
    const editor = editorRef.current;
    if (!editor) return;
    const er = editor.getBoundingClientRect();
    const ir = img.getBoundingClientRect();
    activeImgRef.current = img;
    const currentPct = Math.round((img.getBoundingClientRect().width / editor.clientWidth) * 100);
    setImgMenu({
      top: ir.bottom - er.top + 8,
      left: Math.max(0, ir.left - er.left),
      width: isFinite(currentPct) ? currentPct : 100,
    });
  };

  const applyImgWidth = (pct: number) => {
    const img = activeImgRef.current;
    if (!img) return;
    img.style.width = `${pct}%`;
    img.style.maxWidth = "100%";
    img.style.height = "auto";
    img.setAttribute("data-resizable", "true");
    setImgMenu((m) => (m ? { ...m, width: pct } : m));
    setBodyHtml(editorRef.current?.innerHTML ?? "");
  };

  const removeActiveImg = () => {
    const img = activeImgRef.current;
    if (!img) return;
    const parent = img.parentElement;
    img.remove();
    if (
      parent &&
      parent.tagName === "P" &&
      !parent.textContent?.trim() &&
      parent.children.length === 0
    )
      parent.remove();
    activeImgRef.current = null;
    setImgMenu(null);
    setBodyHtml(editorRef.current?.innerHTML ?? "");
  };

  const onEditorClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    if (t.tagName === "IMG") {
      e.preventDefault();
      openImgMenuFor(t as HTMLImageElement);
    } else {
      setImgMenu(null);
    }
  };
  const hydratedRef = useRef(false);
  const draftKey = `blog-editor-draft:${routeId}`;

  useEffect(() => {
    (async () => {
      const [c, t] = await Promise.all([catFn(), tagFn()]);
      setCategories(c.categories as any);
      setTags(t.tags as any);
    })();
  }, [catFn, tagFn]);

  useEffect(() => {
    if (isNew) {
      // Restore local draft for a brand-new post if present
      try {
        const raw = localStorage.getItem(draftKey);
        if (raw) {
          const d = JSON.parse(raw);
          setTitle(d.title ?? "");
          setSlug(d.slug ?? "");
          setExcerpt(d.excerpt ?? "");
          setCoverPath(d.coverPath ?? null);
          setCoverUrl(d.coverUrl ?? null);
          setStatus(d.status ?? "draft");
          setScheduledAt(d.scheduledAt ?? "");
          setCategoryId(d.categoryId ?? null);
          setTagIds(d.tagIds ?? []);
          setBodyHtml(d.bodyHtml ?? "");
          if (editorRef.current) editorRef.current.innerHTML = d.bodyHtml ?? "";
          setAutosavedAt(d.savedAt ?? null);
        }
      } catch {}
      hydratedRef.current = true;
      return;
    }
    (async () => {
      const res = await getFn({ data: { id: routeId } });
      const p: any = res.post;
      setId(p.id);
      let restored = false;
      let d: any = null;
      try {
        const raw = localStorage.getItem(draftKey);
        if (raw) {
          d = JSON.parse(raw);
          const serverTs = p.updated_at ? new Date(p.updated_at).getTime() : 0;
          if (
            d.savedAt &&
            d.savedAt > serverTs &&
            confirm("A newer local draft was found. Restore it? (Cancel loads the saved version.)")
          ) {
            restored = true;
          } else {
            localStorage.removeItem(draftKey);
          }
        }
      } catch {}
      const src = restored ? d : p;
      setTitle(src.title ?? "");
      setSlug(src.slug ?? "");
      setExcerpt(src.excerpt ?? "");
      setCoverPath(src.cover_path ?? src.coverPath ?? null);
      setCoverUrl(src.cover_url ?? src.coverUrl ?? null);
      setStatus(src.status ?? "draft");
      setScheduledAt(
        restored
          ? (d.scheduledAt ?? "")
          : p.scheduled_at
            ? new Date(p.scheduled_at).toISOString().slice(0, 16)
            : "",
      );
      setCategoryId(src.category_id ?? src.categoryId ?? null);
      setTagIds(src.tag_ids ?? src.tagIds ?? []);
      const html = restored ? (d.bodyHtml ?? "") : (p.body_html ?? "");
      setBodyHtml(html);
      if (editorRef.current) editorRef.current.innerHTML = html;
      if (restored) setAutosavedAt(d.savedAt ?? null);
      setLoading(false);
      hydratedRef.current = true;
    })();
  }, [isNew, routeId, getFn, draftKey]);

  // Autosave draft to localStorage (debounced)
  useEffect(() => {
    if (!hydratedRef.current) return;
    const t = setTimeout(() => {
      try {
        const savedAt = Date.now();
        localStorage.setItem(
          draftKey,
          JSON.stringify({
            title,
            slug,
            excerpt,
            coverPath,
            coverUrl,
            status,
            scheduledAt,
            categoryId,
            tagIds,
            bodyHtml,
            savedAt,
          }),
        );
        setAutosavedAt(savedAt);
      } catch {}
    }, 800);
    return () => clearTimeout(t);
  }, [
    draftKey,
    title,
    slug,
    excerpt,
    coverPath,
    coverUrl,
    status,
    scheduledAt,
    categoryId,
    tagIds,
    bodyHtml,
  ]);

  const exec = (cmd: string, arg?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, arg);
    if (editorRef.current) setBodyHtml(editorRef.current.innerHTML);
  };
  const setBlock = (tag: string) => exec("formatBlock", tag);

  const insertLink = () => {
    const url = window.prompt("Enter URL:");
    if (!url) return;
    exec("createLink", url);
  };

  const uploadFileToBucket = async (file: File): Promise<{ path: string; url: string }> => {
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes.user?.id;
    if (!uid) throw new Error("Not signed in");
    const ext = (file.name.split(".").pop() || "bin").toLowerCase().slice(0, 8);
    const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from("blog-covers").upload(path, file, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });
    if (error) throw error;
    const { data: signed, error: sErr } = await supabase.storage
      .from("blog-covers")
      .createSignedUrl(path, 60 * 60 * 24 * 365);
    if (sErr || !signed) throw sErr ?? new Error("Sign failed");
    return { path, url: signed.signedUrl };
  };

  const onCoverPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      const { path, url } = await uploadFileToBucket(f);
      setCoverPath(path);
      setCoverUrl(url);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setUploading(false);
      if (coverInputRef.current) coverInputRef.current.value = "";
    }
  };

  const onImagePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      const { url } = await uploadFileToBucket(f);
      exec(
        "insertHTML",
        `<p><img src="${url}" alt="" data-resizable="true" style="width:100%;max-width:100%;border-radius:8px;cursor:pointer" /></p>`,
      );
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  };

  const addCategory = async () => {
    const n = newCat.trim();
    if (!n) return;
    const r = await newCatFn({ data: { name: n } });
    setCategories((prev) =>
      [...prev.filter((c) => c.id !== r.id), r as any].sort((a, b) => a.name.localeCompare(b.name)),
    );
    setCategoryId(r.id);
    setNewCat("");
  };

  const addTag = async () => {
    const n = newTag.trim();
    if (!n) return;
    const r = await newTagFn({ data: { name: n } });
    setTags((prev) => (prev.some((t) => t.id === r.id) ? prev : [...prev, r as any]));
    setTagIds((prev) => (prev.includes(r.id) ? prev : [...prev, r.id]));
    setNewTag("");
  };

  const save = async (finalStatus?: Status) => {
    const s = finalStatus ?? status;
    if (!title.trim()) return alert("Title is required.");
    const body_html = editorRef.current?.innerHTML ?? "";
    setSaving(true);
    try {
      const res = await upsertFn({
        data: {
          id,
          title: title.trim(),
          slug: slug.trim() || undefined,
          excerpt: excerpt.trim() || undefined,
          body_html,
          cover_path: coverPath,
          category_id: categoryId,
          status: s,
          scheduled_at:
            s === "scheduled" && scheduledAt ? new Date(scheduledAt).toISOString() : null,
          tag_ids: tagIds,
        },
      });
      setId(res.id);
      setStatus(s);
      try {
        localStorage.removeItem(draftKey);
      } catch {}
      if (isNew) {
        try {
          localStorage.removeItem(`blog-editor-draft:${res.id}`);
        } catch {}
      }
      setAutosavedAt(null);
      alert(s === "published" ? "Published!" : s === "scheduled" ? "Scheduled." : "Draft saved.");
      if (isNew) navigate({ to: "/admin/blog/$id", params: { id: res.id } });
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const btn = "p-2 rounded-[10px] hover:bg-white/10 text-slate-300 hover:text-white transition";

  if (loading) {
    return (
      <div className="flex justify-center p-10">
        <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/admin/blog"
            className="inline-flex items-center gap-1 text-slate-400 hover:text-white text-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          <span className="text-xs uppercase tracking-wider text-slate-500 font-bold">
            {isNew ? "New post" : "Edit post"}
          </span>
          {autosavedAt && (
            <span className="text-[10px] text-slate-500 hidden sm:inline">
              Autosaved ·{" "}
              {new Date(autosavedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPreview((v) => !v)}
            className={`px-3 py-2 rounded-[10px] border text-sm inline-flex items-center gap-1 ${showPreview ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-200" : "bg-white/5 hover:bg-white/10 border-white/10 text-slate-200"}`}
            title={showPreview ? "Back to editor" : "Live preview"}
          >
            {showPreview ? (
              <>
                <Pencil className="w-4 h-4" /> Edit
              </>
            ) : (
              <>
                <Eye className="w-4 h-4" /> Preview
              </>
            )}
          </button>
          <button
            onClick={() => save("draft")}
            disabled={saving}
            className="px-3 py-2 rounded-[10px] bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-sm inline-flex items-center gap-1"
          >
            <Save className="w-4 h-4" /> Save draft
          </button>
          <button
            onClick={() => save("scheduled")}
            disabled={saving || !scheduledAt}
            className="px-3 py-2 rounded-[10px] bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-sm disabled:opacity-40"
          >
            Schedule
          </button>
          <button
            onClick={() => save("published")}
            disabled={saving}
            className="px-3 py-2 rounded-[10px] bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-bold inline-flex items-center gap-1"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Publish
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main editor / Preview */}
        <div className="lg:col-span-2 space-y-4">
          {showPreview ? (
            <div className="bg-[#0b0b0d] border border-white/10 rounded-xl p-5 sm:p-8">
              <div className="text-[10px] uppercase tracking-widest text-emerald-400/70 font-bold mb-3">
                Live preview · public reader
              </div>
              {(() => {
                const cat = categories.find((c) => c.id === categoryId);
                return cat ? (
                  <div className="text-xs uppercase tracking-wider text-emerald-400 font-bold mb-2">
                    {cat.name}
                  </div>
                ) : null;
              })()}
              <h1 className="text-white text-3xl sm:text-4xl font-black leading-tight">
                {title || "Untitled post"}
              </h1>
              <div className="mt-3 text-sm text-slate-500">
                By You · {new Date().toLocaleDateString()}
              </div>
              {coverUrl && (
                <img
                  src={coverUrl}
                  alt=""
                  className="w-full mt-6 rounded-xl border border-white/10 aspect-video object-cover"
                />
              )}
              {bodyHtml.trim() ? (
                <article
                  className="blog-article mt-8 text-slate-200 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: bodyHtml }}
                />
              ) : (
                <p className="mt-8 text-slate-500 italic text-sm">
                  Start writing to see your post appear here…
                </p>
              )}
              {tagIds.length > 0 && (
                <div className="mt-8 flex flex-wrap gap-1">
                  {tags
                    .filter((t) => tagIds.includes(t.id))
                    .map((t) => (
                      <span
                        key={t.id}
                        className="text-[10px] px-2 py-1 rounded-full border border-white/10 text-slate-400"
                      >
                        #{t.name}
                      </span>
                    ))}
                </div>
              )}
              {excerpt && (
                <div className="mt-6 text-xs text-slate-500 border-t border-white/5 pt-3">
                  <span className="uppercase tracking-wider text-slate-600 font-bold">
                    Excerpt ·{" "}
                  </span>
                  {excerpt}
                </div>
              )}
            </div>
          ) : (
            <>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Post title"
                className="w-full bg-transparent border-b border-white/10 pb-3 text-white text-3xl font-black placeholder:text-slate-600 focus:outline-none"
              />
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="url-slug (auto-generated if empty)"
                className="w-full bg-black/30 border border-white/10 rounded-[10px] px-3 py-2 text-sm text-slate-300 font-mono"
              />

              {/* Toolbar */}
              <div className="flex flex-wrap items-center gap-0.5 bg-[#141418] border border-white/10 rounded-t-lg p-1 sticky top-0 z-10">
                <button className={btn} onClick={() => setBlock("h1")} title="Heading 1">
                  <Heading1 className="w-4 h-4" />
                </button>
                <button className={btn} onClick={() => setBlock("h2")} title="Heading 2">
                  <Heading2 className="w-4 h-4" />
                </button>
                <button className={btn} onClick={() => setBlock("h3")} title="Heading 3">
                  <Heading3 className="w-4 h-4" />
                </button>
                <button className={btn} onClick={() => setBlock("p")} title="Paragraph">
                  <span className="text-xs font-bold px-1">P</span>
                </button>
                <span className="w-px h-5 bg-white/10 mx-1" />
                <button className={btn} onClick={() => exec("bold")} title="Bold">
                  <Bold className="w-4 h-4" />
                </button>
                <button className={btn} onClick={() => exec("italic")} title="Italic">
                  <Italic className="w-4 h-4" />
                </button>
                <button className={btn} onClick={() => exec("underline")} title="Underline">
                  <UnderlineIcon className="w-4 h-4" />
                </button>
                <button className={btn} onClick={() => exec("strikeThrough")} title="Strike">
                  <Strikethrough className="w-4 h-4" />
                </button>
                <span className="w-px h-5 bg-white/10 mx-1" />
                <button className={btn} onClick={() => exec("insertUnorderedList")} title="Bullets">
                  <List className="w-4 h-4" />
                </button>
                <button className={btn} onClick={() => exec("insertOrderedList")} title="Numbered">
                  <ListOrdered className="w-4 h-4" />
                </button>
                <button className={btn} onClick={() => setBlock("blockquote")} title="Quote">
                  <Quote className="w-4 h-4" />
                </button>
                <button className={btn} onClick={() => setBlock("pre")} title="Code block">
                  <Code className="w-4 h-4" />
                </button>
                <span className="w-px h-5 bg-white/10 mx-1" />
                <button className={btn} onClick={insertLink} title="Link">
                  <Link2 className="w-4 h-4" />
                </button>
                <button
                  className={btn}
                  onClick={() => imageInputRef.current?.click()}
                  title="Insert image"
                >
                  <ImageIcon className="w-4 h-4" />
                </button>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onImagePicked}
                />
                <span className="w-px h-5 bg-white/10 mx-1" />
                <button className={btn} onClick={() => exec("undo")} title="Undo">
                  <Undo className="w-4 h-4" />
                </button>
                <button className={btn} onClick={() => exec("redo")} title="Redo">
                  <Redo className="w-4 h-4" />
                </button>
              </div>
              <div className="relative">
                <div
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={(e) => setBodyHtml((e.target as HTMLDivElement).innerHTML)}
                  onClick={onEditorClick}
                  className="prose-editor min-h-[420px] bg-[#141418] border border-white/10 border-t-0 rounded-b-lg px-5 py-4 text-slate-200 leading-relaxed focus:outline-none"
                  style={{ minHeight: 420 }}
                />
                {imgMenu && (
                  <div
                    className="absolute z-20 bg-[#1a1a20] border border-white/15 rounded-xl shadow-2xl p-2 flex items-center gap-1"
                    style={{ top: imgMenu.top, left: imgMenu.left }}
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    <button
                      onClick={() => applyImgWidth(25)}
                      className={`px-2 py-1 rounded-[10px] text-xs font-semibold ${imgMenu.width <= 30 ? "bg-emerald-500 text-black" : "bg-white/5 text-slate-200 hover:bg-white/10"}`}
                    >
                      Small
                    </button>
                    <button
                      onClick={() => applyImgWidth(50)}
                      className={`px-2 py-1 rounded-[10px] text-xs font-semibold ${imgMenu.width > 30 && imgMenu.width <= 70 ? "bg-emerald-500 text-black" : "bg-white/5 text-slate-200 hover:bg-white/10"}`}
                    >
                      Medium
                    </button>
                    <button
                      onClick={() => applyImgWidth(100)}
                      className={`px-2 py-1 rounded-[10px] text-xs font-semibold ${imgMenu.width > 70 ? "bg-emerald-500 text-black" : "bg-white/5 text-slate-200 hover:bg-white/10"}`}
                    >
                      Full
                    </button>
                    <span className="w-px h-5 bg-white/10 mx-1" />
                    <input
                      type="range"
                      min={10}
                      max={100}
                      step={5}
                      value={imgMenu.width}
                      onChange={(e) => applyImgWidth(Number(e.target.value))}
                      className="w-28 accent-emerald-500"
                      title="Custom width"
                    />
                    <span className="text-[10px] tabular-nums text-slate-400 w-8 text-right">
                      {imgMenu.width}%
                    </span>
                    <span className="w-px h-5 bg-white/10 mx-1" />
                    <button
                      onClick={removeActiveImg}
                      className="px-2 py-1 rounded-[10px] text-xs font-semibold bg-red-500/20 hover:bg-red-500/30 text-red-200"
                      title="Remove image"
                    >
                      Remove
                    </button>
                    <button
                      onClick={() => setImgMenu(null)}
                      className="p-1 rounded-[10px] hover:bg-white/10 text-slate-400"
                      title="Close"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              <textarea
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                rows={2}
                placeholder="Excerpt (optional — auto-derived if empty)"
                className="w-full bg-black/30 border border-white/10 rounded-[10px] px-3 py-2 text-sm text-slate-200"
              />
            </>
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-4">
          <section className="bg-[#141418] border border-white/10 rounded-xl p-4">
            <h3 className="text-white text-sm font-bold mb-2">Cover image</h3>
            {coverUrl ? (
              <div className="relative">
                <ResponsiveImage
                  sizes="(min-width: 768px) 640px, 100vw"
                  src={coverUrl}
                  alt=""
                  className="w-full aspect-video rounded-[10px] object-cover"
                />
                <button
                  onClick={() => {
                    setCoverPath(null);
                    setCoverUrl(null);
                  }}
                  className="absolute top-2 right-2 p-1 rounded-[10px] bg-black/70 text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => coverInputRef.current?.click()}
                className="w-full aspect-video rounded-[10px] border border-dashed border-white/20 flex flex-col items-center justify-center text-slate-500 hover:text-white hover:border-white/40 text-xs"
              >
                {uploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <ImageIcon className="w-5 h-5 mb-1" />
                    Upload cover
                  </>
                )}
              </button>
            )}
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onCoverPicked}
            />
          </section>

          <section className="bg-[#141418] border border-white/10 rounded-xl p-4">
            <h3 className="text-white text-sm font-bold mb-2">Status</h3>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {(["draft", "published", "scheduled"] as Status[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`py-2 rounded-[10px] border capitalize ${status === s ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-200" : "border-white/10 text-slate-400 hover:text-white"}`}
                >
                  {s}
                </button>
              ))}
            </div>
            {status === "scheduled" && (
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="mt-2 w-full bg-black/30 border border-white/10 rounded-[10px] px-2 py-1.5 text-sm text-white"
              />
            )}
          </section>

          <section className="bg-[#141418] border border-white/10 rounded-xl p-4">
            <h3 className="text-white text-sm font-bold mb-2">Category</h3>
            <select
              value={categoryId ?? ""}
              onChange={(e) => setCategoryId(e.target.value || null)}
              className="w-full bg-black/30 border border-white/10 rounded-[10px] px-2 py-1.5 text-sm text-white"
            >
              <option value="">— none —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <div className="mt-2 flex gap-1">
              <input
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
                placeholder="Add new category"
                className="flex-1 bg-black/30 border border-white/10 rounded-[10px] px-2 py-1.5 text-xs text-white"
              />
              <button
                onClick={addCategory}
                className="px-2 py-1.5 rounded-[10px] bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </section>

          <section className="bg-[#141418] border border-white/10 rounded-xl p-4">
            <h3 className="text-white text-sm font-bold mb-2">Tags</h3>
            <div className="flex flex-wrap gap-1 mb-2">
              {tags.map((t) => {
                const on = tagIds.includes(t.id);
                return (
                  <button
                    key={t.id}
                    onClick={() =>
                      setTagIds((prev) => (on ? prev.filter((x) => x !== t.id) : [...prev, t.id]))
                    }
                    className={`text-[10px] px-2 py-1 rounded-full border ${on ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-200" : "border-white/10 text-slate-400 hover:text-white"}`}
                  >
                    {t.name}
                  </button>
                );
              })}
              {tags.length === 0 && <span className="text-xs text-slate-500">No tags yet.</span>}
            </div>
            <div className="flex gap-1">
              <input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Add new tag"
                className="flex-1 bg-black/30 border border-white/10 rounded-[10px] px-2 py-1.5 text-xs text-white"
              />
              <button
                onClick={addTag}
                className="px-2 py-1.5 rounded-[10px] bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
