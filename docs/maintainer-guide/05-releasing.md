# 05 — Releasing

How merged pull requests become an installer people can download, and the
few things you click along the way.

## The short version

1. Merge pull requests as usual (squash, with a Conventional Commit title).
2. A robot, **release-please**, keeps one pull request open called
   `chore(main): release X.Y.Z`. It holds the next version number and the
   changelog, and updates itself after every merge.
3. When you want to ship, **close that PR and reopen it** (so CI runs on it;
   see [why](#why-you-close-and-reopen-the-release-pr)), wait for the checks,
   and squash-merge it.
4. About 15 minutes later, the GitHub release `vX.Y.Z` has a Windows installer
   and a Mac installer attached.

Nothing is released until you merge the release PR, so you decide when.

## Version numbers

Glossa uses [Semantic Versioning](https://semver.org): `MAJOR.MINOR.PATCH`.
release-please picks the next number from the titles of the PRs merged since
the last release:

| PR titles since the last release   | Next version  |
| ---------------------------------- | ------------- |
| Only `fix:`                        | 1.0.0 → 1.0.1 |
| At least one `feat:`               | 1.0.0 → 1.1.0 |
| A breaking change (`feat!:`)       | 1.0.0 → 2.0.0 |
| Only `docs:`, `ci:`, `chore:` etc. | no release    |

Glossa starts at **1.0.0**, because the five v1 features are done. From here
on, the first number is a promise to people who already use Glossa. A change
that breaks something for them, like removing a feature, raising the minimum
Windows or macOS version, or saving history in a way older sessions can't be
read back, must be marked as breaking with `!` in the PR title. Then it
becomes 2.0.0. Chapter 02 explains the commit types.

## What release-please does

The workflow is `.github/workflows/release.yml`. Its first job, **Release
PR**, runs after every push to `main`:

- It reads the commit messages since the last release tag (each squashed PR is
  one commit, titled with the PR title).
- It works out the next version, then opens or updates the release PR, which
  changes three files: `CHANGELOG.md` (a new entry listing the `feat:` and
  `fix:` titles), `package.json` (the `version`) and
  `.release-please-manifest.json` (where it remembers the current version).
- When you merge the release PR, it tags that commit (`v1.0.0`) and publishes a
  **GitHub release** with the changelog entry as its notes.

Those three files belong to release-please: never edit the changelog or the
version by hand (AGENTS.md says the same to AI agents). To change what the
changelog says, fix the PR titles before you merge them; good titles are free
release notes. You can still edit a published release's notes on GitHub.

Its settings live in `release-please-config.json`:

| Setting                             | What it does                                 |
| ----------------------------------- | -------------------------------------------- |
| `"release-type": "node"`            | The version lives in `package.json`          |
| `"initial-version": "1.0.0"`        | The very first release is 1.0.0              |
| `"include-component-in-tag": false` | Tags look like `v1.0.0`, not `glossa-v1.0.0` |

## Why you close and reopen the release PR

`main` requires four checks to pass before anything merges (chapter 07,
step 5). But GitHub has a safety rule: actions taken by a workflow's own token
(like release-please opening a PR) **never start other workflows**, so that
workflows can't trigger each other forever. So CI doesn't run on the release
PR by itself, and it would wait for its checks forever.

When _you_ close and reopen the PR, that's a human event, and CI runs: about
three minutes later the checks are green and you can merge. Do it right before
merging, because every new merge to `main` updates the release PR again.

(The alternative is a personal access token stored as a secret, which makes CI
run automatically. It's one more secret to guard and renew, so it isn't worth
it yet.)

## What happens when you merge it

The workflow's second job, **Installer**, runs only when a release has just
been published, once on Windows and once on macOS, in parallel:

1. Check out exactly the tagged commit, install dependencies, and download the
   speech models (checking every checksum). No caches: what people download
   is always built from a clean slate.
2. `pnpm build:installer`: compile, then package with electron-builder into
   `Glossa-1.0.0-setup.exe` or `Glossa-1.0.0-arm64.dmg`.
3. Run the same end-to-end test as CI, on the app inside that installer.
4. Attach the installer to the release.

Follow it in the **Actions** tab, under **Release**. When both jobs are green,
the release page lists the two installers (plus the source code archives
GitHub adds to every release). GitHub shows a SHA-256 fingerprint next to each
file, so people can check their download.

## Unsigned installers, honestly

Windows and macOS fully trust apps signed with a paid certificate: a few
hundred dollars a year for Windows, and the $99/year Apple Developer Program
for macOS "notarization". Glossa costs nothing to run, so:

- The **Windows** installer is unsigned, so SmartScreen shows _"Windows
  protected your PC"_; users click **More info → Run anyway**.
- The **Mac** app is signed **ad hoc** (`identity: '-'` in
  `electron-builder.yml`): no certificate, but enough for Apple Silicon to run
  it. macOS asks users to confirm in **System Settings → Privacy & Security →
  Open Anyway** the first time. Without any signature it would claim the app
  is "damaged", which is far scarier.

The README's **Install** section walks users through both. If Glossa grows,
look at [SignPath Foundation](https://signpath.org), which signs open-source
Windows apps for free, and at Apple's program for the Mac.

## Before you merge a release PR: checklist

- [ ] CI is green on `main`.
- [ ] The changelog in the release PR reads well to a user.
- [ ] For a big release, you tried an installer yourself: `pnpm build:installer`
      builds one into `release/` on your computer (the one for your OS).
- [ ] You closed and reopened the PR, and its checks are green.

After it's published, download your installer from the release page and open
it the way a user would, warnings and all.

## When something goes wrong

- **An Installer job failed.** Open it and read which step failed (the
  end-to-end test posts an "E2E diagnostics" annotation, as in CI). Fix the
  cause if it's real; if it was a fluke, click **Re-run failed jobs**. The
  release already exists, and the installer is attached when the job passes.
- **A release has a bad bug.** Merge a `fix:` PR, and release-please proposes
  the next patch version (1.0.0 → 1.0.1). Then add a note at the top of the
  bad release's notes pointing to the fix. Don't delete tags or releases that
  people may have downloaded.
- **You need a specific version number,** say 2.0.0 for a big redesign. In
  a PR, add `"release-as": "2.0.0"` to the package in
  `release-please-config.json`.
  Release, then remove that line in the next PR.

## Your first release: v1.0.0

1. **Settings → Actions → General → Workflow permissions:** tick **Allow
   GitHub Actions to create and approve pull requests** and click **Save**
   (chapter 07, step 9). Without it, release-please can't open its PR.
2. Merge the PR that added this chapter. Within a minute, the **Release**
   workflow opens `chore(main): release 1.0.0`.
3. Read its changelog: it lists every `feat:` merged so far.
4. Close the PR, reopen it, wait for the checks, then squash-merge it, keeping
   its title.
5. Watch **Actions → Release** until both Installer jobs are green.
6. Open **Releases → v1.0.0**, download your installer, and try it.

Then tell people! The README's Install section is ready, and chapter 07's
social preview step makes the link look good when shared.
