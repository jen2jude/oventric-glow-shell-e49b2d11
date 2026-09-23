# Purchase confirmation and instant-delivery completion

## What will change
- Stop automatically opening or downloading a paid digital product after payment confirmation.
- Keep the download available through the prominent **Your download** action on the confirmation page and through **My purchases**.
- Treat instant-download orders as fully delivered and confirmed in the visible fulfilment journey once payment is verified, so every delivery step shows complete without requiring buyer action.
- Redesign the purchase confirmation page with Oventric’s Bright Spectrum signature: white surfaces, the multicolour category strip, green success treatment, blue/violet/gold/coral accents, clean light details, and compact mobile spacing.
- Preserve the separate manual-delivery flow, escrow controls, disputes, seller chat, free downloads, signed-link expiry, and all existing payment rules.

## Confirmation page structure
- A clear payment-success header with the order reference and a concise reassurance that the asset is ready.
- A strong download section near the top, with one deliberate download/open-link action rather than an automatic browser action.
- A completed instant-delivery journey showing payment, delivery, receipt, and completion as successful at the payment-confirmed time.
- A clean receipt summary plus clear links to **My purchases** and seller support/chat.
- The existing manual-delivery confirmation state remains workflow-specific and will not be falsely marked complete.

## Technical details
- Remove the session-based automatic-download effect from the order confirmation route.
- In the fulfilment presentation, derive effective instant-delivery timestamps from `paidAt`/`createdAt` when manual delivery is not required; keep database timestamps authoritative for manual-delivery orders.
- Use existing `newsfeed-*` semantic tokens and the shared button component instead of adding a new palette or changing financial settlement logic.

## Verification
- Confirm a paid instant-download order does not open a new tab or start a download on page load.
- Confirm its four fulfilment steps and delivery timeline all show complete.
- Confirm the download button works and the same order remains downloadable from My purchases.
- Confirm manual-delivery orders retain escrow and confirmation actions.
- Check desktop and mobile layouts for readable content, working links, no overflow, and no console errors.
