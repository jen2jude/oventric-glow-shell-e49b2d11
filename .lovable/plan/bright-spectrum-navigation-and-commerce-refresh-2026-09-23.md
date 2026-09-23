# Bright Spectrum navigation and commerce refresh

## What will change
- Remove **Wallet** from the desktop header navigation only. Keep Wallet available in mobile navigation and account menus.
- Refresh the mobile hamburger and account/profile menus with white surfaces, a multicolour accent strip, category-colour icon tiles, and clear light controls.
- Refresh the notifications drawer and connections browser with the same spectrum header, colour-coded tabs/statuses, light cards, and readable mobile layouts.
- Add Bright Spectrum identity to the web marketplace through the page header, search/filter controls, seller and product sections, while preserving the current catalogue structure and functionality.
- Refresh **My Purchases** inside the dashboard with a colourful section heading, status-aware badges, clean light purchase cards, and matching action buttons.

## Behaviour preserved
- Existing routes, checkout, downloads, order tracking, follow actions, notifications, and menu destinations remain unchanged.
- No backend, financial, or marketplace logic changes.
- Mobile Wallet access remains available.

## Verification
- Check desktop header navigation and confirm Wallet is absent only there.
- Check hamburger, account menu, notifications, connections, marketplace, and My Purchases on desktop and mobile.
- Confirm menus, tabs, search, links, and purchase actions still work without overflow or console errors.

## Technical details
- Reuse the existing `newsfeed-*` Bright Spectrum tokens and `about-spectrum` treatment rather than introducing a new palette.
- Scope visual token remaps to each requested surface so unrelated pages are unaffected.
