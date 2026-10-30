# Standard: Commits, branches and history

## Applies to
- Every change that enters the repository: code, docs, the site, workflows and release commits.
- How work is branched, how commits are written, how they reach `main`, and what is never committed.
- Not covered (this standard only points to them):
  - The release steps ([Release a new version](../how-to/release.md)).
  - Keys and tokens ([Managing signing keys and secrets](keys-and-secrets.md)).

## Rules
### Branches
- `main` is the only long-lived branch.
  - It always passes CI (`build.yml`) and can be released at any commit.
  - The repository ruleset blocks deleting it and force-pushing to it ([set up the repository](../how-to/set-up-the-repository.md), step on rulesets).
- Work happens on a short-lived branch made from the latest `main`.
  - Name: `<area>/<topic>`, lowercase with hyphens.
  - The area is the part of the app or the kind of work: `yard/lake-shape`, `chat/avatars`, `backend/command-table`, `fix/gift-day`, `docs/commit-standard`, `ci/pin-actions`.
  - A branch carries one change and is deleted once it is merged.
- A branch reaches `main` through a pull request that a maintainer reviews and merges.
- Before merging, rebase the branch onto `main`, so `main` stays a straight line with no merge commits.
- Every pull request is squash-merged into one commit on `main`.
  - The PR title becomes the commit title, so it follows the title rule below.
  - The maintainer checks that the squash commit body says what changed, why, and how it was checked, and keeps the co-author trailers.
  - Branch commits stay useful for review; they do not become separate commits on `main`.
- Repository settings allow squash merging only; merge commits and rebase merging are disabled.
- Rebasing a feature branch onto the latest `main` before its final CI run is a separate step from the pull request's merge method.
- Versions are tags (`vX.Y.Z`) on `main`, made by `pnpm run release x.y.z` and pushed by a maintainer.
- No release branches: a fix for a released version goes to `main` and out in the next patch version.

### Commits
- One commit is one change someone could review, revert or find with `git bisect` on its own.
- Every commit passes `pnpm test` and `pnpm run lint`.
- The title:
  - One English sentence that says what is different for the people using or working on the app.
  - No period, no prefix such as `feat:`. Example: "Friends stand behind what is in front of them".
  - Fits on one line of `git log --oneline` (about 72 characters).
  - A commit that lands several related changes may have a longer title, as long as it still names them.
- The body, after a blank line:
  - What changed (grouped by area when there are several), why it was done this way, and how it was checked (tests, e2e, screenshots).
  - Wrapped at about 100 characters.
- Co-authors get `Co-Authored-By:` trailers at the end, including an AI assistant that wrote part of the change.
- The author and committer email is the GitHub no-reply address (`<id>+<name>@users.noreply.github.com`), set with `git config user.email` in the repository, so no personal address enters the history.
- A change people can see adds its line under `## [Unreleased]` in `CHANGELOG.md` in the same commit or PR ([contributing](../../CONTRIBUTING.md)).

### What never goes into a commit
- Secrets of any kind: the updater's secret key (kept in `~/.tauri/`), certificates and their passwords, API keys and tokens, `.env` files.
  - `.gitignore` refuses the usual key and certificate files (`*.key`, `*.pem`, `*.p12`, `*.p8`, `*.pfx`).
  - [Managing signing keys and secrets](keys-and-secrets.md) says where each one lives.
- Personal data: real email addresses, local paths with a user name, someone's chat history or `state.json`.
- What the tools make: `node_modules/`, `src-tauri/target/`, `release/`, `scratch/`, the site's build and generated files (listed in `.gitignore`).
- Notes not meant for the public repository (marketing or launch plans, private research). Keep them outside the repository.

### History
- Once pushed, `main` only moves forward: no force-push, no rewritten or dropped commits.
- Fix a mistake with a new commit.
- A secret that reached a commit is treated as leaked:
  1. Revoke and replace it first ([the updater key runbook](../runbooks/updater-key-lost-or-leaked.md) for that key).
  2. Only then remove it from the files.
- The history before the first public push was regrouped once, by area, with the no-reply address (2026-10-06). The older local history is not published.

## Recommendations
Follow these when you can. When you cannot, say why in the PR.
- Keep a pull request to one area and small enough to review in one sitting.
- Split a refactor from the behaviour change it makes room for.
- Name the checks you ran in the PR description with the template's checklist.
- Attach screenshots when the screen changed.
- Before pushing, run `git log --stat origin/main..HEAD` once. It shows any file that should not be there (a capture, a log, a key) before anyone else sees it.

## Exceptions
| When | How |
|---|---|
| The release commit and tag | `pnpm run release` commits to `main` directly; a maintainer pushes them (the ruleset's bypass list lets the release through) |
| An urgent fix while CI is down | A maintainer merges after running `pnpm test`, `pnpm run lint` and `pnpm run test:e2e` locally and says so in the PR |
| Dependabot pull requests | Titles follow Dependabot's form; squash-merged once CI passes |

## Rationale
- A straight `main` where every commit passes the checks keeps `git bisect` and `git revert` useful, and lets a release be cut from any commit.
- Titles that say what changed, rather than a type prefix, make `git log --oneline` read as a history of the app.
- The CHANGELOG holds the user-facing wording; the release notes come from it.
- The no-reply address and the never-commit list exist because a public history cannot be taken back: anything pushed is copied and indexed before it can be removed.

## Automated checks
- Commit titles, bodies and branch names have no automated check beyond the pull request template's checklist (`.github/pull_request_template.md`).
- A maintainer reviews them before merging.
- What does run:
  - CI (`build.yml`) runs the tests and lint on every pull request.
  - The repository ruleset refuses deleting `main` and force-pushing to it.
  - `.gitignore` refuses the usual key and certificate files.

## Change history
- 2026-10-18 Use squash merging for every pull request and document the repository setting
- 2026-10-10 First version
