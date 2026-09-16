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
      className="relative inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 h-10 text-sm font-bold text-slate-700 hover:border-slate-300 hover:text-slate-900 transition-colors active:scale-95"
    >
      <span className="relative">
        <Icon className="w-4 h-4" />
        <CountBadge count={count ?? 0} ariaLabel={`${count ?? 0} new ${label}`} />
      </span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  );

  return (
    <>
      <div className="sticky top-0 z-20 border-b border-slate-100 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1200px] items-center gap-2 overflow-x-auto px-4 py-3 sm:px-6">
          <Link
            to="/"
            aria-label="Back to home"
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 transition-colors hover:border-slate-300 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Home</span>
          </Link>
          <h1 className="mr-auto shrink-0 text-base font-black text-slate-900 sm:text-lg">
            Newsfeed
          </h1>
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
        </div>
      </div>

      <NotificationsDrawer open={notifOpen} onClose={() => setNotifOpen(false)} />
      <RequestsInboxDrawer
        open={reqOpen}
        onClose={() => setReqOpen(false)}
        initialTab={reqTab}
      />
    </>
  );
}
