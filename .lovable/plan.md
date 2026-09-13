# Newsfeed-first home redesign

## What will change
- Replace the old Hub landing screen with the live Newsfeed on `/` after onboarding.
- Rebuild the feed header, greeting, creation prompt, content chips, stories, tabs, post cards, and mobile navigation around the approved social-commerce direction.
- Use the locked near-black, charcoal, hot-pink, and electric-lime palette with bold product typography.
- Keep all existing post, story, search, notification, message, commerce, and creation behavior working.
- Adapt the mobile stack into a restrained, centered desktop layout rather than stretching it.

## Technical details
- Update `AppSurface` section routing so Home resolves to Feed and no longer renders Home Hub.
- Consolidate the feed’s browser and installed-app presentation into the selected dark visual system.
- Add semantic feed design tokens and load the approved fonts through the document head.
- Update bottom navigation labels and active styling to match the new home/feed model.
- Verify type safety and visually inspect the root and `/feed` on mobile and desktop.
