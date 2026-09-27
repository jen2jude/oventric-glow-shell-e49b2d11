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
`src/hooks/use-launch-context.ts` is the single source of truth: review hosts
always use the app shell; Oventric's public hosts use the website. Reason: one
codebase, two experiences, without duplicating routes or data logic.

Installability is manifest-only (`public/manifest.webmanifest`). No app-shell
service worker is registered — `public/push-sw.js` is messaging-only. Reason:
cached app shells serve stale pages in Lovable previews.

App launch/install promotion stays paused publicly: no manifest or invites;
every non-public review host uses app mode until owner reactivation. Reason:
Lovable embeds previews on changing internal hosts that cannot be allow-listed.

App conversations open in a sheet over the mounted inbox; web stays separate. Reason: closing returns to the same inbox position.

App profile editing reuses web forms with app-scoped sheets. Reason: parity without duplicating profile writes.

## Creator Coach (AI)
- Creator Coach is app-exclusive: chat UI in `src/components/oventric/app/CreatorCoach.tsx`, streaming route `src/routes/api/creator-coach.ts` (openai/gpt-6-astra via Responses, reasoning low), history in `creator_coach_messages` (one conversation per creator, account-saved). Reason: a real reason to install the app; web stays without it.
- Coach answers from live stats: route builds context via `buildCreatorHubData` (exported from creator.functions.ts) + seller snapshot; never invent numbers.
- Coach greetings are app-only and local-time based: the onboarding welcome waits for publishing to close, existing creators get a one-time welcome on their device, then greetings are deduped hourly per account/device. Reason: orient every creator without interrupting publishing or greeting repeatedly across navigation.
