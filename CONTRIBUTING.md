# Contributing to Glossa

Thanks for wanting to help! Glossa is a small project, and every contribution
matters — whether it's a typo fix, a bug report, a test recording, or a feature.

This guide explains how to get set up and how changes get from your computer
into Glossa. If anything here is confusing, that's a bug in this guide — please
open an issue or ask in [Discussions](https://github.com/Shreya20002/glossa/discussions).

> **Project status:** early (0.x). All five v1 features work, and releases
> are automatic: your merged PR's title ends up in the changelog.
> [docs/architecture.md](docs/architecture.md) explains how the pieces fit
> together.

## Ways to contribute

- **Report a bug** — use the _Bug report_ issue template.
- **Suggest a feature** — use the _Feature request_ template. Tell us the
  _problem_ you have, not just the solution you imagine.
- **Improve filler detection** — filler words differ by language, region, and
  habit. Suggestions (with examples) are very welcome. If you change the rules
  in `src/core/fillers.ts`, run `pnpm eval` before and after and put both
  numbers in your PR (see [eval/README.md](eval/README.md)).
- **Add benchmark clips** — more varied speech (accents, presentations,
  interviews) makes the accuracy numbers more trustworthy. Clips must come from
  openly licensed sources; see [eval/README.md](eval/README.md).
- **Improve docs** — if you got stuck, the next person will too.
- **Write code** — look for issues labelled
  [`good first issue`](https://github.com/Shreya20002/glossa/labels/good%20first%20issue)
  or [`help wanted`](https://github.com/Shreya20002/glossa/labels/help%20wanted).

## Before you start coding

- **Check for an existing issue.** If there isn't one, open it first and say
  you'd like to work on it. This avoids two people building the same thing, or
  you spending a weekend on something that doesn't fit.
- **v1 scope is intentionally small:** talk-time, pace, fillers, monologue
  alert, report card. New features start as a feature request so users can
  weigh in before anyone writes code.
- **Small pull requests get reviewed fastest.** One change per PR.

## Development setup

You need:

| Tool    | Version           | How to get it                                                                                                      |
| ------- | ----------------- | ------------------------------------------------------------------------------------------------------------------ |
| Git     | any recent        | <https://git-scm.com>                                                                                              |
| Node.js | 22 (see `.nvmrc`) | <https://nodejs.org> or a version manager like `nvm` / `fnm`                                                       |
| pnpm    | 10                | `npm install -g pnpm@10`. Any 10.x works: pnpm then switches itself to the exact version pinned in `package.json`. |

Glossa uses only prebuilt packages, so you do **not** need a C++ compiler,
Python, CMake, or Rust. **Windows (x64)** and **macOS on Apple Silicon** are
both first-class. Linux works for development and unit tests; the end-to-end
tests need Windows or macOS, because they use the built-in text-to-speech to
make a test recording.

```bash
# 1. Fork the repo on GitHub, then clone YOUR fork
git clone https://github.com/<you>/glossa.git
cd glossa

# 2. Install dependencies (exactly the versions in pnpm-lock.yaml)
pnpm install

# 3. Download the AI models (one time, about 46 MB, verified by checksum)
pnpm fetch-models

# 4. Start the app in development mode (reloads when you save)
pnpm dev
```

### Everyday commands

| Command                | What it does                                                                                    |
| ---------------------- | ----------------------------------------------------------------------------------------------- |
| `pnpm dev`             | Run the app with live reload.                                                                   |
| `pnpm check`           | **Run before every PR.** Formatting, lint, type-check and unit tests — the same checks CI runs. |
| `pnpm format`          | Auto-fix formatting.                                                                            |
| `pnpm test`            | Unit tests only (fast).                                                                         |
| `pnpm test:e2e`        | End-to-end tests: launches the real app with a fake microphone.                                 |
| `pnpm eval`            | Accuracy benchmark on real meetings: how many fillers and words Glossa catches.                 |
| `pnpm build:unpack`    | Build a runnable app folder without making an installer.                                        |
| `pnpm build:installer` | Build an installer for your OS (`.exe` or `.dmg`) into `release/`.                              |

## Making a change

1. **Sync** your fork's `main` with the upstream repo.
2. **Branch** from `main` with a short descriptive name:
   `feat/filler-dialects`, `fix/overlay-position`, `docs/setup-macos`.
3. **Code**, with tests. Anything in `src/core/` (the metrics logic) must have
   unit tests — it's pure TypeScript, so tests are quick to write.
4. **Run `pnpm check`** and make sure it passes.
5. **Commit** using [Conventional Commits](#commit-messages).
6. **Push** to your fork and **open a pull request** against `main`. Fill in the
   template — especially _how you tested it_.
7. **Review:** a maintainer will review, may ask for changes, and then
   **squash-merges** your PR. Your PR title becomes the commit message on `main`.

### Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org). The format
is `type: short description` in the present tense. **Your PR title must follow
it** — a CI check verifies this, and the release tooling uses it to decide the
next version number and write the changelog.

| Type             | Use it for                                | Effect on version             |
| ---------------- | ----------------------------------------- | ----------------------------- |
| `feat:`          | A new user-facing feature                 | minor (0.**1**.0 → 0.**2**.0) |
| `fix:`           | A bug fix                                 | patch (0.1.**0** → 0.1.**1**) |
| `docs:`          | Documentation only                        | none                          |
| `test:`          | Adding or fixing tests                    | none                          |
| `refactor:`      | Code change that doesn't change behaviour | none                          |
| `perf:`          | Performance improvement                   | patch                         |
| `build:` / `ci:` | Build system or CI changes                | none                          |
| `chore:`         | Maintenance (deps, tooling)               | none                          |

Examples: `feat: count "you know" as a filler`, `fix: overlay hidden behind
fullscreen apps`, `docs: explain mic permission on macOS`.
A breaking change adds `!`: `feat!: rename report card fields`.

## Golden rules

These protect Glossa's core promises. PRs that break them won't be merged.

1. **No network access.** Glossa never sends data anywhere: no telemetry,
   analytics, remote models, or update checks.
2. **Never save audio.** Audio lives in memory only while it's being analysed.
   Transcripts are discarded at the end of a session; only aggregate numbers are
   stored.
3. **Keep `src/core/` pure.** No Electron, Node, or browser APIs in it — just
   TypeScript functions in and out, so it stays easy to test.
4. **New dependencies need a reason.** Explain in the PR why it's needed and why
   it's safe (license, size, maintenance). Prebuilt binaries only — no packages
   that require a C++ toolchain to install.

## AI-assisted contributions

Using AI tools (Copilot, Claude, ChatGPT, Cursor…) is fine. Please:

- **Understand and test** everything you submit — you are the author.
- **Tick the AI-assistance box** in the PR template.
- Don't submit large, unreviewed, AI-generated PRs or AI-written issue reports.

Repository rules for AI coding agents live in [AGENTS.md](AGENTS.md).

## Licensing of contributions

Glossa is licensed under [Apache-2.0](LICENSE). By submitting a contribution,
you agree it is licensed under the same terms (this is section 5 of the
license). There is no CLA to sign.

## Code of Conduct

Everyone participating agrees to the [Code of Conduct](CODE_OF_CONDUCT.md).
Be kind; assume good intent; remember there's a person on the other side.
