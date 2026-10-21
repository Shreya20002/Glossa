# 06 — Reviewing and triage

Once Glossa is public, people will open issues and send pull requests. This
chapter is how to handle them without being overwhelmed, and how to say no
kindly.

## A weekly routine (about 30 minutes)

Pick a regular time, say Monday evening, and work through this list:

1. **Issues labelled `needs-triage`**: every new issue gets this label from
   the issue forms. Triage them (below) until the label list is empty.
2. **Pull requests**: anything waiting for you, oldest first.
3. **Dependabot PRs**: they arrive on Mondays, grouped (see below).
4. **Security tab**: Dependabot alerts and any private vulnerability reports.

Outside that time, it's fine not to answer. Turn on email or mobile
notifications only for **security reports** and **mentions**, so the rest can
wait for Monday.

## Triage: what to do with a new issue

"Triage" means sorting: deciding what an issue is and what happens next.

1. **Read it, and ask for what's missing.** For bugs: Glossa version, OS,
   which microphone, and steps to reproduce. The bug form asks for these, but
   people skip fields.
2. **Check the labels.** The forms add `bug` or `enhancement`; fix that if
   it's wrong, and add others that fit: `question`, `documentation`,
   `duplicate`, or `good first issue` (small, well described, and doable
   without knowing the whole codebase).
3. **Remove `needs-triage`** once it's labelled and you've replied.
4. **Close it with a reason when that's the answer:**
   - _Duplicate:_ "Thanks! This is the same as #12, so I'll close this one.
     Please add a 👍 or your details there."
   - _A question:_ convert it to a **Discussion** (the button on the right),
     so issues stay for work to do.
   - _Out of scope:_ close as **not planned**, kindly (see "Saying no" below).

GitHub's **saved replies** (your avatar → Settings → Saved replies) save
retyping the same answers.

**Privacy reports are urgent.** Anything suggesting Glossa sent data
somewhere, or saved audio or words, breaks the project's core promise. Treat
it like a security report (below), even if it arrived as a normal issue.

## Feature requests

Glossa v1 is deliberately small (AGENTS.md, golden rule 4). For a new idea:
label it `enhancement`, thank the person, and leave it open so others can 👍
it. The README's Roadmap promises that the most-requested ideas get built
next, so the 👍 counts are your to-do list after v1.

## Reviewing a pull request

**First-time contributors:** GitHub doesn't run CI on a newcomer's first PR
until you click **Approve and run**. Skim the changes first, especially
anything under `.github/` or `scripts/`: a stranger's code runs on GitHub's
machines when you approve it. If it looks fine, approve it.

Then check, roughly in this order:

1. **Was it agreed?** A bigger change should have an issue you agreed to
   first. A surprise feature PR may need a kind "no" before any review.
2. **Is CI green?** The four required checks must pass anyway.
3. **The golden rules** (AGENTS.md). Look hardest at:
   - New dependencies in `package.json`: the PR must say why, and they must be
     prebuilt (no compiling at install).
   - Anything touching `src/main/security.ts`, the network, or what's saved to
     disk.
   - `electron-builder.yml`: file patterns decide what ships to users.
   - `eval/clips.json`: tuning on the held-out set makes the benchmark lie.
4. **Tests:** changes to `src/core/` need unit tests next to the file, and a
   bug fix should start with a test that failed before the fix.
5. **Filler or chunking changes:** the PR should include `pnpm eval` results
   from before and after.
6. **Docs:** if behaviour changed, did the docs change too?
7. **The PR title:** it becomes the commit message and the changelog line.
   Edit it yourself before merging if it's unclear to users.

AI-assisted PRs get the same bar: the template asks contributors to say so,
and that they've reviewed and tested everything. Watch for code that's much
bigger than the problem, invented APIs, and tests that don't really test
anything.

**Leaving a review:** comment on lines; use a **suggestion** block for small
fixes the author can accept with one click; finish with **Approve** or
**Request changes**. Be specific and kind: say what to change and why, and
thank them.

**Trying a PR on your computer** (replace 42 with the PR number):

```bash
git fetch origin pull/42/head:pr-42
```

```bash
git switch pr-42
```

Run `pnpm install` and `pnpm dev`, try it, then `git switch main`.

**Merging:** squash-merge, check the title one last time, and let GitHub
delete the branch.

## Dependabot PRs

Every Monday, Dependabot opens grouped PRs (minor and patch npm updates
together, GitHub Actions together), each at least 7 days old, so a broken or
malicious release has time to be noticed first.

- **Green CI on a patch or minor update:** merge it.
- **A major update** (e.g. Electron 44 → 45): read its release notes, run the
  app with `pnpm dev`, and try a session before merging.
- **`onnxruntime-node` or `@huggingface/transformers`:** these can change
  accuracy. Run `pnpm eval` on the PR's branch and compare with the numbers in
  `docs/architecture.md`.

**Security alerts** (Security tab → Dependabot) are different: check whether
the vulnerable code actually ships in the app or only runs while building it,
then update or dismiss it with a reason.

## Saying no, kindly

Chapter 01 has a template for an out-of-scope feature PR. Two more:

> Thanks for taking the time! I'm going to close this one: Glossa never makes
> network requests (it's the core privacy promise in AGENTS.md), and this
> change adds one. If there's an offline way to do it, I'd be glad to look
> again.

> Thanks for this! It's been quiet for a few weeks, so I'll close it for now
> to keep the list tidy. Feel free to reopen whenever you pick it up again.

Closing isn't rejection of the person. Be warm, be brief, and point to a way
forward when there is one.

## Security reports

SECURITY.md asks people to report problems privately (Security tab →
**Report a vulnerability**). When one arrives:

1. Reply within 7 days, as SECURITY.md promises, even if it's only "thanks,
   looking into it".
2. Reproduce it. Use the report's **temporary private fork** to fix it without
   making the problem public before there's a fix.
3. Merge the fix, release it (chapter 05), then **publish the advisory**,
   crediting the reporter if they'd like that.

## Look after yourself

You don't owe anyone an instant reply. It's normal for small projects to answer
within a week. If you're away for a while, say so in a pinned issue. A rested
maintainer helps the project more than a burnt-out one.
