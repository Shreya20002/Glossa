# AGENTS.md

Instructions for AI coding agents (Claude Code, Codex, Copilot, Cursor, etc.)
working in this repository. Humans: see [CONTRIBUTING.md](CONTRIBUTING.md) —
the rules below apply to you too.

## What Glossa is

An offline, mic-only desktop speech coach built with Electron + TypeScript +
React. While the user talks, it shows live talk-time, pace (WPM), filler-word
count, and a monologue alert, then a post-call report card. All speech
processing runs locally with prebuilt ONNX models.

**Status:** pre-release, being built step by step. Talk time works end to end;
pace, fillers, monologue alert and report card are next. Some directories below
don't exist yet; don't create them unless your task needs them.

**How it works:** read [docs/architecture.md](docs/architecture.md) before changing `src/`.

## Commands

| Command             | Use                                                                                                                         |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install`      | Install dependencies. Never use npm or yarn.                                                                                |
| `pnpm fetch-models` | Download speech models into `models/` (gitignored). Needed before `dev` and `test:e2e`.                                     |
| `pnpm dev`          | Run the app with live reload.                                                                                               |
| `pnpm check`        | Format check + lint + typecheck + unit tests. **Must pass before you finish.**                                              |
| `pnpm format`       | Auto-fix formatting.                                                                                                        |
| `pnpm test`         | Unit tests (Vitest).                                                                                                        |
| `pnpm test:e2e`     | Build, then end-to-end tests (Playwright drives Electron; Chromium's fake mic plays OS text-to-speech). Windows/macOS only. |
| `pnpm build:unpack` | Build a runnable, unpacked app into `release/` (what CI's build job runs).                                                  |

## Layout

```
src/main/      Electron main process: windows, IPC, storage, security, permissions
src/preload/   contextBridge API exposed to renderers (keep it minimal and typed)
src/engine/    utilityProcess: VAD (Silero) + ASR (Whisper) pipeline
src/core/      PURE TypeScript metrics: talk-time, pace, fillers, monologue, report
src/renderer/  React UIs: overlay/ and app/; audio/ holds the AudioWorklet
src/shared/    Types shared across processes (IPC messages)
scripts/       Dev scripts (e.g. fetch-models with pinned URLs + SHA-256)
e2e/           Playwright end-to-end tests
eval/          Filler-detection benchmark clips and expected counts
docs/          architecture.md, privacy.md, maintainer-guide/
```

Data flow: renderer captures mic → engine (VAD → ASR) → `src/core` metrics →
main process → overlay/app windows over IPC.

## Golden rules (non-negotiable)

1. **No network access.** Do not add telemetry, analytics, remote model
   loading, update checks, CDN assets, or any `fetch`/HTTP call at runtime.
   The only network code allowed is `scripts/fetch-models` (dev/CI time).
2. **Never persist audio.** Audio stays in memory. Transcripts are discarded at
   session end. Only aggregate metrics are written to disk.
3. **`src/core/` is pure.** No imports from `electron`, `node:*`, DOM APIs, or
   the engine. Deterministic functions only — inject time instead of calling
   `Date.now()`.
4. **Stay in v1 scope.** v1 = talk-time, pace, fillers, monologue alert, report
   card, mic picker. Don't add features, settings, or UI that weren't asked for.
5. **Prebuilt dependencies only.** Nothing that needs a C++/Rust/Python
   toolchain at install time. Justify any new dependency in the PR description.
6. **Keep Electron locked down.** `contextIsolation: true`, `sandbox: true`,
   `nodeIntegration: false`, strict CSP, the network block and permission
   handlers in `src/main/security.ts`. Never weaken these.

ESLint enforces rules 1 and 3 (`eslint.config.mjs`). A lint error that cites
AGENTS.md means the code breaks a golden rule: change the code, not the lint
config.

## Code conventions

- TypeScript `strict`. No `any` (use `unknown` and narrow). No non-null `!`
  unless the reason is obvious from the line above.
- Named exports; one concept per file; file names in `camelCase.ts`, React
  components in `PascalCase.tsx`.
- Units in names when ambiguous: `durationMs`, `sampleRateHz`, `wordsPerMinute`.
- Thresholds are named constants with a doc comment explaining the value.
- Match the style of surrounding code; Prettier and ESLint are the source of
  truth — don't disable rules to make them pass.

## Testing

- Every change to `src/core/` needs unit tests next to the file
  (`fillers.ts` → `fillers.test.ts`), including edge cases.
- Bug fixes start with a failing test that reproduces the bug.
- Don't delete or weaken existing tests to make a change pass.

## Commits and pull requests

- Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`,
  `perf:`, `build:`, `ci:`, `chore:`). The PR title must follow it too.
- One logical change per PR. Fill in the PR template, including how you tested.

## Never do these

- Edit `CHANGELOG.md`, version numbers, or release-please files by hand.
- Change `LICENSE`, `NOTICE`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, or GitHub
  workflows unless the task is explicitly about them.
- Commit `models/`, build output, secrets, or binary files.
- Skip, disable, or weaken CI checks, lint rules, or tests.

When something is ambiguous, stop and ask (or explain the open question in the
PR) rather than guessing.
