# Profile commerce and social layout

## Goal
Reorder the profile overview into a clear commerce-to-social flow without changing any existing shop, service, earnings, or post behavior.

## Layout
- Place the Shop preview and Services offered preview side by side on desktop.
- Stack those two sections cleanly on phones and narrow tablets.
- Place Earnings breakdown directly below the Shop and Services row for the profile owner.
- Place Recent posts below Earnings breakdown.
- Keep other profile information sections outside this requested commerce/social sequence unchanged.

## Recent posts
- Replace the simplified recent-post links with the same live post presentation used by the main Newsfeed.
- Show the complete post content: text, all supported image/video media, product attachments, author details, timestamps, and engagement counts.
- Preserve working reactions, comments, sharing, reporting, and owner delete controls.
- Use the existing comments, reactions, report, share, and post-options flows rather than creating parallel behavior.
- Refresh post engagement after comments and use optimistic reaction updates as the Newsfeed does.

## Technical details
- Add compact/preview options to the live profile post feed so the overview can show recent posts without its composer, while the Posts tab keeps its full current experience.
- Use the shared post actions menu for report/share/delete behavior and the existing report modal.
- Move the owner-only Earnings breakdown into the overview at the requested position and remove the duplicate placement below all profile tabs.
- Update the overview data loading so posts come from the live wall-post source, while shop and service previews keep their current data source.
- Verify the profile at desktop and mobile widths, including media rendering and opening reactions, comments, report, and share controls.
