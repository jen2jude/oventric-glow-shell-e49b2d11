import { useEffect } from "react";
import { X } from "lucide-react";
import { Messages } from "./Messages";
import { setChatOpen } from "@/hooks/use-chat-open";


interface MessagesDrawerProps {
  open: boolean;
  onClose: () => void;
  initialThreadId?: string;
  onOpenEscrow?: (bountyId: string) => void;
}

/**
 * Persistent quick-access split drawer:
 * - Slides in from the right on desktop as a wide split drawer
 * - Full-screen sheet on mobile
 */
export function MessagesDrawer({
  open,
  onClose,
  initialThreadId,
  onOpenEscrow,
}: MessagesDrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    // Hide the app's bottom navigation while chatting so the reply composer
    // is never covered by it on mobile.
    document.body.setAttribute("data-chat-open", "1");
    setChatOpen(true);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.removeAttribute("data-chat-open");
      setChatOpen(false);
    };
  }, [open, onClose]);


  if (!open) return null;


  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className="fixed inset-0 z-[70] bg-slate-950/35"
      />
      {/* Drawer */}
      <aside
        role="dialog"
        aria-label="Messages"
        aria-modal="true"
        className="web-chat fixed inset-y-0 right-0 z-[80] h-[100dvh] max-h-[100dvh] w-full max-w-full overflow-hidden border-l border-border bg-background shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col md:w-[min(1120px,92vw)]"

      >
        <div className="flex items-center justify-between h-14 shrink-0 px-5 border-b border-border bg-background">
          <div className="flex items-center gap-3">
            <span className="font-wallet-display text-sm font-semibold text-foreground">Messages</span>
            <span className="hidden sm:inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">
              Secure conversations
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close messages drawer"
            className="inline-flex size-9 items-center justify-center rounded-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-hidden">
          <Messages
            variant="compact"
            initialThreadId={initialThreadId}
            onOpenEscrow={onOpenEscrow}
            onClose={onClose}
          />
        </div>
      </aside>
    </>
  );
}
