# Homepage discovery additions

## Build
- Track recently opened, currently available digital products in the browser and show them above Shop by Category.
- Add a horizontal latest marketplace posts rail using recent feed posts that contain marketplace product attachments.
- Make both rails horizontally scrollable on phones and responsive multi-card rails on larger screens.
- Add a sticky four-item mobile footer: Home, Explore, Marketplace, Wallet, wired to the existing sections.

## Technical details
- Revalidate recently viewed product IDs through a public server function so removed, rejected, unpublished, or out-of-stock products never appear.
- Reuse the existing product cards, post data, routes, currency conversion, and navigation behavior.
- Keep desktop navigation unchanged and preserve the existing payment, marketplace, and legacy-feature architecture.

## Verification
- Run TypeScript checks and inspect the homepage at phone and desktop widths.
