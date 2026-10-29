# Calm collection information

This follows [environmental discovery](2026-10-19-environmental-discovery.md)
and supersedes the original spontaneous seed-pickup flow in
[a yard that grows](2026-10-09-a-yard-that-grows.md).

## A readable collection

The default album shows specimens and actionable habitat clues. Exact percentages
are an optional view, opened with Show odds for saplings and keepsakes. The
toggle remains available at compact sizes and does not add a separate settings
trip. It starts off at launch and keeps its choice while comparing books during
the current app session. The website's expandable probability guide remains
available for detailed comparisons.

Explain availability separately from probability. A rare-find waiting period has
its own short status and return time; it is not another empty outcome. An indoor
floor cannot be dug. Fish prefer their seasons and periods, some favor rain, and
bugs need clear outdoor conditions. Flowers use their planting season and grow
by elapsed time. Daily gifts follow a sequence, not a randomized drop table.

## One source for planting stock

Both flower seeds and saplings come from digging. Existing pockets and planted
gardens stay intact; no roaming seed generator, pickup node, pickup-only sound,
event handler or translated pickup instruction remains in current runtime code.
The seed drawing used for a planted growth stage is still active content.
Historical dated records remain as history, with this follow-up describing the
current rule.

## Gifts belong to the yard

All friends share at most one gift per local calendar date. A friend delivers it,
but inviting more friends does not multiply the daily allowance. Twelve placed
decorations pause delivery; the gift book explains how to make room without
losing collection records.

The initial delivery waits five minutes; later deliveries wait 20 to 40 minutes.
Once scheduled, the deadline survives closing the app and uses wall time, so
repeated short sessions do not restart the wait forever. An overdue gift waits
for room and an available friend. Persisted deadlines belong to the profile and
last receipt date. Malformed records and clock corrections cannot create an
unbounded delay; failed requests retain a quiet one-minute retry. The backend
still enforces the daily limit.

Calendar event gifts and species retain their existing real-date restrictions.
They can take months to complete and are not described as a short-term random
collection goal. Changing that policy is a separate product decision, rather
than a hidden adjustment to probability display.

## Follow-up: conditions without exact odds (2026-10-19)

Remove the optional exact-odds view from the album and public collection guide.
A zero caused by an indoor scene or rare-find waiting period looks like a broken
or permanently unobtainable item. Keep habitat clues, rarity and explicit waiting
status instead. Probability calculations remain internal for balancing and tests.

## Follow-up: gifts come from friends (2026-10-29)

"Gifts belong to the yard" above is historical. Gifts still come one at a time for
the whole yard, but every other day and only from a friend the person did
something with that day. The wait is kept in `state.json` (`giftWait`), not in
browser storage, and a full yard keeps new gifts in a gift box instead of pausing.
See [gifts from friends](2026-10-29-gifts-from-friends.md).
