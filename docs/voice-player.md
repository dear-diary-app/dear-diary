# Voice player

Voice notes use play, a seekable waveform, and playback speed in one row. A compact elapsed/total time sits underneath; there is no separate range bar.

Tap the wave to seek. In chat, a single-tap seek waits 300ms to distinguish it from a double tap. A stationary double tap on the voice player adds a red-heart reaction, never removes an existing heart, and does not seek. Play and speed buttons are excluded. Keyboard users can focus the wave and use arrows (5 seconds), Home, or End. Movement, cancellation, scrolling, and long presses do not count as double taps. Recorder preview uses the same seekable player but does not have a reaction callback.

QA uses synthetic audio and mock storage responses, never private recordings. Verified at 320/390/820px in paper and midnight: no separate range input, forward/backward waveform seeking, keyboard seek, playback speed, play/pause, no overflow. Verified the real chat Row with repeated double taps: one heart action, no toggling off. Theme-color and safe-area colours unchanged. No physical-device audio test claimed.
