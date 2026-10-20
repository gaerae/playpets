# Environmental discoveries and a calm collection pace

## Intent

Choosing where and when to dig gives a useful route to a missing specimen. The
yard remains an occasional companion during work, with no energy meter, paid
boost, login streak or requirement to keep playing. Existing collections remain
intact. This follows the [friend-led discovery design](2026-10-19-friend-led-discovery.md)
and replaces its initial reward proposals for environmental selection and pacing.

## Reward contract

A fresh valid dig has five categories: empty 30%, flower seed 25%, tree sapling
20%, common keepsake 22%, uncommon keepsake 3%. A full seed or selected sapling
pocket refuses that item without rerolling. Category selection and species
selection use independent backend entropy. Friends, bond, window size and display
density do not alter rewards.

Tree and keepsake definitions may declare `affinity` with `seasons`, `weather`
and `places` arrays. Each matching axis doubles the item's base `weight`, which
defaults to one. Matches within an axis count once. Weights normalize separately
inside the sapling, common and uncommon pools. A preference never excludes an
item or changes its rarity. The built-in place IDs are `woodland`, `courtyard`
and `lakeside`. Imported outdoor scenes have neutral place weights and retain
season and weather preferences. Indoor floors remain unavailable for digging.

The command receives the chosen season and weather when the friend arrives and
starts the action. Later scenery changes cannot alter an issued result. Missing
context in older local callers keeps neutral weights; malformed context is
rejected before changing saved state. Snow and winter are independent choices.

## A reason to return

An uncommon keepsake starts a rolling 24-hour interval shared by every friend
and place. During the interval, the uncommon 3% becomes common keepsakes, giving
25% common and 0% uncommon. Nothing becomes an extra empty outcome, and ordinary
digging, seeds, saplings and other activities remain available. Uncommon repeats
also start the interval. There is no hidden guarantee or preference for unseen
items.

The existing saved dig ledger owns this interval. Replaying a patch returns its
original result without another reward or restarting the timer. Changing a scene,
friend or atmosphere does not reset it. Expiry is per timestamp, not midnight;
clock rollback repair keeps the result and clamps future timestamps to the
corrected current time. This is local consistency, not protection against manual
save-file or system-clock manipulation.

Four distinct uncommon keepsakes require at least 72 elapsed hours between the
first and fourth finds in a new collection. Random duplicates can extend that
span. The overall album also retains its separate gift dates, seasonal events
and offline growth. Do not describe a simulation's attempt budget as playtime or
a completion promise.

## What people see

Tree and keepsake cards show preferred conditions and the current per-fresh-dig
percentage. A short collection header shows the selected environment and when
uncommon finds return; it updates when scenery changes or the interval expires.
The longer rule belongs in the guide and the header's explanatory tooltip.
Unknown finds keep their silhouettes while still showing useful habitat clues.

The four-language website uses the same catalogue and page probability helper.
Its filters are a preview before the uncommon interval, not a connection to a
visitor's save. It explains the 25%/0% interval explicitly. Preferential habitats
can make a targeted uncommon item more likely than an off-habitat common item in
one dig. Rarity describes the separate category and 24-hour pace; every common
item's best route remains easier than any uncommon item's best route.

## Maintenance

Keep Rust selection, page calculations and guide copy together. Tests cover
category boundaries, every season/weather/place combination, legacy restoration,
replay, exact interval expiry, full pockets, positive acquisition paths and
finite-ground collection simulations. Compare guided and unguided play with a
fixed seed and state the assumptions. Keep measured counts, captures and audit
results outside this lasting design.
