# App Support Center Redesign

## Goal
Give `/help-board` a compact dark app experience while keeping the existing light website Support Center unchanged.

## What will change
- Detect app mode on the Support Center route and render a dedicated app-only page.
- Add a fixed app header with a clear back action and independently scrolling content.
- Keep live chat, support cases, feedback, and FAQs fully functional in compact app-native sections.
- Open support case forms and feedback as dark app slide-ups that dismiss by tapping outside.
- Keep links to the Help Center, FAQs, and Report a Problem available without website chrome.

## Technical details
- Reuse the current support functions, authentication gate, live chat, dispute categories, FAQ content, and route metadata.
- Change presentation only; no support records, permissions, notifications, or website behavior will change.
- Verify app and website views, scrolling, support interactions, and current build health.
