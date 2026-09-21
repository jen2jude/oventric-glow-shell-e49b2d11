# Newsfeed mobile and tablet header

## Changes
- Remove the Stories/status strip from the Newsfeed on every layout.
- Replace the current mobile/tablet social toolbar with a clean sticky header: Oventric logo on the left, flexible space, then notifications, chat, and the signed-in user's profile image.
- Style the actions with the homepage category palette: subtle mixed-colour tinted icon surfaces, light borders, and restrained shadows.
- Hide the header while scrolling down and restore it immediately when scrolling up or returning near the top.
- Keep the existing desktop Newsfeed toolbar and all notification, chat, profile, post, search, and feed behavior unchanged.

## Verification
- Check phone and tablet widths for fit, sticky behavior, scroll-direction collapse, restored header, working drawers, and absence of Stories.
- Run the project’s automatic type and build checks.
