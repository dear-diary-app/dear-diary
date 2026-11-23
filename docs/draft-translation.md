# Draft translation

Released 23 November 2026 after the owner confirmed Free/no-card/no-Paid and replacement of the screenshot-exposed token. Live synthetic calls passed, including an end-to-end backend call using disposable users that were then deleted. No real chat content was submitted. The backend is fail-closed without its key, account ID and privacy-confirmation flag.

## Data boundary

The browser snapshots only the composer selection, or the current composer draft if nothing is selected. A modal displays the exact text for review/editing before the explicit Translate action. Only `{text,target}` is submitted to the app backend. No chat message, recipient name, sender name, reply, diary content, profile, previous translation or history is attached. Source text may itself contain names or personal facts; the feature cannot remove those without changing the user's text.

The backend authenticates the session, validates a strict two-field schema and requests a content-free quota claim. It sends a fixed translation-editor prompt and only that text to the direct Cloudflare-hosted GLM-4.7-Flash model endpoint. No end-user identifier, IP forwarding, session, or account profile is forwarded. No AI Gateway, logs, storage, caching, tools, web search or batches are enabled by this code. `store:false` is set. Provider errors are replaced with generic codes, never forwarded or logged with content. No request/result table exists. The quota table stores user ID, dates and counts only, inaccessible to app clients. Failed attempts after quota claim still count. Limits: 5/minute, 30/UTC day, each person independently, 2,000 UTF-16 code units/request. Provider free allowance can impose tighter limits.

Results stay in the review modal until Use in draft. That action replaces only the selected range, refuses a changed draft or total length above 2,000, and never sends a message. The ordinary Send button is still needed. Closing or stopping preserves the original draft. Cancelling a network request cannot recall text the provider already received.

## Provider setup

Backend secrets only: `CLOUDFLARE_AI_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `TRANSLATION_PRIVACY_CONFIRMED=true`. The last flag is set only after verifying the account is Free, the model is Cloudflare-hosted, and no stateful gateway/logging features are being used. The token supports Workers AI read/inference; billing and token-policy introspection were denied. Its complete permission list is not independently visible with this token. No Paid upgrade, card, credit purchase or automatic paid fallback.

Cloudflare's policy promises no content retention after standard stateless responses and no training. Operational metadata remains; safety/security/legal exceptions apply. Do not promise absolute deletion under all circumstances. Synthetic real-provider checks passed Bangla, Hindi, English, romanized inputs and same-language polishing. Reasoning is disabled to avoid long latency. A test initially inferred an unstated PM time; the prompt was tightened and the repeat preserved ambiguity. Hindi gender/tense and mixed romanized inputs can still be imperfect. Check provider/model policies again before changing adapters.

## Sources checked 23 November 2026

- Privacy: https://developers.cloudflare.com/workers-ai/platform/data-usage/
- Free plan, 10,000 neurons/day, hard stop without upgrade: https://developers.cloudflare.com/workers-ai/platform/pricing/
- Terms, individual or entity and end-user apps; user should create their own account: https://www.cloudflare.com/terms/
- AI service terms: https://www.cloudflare.com/service-specific-terms-developer-platform/
- Direct API setup: https://developers.cloudflare.com/workers-ai/get-started/rest-api/
- Current model: https://developers.cloudflare.com/workers-ai/models/glm-4.7-flash/
- Alternative current model: https://developers.cloudflare.com/workers-ai/models/qwen3.8-27b/
- Groq unresolved consumer-use eligibility: https://console.groq.com/docs/legal/services-agreement/
- Azure no-trace translation but not AI polishing: https://www.microsoft.com/en-us/translator/business/notrace/
- Cerebras temporary trial, not recurring free: https://inference-docs.cerebras.ai/support/rate-limits

## Verification so far

Synthetic browser network interception passed 320/390/820px in paper and midnight: selected-only payload, preview before applying, no automatic send, preserving surrounding text, empty/whole draft behavior, duplicate action guard, Close/Escape/Back, no horizontal overflow. Error tests: missing provider, rate limit, provider error and stop preserve the draft with no stale result or automatic retry. Backend mock tests: authentication, origin, strict schema/length, quota/configuration gates and no user identifier in outbound payload. Database synthetic rollback tests: minute/day quota and reset, per-person separation, unpaired caller denial, private table and service-only RPC. No actual user data changed, no real account tested, no push sent. No physical-device testing. Production build and TypeScript passed. Live backend returned a translation for a disposable synthetic pair, rejected extra history fields and rejected anonymous callers. All disposable users and their counters were deleted. A deployment wrapper bug discovered by this test was fixed before the UI release.

## In-place flow update

Translate now opens a small language picker. Selecting a language is the explicit request action. Before the first request for each account/browser, a short online-AI notice requires Continue & translate. No provider request occurs merely on opening. Results replace the captured composer selection or whole draft, without a review box. Undo restores the original until the translated draft is edited, cleared, sent or the chat is left. Consent is per account on this browser, and repeats on a different browser or after storage is cleared. No names/history/profile/context are added. The backend/provider/quotas are unchanged. Synthetic UI tests passed both accounts at 320/390/820 in paper/midnight: consent cancellation and double-tap guard, selected payload, replace/undo, remembered consent, rate-limit preservation, Escape/Back, no auto-send or overflow.

The returning-user picker was simplified to only its title, close and three language buttons. First-use consent and post-translation Undo remain.
