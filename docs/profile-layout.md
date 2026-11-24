# Profile layout

The profile has a compact username/lock toolbar, circular photo, stats, bio, song link, action buttons, and Posts/Music/About tabs.

Stats are real data: owner-filtered `feed_posts` exact count, existing `diary_streaks` RPC, and the current linked friendship. A failed count stays unknown, not zero. There are no invented followers or following. Photo grid thumbnails use a 3:4 crop; the existing full post keeps original image proportions. Multi-photo posts have an overlay marker. Tiles open the existing private feed post. Older posts load in pages of 24.

Profile photos still open in the existing zoom dialog; changing/cropping a photo stays in Edit profile. About retains mood, bio editing, streak details, unsaved changes guard and failure recovery. Music retains existing 24-hour song sharing, preview, removal and reactions. Leaving Music stops preview playback. Own and friend profiles keep separate controls. No server permission or data changes were made.

QA uses intercepted synthetic auth, rows, song and image responses. No real accounts, PINs or content were used. Checked 360/390 phones, 820 touch tablet and 1440 desktop; light/dark themes, tabs and arrow-key navigation, owner photo grid/count, full post links, empty friend grid, read-only friend actions, edit/save failure recovery and post retry. Existing desktop idle-lock/draft/recorder/dialog regressions also passed. Scoped CSS does not change theme-color, safe areas or feed photo styles.
