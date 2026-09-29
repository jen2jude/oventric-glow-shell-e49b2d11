# App Help Center Rebuild

## Goal
Give `/help` a compact, native dark app experience while preserving the existing light website Help Center unchanged.

## What will change
- Detect app mode on the Help route and render a dedicated app-only support page.
- Add a fixed app-style Help header with a clear back action.
- Organize support into compact topic rows for account, purchases, selling, wallet, creators, and order support.
- Keep FAQs and Report a Problem as the primary support paths, using typed links to their existing pages.
- Present key digital-order, transaction, payout, and safety guidance in concise dark app panels.
- Ensure the app page scrolls independently and remains clear on phone and tablet screens.

## Technical details
- Reuse the existing app-shell detection, button component, route links, metadata, and Help content.
- Change presentation only; no support, order, wallet, authentication, or website logic will be altered.
- Preserve the current website Help Center exactly as the browser view.
- Verify app and website rendering, scrolling, links, and current build health.
