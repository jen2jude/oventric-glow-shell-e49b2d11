import { type ReactNode, useState } from "react";
import { Header } from "@/components/oventric/Header";
import { HubMobileHeader } from "@/components/oventric/HubMobileHeader";
import { MessagesDrawer } from "@/components/oventric/MessagesDrawer";
import { useIsDesktop } from "@/hooks/use-desktop";
import { useIsAppShell } from "@/hooks/use-launch-context";

/**
 * Shared site chrome for standalone routes (blog, profile, etc.).
 * The mobile footer nav is rendered globally in __root.tsx, so this
 * wrapper only provides the header and messages drawer.
 *
 * `lightDesktop` opts the page into the white desktop theme used by
 * Academy / Bounties / Circles (mobile stays dark).
 *
 * `hubMobileHeader` swaps the default header for the Home Hub mobile header
 * when the page is viewed inside the app shell on a narrow viewport.
 */
export function PublicChrome({
  children,
  active: _active = "",
  lightDesktop = false,
  hubMobileHeader = false,
  avatarUrl,
  name,
}: {
  children: ReactNode;
  active?: string;
  lightDesktop?: boolean;
  hubMobileHeader?: boolean;
  avatarUrl?: string | null;
  name?: string;
}) {
  const [messagesOpen, setMessagesOpen] = useState(false);
  const isDesktop = useIsDesktop();
  const isAppShell = useIsAppShell();
  const useHubHeader = hubMobileHeader && isAppShell && !isDesktop;

  return (
    <div
      className={`page-light relative min-h-screen w-full max-w-full overflow-x-hidden bg-[#121214] md:bg-slate-50 text-slate-200 md:text-slate-700 flex flex-col ${
        lightDesktop ? "md:bg-white md:text-slate-700" : ""
      }`}
    >
      {useHubHeader ? (
        <HubMobileHeader avatarUrl={avatarUrl} name={name} />
      ) : (
        <Header
          onOpenMessages={() => setMessagesOpen(true)}
          light={lightDesktop || !isDesktop}
          desktopNav={isDesktop}
          browserVisitorHeader={!isDesktop}
          forceSiteNavbar={!isAppShell}
        />
      )}
      <main className="flex-1 min-w-0 w-full max-w-full overflow-x-hidden pb-20 md:pb-0">
        {children}
      </main>
      <MessagesDrawer open={messagesOpen} onClose={() => setMessagesOpen(false)} />
    </div>
  );
}
