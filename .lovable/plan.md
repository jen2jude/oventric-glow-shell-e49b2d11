# Homepage access and storefront cleanup

## Changes
- Add **Newsfeed** to the website header navigation and mobile menu, linking to the existing feed.
- Add an accessible **Notifications** bell to the website header, using the existing authenticated notifications drawer and unread count; signed-out visitors will receive the existing sign-in prompt.
- Replace the seller storefront’s dark, empty top bar with the same clean light website header and full navigation used on the homepage.
- Remove the rendered **From the Oventric blog**, **Open bounties**, and **Academy courses** sections from seller storefronts without deleting their underlying routes or data.
- Restyle the storefront itself to a clean light web presentation so its header and content match the current website.

## Validation
- Check homepage and seller storefront navigation on desktop, tablet, and mobile.
- Confirm Newsfeed opens, Notifications opens or requests sign-in correctly, and the removed non-MVP storefront sections no longer appear.
- Confirm there are no page errors or horizontal overflow.

## Technical details
- Reuse the existing `SiteNavbar`, `NotificationsDrawer`, unread-count hook, authentication gate, and semantic design tokens.
- Keep marketplace, wallet, payment, and seller data behavior unchanged.
