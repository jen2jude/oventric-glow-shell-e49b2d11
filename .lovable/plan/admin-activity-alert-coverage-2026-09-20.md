# Admin activity alert coverage

## Goal
Make every meaningful new platform event visible to the correct admin role without changing existing workflows or reactivating legacy systems.

## Build
- Audit every active admin section and map its real source of new work: signups, seller verification, products, orders, payments, payouts, refunds, disputes, reports, reviews, support, messages, referrals, and other active operational queues.
- Add one secure server-side activity summary that returns only counts allowed for the signed-in admin’s role. Financial and moderation data remain inaccessible to unauthorized roles.
- Track each admin’s last-seen time per section so alerts represent genuinely unseen activity, while unresolved action queues remain highlighted until handled.
- Replace the two isolated product/payout counters with a shared sidebar alert system: glowing navigation row, compact count badge, collapsed-sidebar dot, and accessible labels.
- Add matching attention states to the overview cards so new purchases, users, products, reports, and other actionable work are noticeable immediately.
- Mark a section seen when the admin opens it, refresh alerts periodically, and update promptly after navigation without page reloads.
- Exclude settings/static pages and all preserved-but-inaccessible legacy systems from alerts.

## Technical details
- Store per-admin section read markers in Lovable Cloud with authenticated grants, RLS, and admin-owned policies.
- Derive counts from trusted database timestamps/statuses; never accept activity counts from the browser.
- Keep current role-based navigation and permissions authoritative.
- Verify types and test expanded/collapsed sidebar behavior plus overview alerts at desktop and mobile widths.
