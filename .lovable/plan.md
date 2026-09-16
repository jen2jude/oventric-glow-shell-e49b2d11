# Bring the course and bounty publishing forms back to the white site style

The "Publish a Course" wizard and the bounty editor are currently styled dark (black panels, white text) even though they open on the normal white website. Labels and placeholder text end up low contrast and the form looks broken.

## What to change

1. **Course publish wizard** (`src/components/oventric/CoursePublishWizard.tsx`)
   - Panel, header, step bar, footer: back to white surfaces with light slate borders.
   - Inputs and textareas: white/soft-slate fields with dark text and readable placeholders.
   - Buttons and step indicator: crimson accent on light, per the saved publishing design standard.

2. **Bounty editor** (`src/components/oventric/BountyEditorModal.tsx`)
   - Same treatment, so both publishing flows match.

3. **Shared create tokens** (`src/styles.css`)
   - The `--create-*` tokens are currently only defined with dark values at `:root`. Add matching light values so any surface using them under the white theme reads correctly, without changing the dark surfaces that rely on them.

## Approach

Replace the hard-coded dark colour values with the light equivalents already used elsewhere on the site (white panels, `slate-200` borders, `slate-900` text, `slate-500` placeholders, crimson `#E5484D` accents, `rounded-[10px]`). Layout, steps, validation and saving behaviour stay exactly as they are — this is styling only.

## Verification

Open both forms on desktop and phone widths and confirm: panel is white, every label and placeholder is readable, buttons and the step indicator use the crimson accent, and nothing shifts position compared with today.
