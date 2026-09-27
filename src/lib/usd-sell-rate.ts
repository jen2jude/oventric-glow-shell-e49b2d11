/**
 * USD withdrawal pricing. Wallets live in the home currency; withdrawing in
 * USD means the user buys dollars from Oventric at a sell rate that is
 * USD_SELL_MARGIN worse than the live mid-market rate. The usual withdrawal
 * fee is deducted in home currency first.
 */
export const USD_SELL_MARGIN = 0.05;
export const USD_MIN_WITHDRAWAL = 5;

/** Home-currency units per 1 USD that the user pays. */
export function usdSellRate(midRate: number): number {
  return midRate * (1 + USD_SELL_MARGIN);
}

/** USD the user receives for a home-currency amount after fee, at the sell rate. */
export function usdReceived(localAmount: number, fee: number, midRate: number): number {
  const sell = usdSellRate(midRate);
  if (!(sell > 0)) return 0;
  return Math.max(0, Math.floor(((localAmount - fee) / sell) * 100) / 100);
}
