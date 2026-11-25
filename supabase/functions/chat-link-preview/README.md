# Private Chat link previews

POST accepts a message ID and one URL already present in that message. The signed-in sender/recipient must be able to select it through normal RLS. No service-role database access. Blurred messages are excluded. Unsupported or failed previews return available:false, leaving a plain clickable URL.

Only HTTPS URLs on the explicit public-site list in safety.ts are fetched. No arbitrary host fetching, credentials, alternate ports, private IPs, scripts, iframes or forwarded cookies/auth. Every redirect is revalidated. Page bodies have a 512KB cap; image bytes have a 2MB cap and raster MIME list. YouTube uses its public oEmbed metadata endpoint. Other supported sites use their public HTML/Open Graph tags. Site restrictions, login walls and metadata placement can prevent previews.

Images come through the same restricted fetcher and return as inline bytes, not remote browser requests. Hostnames in the lists are trusted public-service DNS boundaries, not a general SSRF-safe arbitrary-web fetch service. Unknown hosts remain tappable but are not previewed. Requests are limited per-user per warm function process; this is a best-effort abuse bound, not a globally durable quota.

Preview responses use no-store. Client metadata lives in a bounded memory cache keyed by account, message and URL; nothing is added to chat rows, localStorage, or the public shell cache. Message deletion/locking unmounts the card. Merely drafting/pasting text does not request a preview. The linked site sees a server request when an eligible sent message becomes visible, including the URL path/query, but no chat participants or other message text. Opening the link explicitly leaves Dear Diary and is subject to that site's privacy policy.

Android incoming Share intents are not implemented by this web feature. No APK build is required for paste/send and tap-to-open.
