# Standard: Commits, branches and history

## Applies to
Every change that enters the repository: code, docs, the site, workflows and release commits. It covers how work is branched, how commits are written, how they reach `main`, and what is never committed.

Not covered: the release steps themselves ([Release a new version](../how-to/release.md)) and keys and tokens ([Managing signing keys and secrets](keys-and-secrets.md)), which this standard only points to.

## Rules
**Branches**
- `main` is the only long-lived branch. It always passes CI (`build.yml`) and can be released at any commit. The repository ruleset blocks deleting it and force-pushing to it ([set up the repository](../how-to/set-up-the-repository.md), step on rulesets).
- Work happens on a short-lived branch made from the latest `main`, named `<area>/<topic>` in lowercase with hyphens. The area is the part of the app or the kind of work, for example `yard/lake-shape`, `chat/avatars`, `backend/command-table`, `fix/gift-day`, `docs/commit-standard`, `ci/pin-actions`. A branch carries one change and goes away once it is merged.
- A branch reaches `main` through a pull request that a maintainer reviews and merges. Before merging, the branch is brought up to date with `main` by rebasing it, so `main` stays a straight line with no merge commits.
- A pull request with one change is squash-merged, and its title becomes the commit title, so the PR title follows the commit title rule below. A pull request whose commits each stand on their own (each passes the checks) is rebase-merged, keeping them.
- Versions are tags (`vX.Y.Z`) on `main`, made by `npm run release -- x.y.z` and pushed by a maintainer. There are no release branches: a fix for a released version goes to `main` and out in the next patch version.

**Commits**
- One commit is one change someone could review, revert or find with `git bisect` on its own, and every commit passes `npm test` and `npm run lint`.
- The title is one sentence in English that says what is different for the people using or working on the app, with no period and no prefix such as `feat:`; for example "Friends stand behind what is in front of them". It fits on one line of `git log --oneline` (about 72 characters; a commit that lands several related changes may run longer, as long as the title still names them).
- The body, after a blank line, says what changed (grouped by area when there are several), why it was done this way, and how it was checked (tests, e2e, screenshots). Wrap it at about 100 characters.
- Co-authors are credited with `Co-Authored-By:` trailers at the end, including an AI assistant that wrote part of the change.
- The author and committer email is the GitHub no-reply address (`<id>+<name>@users.noreply.github.com`), set with `git config user.email` in the repository, so no personal address enters the history.
- A change people can see adds its line under `## [Unreleased]` in `CHANGELOG.md` in the same commit or PR ([contributing](../../CONTRIBUTING.md)).

**What never goes into a commit**
- Secrets of any kind: the updater's secret key (kept in `~/.tauri/`), certificates and their passwords, API keys and tokens, `.env` files. `.gitignore` refuses the usual key and certificate files (`*.key`, `*.pem`, `*.p12`, `*.p8`, `*.pfx`), and [Managing signing keys and secrets](keys-and-secrets.md) says where each one lives.
- Personal data: real email addresses, local paths with a user name, someone's chat history or `state.json`.
- What the tools make: `node_modules/`, `src-tauri/target/`, `release/`, `scratch/`, the site's build and generated files (listed in `.gitignore`).
- Notes that are not for the public repository (plans for marketing or launch, private research). They live outside the repository.

**History**
- Once pushed, `main` only moves forward: no force-push, no rewritten or dropped commits. A mistake is fixed by a new commit, and a secret that reached a commit is treated as leaked: it is revoked and replaced first ([the updater key runbook](../runbooks/updater-key-lost-or-leaked.md) for that key), and only then removed from the files.
- The history before the first public push was regrouped once, by area, with the no-reply address (2026-10-06); the older local history is not published.

## Recommendations
Follow these when you can. When you cannot, say why in the PR.
- Keep a pull request to one area and small enough to review in one sitting; split a refactor from the behaviour change it makes room for.
- Name the checks you ran in the PR description with the template's checklist, and attach screenshots when the screen changed.
- Before pushing, look at `git log --stat origin/main..HEAD` once: it shows a file that should not be there (a capture, a log, a key) before anyone else sees it.

## Exceptions
| When | How |
|---|---|
| The release commit and tag | `npm run release` commits to `main` directly; a maintainer pushes them (the ruleset's bypass list lets the release through) |
| An urgent fix while CI is down | A maintainer merges after running `npm test`, `npm run lint` and `npm run test:e2e` locally and says so in the PR |
| Dependabot pull requests | Their titles follow Dependabot's form; they are squash-merged once CI passes |

## Rationale
A straight `main` where every commit passes the checks keeps `git bisect` and `git revert` useful, and lets a release be cut from any commit. Titles that say what changed, rather than a type prefix, make `git log --oneline` read as a history of the app; the CHANGELOG holds the user-facing wording, and the release notes come from it. The no-reply address and the list of what never goes in exist because a public history cannot be taken back: anything pushed is copied and indexed before it can be removed.

## Automated checks
There are no automated checks for commit titles, bodies or branch names beyond the pull request template's checklist (`.github/pull_request_template.md`). A maintainer reviews them before merging. What does run: CI (`build.yml`) runs the tests and lint on every pull request, the repository ruleset refuses deleting `main` and force-pushing to it, and `.gitignore` refuses the usual key and certificate files.

## Change history
- 2026-10-10 First version
