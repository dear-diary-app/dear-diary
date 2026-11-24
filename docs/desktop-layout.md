# Desktop layout

Large non-touch desktop browsers (at least 1280 CSS pixels, hover and fine
pointer, zero touch points, and no mobile/tablet user-agent) opt into a new
layout. Touch laptops conservatively keep the old layout too, so large
tablets with keyboards/trackpads never get the desktop redesign.

- Fixed sidebar with active route, unread count, and Settings at the bottom.
- Home: stories and feed in the main column, compact diary cards and today's
  schedule on the right. Existing top-bar controls remain available.
- Messages: one actual shared conversation beside the open chat, not a fake
  contact list. Blurred messages keep a generic preview. The existing message
  components, composer, settings, profile and message actions are reused.
- Profile, diary menu, history and settings use the remaining desktop width.
- All new CSS is scoped under `.dd-desktop`. No theme-color or system bar,
  safe-area, PIN, auth, database, notification or message-send logic changes.

QA uses isolated synthetic contexts and intercepted requests only. Six main
routes were compared before/after at phone 390x844, tablet 820x1180, and large
touch tablet 1366x1024: all 18 screenshots are pixel-identical. Desktop
navigation and gate checks cover 1279,1280,1440,1600,1920 widths, touch and
iPad exclusions, resizing, draft composer, month navigation, profile edit/
cancel, and Settings Sign out remaining last. TypeScript/build checks pass.
