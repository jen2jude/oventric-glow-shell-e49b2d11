import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ImagePlus, Link2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { publishCreatorPost } from "@/lib/creators.functions";
import { isCommunityLink, parseVideoEmbed } from "@/lib/video-embed";
import { Button } from "@/components/ui/button";

interface Attachment {
  file: File;
  url: string;
  kind: "image" | "video";
}

/** Creator showcase publisher: title, caption, media, community + long-form links. */
export function CreatorPublishModal({
  open,
  onClose,
  onPublished,
}: {
  open: boolean;
  onClose: () => void;
  onPublished: () => void;
}) {
  const publish = useServerFn(publishCreatorPost);
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [community, setCommunity] = useState("");
  const [external, setExternal] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) return;
    setTitle("");
    setCaption("");
    setAttachments([]);
    setCommunity("");
    setExternal("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const pick = (files: FileList | null) => {
    if (!files) return;
    const next: Attachment[] = [];
    for (const file of Array.from(files).slice(0, 10)) {
      const kind = file.type.startsWith("video/") ? "video" : "image";
      next.push({ file, url: URL.createObjectURL(file), kind });
    }
    // A video showcase is a single clip; images can be a set.
    setAttachments(next[0]?.kind === "video" ? next.slice(0, 1) : next);
  };

  const submit = async () => {
    if (title.trim().length < 2) {
      toast.error("Add a title");
      return;
    }
    if (community.trim() && !isCommunityLink(community)) {
      toast.error("Community link must be a Telegram or WhatsApp link");
      return;
    }
    if (external.trim() && !parseVideoEmbed(external)) {
      toast.error("That video link doesn't look right");
      return;
    }
    setBusy(true);
    try {
      let mediaPaths: string[] | undefined;
      let mediaType: "image" | "video" | undefined;
      if (attachments.length > 0) {
        const { data: userRes } = await supabase.auth.getUser();
        const uid = userRes.user?.id;
        if (!uid) throw new Error("Not signed in");
        const uploaded: string[] = [];
        for (const a of attachments) {
          const ext = (a.file.name.split(".").pop() || "bin").toLowerCase().slice(0, 8);
          const path = `${uid}/creator-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
          const { error } = await supabase.storage.from("post-media").upload(path, a.file, {
            contentType: a.file.type,
            cacheControl: "31536000",
            upsert: false,
          });
          if (error) throw error;
          uploaded.push(path);
          if (a.kind === "video") {
            try {
              const { generateVideoPoster, posterPathFor } = await import("@/lib/media/videoPoster");
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
        mediaPaths = uploaded;
        mediaType = attachments[0].kind;
      }

      await publish({
        data: {
          title: title.trim(),
          caption: caption.trim() || undefined,
          mediaPaths,
          mediaType,
          communityLink: community.trim() || undefined,
          externalUrl: external.trim() || undefined,
        },
      });
      toast.success("Published to Creators");
      onPublished();
      onClose();
    } catch (e) {
      console.error(e);
      toast.error("Couldn't publish. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/50 backdrop-blur-[2px] sm:items-center sm:p-6">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <p className="text-sm font-black text-slate-900">Showcase your work</p>
          <button type="button" onClick={onClose} aria-label="Close" className="text-slate-500">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="w-full rounded-[10px] border border-slate-200 px-3 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400"
          />
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Caption — tell people about this piece"
            rows={3}
            className="w-full resize-none rounded-[10px] border border-slate-200 px-3 py-3 text-sm text-slate-900 outline-none focus:border-emerald-400"
          />

          <div className="rounded-[10px] border border-dashed border-slate-300 p-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*"
              multiple
              hidden
              onChange={(e) => pick(e.target.files)}
            />
            {attachments.length === 0 ? (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex w-full flex-col items-center gap-1.5 py-5 text-slate-500"
              >
                <ImagePlus className="h-6 w-6 text-emerald-600" />
                <span className="text-xs font-bold">Add images or a video</span>
              </button>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {attachments.map((a, i) => (
                  <div key={i} className="relative h-20 overflow-hidden rounded-[10px] bg-slate-100">
                    {a.kind === "video" ? (
                      <video src={a.url} className="h-full w-full object-cover" muted playsInline />
                    ) : (
                      <img src={a.url} alt="" className="h-full w-full object-cover" />
                    )}
                    <button
                      type="button"
                      aria-label="Remove"
                      onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                      className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-white"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="grid h-20 place-items-center rounded-[10px] border border-slate-200 text-slate-400"
                >
                  <ImagePlus className="h-5 w-5" />
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 rounded-[10px] border border-slate-200 px-3 py-2.5">
            <Link2 className="h-4 w-4 shrink-0 text-sky-600" />
            <input
              value={community}
              onChange={(e) => setCommunity(e.target.value)}
              placeholder="Telegram / WhatsApp channel link (optional)"
              className="w-full text-sm outline-none"
            />
          </div>
          <div className="flex items-center gap-2 rounded-[10px] border border-slate-200 px-3 py-2.5">
            <Link2 className="h-4 w-4 shrink-0 text-violet-600" />
            <input
              value={external}
              onChange={(e) => setExternal(e.target.value)}
              placeholder="Longer video link — YouTube, Vimeo, Facebook, Telegram (optional)"
              className="w-full text-sm outline-none"
            />
          </div>
        </div>

        <div className="border-t border-slate-100 p-4">
          <Button
            disabled={busy}
            onClick={submit}
            className="h-12 w-full rounded-[10px] bg-emerald-600 text-base font-black text-white hover:bg-emerald-700"
          >
            {busy ? "Publishing…" : "Publish"}
          </Button>
        </div>
      </div>
    </div>
  );
}
