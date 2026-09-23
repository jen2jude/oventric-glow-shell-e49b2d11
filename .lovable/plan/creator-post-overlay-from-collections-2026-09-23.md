# Creator post overlay from Collections

## Goal
Opening a saved creator item from a collection will show the complete creator post in a centered overlay instead of navigating back to the Newsfeed. Closing it returns the user to the same collection and scroll position.

## Implementation
- Reuse the existing creator post card so the overlay shows the same author, media/video playback, title, caption, views, creator links, options menu, and free-download or paid-buy action.
- Add a focused public lookup for one published creator post by its saved post ID, using the same data shaping, signed media, real counts, and asset availability rules as the Creators feed.
- Store the creator post ID directly on newly saved collection items. Continue recognizing existing saved items by extracting the ID from their current `/feed?tab=creators&post=…` link, so previous saves work without migration.
- Intercept only saved creator-post item taps. Ordinary products, posts, images, and manually added links keep their current behavior.
- Present the post in a Bright Spectrum white overlay with an X close control, internal scrolling, mobile-safe sizing, Escape/backdrop close, and locked background scrolling.
- Preserve existing CTA behavior: free assets download immediately through the current secure flow; paid assets open the normal product purchase flow; share, report, save, creator links, and owner controls remain unchanged.

## Verification
- Open an existing saved creator post from Collections on mobile and desktop.
- Confirm the collection page stays behind the overlay and returns at the same position after closing.
- Confirm image/video playback and post actions render correctly.
- Confirm free download and paid Buy actions use their existing flows.
- Confirm non-creator collection links still open normally.
