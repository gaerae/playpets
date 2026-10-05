# Decision: Page modules run nothing on import and do not import each other in cycles

## Context
The page (`src/`) is ES modules that the browser reads as they are, with no build tool. Several modules wired up buttons, set timers, and created the weather canvas and resize observers the moment they were imported. So import order became behavior order, and there were 36 import cycles. With a cycle, one module can read a value from another module that is not ready yet, and you cannot tell from the code which order things initialize in.

## Decision
We make page modules run nothing on import. Each module exports the work it does on the page as a `setup…()` function, and only the entry points (`src/app.js`, and `src/overlay/overlay.js` for the overlay) call those functions, in the order written there. There are no cycles between modules. When a lower layer (for example `yard/views.js`) needs behavior from a layer above, it does not import it; it receives it as a function in `setup`. `tests/modules.test.mjs` checks both rules, and with no cycles Biome can sort the imports.

## Consequences
- Positive: Initialization order is written in one place, `app.js`. A module can be imported and tested on its own (the Node tests import pure modules as they are). Import sorting is left to the tool.
- Negative: Passing upper-layer behavior down to a lower layer adds `setup` arguments (`setupViews({ gameTap, select, openChat, resized })`). A new contributor who does not know this rule first learns it from a test failure.
- Neutral: Module-level constants (such as lists built from strings) are computed on import, but those computations do not touch the page, so they are within the rule.

## Alternatives considered
- **Bring in a bundler and let it decide the order:** Adds a build step, and the cycles themselves remain.
- **Only agree on the order in a document:** There is no way to check it, so it breaks on the first contribution.
