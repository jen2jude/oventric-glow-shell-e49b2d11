import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Bell, MessageSquare, UserPlus, Users } from "lucide-react";
import { CountBadge } from "@/components/oventric/CountBadge";
import {
  NotificationsDrawer,
  useUnreadNotificationsCount,
} from "@/components/oventric/NotificationsDrawer";
import { RequestsInboxDrawer } from "@/components/oventric/RequestsInboxDrawer";
import { useUnreadCounts } from "@/hooks/use-unread-counts";

type Props = {
  /** Opens the shared messages drawer owned by the page shell. */
  onOpenMessages: () => void;
};

/**
 * Social management toolbar shown above the newsfeed for browser visitors.
 * Gives quick access to notifications, chats, follow requests and circle
 * requests without the app-shell header.
 */
export function FeedSocialBar({ onOpenMessages }: Props) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [reqOpen, setReqOpen] = useState(false);
  const [reqTab, setReqTab] = useState<"follow" | "circle">("follow");

  const unreadNotifs = useUnreadNotificationsCount();
  const { messages, sections } = useUnreadCounts();
  const circleCount = sections?.["Circles"] ?? 0;

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
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 active:scale-95"
    >
      <span className="relative">
        <Icon className="h-[18px] w-[18px]" />
        <CountBadge count={count ?? 0} ariaLabel={`${count ?? 0} new ${label}`} />
      </span>
    </button>
  );

  return (
    <>
      <nav className="sticky top-0 z-40 flex w-fit max-w-full self-start items-center gap-1 overflow-x-auto rounded-full border border-slate-200 bg-white/95 p-1.5 shadow-sm backdrop-blur-md no-scrollbar">
        <Link
          to="/"
          aria-label="Back to home"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-slate-50 px-4 py-1.5 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-100"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>
        <h1 className="shrink-0 rounded-full bg-[#E5484D] px-4 py-1.5 text-sm font-medium text-white">
          Newsfeed
        </h1>
        <span aria-hidden className="mx-1 h-4 w-px shrink-0 bg-slate-200" />
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
          onClick={() => {
            setReqTab("follow");
            setReqOpen(true);
          }}
        />
        <Item
          icon={Users}
          label="Circle requests"
          count={circleCount}
          onClick={() => {
            setReqTab("circle");
            setReqOpen(true);
          }}
        />
      </nav>


      <NotificationsDrawer open={notifOpen} onClose={() => setNotifOpen(false)} />
      <RequestsInboxDrawer
        open={reqOpen}
        onClose={() => setReqOpen(false)}
        initialTab={reqTab}
      />
    </>
  );
}
