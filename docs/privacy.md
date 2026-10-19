# Privacy

Glossa's promise: **your voice never leaves your computer, and is never saved.**
This page lists exactly what Glossa handles, where it goes, and how the promise
is enforced, so you can check it rather than take our word for it.

## What Glossa handles

| Data                                                                                           | Where it lives                                                                                  | How long                                                                                                                                                                      |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Microphone audio**                                                                           | Memory only: the app window → the engine process                                                | The most recent **30 seconds** are kept in memory, so a finished phrase can be transcribed; older audio is overwritten. Cleared when the session ends. Never written to disk. |
| **What you said** (the transcript)                                                             | Memory, inside the engine                                                                       | **Reduced to word and filler counts immediately**: the text itself is never kept, shown or saved.                                                                             |
| **Live numbers** (talk time, pace, filler counts, elapsed time)                                | Memory                                                                                          | Until the session ends                                                                                                                                                        |
| **Session summary** (duration, speaking time, talk %, word count, average pace, filler counts) | Memory today. The report card in a later version will save these numbers on your computer only. | —                                                                                                                                                                             |
| **Your microphone choice**                                                                     | Local app storage on your computer                                                              | Until you change it                                                                                                                                                           |

Glossa has no accounts, no analytics, no crash reporting and no update checks.

## How the promise is enforced

- **No network at all.** Every request a Glossa window makes is checked; any
  that would leave the computer is cancelled (`src/main/security.ts`). Each page
  also carries a Content Security Policy that refuses outside connections.
- **No network code can be merged.** Lint rules reject `fetch`, WebSockets,
  HTTP modules and similar anywhere in the app's source (`eslint.config.mjs`).
- **Microphone only.** Glossa grants itself exactly one permission, the
  microphone, and only for its own pages. Camera, location, notifications,
  screen capture and everything else are denied.
- **Models run locally.** The speech models (Silero VAD for detecting speech,
  Whisper for turning it into words) ship inside the app and run on your CPU.
  They were downloaded once, at build time, from pinned sources with verified
  checksums, and the speech recognizer is set to load from disk only, never the
  internet.

## Permissions you'll see

- **macOS** asks once: _"Glossa would like to access the microphone."_ You can
  change your answer in System Settings → Privacy & Security → Microphone.
- **Windows** has no per-app prompt for desktop apps. If microphone access is
  off in Settings → Privacy & security → Microphone, Glossa shows how to turn it
  on.

## Other people on your call

Glossa listens to your microphone only. It can't hear the other side of a call
unless their voices come out of your speakers and back into the microphone.
Headphones avoid that.

Found something that contradicts this page? That's a security issue: please
report it privately as described in [SECURITY.md](../SECURITY.md).
