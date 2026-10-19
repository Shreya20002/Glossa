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
 │ FrameBuffer → Silero VAD (ONNX) → src/core metrics     │
 └────────────────────────────────────────────────────────┘
                 main broadcasts metrics to every window
 ┌──────────────── Overlay window (renderer) ─────────────┐
 │ ● 64% talk · 4:05 time · ■                             │
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
   512-sample frames (`frameBuffer.ts`) and asks **Silero VAD**
   (`sileroVad.ts`): "how likely is this frame to be speech?". It takes about
   0.3 ms per frame.
5. **Metrics**: each probability goes into `src/core/session.ts`, which turns
   probabilities into speech start/end events (`voiceActivity.ts`) and keeps
   the talk-time totals (`talkTime.ts`).
6. **Display**: four times a second, and whenever speech starts or stops, the
   engine sends `LiveMetrics` to the main process, which broadcasts them to
   every window.
7. **Forget**: the audio frame is dropped. Nothing is written to disk.

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

## The session lifecycle

`src/main/session.ts` runs one session at a time:

```
idle ──Start──► starting ──engine ready──► live ──Stop──► stopping ──► idle
                 │ (models missing,                │ (engine error)
                 │  mic denied, engine failed)     │
                 └────────────► idle ◄─────────────┘
```

On start it checks that the models exist, asks macOS for microphone permission
(`permissions.ts`), waits for the engine to load the model, and opens the
overlay. A session ends when you press Stop in either window, close the app
window, or close the overlay, or when the engine reports an error. Every window
is then told why with a `session:ended` message.

## Security layers

| Layer                         | Where                                  | What it stops                                                                |
| ----------------------------- | -------------------------------------- | ---------------------------------------------------------------------------- |
| Content Security Policy       | each `index.html`                      | Pages loading code or connecting anywhere outside Glossa                     |
| Request filter                | `security.ts` → `blockNetworkRequests` | Any request that would leave the computer                                    |
| Permission handler            | `security.ts` → `isMicrophoneRequest`  | Everything except microphone access for Glossa's own pages (no camera, ever) |
| IPC sender check              | `security.ts` → `isTrustedSender`      | Messages from anything that isn't a Glossa page                              |
| Sandbox and context isolation | `windows.ts`                           | Page code reaching Node.js or Electron directly                              |
| Lint rules                    | `eslint.config.mjs`                    | Network code or impure imports being merged at all                           |

## Models

Models are **not** in git. `pnpm fetch-models` downloads each one from a pinned
commit and verifies its SHA-256 checksum (`scripts/fetch-models.mjs`).
Installers bundle them in the app's `resources/models` folder. In development
they're read from `models/` in the project folder (`modelsDir()` in
`src/main/engine.ts`).

| Model             | Size   | Used for         | License |
| ----------------- | ------ | ---------------- | ------- |
| Silero VAD v6.2.3 | 2.3 MB | Detecting speech | MIT     |

## Platforms

- **Windows 10/11 (x64)** and **macOS on Apple Silicon**. onnxruntime-node has
  no build for Intel Macs.
- **Linux** works for development and unit tests, but isn't packaged, and the
  end-to-end test needs Windows or macOS text-to-speech.

## Testing at each layer

| Test                | Command                           | Covers                                                                                                                                                              |
| ------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit                | `pnpm test`                       | `src/core` metrics, the frame buffer, security rules                                                                                                                |
| End-to-end          | `pnpm test:e2e`                   | The real app: Playwright clicks Start while Chromium's **fake microphone** plays a speech clip made by the OS's text-to-speech, then checks the overlay and summary |
| Packaged end-to-end | CI only (`GLOSSA_E2E_PACKAGED=1`) | The same test against the packaged app on Windows and macOS: proves models and native files are bundled correctly                                                   |
