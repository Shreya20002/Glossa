# 03 — File-by-file tour

Every file in the repository, what it does, and when you'd touch it. This
chapter grows with each build step.

> **Placeholders:** `YOUR_GITHUB_USERNAME` and `CONDUCT_CONTACT_EMAIL` appear in
> several files until you fill them in ([chapter 07](07-github-settings-checklist.md), step 1).

## Root: project front matter

| File                 | What it is                                                                                | When you'd touch it                                                                                            |
| -------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `README.md`          | The front page on GitHub: pitch, features, privacy promise, install, roadmap.             | When features ship, install steps change, or you add a demo GIF.                                               |
| `LICENSE`            | The Apache-2.0 license, verbatim from apache.org.                                         | Never.                                                                                                         |
| `NOTICE`             | Copyright line + credits for bundled third-party work (e.g. the models).                  | When we bundle something whose license asks for credit.                                                        |
| `CONTRIBUTING.md`    | The contributor manual: setup, commands, PR flow, commit format, golden rules, AI policy. | When the dev setup or the process changes.                                                                     |
| `CODE_OF_CONDUCT.md` | Contributor Covenant 2.1, verbatim, with your contact placeholder.                        | Only to fill in the contact.                                                                                   |
| `SECURITY.md`        | How to report vulnerabilities privately, and the response times you promise.              | If your response times or the supported versions change.                                                       |
| `AGENTS.md`          | Rules for AI coding agents: commands, layout, golden rules, what never to do.             | When commands, folder layout, or rules change. Keep it short and accurate, because agents follow it literally. |
| `CLAUDE.md`          | One line, `@AGENTS.md`, so Claude Code reads the same rules.                              | Never (put rules in `AGENTS.md`).                                                                              |

## Root: configuration ("dotfiles")

Files starting with `.` are hidden by default on macOS/Linux. In VS Code they
show normally.

| File                      | What it is                                                                                                                                                                 | When you'd touch it                                |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `.gitignore`              | Paths git must never track: `node_modules/`, build output, `models/`, secrets, OS clutter.                                                                                 | When a new generated or downloaded folder appears. |
| `.gitattributes`          | Makes git store all text files with **LF** line endings, so Windows (CRLF) and macOS (LF) contributors don't create noisy diffs. Also marks images/audio/models as binary. | When adding a new binary file type.                |
| `.editorconfig`           | Tells editors: UTF-8, LF, 2-space indent, final newline. Most editors obey it automatically.                                                                               | Rarely.                                            |
| `.nvmrc`                  | The Node.js major version (22). Version managers (`nvm use`, `fnm use`) read it; CI will too.                                                                              | When upgrading Node for the whole project.         |
| `.prettierrc.json`        | Prettier's style choices: 100-character lines, single quotes, no semicolons. Prettier formats all code and docs so nobody argues about style.                              | Almost never: changing it reformats every file.    |
| `.prettierignore`         | Files Prettier must not touch: generated files, the lockfile, and `CODE_OF_CONDUCT.md` (verbatim text).                                                                    | When adding generated or verbatim files.           |
| `.vscode/extensions.json` | VS Code suggests these extensions (ESLint, Prettier, EditorConfig, Vitest) when someone opens the project.                                                                 | Rarely.                                            |

## Root: the app's build and tooling

An Electron app is like a website bundled with its own Chrome browser, plus a
Node.js "back end" with access to the computer. These files configure how it
all gets installed, checked, built and packaged.

| File                      | What it is                                                                                                                                                                                                                                                                                                                                                                  | When you'd touch it                                                                                                        |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `package.json`            | The project's ID card: name, version, license, **scripts** (`pnpm dev`, `pnpm check`…) and **dependencies**. `packageManager` pins the exact pnpm version: pnpm switches to it automatically, and so does CI. `pnpm.ignoredBuiltDependencies` lists packages whose install scripts we deliberately don't run (`electron-winstaller`, for an installer format we don't use). | Adding scripts or dependencies (use `pnpm add`, not hand edits). Never change `version` by hand; the release tool does it. |
| `pnpm-lock.yaml`          | Generated by pnpm: the **exact** version of every package (including dependencies of dependencies), so everyone, and CI, installs identical code.                                                                                                                                                                                                                           | Never by hand. Commit it whenever `pnpm install` changes it.                                                               |
| `tsconfig.json`           | Root TypeScript config. It only points to the two configs below.                                                                                                                                                                                                                                                                                                            | Rarely.                                                                                                                    |
| `tsconfig.base.json`      | Shared TypeScript settings, mostly strictness options that catch bugs.                                                                                                                                                                                                                                                                                                      | Rarely.                                                                                                                    |
| `tsconfig.node.json`      | Type-checks code that runs in **Node.js** (main process, preload, config files).                                                                                                                                                                                                                                                                                            | When adding a new Node-side folder.                                                                                        |
| `tsconfig.web.json`       | Type-checks code that runs in a **window** (browser APIs + React, no Node).                                                                                                                                                                                                                                                                                                 | When adding a new window-side folder.                                                                                      |
| `electron.vite.config.ts` | How electron-vite builds the three bundles: main, preload and renderer pages. Each window's HTML page is listed here.                                                                                                                                                                                                                                                       | When adding a new window (Step 2 adds the overlay).                                                                        |
| `vitest.config.mts`       | Unit-test settings: tests are `src/**/*.test.ts`, next to the code they test.                                                                                                                                                                                                                                                                                               | Rarely.                                                                                                                    |
| `eslint.config.mjs`       | Lint rules, including Glossa's custom guards: **no network code in `src/`** and **no impure imports in `src/core/`**.                                                                                                                                                                                                                                                       | When a rule is wrong or a new guard is needed.                                                                             |
| `electron-builder.yml`    | How the compiled app becomes a Windows `.exe` / macOS `.dmg`. `appId` is the app's permanent identity and contains your username placeholder.                                                                                                                                                                                                                               | Step 7 (installers), or when adding icons.                                                                                 |

**Why `src/core` is checked by both tsconfigs:** the Node config has no browser
APIs and the web config has no Node APIs. Code that compiles under _both_ can
only use plain JavaScript, which is exactly what "pure core" means.

**Why there's no `onlyBuiltDependencies: ["electron"]`** (the plan mentioned
it): Electron 44 no longer runs an install script. It downloads its program the
first time something uses it, so there's nothing for pnpm to allow.

## `src/`: the app itself

Electron runs Glossa as separate **processes** that can't see each other's
memory. They talk by sending messages (**IPC**, inter-process communication).

```
main process (Node.js, full access)  ◄── IPC ──►  preload  ──►  window (web page, sandboxed)
src/main/                                         src/preload/   src/renderer/
```

| File                        | What it is                                                                                                                                                                                                  |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/main/index.ts`         | Entry point of the **main process**: applies security settings, registers IPC handlers, opens the window. Also allows only one copy of Glossa to run at a time.                                             |
| `src/main/windows.ts`       | Creates the app window with Electron's secure settings (`contextIsolation`, `sandbox`, no Node in pages) and loads its page.                                                                                |
| `src/main/security.ts`      | The security baseline: blocks every network request, denies all permissions except the microphone, stops pages from navigating away or opening windows, and rejects IPC messages from unknown pages.        |
| `src/main/security.test.ts` | Tests for the URL rules: internet blocked, local files allowed, dev server allowed only during development.                                                                                                 |
| `src/main/ipc.ts`           | Handlers for messages from windows. Today it answers one: "what's the app version?"                                                                                                                         |
| `src/preload/index.ts`      | The **bridge**. Runs before the page loads and exposes a small, fixed API as `window.glossa`. Pages can call only these functions, never Electron directly.                                                 |
| `src/shared/ipc.ts`         | Channel names and the `window.glossa` API shape, imported by main, preload and renderer so all three always agree.                                                                                          |
| `src/renderer/env.d.ts`     | Tells TypeScript that `window.glossa` exists and what it looks like.                                                                                                                                        |
| `src/renderer/app/`         | The app window's page: `index.html` (with the **Content Security Policy**, which blocks outside connections), `main.tsx` (starts React), `App.tsx` (the home screen) and `app.css` (light and dark themes). |
| `src/core/format.ts`        | The first **pure** function: formats durations (`1:05`) and percentages (`68%`) for the overlay and report card.                                                                                            |
| `src/core/format.test.ts`   | Its unit tests, including the odd cases: negative numbers, `NaN`, and values over 100%.                                                                                                                     |

**Defense in depth:** the network is blocked three times. The page's CSP
refuses outside connections, `security.ts` cancels any request that slips
through, and ESLint rejects network code before it's ever merged.

## `.github/`: GitHub-specific files

GitHub looks for these paths by name, so their location matters.

| File                                 | What it is                                                                                                                                                                        | When you'd touch it                                         |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `ISSUE_TEMPLATE/bug_report.yml`      | The bug report **form**: what happened, steps, version, OS, audio setup. Auto-labels `bug` + `needs-triage`.                                                                      | If bug reports keep missing some detail you need.           |
| `ISSUE_TEMPLATE/feature_request.yml` | The feature request form. Asks for the _problem_ first, and nudges people to 👍 existing requests. Auto-labels `enhancement` + `needs-triage`.                                    | Rarely.                                                     |
| `ISSUE_TEMPLATE/config.yml`          | Turns off blank issues; adds links to Discussions (questions) and private security reporting.                                                                                     | If you add another support channel.                         |
| `PULL_REQUEST_TEMPLATE.md`           | Pre-fills every new PR: what/why, how tested, checklist, AI disclosure.                                                                                                           | When the checklist changes.                                 |
| `CODEOWNERS`                         | Auto-requests _your_ review on every PR.                                                                                                                                          | When you add co-maintainers or owners for specific folders. |
| `workflows/ci.yml`                   | CI: format, lint, type-check and unit tests on Linux, plus a real app build on Windows and macOS, for every PR and push to `main`. Explained in [chapter 04](04-ci-explained.md). | When adding a new kind of check.                            |
| `workflows/pr-title.yml`             | Fails a PR whose title isn't a Conventional Commit.                                                                                                                               | Rarely.                                                     |
| `dependabot.yml`                     | Weekly, grouped dependency-update PRs with a 7-day safety delay.                                                                                                                  | To ignore a dependency, or change the schedule.             |

## `docs/`

| File                | What it is                                      |
| ------------------- | ----------------------------------------------- |
| `maintainer-guide/` | This guide. Only for you, not for contributors. |

_Later steps add `docs/architecture.md` (how the app works inside) and
`docs/privacy.md` (exactly what data exists and where)._
