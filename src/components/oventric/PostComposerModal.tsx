import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import {
  X,
  Image as ImageIcon,
  AtSign,
  Users,
  Globe2,
  UsersRound,
  ChevronDown,
  Check,
  Loader2,
  AlertCircle,
  ShoppingBag,
  Plus,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { AvatarImage } from "@/components/oventric/AvatarImage";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import {
  createPost as createPostFn,
  searchMentionCandidates as searchMentionsFn,
  listMyPostableCircles as listCirclesFn,
} from "@/lib/posts.functions";
import { searchMyProductsForTagging as searchProductsFn } from "@/lib/marketplace.functions";
import { useIsAppShell } from "@/hooks/use-launch-context";
import { Button } from "@/components/ui/button";

type Audience = "public" | "circle" | "followers";
type Mention = {
  userId: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
};
type CircleOpt = { id: string; name: string };
type MobileVirtualKeyboard = EventTarget & {
  boundingRect: DOMRectReadOnly;
  overlaysContent: boolean;
};

const MAX_MEDIA_BYTES = 50 * 1024 * 1024;
const MAX_IMAGES = 10;
const MAX_TEXT = 5000;
const MEDIA_ACCEPT = ".jpg,.jpeg,.png,.mp4";
const POST_TOPICS = [
  ["Designs", "Designs"], ["Development", "Development"], ["Marketing", "Marketing"],
  ["Emailing", "Emailing"], ["Business", "Business"], ["Video editing", "VideoEditing"],
  ["Vibe coding", "VibeCoding"], ["Productivity", "Productivity"], ["Training", "Training"],
] as const;

function TopicChoices({ selected, onToggle }: { selected: string[]; onToggle: (topic: string) => void }) {
  return <div className="mt-5 pb-5">
    <p className="mb-2 text-xs font-medium text-muted-foreground">Topics</p>
    <div className="flex flex-wrap gap-2">
      {POST_TOPICS.map(([label, tag]) => <Button key={tag} type="button" size="sm" variant={selected.includes(tag) ? "default" : "outline"} aria-pressed={selected.includes(tag)} onClick={() => onToggle(tag)} className="h-8 rounded-full px-3 text-xs">{label}</Button>)}
    </div>
  </div>;
}

function MediaGuidance() {
  return <p className="mt-2 text-[11px] leading-4 text-muted-foreground">Media: JPG, JPEG, PNG, MP4 · 50 MB max per file. AVI and M4A aren't supported for posts.</p>;
}

/** Small inline field error row. */
function FieldError({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="mt-1.5 flex items-start gap-1.5 text-xs text-red-400">
      <AlertCircle className="w-3.5 h-3.5 mt-[1px] shrink-0" />
      <span>{children}</span>
    </p>
  );
}

function initialsOf(name: string) {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[p.length - 1]?.[0] ?? "")).toUpperCase() || "OV";
}

export interface OptimisticPostDraft {
  tempId: string;
  text: string;
  media: { url: string; kind: "image" | "video" }[];
}

export function PostComposerModal({
  open,
  onClose,
  onPosted,
  onOptimistic,
  onPostFailed,
  wallUserId,
  wallOwnerName,
}: {
  open: boolean;
  onClose: () => void;
  onPosted?: (postId?: string, tempId?: string) => void | Promise<void>;
  /** Fired the instant the user hits Post, before upload/creation runs. */
  onOptimistic?: (draft: OptimisticPostDraft) => void;
  /** Fired when the background submission fails, so the placeholder can show the error. */
  onPostFailed?: (tempId: string, message: string) => void;
  /** When set, the post is written to that member's wall (audience forced to public). */
  wallUserId?: string | null;
  wallOwnerName?: string | null;
}) {
  const isWall = !!wallUserId;
  const isApp = useIsAppShell();
  const createPost = useServerFn(createPostFn);
  const searchMentions = useServerFn(searchMentionsFn);
  const searchProducts = useServerFn(searchProductsFn);
  const listCircles = useServerFn(listCirclesFn);

  const [text, setText] = useState("");
  const [topics, setTopics] = useState<string[]>([]);
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [audience, setAudience] = useState<Audience>("public");
  const [circleId, setCircleId] = useState<string | null>(null);
  const [circles, setCircles] = useState<CircleOpt[]>([]);
  const [audienceOpen, setAudienceOpen] = useState(false);
  // Multiple images OR a single video. Can never mix kinds.
  const [attachments, setAttachments] = useState<
    { file: File; previewUrl: string; kind: "image" | "video" }[]
  >([]);
  const [mentionPickerOpen, setMentionPickerOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionResults, setMentionResults] = useState<Mention[]>([]);
  const [mentionLoading, setMentionLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [productQuery, setProductQuery] = useState("");
  const [productResults, setProductResults] = useState<any[]>([]);
  const [productLoading, setProductLoading] = useState(false);
  const [taggedProducts] = useState<{ productId: string; name: string; mediaIndex: number; x?: number; y?: number }[]>([]);
  const [attachedProducts, setAttachedProducts] = useState<{ id: string; name: string; price: number; coverUrl: string | null }[]>([]);

  const [submitAttempted, setSubmitAttempted] = useState(false);




  // User details for identity hub view
  const [meAvatarUrl, setMeAvatarUrl] = useState<string | null>(null);
  const [meName, setMeName] = useState<string>("Member");
  const [meSlug, setMeSlug] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(shellRef, open);
  const [appViewport, setAppViewport] = useState<{ top: number; height: number; keyboardOpen: boolean } | null>(null);

  // Android app windows can leave the layout viewport unchanged while the
  // keyboard overlays it. Combine VisualViewport with the VirtualKeyboard
  // bounds so the composer always ends at the real top edge of the keyboard.
  useEffect(() => {
    if (!open || !isApp) return;
    const viewport = window.visualViewport;
    const virtualKeyboard = (navigator as Navigator & { virtualKeyboard?: MobileVirtualKeyboard }).virtualKeyboard;
    if (virtualKeyboard) {
      try {
        virtualKeyboard.overlaysContent = true;
      } catch {
        // Some embedded browsers expose the API without allowing this setting.
      }
    }

    const sync = () => {
      const top = viewport?.offsetTop ?? 0;
      const visualBottom = top + (viewport?.height ?? window.innerHeight);
      const keyboardRect = virtualKeyboard?.boundingRect;
      const keyboardTop = keyboardRect && keyboardRect.height > 0
        ? keyboardRect.top
        : Number.POSITIVE_INFINITY;
      const visibleBottom = Math.min(visualBottom, keyboardTop);
      const height = Math.max(1, visibleBottom - top);
      const layoutHeight = Math.max(document.documentElement.clientHeight, window.innerHeight);
      const keyboardOpen = (keyboardRect?.height ?? 0) > 80 || layoutHeight - visibleBottom > 80;
      setAppViewport({ top, height, keyboardOpen });
    };

    sync();
    viewport?.addEventListener("resize", sync);
    viewport?.addEventListener("scroll", sync);
    virtualKeyboard?.addEventListener("geometrychange", sync);
    window.addEventListener("resize", sync);
    return () => {
      viewport?.removeEventListener("resize", sync);
      viewport?.removeEventListener("scroll", sync);
      virtualKeyboard?.removeEventListener("geometrychange", sync);
      window.removeEventListener("resize", sync);
      setAppViewport(null);
    };
  }, [open, isApp]);

  // Fetch current user details
  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid) return;
      try {
        const { data: prof } = await supabase
          .from("profiles")
          .select("display_name, username, avatar_path, slug")
          .eq("user_id", uid)
          .maybeSingle();
        if (prof?.slug) setMeSlug(prof.slug);
        const name = (prof?.display_name || prof?.username || "Member").trim();
        setMeName(name);
        if (prof?.avatar_path) {
          const { data: signed } = await supabase.storage
            .from("avatars")
            .createSignedUrl(prof.avatar_path, 60 * 60 * 24 * 7);
          if (signed?.signedUrl) setMeAvatarUrl(signed.signedUrl);
        }
      } catch {
        /* ignore */
      }
    })();
  }, [open]);

  // Reset when opening
  useEffect(() => {
    if (!open) return;
    setError(null);
    setMediaError(null);
    setSubmitAttempted(false);
    setTimeout(() => textareaRef.current?.focus(), 60);
    // load circles lazily
    listCircles()
      .then((r) => setCircles(r.circles))
      .catch(() => setCircles([]));
  }, [open, listCircles]);

  // Prevent background scroll — freeze both scroll layers so swipes inside
  // the sheet can never leak through to the page behind.
  useEffect(() => {
    if (!open) return;
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
    };
  }, [open]);

  // Auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 480) + "px";
  }, [text, open]);

  // Debounced mention search
  useEffect(() => {
    if (!mentionPickerOpen) return;
    const q = mentionQuery.trim();
    if (!q) {
      setMentionResults([]);
      return;
    }
    let cancel = false;
    setMentionLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await searchMentions({ data: { q } });
        if (!cancel) setMentionResults(r.users);
      } catch {
        if (!cancel) setMentionResults([]);
      } finally {
        if (!cancel) setMentionLoading(false);
      }
    }, 220);
    return () => {
      cancel = true;
      clearTimeout(t);
    };
  }, [mentionQuery, mentionPickerOpen, searchMentions]);

  // Debounced product search
  useEffect(() => {
    if (!productPickerOpen) return;
    const q = productQuery.trim();
    let cancel = false;
    setProductLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await searchProducts({ data: { q } });
        if (!cancel) setProductResults(r.products);
      } catch {
        if (!cancel) setProductResults([]);
      } finally {
        if (!cancel) setProductLoading(false);
      }
    }, 220);
    return () => {
      cancel = true;
      clearTimeout(t);
    };
  }, [productQuery, productPickerOpen, searchProducts]);

  const clearAttachments = useCallback(() => {
    attachments.forEach((a) => URL.revokeObjectURL(a.previewUrl));
    setAttachments([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [attachments]);

  const removeAttachmentAt = (idx: number) => {
    setAttachments((prev) => {
      const target = prev[idx];
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const onPickFile = () => fileInputRef.current?.click();
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const hasVideoAlready = attachments.some((a) => a.kind === "video");
    const nextAttachments = [...attachments];
    let err: string | null = null;
    for (const file of files) {
      const extension = file.name.split(".").pop()?.toLowerCase();
      const isImage = extension === "jpg" || extension === "jpeg" || extension === "png";
      const isVideo = extension === "mp4";
      if (!isImage && !isVideo) {
        err = "Choose a JPG, JPEG, PNG or MP4 file.";
        continue;
      }
      if (file.size > MAX_MEDIA_BYTES) {
        err = "One or more files exceed 50 MB.";
        continue;
      }
      if (isVideo) {
        if (nextAttachments.length > 0) {
          err = "Post a video by itself.";
          continue;
        }
        nextAttachments.push({ file, previewUrl: URL.createObjectURL(file), kind: "video" });
        break;
      }
      // image
      if (hasVideoAlready || nextAttachments.some((a) => a.kind === "video")) {
        err = "Post a video by itself.";
        continue;
      }
      if (nextAttachments.length >= MAX_IMAGES) {
        err = `Up to ${MAX_IMAGES} images per post.`;
        break;
      }
      nextAttachments.push({ file, previewUrl: URL.createObjectURL(file), kind: "image" });
    }
    setAttachments(nextAttachments);
    setMediaError(err);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const addMention = (m: Mention) => {
    if (!mentions.find((x) => x.userId === m.userId)) {
      setMentions((prev) => [...prev, m]);
      // Insert @name into the text as a hint
      const handle = m.username || m.name.replace(/\s+/g, "");
      setText((prev) => (prev ? `${prev.trimEnd()} @${handle} ` : `@${handle} `));
    }
    setMentionQuery("");
    setMentionPickerOpen(false);
    setTimeout(() => textareaRef.current?.focus(), 30);
  };

  const removeMention = (id: string) => setMentions((prev) => prev.filter((m) => m.userId !== id));

  const addProductTag = (p: any) => {
    // Product attachments can be multi-selected; media remains a separate static attachment rail.
    if (!attachedProducts.find(x => x.id === p.id)) {
      setAttachedProducts(prev => [...prev, { id: p.id, name: p.name, price: p.priceUsd, coverUrl: p.coverUrl }]);
    }
    setProductQuery("");
  };

  const removeProductAttachment = (id: string) => {
    setAttachedProducts(prev => prev.filter(p => p.id !== id));
  };


  const audienceLabel = useMemo(() => {
    if (audience === "public") return "Public";
    if (audience === "followers") return "Followers";
    const c = circles.find((x) => x.id === circleId);
    return c ? `Circle · ${c.name}` : "Circle";
  }, [audience, circleId, circles]);

  const hasMedia = attachments.length > 0;
  const trimmed = [text.trim(), ...topics.map((topic) => `#${topic}`)].filter(Boolean).join(" ");
  const toggleTopic = (topic: string) => setTopics((current) => current.includes(topic) ? current.filter((item) => item !== topic) : [...current, topic]);

  const textError = useMemo(() => {
    if (trimmed.length > MAX_TEXT)
      return `Post is ${trimmed.length - MAX_TEXT} character${trimmed.length - MAX_TEXT === 1 ? "" : "s"} over the ${MAX_TEXT.toLocaleString()} limit.`;

    return null;
  }, [trimmed]);
  const audienceError =
    !isWall && audience === "circle" && !circleId ? "Pick a circle to post into." : null;
  const hasBlockingError = !!(textError || audienceError || (trimmed.length === 0 && !hasMedia && attachedProducts.length === 0));
  const showTextError = submitAttempted && !!textError;
  const showAudienceError = submitAttempted && !!audienceError;


  const doPost = () => {
    if (posting) return;
    setSubmitAttempted(true);
    if (hasBlockingError) {
      setError(null);
      if (textError) textareaRef.current?.focus();
      return;
    }
    setPosting(true);
    setError(null);
    setMediaError(null);

    // --- Optimistic hand-off -------------------------------------------
    // Snapshot everything the feed needs to paint the post immediately, then
    // close the composer and finish uploading/creating in the background.
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const snapshot = {
       text: trimmed,
      attachments: attachments.slice(),
      audience: isWall ? ("public" as Audience) : audience,
      circleId: isWall ? null : audience === "circle" ? circleId : null,
      mentionedUserIds: mentions.map((m) => m.userId),
      productTags: (taggedProducts || []).map(t => ({ productId: t.productId, mediaIndex: t.mediaIndex, x: t.x, y: t.y })),
      productAttachmentIds: attachedProducts.map(p => p.id),
    };

    onOptimistic?.({
      tempId,
      text: snapshot.text,
      // Ownership of these object URLs passes to the feed; it revokes them.
      media: snapshot.attachments.map((a) => ({ url: a.previewUrl, kind: a.kind })),
    });

    // Reset composer state without revoking the previews the feed now owns.
    setText("");
    setTopics([]);
    setMentions([]);
    setAudience("public");
    setCircleId(null);
    setAttachments([]);
    setAttachedProducts([]);

    if (fileInputRef.current) fileInputRef.current.value = "";
    setPosting(false);
    onClose();

    void (async () => {
      const w = window as unknown as { __ovPublishing?: number };
      w.__ovPublishing = (w.__ovPublishing ?? 0) + 1;
      window.dispatchEvent(new CustomEvent("oventric:publishing", { detail: w.__ovPublishing }));
      try {
        let mediaPath: string | undefined;
        let mediaType: "image" | "video" | undefined;
        let mediaPaths: string[] | undefined;
        if (snapshot.attachments.length > 0) {
          const { data: userRes } = await supabase.auth.getUser();
          const uid = userRes.user?.id;
          if (!uid) throw new Error("Not signed in");
          const uploaded: string[] = [];
          for (const a of snapshot.attachments) {
            const ext = (a.file.name.split(".").pop() || "bin").toLowerCase().slice(0, 8);
            const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
            const { error: upErr } = await supabase.storage
              .from("post-media")
              .upload(path, a.file, {
                contentType: a.file.type,
                cacheControl: "31536000",
                upsert: false,
              });
            if (upErr) throw upErr;
            uploaded.push(path);
            // For videos, also capture and upload a poster JPEG so <video>
            // can paint instantly without downloading the clip.
            if (a.kind === "video") {
              try {
                const { generateVideoPoster, posterPathFor } =
                  await import("@/lib/media/videoPoster");
                const poster = await generateVideoPoster(a.file);
                if (poster) {
                  await supabase.storage.from("post-media").upload(posterPathFor(path), poster, {
                    contentType: "image/jpeg",
                    cacheControl: "31536000",
                    upsert: true,
                  });
                }
              } catch {
                /* poster is best-effort */
              }
            }
          }
          const isVideo = snapshot.attachments[0].kind === "video";
          if (isVideo) {
            mediaPath = uploaded[0];
            mediaType = "video";
          } else {
            mediaPaths = uploaded;
            mediaType = "image";
          }
        }
        const created = await createPost({
          data: {
            text: snapshot.text,
            mediaPath,
            mediaType,
            mediaPaths,
            audience: snapshot.audience,
            circleId: snapshot.circleId,
            mentionedUserIds: snapshot.mentionedUserIds,
            productTags: snapshot.productTags,
            productAttachmentIds: snapshot.productAttachmentIds,
            wallUserId: wallUserId ?? null,

          },
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await onPosted?.((created as any)?.post?.id, tempId);
      } catch (e: any) {
        console.error("[PostComposerModal] post failed", e);
        const msg =
          typeof e?.message === "string" && /storage|upload|payload|size/i.test(e.message)
            ? `Upload failed: ${e.message}`
            : e?.message || "Couldn't publish. Try again.";
        toast.error(msg);
        onPostFailed?.(tempId, msg);
      } finally {
        w.__ovPublishing = Math.max(0, (w.__ovPublishing ?? 1) - 1);
        window.dispatchEvent(new CustomEvent("oventric:publishing", { detail: w.__ovPublishing }));
      }
    })();
  };

  if (!open) return null;

  if (isApp && typeof document !== "undefined") return createPortal((
    <div className="app-post-composer fixed inset-0 z-[60] flex items-end justify-center bg-background/75 backdrop-blur-sm" style={appViewport ? { top: `${appViewport.top}px`, height: `${appViewport.height}px`, bottom: "auto" } : undefined} onClick={onClose}>
      <div ref={shellRef} role="dialog" aria-modal="true" aria-label="Create post" className="slide-up relative flex w-full max-w-2xl flex-col overflow-hidden rounded-t-[24px] border border-b-0 border-border bg-card text-foreground shadow-2xl" style={{ height: appViewport ? Math.min(appViewport.keyboardOpen ? appViewport.height : appViewport.height * 0.94, 850) : "min(94dvh, 850px)" }} onClick={(event) => event.stopPropagation()}>
        <div className="app-profile-handle" aria-hidden="true" />
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close post composer" title="Close"><X /></Button>
          <h2 className="font-semibold text-[15px]">New post</h2>
          <Button onClick={doPost} disabled={posting || hasBlockingError} className="h-9 rounded-full px-5 font-semibold">{posting ? "Posting…" : "Post"}</Button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-5 pt-5">
          <div className="flex shrink-0 items-center gap-3">
            <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-muted"><AvatarImage src={meAvatarUrl} alt={meName} initials={initialsOf(meName)} /></div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{meName}</div>
              {isWall ? <div className="text-xs text-muted-foreground">Posting to {wallOwnerName || "this profile"}</div> : (
                <div className="relative mt-1 w-fit">
                  <Button variant="outline" size="sm" onClick={() => setAudienceOpen((value) => !value)} aria-expanded={audienceOpen} className="h-7 gap-1.5 rounded-full border-border bg-muted/40 px-2.5 text-[11px] text-foreground">
                    {audience === "public" ? <Globe2 /> : <Users />} {audienceLabel} <ChevronDown />
                  </Button>
                  {audienceOpen && <div className="absolute left-0 top-full z-30 mt-2 w-60 max-w-[calc(100vw-3rem)] overflow-auto rounded-[10px] border border-border bg-card p-1 shadow-2xl">
                    {([
                      { key: "public" as const, label: "Public", icon: <Globe2 className="size-4" />, detail: "Everyone on Oventric" },
                      { key: "followers" as const, label: "Followers", icon: <UsersRound className="size-4" />, detail: "People who follow you" },
                    ]).map((item) => <Button key={item.key} variant="ghost" onClick={() => { setAudience(item.key); setCircleId(null); setAudienceOpen(false); }} className="h-auto w-full justify-start gap-3 px-3 py-2 text-left text-foreground">{item.icon}<span className="flex-1"><span className="block text-sm">{item.label}</span><span className="block text-[11px] font-normal text-muted-foreground">{item.detail}</span></span>{audience === item.key && <Check />}</Button>)}
                    {circles.length > 0 && <div className="border-t border-border pt-1">{circles.map((circle) => <Button key={circle.id} variant="ghost" onClick={() => { setAudience("circle"); setCircleId(circle.id); setAudienceOpen(false); }} className="h-auto w-full justify-start gap-3 px-3 py-2 text-left text-foreground"><Users className="size-4" /><span className="min-w-0 flex-1 truncate text-sm">{circle.name}</span>{audience === "circle" && circleId === circle.id && <Check />}</Button>)}</div>}
                  </div>}
                </div>
              )}
            </div>
          </div>
          {showAudienceError && <FieldError>{audienceError}</FieldError>}

          <textarea ref={textareaRef} value={text} onChange={(event) => setText(event.target.value)} aria-label="Write your post" aria-invalid={showTextError} placeholder="What would you like to share?" className="mt-5 min-h-[136px] w-full resize-none bg-transparent text-[17px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground" />
          {showTextError && <FieldError>{textError}</FieldError>}

          <div className="border-t border-border pt-4">
            <div className="mb-3 flex items-center justify-between gap-2 text-xs text-muted-foreground"><span>Add to your post</span><span className={textError ? "text-destructive" : ""}>{trimmed.length.toLocaleString()} / {MAX_TEXT.toLocaleString()}</span></div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={onPickFile} className="min-w-0 flex-1 rounded-[10px] border-border bg-muted/40 text-foreground" title="Add photo or video"><ImageIcon className="text-primary" /><span>Media</span></Button>
              <Button variant="outline" onClick={() => setMentionPickerOpen(true)} className="min-w-0 flex-1 rounded-[10px] border-border bg-muted/40 text-foreground" title="Mention someone"><AtSign className="text-primary" /><span>Mention</span></Button>
              <Button variant="outline" onClick={() => setProductPickerOpen(true)} className="min-w-0 flex-1 rounded-[10px] border-border bg-muted/40 text-foreground" title="Add a product"><ShoppingBag className="text-primary" /><span>Product</span></Button>
            </div>
            <MediaGuidance />
          </div>
          <TopicChoices selected={topics} onToggle={toggleTopic} />

          {attachments.length > 0 && <div className="mb-4 flex shrink-0 gap-2 overflow-x-auto pb-1">
            {attachments.map((attachment, index) => <div key={attachment.previewUrl} className="relative h-32 w-32 shrink-0 overflow-hidden rounded-[10px] bg-muted">
              {attachment.kind === "image" ? <img src={attachment.previewUrl} alt={`Attachment ${index + 1}`} className="h-full w-full object-cover" /> : <video src={attachment.previewUrl} className="h-full w-full object-cover" />}
              <Button size="icon-sm" variant="secondary" onClick={() => removeAttachmentAt(index)} aria-label={`Remove attachment ${index + 1}`} className="absolute right-1.5 top-1.5 h-7 w-7 rounded-full"><X /></Button>
            </div>)}
            {!attachments.some((attachment) => attachment.kind === "video") && attachments.length < MAX_IMAGES && <Button variant="outline" onClick={onPickFile} aria-label="Add more media" className="h-32 w-24 shrink-0 flex-col rounded-[10px] border-dashed text-muted-foreground"><Plus /> Add</Button>}
          </div>}
           <input ref={fileInputRef} type="file" accept={MEDIA_ACCEPT} multiple className="hidden" onChange={onFile} />

          {attachedProducts.length > 0 && <div className="mb-3 space-y-2">{attachedProducts.map((product) => <div key={product.id} className="flex items-center gap-3 rounded-[10px] border border-border bg-muted/40 p-2">
            <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-[8px] bg-muted">{product.coverUrl ? <img src={product.coverUrl} alt="" className="size-full object-cover" /> : <ShoppingBag className="size-5 text-muted-foreground" />}</div>
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{product.name}</span>
            <Button variant="ghost" size="icon-sm" onClick={() => removeProductAttachment(product.id)} aria-label={`Remove ${product.name}`}><X /></Button>
          </div>)}</div>}
          {mentions.length > 0 && <div className="mb-3 flex flex-wrap gap-2">{mentions.map((mention) => <span key={mention.userId} className="flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs text-primary">@{mention.username || mention.name}<Button variant="ghost" size="icon-sm" className="size-5 rounded-full text-primary" onClick={() => removeMention(mention.userId)} aria-label={`Remove mention ${mention.name}`}><X /></Button></span>)}</div>}
          {mediaError && <FieldError>{mediaError}</FieldError>}
          {error && <FieldError>{error}</FieldError>}
        </div>
      </div>

      {(productPickerOpen || mentionPickerOpen) && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/80 px-5 backdrop-blur-sm" style={appViewport ? { top: `${appViewport.top}px`, height: `${appViewport.height}px`, bottom: "auto" } : undefined} onClick={() => { setProductPickerOpen(false); setMentionPickerOpen(false); }}>
        <div role="dialog" aria-modal="true" aria-label={productPickerOpen ? "Choose products" : "Mention people"} className="flex max-h-[65dvh] w-full max-w-sm flex-col overflow-hidden rounded-[10px] border border-border bg-card shadow-2xl" onClick={(event) => event.stopPropagation()}>
          <div className="flex items-center gap-2 border-b border-border p-3">{productPickerOpen ? <ShoppingBag className="size-4 text-primary" /> : <AtSign className="size-4 text-primary" />}
            <input autoFocus value={productPickerOpen ? productQuery : mentionQuery} onChange={(event) => productPickerOpen ? setProductQuery(event.target.value) : setMentionQuery(event.target.value)} placeholder={productPickerOpen ? "Search your products" : "Search people"} className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground" />
            <Button variant="ghost" size="icon-sm" onClick={() => { setProductPickerOpen(false); setMentionPickerOpen(false); }} aria-label="Close search"><X /></Button>
          </div>
          {productPickerOpen && attachedProducts.length > 0 && <div className="flex items-center justify-between border-b border-border px-3 py-2 text-xs text-muted-foreground"><span>{attachedProducts.length} selected</span><Button size="sm" onClick={() => setProductPickerOpen(false)}>Done</Button></div>}
          <div className="min-h-24 overflow-y-auto p-2">
            {(productPickerOpen ? productLoading : mentionLoading) && <div className="flex justify-center py-5"><Loader2 className="size-5 animate-spin text-primary" /></div>}
            {productPickerOpen && !productLoading && productResults.length === 0 && <p className="py-5 text-center text-xs text-muted-foreground">{productQuery ? "No products found" : "Search your products"}</p>}
            {productPickerOpen && productResults.map((product) => <Button key={product.id} variant="ghost" onClick={() => addProductTag(product)} className="h-14 w-full justify-start gap-3 text-left text-foreground"><span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-[8px] bg-muted">{product.coverUrl ? <img src={product.coverUrl} alt="" className="size-full object-cover" /> : <ShoppingBag />}</span><span className="min-w-0 flex-1 truncate">{product.name}</span>{attachedProducts.some((item) => item.id === product.id) && <Check className="text-primary" />}</Button>)}
            {!productPickerOpen && !mentionLoading && mentionResults.length === 0 && <p className="py-5 text-center text-xs text-muted-foreground">{mentionQuery ? "No matches" : "Search by name or username"}</p>}
            {!productPickerOpen && mentionResults.map((person) => <Button key={person.userId} variant="ghost" onClick={() => addMention(person)} className="h-14 w-full justify-start gap-3 text-left text-foreground"><span className="size-9 shrink-0 overflow-hidden rounded-full bg-muted"><AvatarImage src={person.avatarUrl} alt={person.name} initials={initialsOf(person.name)} /></span><span className="min-w-0 flex-1 truncate">{person.name}</span></Button>)}
          </div>
        </div>
      </div>}
    </div>
  ), document.body);

  return (
    <div className="modal-light fixed inset-0 z-[60] flex items-stretch sm:items-center justify-center">
      <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={shellRef}
        role="dialog"
        aria-modal="true"
        aria-label="Create post"
        className="relative w-full sm:max-w-xl sm:my-8 h-[100dvh] sm:h-auto sm:max-h-[92dvh] bg-white sm:rounded-[10px] border border-slate-200 shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 shrink-0">
          <button
            onClick={onClose}
            className="p-2 -ml-2 rounded-[10px] hover:bg-slate-100 text-slate-500"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="text-sm font-semibold text-slate-900">Create on Oventric</div>
          <button
            onClick={doPost}
            disabled={posting}
            className="px-5 py-1.5 rounded-full font-semibold text-sm text-white bg-[#E5484D] hover:bg-[#c93e43] disabled:opacity-40"
          >
            {posting ? "Posting…" : "Post"}
          </button>
        </div>

        {/* Identity row & Audience */}
        <div className="px-4 pt-4 flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 bg-slate-200">
            <AvatarImage src={meAvatarUrl} alt={meName} initials={initialsOf(meName)} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-slate-900">{meName}</div>
            <div className="relative inline-block mt-0.5">
              <button
                type="button"
                onClick={() => setAudienceOpen((v) => !v)}
                className="flex items-center gap-1.5 rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-200"
              >
                {audience === "public" ? <Globe2 className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                <span>{audienceLabel}</span>
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>
              {audienceOpen && (
                <div className="absolute left-0 mt-2 w-56 z-20 bg-white border border-slate-200 rounded-[10px] shadow-xl p-1 max-h-72 overflow-auto">
                  <AudienceOption
                    icon={<Globe2 className="w-4 h-4" />}
                    title="Public"
                    desc="Anyone on Oventric can see"
                    active={audience === "public"}
                    onClick={() => {
                      setAudience("public");
                      setCircleId(null);
                      setAudienceOpen(false);
                    }}
                  />
                  <AudienceOption
                    icon={<UsersRound className="w-4 h-4" />}
                    title="Followers"
                    desc="Only people who follow you"
                    active={audience === "followers"}
                    onClick={() => {
                      setAudience("followers");
                      setCircleId(null);
                      setAudienceOpen(false);
                    }}
                  />
                  {circles.length > 0 && (
                    <div className="pt-1 mt-1 border-t border-slate-100">
                      <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-slate-500">
                        Circle
                      </div>
                      {circles.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setAudience("circle");
                            setCircleId(c.id);
                            setAudienceOpen(false);
                          }}
                          className={`w-full text-left flex items-center justify-between px-2 py-1.5 rounded-[10px] hover:bg-slate-50 text-xs ${
                            audience === "circle" && circleId === c.id ? "bg-slate-50" : ""
                          }`}
                        >
                          <span className="flex items-center gap-2 text-slate-700">
                            <Users className="w-3.5 h-3.5 text-[#E5484D]" />
                            {c.name}
                          </span>
                          {audience === "circle" && circleId === c.id && (
                            <Check className="w-3.5 h-3.5 text-[#E5484D]" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        {showAudienceError && (
          <div className="px-4 pt-1">
            <FieldError>{audienceError}</FieldError>
          </div>
        )}

        {/* Scroll area */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-invalid={showTextError}
            aria-describedby={showTextError ? "composer-text-error" : undefined}
            placeholder="What's on your mind?"
            aria-label="Write your post"
            className={`w-full bg-transparent text-slate-800 placeholder:text-slate-400 resize-none focus:outline-none text-base mt-3 min-h-[136px] rounded-[10px] px-0 ${
              showTextError ? "ring-1 ring-red-500/60" : ""
            }`}
          />
          
          <div className="flex items-start justify-between gap-3">
            <div id="composer-text-error" className="min-w-0">
              {showTextError && <FieldError>{textError}</FieldError>}
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <div className="mb-3 flex items-center justify-between gap-2 text-xs text-muted-foreground"><span>Add to your post</span><span>{trimmed.length.toLocaleString()} / {MAX_TEXT.toLocaleString()}</span></div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={onPickFile} className="min-w-0 flex-1 rounded-[10px]" title="Add photo or video"><ImageIcon className="text-primary" /><span>Media</span></Button>
              <Button variant="outline" onClick={() => setMentionPickerOpen(true)} className="min-w-0 flex-1 rounded-[10px]" title="Mention someone"><AtSign className="text-primary" /><span>Mention</span></Button>
              <Button variant="outline" onClick={() => setProductPickerOpen(true)} className="min-w-0 flex-1 rounded-[10px]" title="Add a product"><ShoppingBag className="text-primary" /><span>Product</span></Button>
            </div>
            <MediaGuidance />
          </div>
          <TopicChoices selected={topics} onToggle={toggleTopic} />

          {/* Media Rail / Horizontal Grid */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {attachments.map((a, i) => (
              <div key={a.previewUrl} className="relative w-24 h-24 shrink-0 rounded-xl overflow-hidden group">
                {a.kind === "image" ? (
                  <img loading="lazy" decoding="async" src={a.previewUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <video src={a.previewUrl} className="w-full h-full object-cover" />
                )}
                <button
                  type="button"
                  onClick={() => removeAttachmentAt(i)}
                  className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            
            {!attachments.some(a => a.kind === 'video') && attachments.length < MAX_IMAGES && (
              <button
                type="button"
                onClick={onPickFile}
                className="w-24 h-24 shrink-0 rounded-[10px] border border-dashed border-slate-300 flex flex-col items-center justify-center gap-1 text-slate-500 hover:text-slate-900 hover:border-slate-400 bg-slate-50"
              >
                <Plus className="w-5 h-5" />
                <span className="text-[10px]">Add media</span>
              </button>
            )}
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
             accept={MEDIA_ACCEPT}
            multiple
            className="hidden"
            onChange={onFile}
          />

          {/* Extra Info (Mentions, Errors) - Moved INSIDE scroll area */}
          <div className="py-2">
            {attachedProducts.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {attachedProducts.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-2 p-2 rounded-[10px] bg-slate-50 border border-slate-200"
                  >
                    <div className="w-10 h-10 rounded-[10px] overflow-hidden bg-slate-200">
                      {p.coverUrl ? (
                        <img loading="lazy" decoding="async" src={p.coverUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <ShoppingBag className="w-4 h-4 m-auto mt-3 text-slate-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate">{p.name}</div>
                      <div className="text-[10px] text-amber-400 font-bold">${p.price}</div>
                    </div>
                    <button
                      onClick={() => removeProductAttachment(p.id)}
                      className="p-1.5 rounded-full hover:bg-slate-200 text-slate-500"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {mentions.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {mentions.map((m) => (
                  <span
                    key={m.userId}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[#E5484D]/10 border border-[#E5484D]/30 text-[11px] text-[#E5484D]"
                  >
                    @{m.username || m.name}
                    <button onClick={() => removeMention(m.userId)} className="hover:text-white">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {mediaError && <FieldError>{mediaError}</FieldError>}
            {error && <FieldError>{error}</FieldError>}
          </div>

        </div>
      </div>

      
      {/* Product picker overlay */}
      {productPickerOpen && (
        <div className="modal-light fixed inset-0 z-[70] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm"
            onClick={() => setProductPickerOpen(false)}
          />
          <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-[10px] shadow-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-3 border-b border-slate-200">
              <ShoppingBag className="w-4 h-4 text-amber-400" />
              <input
                autoFocus
                value={productQuery}
                onChange={(e) => setProductQuery(e.target.value)}
                placeholder="Search your products..."
                className="flex-1 bg-transparent text-sm text-slate-800 placeholder:text-slate-500 focus:outline-none"
              />
              <button
                onClick={() => setProductPickerOpen(false)}
                className="text-slate-500 hover:text-slate-900 p-1"
                aria-label="Close product search"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {attachedProducts.length > 0 && (
              <div className="border-b border-slate-200 px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-[11px] font-semibold text-slate-500">
                    {attachedProducts.length} product{attachedProducts.length === 1 ? "" : "s"} selected
                  </span>
                  <button
                    type="button"
                    onClick={() => setProductPickerOpen(false)}
                    className="shrink-0 rounded-[8px] bg-[#E5484D] px-3 py-1.5 text-[11px] font-bold text-white"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
            <div className="max-h-80 overflow-auto py-1">
              {productLoading && (
                <div className="flex items-center justify-center py-6 text-slate-500 text-xs gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-amber-400" /> Searching...
                </div>
              )}
              {!productLoading && productResults.length === 0 && (
                <div className="text-center text-xs text-slate-500 py-6">
                  {productQuery.trim().length > 0 ? "No products found" : "Type to search your products"}
                </div>
              )}
              {productResults.map((p) => {
                const selected = attachedProducts.some((item) => item.id === p.id);
                return (
                <button
                  key={p.id}
                  onClick={() => addProductTag(p)}
                  className={`w-full flex items-center gap-3 px-3 py-3 text-left ${selected ? "bg-rose-50" : "hover:bg-slate-50"}`}
                >
                  <span className="w-9 h-9 rounded-[10px] overflow-hidden bg-slate-100 flex items-center justify-center">
                    {p.coverUrl ? (
                      <img loading="lazy" decoding="async" src={p.coverUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <ShoppingBag className="w-4 h-4 text-slate-500" />
                    )}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-slate-900 truncate">{p.name}</span>
                    <span className="block text-[11px] text-slate-500 truncate">
                      {p.vendor} · ${p.priceUsd}
                    </span>
                  </span>
                  {selected && <Check className="h-4 w-4 shrink-0 text-[#E5484D]" />}
                </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {/* Mention picker overlay */}
      {mentionPickerOpen && (
        <div className="modal-light fixed inset-0 z-[70] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm"
            onClick={() => setMentionPickerOpen(false)}
          />
          <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-[10px] shadow-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-3 border-b border-slate-200">
              <AtSign className="w-4 h-4 text-[#E5484D]" />
              <input
                autoFocus
                value={mentionQuery}
                onChange={(e) => setMentionQuery(e.target.value)}
                placeholder="Mention someone…"
                className="flex-1 bg-transparent text-sm text-slate-800 placeholder:text-slate-500 focus:outline-none"
              />
              <button
                onClick={() => setMentionPickerOpen(false)}
                className="text-slate-500 hover:text-slate-900 p-1"
                aria-label="Close mention search"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-80 overflow-auto py-1">
              {mentionLoading && (
                <div className="flex items-center justify-center py-6 text-slate-500 text-xs gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[#E5484D]" /> Searching…
                </div>
              )}
              {!mentionLoading && mentionResults.length === 0 && mentionQuery.trim().length > 0 && (
                <div className="text-center text-xs text-slate-500 py-6">No matches</div>
              )}
              {!mentionLoading && mentionQuery.trim().length === 0 && (
                <div className="text-center text-xs text-slate-500 py-6">
                  Type a name or @username
                </div>
              )}
              {mentionResults.map((u) => (
                <button
                  key={u.userId}
                  onClick={() => addMention(u)}
                  className="w-full flex items-center gap-3 px-3 py-3 hover:bg-slate-50 text-left"
                >
                  <span className="w-9 h-9 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-700">
                    <AvatarImage
                      src={u.avatarUrl}
                      alt={u.name}
                      initials={initialsOf(u.name)}
                      className="w-full h-full flex items-center justify-center"
                    />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-slate-900 truncate">{u.name}</span>
                    {u.username && (
                      <span className="block text-[11px] text-slate-500 truncate">
                        @{u.username}
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AudienceOption({
  icon,
  title,
  desc,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left flex items-start gap-2 px-3 py-3 rounded-[10px] hover:bg-slate-50 ${
        active ? "bg-slate-50" : ""
      }`}
    >
      <span className="mt-0.5 text-[#E5484D]">{icon}</span>
      <span className="flex-1">
        <span className="block text-sm text-slate-900">{title}</span>
        <span className="block text-[11px] text-slate-500">{desc}</span>
      </span>
      {active && <Check className="w-4 h-4 text-[#E5484D] mt-1" />}
    </button>
  );
}
