# Keep the app search panel full-height after closing the keyboard

## Change
- Disable the slide-up library's automatic input repositioning for app sheets so keyboard opening and closing cannot leave the search panel at an intermediate height.
- Keep the existing 92% screen height, swipe-to-dismiss behavior, backdrop, and website experience unchanged.

## Verification
- Open the homepage search in app mode, focus the search field, dismiss the keyboard, and confirm the panel remains at full height.
- Confirm the panel still closes by its close control and the project builds successfully.
