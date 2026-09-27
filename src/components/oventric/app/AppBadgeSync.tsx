import { useEffect } from "react";
import { useUnreadCounts } from "@/hooks/use-unread-counts";

type BadgeNav = Navigator & {
  setAppBadge?: (n?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

/**
 * Keeps the home-screen app icon badge in step with unread notifications +
 * unread chats while the app is open. The push worker sets it while closed.
 */
export function AppBadgeSync() {
  const { total, messages } = useUnreadCounts();
  useEffect(() => {
    const nav = navigator as BadgeNav;
    if (!nav.setAppBadge) return;
    const n = (total ?? 0) + (messages ?? 0);
    const p = n > 0 ? nav.setAppBadge(n) : nav.clearAppBadge?.();
    p?.catch(() => {});
  }, [total, messages]);
  return null;
}
