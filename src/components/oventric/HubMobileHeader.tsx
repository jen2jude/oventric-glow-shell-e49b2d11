import { useState } from "react";
import { Bell } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { AvatarImage } from "@/components/oventric/AvatarImage";
import { CountBadge } from "@/components/oventric/CountBadge";
import { MegaMenu } from "@/components/oventric/MegaMenu";
import {
  NotificationsDrawer,
  useUnreadNotificationsCount,
} from "@/components/oventric/NotificationsDrawer";
import { useAuthGate } from "@/lib/auth-gate/AuthGateProvider";
import logoFull from "@/assets/oventric-full-transparent.png";

/**
 * The standard mobile app header used on the Home Hub:
 * centered logo, notification bell, and profile avatar that opens the mega menu.
 * Rendered on dark surfaces inside the app shell.
 */
export function HubMobileHeader({
  avatarUrl,
  name,
}: {
  avatarUrl?: string | null;
  name?: string;
}) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const unreadNotifs = useUnreadNotificationsCount();
  const { isAuthenticated, openGate } = useAuthGate();

  return (
    <>
      <section className="flex items-center gap-3 px-3 pt-4 pb-2">
        <Link to="/" aria-label="Oventric home" className="shrink-0">
          <img
            loading="lazy"
            decoding="async"
            src={logoFull}
            alt="Oventric"
            className="h-7 w-auto shrink-0"
          />
        </Link>

        <div className="ml-auto flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => (isAuthenticated ? setNotifOpen(true) : openGate("generic"))}
            aria-label="Notifications"
            className="relative h-11 w-11 flex items-center justify-center rounded-full bg-[#141416] border border-white/5 text-white/70 active:scale-95 transition-transform"
          >
            <Bell className="w-5 h-5" strokeWidth={2} />
            <CountBadge count={unreadNotifs} ariaLabel={`${unreadNotifs} new notifications`} />
          </button>

          <button
            type="button"
            onClick={() => (isAuthenticated ? setMegaOpen(true) : openGate("generic"))}
            aria-label="Your profile menu"
            className="h-11 w-11 rounded-full overflow-hidden border border-white/10 shrink-0 active:scale-95 transition-transform bg-[#141416]"
          >
            <AvatarImage src={avatarUrl} alt={name || "You"} />
          </button>
        </div>
      </section>

      <MegaMenu open={megaOpen} onClose={() => setMegaOpen(false)} />
      <NotificationsDrawer open={notifOpen} onClose={() => setNotifOpen(false)} />
    </>
  );
}
