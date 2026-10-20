# How Glossa works

This page explains how Glossa turns microphone audio into live coaching. Read
it before changing anything in `src/`.

## The big picture

Glossa runs as four kinds of process. Each one does one job, and they talk only
by sending messages.

```
 ┌──────────────── App window (renderer) ────────────────┐
 │ Microphone → AudioWorklet → 32 ms chunks of audio      │
 └───────────────┬────────────────────────────────────────┘
                 │ window.glossa.pushAudio()   (IPC, ~30 per second)
 ┌───────────────▼───────── Main process ─────────────────┐
 │ Checks the sender, forwards audio, manages the session │
 └───────┬───────────────────────────────▲────────────────┘
         │ postMessage                   │ metrics, 4× per second
 ┌───────▼────────── Engine (utility process) ────────────┐
 │ FrameBuffer → Silero VAD → src/core (talk time, chunks)│
 │      finished phrase ─► Whisper ─► word + filler counts │
 └────────────────────────────────────────────────────────┘
                 main broadcasts metrics to every window
 ┌──────────────── Overlay window (renderer) ─────────────┐
 │ ● 64% talk · 152 wpm · 3 fillers · 4:05 time · ■       │
 └────────────────────────────────────────────────────────┘
```

| Process            | Code                    | Why it's separate                                                                                                              |
| ------------------ | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **App window**     | `src/renderer/app/`     | Picks the microphone and captures it. A web page, sandboxed, with no Node.js access.                                           |
| **Overlay window** | `src/renderer/overlay/` | Shows the live numbers. Display only: it never touches audio.                                                                  |
| **Main process**   | `src/main/`             | The only part with full access to the computer: windows, permissions, security rules. Kept light so the UI stays responsive.   |
| **Engine**         | `src/engine/`           | Runs the AI models. A hidden Node.js process, so heavy work never freezes a window, and a crash there can't take the app down. |

## Following one chunk of audio

1. **Capture**: `src/renderer/audio/microphone.ts` opens the microphone with
   `getUserMedia` inside an `AudioContext` running at **16 kHz**. Chromium
   resamples the microphone to that rate, which is what the models expect.
2. **Chunking**: `capture.worklet.ts` runs on the browser's real-time audio
   thread. It gathers samples into **512-sample chunks (32 ms)** and posts each
   one to the page.
3. **Bridge**: the page calls `window.glossa.pushAudio(chunk)` (defined in
   `src/preload/index.ts`). The main process checks that the message came from a
   Glossa page and is a sensible size (`src/main/ipc.ts`), then forwards it to
   the engine.
4. **Detection**: the engine (`src/engine/index.ts`) cuts the audio into exact
   512-sample frames (`frameBuffer.ts`), remembers the last 30 seconds
   (`audioHistory.ts`), and asks **Silero VAD** (`sileroVad.ts`): "how likely is
   this frame to be speech?". That takes about 0.3 ms per frame.
5. **Metrics**: each probability goes into `src/core/session.ts`, which turns
   probabilities into speech start/end events (`voiceActivity.ts`), keeps the
   talk-time totals (`talkTime.ts`), follows turns for the monologue alert
   (`monologue.ts`), and groups speech into phrases (`speechChunks.ts`).
6. **Transcription**: when a phrase ends, its audio is cut out of the history
   and handed to **Whisper** (`speechRecognizer.ts`), which runs in the
   background without holding up speech detection. The text is reduced to
   word and filler counts (`transcript.ts`, `words.ts`, `fillers.ts`) and fed
   back into the session for pace (`pace.ts`) and fillers.
7. **Display**: four times a second, and whenever speech starts or stops or a
   phrase is transcribed, the engine sends `LiveMetrics` to the main process,
   which broadcasts them to every window.
8. **Forget**: audio older than 30 seconds is overwritten, and transcripts are
   never kept, only their word and filler counts. When a session ends, only its
   final numbers are saved (see [Report card](#report-card-and-history)).

## Why `src/core` is pure

Everything that decides _what the numbers are_ lives in `src/core/`, with no
Electron, Node or browser APIs. This has three benefits:

- **Fast, exact tests.** A test can feed in "100 frames of speech, then 100 of
  silence" and check that talk time is exactly 50%. No microphone, model or
  waiting needed.
- **Audio time, not wall-clock time.** Durations are counted in frames
  processed (1 frame = 32 ms), never from the system clock, so a session
  replays identically every time. ESLint enforces this: `Date.now()` is banned
  in `src/core`.
- **Easy to contribute.** Changing how fillers are counted shouldn't require
  understanding Electron.

## Speech detection, in plain English

Silero VAD gives a probability between 0 and 1 for every 32 ms frame. Raw
probabilities flicker, so `voiceActivity.ts` smooths them:

- **Two thresholds (hysteresis).** Speech _starts_ above 0.5 but only _ends_
  below 0.35. Values in between keep whatever state we're already in.
- **Minimum speech: 96 ms.** A cough or a click shorter than three frames is
  ignored.
- **Silence hangover: 320 ms.** Speech only ends after a third of a second of
  silence, so gaps between words don't split a sentence.
- **Backdating.** Events are stamped with when speech _really_ started or
  stopped, not when we became sure. So the hangover isn't counted as speaking.

All four numbers are named constants with comments explaining them. Change
them only with tests showing why.

## Speech recognition and pace

Whisper turns speech into text, and Glossa counts the words. Feeding it well is
most of the work, because Whisper has two habits (see the spike below):

- **It invents words for silence and tiny snippets.** One second of silence
  comes back as "you", and half a second of speech as "Thanks for watching."
- **Every call costs about 0.6 s**, whatever the length, because it always
  processes a 30-second window.

So `speechChunks.ts` groups speech into **phrases** before anything is
transcribed:

| Rule                                        | Value | Why                                                                                            |
| ------------------------------------------- | ----- | ---------------------------------------------------------------------------------------------- |
| A pause this long ends a phrase             | 2 s   | Shorter pauses are part of how someone talks; longer ones usually mean someone else is talking |
| Close a long phrase at the next pause after | 12 s  | So pace keeps updating during a monologue                                                      |
| Hard limit, even mid-speech                 | 25 s  | Whisper can't take more than 30 s at once                                                      |
| Skip phrases with less speech than          | 1 s   | That's where Whisper invents words                                                             |

Only speech ever reaches Whisper, never silence, and each phrase gets 200 ms of
padding on each side so its first and last words are heard whole.

**Pace** (`pace.ts`) is words ÷ the time spent saying them, over the phrases
spoken in the **last minute**. Natural pauses inside a phrase count, but the
silences between turns don't, which matches how public-speaking advice measures
pace. It shows nothing until there are at least 5 seconds of speech to judge
from. Bands: **under 110 wpm is slow, over 170 is fast**. Conversational English
is typically 120–150, and presentations 130–160.

Every word counts, including "um", because fillers take time to say too.

## Choosing the speech recognizer (spike, October 2026)

Before building pace, a short experiment compared Whisper setups running
locally through [transformers.js](https://github.com/huggingface/transformers.js).
Four clips with known text were made with Windows text-to-speech: plain speech,
vocal fillers (um/uh), lexical fillers ("you know", "basically"…) and very fast
speech (about 470 wpm).

| Setup                   | Word count at normal pace | um/uh kept | Word errors, fast clip | Time per 15 s clip | Peak memory |
| ----------------------- | ------------------------- | ---------- | ---------------------- | ------------------ | ----------- |
| **tiny.en** ✅          | exact                     | **5 of 5** | 24%                    | **~1.9 s**         | **515 MB**  |
| tiny.en + filler prompt | exact                     | 5 of 5     | 41%                    | ~2.0 s             | 517 MB      |
| base.en                 | exact                     | **0 of 5** | 17%                    | ~2.8 s             | 664 MB      |
| base.en + filler prompt | exact                     | 0 of 5     | 17%                    | ~3.1 s             | 686 MB      |

**Decision (Step 3): Whisper tiny.en, no prompt.** tiny.en was word-perfect at
normal pace, about 1.5× faster than base.en, and used about 150 MB less memory.

**Running it with one CPU thread** was as fast as using all of them (~1.4 s for
10 s of speech either way), because this small model can't split its work
across cores well. It used about **a third of the CPU time**, leaving room for
the meeting app.

**Also considered:** sherpa-onnx (prebuilt, supports Whisper and Moonshine).
It wasn't needed, and it would have added a second copy of onnxruntime.

**Revised in Step 4:** the "um/uh kept" column above turned out to be
misleading. Text-to-speech says "um" crisply, like a word. On **real** meetings,
tiny.en without a prompt caught **0 of 65** ums and uhs. A different prompt
fixed it (see [Filler words](#filler-words) below), and tiny.en stayed the
choice: with that prompt it caught slightly more fillers than base.en.

## Filler words

`src/core/fillers.ts` finds two kinds of filler in each phrase's transcript:

- **Vocal fillers**, hesitation sounds, always count: um, uh, er, erm, ah, hmm,
  and spellings like "umm" or "uhm". Agreement sounds ("uh-huh", "mm-hmm") don't.
- **Lexical fillers** are real words that are only fillers in some positions.
  The rules use the punctuation Whisper adds, and lean towards _not_ counting:

  | Counted                                              | Not counted                                  |
  | ---------------------------------------------------- | -------------------------------------------- |
  | "it's, **like**, simpler" (followed by a comma)      | "I _like_ it", "what's it _like_?"           |
  | "it's, **you know**, hard" (followed by punctuation) | "_do_ you know the answer?", "_as_ you know" |
  | "**I mean**, it's fine" (followed by a comma)        | "I _mean_ it", "what I _mean_ is"            |
  | "it's **kind of** slow"                              | "_what_ kind of car", "_a_ sort of tool"     |
  | **basically**, **literally** (always)                | —                                            |

The transcript is reduced to counts (`transcript.ts`) the moment it arrives,
and the text is dropped.

### Keeping Whisper's ums: the prompt

Whisper is trained on cleaned-up transcripts, so out of the box it deletes
hesitations. On real meetings, tiny.en caught **0 of 65** ums and uhs.

Whisper accepts a **prompt**: text it treats as "what was said just before",
whose style it tends to continue. The widely shared filler prompt
("Umm, let me think like, hmm…") only reached 23%, because it teaches the wrong
spellings. A plain sentence containing "um" and "uh", with **no topic words**
so it can't bias the content, did far better:

> Um, so, uh, I was thinking that, um, we could, uh, try it.

That's `FILLER_PROMPT` in `src/engine/speechRecognizer.ts`. A prompt that
mentioned "remote design" scored well too, but was rejected: the benchmark
meetings are about designing a remote control, so it would have been cheating.

### Safety nets

Prompts can occasionally send Whisper into a loop ("the second part of the
second part of the second part…"). In one test, that turned 91 spoken words
into 247 and pace into 377 wpm. Two guards in `transcript.ts` now apply to
every transcript, whatever the prompt:

- **Loop removal:** a phrase repeated more than twice in a row (or a word more
  than three times) is kept once. Real repetition like "um, um" or "no no no"
  stays.
- **Plausibility check:** a phrase with more than **400 words per minute** is a
  recognition glitch and is ignored, so it can't distort pace or fillers.

### How accurate is it?

`pnpm eval` runs the real pipeline over clips of real meetings with
hand-made transcripts (see [eval/README.md](../eval/README.md)). On 8 meetings
never used for any decision:

|                 | Recall (caught)    | Precision (correct)          |
| --------------- | ------------------ | ---------------------------- |
| um, uh…         | **99%** (79 of 80) | **96%**                      |
| like, you know… | 100% (5 of 5)      | 71% (5 of 7, a small sample) |

Known limits: Whisper sometimes swaps "um" and "uh" (the total stays right),
and lexical fillers are rare in the benchmark, so their numbers are rough.

### The `sharp` stand-in

transformers.js also supports image models, so it loads the `sharp` image
library at startup and refuses to start without it. Glossa never touches
images, so `package.json` swaps in a tiny stand-in (`stubs/sharp/`, explained
in its README) instead of shipping about 20 MB of native image code.

## Monologue alert

`src/core/monologue.ts` follows **turns**: stretches of talking where every
pause is short. A breath or a "so…" doesn't hand over the floor, but two seconds
of silence gives someone else room to come in, and ends the turn.

| Rule                                   | Value | Why                                                                       |
| -------------------------------------- | ----- | ------------------------------------------------------------------------- |
| A pause this long ends a turn          | 2 s   | Pauses inside a turn are usually under a second; 2 s is room to reply     |
| A turn longer than this is a monologue | 60 s  | A common coaching rule of thumb: after about a minute, listeners tune out |

While the current turn is over a minute, the overlay **pulses**: a soft ring
grows and fades around the pill until you pause, and the app window says how
long you've been talking. There's **no sound**, because the microphone would
hear it. If your system is set to reduce motion, the ring stays still instead.

The summary shows your **longest turn**, and how many went over a minute. A turn
includes its short pauses, so the longest turn can be longer than your total
speaking time.

Glossa hears only you, so it can't tell whether anyone actually spoke during a
pause: any 2-second pause counts as giving them the chance.

## Report card and history

When a session ends, the main process saves its final numbers and sends every
window a **report card**: the session's numbers, how they compare with the
previous saved session, and a trend of recent ones.

**Saving** (`src/main/history.ts`): each session becomes one line of JSON in
`sessions.jsonl`, in Glossa's data folder (`%APPDATA%\Glossa` on Windows,
`~/Library/Application Support/Glossa` on macOS). Lines are only ever appended,
so a crash can at worst cut the last one short. Reading checks every field of
every line (`src/core/sessionRecord.ts`) and skips anything damaged or edited
into nonsense. Sessions with less than **5 seconds** of speech aren't saved, so a
quick microphone check never becomes "last time". What's in a line is listed in
[privacy.md](privacy.md): numbers only, never audio or words.

**Comparing** (`src/core/report.ts`): each number is compared at the precision
it's shown (whole percentages, whole seconds), and only called better or worse
where there's a right direction:

| Number       | Better when…                                                       |
| ------------ | ------------------------------------------------------------------ |
| Talk time    | Never judged: presenting and listening both have their place       |
| Pace         | It moves towards the comfortable range (110–170 wpm)               |
| Filler words | There are fewer per minute (needs 30 s of speech for a rate)       |
| Longest turn | Less of it is over a minute; shorter turns under a minute are fine |

Each change shows an arrow and, when it's judged, the word "better" or "worse"
as well as a colour, so it never relies on colour alone.

**Trend**: a sparkline of fillers per minute over the last 10 saved sessions,
starting from zero so the line heads down as fillers fade.

**Copy as image**: the page sends the card's position, and the main process
captures just that part of the asking window (`webContents.capturePage`) and
puts it on the clipboard as a PNG. The area is checked and kept inside the
window (`captureArea.ts`), so a page can only ever copy itself.

At startup, the app window asks for the latest saved report card, so your last
results are there when you open Glossa.

## The session lifecycle

`src/main/session.ts` runs one session at a time:

```
idle ──Start──► starting ──engine ready──► live ──Stop──► stopping ──► idle
                 │ (models missing,                │ (engine error)
                 │  mic denied, engine failed)     │
                 └────────────► idle ◄─────────────┘
```

On start it checks that the models exist, asks macOS for microphone permission
(`permissions.ts`), waits for the engine to load both models, and opens the
overlay. On stop, the engine transcribes the last phrase before sending the
summary, so the final sentence counts. A session ends when you press Stop in
either window, close the app window, or close the overlay, or when the engine
reports an error. Every window is then told why with a `session:ended` message.

## Security layers

| Layer                         | Where                                  | What it stops                                                                          |
| ----------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------- |
| Content Security Policy       | each `index.html`                      | Pages loading code or connecting anywhere outside Glossa                               |
| Request filter                | `security.ts` → `blockNetworkRequests` | Any request that would leave the computer                                              |
| Permission handler            | `security.ts` → `isMicrophoneRequest`  | Everything except microphone access for Glossa's own pages (no camera, ever)           |
| IPC sender check              | `security.ts` → `isTrustedSender`      | Messages from anything that isn't a Glossa page                                        |
| Copy-as-image limits          | `ipc.ts`, `captureArea.ts`             | A page capturing anything other than part of its own window                            |
| Sandbox and context isolation | `windows.ts`                           | Page code reaching Node.js or Electron directly                                        |
| Local-only model loading      | `speechRecognizer.ts`                  | transformers.js downloading anything (`allowRemoteModels = false`, `local_files_only`) |
| Lint rules                    | `eslint.config.mjs`                    | Network code or impure imports being merged at all                                     |

## Models

Models are **not** in git. `pnpm fetch-models` downloads each file from a pinned
commit and verifies its SHA-256 checksum (`scripts/fetch-models.mjs`).
Installers bundle them in the app's `resources/models` folder. In development
they're read from `models/` in the project folder (`modelsDir()` in
`src/main/engine.ts`).

| Model                             | Size    | Used for                 | License    |
| --------------------------------- | ------- | ------------------------ | ---------- |
| Silero VAD v6.2.3                 | 2.3 MB  | Detecting speech         | MIT        |
| Whisper tiny.en (ONNX, quantized) | 43.5 MB | Speech to text (7 files) | Apache-2.0 |

## Platforms

- **Windows 10/11 (x64)** and **macOS on Apple Silicon**. onnxruntime-node has
  no build for Intel Macs.
- **Linux** works for development and unit tests, but isn't packaged, and the
  end-to-end test needs Windows or macOS text-to-speech.

## Testing at each layer

| Test                | Command                           | Covers                                                                                                                                                                                                                                                                                                                                      |
| ------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit                | `pnpm test`                       | `src/core` metrics (talk time, phrases, pace, word and filler counts, turns, report card comparisons, saved-session checks), the history file, the frame buffer and audio history, security rules                                                                                                                                           |
| End-to-end          | `pnpm test:e2e`                   | The real app, with a fresh data folder: Playwright clicks Start while Chromium's **fake microphone** plays a speech clip made by the OS's text-to-speech, then checks talk time, pace, fillers, that short sentences raise no monologue alert, the report card and copying it as an image, and that the card is still there after a restart |
| Packaged end-to-end | CI only (`GLOSSA_E2E_PACKAGED=1`) | The same test against the packaged app on Windows and macOS: proves models and native files are bundled correctly. On macOS the test disables only Chromium's _audio_ sandbox, which otherwise can't read the clip file; the app itself never reads audio files.                                                                            |
| Benchmark           | `pnpm eval`                       | Accuracy on real meetings (AMI Meeting Corpus): filler recall and precision, word count and word errors, on a tuning set and a held-out set. See [eval/README.md](../eval/README.md).                                                                                                                                                       |
