import { SellAssetModal } from "./SellAssetModal";

/** Oventric is digital-only, so selling always opens the digital asset flow. */
export function SellSwitcherModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return <SellAssetModal open onClose={onClose} />;
}
