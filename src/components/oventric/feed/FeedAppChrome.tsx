import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Bell, MessageSquare, Search } from "lucide-react";
import logoFull from "@/assets/oventric-full-transparent.png";
import { ProfileDropdown } from "@/components/oventric/ProfileDropdown";

import { CountBadge } from "@/components/oventric/CountBadge";
import {
  NotificationsDrawer,
  useUnreadNotificationsCount,
} from "@/components/oventric/NotificationsDrawer";
import { MessagesDrawer } from "@/components/oventric/MessagesDrawer";
import { useUnreadCounts } from "@/hooks/use-unread-counts";

type Props = {
  searchOpen: boolean;
  onToggleSearch: () => void;
};

/**
 * App-shell newsfeed chrome: brand header, For you / Following / Discover
 * tabs. Stories have been retired from the Newsfeed.
 */
export function FeedAppChrome({
  searchOpen,
  onToggleSearch,
}: Props) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [msgOpen, setMsgOpen] = useState(false);
  const unreadNotifs = useUnreadNotificationsCount();
  const { messages } = useUnreadCounts();

  return (
    <div
      className="-mx-4 z-30 overflow-hidden border-b border-white/10 bg-[#070A08]/95 backdrop-blur-xl md:mx-0 md:rounded-[10px] md:border"
    >
      {/* Brand header — stays pinned; only fades slightly on scroll down */}
      <div>
        <div className="min-h-0">
        <div className="flex items-center gap-2 px-4 pb-2 pt-1 md:px-5 md:pt-3">
        <Link
          to="/"
          aria-label="Back to home"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-white/75 transition-colors hover:bg-white/5 hover:text-white active:scale-95"
        >
          <ArrowLeft className="h-[22px] w-[22px]" strokeWidth={1.8} />
        </Link>
        <img loading="lazy" decoding="async" src={logoFull} alt="Oventric" className="h-7 w-auto shrink-0" />
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={onToggleSearch}
            aria-label="Search"
            className={`grid h-11 w-11 place-items-center rounded-full transition-colors active:scale-95 ${
               searchOpen ? "bg-[#FF3EB5]/15 text-[#FF3EB5]" : "text-white/75 hover:bg-white/5 hover:text-white"
            }`}
          >
            <Search className="h-[22px] w-[22px]" strokeWidth={1.8} />
          </button>
          <button
            type="button"
            onClick={() => setNotifOpen(true)}
            aria-label="Notifications"
            className="relative grid h-11 w-11 place-items-center rounded-full text-white/75 transition-colors hover:bg-white/5 hover:text-white active:scale-95"
          >
            <Bell className="h-[22px] w-[22px]" strokeWidth={1.8} />
            <CountBadge count={unreadNotifs} ariaLabel={`${unreadNotifs} new notifications`} />
          </button>
          <button
            type="button"
            onClick={() => setMsgOpen(true)}
            aria-label="Messages"
            className="relative grid h-11 w-11 place-items-center rounded-full text-white/75 transition-colors hover:bg-white/5 hover:text-white active:scale-95"
          >
            <MessageSquare className="h-[22px] w-[22px]" strokeWidth={1.8} />
            <CountBadge count={messages ?? 0} ariaLabel={`${messages ?? 0} unread messages`} />
          </button>
          <div className="ml-1">
            <ProfileDropdown trigger="mega" />
          </div>

        </div>
        </div>
        </div>
      </div>
      <div className="h-px w-full bg-white/[0.07]" />

      <NotificationsDrawer open={notifOpen} onClose={() => setNotifOpen(false)} />
      <MessagesDrawer open={msgOpen} onClose={() => setMsgOpen(false)} />
    </div>
  );
}
