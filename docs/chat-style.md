# Chat style

Settings contains an account-and-browser-local Chat style fold, beside AI features. Fresh settings attach no styling attributes, so existing chat defaults remain unchanged. Reset / Default is the last button in the fold and removes the whole saved record, including the optional photo.

Controls: default/Noto Serif/Nunito/Roboto Mono; small/normal/large message text; normal/medium weight; default/rose/sage/blue/violet accents; default/cream/blue/lilac/sunset backgrounds or a local photo; composer-side swap. The font and weight apply to messages and the composer. Small composer text stays 16px to avoid phone focus zoom. Backgrounds are limited to the message area, not system bars or safe-area padding.

Saved under dd_chat_style_v1_<account> in localStorage. No backend table, uploads or partner settings. Photo input accepts images up to 20MB, decodes locally, resizes to at most 1280px and stores a JPEG under 1.5MB. Re-encoding strips source metadata. Remove photo and Reset delete the saved image. Storage denial/quota failure leaves prior settings and reports an error. These are browser-local preferences, not secure storage; clearing site data removes them.

Bundled fonts: existing Noto Serif and Noto Serif Bengali, plus unmodified Nunito and Roboto Mono variable TTFs from the Google Fonts repository, under SIL OFL 1.1. Full copyright/licence files are in public/fonts and linked from Rules & precautions.
Sources:
- https://github.com/google/fonts/tree/main/ofl/nunito
- https://raw.githubusercontent.com/google/fonts/main/ofl/nunito/OFL.txt
- https://github.com/google/fonts/tree/main/ofl/robotomono
- https://raw.githubusercontent.com/google/fonts/main/ofl/robotomono/OFL.txt

QA: synthetic ChatView and settings at 320/390/820 widths in paper/midnight. Save/reload/reset, photo local encoding/no POST or PUT/account isolation, custom fonts actually load, swapped attachment/menu bounds, slash discovery, send-hold dialog, Blur 3-second reveal, 24 Bubbles, DDAI-disabled private guard. Default screenshot bytes identical after removing opt-in CSS. System meta colour, body, chat background and bottom padding unchanged after customization. Previews visually inspected. No real accounts/messages/PINs/push touched. Physical-phone gallery, keyboard and installed-mode interaction remain unverified.
