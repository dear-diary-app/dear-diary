# Rules, precautions and credits

Added 24 November 2026. Settings has one collapsed Rules & precautions section directly above Sign out. Existing Music credits are folded into it. No permissions, data handling or playback behavior changed.

Audit sources: AppEntryGate and route guards in screens/App; model IST schedule; DiaryExport/readable-export; ChatTranslate and translate-draft backend; ChatStore and private media helpers; ChatImageSearch metadata/credit handling; Song and ChatMusic; ChatGifs; Weather/ChatWeather/WeatherCityPicker; font files and notices; sticker generator and art README; emoji generator and Unicode notice; inline icon paths; installed package manifests and license files.

The text distinguishes hosted chat storage from translation's selected-text-only boundary. It does not claim chat is device-only or end-to-end encrypted. Translation falls back to the entire composer draft when there is no selection. Export limitations include unprotected JSON and guessable 4-digit PDF PINs. User content remains theirs.

Bundled software notice collection includes installed direct, indirect, optional and build dependencies with their actual license/copyright files. qpdf-wasm wrapper is ISC, qpdf is Apache 2.0. Lucide upstream LICENSE includes Feather MIT notice. Fonts and Unicode retain existing full notices.

Current official sources checked:
- https://performance-partners.apple.com/search-api
- https://developers.cloudflare.com/workers-ai/platform/data-usage/
- https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia
- https://lucide.dev/license
- https://open-meteo.com/en/license

Important existing limitation: Apple requires promotional-only use and a nearby badge linking to the promoted content. The owner previously requested the diary song-card credit row removed. Settings text and its generic badge do not fix that placement requirement. This release says so and does not claim legal clearance. Commons metadata also cannot guarantee a file's legal status or clear personality/trademark rights.

Synthetic actual-Settings rendering passed 320/390/820 in paper/midnight: starts collapsed, keyboard Enter toggle, sections visible on expansion, local notice links return non-HTML text, no horizontal overflow, Sign out remains last and callable. Screenshots inspected. No real accounts, diary/chat rows, PINs or push subscriptions used. No physical phone testing.
