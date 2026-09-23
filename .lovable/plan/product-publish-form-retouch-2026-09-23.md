# Product publish form retouch

## Goal
Retouch the digital-product publishing form with the same bright, category-colour aesthetic as the WhatsApp contact prompt, while making it compact and comfortable to use on mobile.

## Changes
- Convert the form into a polished white publishing sheet with a multicolour category strip, stronger header, clearer sections, and consistent light inputs and controls.
- Reuse category-inspired green, blue, violet, gold, and coral accents across image upload, pricing, delivery, safety, and confirmation areas without changing publishing rules.
- On mobile, position the sheet slightly below the top edge, cap its height, and let only the sheet content scroll smoothly inward.
- Keep the title and close action easy to reach while scrolling, and preserve safe-area spacing near the final buttons.
- Lock the page behind the form for its entire open state and restore its prior scroll state when closed.
- Preserve every existing field, upload flow, validation, pricing split, cashback rule, delivery mode, and submission behavior.

## Technical details
- Update `SellAssetModal.tsx` and its scoped styles in `src/styles.css`.
- Replace raw action buttons with the shared Button component where practical.
- Verify mobile and desktop layout, internal scrolling, background scroll lock, and form accessibility.
