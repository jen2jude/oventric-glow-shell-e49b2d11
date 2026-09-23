# Terms Page Redesign

## Goal
Turn the Terms page into a complete, plain-language agreement that matches the approved Oventric editorial style and remains easy to scan on phones, tablets, and desktop.

## What will change
- Replace the current compact legal document with a full light editorial page using white surfaces, the multicolour category strip, Bright Spectrum accents, Sora/Manrope typography, and restrained 10px corners.
- Add a clear opening summary explaining who the terms apply to, when they take effect, and how they relate to the Privacy Policy.
- Organize the agreement into focused sections covering:
  - account eligibility, accurate information, and account security
  - user content, creator showcases, intellectual property, and reviews
  - digital-only marketplace rules and seller responsibilities
  - prices, checkout, the 80/20 seller/platform split, seller-funded cashback, escrow, delivery, refunds, and disputes
  - wallet records, withdrawals, payout reviews, and payment-provider limitations
  - acceptable use, prohibited products and conduct, enforcement, suspension, and account deletion
  - service availability, disclaimers, liability, indemnity, changes, governing law, and support
- Add visual summary cards and a numbered navigation list so people can understand the document before reading every section.
- Keep legal statements aligned with the completed MVP: digital goods only, no physical goods, authoritative transaction records, and no fabricated promises or guarantees.
- Add clear links to Privacy, Help, and problem reporting.
- Preserve complete page metadata with a unique title, description, Open Graph fields, canonical URL, and Twitter card.

## Validation
- Check desktop and mobile layouts for readable text, working section navigation, visible footer links, and no horizontal overflow.
- Confirm all Terms-page links point to existing pages and the browser console remains clear.

## Technical details
- Rebuild only `src/routes/terms.tsx`, reusing the existing public page shell, shared design tokens, image asset, icons, and button component.
- Add Terms-specific global styling only if the existing editorial tokens cannot express a required visual treatment.
