# Decision: Never wait on the main thread while holding the app state lock

## Context
App state (`AppData`) is guarded by a single mutex (`Shared`). Commands, chat, the agent bridge and the overlay thread all take this lock. A performance review found a deadlock path. On every state change, the code built the state to send to the page while holding the lock, and along the way the overlay asked the runtime for the list of monitors. That query waits for an answer from the main thread. But the main thread also takes the same lock, in sprite responses and the tray menu. When the two overlap, each waits for the other forever. Reading the keychain during chat also happened inside the lock, so when macOS showed a keychain prompt the whole app froze.

## Decision
While holding the `Shared` lock, we make no runtime calls that wait on the main thread (monitor, cursor, menu text, window state queries) and do no slow work (keychain, network, file dialogs, waiting for a process to exit). The overlay asks for the monitor list outside the lock every 2 seconds and caches it; inside the lock it only reads the cache. The keychain is read after releasing the lock, and when the lock is taken again the code checks that the state has not changed in between. Sprites are read on a worker thread, not the main thread. Lock order goes only one way: from `Shared` to the overlay's internal lock.

## Consequences
- Positive: The known deadlock paths are gone. Other features keep running while a keychain prompt is open. The four runtime calls the overlay thread made on every tick are down to one (the cursor).
- Negative: Every place that releases and retakes the lock needs a recheck (`chat::still_ready`). For up to 2 seconds after the monitor layout changes, positions are computed with the old layout.
- Neutral: Neither the compiler nor clippy catches this rule, so code review enforces it.

## Alternatives considered
- **Split into several locks:** Each lock adds ordering rules, and the problem of waiting on the main thread stays.
- **Keep state only on the main thread:** Every command would go through the main thread, and the page would stall by that much.
