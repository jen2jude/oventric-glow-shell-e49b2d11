# Creators tab: onboarding + showcase uploads

Turn the empty Creators tab into a place where people show what they can do: a short "become a creator" questionnaire behind the + button, then a publishing form for showcase work, and a feed of auto-playing video previews.

## 1. Creator onboarding (the + button, first time only)

Three quick steps in one modal, with a progress bar and back/next:

1. **Are you a creator?** Yes / Not yet (Not yet closes politely).
2. **Your field** — pick one or more: Graphic Designer, Video Editor, Video Content Creator, Photographer, Web Developer, App Developer, Music/Audio, Writer/Copywriter, 3D/Motion, Social Media Manager, Other (free text).
3. **Tools you use** — a searchable grid with logos, drawn from the existing Oventric tools library (Canva, Figma, Photoshop, Lovable, Grok, Premiere, Blender…), plus a small "add your own" box.
4. **Where can people see your work?** (optional) up to 3 links — portfolio, Behance/Dribbble, YouTube, a past job page.

On finish:
- Fields become skills on the profile, tools fill the "Tools I use" grid — both show in the existing profile Skills tab straight away.
- The work links are saved to the profile too, shown as a small "Work & portfolio" row in that tab.
- The person is marked as a creator, so the + button goes straight to the upload form from then on. They can re-open the questionnaire from the profile Skills tab (Edit).

## 2. Creator upload form

Opened by + once onboarding is done:

- **Title** (required)
- **Caption** (optional, longer description)
- **Media** — upload images or a video, same picker and upload path as the post composer
- **Community link** (optional) — Telegram or WhatsApp channel/group link, validated
- **Long-form video link** (optional) — YouTube, Vimeo, Facebook or Telegram URL; the platform is detected and the video is embedded and streamed in place, no re-upload
- Publish / Save draft is out of scope; a single Publish button

## 3. The Creators feed

- Cards show the creator (photo, name, field badges, tool chips), the media, title and caption.
- Every video card auto-plays muted on loop for a 10-second preview while it is on screen, and pauses when scrolled away — same idea as a preview reel.
- Tapping a video opens the existing full player with sound and controls; external links open the embedded long-form player.
- Community link shows as a small Telegram/WhatsApp button.
- A "Creators" filter row at the top by field (All, Design, Video, Web…), using the homepage category colour style.

## Technical notes

- New table `creator_posts` (owner, title, caption, media paths, media type, poster path, community link, external video url + detected provider, field tags, status, created_at) with GRANTs, RLS: public read of published rows, owner insert/update/delete. Media reuses the existing post media bucket and signed-URL/poster pipeline in `posts.functions.ts`.
- Profile writes reuse the existing `skills`, `skill_levels`, `tools` and `social_links` columns via `updateProfile` in `profiles.functions.ts`; add a `creator_profile` JSON (fields, work links, onboarded_at) rather than new columns per answer.
- Tools picker reuses `listToolLibrary` from `src/lib/tools.functions.ts` (same source as `SkillsEditModal`).
- New `src/lib/creators.functions.ts` server functions: `getCreatorStatus`, `saveCreatorOnboarding`, `publishCreatorPost`, `listCreatorFeed` (auth middleware on writes, public read via the publishable server client).
- New components under `src/components/oventric/creators/`: `CreatorOnboardingModal.tsx`, `CreatorPublishModal.tsx`, `CreatorCard.tsx`, `CreatorFeed.tsx`; the Creators tab in `Feed.tsx` renders `CreatorFeed` and the existing FAB routes to onboarding or publish based on `getCreatorStatus`.
- Auto-play uses an IntersectionObserver hook: muted, `playsInline`, loop, 10s window then pause; respects reduced-motion.
- External video: shared parser extending `src/lib/youtube.ts` to also handle Vimeo, Facebook and Telegram embeds.

## Not included

- Monetisation, hiring or paid creator content
- Moderation queue beyond the existing report/admin tooling
