# Creator Hub visual-system correction

## Goal
Keep Creator Hub consistent with Oventric’s two established experiences:
- **App:** compact, dark, distinctive, touch-first, with restrained crimson emphasis and slide-up sheets where appropriate.
- **Website:** white UI with the multicolour accent system.

## Changes
1. Separate Creator Hub presentation by app versus website without changing its data, permissions, navigation, or publishing logic.
2. Remove the multicolour strip, rotating section colours, coloured avatar rings, and other Bright Spectrum treatments from the app view.
3. Restyle the app header, search, tabs, creator rows, content cards, empty states, and loading state using the existing dark app language and restrained crimson accents.
4. Keep the website’s white layout and multicolour accents unchanged.
5. Make Creator setup and “Share your work” use compact dark app-native slide-up sheets in app mode; retain their current light website presentation in web mode.
6. Preserve post opening, creator profiles, following, resources, search, authentication gates, and publication behavior exactly as they work now.
7. Record this app-versus-website split as the governing rule for future Creator Hub stages.

## Verification
- Check Creator Hub at phone size in app mode and verify dark, compact presentation with no multicolour treatment.
- Open Creator setup and publishing flows in app mode and verify dark slide-up behavior and internal scrolling.
- Check the website Creator Hub and verify its white multicolour treatment remains intact.
- Confirm navigation, search, tabs, post opening, and build output remain healthy.

## Technical details
- Reuse `useIsAppShell()` to select presentation only; no new data path or business logic.
- Keep shared Creator Hub queries and actions unchanged.
- Use existing Oventric app shell patterns, safe-area handling, scroll locking, and app sheet behavior.
