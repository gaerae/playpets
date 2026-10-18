# Friend-led discovery and growing trees

## Intent

Offline play is a first-class reason to keep PlayPets open. A person can ask a particular friend to explore or garden without connecting an AI. The yard stays calm: no energy meter, paid currency, punishment, compulsory quests or permanent holes. This is a proposal following the 2026-10-19 navigation design, not an implemented feature.

## Friend actions

Right-clicking a friend opens a short menu named for that friend. Pat, wave, jump, dig and planting work without AI. Chat remains a separate action, with an explicit connection route when needed. A group game is labeled as a group game, even when launched from a selected friend; it never pretends to be a solo activity. Double-click and keyboard chat remain available. Context menus share the existing menu helper, focus rules and viewport bounds. While a group game runs, offer Stop rather than silently replacing it with an individual task.

## Digging

Choose a friend, choose Dig, then click usable ground. Show a placement hint and ghost marker; Escape cancels. The selected friend walks to the target, faces it and digs for about two seconds. Soil, shovel and a short dust puff make the action readable without adding a new sprite-sheet row. Reuse the working pose only if it visually fits the tool. Do not rotate or deform an entire character to fake an arm action.

Placement excludes water, the non-walkable background, occupied prop footprints and tree roots. Reject invalid ground before sending the friend there. Indoor floors cannot be dug. Imported scenes can opt into soil interaction through an explicit capability; existing outdoor scenes receive that capability, while older packages infer it conservatively from outdoor capabilities. The normalized target belongs to the background's coordinate system, not screen pixels. The same rules apply after resizing and at mixed display densities.

The backend validates the friend, finite field coordinates, registered ground profile and catalog result, then saves the result before presenting a reward. Ground profiles use a versioned, bounded normalized geometry contract: the selected scene ID, usable ground boundary, water exclusions and root/prop footprints. Built-in metadata comes from repository content; imported metadata is author-supplied data validated and registered by the backend, not inferred from image pixels. The frontend previews the same rules. This is a local-app consistency contract, not a claim that an imported drawing has been independently understood. Keep existing friend movement; targets exclude roots, while friends can pass behind tree canopies using existing depth ordering. A completed attempt may return nothing, a flower seed or a small keepsake. If the seed pocket is full, keep that outcome and show a normal full-pocket response; do not reroll it or report an error. Proposed first balance (a builder recommendation): 40% empty, 25% flower seed, 30% ordinary keepsake, 5% uncommon keepsake. Eight keepsakes are enough for the first collection page. Repeats increase a count. The guide states the empty chance and conditional odds separately. An eight-second per-friend cooldown prevents accidental repeat commands; it is a quiet availability hint, not an energy mechanic. Removing the selected friend, starting a group game or switching scenes cancels before arrival without reward or cooldown. Once digging begins, issue a backend attempt ID and commit its result once; duplicate completion returns that result instead of rolling again. Quitting cannot duplicate a recorded find. There is no queued autoplay or automatic task resumption after relaunch. Recent patches belong to a scene ID and keep at most 32 entries across the profile, with a 24-hour expiry. Changing away and back retains them. Save this record with the outcome so reopening cannot immediately reroll the patch. Weather and season may change eligible keepsakes, never the validity of saved discoveries.

A small hole closes after the result and its visual fades; nothing accumulates across the yard. Empty attempts get a short friendly response without an error toast. A new discovery uses the existing collection reward card. Keep drawing tied to active animation and stop repainting after the effect ends. Reduced motion keeps the action, progress and result readable without jumping or flying particles.

## Trees

Add three authored species: cherry, maple and pine. Tree planting is available without AI and without a paid or consumable resource; the first version uses at most three planted trees per scene and twelve across the profile to keep a usable yard. New trees belong to the scene where planted; switching scenes does not transplant them. Removed or unavailable imported scenes retain their trees without drawing them. Existing flowers and decorative gifts keep their current shared storage in this change. Choose a species, then ground. The selected friend walks over and plants it. Proposed growth timing: a seedling at planting, a young tree after two hours, and a mature tree after twelve hours, including time the app was closed. Stage transitions come from the saved planting timestamp. A clock moving backwards never removes progress that was already recorded.

Trees have their own persistent instances and are not disguised as decorative gifts or flowers. Each species has a foot anchor, visible footprint and shared world scale; mature trees should be taller than a standard friend but stay clear of scene landmarks and fishing access. Seasonal appearance belongs to the species' art and does not reset growth. Drag to reposition and confirm before removal. Record the first mature species in the collection. Start with outdoor planting; indoor potted trees remain a separate future design.

## Compatibility and content

Extend the existing catalog and album/garden owners, using default-empty fields for old saves and keeping unknown future data. Centralize all placement, growth and odds rules so the app and four-language discovery guide cannot diverge. New background capabilities and guide/skill schemas evolve together. Artwork needs source/provenance and generated exports through maintained scripts, with app and compact visual review. No forced replacement of existing character identities or unrelated sprites.

## Motion and prop audit

Review all four friends in both directions and all three outfits as frame strips and looping previews. Check opposing arm/leg phases, planted-foot drift, baseline and head stability, loop closure, direction and duration. A valid eight-cell PNG alone is not a passed animation review. Only replace a walk row after a side-by-side loop shows a clear improvement; preserve the remaining rows and every accepted outfit. Record findings and captures in ignored scratch, not in this lasting design.

Review placed gifts, flowers, planted trees, the picnic, shovel, rod, net, rewards and labels at standard and enlarged friend sizes, compact and wide windows and display scale factors 1, 1.25, 1.5 and 2. Separate physical-screen appearance from CSS layout and pixel density. Windows native appearance remains a separate check from browser calculations.

## Delivery

Complete the already approved navigation/update work first. Then implement friend actions and discovery/growth in reviewable units, with rule tests, import/save compatibility and real-app scenarios. Add all four app and site languages, guide odds, creator/background contract changes and the Unreleased changelog together. Do not label the Store-uploaded old MSIX as containing this work; build and verify a new release candidate before submission or publication.
