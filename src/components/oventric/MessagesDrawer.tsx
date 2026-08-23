import { useEffect } from "react";
import { X } from "lucide-react";
import { Messages } from "./Messages";

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
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className="modal-light fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
      />
      {/* Drawer */}
      <aside
        role="dialog"
        aria-label="Messages"
        aria-modal="true"
        className="fixed z-50 top-0 right-0 h-full h-[100dvh] w-full md:w-[880px] max-w-full bg-[#121214] border-l border-white/10 shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col"

      >
        <div className="flex items-center justify-between h-12 shrink-0 px-4 border-b border-white/10 bg-[#16161B]">
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-widest font-black text-emerald-400">
              Secure Channel
            </span>
            <span className="text-xs text-slate-400">P2P Messaging Hub</span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close messages drawer"
            className="p-1.5 rounded-[10px] text-slate-400 hover:text-white hover:bg-white/5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 min-h-0">
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
