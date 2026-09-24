import { useEffect, useRef, useState } from "react";
import { Heart, ThumbsUp, ThumbsDown, Laugh, Crown } from "lucide-react";
import type { ReactionType } from "@/lib/posts.functions";
import { Button } from "@/components/ui/button";

export const REACTION_META: Record<
  ReactionType,
  { label: string; Icon: typeof Heart; color: string; tone: string; softTone: string }
> = {
  love: {
    label: "Love",
    Icon: Heart,
    color: "var(--newsfeed-coral)",
    tone: "text-newsfeed-coral",
    softTone: "bg-newsfeed-coral-soft",
  },
  like: {
    label: "Like",
    Icon: ThumbsUp,
    color: "var(--newsfeed-blue)",
    tone: "text-newsfeed-blue",
    softTone: "bg-newsfeed-blue-soft",
  },
  dislike: {
    label: "Dislike",
    Icon: ThumbsDown,
    color: "var(--newsfeed-green)",
    tone: "text-newsfeed-green",
    softTone: "bg-newsfeed-green-soft",
  },
  laugh: {
    label: "Haha",
    Icon: Laugh,
    color: "var(--newsfeed-gold)",
    tone: "text-newsfeed-gold",
    softTone: "bg-newsfeed-gold-soft",
  },
  crown: {
    label: "Crown",
    Icon: Crown,
    color: "var(--newsfeed-violet)",
    tone: "text-newsfeed-violet",
    softTone: "bg-newsfeed-violet-soft",
  },
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
  if (reaction === "laugh") {
    return (
      <span
        aria-hidden
        className={`inline-flex shrink-0 items-center justify-center leading-none ${className ?? ""}`}
        style={size ? { width: size, height: size, fontSize: size } : undefined}
      >
        😂
      </span>
    );
  }
  const imageUrl = IMAGE_REACTIONS[reaction];
  if (imageUrl) {
    const motion =
      reaction === "love"
        ? "reaction-heart-beat"
        : reaction === "like"
          ? "reaction-thumb-up-bob"
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
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={ariaLabel ?? m.label}
      title={m.label}
      onClick={onClick}
      className={[
        "reaction-spectrum-button group relative overflow-hidden shadow-none transition-transform duration-200 ease-out hover:scale-110 active:scale-90",
        m.tone,
        m.softTone,
        dims,
        className,
      ].join(" ")}
    >
      <span className="reaction-spectrum-halo" aria-hidden />
      <ReactionGlyph
        reaction={reaction}
        size={isImg ? iconSize + 8 : iconSize}
        className="relative z-10"
      />
    </Button>
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
      data-reaction-picker
      className={`reaction-spectrum-picker absolute bottom-full ${alignCls} mb-3 z-30 flex items-center gap-1.5 rounded-2xl border border-newsfeed-line bg-newsfeed-surface/95 p-1.5 shadow-newsfeed backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 duration-150`}
    >
      <span className="reaction-spectrum-wash" aria-hidden />
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
        className={`reaction-spectrum-splash rounded-2xl p-4 ${m.tone} ${m.softTone}`}
        style={{
          backgroundColor: isImg ? "transparent" : undefined,
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
        className={`reaction-spectrum-badge rounded-[10px] w-10 h-10 flex items-center justify-center ${m.tone} ${m.softTone}`}
        style={{ backgroundColor: isImg ? "transparent" : undefined }}
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
