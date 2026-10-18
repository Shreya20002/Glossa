# 03 — File-by-file tour

Every file in the repository, what it does, and when you'd touch it. This
chapter grows with each build step.

> **Placeholders:** `YOUR_GITHUB_USERNAME` and `CONDUCT_CONTACT_EMAIL` appear in
> several files until you fill them in ([chapter 07](07-github-settings-checklist.md), step 1).

## Root: project front matter

| File | What it is | When you'd touch it |
| --- | --- | --- |
| `README.md` | The front page on GitHub: pitch, features, privacy promise, install, roadmap. | When features ship, install steps change, or you add a demo GIF. |
| `LICENSE` | The Apache-2.0 license, verbatim from apache.org. | Never. |
| `NOTICE` | Copyright line + credits for bundled third-party work (e.g. the models). | When we bundle something whose license asks for credit. |
| `CONTRIBUTING.md` | The contributor manual: setup, commands, PR flow, commit format, golden rules, AI policy. | When the dev setup or the process changes. |
| `CODE_OF_CONDUCT.md` | Contributor Covenant 2.1, verbatim, with your contact placeholder. | Only to fill in the contact. |
| `SECURITY.md` | How to report vulnerabilities privately, and the response times you promise. | If your response times or the supported versions change. |
| `AGENTS.md` | Rules for AI coding agents: commands, layout, golden rules, what never to do. | When commands, folder layout, or rules change. Keep it short and accurate, because agents follow it literally. |
| `CLAUDE.md` | One line, `@AGENTS.md`, so Claude Code reads the same rules. | Never (put rules in `AGENTS.md`). |

## Root: configuration ("dotfiles")

Files starting with `.` are hidden by default on macOS/Linux. In VS Code they
show normally.

| File | What it is | When you'd touch it |
| --- | --- | --- |
| `.gitignore` | Paths git must never track: `node_modules/`, build output, `models/`, secrets, OS clutter. | When a new generated or downloaded folder appears. |
| `.gitattributes` | Makes git store all text files with **LF** line endings, so Windows (CRLF) and macOS (LF) contributors don't create noisy diffs. Also marks images/audio/models as binary. | When adding a new binary file type. |
| `.editorconfig` | Tells editors: UTF-8, LF, 2-space indent, final newline. Most editors obey it automatically. | Rarely. |
| `.nvmrc` | The Node.js major version (22). Version managers (`nvm use`, `fnm use`) read it; CI will too. | When upgrading Node for the whole project. |

## `.github/`: GitHub-specific files

GitHub looks for these paths by name, so their location matters.

| File | What it is | When you'd touch it |
| --- | --- | --- |
| `ISSUE_TEMPLATE/bug_report.yml` | The bug report **form**: what happened, steps, version, OS, audio setup. Auto-labels `bug` + `needs-triage`. | If bug reports keep missing some detail you need. |
| `ISSUE_TEMPLATE/feature_request.yml` | The feature request form. Asks for the *problem* first, and nudges people to 👍 existing requests. Auto-labels `enhancement` + `needs-triage`. | Rarely. |
| `ISSUE_TEMPLATE/config.yml` | Turns off blank issues; adds links to Discussions (questions) and private security reporting. | If you add another support channel. |
| `PULL_REQUEST_TEMPLATE.md` | Pre-fills every new PR: what/why, how tested, checklist, AI disclosure. | When the checklist changes. |
| `CODEOWNERS` | Auto-requests *your* review on every PR. | When you add co-maintainers or owners for specific folders. |

*Step 1 adds `.github/workflows/` (CI) and `.github/dependabot.yml` here.*

## `docs/`

| File | What it is |
| --- | --- |
| `maintainer-guide/` | This guide. Only for you, not for contributors. |

*Later steps add `docs/architecture.md` (how the app works inside) and
`docs/privacy.md` (exactly what data exists and where).*
