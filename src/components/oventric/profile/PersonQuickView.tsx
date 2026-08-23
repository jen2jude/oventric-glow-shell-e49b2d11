import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import { ExternalLink, MessageCircle, X } from "lucide-react";
import { AvatarImage } from "@/components/oventric/AvatarImage";
import { FollowButton } from "@/components/oventric/FollowButton";
import type { PersonSummary } from "@/lib/follows.functions";
import { usePresence } from "@/hooks/use-presence";

interface Props {
  person: PersonSummary | null;
  isOnline: boolean;
  viewerId: string | null;
  onClose: () => void;
  onMessage?: (person: PersonSummary) => void;
}

/**
 * Accessible quick-view drawer for a follower/following row: avatar, name,
 * presence, bio and relationship actions without leaving the profile page.
 */
export function PersonQuickView({ person, isOnline, viewerId, onClose, onMessage }: Props) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const presence = usePresence();

  useEffect(() => {
    if (!person) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const root = panelRef.current;
      if (!root) return;
      const nodes = Array.from(
        root.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);
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
    const t = window.setTimeout(() => {
      panelRef.current?.querySelector<HTMLElement>("button, a")?.focus();
    }, 50);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
    };
  }, [person, onClose]);

  if (!person || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="modal-light fixed inset-0 z-[125] flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="person-quickview-title"
        className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl border border-white/10 md:border-slate-200 bg-[#1a1a1f] md:bg-white shadow-2xl p-5"
      >
        <div className="flex items-start gap-3">
          <span className="relative block h-14 w-14 shrink-0 overflow-hidden rounded-full">
            <AvatarImage src={person.avatarUrl} alt={person.displayName} />
          </span>
          <div className="min-w-0 flex-1">
            <h2
              id="person-quickview-title"
              className="truncate text-base font-black text-white md:text-slate-900"
            >
              {person.displayName}
            </h2>
            <p className="truncate text-xs text-slate-400 md:text-slate-500">
              {person.username ? `@${person.username}` : "Oventric member"}
            </p>
            <span
              className={`mt-1 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                isOnline
                  ? "bg-emerald-500/15 text-emerald-300 md:text-emerald-700"
                  : "bg-white/5 md:bg-slate-100 text-slate-400 md:text-slate-500"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${isOnline ? "bg-emerald-400" : "bg-slate-500"}`}
              />
              {isOnline ? "Online now" : (presence.lastSeenLabel(person?.userId) ?? "Offline")}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close quick view"
            className="h-8 w-8 shrink-0 rounded-[10px] flex items-center justify-center text-slate-400 hover:text-white md:hover:text-slate-900 hover:bg-white/10 md:hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-slate-300 md:text-slate-600">
          {person.bio?.trim() || "This member hasn't added a bio yet."}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {viewerId && viewerId !== person.userId ? (
            <FollowButton targetId={person.userId} className="w-full" />
          ) : (
            <span className="rounded-[10px] border border-white/10 md:border-slate-200 px-3 py-3 text-center text-xs font-semibold text-slate-500">
              {viewerId ? "This is you" : "Sign in to follow"}
            </span>
          )}
          {onMessage && viewerId && viewerId !== person.userId ? (
            <button
              type="button"
              onClick={() => onMessage(person)}
              className="inline-flex items-center justify-center gap-1.5 rounded-[10px] bg-emerald-500 hover:bg-emerald-400 px-3 py-3 text-sm font-black text-black focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/80"
            >
              <MessageCircle className="h-4 w-4" /> Message
            </button>
          ) : (
            <span />
          )}
        </div>

        <Link
          to="/profile/$id"
          params={{ id: person.slug || person.userId }}
          onClick={onClose}
          className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-white/10 md:border-slate-200 px-3 py-3 text-sm font-semibold text-slate-300 md:text-slate-700 hover:bg-white/5 md:hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70"
        >
          <ExternalLink className="h-4 w-4" /> View full profile
        </Link>
      </div>
    </div>,
    document.body,
  );
}
