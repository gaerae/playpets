# Winter decorations (2026-11-21)

## Why

- The winter lights brought three gifts (the little Christmas tree, the baby reindeer, Santa), then everyday ones again: a winter yard had little to decorate with.
- The little tree's painted look (pastel baubles, plain fir) read older than the rest of the gifts. People choosing decorations today pick a theme: gold and cream, coquette ribbons, pastel retro.

## Goals

- The little Christmas tree, and its grand night version, are redrawn in gold and cream. Its ornaments and its Christmas night stay.
- Two more trees, a coquette ribbon tree and a pastel retro tree, each as a small and a big album card.
- Six props: a stack of gift boxes, a string-light vine arch, a wreath on a stand, a candy cane star lamp, a sundries cart and a gingerbread house.
- The album grows from 203 to 213 entries; gifts from 31 to 41.

## Non-goals

- The new trees take no ornaments and do not grow on Christmas night: those belong to the little tree, which friends bring first.
- No new event and no new dates: everything comes with the winter lights, from November 15.

## Anti-goals

- A decoration that only shows on Christmas: these are set out like any gift, anywhere in the yard and on the desktop.
- A winter so long that the everyday gifts stop: the event's gifts come one each gift day, and the everyday ones come again after the last.

## Rules

| What | Rule | Why |
|---|---|---|
| Order | During the winter lights, friends bring the tree, the reindeer and Santa, then `ribbon_tree`, `light_arch`, `gift_stack`, `wreath_stand`, `candy_lamp`, `retro_tree`, `gingerbread_house`, `sundries_cart`, `ribbon_tree_big`, `retro_tree_big`: catalogue order (`content.rs event_gifts`) | Someone who already has the first three gets something new next; the big trees come last |
| Time | A gift every 2 days, so the thirteen fit inside November 15 to December 31 for someone who plays most days | The event's own gift days |
| Shown | All ten are `shown: christmas` and `seasons: ["winter"]`, as the tree is: in the yard and on the desktop from November 15 to January 7, and whenever the yard shows winter | One rule for every Christmas gift |
| Small and big | Separate kinds and cards (`ribbon_tree`, `ribbon_tree_big`): small 76 px tall, big 132 | A person can set out either, or both |
| Lit | The four trees, the arch, the lamp, the house and the cart glow from evening (`effects: glow`). The arch and the lamp switch on the desktop (`poke: switch`); the cart chimes when a friend visits | The same effects other gifts use |
| Light point | A gift may name where its light is (`light: [x, y]`, shares of the drawing): the halo is centred there instead of the top of the middle (`effects.js effectLayers`) | The lamp's star hangs to one side, the cart's lantern on its canopy |
| Hanging | The wreath stand hangs (`hangs`, `part` sway): on the desktop, near a screen's top, the wreath hangs on a cord without its stand | The same rule as the hanging pot and the mobile |
| Art | Three atlases made through Codex in the house style; the generator's soft alpha kept, its faint haze cleared | The old rule (clear alpha below 50) made edges hard |

## Left to the builder

- Sizes, feet, shades and light points, read off the drawings.
- The tree's twelve hooks: on its four painted baubles, the rest in gaps between them; on the grand tree, twelve of its thirteen painted baubles.
- Names and visit lines in four languages, by the glossary.

## Calls made while building

- The rare share the album keeps for the gift book rose from a quarter to under half: an event's gifts come on dated gift days, not by chance.
- The small tree's painted baubles fell from five to four; the test that asked for five asks for four.
