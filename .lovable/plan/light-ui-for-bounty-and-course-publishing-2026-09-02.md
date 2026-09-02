# Light UI for Bounty and Course Publishing

Convert both creation flows from the legacy dark modal treatment to the current clean white browser UI while preserving every field, validation rule, upload, draft, escrow, and publishing action.

## Changes

### Shared visual language
- Use white modal surfaces, soft slate canvas sections, subtle grey borders, dark readable type, and crimson primary actions.
- Keep the existing 10px corner standard and improve focus, hover, disabled, and destructive states for light backgrounds.
- Preserve responsive bottom-sheet behavior on app-sized screens and centered modal behavior on larger screens.

### Post a Bounty
- Restyle the editor shell, image uploader, form controls, scheduling section, draft notice, footer actions, low-balance prompt, and success confirmation.
- Replace dark-only controls with the shared button component where practical, without changing publishing or escrow logic.

### Publish a Course
- Restyle the wizard shell, step progress, fields, thumbnail uploader, curriculum/lesson cards, quizzes, settings, review, sticky footer, and rich-text editor.
- Keep all five steps, uploads, draft publishing, certificates, pricing, and mobile behavior unchanged.

## Technical details
- Update `src/components/oventric/BountyEditorModal.tsx` and `src/components/oventric/CoursePublishWizard.tsx`.
- Add a light appearance option to `src/components/ui/rich-text-editor.tsx` so course lesson editors match the wizard without changing other dark usages.
- Use semantic Tailwind theme utilities and the existing crimson accent; avoid new page-specific hardcoded colors.
- Validate with TypeScript and responsive browser checks where authentication allows the flows to open.
