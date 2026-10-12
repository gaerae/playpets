# Companions and pet identity

Consolidated on 2026-10-13 from the design work of 2026-10-11 and 2026-10-12.

PlayPets ships ten companions so the yard is never empty on first start, and it treats
every pet the same way whatever its drawing style. This record holds the cast, the rules
that keep a pet's identity apart from its look, the optional PlayPets extensions to the
pet file, the migration that kept old friends intact, and the contract a creator can
rely on. The pet file format itself is in [the pet file
standard](../standards/pet-files.md).

## The ten companions

`PETS` in `src-tauri/src/pets/builtin.rs` lists them in shelf order. They are built into
the binary and unpacked into the data folder; `shelf_rank` keeps that order ahead of
imported pets.

| Entry | Kind | Look | Seasonal sheets |
|---|---|---|---|
| Daisy | person | Illustrated young explorer: daisy beret, apricot dress, satchel | summer, winter |
| Clover | animal | Illustrated kitten gardener: teal overalls, straw hat; the brand mascot | summer, winter |
| Pip | animal | Illustrated puppy courier: blue jacket, red scarf, mailbag | summer, winter |
| Aria | person | Semi-realistic adult woman, 25, with a face portrait | summer, winter |
| Aria Mini | person | Illustrated, large-head version of the same character | summer, winter |
| Noah | person | Semi-realistic adult man, 26, with a face portrait | summer, winter |
| Noah Mini | person | Illustrated, large-head version of the same character | summer, winter |
| Tabby, Smoky, Mochi | animal | The original mascot cats, redrawn in the sculpted style | none |

The first empty-yard screen offers the first three entries, Daisy, Clover and Pip
(`src/yard/welcome.js`). Invite's type filter puts `person`, `human` and `humanoid`
kinds under People and `animal` under Animals; any other kind stays available under
Other (`src/panel/invite.js`). The cats kept their ids and saved identities when their
flat sheets were replaced; their sources are in `assets/pets/<cat>/`, and
`npm run mascot-pet` draws the historical flat sheets only into ignored
`release/legacy-pets/`.

## Ordinary, independent entries

A shelf entry is an ordinary pet: a name, a preview, a creator, a license and an Invite
action. Aria and Aria Mini, and Noah and Noah Mini, are separate entries with their own
asset ids and manifests (`assets/pets/aria/builtin-full.json` and `builtin-mini.json`,
and the same for Noah). The full-size entry uses the realistic sheets as its baseline;
the Mini entry uses the illustrated ones. Neither is an alternate look of the other.

Reasons, from the owner's preference and the review of three options:

- A separate realistic-pet subsystem would bring its own management rules, onboarding
  and hard-coded categories. Rejected.
- One character card with a compulsory style step would add a step to every invitation
  and conflict with ordinary single-sheet imports. Not used.
- Ordinary entries keep imports, invitations and management the same for every pet and
  leave room for any art direction. Chosen.

Each invited friend owns its name, conversation, relationship and preferences. Inviting
another copy makes another independent friend; existing friends and histories are never
merged or renamed to tidy the catalog. "Mini" in a pet's name is a drawing, not a window
mode: every pet can be shown in the full window, the mini window and the desktop
overlay.

## Seasonal wardrobes

`seasonalSpritesheets` in a manifest maps known seasons (`spring`, `summer`, `autumn`,
`winter`) to relative files inside the pet folder. The seven illustrated and adult
entries ship summer and winter; spring and autumn share the layered baseline rather than
pretending to four wardrobes. Unknown seasons, paths outside the folder and missing
files fall back to the baseline (`optional_sheets` in `src-tauri/src/pets/catalog.rs`).

The season comes from Settings: Auto, or a fixed Spring, Summer, Autumn or Winter. Auto
follows the local date and hemisphere (`seasonFor` in `src/core/season.js`). Both the
yard and the desktop overlay read the same saved choice. A fixed season changes the
scenery and wardrobes, but calendar festivals keep their real dates (`sceneEvent` in
`src/yard/events.js`), so choosing a season never brings out-of-date festival rewards.
`src/core/sprites.js` keeps one decoded sheet per pet and appearance, shows the current
sheet until the next season's sheet has decoded, and ignores a late failure from a sheet
it no longer wants; nothing is added to the movement frame loop.

## Realistic sheets and portraits

`realisticSpritesheets` (`default` plus optional seasons) and `realisticPortraitPath`
are optional fields an imported pet may carry. The friend editor shows the
illustrated/realistic choice only for an imported pet that ships a realistic default
sheet; built-in entries hide it (`src/panel/friend-settings.js`). The per-friend choice
is `VisualStyle` in `src-tauri/src/pets/model.rs`, saved as `"illustrated"` or
`"realistic"`, and two copies of one pet can choose differently.

`portraitPath` is an optional baseline face portrait that any pet may ship; Aria and
Noah use it. Portraits appear in conversation and appearance cards, are limited to the
pet folder and to `PORTRAIT_LIMIT`, and a missing portrait falls back to the sprite
avatar. Changing an appearance repaints existing chat avatars without touching messages,
drafts or scroll position.

## The compatibility migration

An earlier build drew full-size Aria and Noah through the Mini asset plus
`visualStyle: "realistic"`. `migrate_friends` in `builtin.rs` maps exactly that built-in
pair to the full-size entry and resets the style, keeping the friend id, so
conversations, closeness, relationship and agent assignment stay attached.
`preserve_legacy_appearances` keeps such friends drawable if unpacking the new entry was
interrupted. Imported pets are never migrated. [The art storage
decision](../decisions/2026-10-12-art-storage.md) records why the small path stays:
removing it would let old records resolve to the Mini look.

## Adult partner companions

Aria and Noah are fictional adults, not likenesses of real people, and their
descriptions say so. Like every friend, they start as a friend. Partner is one of the
relationships in `RELATIONS` (`partner`, `senior`, `junior`), chosen explicitly in the
friend editor; its voice is defined in `src-tauri/src/chat/prompt.rs`. Picking a
full-size look never turns it on. Relationship, appearance, display size, season and
weather stay separate controls because they change different things.

Limits to state honestly: small realistic friends keep a readable silhouette but not
portrait-level facial detail, walks are gentle alternating shuffles rather than rigged
locomotion, and the fishing rod and bug net hang from a shared torso anchor rather than
per-character hands.

## The creator contract

- **Minimal pet:** `pet.json` and one canonical sheet. The v2 sheet is 1536×2288 RGBA,
  eight columns by eleven rows of 192×208 cells: nine animation states, then sixteen
  gaze directions. It imports and invites with no style step and works in every display
  mode.
- **PlayPets extensions:** seasonal sheets, portraits and realistic sheets are optional
  and PlayPets-specific. Do not claim they work in other hosts; a portable download
  keeps the baseline package separate from the richer one.
- **Import adds, never replaces:** importing a folder creates an independent pet with
  its own id; it does not change an existing friend's look or history.
- **No new states from design art:** turnarounds, face sheets and extra poses are design
  references. An action outside the nine states needs a future, versioned runtime
  contract before it can play.
- **Not built:** creator-named appearance sets bound to one identity. The `VisualStyle`
  enum is where such a set would begin, with its own spec, validation, fallback and
  migration.

The creator studio on the site and its prompts are described in [the website
record](2026-10-12-website.md); the kit specification is `scripts/creator-specs.mjs`,
and accepted references are in `assets/creator-kit/`.

## Checks

`src-tauri/src/pets/builtin.rs` and `catalog.rs` hold the Rust tests for unpacking,
migration and manifest validation. `tests/invite.test.mjs`,
`tests/invite-shelf.test.mjs`, `tests/appearance.test.mjs`,
`tests/seasonal-sprites.test.mjs`, `tests/season-choice.test.mjs`,
`tests/overlay-season.test.mjs`, `tests/chat-appearance.test.mjs` and
`tests/legacy-cat-art.test.mjs` cover the page side.
