# Header pin shortcut

The pinned banner/list has been replaced by a small pin emoji immediately left of chat status. No active pin means no icon. Pins remain shared, sorted newest first; successive successful taps cycle through them and the existing jump highlight identifies the target. Removing/expiring the last visited pin restarts at the newest. Duplicate taps are locked during a jump. Existing older-message pagination is retained (up to 20 pages loaded per attempt), with an error/retry if unavailable. Pin duration choices and message-menu Unpin are unchanged. The shortcut is hidden during message selection; the pin component remains mounted so the duration dialog and shared pin state work.

No backend/data/notification changes. Synthetic tests passed 320/390/820 in paper/midnight: no banner, icon left of status, cyclic jumps/highlight, pin/unpin, no pins hidden, no overflow. No real accounts/content used. No physical-phone testing.
