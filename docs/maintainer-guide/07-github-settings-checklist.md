# 07 — GitHub settings checklist

Most of a repository's rules aren't stored in files. They're settings you click
on GitHub. Do these once, in order. Each one says **why**, so you can decide
for yourself later.

Items marked ⏳ need something from a later build step. Come back to them then.

GitHub sometimes renames or moves settings. If a label doesn't match exactly,
look for the nearest equivalent, or search GitHub Docs for the setting name.

---

## 1. Fill in the placeholders (on your computer, before pushing)

Two placeholders are spread across the files:

| Placeholder             | Replace with                                                                                                                                                                  |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `YOUR_GITHUB_USERNAME`  | Your GitHub username, e.g. `shreya-dev` (no `@`)                                                                                                                              |
| `CONDUCT_CONTACT_EMAIL` | An email for Code of Conduct reports. **Tip:** create a separate address just for the project (e.g. a new free Gmail) rather than using your personal one. It will be public. |

In VS Code:

1. Press **Ctrl+Shift+H** (Replace in Files).
2. Type the placeholder in the first box and your value in the second.
3. Click the **…** under the boxes, and in **files to exclude** type
   `docs/maintainer-guide`. This guide talks _about_ the placeholders, so leave
   it unchanged.
4. Click **Replace All**, then repeat for the second placeholder.

Check that none are left outside this guide:

```bash
git grep -n -e YOUR_GITHUB_USERNAME -e CONDUCT_CONTACT_EMAIL -- . ":!docs/maintainer-guide"
```

No output means you're done.

## 2. Set your commit email, then create the repo and push

Follow [chapter 02](02-git-and-github.md): _"Before your first commit: protect
your email"_, then _"Your first push"_.

## 3. Repository description (the "About" box)

On the repo's main page, click the ⚙️ next to **About**:

- **Description:** `An invisible speech coach just for you: offline, private, open source.`
- **Topics:** `electron`, `typescript`, `speech-recognition`, `whisper`,
  `public-speaking`, `offline-first`, `privacy`, `desktop-app`
- **Why:** topics make the repo show up in GitHub search and topic pages.

## 4. Settings → General

**Features**

- ✅ **Issues**
- ✅ **Discussions**. After ticking it, click **Set up discussions** and post a
  short welcome in _Announcements_. _Why:_ questions go here instead of
  cluttering issues (the issue chooser links to it).
- ❌ **Wikis**. _Why:_ docs live in the repo, where they're reviewed like code.

**Pull Requests**

- ❌ Allow merge commits
- ✅ **Allow squash merging**, with default message **Pull request title**
- ❌ Allow rebase merging
- ✅ **Always suggest updating pull request branches**
- ✅ **Automatically delete head branches**. _Why:_ merged branches disappear
  automatically, so the branch list stays clean.

_Why squash-only:_ every PR becomes one Conventional-Commit on `main` (see
chapter 02).

## 5. Settings → Rules → Rulesets: protect `main`

Click **New ruleset → New branch ruleset**:

- **Ruleset name:** `Protect main`
- **Enforcement status:** Active
- **Target branches → Add target → Include default branch**
- Rules to tick:
  - ✅ **Restrict deletions**: nobody can delete `main`.
  - ✅ **Require linear history**: fits squash merging.
  - ✅ **Require a pull request before merging**. Set **Required approvals: 0**
    for now.
    _Why 0?_ GitHub never lets you approve your own PR, so with 1 required
    approval, a solo maintainer could never merge their own work. Only people
    with write access (you) can click Merge anyway, so outside PRs still need
    you. Raise it to 1 when you add a co-maintainer.
  - ✅ **Block force pushes**: history on `main` can never be rewritten.
  - ⏳ **Require status checks to pass** (after your first push). Click **Add
    checks** and add `Checks (format, lint, types, tests)`, `Build
(windows-latest)`, `Build (macos-latest)` and `Conventional Commit title`.
    Checks only appear in the search box after they've run once, so open a
    test PR first. [Chapter 04](04-ci-explained.md) explains each one.

Click **Create**.

## 6. Settings → Code security

(Some accounts call this page **Advanced Security**.) All of these are free for
public repositories:

- ✅ **Private vulnerability reporting**: enables the _Report a vulnerability_
  button that `SECURITY.md` promises.
- ✅ **Dependency graph**: usually on by default for public repos.
- ✅ **Dependabot alerts**: warns you when a dependency has a known security
  hole.
- ✅ **Dependabot security updates**: opens PRs that fix those holes
  automatically.
- ✅ **Secret scanning** and **Push protection**: blocks pushes that
  accidentally contain passwords or API keys.
- ✅ **CodeQL analysis → Set up → Default**. _Why:_ GitHub's code scanner finds
  security bugs in the TypeScript code, and the "default setup" needs no
  workflow file. It runs on every PR and weekly.

## 7. Labels (Issues → Labels)

GitHub creates some by default: `bug`, `documentation`, `duplicate`,
`enhancement`, `good first issue`, `help wanted`, `invalid`, `question`,
`wontfix`. Keep them, and add:

| Label          | Color     | Meaning                                                                                                |
| -------------- | --------- | ------------------------------------------------------------------------------------------------------ |
| `needs-triage` | `#FBCA04` | New issue, not yet looked at. The issue templates add it automatically; remove it once you've triaged. |

Optional, once there's code: `area: engine`, `area: ui`, `area: ci`. They help
contributors find issues in the part they know.

## 8. ⏳ Social preview (after v1.0.0)

**Settings → General → Social preview** lets you upload a 1280×640 image. It's
what shows up when someone shares the repo link on LinkedIn or X. The app icon
(`build/icon.png`) next to a screenshot of the report card, on a plain
background, works well. It's uploaded to GitHub,
not committed to the repo.

## 9. Settings → Actions → General (before your first release)

- **Workflow permissions:** keep **Read repository contents and packages
  permissions** (each workflow asks for more only where it needs it), and tick
  ✅ **Allow GitHub Actions to create and approve pull requests**. Click
  **Save**. release-please needs this to open the release PR
  ([chapter 05](05-releasing.md)).
- **Approval for fork pull request workflows:** keep **Require approval for
  first-time contributors**. [Chapter 06](06-reviewing-and-triage.md) explains
  the **Approve and run** button this adds to their first PR.

---

When everything above is done, GitHub's **Insights → Community Standards** page
should show every item ticked.
