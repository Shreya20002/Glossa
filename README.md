# Glossa

**An invisible speech coach just for you.**

Glossa sits quietly on your screen while you talk — in interviews, meetings,
sales calls, classes, or practice runs — and tells you, live, how you're doing.
It listens only to your microphone, runs entirely on your computer, and never
sends anything anywhere.

[![CI](https://github.com/Shreya20002/glossa/actions/workflows/ci.yml/badge.svg)](https://github.com/Shreya20002/glossa/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

> 🚧 **Status: pre-release.** Glossa is being built in the open. There is no
> installer yet — watch or star the repo to hear when v0.1.0 ships.

<!-- Demo GIF goes here once the overlay exists (Step 7 of the build plan). -->

## What it does

Glossa v1 does five things, and does them well:

| Feature                      | What you see                                                                                                                 |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 🎙️ **Talk-time meter**       | How much of the session you've spent speaking, plus a "speaking now" dot.                                                    |
| ⏱️ **Pace**                  | Your words per minute, with a gentle hint when you're rushing or dragging.                                                   |
| 🔁 **Filler-word counter**   | "um", "uh", "you know", "basically"… counted live, with your top offenders.                                                  |
| 🗣️ **Monologue alert**       | A soft pulse when you've been talking for over a minute without a break.                                                     |
| 📋 **Post-call report card** | A summary of the session compared with last time — e.g. _Filler words: 32 → 9_. Copy it as an image and share your progress. |

**How accurate is it?** On recordings of real meetings, Glossa catches
**99% of ums and uhs** (96% of what it reports is right). The benchmark is open:
see [eval/README.md](eval/README.md) and run it yourself with `pnpm eval`.

That's it — on purpose. New features get added when users ask for them
(see [Roadmap](#roadmap)).

## Why Glossa is different

- **Private by design.** Your audio never leaves your computer and is never
  saved. Only the numbers on your report card are stored, on your machine.
- **Works offline.** The speech models ship inside the app. No account, no API
  key, no internet connection required.
- **Invisible to others.** The overlay is hidden from screen sharing on
  operating systems that support it, so only you see your coach.
- **Mic-only.** No meeting-app plugins or system audio hacks — it works the same
  with Zoom, Meet, Teams, a phone call, or no call at all.
- **Free and open source.** Apache-2.0 licensed. No subscription, ever.

## Install

Not released yet. When v0.1.0 ships, installers for **Windows 10/11** and
**macOS on Apple Silicon** (M1 or newer) will be on the [Releases page](https://github.com/Shreya20002/glossa/releases).

> **Heads-up:** early releases are not code-signed, so Windows and macOS will
> show a warning the first time you open Glossa. Instructions for getting past
> it safely will be included with the release.

**Tip:** use headphones. Glossa measures _your_ voice from your microphone; if
the other people on your call come out of your speakers, the mic hears them too.

## Roadmap

Glossa v1 is deliberately small. Ideas that are **not in v1 (yet)**:

- Ghost notes (private talking points on the overlay)
- Agenda timer
- Two-sided talk ratio using system audio
- Custom filler-word lists and other languages
- More settings (pace targets, monologue length)

Want one of these, or something else? Upvote an existing
[feature request](https://github.com/Shreya20002/glossa/issues?q=is%3Aissue+label%3Aenhancement)
or open a new one. The most-requested ideas get built next.

## Contributing

Contributions of all sizes are welcome — bug reports, docs, filler words from
your dialect, test recordings, and code. Start with
[CONTRIBUTING.md](CONTRIBUTING.md). Everyone taking part agrees to our
[Code of Conduct](CODE_OF_CONDUCT.md).

Curious how it works? See [docs/architecture.md](docs/architecture.md) and
[docs/privacy.md](docs/privacy.md).

Found a security problem? Please report it privately — see [SECURITY.md](SECURITY.md).

## License

Glossa is licensed under the [Apache License 2.0](LICENSE).

_The name: γλῶσσα (glôssa) is Ancient Greek for "tongue" and "language"._
