import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Camera,
  Github,
  Globe,
  ImagePlus,
  Instagram,
  Facebook,
  Linkedin,
  Loader2,
  MessageCircle,
  Music2,
  Send,
  Plus,
  Twitter,
  X,
  Youtube,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { updateMyProfile, type SocialLinks } from "@/lib/profiles.functions";
import { AvatarCropper } from "@/components/oventric/profile/AvatarCropper";
import { useIsAppShell } from "@/hooks/use-launch-context";

const MAX_BIO = 280;
const MAX_NAME = 80;
const MAX_SKILLS = 12;
const MAX_SKILL_LEN = 32;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

type LinkKey = keyof SocialLinks;

const LINK_FIELDS: Array<{
  key: LinkKey;
  label: string;
  placeholder: string;
  host?: RegExp;
  icon: React.ReactNode;
}> = [
  {
    key: "website",
    label: "Website",
    placeholder: "https://yoursite.com",
    icon: <Globe className="w-4 h-4" />,
  },
  {
    key: "x",
    label: "X (Twitter)",
    placeholder: "https://x.com/username",
    host: /(^|\.)(x\.com|twitter\.com)$/i,
    icon: <Twitter className="w-4 h-4" />,
  },
  {
    key: "instagram",
    label: "Instagram",
    placeholder: "https://instagram.com/username",
    host: /(^|\.)instagram\.com$/i,
    icon: <Instagram className="w-4 h-4" />,
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    placeholder: "https://linkedin.com/in/username",
    host: /(^|\.)linkedin\.com$/i,
    icon: <Linkedin className="w-4 h-4" />,
  },
  {
    key: "github",
    label: "GitHub",
    placeholder: "https://github.com/username",
    host: /(^|\.)github\.com$/i,
    icon: <Github className="w-4 h-4" />,
  },
  {
    key: "youtube",
    label: "YouTube",
    placeholder: "https://youtube.com/@channel",
    host: /(^|\.)(youtube\.com|youtu\.be)$/i,
    icon: <Youtube className="w-4 h-4" />,
  },
  {
    key: "tiktok",
    label: "TikTok",
    placeholder: "https://tiktok.com/@username",
    host: /(^|\.)tiktok\.com$/i,
    icon: <Music2 className="w-4 h-4" />,
  },
  {
    key: "facebook",
    label: "Facebook",
    placeholder: "https://facebook.com/username",
    host: /(^|\.)(facebook\.com|fb\.com|fb\.me)$/i,
    icon: <Facebook className="w-4 h-4" />,
  },
  {
    key: "whatsapp",
    label: "WhatsApp",
    placeholder: "https://wa.me/2348012345678",
    host: /(^|\.)(wa\.me|whatsapp\.com)$/i,
    icon: <MessageCircle className="w-4 h-4" />,
  },
  {
    key: "telegram",
    label: "Telegram",
    placeholder: "https://t.me/username",
    host: /(^|\.)(t\.me|telegram\.me)$/i,
    icon: <Send className="w-4 h-4" />,
  },
];

export interface UrlCheck {
  url: string | null;
  error: string | null;
}

/**
 * Strict-but-forgiving link normalisation:
 * - accepts bare domains and @handles for known networks
 * - forces https, lowercases the host, strips `www.`, auth, ports and hashes
 * - drops tracking params and any trailing slash
 * - rejects non-http(s) schemes, localhost/IP hosts and wrong-network hosts
 */
export function normaliseSocialUrl(raw: string, field?: { key: LinkKey; host?: RegExp }): UrlCheck {
  const v = raw.trim();
  if (!v) return { url: null, error: null };
  if (/^(javascript|data|file|mailto):/i.test(v))
    return { url: null, error: "That link type isn't allowed." };

  let candidate = v;
  if (v.startsWith("@") && field && field.key !== "website") {
    const handle = v.slice(1).replace(/[^A-Za-z0-9._-]/g, "");
    if (!handle) return { url: null, error: "Enter a valid handle." };
    const base: Partial<Record<LinkKey, string>> = {
      x: "https://x.com/",
      instagram: "https://instagram.com/",
      github: "https://github.com/",
      linkedin: "https://linkedin.com/in/",
      youtube: "https://youtube.com/@",
      tiktok: "https://tiktok.com/@",
      facebook: "https://facebook.com/",
      whatsapp: "https://wa.me/",
      telegram: "https://t.me/",
    };
    const prefix = base[field.key];
    if (!prefix) return { url: null, error: "Enter a full link (https://…)." };
    candidate = `${prefix}${handle}`;
  } else if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate.replace(/^\/+/, "")}`;
  }

  let u: URL;
  try {
    u = new URL(candidate);
  } catch {
    return { url: null, error: "Enter a valid link (e.g. https://…)." };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:")
    return { url: null, error: "Links must start with https://." };

  u.protocol = "https:";
  u.username = "";
  u.password = "";
  u.port = "";
  u.hash = "";
  u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");

  if (!u.hostname.includes(".") || u.hostname === "localhost") {
    return { url: null, error: "Enter a real domain (e.g. example.com)." };
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(u.hostname))
    return { url: null, error: "IP addresses aren't allowed." };
  if (field?.host && !field.host.test(u.hostname)) {
    return { url: null, error: `That's not a ${field.key === "x" ? "X" : field.key} link.` };
  }

  // Strip common tracking params, then any trailing slash.
  const drop = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "fbclid",
    "igshid",
    "ref",
    "ref_src",
  ];
  drop.forEach((p) => u.searchParams.delete(p));
  let out = u.toString();
  out = out.replace(/\?$/, "");
  out = out.replace(/\/+$/, "");
  if (out.length > 200) return { url: null, error: "That link is too long." };
  return { url: out, error: null };
}

interface Props {
  open: boolean;
  onClose: () => void;
  initial: {
    displayName: string;
    bio: string | null;
    avatarUrl: string | null;
    coverUrl?: string | null;
    socialLinks: SocialLinks;
    skills?: string[];
    interests?: string[];
  };
  userId: string;
  onSaved: () => void | Promise<void>;
}

/**
 * Themed profile editor: avatar (with crop), cover, display name, bio,
 * skills/tags and social links — with a live preview of how the header will
 * look. Client-side validation mirrors the server's zod schema.
 */
export function EditProfileModal({ open, onClose, initial, userId, onSaved }: Props) {
  const isAppShell = useIsAppShell();
  const save = useServerFn(updateMyProfile);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const firstFieldRef = useRef<HTMLInputElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  const [displayName, setDisplayName] = useState(initial.displayName);
  const [bio, setBio] = useState(initial.bio ?? "");
  const [links, setLinks] = useState<Record<string, string>>(() => ({ ...initial.socialLinks }));
  const [skills, setSkills] = useState<string[]>(initial.skills ?? []);
  const [skillDraft, setSkillDraft] = useState("");
  const [interests, setInterests] = useState<string[]>(initial.interests ?? []);
  const [interestDraft, setInterestDraft] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(initial.avatarUrl);
  const [avatarBlob, setAvatarBlob] = useState<Blob | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(initial.coverUrl ?? null);
  const [coverBlob, setCoverBlob] = useState<Blob | null>(null);
  const [cropping, setCropping] = useState<{ src: string; kind: "avatar" | "cover" } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  /** Clears one inline error as soon as the user edits that field. */
  const clearError = useCallback((key: string) => {
    setErrors((e) => (e[key] ? { ...e, [key]: "" } : e));
  }, []);

  // Reset form each time the modal opens so stale edits never leak back in.
  useEffect(() => {
    if (!open) return;
    setDisplayName(initial.displayName);
    setBio(initial.bio ?? "");
    setLinks({ ...initial.socialLinks });
    setSkills(initial.skills ?? []);
    setSkillDraft("");
    setInterests(initial.interests ?? []);
    setInterestDraft("");
    setAvatarPreview(initial.avatarUrl);
    setAvatarBlob(null);
    setCoverPreview(initial.coverUrl ?? null);
    setCoverBlob(null);
    setCropping(null);
    setErrors({});
    const t = window.setTimeout(() => firstFieldRef.current?.focus(), 60);
    return () => window.clearTimeout(t);
  }, [open, initial]);

  // Lock background scroll, close on Escape, and trap focus inside the dialog.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const root = dialogRef.current;
      if (!root) return;
      const nodes = Array.from(
        root.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const bioLeft = MAX_BIO - bio.length;

  const pickImage = useCallback((file: File | null | undefined, kind: "avatar" | "cover") => {
    if (!file) return;
    const key = kind;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setErrors((e) => ({ ...e, [key]: "Use a JPG, PNG, WEBP or GIF image." }));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setErrors((e) => ({ ...e, [key]: "Image is too large (max 8MB)." }));
      return;
    }
    setErrors((e) => ({ ...e, [key]: "" }));
    setCropping({ src: URL.createObjectURL(file), kind });
  }, []);

  const addSkill = useCallback(
    (raw: string) => {
      const tag = raw.trim().replace(/^#/, "").replace(/\s+/g, " ").slice(0, MAX_SKILL_LEN);
      if (!tag) return;
      setSkills((prev) => {
        if (prev.length >= MAX_SKILLS) {
          setErrors((e) => ({ ...e, skills: `Up to ${MAX_SKILLS} skills.` }));
          return prev;
        }
        if (prev.some((s) => s.toLowerCase() === tag.toLowerCase())) return prev;
        return [...prev, tag];
      });
      setSkillDraft("");
      clearError("skills");
    },
    [clearError],
  );

  const addInterest = useCallback(
    (raw: string) => {
      const tag = raw.trim().replace(/^#/, "").replace(/\s+/g, " ").slice(0, MAX_SKILL_LEN);
      if (!tag) return;
      setInterests((prev) => {
        if (prev.length >= MAX_SKILLS) {
          setErrors((e) => ({ ...e, interests: `Up to ${MAX_SKILLS} interests.` }));
          return prev;
        }
        if (prev.some((s) => s.toLowerCase() === tag.toLowerCase())) return prev;
        return [...prev, tag];
      });
      setInterestDraft("");
      clearError("interests");
    },
    [clearError],
  );

  const initials = useMemo(
    () =>
      displayName
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? "")
        .join("") || "U",
    [displayName],
  );

  const previewLinks = useMemo(
    () =>
      LINK_FIELDS.filter((f) => (links[f.key] ?? "").trim().length > 0).map((f) => ({
        key: f.key,
        icon: f.icon,
        href: normaliseSocialUrl(links[f.key] ?? "", f).url,
      })),
    [links],
  );

  const uploadImage = useCallback(
    async (blob: Blob, bucket: "avatars" | "profile-covers") => {
      const path = `${userId}/${crypto.randomUUID()}.jpg`;
      const { error } = await supabase.storage.from(bucket).upload(path, blob, {
        cacheControl: "3600",
        upsert: false,
        contentType: "image/jpeg",
      });
      if (error) throw error;
      return path;
    },
    [userId],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const next: Record<string, string> = {};
      const name = displayName.trim();
      if (name.length < 2) next.displayName = "Enter at least 2 characters.";
      if (name.length > MAX_NAME) next.displayName = `Keep it under ${MAX_NAME} characters.`;
      if (bio.length > MAX_BIO) next.bio = `Keep it under ${MAX_BIO} characters.`;
      if (skills.length > MAX_SKILLS) next.skills = `Up to ${MAX_SKILLS} skills.`;

      const cleanLinks: SocialLinks = {};
      for (const f of LINK_FIELDS) {
        const raw = (links[f.key] ?? "").trim();
        if (!raw) continue;
        const { url, error } = normaliseSocialUrl(raw, f);
        if (!url) next[f.key] = error ?? "Enter a valid link (e.g. https://…).";
        else cleanLinks[f.key] = url;
      }

      setErrors(next);
      if (Object.values(next).some(Boolean)) {
        toast.error("Please fix the highlighted fields.");
        return;
      }

      setSaving(true);
      try {
        const [avatarPath, coverPath] = await Promise.all([
          avatarBlob ? uploadImage(avatarBlob, "avatars") : Promise.resolve(undefined),
          coverBlob ? uploadImage(coverBlob, "profile-covers") : Promise.resolve(undefined),
        ]);

        await save({
          data: {
            displayName: name,
            bio: bio.trim() ? bio.trim() : null,
            socialLinks: cleanLinks,
            skills,
            interests,
            ...(avatarPath ? { avatarPath } : {}),
            ...(coverPath ? { coverPath } : {}),
          },
        });

        // Reflect normalised links back into the form so the user sees what
        // was actually stored.
        setLinks({ ...cleanLinks } as Record<string, string>);

        try {
          window.dispatchEvent(new CustomEvent("oventric:profile-updated", { detail: { userId } }));
        } catch {
          /* noop */
        }
        toast.success("Profile updated", { description: "Your changes are live on your profile." });
        await onSaved();
        onClose();
      } catch (err) {
        console.error("[EditProfileModal] save failed", err);
        const message =
          err instanceof Error ? err.message : "Could not save your profile. Try again.";
        // Map known server validation messages back onto their field so the
        // inline error replaces any stale one.
        if (/username/i.test(message)) setErrors({ displayName: message });
        else if (/bio/i.test(message)) setErrors({ bio: message });
        else setErrors({});
        toast.error(message);
      } finally {
        setSaving(false);
      }
    },
    [
      displayName,
      bio,
      links,
      skills,
      interests,
      avatarBlob,
      coverBlob,
      uploadImage,
      userId,
      save,
      onSaved,
      onClose,
    ],
  );

  if (!open || typeof document === "undefined") return null;

  const inputBase =
    "w-full rounded-xl bg-[#141418] md:bg-white border px-3 py-2.5 text-sm text-white md:text-slate-900 placeholder:text-slate-500 md:placeholder:text-slate-400 outline-none transition-colors focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/30";

  return createPortal(
    <div
      className={`modal-light fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4 ${isAppShell ? "app-profile-editor" : ""}`}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-profile-title"
        className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-white/10 md:border-slate-200 bg-[#1a1a1f] md:bg-white shadow-2xl"
      >
        {isAppShell && <div className="app-profile-handle" aria-hidden="true" />}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-white/10 md:border-slate-200 bg-[#1a1a1f] md:bg-white px-4 py-3">
          <h2 id="edit-profile-title" className="text-base font-black text-white md:text-slate-900">
            Edit profile
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close editor"
            className="w-8 h-8 rounded-[10px] flex items-center justify-center text-slate-400 md:text-slate-500 hover:text-white md:hover:text-slate-900 hover:bg-white/10 md:hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-4 py-4 space-y-5" noValidate>
          {/* Live preview */}
          <section
            aria-label="Live preview"
            className="rounded-2xl overflow-hidden border border-white/10 md:border-slate-200"
          >
            <div className="relative h-24 bg-gradient-to-r from-emerald-600/40 via-cyan-500/25 to-emerald-400/30">
              {coverPreview && (
                <img loading="lazy" decoding="async"
                  src={coverPreview}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                />
              )}
            </div>
            <div className="bg-[#141418] md:bg-slate-50 px-4 pb-4 -mt-8">
              <div className="w-16 h-16 rounded-full overflow-hidden border-4 border-[#1a1a1f] md:border-white bg-emerald-500 flex items-center justify-center text-black font-black">
                {avatarPreview ? (
                  <img loading="lazy" decoding="async" src={avatarPreview} alt="" className="w-full h-full object-cover" />
                ) : (
                  initials
                )}
              </div>
              <p className="mt-2 text-sm font-black text-white md:text-slate-900 truncate">
                {displayName.trim() || "Your name"}
              </p>
              <p className="text-xs text-slate-400 md:text-slate-600 line-clamp-2">
                {bio.trim() || "Your bio appears here."}
              </p>
              {skills.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {skills.slice(0, 6).map((s) => (
                    <span
                      key={s}
                      className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 md:text-emerald-700 border border-emerald-500/30"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              )}
              {previewLinks.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {previewLinks.map((l) => (
                    <span
                      key={l.key}
                      title={l.href ?? "Invalid link"}
                      className={`inline-flex items-center justify-center w-7 h-7 rounded-full border ${
                        l.href
                          ? "border-white/15 md:border-slate-300 text-slate-300 md:text-slate-600"
                          : "border-red-500/50 text-red-400"
                      }`}
                    >
                      {l.icon}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </section>

          {cropping && (
            <AvatarCropper
              src={cropping.src}
              aspect={cropping.kind === "avatar" ? 1 : 3}
              size={cropping.kind === "avatar" ? 512 : 1200}
              title={cropping.kind === "avatar" ? "Crop profile picture" : "Crop cover image"}
              onCancel={() => setCropping(null)}
              onCropped={(blob, url) => {
                if (cropping.kind === "avatar") {
                  setAvatarBlob(blob);
                  setAvatarPreview(url);
                } else {
                  setCoverBlob(blob);
                  setCoverPreview(url);
                }
                setCropping(null);
              }}
            />
          )}

          {/* Avatar + cover controls */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 md:border-slate-300 px-3 py-2.5 text-xs font-bold text-slate-300 md:text-slate-600 hover:border-emerald-400/60 hover:text-emerald-300 md:hover:text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              >
                <Camera className="w-4 h-4" /> Profile picture
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept={ALLOWED_IMAGE_TYPES.join(",")}
                className="sr-only"
                onChange={(e) => {
                  pickImage(e.target.files?.[0], "avatar");
                  if (e.target) e.target.value = "";
                }}
              />
              {errors.avatar && (
                <p className="mt-1 text-xs font-semibold text-red-400">{errors.avatar}</p>
              )}
            </div>
            <div>
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 md:border-slate-300 px-3 py-2.5 text-xs font-bold text-slate-300 md:text-slate-600 hover:border-emerald-400/60 hover:text-emerald-300 md:hover:text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              >
                <ImagePlus className="w-4 h-4" /> Cover image
              </button>
              <input
                ref={coverInputRef}
                type="file"
                accept={ALLOWED_IMAGE_TYPES.join(",")}
                className="sr-only"
                onChange={(e) => {
                  pickImage(e.target.files?.[0], "cover");
                  if (e.target) e.target.value = "";
                }}
              />
              {errors.cover && (
                <p className="mt-1 text-xs font-semibold text-red-400">{errors.cover}</p>
              )}
            </div>
          </div>
          <p className="-mt-3 text-[11px] text-slate-500">
            JPG, PNG, WEBP or GIF · up to 8MB · crop before saving.
          </p>

          {/* Display name */}
          <div>
            <label
              htmlFor="ep-name"
              className="block text-xs font-bold uppercase tracking-wider text-slate-400 md:text-slate-500 mb-1.5"
            >
              Display name
            </label>
            <input
              id="ep-name"
              ref={firstFieldRef}
              value={displayName}
              maxLength={MAX_NAME}
              onChange={(e) => {
                setDisplayName(e.target.value);
                clearError("displayName");
              }}
              aria-invalid={!!errors.displayName}
              aria-describedby={errors.displayName ? "ep-name-err" : undefined}
              className={`${inputBase} ${errors.displayName ? "border-red-500/70" : "border-white/10 md:border-slate-300"}`}
              placeholder="Your name"
            />
            {errors.displayName && (
              <p id="ep-name-err" className="mt-1 text-xs font-semibold text-red-400">
                {errors.displayName}
              </p>
            )}
          </div>

          {/* Bio */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="ep-bio"
                className="block text-xs font-bold uppercase tracking-wider text-slate-400 md:text-slate-500"
              >
                Bio
              </label>
              <span
                className={`text-[11px] font-semibold ${bioLeft < 0 ? "text-red-400" : "text-slate-500"}`}
              >
                {bioLeft}
              </span>
            </div>
            <textarea
              id="ep-bio"
              value={bio}
              rows={3}
              maxLength={MAX_BIO + 40}
              onChange={(e) => {
                setBio(e.target.value);
                clearError("bio");
              }}
              aria-invalid={!!errors.bio}
              className={`${inputBase} resize-none ${errors.bio ? "border-red-500/70" : "border-white/10 md:border-slate-300"}`}
              placeholder="Tell people what you do on Oventric."
            />
            {errors.bio && <p className="mt-1 text-xs font-semibold text-red-400">{errors.bio}</p>}
          </div>

          {/* Skills / tags */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="ep-skill"
                className="block text-xs font-bold uppercase tracking-wider text-slate-400 md:text-slate-500"
              >
                Skills &amp; tags
              </label>
              <span className="text-[11px] font-semibold text-slate-500">
                {skills.length}/{MAX_SKILLS}
              </span>
            </div>
            {skills.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {skills.map((s) => (
                  <span
                    key={s}
                    className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-300 md:text-emerald-700 border border-emerald-500/30"
                  >
                    {s}
                    <button
                      type="button"
                      aria-label={`Remove ${s}`}
                      onClick={() => setSkills((prev) => prev.filter((x) => x !== s))}
                      className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-emerald-500/25"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                id="ep-skill"
                value={skillDraft}
                maxLength={MAX_SKILL_LEN}
                onChange={(e) => {
                  setSkillDraft(e.target.value);
                  clearError("skills");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addSkill(skillDraft);
                  }
                }}
                placeholder="e.g. Prompt engineering"
                className={`${inputBase} ${errors.skills ? "border-red-500/70" : "border-white/10 md:border-slate-300"}`}
              />
              <button
                type="button"
                onClick={() => addSkill(skillDraft)}
                aria-label="Add skill"
                className="shrink-0 px-3 rounded-xl bg-white/5 md:bg-slate-100 border border-white/10 md:border-slate-300 text-slate-300 md:text-slate-700 hover:text-white md:hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {errors.skills && (
              <p className="mt-1 text-xs font-semibold text-red-400">{errors.skills}</p>
            )}
          </div>

          {/* Interests */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="ep-interest"
                className="block text-xs font-bold uppercase tracking-wider text-slate-400 md:text-slate-500"
              >
                Interests
              </label>
              <span className="text-[11px] font-semibold text-slate-500">
                {interests.length}/{MAX_SKILLS}
              </span>
            </div>
            {interests.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {interests.map((s) => (
                  <span
                    key={s}
                    className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full text-xs font-bold bg-white/[0.06] md:bg-slate-100 text-slate-200 md:text-slate-700 border border-white/10 md:border-slate-300"
                  >
                    {s}
                    <button
                      type="button"
                      aria-label={`Remove ${s}`}
                      onClick={() => setInterests((prev) => prev.filter((x) => x !== s))}
                      className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-white/10"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                id="ep-interest"
                value={interestDraft}
                maxLength={MAX_SKILL_LEN}
                onChange={(e) => {
                  setInterestDraft(e.target.value);
                  clearError("interests");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addInterest(interestDraft);
                  }
                }}
                placeholder="e.g. Design, AI, Photography"
                className={`${inputBase} ${errors.interests ? "border-red-500/70" : "border-white/10 md:border-slate-300"}`}
              />
              <button
                type="button"
                onClick={() => addInterest(interestDraft)}
                aria-label="Add interest"
                className="shrink-0 px-3 rounded-xl bg-white/5 md:bg-slate-100 border border-white/10 md:border-slate-300 text-slate-300 md:text-slate-700 hover:text-white md:hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {errors.interests && (
              <p className="mt-1 text-xs font-semibold text-red-400">{errors.interests}</p>
            )}
          </div>

          {/* Social links */}
          <div className="space-y-2.5">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 md:text-slate-500">
              Social links
            </p>
            {LINK_FIELDS.map((f) => (
              <div key={f.key}>
                <div
                  className={`flex items-center gap-2 rounded-xl border px-3 bg-[#141418] md:bg-white focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-500/30 transition-colors ${
                    errors[f.key] ? "border-red-500/70" : "border-white/10 md:border-slate-300"
                  }`}
                >
                  <span className="text-slate-400 md:text-slate-500 shrink-0" aria-hidden>
                    {f.icon}
                  </span>
                  <input
                    aria-label={f.label}
                    value={links[f.key] ?? ""}
                    onChange={(e) => {
                      setLinks((l) => ({ ...l, [f.key]: e.target.value }));
                      clearError(f.key);
                    }}
                    onBlur={(e) => {
                      const { url } = normaliseSocialUrl(e.target.value, f);
                      if (url) setLinks((l) => ({ ...l, [f.key]: url }));
                    }}
                    placeholder={f.placeholder}
                    inputMode="url"
                    className="flex-1 min-w-0 bg-transparent py-2.5 text-sm text-white md:text-slate-900 placeholder:text-slate-500 md:placeholder:text-slate-400 outline-none"
                  />
                </div>
                {errors[f.key] && (
                  <p className="mt-1 text-xs font-semibold text-red-400">{errors[f.key]}</p>
                )}
              </div>
            ))}
          </div>

          <div className="sticky bottom-0 -mx-4 px-4 py-3 bg-[#1a1a1f] md:bg-white border-t border-white/10 md:border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-3 rounded-[10px] text-sm font-semibold text-slate-300 md:text-slate-600 hover:bg-white/10 md:hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-[10px] bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-black text-sm font-black focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
