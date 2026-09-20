# Suggested people in Newsfeed and Discovery

## Build
- Add a reusable horizontal “People you may know” rail with up to 10 profile cards.
- Each card opens the person’s profile and provides two side-by-side actions: **See shop** and **Follow**.
- Insert the rail into the main Newsfeed after every 12 posts, rotating the suggested people when enough profiles are available.
- Add the same richer suggestion rail to the Discovery view, replacing the current avatar-only creator strip.

## Behavior
- Use real Oventric profiles and existing follow controls; exclude the signed-in user and people they already follow where possible.
- Show **See shop** only for profiles with an active storefront; otherwise use the full width for **Follow**.
- Keep the rail swipeable on phones, horizontally scrollable on larger screens, and limited to 10 suggestions.
- Preserve all existing post, commerce-card, profile, and shop behavior.

## Technical details
- Extend the existing discovery response with the minimum seller/shop availability data needed by the cards.
- Build one shared suggestion-rail component for both Newsfeed and Discovery.
- Reuse the existing profile route, shop route, avatar handling, and authenticated follow function.

## Verification
- Type-check the touched files.
- Verify the Newsfeed insertion cadence and Discovery rail at phone and desktop widths.
- Confirm profile, shop, and follow actions work without overlapping or shifting the cards.
