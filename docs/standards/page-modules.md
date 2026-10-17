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
- Style files are loaded in the order `base.css` → `shell.css` → `scenery.css` → the yard's files → the panel's files → `dialog.css`, and new rules go in the file for their area. `scenery.css` is what stands behind the friends (the sky's and land's colours, which the painter in `src/yard/easel.js` reads, the sun and moon, clouds, weather). The yard's files, in their order: `yard.css` (the frame and the field), `friends.css` (bodies, tags, bubbles, agent dots), `garden.css` (plants, gifts and their effects, found seeds), `caption.css` (the scene picker, view controls and hint), `tools.css` (the toolbar and the games' menu), `welcome.css` (an empty yard's card), `play.css` (games and fishing) and `compact.css` last (responsive changes at small window sizes). The panel's files: `panel.css` (the panel and what every tab uses), `invite.css`, `friend.css` (the Friend tab's head and menu), `chat.css` (the conversation and the message box) and `settings.css` (the Settings sheet and the AI connection dialog's choices). Responsive changes to the panel go at the end of the panel file that owns the element, after that file's own rules, not in `compact.css`. The order in which media queries apply, and which of two equally specific rules wins, depends on this order.
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
- The yard menu and task panels use `--panel-surface` and `--radius-panel`. Buttons, fields, close and overflow actions use `--radius-control`; filter chips alone use `--radius-pill`. Keep a panel as one surface and separate settings rows with rules instead of nested cards.
- Settings and album tabs are related view choices: group them on `--segment-track`, show one `--segment-active` choice and keep a visible keyboard focus ring. Use short nouns in Settings tabs while their section headings keep the full names. Menu destinations are actions, not persistent tabs; leave them clear at rest.
- A colour that several rules use for the same thing is a token in `base.css`, with its light value in `:root` and its dark value in the dark `:root`, so a rule that uses it needs no dark override. A token that only dark rules need (each light rule has a colour of its own) has only a dark value, and only dark rules read it.

| Role | Use | Shape and state |
|---|---|---|
| Task panel | Friend, Invite, Settings | One `--panel-surface` with `--radius-panel`; divide content with spacing and rules |
| Action | Save, import, menu tools | `--radius-control`; fill only a primary or selected action, hover with `--control-hover` |
| Icon action | Close, overflow, back | The same `--radius-control` and a 44px target; leave its resting surface clear |
| Navigation | Menu destinations | Text at rest with a subtle hover surface |
| View tabs | Settings groups, album books | One compact track, equal active shape, horizontal scrolling when labels need room |
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

The landscape fills one freely resizable window, down to 300 × 210. Place & atmosphere and Menu sit together at the bottom right in larger windows. At 640 pixels wide or less, or 480 pixels tall or less, the dock is hidden; right-click empty scenery or use Cmd/Ctrl+Shift+P to open Menu. Scene choices open directly; Friend, Invite, Settings, display and sound switches, and play tools belong to Menu. Scene choices, Menu and task panels open one at a time. Menu separates its four destinations from window switches and optional play/display tools. Each destination has Back to menu and Close; compact task panels also offer fullscreen without automatically resizing the window. Places and Atmosphere are separate scene tabs with one body scroller. Compact Settings uses a section chooser synchronized with the wide navigation; Invite folds search and import until needed. Responsive layouts fit the same functions into narrow or short windows, with scrolling where needed. Changing the window size never enters another mode or ends a game. Always on top is a separate saved switch in the shared yard and right-click menu, tray and macOS menu bar; Cmd/Ctrl+Shift+M toggles it without resizing. Fullscreen is an optional action in the shared yard and right-click menu; the same action returns to the previous size while fullscreen. Esc dismisses open menus and dialogs before leaving fullscreen. Returning restores the previous window bounds and Always on top setting. A transparent top-edge target moves the window, and edges and corners resize it. Keep controls reachable by keyboard, and restore focus when closing a panel. The logo belongs in About, and automatic environmental time does not need a visible clock.
