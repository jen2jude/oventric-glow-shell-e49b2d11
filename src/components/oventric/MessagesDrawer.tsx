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
        className="fixed inset-0 z-[70] bg-chat-backdrop backdrop-blur-[2px]"
      />
      {/* Drawer */}
      <aside
        role="dialog"
        aria-label="Messages"
        aria-modal="true"
        className="web-chat fixed inset-y-0 right-0 z-[80] flex h-[100dvh] max-h-[100dvh] w-full max-w-full flex-col overflow-hidden border-l border-chat-line bg-chat-canvas shadow-[var(--chat-drawer-shadow)] animate-in slide-in-from-right duration-300 md:w-[min(1280px,94vw)] md:p-4 md:pl-5"

      >
        <div className="relative flex h-14 shrink-0 items-center justify-between border-b border-chat-line bg-chat-surface px-5 md:hidden after:absolute after:inset-x-0 after:bottom-0 after:h-1 after:bg-[var(--chat-spectrum)]">
          <div className="flex items-center gap-3">
            <span className="font-wallet-display text-sm font-semibold text-chat-ink">Messages</span>
            <span className="hidden sm:inline-flex items-center rounded-full border border-chat-green/20 bg-chat-green-soft px-2.5 py-1 text-[10px] font-semibold text-chat-green">
              Secure conversations
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close messages drawer"
            className="inline-flex size-9 items-center justify-center rounded-[10px] text-chat-muted hover:bg-chat-coral-soft hover:text-chat-coral"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
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
