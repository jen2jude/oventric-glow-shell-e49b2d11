# Resume unfinished product listings

## Goal
Keep an unfinished product listing intact when a seller closes the form, leaves the page, or returns later, then restore it when they tap the marketplace + button again.

## Changes
- Save all entered product details automatically as the seller works, including category, pricing, cashback, descriptions, stock, delivery choice, agreement state, images, and the downloadable file.
- Store the draft privately in the current browser, scoped to the signed-in seller so accounts sharing a device do not see each other’s draft.
- Restore the draft automatically when the product form reopens and show a small “Draft restored” notice.
- Keep uploaded image previews working after restoration and preserve the current image limits and validation.
- Clear the saved draft only after a successful product submission or when the seller explicitly chooses “Discard draft.” Closing the form will continue saving it.
- Add a compact discard action in the form header only when a saved or filled draft exists.

## Technical details
- Add a small browser draft utility using IndexedDB so file and image objects can be retained; do not send unfinished drafts to the backend.
- Update `SellAssetModal.tsx` to load once per opening, debounce automatic saves, rebuild image preview URLs, clear stale object URLs safely, and avoid overwriting a stored draft before restoration finishes.
- Key drafts by authenticated user ID with a format version for safe future changes.
- Verify close/reopen, page reload, manual delivery, image restoration, file restoration, discard, and successful-submit cleanup on mobile and desktop.
