import {
  Drawer,
  DrawerContent,
  DrawerOverlay,
  DrawerPortal,
} from "@/components/ui/drawer";

/**
 * Native app bottom sheet — the standard container for every sliding panel in
 * the app shell (product quick view, search, filters, wallet actions). Dark
 * crimson-glow styling, drag handle, edge-to-edge, dismisses by swiping down.
 */
export function AppSheet({
  open,
  onClose,
  children,
  tall = false,
  header,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Tall sheets rise to ~92% of the screen; default sheets hug content up to 80%. */
  tall?: boolean;
  /** Pinned above the scrollable body — stays put while children scroll. */
  header?: React.ReactNode;
}) {
  return (
    <Drawer repositionInputs={false} open={open} onOpenChange={(o) => !o && onClose()}>
      <DrawerPortal>
        <DrawerOverlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md" />
        <DrawerContent
          className={`fixed inset-x-0 bottom-0 z-50 mx-auto flex w-full max-w-xl flex-col rounded-t-3xl border border-b-0 border-white/10 bg-[#101013] text-white outline-none ${
            tall ? "h-[92dvh]" : "max-h-[85dvh]"
          }`}
        >
          {/* Drag handle */}
          <div className="mx-auto mt-2.5 mb-1 h-1.5 w-10 shrink-0 rounded-full bg-white/15" />
          {header && <div className="shrink-0">{header}</div>}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {children}
          </div>
        </DrawerContent>
      </DrawerPortal>
    </Drawer>
  );
}
