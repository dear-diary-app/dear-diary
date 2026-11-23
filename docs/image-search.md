# Chat image search

Reviewed 23 November 2026.

`/image-subject` searches Wikimedia Commons through its official, unauthenticated MediaWiki API. Parenthesized subjects also work. This version deliberately does not combine Openverse: its terms require independently checking licenses and each third-party hosting platform's terms. No Pinterest or website scraping is used. No API key is needed.

## Source and license handling

- API browser CORS: https://www.mediawiki.org/wiki/API:Cross-site_requests
- Request batching, serial requests, caching and descriptive API user agent: https://www.mediawiki.org/wiki/API:Etiquette
- File URLs and formatted license metadata: https://www.mediawiki.org/wiki/API:Imageinfo
- Metadata caveats: https://commons.wikimedia.org/wiki/Commons:Machine-readable_data/en
- Reuse and hotlinking: https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia
- CC BY: https://creativecommons.org/licenses/by/4.0/
- CC BY-SA: https://creativecommons.org/licenses/by-sa/4.0/
- Openverse comparison: https://docs.openverse.org/terms_of_service

Suggestions load only raster JPEG, PNG and WebP files with a named artist, Commons source page, recognized CC BY / CC BY-SA (2.0, 2.5, 3.0, 4.0), CC0 or public-domain mark link, and no indicated restrictions. Unknown licenses, missing credits, unsupported hosts/types and captions too long to retain intact are omitted. This is conservative metadata validation, not a legal guarantee; Commons also disclaims the accuracy of supplied licenses. Other personality, privacy or trademark rights can apply. Search is not guaranteed to find exact branded products. Commons is not a curated safe-search collection.

Thumbnails load from Wikimedia with no referrer. A selection downloads the thumbnail, uses the existing image preparation to re-encode/resize it to JPEG, and passes it into the existing `sendImages` path. The recipient loads the chat copy from the app's private image bucket, not Wikimedia. The attached caption preserves title, author, extra credit/usage/copyright metadata, license URL, source URL, and a resize/compression notice. CC BY-SA images retain their original license. The caption is part of the photo message and is not editable in the current UI, so normal edits cannot remove the credit. No new database field, bucket, permission or privacy rule is used. Reply, pin, viewer, retry and unsend use the normal image-message behavior. Viewer uses the existing image-only view; the credit remains directly under the photo in the conversation.

Only the active search text and normal network metadata reach Wikimedia; no chat history or account token is sent. Search begins after 800 ms, with at least 3 seconds between serial requests, 12 results per request and a small in-memory cache. Abort stale queries; show retry states on failure. HTTP 429 and API rate-limit errors apply a minimum 60-second pause. Selected-image preparation has a 15-second timeout and 12 MB download guard. Changing the query or leaving the picker prevents an old in-flight selection from sending.

Synthetic QA covers all six themes at 390/820 widths, no horizontal overflow, debounce, image re-encoding, caption preservation, viewer, reply, pin choices, unsend, double tap, empty/network/rate-limit states, unsafe license/host rejection and inert HTML metadata parsing. Live API and thumbnail CORS are checked separately without accessing private chat data. Physical Android/iOS testing is not claimed.
