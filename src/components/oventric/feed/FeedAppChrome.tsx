import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Bell, MessageSquare, Search, Plus } from "lucide-react";
import logoFull from "@/assets/oventric-full-transparent.png";
import { AvatarImage } from "@/components/oventric/AvatarImage";
import { ProfileDropdown } from "@/components/oventric/ProfileDropdown";

import { CountBadge } from "@/components/oventric/CountBadge";
import {
  NotificationsDrawer,
  useUnreadNotificationsCount,
} from "@/components/oventric/NotificationsDrawer";
import { MessagesDrawer } from "@/components/oventric/MessagesDrawer";
import { useChromeHidden } from "@/hooks/use-chrome-hide";
import { useUnreadCounts } from "@/hooks/use-unread-counts";
import { getTopUsers, type TopUser } from "@/lib/top-users.functions";
import { MAX_STORY_FILES, useStoryRail } from "@/components/oventric/feed/useStories";
import { StoryViewerModal } from "@/components/oventric/feed/StoryViewerModal";
import { StoryTrimmerModal } from "@/components/oventric/feed/StoryTrimmerModal";



export type FeedTab = "foryou" | "following" | "discover";

const TABS: { key: FeedTab; label: string }[] = [
  { key: "foryou", label: "For you" },
  { key: "following", label: "Following" },
  { key: "discover", label: "Discover" },
];

/** Ring gradients cycled across story avatars so the rail feels alive. */
const RINGS = [
  "from-[#E5484D] via-[#F2686C] to-[#7C6CF6]",
  "from-[#7C6CF6] via-[#E5484D] to-[#F5A524]",
  "from-[#F5A524] via-[#E5484D] to-[#7C6CF6]",
  "from-[#30A46C] via-[#7C6CF6] to-[#E5484D]",
];

type Props = {
  tab: FeedTab;
  onTabChange: (t: FeedTab) => void;
  searchOpen: boolean;
  onToggleSearch: () => void;
  meAvatarUrl: string | null;
  meInitials: string;
  meSlug: string | null;
};

/**
 * App-shell newsfeed chrome: brand header, For you / Following / Discover
 * tabs and the stories rail. Mirrors the premium dark reference design.
 */
export function FeedAppChrome({
  tab,
  onTabChange,
  searchOpen,
  onToggleSearch,
  meAvatarUrl,
  meInitials,
  meSlug,
}: Props) {
  const chromeHidden = useChromeHidden();
  const [notifOpen, setNotifOpen] = useState(false);
  const [msgOpen, setMsgOpen] = useState(false);
  const [people, setPeople] = useState<TopUser[]>([]);
  const [viewerAt, setViewerAt] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const {
    groups: storyGroups,
    uploading,
    progress,
    upload,
    refresh,
    trimRequest,
    trimWorking,
    trimProgress,
    cancelTrim,
    confirmTrim,
  } = useStoryRail(true);

  const myGroup = storyGroups.find((g) => g.isMe) ?? null;
  const openViewer = (index: number) => setViewerAt(index >= 0 ? index : 0);

  const unreadNotifs = useUnreadNotificationsCount();
  const { messages } = useUnreadCounts();
  const loadTopUsers = useServerFn(getTopUsers);


  useEffect(() => {
    let cancelled = false;
    loadTopUsers()
      .then((r) => {
        if (!cancelled) setPeople(r.users ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [loadTopUsers]);

  return (
    <div
      className={`-mx-4 sticky top-0 z-30 bg-[#0A0A0B] transition-all duration-300 ease-out ${
        chromeHidden
          ? "pointer-events-none -translate-y-full opacity-0"
          : "translate-y-0 opacity-100"
      }`}
    >
      {/* Brand header — stays pinned; only fades slightly on scroll down */}
      <div>
        <div className="min-h-0">
        <div className="flex items-center gap-2 px-4 pt-1 pb-2">
        <img loading="lazy" decoding="async" src={logoFull} alt="Oventric" className="h-7 w-auto shrink-0" />
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={onToggleSearch}
            aria-label="Search"
            className={`grid h-11 w-11 place-items-center rounded-full transition-colors active:scale-95 ${
              searchOpen ? "bg-[#E5484D]/15 text-[#E5484D]" : "text-white/80 hover:text-white"
            }`}
          >
            <Search className="h-[22px] w-[22px]" strokeWidth={1.8} />
          </button>
          <button
            type="button"
            onClick={() => setNotifOpen(true)}
            aria-label="Notifications"
            className="relative grid h-11 w-11 place-items-center rounded-full text-white/80 transition-colors hover:text-white active:scale-95"
          >
            <Bell className="h-[22px] w-[22px]" strokeWidth={1.8} />
            <CountBadge count={unreadNotifs} ariaLabel={`${unreadNotifs} new notifications`} />
          </button>
          <button
            type="button"
            onClick={() => setMsgOpen(true)}
            aria-label="Messages"
            className="relative grid h-11 w-11 place-items-center rounded-full text-white/80 transition-colors hover:text-white active:scale-95"
          >
            <MessageSquare className="h-[22px] w-[22px]" strokeWidth={1.8} />
            <CountBadge count={messages ?? 0} ariaLabel={`${messages ?? 0} unread messages`} />
          </button>
          <div className="ml-1">
            <ProfileDropdown />
          </div>

        </div>
        </div>
        </div>
      </div>




      {/* Tabs */}
      <div className="flex justify-center border-b border-white/[0.06] overflow-x-auto no-scrollbar scroll-smooth bg-[#0A0A0B]">
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              onClick={() => onTabChange(t.key)}
              className="relative shrink-0 px-6 py-3 text-[14px] font-bold transition-colors"
            >
              <span className={active ? "text-white" : "text-white/40"}>
                {t.label}
              </span>
              {active && (
                <div className="absolute bottom-0 left-0 w-full h-[3.5px] bg-[#E5484D] rounded-t-full" />
              )}
            </button>
          );
        })}
      </div>


      {/* Stories rail */}
      <div className="flex gap-4 overflow-x-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []).slice(0, MAX_STORY_FILES);
            e.target.value = "";
            if (files.length) void upload(files);
          }}
        />
        {/* Add Story — always the first circle, purely an uploader */}
        <button
          type="button"
          onClick={() => !uploading && fileRef.current?.click()}
          className="flex w-[62px] shrink-0 flex-col items-center gap-1.5 active:scale-95 transition-transform"
        >
          <span className="relative block h-[58px] w-[58px]">
            {uploading && (
              <span
                className="absolute inset-0 animate-spin rounded-full"
                style={{
                  background: `conic-gradient(#E5484D ${Math.round(progress * 360)}deg, rgba(255,255,255,0.12) 0deg)`,
                  animationDuration: "1.4s",
                }}
              />
            )}
            <span
              className={`absolute inset-0 overflow-hidden rounded-full bg-[#1A1A1F] ring-1 ring-white/10 ${
                uploading ? "m-[3px] border-2 border-[#0A0A0B]" : ""
              }`}
            >
              <AvatarImage src={meAvatarUrl} alt="Add story" initials={meInitials} />
            </span>
            {!uploading && (
              <span className="absolute -bottom-0.5 -right-0.5 z-10 grid h-[22px] w-[22px] place-items-center rounded-full border-2 border-[#0A0A0B] bg-[#E5484D]">
                <Plus className="h-3 w-3 text-white" strokeWidth={3} />
              </span>
            )}
          </span>
          <span className="w-full truncate text-center text-[11px] font-medium text-white/70">
            {uploading ? "Uploading…" : "Add Story"}
          </span>
        </button>

        {/* My published story lives in its own circle right after the uploader */}
        {myGroup && (
          <button
            type="button"
            onClick={() => openViewer(storyGroups.indexOf(myGroup))}
            className="flex w-[62px] shrink-0 flex-col items-center gap-1.5 active:scale-95 transition-transform"
          >
            <span
              className={`grid h-[58px] w-[58px] place-items-center rounded-full p-[2px] ${
                myGroup.allViewed ? "bg-white/15" : `bg-gradient-to-tr ${RINGS[0]}`
              }`}
            >
              <span className="block h-full w-full overflow-hidden rounded-full border-2 border-[#0A0A0B] bg-[#1A1A1F]">
                <AvatarImage src={myGroup.avatarUrl} alt={myGroup.displayName} />
              </span>
            </span>
            <span className="w-full truncate text-center text-[11px] font-medium text-white/70">
              Your story
            </span>
          </button>
        )}

        {storyGroups
          .filter((g) => !g.isMe)
          .map((g, i) => (
            <button
              key={g.userId}
              type="button"
              onClick={() => openViewer(storyGroups.indexOf(g))}
              className="flex w-[62px] shrink-0 flex-col items-center gap-1.5 active:scale-95 transition-transform"
            >
              <span
                className={`grid h-[58px] w-[58px] place-items-center rounded-full p-[2px] ${
                  g.allViewed
                    ? "bg-white/15"
                    : `bg-gradient-to-tr ${RINGS[(i + 1) % RINGS.length]}`
                }`}
              >
                <span className="block h-full w-full overflow-hidden rounded-full border-2 border-[#0A0A0B] bg-[#1A1A1F]">
                  <AvatarImage src={g.avatarUrl} alt={g.displayName} />
                </span>
              </span>
              <span className="w-full truncate text-center text-[11px] font-medium text-white/70">
                {g.displayName.split(" ")[0]}
              </span>
            </button>
          ))}


        {people
          .filter((u) => !storyGroups.some((g) => g.userId === u.userId))
          .map((u, i) => (
            <Link
              key={u.userId}
              to="/profile/$id"
              params={{ id: u.slug }}
              className="flex w-[62px] shrink-0 flex-col items-center gap-1.5 active:scale-95 transition-transform"
            >
              <span
                className={`grid h-[58px] w-[58px] place-items-center rounded-full bg-gradient-to-tr p-[2px] ${
                  RINGS[i % RINGS.length]
                }`}
              >
                <span className="block h-full w-full overflow-hidden rounded-full border-2 border-[#0A0A0B] bg-[#1A1A1F]">
                  <AvatarImage src={u.avatarUrl} alt={u.displayName} />
                </span>
              </span>
              <span className="w-full truncate text-center text-[11px] font-medium text-white/70">
                {u.displayName.split(" ")[0]}
              </span>
            </Link>
          ))}
      </div>
      {viewerAt !== null && (
        <StoryViewerModal
          groups={storyGroups}
          startIndex={viewerAt}
          onClose={() => {
            setViewerAt(null);
            void refresh();
          }}
        />
      )}
      {trimRequest && (
        <StoryTrimmerModal
          file={trimRequest.file}
          duration={trimRequest.duration}
          working={trimWorking}
          progress={trimProgress}
          onCancel={cancelTrim}
          onConfirm={(s) => void confirmTrim(s)}
        />
      )}


      <div className="h-px w-full bg-white/[0.07]" />

      <NotificationsDrawer open={notifOpen} onClose={() => setNotifOpen(false)} />
      <MessagesDrawer open={msgOpen} onClose={() => setMsgOpen(false)} />
    </div>
  );
}
