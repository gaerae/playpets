# Agent workspaces (2026-11-11)

## Why

- A friend linked to a coding agent shows the agent's state only by its dot and its animation row, and keeps strolling: a walk replaces the working or waiting row with the walk cycle, so the state is easy to miss.
- A request for approval (`waiting`) is the one state the person has to act on, and it looks like any other moment in the yard.
- People who keep PlayPets open while they work asked for a place that looks like work: an office where friends sit at desks, come forward with a paper when an agent needs approval, and rest when it is done.

## Goals

- In every place, a friend's agent state shows in what the friend does, not only in its dot.
- `waiting` always brings the friend to the front of the yard, where the person looks first.
- Two new places, an office and a garden workshop, fill the whole window with a workspace: desks, an approval spot and a rest corner.
- Weather and the time of day show through the workspaces' windows.

## Non-goals

- No new animation frames. Friends use the rows every pet sheet has (`working`, `waiting`, `done`, `error`, `src/core/animation.js`), so imported pets behave the same.
- No change to the desktop overlay.
- No approving from the yard. The friend shows that approval is needed; the person approves in the agent.
- No new agent states or hooks.

## Anti-goals

- The yard turns into a dashboard: counters, progress bars or text on furniture.
- An agent's state interrupts something the person started: a drag, a game, fishing, a dig, a flower viewing, a friend the person sent somewhere.
- Work added to the frame loop for friends whose state did not change.

## Behaviour

The state is the coding agent's (`agentStateOf`, `src/core/status.js`), not a chat reply's. `done` and `error` fade back to `idle` as they do today.

| State | Existing places (hillside, courtyard, lakeside, living room) | Workspaces (office, garden workshop) |
|---|---|---|
| `working` | Stops strolling where it is (a stroll under way ends first) and plays `working` | Walks to a desk and plays `working` there, drawn behind the desk's front |
| `waiting` | Walks to the front of the yard, near the middle, and plays `waiting` | Walks to the approval spot at the front and plays `waiting` |
| `done` | Plays `done` once, then strolls again | Walks to the rest corner, plays `done`, then stays there until the next state |
| `error` | Stops where it is and plays `error` | Plays `error` at its desk |
| `idle` or no agent | Strolls as today | Strolls anywhere on the floor |

- Front spot (existing places): feet on the friends' lowest row (`geometry()` y = 1), x near 0.5. Several waiting friends stand side by side about one body apart, nearest the middle first, never behind the dock (`underDock`).
- These trips are not saved (`save: false`); a friend's own saved place stays its place.
- What the person does wins. During a drag, a game, fishing, a dig, a flower viewing or a trip the person started, the friend's state still shows as its dot, and the friend goes to its spot afterwards.
- What a friend started on its own does not win. A friend's own fishing, a blossom gathering, its own dig or planting, or a visit to a plant or a gift ends when its agent turns `working`, `waiting` or `error`.
- A friend whose agent is `working`, `waiting` or `error` is not picked for a friend's own activity.
- A friend reacts when its state changes, not on every frame. Coming back to the place, or the window coming back into view, places each linked friend again.
- With reduced motion a friend is set down at its spot, as every trip already is.

## The two workspaces

| | Office | Garden workshop |
|---|---|---|
| Picture | A warm loft office seen from a gentle high three-quarter angle: four rounded wooden desks with small laptops, shelves, a bulletin board, a coffee corner, a sofa corner, an approval desk with an in-tray and a bell at the front | A glass-roofed workshop, half greenhouse, half pergola: workbenches that double as desks, hanging tools, a chalkboard, a hammock corner, a little approval post with a paper tray and a bell at the front |
| Windows | Tall windows across the back wall | The glass roof and the open side |
| Floor | From about a third of the height down to the foot | The same |
| Mockups | `scratch/bg-mockup/work-office.png`, not committed | `scratch/bg-mockup/work-garden.png`, not committed |

- The art follows the app's painted style (the current places and companions). The mockups are not the art: the final pictures have no friends and no placed gifts, and keep the middle of the floor open.
- Furniture is drawn at the friends' size. At 1180×850 a friend at the front is about 100px tall and one at the back about 60px (`depthFar` 0.6), so a seated friend's head shows above its desk. The mockups' furniture is about three times too large for that.
- No text, letters or logos on screens, boards or papers.

### Sky through the glass

- The window glass in the picture has alpha. The app's live sky (sun, moon, clouds, the time of day's colours) shows through it, so time and weather need no extra pictures.
- Rain and snow stay inside the glass (`windowPanes`, as the living room does).
- The room's light follows the time of day with `environmentLook`, as the outdoor places do. There is one picture per workspace, with no authored time-of-day variants and no seasonal variants.

### Capabilities

| Capability | Office | Garden workshop | Why |
|---|---|---|---|
| `sky` | true | true | The sky shows through the glass |
| `weather` | true | true | Inside `windowPanes` only |
| `soil` | false | false | Paved floors: no digging, trails or discoveries |
| `wildlife`, `seasonalEffects`, `fishing` | false | false | Indoors |
| `ambient` | false | false | The woodland mix does not fit; a room mix is later work |

- Today the indoor pot under a flower keys on `data-sky="false"` (`garden.css`). It moves to the floor having no soil (`data-soil="false"`), so the workspaces get potted flowers while their sky shows.

### Stations

New `geometry.stations` in `worlds.json`, in source-image fractions like `geometry.fishingSpot`, transformed with the picture (`environmentFrame`; the picture is 1536×1024 like every place's):

```json
"stations": {
  "desks": [{ "x": 0.38, "y": 0.52 }],
  "approval": { "x": 0.5, "y": 0.82 },
  "rest": { "x": 0.16, "y": 0.6 }
}
```

- Each point is where a friend's feet stand.
- `desks` holds one point per seat. `approval` and `rest` are one point each; several friends there stand side by side from it, a body apart, never behind the dock (`duty.js inLine`).
- A friend keeps the same desk while it works and gets it back next time when it is free: the first free desk in the order the friends were added.
- When there are more working friends than desks, the extra ones stand beside a desk (one body to the right of each desk in turn, then to the left), then where they stand.
- A station cropped out of a small window falls back to the nearest visible floor point, as a cropped fishing stance falls back to the visible shore.

### Furniture fronts

- Each desk, the approval desk or post, and the sofa or hammock has a front piece (`geometry.fronts`): `{ "art", "x", "y", "width", "height", "foot" }`, its box and foot line in source-image fractions.
- `art` names a mask (`src/art/environments/<art>.webp`) the size of the box. The front is the painted picture's own pixels inside the mask, cut each time the land is painted (`fronts.js`), so it carries the hour's light.
- A front is drawn in the friends' layer at the depth of its foot line. A friend whose feet are above the foot line is drawn behind it, so a friend at a desk looks seated. Clicks pass through it.
- Furniture blocks strolls the way trees do: a stroll does not end on it (`geometry.blocks`: `{ "x", "y", "rx", "ry" }` ellipses in source-image fractions, `workspace.js blocked`). A trip to a station ignores them.

### Depth

- The workspace floors are deep, so friends at the back are drawn smaller than in the yard: `geometry.depthFar` per place (default 0.84, `field.js DEPTH_FAR`), about 0.6 in the workspaces.

### Garden inside

- The flower garden is one garden shown in every place (`garden.rs Plant` has no place). In the workspaces its flowers stand in their indoor pots, as in the living room.
- A tree stays in the place it was planted, and planting one needs soil (`discovery.js`). The workspaces have no soil, so no tree is planted or drawn there, and no tub art is needed.
- Gifts are drawn as they are.

### Small windows

- The workspaces are framed from the bottom (`"fit": "cover-bottom"`, `environment.js environmentFrame`): a window shorter than the picture keeps the front of the room and loses the top of the wall, never the floor's front.
- Down to 300×210, the approval spot and at least two desks stay in view. Desks sit near the middle and the approval spot at the front centre.
- In a window wider than the picture (a short strip), the front wins: the approval spot stays, and a desk cut off falls back to the nearest visible floor point.

### Words

- Each workspace gets a `label`, an `about` and its own `chatter` key in the four page string tables (ko, en, ja, zh-hans), using the glossary in the [i18n standard](../standards/i18n.md). Friends' idle lines talk about the room, not about stars or the outdoors.

## Order of work

1. Behaviour in every place (no new art): state reactions, front spot, the dock rule, tests.
2. Stations, fronts, blocks, `depthFar` and `soil`-keyed pots: data and code, tested with stand-in pictures.
3. The two pictures, their fronts and their geometry; the string tables; visual audit fixtures (day, night, rain, full size, 500×350, 320×240, a short wide window).
4. Docs: [add a place](../how-to/add-a-world.md), the places design (a follow-up note), the guide's agent page and the CHANGELOG.

## Left to the builder

- How fronts are cut (a mask per piece is fine) and how the glass alpha is made.
- The exact station points, after the pictures exist.
- The `working` pose at a desk faces the screen; turning toward the laptop is not required.
