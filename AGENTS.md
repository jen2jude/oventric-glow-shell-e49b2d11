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
Oventric renders two presentations from one codebase. `useIsAppShell()` in
`src/hooks/use-launch-context.ts` is the single source of truth: it returns true
when the page runs standalone (installed PWA) or `?mode=app` was requested, and
the choice sticks for the session. Reason: one codebase, two experiences, without
duplicating routes or data logic.

Installability is manifest-only (`public/manifest.webmanifest`). No app-shell
service worker is registered — `public/push-sw.js` is messaging-only. Reason:
cached app shells serve stale pages in Lovable previews.

App-mode conversations open in a slide-up drawer above the mounted Messages inbox; the website message layout stays separate. Reason: closing or swiping away a conversation should return to the same inbox position without losing chat state.

## Creator Coach (AI)
- Creator Coach is app-exclusive: chat UI in `src/components/oventric/app/CreatorCoach.tsx`, streaming route `src/routes/api/creator-coach.ts` (openai/gpt-6-astra via Responses, reasoning low), history in `creator_coach_messages` (one conversation per creator, account-saved). Reason: a real reason to install the app; web stays without it.
- Coach answers from live stats: route builds context via `buildCreatorHubData` (exported from creator.functions.ts) + seller snapshot; never invent numbers.
- Coach greetings are app-only and local-time based: the onboarding welcome waits for publishing to close, existing creators get a one-time welcome on their device, then greetings are deduped hourly per account/device. Reason: orient every creator without interrupting publishing or greeting repeatedly across navigation.
