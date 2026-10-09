# Standard: Page code structure

## Applies to
All page code under `src/`. This covers the yard window (`index.html`, `app.js`, `core/`, `yard/`, `panel/`, `styles/`) and the desktop overlay window (`overlay.html`, `overlay/`).

Not covered: test code in `tests/` and development tools in `scripts/`. Both are scripts that run in Node, so page initialization order does not matter to them. Biome's code style rules still apply to the whole repository.

## Rules
- A module does not touch the page when it is imported. Button wiring, timers, and creating canvases and observers go inside `setup…()` functions, and only the entry points (`src/app.js`, `src/overlay/overlay.js`) call those functions. Computing pure values at module level (such as a list built from strings) is fine.
- Modules do not import each other in a cycle. When a lower layer (a drawing module such as `yard/views.js`) needs behavior from a higher layer (play, opening a panel), it does not import it; it receives the function as a `setup` argument.
- The `import` paths and names in a new module match the actual file's `export`.
- Sentences shown on the page are not written in code; use keys from the strings table. Follow the [i18n standard](i18n.md).
- Style files are loaded in the order `base.css` → `shell.css` → `scenery.css` → `yard.css` → `panel.css` → `dialog.css`, and new rules go in the file for their area (`scenery.css` is what stands behind the friends: the sky's and land's colours, which the painter in `src/yard/easel.js` reads, the sun and moon, clouds, weather). The order in which media queries apply depends on this order.
- Select boxes do not rely on the engine's default look; specify their whole appearance. The same stylesheet has to look the same in WebKit on macOS and Linux and in WebView2 on Windows.
- Loops and animations that redraw the page follow the [performance standard](performance.md).

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
- Controls on the same line as an input field are 9px rounded rectangles; only floating controls (send, resize, close) are round.

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
- `tests/modules.test.mjs` — catches import cycles, code that runs on import in modules other than entry points, and mismatched import paths and names.
- `tests/ui-style.test.mjs` — catches style file order, select box appearance, button shape rules, and tab container pairs.
- `tests/i18n.test.mjs` — catches Korean left in page code and markup, and keys missing from the table.
- Biome in `npm run lint` — import sorting and code style.

All of these run with `npm test` and `npm run lint`, and CI runs the same commands.

## Change history
- 2026-10-01 First version — moved from "Where code lives" in CONTRIBUTING and organized as rules
