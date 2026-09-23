import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Bell, MessageSquare, Search, UserPlus } from "lucide-react";
import logoDark from "@/assets/oventric-logo-dark.png";
import { CountBadge } from "@/components/oventric/CountBadge";
import { ProfileDropdown } from "@/components/oventric/ProfileDropdown";
import {
  NotificationsDrawer,
  useUnreadNotificationsCount,
} from "@/components/oventric/NotificationsDrawer";
import { RequestsInboxDrawer } from "@/components/oventric/RequestsInboxDrawer";
import { useUnreadCounts } from "@/hooks/use-unread-counts";
import { Button } from "@/components/ui/button";

type Props = {
  /** Opens the shared messages drawer owned by the page shell. */
  onOpenMessages: () => void;
  onOpenSearch: () => void;
};

/**
 * Social management toolbar shown above the newsfeed for browser visitors.
 * Gives quick access to notifications, chats and follow requests without
 * the app-shell header.
 */
export function FeedSocialBar({ onOpenMessages, onOpenSearch }: Props) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [reqOpen, setReqOpen] = useState(false);

  const unreadNotifs = useUnreadNotificationsCount();
  const { messages } = useUnreadCounts();

  const Item = ({
    icon: Icon,
    label,
    count,
    onClick,
  }: {
    icon: typeof Bell;
    label: string;
    count?: number;
    onClick: () => void;
  }) => (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="relative h-9 w-9 shrink-0 rounded-[10px] text-newsfeed-muted hover:bg-newsfeed-blue-soft hover:text-newsfeed-blue active:scale-95"
    >
      <span className="relative">
        <Icon className="h-[18px] w-[18px]" />
        <CountBadge count={count ?? 0} ariaLabel={`${count ?? 0} new ${label}`} />
      </span>
    </Button>
  );

  return (
    <>
      <header
        className="home-pop sticky top-0 z-40 -mx-4 -mt-6 grid h-[66px] grid-cols-[minmax(0,1fr)_auto] items-center border-b border-home-line bg-home-surface/95 px-4 shadow-home-soft backdrop-blur-xl md:-mx-6 md:-mt-10 md:h-[72px] md:px-6 lg:hidden"
      >
        <Link to="/" aria-label="Oventric home" className="flex min-w-0 items-center">
          <img loading="lazy" decoding="async"
            src={logoDark}
            alt="Oventric"
            className="h-8 w-auto max-w-[132px] object-contain object-left md:h-9 md:max-w-[154px]"
          />
        </Link>

        <div className="flex shrink-0 items-center gap-2 md:gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onOpenSearch}
            aria-label="Search"
            title="Search"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] border border-home-line bg-sky-50 text-sky-600 shadow-sm transition-transform active:scale-95 md:h-11 md:w-11"
          >
            <Search className="h-[19px] w-[19px]" strokeWidth={1.9} />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setNotifOpen(true)}
            aria-label="Notifications"
            title="Notifications"
            className="relative h-10 w-10 shrink-0 rounded-[10px] border-newsfeed-line bg-newsfeed-violet-soft text-newsfeed-violet shadow-sm active:scale-95 md:h-11 md:w-11"
          >
            <Bell className="h-[19px] w-[19px]" strokeWidth={1.9} />
            <CountBadge count={unreadNotifs} ariaLabel={`${unreadNotifs} new notifications`} />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onOpenMessages}
            aria-label="Chats"
            title="Chats"
            className="relative h-10 w-10 shrink-0 rounded-[10px] border-newsfeed-line bg-newsfeed-green-soft text-newsfeed-green shadow-sm active:scale-95 md:h-11 md:w-11"
          >
            <MessageSquare className="h-[19px] w-[19px]" strokeWidth={1.9} />
            <CountBadge count={messages} ariaLabel={`${messages} unread chats`} />
          </Button>
          <div className="ml-1 shrink-0">
            <ProfileDropdown trigger="mega" />
          </div>
        </div>
      </header>

      <nav
        className="z-40 hidden h-14 w-full max-w-full items-center gap-1 overflow-x-auto border-b border-newsfeed-line bg-newsfeed-surface/95 px-3 backdrop-blur-md no-scrollbar lg:sticky lg:top-0 lg:flex"
      >
        <Link
          to="/"
          aria-label="Back to home"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-[10px] px-2.5 py-2 text-sm font-semibold text-newsfeed-muted transition-colors hover:bg-newsfeed-blue-soft hover:text-newsfeed-blue"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>
        <span className="ml-2 mr-auto font-wallet-display text-base font-bold text-newsfeed-ink">For You</span>
        <Item icon={Search} label="Search" onClick={onOpenSearch} />
        <Item
          icon={Bell}
          label="Notifications"
          count={unreadNotifs}
          onClick={() => setNotifOpen(true)}
        />
        <Item icon={MessageSquare} label="Chats" count={messages} onClick={onOpenMessages} />
        <Item
          icon={UserPlus}
          label="Follow requests"
          onClick={() => setReqOpen(true)}
        />
      </nav>


      <NotificationsDrawer open={notifOpen} onClose={() => setNotifOpen(false)} />
      <RequestsInboxDrawer open={reqOpen} onClose={() => setReqOpen(false)} />
    </>
  );
}
