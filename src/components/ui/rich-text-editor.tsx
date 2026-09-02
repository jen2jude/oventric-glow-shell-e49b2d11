import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bold, Italic, List, Link2, Image as ImageIcon, Heading2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getCourseMediaUploadUrl, getCourseMediaSignedUrl } from "@/lib/academy.functions";
import { supabase } from "@/integrations/supabase/client";

type UploadFn = (args: {
  data: { filename: string; kind?: "image" | "video" };
}) => Promise<{ path: string; token: string; signedUrl: string }>;
type SignFn = (args: { data: { path: string } }) => Promise<{ url: string | null }>;

/**
 * Lightweight contentEditable rich text editor with image upload.
 * Value is HTML.
 * By default uploads to the private `course-media` bucket. Pass
 * `uploadFn` / `signFn` + `bucket` to use a different bucket (e.g. comms).
 */
export function RichTextEditor({
  value,
  onChange,
  placeholder = "Write the lesson notes… you can insert images and screenshots.",
  minHeight = 180,
  uploadFn,
  signFn,
  bucket = "course-media",
  appearance = "dark",
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  uploadFn?: UploadFn;
  signFn?: SignFn;
  bucket?: string;
  appearance?: "light" | "dark";
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const savedRange = useRef<Range | null>(null);
  const [uploading, setUploading] = useState(false);
  const defaultUpload = useServerFn(getCourseMediaUploadUrl);
  const defaultSign = useServerFn(getCourseMediaSignedUrl);
  const getUpload = (uploadFn ?? defaultUpload) as UploadFn;
  const getSigned = (signFn ?? defaultSign) as SignFn;

  const saveSelection = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (ref.current && ref.current.contains(range.commonAncestorContainer)) {
      savedRange.current = range.cloneRange();
    }
  };

  const restoreSelection = (): Range => {
    const el = ref.current!;
    el.focus();
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    if (savedRange.current && el.contains(savedRange.current.commonAncestorContainer)) {
      sel.addRange(savedRange.current);
      return savedRange.current;
    }
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    sel.addRange(range);
    return range;
  };

  // Sync external value only when it diverges from the current DOM (avoids
  // caret jumping while typing).
  useEffect(() => {
    if (!ref.current) return;
    if (ref.current.innerHTML !== (value ?? "")) {
      ref.current.innerHTML = value ?? "";
    }
  }, [value]);

  const exec = (cmd: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false, arg);
    onChange(ref.current?.innerHTML ?? "");
  };

  const insertLink = () => {
    const url = prompt("Link URL (https://…)");
    if (!url) return;
    exec("createLink", url);
  };

  const insertImageFile = async (file: File) => {
    if (!file.type.startsWith("image/")) return toast.error("Pick an image file");
    if (file.size > 5 * 1024 * 1024) return toast.error("Image must be under 5MB");
    setUploading(true);
    try {
      const { path, token } = await getUpload({ data: { filename: file.name, kind: "image" } });
      const up = await supabase.storage
        .from(bucket)
        .uploadToSignedUrl(path, token, file, { contentType: file.type });
      if (up.error) throw up.error;
      const { url } = await getSigned({ data: { path } });
      if (!url) throw new Error("Could not sign image URL");

      const range = restoreSelection();
      range.deleteContents();
      const img = document.createElement("img");
      img.src = url;
      img.setAttribute("data-course-media-path", path);
      img.alt = "";
      img.style.maxWidth = "100%";
      img.style.borderRadius = "0.5rem";
      img.style.margin = "0.5rem 0";
      range.insertNode(img);

      // Place caret after the inserted image
      const after = document.createRange();
      after.setStartAfter(img);
      after.collapse(true);
      const sel = window.getSelection()!;
      sel.removeAllRanges();
      sel.addRange(after);
      savedRange.current = after.cloneRange();

      onChange(ref.current?.innerHTML ?? "");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const Btn = ({
    onClick,
    title,
    children,
  }: {
    onClick: () => void;
    title: string;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title}
      className={`rounded p-1.5 ${
        appearance === "light"
          ? "text-slate-600 hover:bg-slate-200 hover:text-slate-950"
          : "text-slate-300 hover:bg-white/10 hover:text-white"
      }`}
    >
      {children}
    </button>
  );

  return (
    <div
      className={`overflow-hidden rounded-[10px] border ${
        appearance === "light"
          ? "border-slate-200 bg-white shadow-sm"
          : "border-white/10 bg-[#121214]"
      }`}
    >
      <div
        className={`flex items-center gap-1 border-b px-2 py-1.5 ${
          appearance === "light"
            ? "border-slate-200 bg-slate-50"
            : "border-white/10 bg-black/30"
        }`}
      >
        <Btn onClick={() => exec("bold")} title="Bold">
          <Bold className="w-3.5 h-3.5" />
        </Btn>
        <Btn onClick={() => exec("italic")} title="Italic">
          <Italic className="w-3.5 h-3.5" />
        </Btn>
        <Btn onClick={() => exec("formatBlock", "H2")} title="Heading">
          <Heading2 className="w-3.5 h-3.5" />
        </Btn>
        <Btn onClick={() => exec("insertUnorderedList")} title="Bulleted list">
          <List className="w-3.5 h-3.5" />
        </Btn>
        <Btn onClick={insertLink} title="Insert link">
          <Link2 className="w-3.5 h-3.5" />
        </Btn>
        <label
          className={`cursor-pointer rounded p-1.5 ${
            appearance === "light"
              ? "text-slate-600 hover:bg-slate-200 hover:text-slate-950"
              : "text-slate-300 hover:bg-white/10 hover:text-white"
          }`}
          title="Insert image"
          onMouseDown={(e) => {
            e.preventDefault();
            saveSelection();
          }}
        >
          {uploading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <ImageIcon className="w-3.5 h-3.5" />
          )}
          <input
            type="file"
            accept="image/*"
            hidden
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) insertImageFile(f);
            }}
          />
        </label>
        <span className="ml-auto text-[10px] text-muted-foreground">Rich text · images supported</span>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={(e) => onChange((e.target as HTMLDivElement).innerHTML)}
        onBlur={(e) => {
          saveSelection();
          onChange((e.target as HTMLDivElement).innerHTML);
        }}
        onKeyUp={saveSelection}
        onMouseUp={saveSelection}
        onTouchEnd={saveSelection}
        data-placeholder={placeholder}
        className={`rte-body whitespace-pre-wrap break-words px-3 py-2 text-sm outline-hidden ${
          appearance === "light"
            ? "text-slate-950 focus:bg-slate-50"
            : "text-white focus:bg-black/20"
        }`}
        style={{ minHeight }}
      />
      <style>{`
        .rte-body:empty:before{content:attr(data-placeholder);color:var(--muted-foreground);pointer-events:none}
        .rte-body img{max-width:100%;border-radius:0.5rem;margin:0.5rem 0}
        .rte-body h2{font-size:1.05rem;font-weight:700;margin:0.5rem 0}
        .rte-body a{color:#60a5fa;text-decoration:underline}
        .rte-body ul{list-style:disc;padding-left:1.25rem;margin:0.25rem 0}
      `}</style>
    </div>
  );
}
