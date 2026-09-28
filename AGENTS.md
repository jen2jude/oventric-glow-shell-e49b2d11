<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## App shell vs website
`useIsAppShell()` chooses app on installed/standalone, native, and `?mode=app`; Lovable previews and public tabs use web. Reason: preview shows website; `?mode=app` previews the app shell.

App mode always uses dark theme; keep saved light preference for web only. Reason: light text remapping obscures dark app cards.

Installability is manifest-only; `push-sw.js` is messaging-only. Reason: avoid stale previews.

Lovable preview hosts default to website view; `?mode=app` shows the app. Reason: app access stays active without stale app-shell caches.

App conversations sheet over inbox; web separate. Reason: preserve inbox scroll.

App profile forms use app-scoped sheets. Reason: shared writes.

App post composer shares web logic in a keyboard-safe root sheet. Reason: one publishing flow.

App product upload shares web fields in a fixed-action sheet. Reason: preserve selling rules.

Main mobile app sections share `AppPageHeader` in `AppSurface`; detail pages and Messages keep contextual headers. Reason: consistent access without duplicate chrome.

## Creator Coach (AI)
- Creator Coach is app-exclusive: chat UI in `src/components/oventric/app/CreatorCoach.tsx`, streaming route `src/routes/api/creator-coach.ts` (openai/gpt-6-astra via Responses, reasoning low), history in `creator_coach_messages` (one conversation per creator, account-saved). Reason: a real reason to install the app; web stays without it.
- Coach answers from live stats: route builds context via `buildCreatorHubData` (exported from creator.functions.ts) + seller snapshot; never invent numbers.
- Coach greetings use local time: onboarding waits for publishing, existing creators get a device welcome, then dedupe hourly per account/device. Reason: orient creators without interruption.

- Oventric Coach is open to all signed-in app users; page-aware nudges come from a local randomized pool in src/lib/coach-page-prompts.ts (5s dwell, once per page per session, 10s auto-hide). Why: instant, free, no AI call per nudge.
