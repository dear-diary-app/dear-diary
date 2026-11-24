# Slash command discovery

The composer shows a compact list above itself for an initial slash and command-prefix characters only. Commands audited from the live parser code: /1year, /ask, /ddai-, /image-, /music-, /weather. No invented slash aliases for GIFs or Translate. Prefix filtering is case-insensitive. Arguments, whitespace, unknown prefixes and ordinary text hide the list. Tap fills only; focus/caret returns to the end of the composer. /ask and /ddai- add a trailing space. No command is sent or executed by picking it. Escape or Close hides it until the prefix changes.

DDAI reads account preferences and shows a disabled Off in Settings or Checking AI settings state until enabled. No AI request or quota consumption is made by this list. List is absent during edits, attachments, recording, profile/tray, translation/DDAI dialogs and Send options. Normal Send and Send-hold retain existing behavior.

Synthetic actual ChatView checks passed 320/390/820 paper/midnight: all six entries, prefix filter, selection fill/focus without sending, DDAI off/on, Escape, ordinary typing, regular Send, Send options and no overflow or AI calls. Screenshots inspected. TypeScript/build checked. No real user accounts/content, PINs or push touched; no physical-phone test.
