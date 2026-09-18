/**
 * Display labels for wallet transaction types.
 *
 * The database enum still carries legacy values (bounty / affiliate era). We keep
 * those rows intact for history, but the active wallet UI never shows the legacy
 * wording — it renders these neutral labels instead.
 */
import type { Database } from "@/integrations/supabase/types";

export type WalletTxTypeValue = Database["public"]["Enums"]["wallet_tx_type"];

const LABELS: Partial<Record<string, string>> = {
  "Affiliate Cashback Payout": "Cashback Payout",
  "Cashback Earned": "Cashback Earned",
  "Gig Bounty Escrowed": "Escrow Hold",
  "Bounty Payout": "Escrow Release",
  "Bounty Refund": "Escrow Refund",
  "Bounty To Main": "Moved to Main Balance",
  "Wallet Transfer Sent": "Wallet Transfer (Sent)",
  "Wallet Transfer Received": "Wallet Transfer (Received)",
};

export function walletTxLabel(type: string): string {
  return LABELS[type] ?? type;
}
