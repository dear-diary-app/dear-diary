import React, { useEffect } from 'react';
import { TopBar } from './ui';
import { useAuth } from './store';

// To add a feature: put a new item at the TOP of the first release, or add a new release above it.
// Newest first. `id` must be unique; the newest id drives the "New" badge in Settings.
export interface Feature { id: string; title: string; text: string; emoji: string }
export interface Release { date: string; label: string; features: Feature[] }

export const RELEASES: Release[] = [
    { date: '2026-11-23', label: 'Monday, 23 November', features: [
        { id: 'smoothchat', emoji: '🍃', title: 'Lighter chat scrolling', text: 'Chat keeps its glass colours with less blur work on message bubbles. The weather sky slows while you scroll and returns to normal when you stop.' },
        { id: 'giflive', emoji: '🎞️', title: 'GIFs move while you search', text: 'GIF search updates as you type, with moving previews in the grid and a cleaner footer. Reduced motion and data saver keep previews still until you choose to play.' },
        { id: 'chatstatus', emoji: '💬', title: 'Share your chat status', text: 'Set Free, Studying, Busy or your own short status from the top right of Chat. Your friend can see it there. Clear it whenever you like; Online stays automatic and separate.' },
        { id: 'profileclean', emoji: '🌿', title: 'A simpler profile', text: 'Your profile stays clean, with photo, bio and mood controls tucked behind Edit profile. The song card is simpler too.' },
        { id: 'rainallpages', emoji: '🌧️', title: 'The same sky on every page', text: 'Weather animation is now visible on Home, History, diary and Profile pages as well as Chat. Busy devices lower the sky detail and frame rate before switching to a still background.' },
        { id: 'profiletab', emoji: '💛', title: 'A little space for you', text: 'Profile now has its own bottom tab. Update your picture, write a short bio, choose a mood and see your writing streak. You can view your friend’s profile too. Share a fixed song preview for 24 hours. Account settings still live at the top.' },
        { id: 'flushheader', emoji: '↟', title: 'No strip above your chat', text: 'The chat header now starts at the top of the app, without the extra outer gap. Safe-area space stays inside the header so notched phones keep their controls clear. Shared page and contact headers follow the same layout.' },
        { id: 'allglass', emoji: '🫧', title: 'Glass, everywhere', text: 'A shared frosted-glass finish across cards, chat bubbles, controls, sheets, history and Settings. Soft highlights and tinted edges follow your light, dark or Weather background, with denser glass behind words and a solid fallback for browsers without blur.' },
        { id: 'weathertopblend', emoji: '🌅', title: 'One sky across the top', text: 'Weather mode now blends the browser top colour, safe area and chat header into one continuous sky. Home and Settings use the same top treatment, with clear header text in day and night.' },
        { id: 'proceduralsky', emoji: '☁️', title: 'A living sky behind your diary', text: 'Weather mode now paints an original moving sky: textured cloud layers, sun glow, a moonlit sky, rain with mist and ripples, or snow at different depths. Day and night have their own lighting. No downloaded video or stock images. Motion pauses when hidden and stays still for reduced motion, data saver and low-power devices. It may use more battery.' },
        { id: 'weatherpalette', emoji: '🌤️', title: 'Let weather choose your colours', text: 'Choose Weather beside Auto and Fixed in Background theme. Sun brings warm colours, rain blue-grey, cloud soft grey, wind sage, snow icy blue, and nights or storms a deep sky. Weather scenes are easier to see across the main pages, even when still. Settings shows the weather type, update time and any loading problem.' },
        { id: 'weathercity', emoji: '🏙️', title: 'Choose a city for weather', text: 'Location unavailable? Search a city in Background theme, check its region and country, then select it for weather. The city stays on this device for your account. You can switch back to device location any time. Search text goes to Open-Meteo only when you press Search.' },
        { id: 'localweather', emoji: '🌦️', title: 'Day, night and your local sky', text: 'Auto day / night uses Lavender from 6 am to 6 pm and Midnight overnight, by your device clock. Fixed colours are still available. Turn on Local weather background in Background theme for rain, wind, sun or moon, cloud, snow and storm scenes. Location permission is optional. Reduced motion keeps the sky still. The browser top colour now follows the top of your theme.' },
        { id: 'chatbottom', emoji: '⬇️', title: 'Back to the latest message', text: 'Reading older messages? A down arrow appears above the message box. Tap it to glide back to the latest message. The badge counts only new partner messages that arrive while this chat is open and you are reading above. Old messages never add to it. It clears when you tap the arrow or reach the bottom. Reduced motion jumps straight there.' },
        { id: 'doubleheart', emoji: '❤️', title: 'Double tap to heart', text: 'Double tap or double-click a message to react with a heart. Do it again to remove your heart, or replace another reaction with a heart. Holding a message still opens all reactions. Photo taps keep opening photos; double tap the caption or bubble space instead.' },
        { id: 'composerreturn', emoji: '↵', title: 'Enter adds a new line', text: 'Use the keyboard Return key to write another line in chat, on phone or desktop. The message box grows with your text and scrolls for longer drafts. Send only when you tap the send button. This also works while replying, editing or adding a photo caption.' },
        { id: 'headerattach', emoji: '📎', title: 'A tidier chat header and composer', text: "Your partner's name sits centered beside their photo when offline. When they come online, it gently moves up with Online underneath. Start writing and the GIF and photo buttons fold into a paperclip. Tap it to choose GIF or Photo without losing your draft. Reduced motion skips the movement." },
        { id: 'tabswipe', emoji: '↔️', title: 'Swipe between tabs', text: 'Swipe left or right on open page space to move between Home, My diary, Chat, History and Settings. Message replies, stickers, photos, editors and scrolling controls keep their own gestures. The first and last tabs do not wrap around. Reduced motion switches tabs without the slide.' },
        { id: 'chatmotion', emoji: '💬', title: 'A softer, livelier chat', text: 'New messages ease into the conversation, photos and GIFs fade in, and reactions and chat controls feel smoother. Typing dots appear while your partner writes, then disappear when they pause or leave. No draft text is sent or stored. Turn Share typing activity off in Privacy on this device. Reduced motion keeps the chat still.' },
        { id: 'sharedcollection', emoji: '🖼️', title: 'Your shared photos and links', text: "Tap your partner's name or avatar in chat to open Contact info. Separate Photos and Links areas collect messages from your full chat history, including older photos. Open a photo larger or follow a web link. GIFs stay in chat, and unsent messages disappear from the collection." },
        { id: 'chatgifs', emoji: '🎞️', title: 'GIFs in your chat', text: 'Tap GIF to search GIPHY, preview a result and send it. Your old chat stickers stay in place. GIF searches and media load directly from GIPHY, with a shared free limit of 100 API calls per hour. Unavailable GIFs show a clear fallback.' },
        { id: 'onlineandnav', emoji: '💬', title: 'A clearer chat', text: 'The chat header now shows Online only while your partner has a connected, foreground app session. There is no permanent Private chat label or last-seen time. Status can take a short time to update after a connection drops. Chat is now the middle navigation tab, with History to its right.' },
    ] },
    { date: '2026-11-22', label: 'Sunday, 22 November', features: [
        { id: 'emojipulldown', emoji: '👇', title: 'Pull down to close emoji', text: 'Drag the emoji sheet handle or header down to close it without refreshing the page. Small drags spring back, and scrolling through emoji stays inside the sheet.' },
        { id: 'moreemoji', emoji: '😀', title: 'More ways to react', text: 'Hold a message for a scrollable reaction bar. Tap + to search thousands of native emoji or browse categories. Your chosen reaction is highlighted, and frequently used emoji are remembered separately for your account on this device. Tap your existing reaction to remove it.' },
        { id: 'chatedgefades', emoji: '🌫️', title: 'Softer chat edges', text: 'Messages fade gently under the chat header and above the message box as you scroll. The newest message stays clear at rest, even when a reply or photo preview is open.' },
        { id: 'settingsbottom', emoji: '🗂️', title: 'Settings, tidied', text: 'Privacy on this device now folds open. All drop-down sections, including themes, avatar colour and diary downloads, are grouped at the bottom of Settings. Your saved choices are unchanged.' },
        { id: 'privacychoices', emoji: '🔐', title: 'Your privacy choices', text: 'Settings now lets you turn blur when minimized on or off for this device. Notifications has account-wide switches for message previews and an Open to reply shortcut. Both notification options start off. The shortcut opens chat rather than sending from the notification bar; button and keyboard behavior depend on your phone.' },
        { id: 'chatphotos', emoji: '📷', title: 'Send photos in chat', text: 'Tap the photo button next to the sticker button to send up to 3 photos at once (photos only, no videos). Add a caption if you like. Tap a photo to view it full screen and swipe between them. Photos are private to the two of you, work with Reply and reactions, and are deleted when you Unsend.' },
        { id: 'chatmenu', emoji: '⋮', title: 'Three-dot message menu', text: 'When you hold a message, a three-dot button appears at the top right. Tap it for Copy, Edit and Unsend (only the options that fit that message).' },
        { id: 'chatanchor', emoji: '🎯', title: 'Reactions right above the message', text: 'Hold a message and the reaction bar appears right above it, with that message highlighted and the rest softly faded. Copy, Edit and Unsend are at the top. Reply is still a swipe.' },
        { id: 'noselect', emoji: '🔒', title: 'No accidental text selection', text: 'Pressing and holding text, photos or links no longer selects them or opens the phone\'s Copy and search bar. Typing boxes work as usual, and Copy on your own chat messages still works.' },
        { id: 'chathold', emoji: '👆', title: 'Hold a message', text: 'Press and hold any message and the reactions pop up one by one, with Reply below. On your own messages, Copy and Edit appear at the top right. After you edit, the message shows "edited" for both of you.' },
        { id: 'chatbar', emoji: '🧹', title: 'Cleaner message box', text: 'Removed a thin grey line that appeared at the right end of the message box. Long messages still scroll inside the box.' },
        { id: 'chatfull', emoji: '⬅️', title: 'Full-screen chat', text: 'When you open a conversation, the bottom bar steps out of the way and a back arrow appears next to the profile photo. Tap it, or use your phone\'s Back, to return to where you were.' },
        { id: 'swipe', emoji: '↩️', title: 'Swipe to reply, Instagram-style', text: 'Swipe a friend\'s message to the right, or your own message to the left. The bubble follows your finger, a reply icon grows, and letting go sets the reply. Android phones give a light buzz.' },
        { id: 'whatsnew', emoji: '🆕', title: "This What's new page", text: 'A list of every new feature, newest first, with a small "New" badge in Settings when something has been added since you last looked.' },
        { id: 'chat', emoji: '💬', title: 'Chat', text: 'A private chat between you two, in its own tab. Swipe a message right to reply, tap it to react, copy or unsend. Send any sticker. You can see when the other person is typing, and when your message is Seen. Turn on "New chat messages" in Notifications to get an alert.' },
        { id: 'songs', emoji: '🎵', title: 'Songs on diary pages', text: 'Add a song to a page: search in English or Hindi, play a 30-second preview, then tap Use. Your reader sees the song at the top once the page is published.' },
        { id: 'blur', emoji: '🙈', title: 'Blur when minimised', text: 'Dear Diary blurs itself when you switch apps or minimise it, so nobody sees your page by accident. (It cannot stop screenshots.) Tap to bring it back.' },
        { id: 'stickers', emoji: '🌿', title: '44 stickers', text: '20 new everyday stickers and a new Everyday tab. There are now 44 stickers in total.' },
        { id: 'opening', emoji: '✨', title: 'Opening animation', text: 'A soft, themed opening of about four seconds when you start the app. It matches your theme, and a tap anywhere skips it.' },
        { id: 'pdf', emoji: '📄', title: 'Readable PDF, locked with your PIN', text: 'Download your own diary as a nicely arranged PDF with dated pages and sticker artwork. Every PDF is locked: you type your diary PIN when you download it, and the same PIN opens the file. If you change your PIN later, old PDFs keep the PIN they were made with. Photos are not in the PDF. Find it in Settings under "Your diary, to keep".' },
        { id: 'json', emoji: '💾', title: 'JSON backup', text: 'A fresh backup of your own saved pages, in the same place as the PDF. It is not PIN-locked, so keep the file somewhere safe. Your partner\'s pages are never included.' },
        { id: 'fold', emoji: '🗂️', title: 'Tidier settings', text: 'Themes and downloads now fold away, so Settings is shorter. Tap a heading to open it. Your own profile now comes first, in Settings and in the History filters, and the buttons are evenly sized for easier tapping.' },
        { id: 'smooth', emoji: '🌊', title: 'Smoother feel', text: 'Pages slide sideways as you move around, and your phone\'s Back button slides them back. Buttons respond with a gentle press, and changing theme fades instead of jumping. The top and bottom bars of your phone now match your theme too.' },
        { id: 'start', emoji: '🛠️', title: 'Steadier start', text: 'The app now waits for your profile to load before leaving the starting screen, so you do not briefly see the wrong screen or name.' },
        { id: 'inbox', emoji: '📬', title: 'Notification inbox', text: 'The bell now opens a list of reminders you have received, kept separately for each person. Reminder options live on their own page. The app icon now shows on page headers.' },
        { id: 'reminders', emoji: '🔔', title: 'Reminders', text: 'Optional phone reminders at 6 AM, 9 PM, 9:45 PM and 10 PM, plus a list of the ones you received. Turn each one on or off in Notifications.' },
    ] },
    { date: '2026-11-21', label: 'Saturday, 21 November', features: [
        { id: 'streaks', emoji: '🔥', title: 'Writing streaks', text: 'Your profile counts how many days in a row you saved a page. Days follow Indian time, and the count is worked out privately on the server.' },
        { id: 'themes', emoji: '🎨', title: 'Background themes', text: 'Choose Warm paper, soft pastels or the dark Midnight theme. It is saved to your account.' },
        { id: 'install', emoji: '📱', title: 'Install on your home screen', text: 'Add Dear Diary to your phone like an app. See Download Dear Diary in Settings.' },
    ] },
];
export const LATEST_ID = RELEASES[0].features[0].id;
const key = (uid: string) => `dd_whatsnew_seen_${uid}`;
export function hasNewFeatures(uid: string | undefined): boolean {
    if (!uid) return false;
    try { return localStorage.getItem(key(uid)) !== LATEST_ID; } catch { return false; }
}

export function WhatsNew() {
    const auth = useAuth();
    const uid = auth.session?.user.id;
    useEffect(() => { if (uid) try { localStorage.setItem(key(uid), LATEST_ID); } catch { /* ignore */ } }, [uid]);
    return <main className="dd-shell dd-shell-narrow">
        <TopBar back="/settings" backLabel="Back to settings" />
        <article className="dd-anim dd-whatsnew" aria-label="What's new in Dear Diary">
            <h1 className="dd-title">What's new</h1>
            <p className="dd-sub">Everything added to Dear Diary so far, newest first.</p>
            {RELEASES.map(r => <section key={r.date} aria-label={r.label}>
                <h2 className="dd-whatsnew-date"><time dateTime={r.date}>{r.label}</time></h2>
                <ul className="dd-whatsnew-list">
                    {r.features.map(f => <li key={f.id} className="dd-card dd-whatsnew-item">
                        <span className="dd-whatsnew-emoji" aria-hidden="true">{f.emoji}</span>
                        <div><strong className="dd-card-title">{f.title}</strong><p className="dd-card-body">{f.text}</p></div>
                    </li>)}
                </ul>
            </section>)}
        </article>
    </main>;
}
