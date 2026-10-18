# 01 — Open-source basics

## What "open source" actually means

Putting code on GitHub doesn't make it open source. Code with **no license** is
"all rights reserved" by default: people can look at it, but legally they can't
use, copy, or change it.

Code becomes open source when you attach an **open-source license** — a short
legal document that says, in advance, "you may use, copy, modify, and share
this, under these conditions." That's what the `LICENSE` file does.

## Why Glossa uses Apache-2.0

Licenses fall into two families:

| Family | Examples | The deal |
| --- | --- | --- |
| **Permissive** | MIT, **Apache-2.0**, BSD | Do almost anything, including closed-source commercial use. Just keep the copyright and license notices. |
| **Copyleft** | GPL, AGPL | If you distribute a modified version, you must publish your changes under the same license. |

You picked **Apache-2.0**. It's permissive like MIT, plus two extras:

1. **Patent grant.** Everyone who contributes code also gives users permission
   to use any of *their* patents that the code covers. If someone sues claiming
   Glossa infringes a patent, the patent rights the license gave *them* end
   automatically. This protects you and your users.
2. **Contribution terms are built in** (section 5). Anything someone submits
   to the project is automatically under Apache-2.0 too, unless they say
   otherwise. That's why Glossa doesn't need a separate CLA (Contributor
   License Agreement) for people to sign.

### `LICENSE` vs `NOTICE`

- **`LICENSE`** is the license text, copied **word for word** from apache.org.
  Never edit it. (The "APPENDIX" at the bottom is a template for other people's
  source files — leave it as is.)
- **`NOTICE`** is where Apache-2.0 projects put the copyright line and credits
  for bundled third-party work. Anyone redistributing Glossa must keep this
  file. When we bundle the Whisper and Silero models, their credits go here.

### "The Glossa Authors"

The copyright line says *The Glossa Authors* instead of a single name. This is
common practice (Go and Chromium do it): every contributor keeps the copyright
on their own contribution, and git history records who wrote what. It also keeps
your personal details out of every file.

## What a maintainer does

As maintainer, you are the project's **editor**, not its only author. Your jobs:

- **Set direction.** Decide what Glossa is and isn't. ("v1 is five features"
  is a maintainer decision.)
- **Review and merge** pull requests — or kindly decline them.
- **Triage issues** — label them, ask for missing details, close duplicates.
- **Release** new versions.
- **Keep the space healthy** — enforce the Code of Conduct when needed.

What you are **not** obliged to do: answer within hours, accept every feature,
fix every bug yourself, or provide free personal support. Open source runs on
volunteer time, including yours. Setting expectations (like the response times
in `SECURITY.md`) protects you from burnout.

## The community files, and why each one exists

GitHub shows a **Community Standards** checklist for every repo
(*Insights → Community Standards*). Glossa has all of these:

| File | Its job |
| --- | --- |
| `README.md` | The front door. What Glossa is, why it's different, how to get it. Most visitors read only this. |
| `LICENSE` | The legal permission to use the code. |
| `CONTRIBUTING.md` | How to set up, make a change, and submit it. It turns "I'd like to help" into an actual PR. |
| `CODE_OF_CONDUCT.md` | Behaviour rules, and how violations are handled. It signals the project is a safe place to show up. |
| `SECURITY.md` | How to report vulnerabilities privately, so attackers don't learn about them first. |
| Issue templates | Structured forms, so bug reports include OS, version, and steps to reproduce. |
| PR template | A checklist that reminds contributors to test and explain their change. |

And two newer files that GitHub doesn't check for yet:

| File | Its job |
| --- | --- |
| `AGENTS.md` | Instructions for **AI coding agents**. Many contributors now use AI tools. This open standard tells those tools the project's commands, layout and rules ("never add network calls"), so their output fits the project. |
| `CLAUDE.md` | Claude Code reads `CLAUDE.md`, not `AGENTS.md`. Ours contains one line — `@AGENTS.md` — which imports `AGENTS.md`, so there's a single source of truth. |

## Saying no

Glossa's pitch is "ruthlessly small". Contributors will propose features —
sometimes big, already-written PRs. A kind, firm no protects the project:

> Thanks so much for this — it's clearly a lot of work. Glossa v1 is
> intentionally limited to five features, so I can't merge this right now. Would
> you open a feature request so other users can 👍 it? If it gets traction,
> I'd love to revisit it.

This is why `CONTRIBUTING.md` asks people to **open an issue before coding**.
