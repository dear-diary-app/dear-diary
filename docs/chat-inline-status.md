# Inline delivery/read status

The latest outgoing message keeps its existing status eligibility. Sent or Seen is now inside the message bubble, immediately before the timestamp metadata, rather than in a separate paragraph below it. Seen uses the existing read receipt; the timestamp remains the message's send time. Incoming messages and older outgoing messages retain their previous timestamp-only layout.

Sending and Not sent also appear inline. Failed messages retain Retry and Delete below the bubble. No read-receipt or transport logic changed.

Synthetic actual-Row QA at 320/390/820px in paper and midnight verified Sent, Seen, a live Sent-to-Seen update in the same metadata row, Sending, failed Retry/Delete, incoming/older timestamp-only, edited metadata, and no horizontal overflow. No private messages or accounts were used. Theme-color and safe-area colours unchanged.
