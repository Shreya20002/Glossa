# Maintainer guide — start here

This guide is for **you, the maintainer**, especially if this is your first
open-source project. It explains what every file in this repository is for, how
the automation works, and how to run the project day to day — in plain English.

Contributors don't need to read this; they have [CONTRIBUTING.md](../../CONTRIBUTING.md).

## Reading order

| #   | Chapter                                                      | Read it when                                                               |
| --- | ------------------------------------------------------------ | -------------------------------------------------------------------------- |
| 01  | [Open-source basics](01-open-source-basics.md)               | First. What a license does, what a maintainer does.                        |
| 02  | [Git and GitHub](02-git-and-github.md)                       | Before your first push. Commits, branches, PRs, and _why we squash-merge_. |
| 03  | [File-by-file tour](03-file-by-file-tour.md)                 | Any time you wonder "what is this file?"                                   |
| 04  | [CI explained](04-ci-explained.md)                           | Before your first PR. Every GitHub Actions workflow, line by line.         |
| 05  | [Releasing](05-releasing.md)                                 | Before your first release. How merging the release PR ships installers.    |
| 06  | [Reviewing and triage](06-reviewing-and-triage.md)           | When the first issues and PRs arrive. Handling them, and saying no kindly. |
| 07  | [GitHub settings checklist](07-github-settings-checklist.md) | Right after you create the GitHub repo. Click-by-click.                    |

## Five words you'll see everywhere

- **Repository (repo)** — the project folder plus its full history, tracked by git.
- **Commit** — a saved snapshot of changes, with a message saying what changed.
- **Pull request (PR)** — a proposal to merge changes into `main`, with a place
  to discuss and review them.
- **CI (continuous integration)** — robots (GitHub Actions) that run the tests
  and checks on every PR, so nothing broken reaches `main`.
- **CD (continuous delivery)** — robots that build and publish the app when
  you decide to release.

## How the project is being built

Glossa is built in eight reviewed steps, each ending in one commit:

| Step | What lands                                                              |
| ---- | ----------------------------------------------------------------------- |
| 0    | Open-source foundation: license, community files, templates, this guide |
| 1    | App skeleton + CI (lint, typecheck, tests on every PR)                  |
| 2    | Microphone + voice detection + overlay + **talk-time meter**            |
| 3    | Speech recognition + **pace (WPM)**                                     |
| 4    | **Filler-word counter** + accuracy benchmark                            |
| 5    | **Monologue alert**                                                     |
| 6    | **Post-call report card**                                               |
| 7    | Release pipeline + v0.1.0                                               |

This guide grows with each step: when a new file appears, chapter 03 explains it.
