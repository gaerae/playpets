# Standard: Page code structure

## Applies to
All page code under `src/`. This covers the yard window (`index.html`, `app.js`, `core/`, `yard/`, `panel/`, `styles/`) and the desktop overlay window (`overlay.html`, `overlay/`).

Not covered: test code in `tests/` and development tools in `scripts/`. Both are scripts that run in Node, so page initialization order does not matter to them. Oxlint correctness checks and Biome's code style rules still apply to the whole repository.

## Rules
- A module does not touch the page when it is imported. Button wiring, timers, and creating canvases and observers go inside `setup…()` functions, and only the entry points (`src/app.js`, `src/overlay/overlay.js`) call those functions. Computing pure values at module level (such as a list built from strings) is fine.
- Every module but the two entry points imports without a page: nothing at its top level reads `window`, `document`, `matchMedia` or the bridge, so Node can import it and its logic can be tested. Read those inside functions, where they exist.
- Modules do not import each other in a cycle. When a lower layer (a drawing module such as `yard/views.js`) needs behavior from a higher layer (play, opening a panel), it does not import it; it receives the function as a `setup` argument.
- The `import` paths and names in a new module match the actual file's `export`.
- Sentences shown on the page are not written in code; use keys from the strings table. Follow the [i18n standard](i18n.md).
- Style files are loaded in the order `base.css` → `shell.css` → `scenery.css` → the yard's files → the panel's files → `dialog.css`, and new rules go in the file for their area. `scenery.css` is what stands behind the friends (the sky's and land's colours, which the painter in `src/yard/easel.js` reads, the sun and moon, clouds, weather). The yard's files, in their order: `yard.css` (the frame and the field), `friends.css` (bodies, tags, bubbles, agent dots), `garden.css` (plants, gifts and their effects, digging), `caption.css` (the scene picker, view controls and hint), `tools.css` (the toolbar and the games' menu), `welcome.css` (an empty yard's card), `play.css` (games and fishing) and `compact.css` last (responsive changes at small window sizes). The panel's files: `panel.css` (the panel and what every tab uses), `invite.css`, `friend.css` (the Friend tab's head and menu), `chat.css` (the conversation and the message box) and `settings.css` (the Settings sheet and the AI connection dialog's choices). Responsive changes to the panel go at the end of the panel file that owns the element, after that file's own rules, not in `compact.css`. The order in which media queries apply, and which of two equally specific rules wins, depends on this order.
- Select boxes do not rely on the engine's default look; specify their whole appearance. The same stylesheet has to look the same in WebKit on macOS and Linux and in WebView2 on Windows.
- Loops and animations that redraw the page follow the [performance standard](performance.md).
- A keyboard shortcut is a row in `SHORTCUTS` (`src/core/keys.js`) and the module that owns the action registers it with `onShortcut`; the macOS menu bar (`src-tauri/src/menu.rs`) shows the same key.
- Things that open from a button use `dropdown` (a panel) or `popup` (a menu, with arrow keys) from `src/core/menu.js`, so every menu opens, closes and moves its focus the same way.
- Each class on the yard element has one owner. The scene (`yard/sky.js`) sets only its own classes: `period-…`, `weather-…`, `season-…`, `event-…` and `look-…`. Whoever sets `aiming` (`care.js`), `playing` (`play.js`), `can-catch` (`catch.js`) or `after-rain` (the rainbow in `sky.js`) owns that class and takes it off again; no other module adds, removes or spares it.
- A menu whose rows follow something in code is built from a table, not written in the markup. The Games menu is built from the games' rules (`RULES` in `yard/play.js`: icon, name, tooltip), so a new game adds no markup.

This is how a new page feature looks.

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

In `app.js`, add `setupExample({ refresh });` next to the other `setup` calls.

## Recommendations
Follow these when you can. When you cannot, say why in the PR.
- The yard menu and task panels use `--panel-surface` and `--radius-panel` (8px). Buttons, fields, close and overflow actions use `--radius-control` (5px); content cards use `--radius-card` (6px). Reserve round shapes for switches, status marks and filter chips. Keep a panel as one surface and divide settings rows with rules instead of nested cards.
- Related views use short tab labels with one selected state and a visible keyboard focus ring. Friends, Settings and Window are peer management tabs; destinations within a tab are actions, clear at rest. Keep tab navigation outside the scrolling body and show only the selected group.
- A colour that several rules use for the same thing is a token in `base.css`, with its light value in `:root` and its dark value in the dark `:root`, so a rule that uses it needs no dark override. A token that only dark rules need (each light rule has a colour of its own) has only a dark value, and only dark rules read it.

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
| An external library initializes itself when imported | Explain the reason in the PR description, and a maintainer approves it. No library does this today |
| A module that is not an entry point has to listen to a page-wide event | Register it in that module's `setup`, and note it in the call-order comment in `app.js` |

Breaking a rule without recording an exception is a violation, not an exception.

## Rationale
The page has no build tool; the browser reads the ES modules directly. If a module touches the page the moment it is imported, import order becomes initialization order, and a cycle means reading values that are not ready yet. When one entry point owns the order and the rest only export functions, each module can be tested on its own.
Based on: decision “[Page modules run nothing on import and do not import each other in cycles](../decisions/2026-09-30-page-modules-run-nothing-on-import.md)”

## Automated checks
- `tests/modules.test.mjs` — catches import cycles, code that runs on import in modules other than entry points, a module other than an entry point that cannot be imported without a page, mismatched import paths and names, and a stylesheet the page names that does not exist.
- `tests/ui-style.test.mjs` — catches select box appearance, button shape rules, the panel tabs as siblings, and other cross-engine rules (no sideways overscroll, the system font, the yard filling its window at small sizes), that no declaration is always replaced by a later rule for the same selector (such as a media rule said before the base rule it means to change), that every custom property a stylesheet reads is defined in one or set from code, and that a token with only a dark value is read only by dark rules. It does not check whether two different selectors fight over one element in a new order; review that when moving rules between files.
- `tests/i18n.test.mjs` — catches Korean left in page code and markup, and keys missing from the table.
- Oxlint in `npm run lint:oxlint` — correctness checks for JavaScript, TypeScript and Vue script blocks, with warnings failing the command. `.oxlintrc.json` excludes generated copies and local output. Vue template correctness remains a website build and review concern. Conditional expressions whose branches both call functions are allowed for the existing canvas drawing code. Keep intentional snapshots of live DOM collections when fixing spread warnings.
- Biome in `npm run lint:js` — formatting, import sorting and its existing static checks. Oxlint runs first; neither tool replaces the repository-specific tests.
- `tests/lint-config.test.mjs` — broken page, tooling, test and Vue script fixtures fail Oxlint while generated outputs are skipped.

All of these run with `npm test` and `npm run lint`, and CI runs the same commands.

## Change history
- 2026-10-01 First version — moved from "Where code lives" in CONTRIBUTING and organized as rules
- 2026-10-10 Every module but the entry points imports without a page; menus from `core/menu.js`; one owner per class on the yard; menus built from tables; corrected what `ui-style.test.mjs` checks; shortcuts from `core/keys.js`; the yard's and the panel's styles split by area
- 2026-10-12 The mini window's changes to the panel go at the end of the panel's files; shared colours as tokens in `base.css` (a recommendation); `ui-style.test.mjs` checks custom properties
- 2026-10-15 Menu and task-panel components share surface, shape and state roles; close actions no longer have a separate circular style

## Quiet yard controls

The landscape fills one freely resizable window, down to 300 × 210. The large-window dock has one current-scenery caption, Play and Friends & settings. Keep the scenery caption to one line; its accessible name and title still describe the place and atmosphere action. Do not repeat a category heading above the current state.

At 640 pixels wide or less, or 480 pixels tall or less, hide the dock. Right-click empty scenery for four actions: Place & atmosphere, Play, Friends & settings and Always on top. Cmd/Ctrl+Shift+P opens management. The pointer menu stays inside the window, scrolls when needed and supports arrows, Home, End and checked pinning. Friends and objects retain their own context actions.

Show only the group the person requested. Play uses the same four-action board at every size; planting and group games open their own subviews. Closing or Escape returns to the scenery. Friends & settings has three short tabs: Friends, Settings and Window. Keep their tab row fixed and scroll only the selected body. Friends offers chat and invitations; Settings links directly to four tasks; Window holds window and desktop controls. Do not repeat scenery or play actions in management, expose every group at once, or reveal controls on hover.

Back from a menu settings task returns to its Settings tab. The settings shortcut and tray open a task list instead, and Back returns there. Invite keeps Import in its header and folds only search filters. Compact task panels offer fullscreen without automatically resizing. Changing window size never changes game rules or ends a game.

Always on top is an independent saved switch in the pointer menu, Window tab, tray and macOS menu bar. Cmd/Ctrl+Shift+M toggles it without resizing. Fullscreen and Return to previous size are in Window; Esc dismisses open surfaces before leaving fullscreen. Returning restores normal bounds and pinning. Transparent top and edge targets move and resize the window. Restore focus to a visible opener or the yard in compact layouts. The logo belongs in About; environmental time needs no clock.

Update progress, retry and explicit install-and-restart stay in the App updates task. A small window uses a 32px update icon with an unread dot and a version in its accessible name; coarse pointers retain a 44px hit area. Opening it goes directly to App updates. Progress and errors do not steal focus or reopen the task. Store-managed packages retain their separate update path.
