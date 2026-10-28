## What changed and why
<!-- State the problem and resulting behavior in one or two sentences. -->

## Related issue
<!-- #number, if any -->

## Checked
- [ ] Commit titles say what changed ([commits, branches and history](https://github.com/gaerae/playpets/blob/main/docs/standards/commits-and-branches.md)), and no key, token, personal data or generated file is in the diff
- [ ] For changes people can see, noted under `[Unreleased]` in `CHANGELOG.md` (website, README and docs under `### Website and docs`)
- [ ] `npm run lint`
- [ ] `npm test`
- [ ] Security and CodeQL checks passed in CI (`npm run security:check` runs the secret/dependency checks locally)
- [ ] `npm run test:e2e`
- [ ] If the site (`website/`) or `docs/` changed, `npm run site:build`
- [ ] If the screen changed, captures attached
- [ ] If the drawing loop or animations changed, `npm run measure` before and after
