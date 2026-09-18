import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Plus, ArrowUp, Wallet as WalletIcon } from "lucide-react";

interface WalletDetailModalProps {
  open: boolean;
  onClose: () => void;
  balanceLabel: string;
  cashbackLabel: string;
  escrowLabel: string;
  onAddFunds: () => void;
  onWithdraw: () => void;
}

export function WalletDetailModal({
  open,
  onClose,
  balanceLabel,
  cashbackLabel,
  escrowLabel,
  onAddFunds,
  onWithdraw,
}: WalletDetailModalProps) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] grid h-[100dvh] w-screen place-items-end sm:place-items-center overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wallet-detail-title"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="slide-up relative w-full sm:max-w-[360px] bg-[#141416] border border-white/[0.08] rounded-t-[20px] sm:rounded-[18px] p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <WalletIcon className="w-4 h-4 text-emerald-400" strokeWidth={2} />
            </div>
            <h2 id="wallet-detail-title" className="text-[15px] font-bold text-white">
              Oventric Wallet
            </h2>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-full bg-white/[0.04] text-white/50 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-1 mb-5">
          <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">
            Available Balance
          </div>
          <div className="text-[34px] font-black tracking-tight text-white tabular-nums leading-none">
            {balanceLabel}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 mb-5">
          <button
            onClick={onAddFunds}
            className="h-11 flex items-center justify-center gap-1.5 rounded-[10px] bg-[#E5484D] text-white text-[13px] font-bold active:scale-[0.97] transition-all shadow-[0_8px_20px_rgba(229,72,77,0.25)]"
          >
            <Plus className="w-4 h-4" strokeWidth={3} /> Fund Wallet
          </button>
          <button
            onClick={onWithdraw}
            className="h-11 flex items-center justify-center gap-1.5 rounded-[10px] bg-white/[0.05] border border-white/10 text-white/90 text-[13px] font-bold active:scale-[0.97] transition-all"
          >
            <ArrowUp className="w-4 h-4" strokeWidth={2.5} /> Withdraw
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-4 border-t border-white/[0.06]">
          <div className="space-y-0.5">
            <div className="text-[9px] font-bold uppercase tracking-widest text-white/25">Cashback</div>
            <div className="text-[13px] font-bold text-emerald-400 truncate">{cashbackLabel}</div>
          </div>
          <div className="space-y-0.5">
            <div className="text-[9px] font-bold uppercase tracking-widest text-white/25">Escrow</div>
            <div className="text-[13px] font-bold text-rose-400 truncate">{escrowLabel}</div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
