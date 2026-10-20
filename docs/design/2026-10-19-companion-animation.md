# Companion actions without changing imported pet sheets

## Product direction

PlayPets is a quiet scene that stays beside someone's work. The primary interaction is to ask a friend to do something, watch a brief response, and return to the scene. Opening configuration is not a prerequisite for play. Extra movement serves that interaction; it does not make every idle friend demand attention.

Keep three entrances: scenery and atmosphere, play, and friends/settings. Each destination has one home. Friends/settings contains conversation, invitations, application preferences and window controls, without repeating scenery or play. Play uses the same action board and actual controls at every window size. App settings starts from four explicit tasks: language/startup, coding tools, updates and app information. Only the selected task is visible; Back returns to the task list. The update badge opens its task directly. Closing an entrance returns to the scene. In a small window, right-click offers the same entrances and Always on top. A friend's action chooser identifies that friend and offers actions rather than application configuration.

## Compatibility boundary

Imported Codex/ChatGPT-compatible pet sheets keep the existing nine standard rows, optional sixteen look directions, cell geometry and validation. They remain fully usable without any new metadata. Do not synthesize missing limbs, stretch a resting image into a work pose, or select the laptop working row for garden tasks.

The four bundled companions can have additional app-owned animation resources. Resolve those resources through a trusted built-in registry using asset origin and canonical source identity, never a display name. An imported copy with the same name or metadata does not acquire local file access or trusted clip ownership.

## Production sequence

Start with one Clover digging clip in the everyday outfit. Establish its silhouette, hand/tool contact, ground anchor and recovery before producing the other three companions or seasonal outfits. Generate or draw source frames, clean and align them, and inspect the assembled animation in the actual yard. A contact sheet alone is insufficient. Keep the current artwork until the new sequence is visibly better.

Each action follows anticipation, action, contact, recovery and a result response. Initial coverage is digging and planting, followed by casting/reeling, walking/running/turning, discovery, disappointment and shared reactions. Friends can have different timing and expressions while using the same action phases. Expand the creator skill only after the first working runtime example establishes a stable contract.

## Proposed clip contract

This is a design, not an implemented import format. App-owned sidecars describe:

- A version, built-in source identity, action, facing and outfit variant.
- An atlas reference, explicit cell geometry, frame indices and frame durations.
- Foot anchors and hand/tool grip anchors in normalized cell coordinates.
- Anticipation, contact and recovery event times, plus one-shot or loop behavior.
- The resting fallback and the last valid frame when a reduced-motion preference is active.

Validate finite bounded coordinates, atlas dimensions, cell bounds, duration and event order before rendering. Load clips on demand and release unused decoded images. Repaint only on a changed frame. A missing or invalid optional clip falls back to the standard renderer.

## One timeline per action

A trip owns the action and its cancellation. Arrival starts the authored timeline and commits the discovery once. Body pose, shovel contact, dirt, sound and recovery use that same clock. Reveal the outcome only when both the authored recovery and the backend result have completed. A slow result can hold a quiet completed pose; it does not replay impacts or award another discovery. Scene changes, dragging or reassignment cancel presentation without undoing an already committed result.

A finite jump, wave or celebration finishes once instead of replaying a partial second loop. Continuous walking and agent-status animations retain their current loops. This timing correction does not supply missing action artwork.

## Acceptance before replacing bundled art

Inspect all four companions in normal and small windows, each supported outfit, both facings, light and dark scenes, and reduced motion. Hands keep contact with tools, feet do not slide or jump between frames, silhouettes and facial identity remain stable, and recovery returns to the correct resting anchor. Test cancellation during travel, impact, recovery and a delayed result. Imported pets still render and complete the same activities through their standard fallback.

Image production, sidecar implementation and these visual checks remain required before describing the bundled companions as having dedicated game-quality action animation. No renderer migration is justified solely by a missing pose or an unsynchronized timeline.

## Follow-up: focused management and optional runtime

The management surface now uses Friends, Settings and Window tabs. Each tab shows only its own actions; Settings links directly to one task, whose Back action returns to the Settings tab. The independent tray and keyboard Settings entry keeps the task overview. Small windows do not acquire a persistent management navigation bar.

The optional built-in action runtime and packing helper establish the initial atlas contract. The registry remains empty until artwork passes the visual acceptance above. This does not certify or replace the four companions' action artwork.

## Follow-up: first accepted Clover action set

Clover's everyday outfit now has app-owned dig, plant, cast, wait, reel and
reaction clips. Spring, summer and autumn share that outfit. Winter keeps its
canonical outfit until matching authored art exists. Other built-in and imported
pets keep their normal renderer and activity fallback.

A held tool's ground contact offsets the friend's standing point; it is not
placed under the feet. Soil and dirt cues use explicit contact and lift times.
Tree planting commits at the handoff phase; cancellation before that phase
spends no sapling. Flower planting commits after its authored action.

The fishing action uses a 224 by 216 pixel paint surface with an eight-pixel top
extension. Independent display scale and translation keep the canonical logical
body size and click area unchanged. The rod stays in the painted paws, while a
measured tip connects to the existing interactive line and float. Reduced motion
keeps that line on the first displayed frame. A static frame causes no extra
canvas repaint or SVG rewrite.

## Follow-up: full cast and seasonal outfit coverage

The app-owned action registry now covers Daisy, Clover, Pip and Miso in all four
seasons, with separate dig, plant, cast, wait, reel and discovery clips. Daisy,
Pip and Miso share a baseline outfit in spring and autumn and use matching
summer and winter outfits. Clover shares its overalls and straw hat in the
three warmer seasons and uses its coat, scarf and knitted beanie in winter.
The earlier everyday Clover set remains the starting point for that expansion.

Each action and outfit keeps one shared source scale, measured foot anchors and
complete held tools. A bounded paint canvas can extend above, below or beside
the logical body when a cast or shovel needs room. Its anchor and offset sum
to the canonical ground point at [96, 199], so the body size and interaction area
stay stable. Fishing frames carry measured tips that connect the painted rod
to the existing line and float. Cast and reel finish once; the patient hold and
brief blink loop while waiting for a bite.

These extra clips belong to built-in identities and matching outfits. Imported
pets retain their complete canonical sheets and existing activity fallback.
The portable pet format gains no required action atlas or metadata.
