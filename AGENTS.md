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
`useIsAppShell()` chooses app on installed/native/`?mode=app`; previews and public tabs use web. Why: preserve both views.

App mode is dark-only; saved light preference is web-only. Reason: light text remapping obscures dark app cards.

Installability is manifest-only; `push-sw.js` is messaging-only. Reason: avoid stale previews.

Preview hosts default to web; `?mode=app` shows app. Why: avoid stale app caches.

App forms use app-scoped sheets with input repositioning off; web stays separate. Why: preserve context and keyboard-stable heights.

Keep app chrome outside the main scroller; use `app-scroll-header` inside. Why: prevent header loss.

Privacy, Terms, Report a Problem, Help, and Support Center use dark app views and retain separate web views. Why: no website chrome in app.

## Creator Coach (AI)
- Creator Coach is app-exclusive: chat UI in `src/components/oventric/app/CreatorCoach.tsx`, streaming route `src/routes/api/creator-coach.ts` (openai/gpt-6-astra via Responses, reasoning low), history in `creator_coach_messages` (one conversation per creator, account-saved). Reason: install incentive.
- Coach answers from live stats: builds context via `buildCreatorHubData` + seller snapshot; never invents numbers.
- Coach greetings use local time: onboarding waits for publishing, existing creators get a device welcome, then dedupe hourly per account/device. Reason: orient creators.

- Oventric Coach is open to all signed-in app users; page-aware nudges come from a local randomized pool in src/lib/coach-page-prompts.ts (5s dwell, once per page per session, 10s auto-hide). Why: instant, free, no AI call per nudge.

- Native store builds use Capacitor wrapping the live site (capacitor.config.ts, server.url oventric.com/?mode=app). Why: custom launch screen, instant web updates.
- Explore uses app sheets for leaderboards and category product lists; People previews five follows, Products previews four per category. Why: compact discovery.
