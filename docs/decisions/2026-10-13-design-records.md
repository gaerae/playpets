# Decision: Consolidate the October design reports into topic records before the first publication

## Context
From 2026-10-11 to 2026-10-13, agents wrote 22 records in `docs/design/` while the yard, the companions, the art and the site changed quickly. Most were work reports rather than designs: audits, "final" reviews with test counts, quality gates, work lists, and evidence that lived only in the ignored `release/` folder or under `/tmp`. Later records replaced what earlier ones said, so several carried "Follow-up (2026-10-12)" notes correcting the studio, the number of companions, the site's languages or the art in use. A contributor had to read a chain of records and their corrections to learn what the code does now.

The repository rule says dated records are not rewritten. That rule protects what readers have already relied on. These 22 records had never been published: the repository had no public history and the site had not been deployed.

## Decision
- Replace the 22 records with five topic records that hold only what a future contributor needs: the design, the decisions and their reasons, the constraints, and pointers to the code. They are [places](../design/2026-10-11-places.md), [companions](../design/2026-10-11-companions.md), [art direction](../design/2026-10-11-art-direction.md), [product direction](../design/2026-10-11-product-direction.md) and [the website](../design/2026-10-12-website.md). Each states what the code does on 2026-10-13; where the old records disagreed, the code decided.
- Drop work reports, test counts, dated evidence, local paths under `release/` or `/tmp`, and step-by-step histories of what was tried. The original records were taken out of the history before its first publication, so the published history starts with the topic records.
- From now on, `docs/design/` holds lasting designs and decisions only. Reviews, audits and verification results (what was checked, counts, screenshots, remaining limits) go in the pull request or the commit body. A design that changes later gets a dated follow-up note, as before.

## Consequences
- Positive: each topic has one current record, and links from the how-to guides and standards point to it. The developer docs published on the site no longer show reports that contradict each other.
- Negative: the reasoning behind a step that was tried and rejected survives only in the short "why" each record keeps and in the commit bodies.
- Neutral: the six older design records (2026-09-29 to 2026-10-10) are unchanged. This consolidation is a one-time exception for unpublished records; published records are still not rewritten.

## Alternatives considered
| Alternative | Why rejected |
|---|---|
| Keep the 22 records and add more follow-up notes | The corrections already outnumbered the lasting content in several records, and every new change would add another note to many files |
| Move the reports to a `docs/reports/` folder | The reports' evidence lives in ignored local folders, so the reports cannot be checked; the pull request is where a reviewer reads them |
| Delete the reports without replacing them | The places registry, the pet identity rules, the art pipeline and the site structure are designs a contributor needs; they would have been lost with the reports |
