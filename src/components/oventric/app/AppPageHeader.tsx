import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Bell, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationsDrawer } from "@/components/oventric/NotificationsDrawer";
import { useUnreadCounts } from "@/hooks/use-unread-counts";
import { haptic } from "@/lib/haptics";
import logoFull from "@/assets/oventric-full-transparent.png";

const TITLES: Record<string, string> = {
  Feed: "Newsfeed", Marketplace: "Market", Explore: "Explore",
  Wallet: "Wallet", Purchases: "Purchases", Profile: "Account",
};

// Sub-screens reached from Home/nav get a back-to-previous button instead of the avatar.
const BACK_SECTIONS = new Set(["Explore", "Wallet", "Purchases", "Profile"]);

export function AppPageHeader({ section, name, avatarUrl, onBack, onOpenAccount, onOpenMessages }: {
  section: string;
  name: string;
  avatarUrl: string | null;
  onBack: () => void;
  onOpenAccount: () => void;
  onOpenMessages: () => void;
}) {
  const { messages, total } = useUnreadCounts();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const firstName = name.split(" ")[0] || "there";
  const showBrand = section === "Marketplace" || section === "Feed";
  const showBack = BACK_SECTIONS.has(section);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <>
      <header className="app-shell-header relative z-50 flex h-[calc(3.5rem+env(safe-area-inset-top))] shrink-0 items-center gap-3 border-b border-white/10 bg-[#070A08] px-4 pt-[env(safe-area-inset-top)] text-white">
        {showBrand ? (
          <Link to="/" aria-label="Oventric home" className="nav-tap flex min-w-0 flex-1 items-center">
            <img src={logoFull} alt="Oventric" className="h-8 w-auto max-w-full object-contain" />
          </Link>
        ) : (
          <>
            {showBack ? (
              <Button variant="ghost" size="icon" onClick={() => { haptic("select"); onBack(); }} aria-label="Back" className="nav-tap h-10 w-10 shrink-0 rounded-full border border-white/10 bg-white/[0.06] p-0 text-white/80 hover:bg-white/10 hover:text-white">
                <ArrowLeft className="h-[18px] w-[18px]" />
              </Button>
            ) : (
               <Button variant="ghost" size="icon" onClick={() => { haptic("select"); onOpenAccount(); }} aria-label="Open account menu" className="nav-tap h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/[0.06] p-0 text-white/70 hover:bg-white/10 hover:text-white">
                {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : <span className="text-sm font-bold">{firstName.slice(0, 1).toUpperCase()}</span>}
              </Button>
            )}
            <div className="min-w-0 flex-1">
              {section === "Home" ? <><p className="text-[11px] font-medium text-white/40">{greeting},</p><p className="truncate text-[15px] font-bold">{firstName}</p></> : <p className="truncate text-[17px] font-bold">{TITLES[section] ?? section}</p>}
            </div>
          </>
        )}
        <Button variant="ghost" size="icon" onClick={() => { haptic("select"); onOpenMessages(); }} aria-label="Chats" className="nav-tap relative h-10 w-10 rounded-full border border-white/10 bg-white/[0.06] text-white/80 hover:bg-white/10 hover:text-white">
          <MessageCircle className="h-[18px] w-[18px]" />
          {(messages ?? 0) > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">{messages}</span>}
        </Button>
        <Button variant="ghost" size="icon" onClick={() => { haptic("select"); setNotificationsOpen(true); }} aria-label="Notifications" className="nav-tap relative h-10 w-10 rounded-full border border-white/10 bg-white/[0.06] text-white/80 hover:bg-white/10 hover:text-white">
          <Bell className="h-[18px] w-[18px]" />
          {(total ?? 0) > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">{total}</span>}
        </Button>
      </header>
      <NotificationsDrawer open={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
    </>
  );
}