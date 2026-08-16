import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, Menu } from "lucide-react";
import logoFull from "@/assets/oventric-full-transparent.png";
import { MegaMenu } from "@/components/oventric/MegaMenu";
import {
  NotificationsDrawer,
  useUnreadNotificationsCount,
} from "@/components/oventric/NotificationsDrawer";

/**
 * Shared app-shell sticky header (same chrome as the Sovereign Wallet):
 * menu on the left, brand mark centred, notifications on the right.
 * `right` allows a page to append an extra action next to the bell.
 */
export function AppStickyHeader({ right }: { right?: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const unreadNotifs = useUnreadNotificationsCount();

  return (
    <>
      <header className="sticky top-0 z-40 bg-[#0A0A0B] px-4 h-14 flex items-center justify-between">
        <button
          aria-label="Menu"
          onClick={() => setMenuOpen(true)}
          className="text-white/80 hover:text-white active:scale-95 transition-transform"
        >
          <Menu className="w-6 h-6" />
        </button>
        <Link to="/" className="flex items-center">
          <img src={logoFull} alt="Oventric" className="h-6 w-auto" />
        </Link>
        <div className="flex items-center gap-4">
          <button
            aria-label="Notifications"
            onClick={() => setNotifOpen(true)}
            className="relative text-white/80 hover:text-white active:scale-95 transition-transform"
          >
            <Bell className="w-5 h-5" />
            {unreadNotifs > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#E5484D]" />
            )}
          </button>
          {right}
        </div>
      </header>

      <MegaMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
      <NotificationsDrawer open={notifOpen} onClose={() => setNotifOpen(false)} />
    </>
  );
}
