# 02 — Git and GitHub

## Git vs GitHub

- **Git** is a program on your computer that records the history of a folder.
  Every saved step is a **commit**.
- **GitHub** is a website that hosts git repositories and adds collaboration
  around them: issues, pull requests, reviews, Actions (CI/CD), releases.

You can use git without GitHub. Open source needs both: git for history, GitHub
for people.

## The mental model

```
your computer                              GitHub
─────────────                              ──────
working folder  ──git add──►  staging      origin (YOUR_GITHUB_USERNAME/glossa)
                ──git commit─► local history ──git push──►  main
                                             ◄─git pull──
```

- **Working folder** — the files you edit.
- **Staging area** — the changes you've picked for the next commit (`git add`).
- **Local history** — commits saved on your machine (`git commit`).
- **Remote (`origin`)** — the copy on GitHub. `git push` uploads your commits;
  `git pull` downloads other people's.

## Branches

A **branch** is a named line of work. `main` is the official, always-working
version. You never work directly on `main`. For each change you:

```bash
git switch main
git pull                          # get the latest main
git switch -c fix/overlay-flicker # create a branch for this one change
# ...edit files...
git add -A
git commit -m "fix: overlay flickers when switching monitors"
git push -u origin fix/overlay-flicker
```

Then you open a **pull request** on GitHub from that branch into `main`.

## Pull requests — yes, even for the maintainer

As maintainer you _could_ push straight to `main`. Don't. Open a PR for your own
changes too, because:

1. **CI runs on the PR** and catches mistakes before they hit `main`.
2. Contributors see that the rules apply to everyone.
3. The PR title becomes a clean, Conventional-Commit message on `main`, which
   the release tooling needs.

The GitHub settings in [chapter 07](07-github-settings-checklist.md) enforce this.

## Forks: how outside contributors work

Contributors can't push to your repository. Instead they **fork** it (make their
own copy on GitHub), push a branch to their fork, and open a PR from their fork
into your `main`. You review it the same way. CI runs on it too, but with
read-only permissions and no access to secrets. That safety matters, and
chapter 04 explains it.

## Why we squash-merge

GitHub offers three ways to merge a PR:

| Method        | Result on `main`                                                |
| ------------- | --------------------------------------------------------------- |
| Merge commit  | All the PR's commits + an extra "Merge pull request #12" commit |
| Rebase        | All the PR's commits, replayed one by one                       |
| **Squash** ✅ | **One** commit, titled with the PR title                        |

Contributors' branches often contain commits like "wip", "fix typo", "oops".
Squashing turns the whole PR into one tidy commit, so `main` reads like a
changelog:

```
feat: add filler-word counter (#14)
fix: pace stuck at 0 after long pause (#17)
docs: macOS microphone permission steps (#18)
```

That's also why the PR **title** must follow Conventional Commits — it becomes
the commit message.

## Conventional Commits in one minute

Format: `type: description`, for example `feat: count "you know" as filler`.

- `feat` → new feature → bumps the **minor** version (1.0.0 → 1.1.0)
- `fix` → bug fix → bumps the **patch** version (1.0.0 → 1.0.1)
- `docs`, `test`, `refactor`, `build`, `ci`, `chore` → no release on their own
- `!` after the type (`feat!:`) → breaking change → bumps the **major**
  version (1.0.0 → 2.0.0)

A tool called **release-please** reads these titles and writes the changelog
and version number for you ([chapter 05](05-releasing.md)). Good titles mean
free release notes.

## Before your first commit: protect your email

Every commit stores an author name and email, and on a public repo **anyone can
read them**. Your git is currently set to your college email. To use GitHub's
private "noreply" address for this project only:

1. On GitHub, open **Settings → Emails**.
2. Tick **Keep my email addresses private**. GitHub shows your noreply address,
   which looks like `12345678+username@users.noreply.github.com`.
3. Also tick **Block command line pushes that expose my email**.
4. In this repo folder, run:

   ```bash
   git config user.email "12345678+username@users.noreply.github.com"
   ```

   Leaving out `--global` means only this repository changes. Your other
   projects keep their current email.

Commits made before this change keep the old email, so do it **before the first
commit**.

## Your first push

After the first commit exists locally:

1. On GitHub, click **New repository**.
2. Name it `glossa`, set it to **Public**, and **don't** tick "Add a README",
   ".gitignore" or "license", because the repo already has them.
3. Click **Create repository**, then run:

   ```bash
   git remote add origin https://github.com/YOUR_GITHUB_USERNAME/glossa.git
   git push -u origin main
   ```

   The first time, Git for Windows opens a browser window to sign in to GitHub.
   That's Git Credential Manager, and it remembers you afterwards.

4. Follow [chapter 07](07-github-settings-checklist.md) to configure the repo.

## Commands you'll use weekly

| Command                                                       | Meaning                                              |
| ------------------------------------------------------------- | ---------------------------------------------------- |
| `git status`                                                  | What's changed? What branch am I on?                 |
| `git diff`                                                    | Show exact line changes not yet staged.              |
| `git log --oneline -10`                                       | Last 10 commits, one line each.                      |
| `git switch <branch>`                                         | Move to another branch.                              |
| `git pull`                                                    | Download and apply new commits from GitHub.          |
| `git fetch origin pull/23/head:pr-23` then `git switch pr-23` | Check out a contributor's PR #23 locally to test it. |
