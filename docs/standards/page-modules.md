# Standard: Page code structure

## Applies to
- All page code under `src/`:
  - the yard window (`index.html`, `app.js`, `core/`, `yard/`, `panel/`, `styles/`)
  - the desktop overlay window (`overlay.html`, `overlay/`)
- Not covered: test code in `tests/` and development tools in `scripts/`.
  - They run in Node, where page initialization order does not matter.
  - Oxlint correctness checks and Biome's code style rules still apply to the whole repository.

## Rules
### Modules
- A module does not touch the page when it is imported.
  - Button wiring, timers, and creating canvases and observers go inside `setup…()` functions.
  - Only the entry points (`src/app.js`, `src/overlay/overlay.js`) call those functions.
  - Computing pure values at module level (such as a list built from strings) is fine.
- Every module but the two entry points imports without a page.
  - Nothing at its top level reads `window`, `document`, `matchMedia` or the bridge, so Node can import it and test its logic.
  - Read them inside functions, where they are available.
- Modules do not import each other in a cycle.
- When a lower layer (a drawing module such as `yard/views.js`) needs behavior from a higher layer (play, opening a panel), it receives the function as a `setup` argument instead of importing it.
- The `import` paths and names in a new module match what the imported file actually exports.
- Do not write sentences shown on the page in code; use keys from the strings table ([i18n standard](i18n.md)).
- Loops and animations that redraw the page follow the [performance standard](performance.md).

### Styles
- Style files load in this order, and new rules go in the file for their area:
  1. `base.css`
  2. `shell.css`
  3. `scenery.css`: what stands behind the friends: the sky's and land's colours (read by the painter in `src/yard/easel.js`), the sun and moon, clouds, weather
  4. The yard's files:
     1. `yard.css`: the frame and the field
     2. `friends.css`: bodies, tags, bubbles, agent dots
     3. `garden.css`: plants, gifts and their effects, digging
     4. `caption.css`: the scene picker, view controls and hint
     5. `tools.css`: the toolbar and the games' menu
     6. `welcome.css`: an empty yard's card
     7. `play.css`: games and fishing
     8. `compact.css` last: responsive changes at small window sizes
  5. The panel's files:
     1. `panel.css`: the panel and what every tab uses
     2. `invite.css`
     3. `friend.css`: the Friend tab's head and menu
     4. `chat.css`: the conversation and the message box
     5. `settings.css`: the Settings sheet and the AI connection dialog's choices
  6. `dialog.css`
- A small window's variant of a rule (`body.compact`) goes beside it, at the end of the same file.
- `compact.css` holds the small-window variants of the yard, the dock and its menus.
- Responsive changes to the panel go at the end of the panel file that owns the element, after that file's own rules, not in `compact.css`.
- This order decides which media rules apply last and which of two equally specific rules wins.
- Style select boxes completely instead of relying on the engine's default look. One stylesheet has to look the same in WebKit (macOS, Linux) and WebView2 (Windows).

### Shortcuts, menus and classes
- A keyboard shortcut is a row in `SHORTCUTS` (`src/core/keys.js`).
  - The module that owns the action registers it with `onShortcut`.
  - The macOS menu bar (`src-tauri/src/menu.rs`) shows the same key.
- What opens from a button uses `dropdown` (a panel) or `popup` (a menu, with arrow keys) from `src/core/menu.js`, so every menu opens, closes and moves focus the same way.
- Each class on the yard element has one owner.
  - The scene (`yard/sky.js`) sets only its own classes: `period-…`, `weather-…`, `season-…`, `event-…`, `look-…` and `moon-full`.
  - The module that sets `aiming` (`care.js`), `playing` (`play.js`), `can-catch` (`catch.js`) or `after-rain` (the rainbow in `sky.js`) owns that class and removes it again.
  - No other module adds or removes it, and the scene's updates leave it in place.
- A menu whose rows come from something in code is built from a table, not written in the markup.
  - The Games menu is built from the games' rules (`RULES` in `yard/play.js`: icon, name, tooltip), so a new game adds no markup.

### Example

```js
// panel/example.js — does nothing when imported.
import { t } from '../core/i18n.js';
import { $, call, guard, toast } from '../core/state.js';

export function setupExample({ refresh }) {
  $('example-button').onclick = guard(async () => {
    await call('exampleCommand');
    await refresh();
    toast(t('toast.example_done'));
  });
}
```

- In `app.js`, add `setupExample({ refresh });` next to the other `setup` calls.

## Recommendations
Follow these when you can. When you cannot, say why in the PR.
- Shapes:
  - The yard menu and task panels use `--panel-surface` and `--radius-panel` (8px).
  - Buttons, fields, close and overflow actions use `--radius-control` (5px).
  - Content cards use `--radius-card` (6px).
  - Reserve round shapes for switches, status marks and filter chips.
  - Keep a panel as one surface; divide settings rows with rules instead of nested cards.
- Tabs:
  - Related views use short tab labels with one selected state and a visible keyboard focus ring.
  - Friends, Settings and Window are peer management tabs.
  - Destinations within a tab are actions, clear at rest.
  - Keep tab navigation outside the scrolling body and show only the selected group.
- Colours:
  - A colour that several rules use for the same thing is a token in `base.css`: its light value in `:root`, its dark value in the dark `:root`.
  - A rule that uses such a token needs no dark override.
  - A token that only dark rules need (each light rule has a colour of its own) has only a dark value, and only dark rules read it.

| Role | Use | Shape and state |
|---|---|---|
| Task panel | Friend, Invite, Settings | One `--panel-surface` with `--radius-panel`; divide content with spacing and rules |
| Action | Save, import, menu tools | `--radius-control`; fill only a primary or selected action, hover with `--control-hover` |
| Icon action | Close, overflow, back | `--radius-control`, usually 36px for mouse input; compact actions may use 32px. Coarse pointers get at least a 44px hit area. Leave the resting surface clear |
| Navigation | Menu destinations | Text at rest with a subtle hover surface |
| View tabs | Management groups, album books | Short labels, one selected state, fixed navigation above the selected body; do not wrap tab labels |
| Filter | Pet kind and similar multi-choice filters | `--radius-pill`, selected with `--control-selected` and a visible border |
| Field | Search, selects, text entry | `--field-surface`, `--radius-control`, a visible label and keyboard focus |

## Exceptions
| When | How |
|---|---|
| An external library initializes itself when imported | Explain the reason in the PR description; a maintainer approves it. No library does this today |
| A module that is not an entry point has to listen to a page-wide event | Register it in that module's `setup`, and note it in the call-order comment in `app.js` |

Breaking a rule without recording an exception is a violation, not an exception.

## Rationale
- The page has no build tool; the browser reads the ES modules directly.
- If a module touches the page the moment it is imported, import order becomes initialization order, and a cycle means reading values that are not ready yet.
- When one entry point owns the order and the rest only export functions, each module can be tested on its own.
- Based on: decision “[Page modules run nothing on import and do not import each other in cycles](../decisions/2026-09-30-page-modules-run-nothing-on-import.md)”

## Automated checks
- `tests/modules.test.mjs` catches:
  - import cycles
  - code that runs on import in modules other than entry points
  - a module other than an entry point that cannot be imported without a page
  - mismatched import paths and names
  - a stylesheet the page names that does not exist
- `tests/ui-style.test.mjs` catches:
  - select box appearance, button shape rules, the panel tabs as siblings
  - other cross-engine rules: no sideways overscroll, the system font, the yard filling its window at small sizes
  - a declaration always replaced by a later rule for the same selector (such as a media rule written before the base rule it is meant to change)
  - a custom property a stylesheet reads that no stylesheet defines and no code sets
  - a token with only a dark value read by a rule that is not dark
  - It does not check whether two different selectors compete for one element after rules are reordered; review that when you move rules between files.
- `tests/i18n.test.mjs` catches Korean left in page code and markup, and keys missing from the table.
- Oxlint in `npm run lint:oxlint`:
  - Correctness checks for JavaScript, TypeScript and Vue script blocks; warnings fail the command.
  - `.oxlintrc.json` excludes generated copies and local output.
  - The website build and review cover Vue template correctness.
  - Conditional expressions whose branches both call functions are allowed for the existing canvas drawing code.
  - Keep intentional snapshots of live DOM collections when fixing spread warnings.
- Biome in `npm run lint:js`: formatting, import sorting and its existing static checks.
- Oxlint runs first. Neither tool replaces the repository-specific tests.
- `tests/lint-config.test.mjs`: broken page, tooling, test and Vue script fixtures fail Oxlint, while generated outputs are skipped.

All of these run with `npm test` and `npm run lint`, and CI runs the same commands.

## Change history
- 2026-10-01 First version — moved from "Where code lives" in CONTRIBUTING and organized as rules
- 2026-10-10 Every module but the entry points imports without a page; menus from `core/menu.js`; one owner per class on the yard; menus built from tables; corrected what `ui-style.test.mjs` checks; shortcuts from `core/keys.js`; the yard's and the panel's styles split by area
- 2026-10-12 The mini window's changes to the panel go at the end of the panel's files; shared colours as tokens in `base.css` (a recommendation); `ui-style.test.mjs` checks custom properties
- 2026-10-15 Menu and task-panel components share surface, shape and state roles; close actions no longer have a separate circular style

## Quiet yard controls

### Window and dock
- The landscape fills one freely resizable window, down to 300 × 210.
- In a large window, the dock holds one caption for the current scenery, Play, and Friends & settings.
- Keep the scenery caption to one line.
- Its accessible name and title still describe the Place & atmosphere action.
- Do not repeat a category heading above the current state.

### Small windows and the pointer menu
- At 640 pixels wide or less, or 480 pixels tall or less, hide the dock.
- Right-click empty scenery for four actions: Place & atmosphere, Play, Friends & settings and Always on top.
- Cmd/Ctrl+Shift+P opens management.
- The pointer menu stays inside the window and scrolls when needed.
- It supports the arrow keys, Home, End and checked pinning.
- Friends and objects keep their own context actions.

### Groups
- Show only the group the person requested.
- Play uses the same four-action board at every size.
- Planting and group games open their own subviews.
- Closing a group or pressing Escape returns to the scenery.
- Friends & settings has three short tabs: Friends, Settings and Window.
  - Keep their tab row fixed and scroll only the selected body.
  - Friends offers chat and invitations.
  - Settings links directly to four tasks.
  - Window holds window and desktop controls.
- Do not repeat scenery or play actions in management, expose every group at once, or reveal controls on hover.

### Back, invite and compact panels
- Back from a settings task opened from the menu returns to its Settings tab.
- The settings shortcut and tray open a task list instead, and Back returns there.
- Invite keeps Import in its header and folds away only the search filters.
- Compact task panels offer fullscreen but do not resize the window on their own.
- Changing window size never changes game rules or ends a game.

### Always on top and fullscreen
- Always on top is an independent saved switch in the pointer menu, Window tab, tray and macOS menu bar.
- Cmd/Ctrl+Shift+M toggles it without resizing.
- Fullscreen and Return to previous size are in Window.
- Esc dismisses open surfaces before leaving fullscreen.
- Returning to the previous size restores the normal bounds and pinning.
- Transparent targets along the top and the edges move and resize the window.
- In compact layouts, restore focus to a visible opener or the yard.
- The logo belongs in About.
- The scenery shows the time of day, so the yard needs no clock.

### App updates
- Update progress, retry and explicit install-and-restart stay in the App updates task.
- A small window uses a 32px update icon with an unread dot and a version in its accessible name.
- Coarse pointers keep a 44px hit area.
- Opening it goes directly to App updates.
- Progress and errors do not steal focus or reopen the task.
- Store-managed packages keep their separate update path.
