# Seller contact prompt redesign

## Goal
Restyle the recurring “Add your WhatsApp number” prompt to match Oventric’s current light, polished interface while preserving its existing validation, save behavior, and two-minute reminder cycle.

## Changes
- Replace the dark sheet with a bright white mobile sheet/dialog, soft neutral backdrop, crisp borders, and compact spacing.
- Add a category-inspired visual header using teal, blue, violet, amber, and coral accents around the WhatsApp/contact icon.
- Restyle labels, phone inputs, helper copy, error state, close control, and save action for stronger readability.
- Keep the required WhatsApp number, optional second number, country-code hint, dismiss behavior, and save flow unchanged.
- Verify the result at mobile and desktop sizes and confirm the existing interaction still works.

## Technical details
- Update only `PhoneReminder.tsx` and semantic color tokens in `src/styles.css` if needed.
- Use the existing shared Button component for actions and existing motion classes, with reduced-motion support preserved.
