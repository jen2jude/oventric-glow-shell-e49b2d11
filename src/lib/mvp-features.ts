/**
 * Oventric MVP feature lock.
 *
 * The MVP is a digital-goods marketplace: marketplace, checkout, wallet,
 * orders/escrow, feed, profiles, referrals and admin.
 *
 * Everything listed as `false` below is a legacy system whose code is kept
 * in the repository for possible future reactivation, but which must NOT be
 * reachable from any active customer, seller or financial workflow.
 *
 * Every retained legacy server function that could mutate data (especially
 * anything touching wallets, escrow, ledger or platform revenue) calls
 * `assertLegacyFeatureDisabled()` so it fails closed even if a client is
 * hand-crafted or an old bundle is replayed.
 */

export const MVP_FEATURES = {
  marketplace: true,
  wallet: true,
  orders: true,
  feed: true,
  referrals: true,

  /** Legacy — not part of the MVP. */
  academy: false,
  bounties: false,
  circles: false,
  affiliate: false,
  campaigns: false,
  adsManager: false,
  blogMonetization: false,
  toolsLibrary: false,
  reseller: false,
} as const;

export type MvpFeature = keyof typeof MVP_FEATURES;

export function isFeatureActive(feature: MvpFeature): boolean {
  return MVP_FEATURES[feature];
}

export const LEGACY_FEATURE_MESSAGE =
  "This feature is not available on Oventric.";

/** Fail closed: throws whenever a paused legacy feature is invoked. */
export function assertLegacyFeatureDisabled(feature: MvpFeature): void {
  if (!MVP_FEATURES[feature]) throw new Error(LEGACY_FEATURE_MESSAGE);
}
