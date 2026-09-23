import { useEffect, useRef, useState } from "react";
import { Heart, ThumbsUp, ThumbsDown, Laugh, Crown } from "lucide-react";
import type { ReactionType } from "@/lib/posts.functions";

export const REACTION_META: Record<
  ReactionType,
  { label: string; Icon: typeof Heart; color: string }
> = {
  love: { label: "Love", Icon: Heart, color: "#f43f5e" },
  like: { label: "Like", Icon: ThumbsUp, color: "#38bdf8" },
  dislike: { label: "Dislike", Icon: ThumbsDown, color: "#94a3b8" },
  laugh: { label: "Haha", Icon: Laugh, color: "#facc15" },
  crown: { label: "Crown", Icon: Crown, color: "#a78bfa" },
};

export const REACTION_ORDER: ReactionType[] = ["love", "like", "dislike", "laugh", "crown"];

/** Reactions use the default flat Lucide icons (3D image variants removed). */
const IMAGE_REACTIONS: Partial<Record<ReactionType, string>> = {};

export function isImageReaction(reaction: ReactionType) {
  return Boolean(IMAGE_REACTIONS[reaction]);
}

/**
 * Renders a reaction glyph. "love", "like" and "dislike" use glossy 3D images
 * with a soft idle motion; the rest fall back to their Lucide icon.
 */
export function ReactionGlyph({
  reaction,
  className,
  size,
  animate = true,
}: {
  reaction: ReactionType;
  className?: string;
  size?: number;
  animate?: boolean;
}) {
  const imageUrl = IMAGE_REACTIONS[reaction];
  if (imageUrl) {
    const motion =
      reaction === "love"
        ? "reaction-heart-beat"
        : reaction === "like"
          ? "reaction-thumb-up-bob"
          : reaction === "laugh"
            ? "reaction-laugh-wobble"
            : reaction === "crown"
              ? "reaction-crown-float"
              : "reaction-thumb-down-bob";
    return (
      <img loading="lazy" decoding="async"
        src={imageUrl}
        alt=""
        aria-hidden
        draggable={false}
        width={size}
        height={size}
        className={[
          "select-none object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.35)]",
          animate ? motion : "",
          className ?? "",
        ].join(" ")}
        style={size ? { width: size, height: size } : undefined}
      />
    );
  }
  const Icon = REACTION_META[reaction].Icon;
  return <Icon size={size} className={`fill-current ${className ?? ""}`} strokeWidth={2.5} />;
}

/** Default flat reaction button. */
export function ReactionButton({
  reaction,
  onClick,
  size = "md",
  ariaLabel,
  className,
}: {
  reaction: ReactionType;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  size?: "xs" | "sm" | "md" | "lg";
  ariaLabel?: string;
  className?: string;
}) {
  const m = REACTION_META[reaction];
  const isImg = isImageReaction(reaction);
  const dims =
    size === "xs"
      ? "w-6 h-6 rounded-[10px]"
      : size === "sm"
        ? "w-8 h-8 rounded-full"
        : size === "lg"
          ? "w-14 h-14 rounded-2xl"
          : "w-10 h-10 rounded-full";
  const iconSize = size === "xs" ? 12 : size === "sm" ? 16 : size === "lg" ? 28 : 20;
  return (
    <button
      type="button"
      aria-label={ariaLabel ?? m.label}
      onClick={onClick}
      className={[
        "inline-flex items-center justify-center transition-transform duration-200 ease-out hover:scale-110 active:scale-90",
        dims,
        className,
      ].join(" ")}
      style={{
        backgroundColor: isImg ? "transparent" : `${m.color}e6`,
        color: "#ffffff",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <ReactionGlyph reaction={reaction} size={isImg ? iconSize + 8 : iconSize} />
    </button>
  );
}

/** Floating chooser rendered above a trigger button. */
export function ReactionPicker({
  onPick,
  onClose,
  align = "left",
}: {
  onPick: (r: ReactionType) => void;
  onClose: () => void;
  align?: "left" | "right" | "center";
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [onClose]);
  const alignCls =
    align === "right" ? "right-0" : align === "center" ? "left-1/2 -translate-x-1/2" : "left-0";
  return (
    <div
      ref={ref}
      className={`absolute bottom-full ${alignCls} mb-3 z-30 flex items-center gap-2 rounded-full bg-[#141418] md:bg-white border border-white/10 md:border-slate-200 px-2.5 py-3 shadow-xl shadow-black/60 animate-in fade-in slide-in-from-bottom-2 duration-150`}
    >
      {REACTION_ORDER.map((r) => (
        <ReactionButton
          key={r}
          reaction={r}
          size="md"
          onClick={(e) => {
            e.stopPropagation();
            onPick(r);
          }}
        />
      ))}
    </div>
  );
}

/** One-shot splash that animates in the center of a container. */
export function ReactionSplash({
  reaction,
  keyId,
}: {
  reaction: ReactionType;
  keyId: string | number;
}) {
  const m = REACTION_META[reaction];
  const isImg = isImageReaction(reaction);
  return (
    <div
      key={keyId}
      aria-hidden
      className="pointer-events-none absolute inset-0 flex items-center justify-center z-20"
    >
      <div
        className="rounded-2xl p-4 text-white md:text-slate-900"
        style={{
          backgroundColor: isImg ? "transparent" : m.color,
          animation: "reaction-splash 900ms cubic-bezier(0.16,1,0.3,1) forwards",
        }}
      >
        <ReactionGlyph reaction={reaction} animate={false} className="w-16 h-16" />
      </div>
    </div>
  );
}

/** Clean flat badge on bottom-right of an image or video. */
export function ReactionImageBadge({ reaction }: { reaction: ReactionType }) {
  const m = REACTION_META[reaction];
  const isImg = isImageReaction(reaction);
  return (
    <div className="absolute bottom-3 right-3 z-10 pointer-events-none">
      <div
        className="rounded-2xl w-10 h-10 flex items-center justify-center text-white md:text-slate-900"
        style={{ backgroundColor: isImg ? "transparent" : m.color }}
      >
        <ReactionGlyph reaction={reaction} className={isImg ? "w-8 h-8" : "w-5 h-5"} />
      </div>
    </div>
  );
}

/** Hook that manages picker + splash state for a single reactable target. */
export function useReactionSplash() {
  const [splash, setSplash] = useState<{ id: number; reaction: ReactionType } | null>(null);
  const fire = (reaction: ReactionType) => {
    setSplash({ id: Date.now(), reaction });
    setTimeout(() => setSplash((s) => (s && s.reaction === reaction ? null : s)), 1000);
  };
  return { splash, fire };
}
