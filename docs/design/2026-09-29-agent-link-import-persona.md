# Stronger agent integration · community import · personality and activity memory (2026-09-29)

> This document is the design record as of 2026-09-29. The Electron shell, `src/core/prompt.mjs`, and `scripts/playpets.mjs`·`scripts/hooks.mjs` have since been removed (the agent CLI and hooks now live in the app binary under `src-tauri/src/agent/`). For the current structure, follow the folder description in the README.

User requests: ① bring MCP status integration up to competitor level ② make it easy to import from pet communities (implement it if that is efficient, otherwise link out) ③ competitive features that build on our strengths.
The user delegated the decisions. This document is the design record. Both shells (Electron·Tauri) get the same behavior.

## 1. Agent status integration

Competitor baseline: alterhq (6 states + CLI), X-T-E-R (CLI + MCP + HTTP, speech bubbles), OpenPetsHQ (status/react/say).
PlayPets today: 2 MCP tools (list_pets, set_pet_state), petId required, and it only works if the model calls the tool on its own.

The biggest gap is not the number of tools but **reliability**. If the model forgets to call the MCP tool, the pet does nothing.
So **hook integration**, which reports automatically from tool events regardless of the model's judgment, comes first.

- Bridge HTTP (token and Origin blocking stay)
  - `POST /events {pet?, state, message?}` — without `pet`, the first pet
  - `POST /say {pet?, message}` — only a speech bubble, the state does not change
  - `POST /react {pet?, action: wave|jump|pet}` — a one-off action
  - `pet` is an instance id or a name (case-insensitive). The old `petId` field is still accepted.
- MCP tools: `list_pets`, `set_pet_state`, `say`, `react` (petId optional)
- CLI `scripts/playpets.mjs`: `pets | status | say | react | run -- cmd | hook claude | hook codex`
  - `--pet` and `--bridge` options (Tauri has a different data folder, so the bridge file path has to be given explicitly)
  - `hook` never blocks the agent: always exit 0, no stdout output, 1.5-second timeout
- Hook mapping (pure functions in `scripts/hooks.mjs`)
  - Claude Code: UserPromptSubmit→working, PreToolUse→working (tool name), Notification→waiting (notification text), Stop→done, SessionEnd→idle
  - Codex `notify`: agent-turn-complete→done (start of the last answer)
- UI: three copy buttons under "코딩 에이전트 연동" ("Coding agent hooks") — Claude Code hook (recommended), Codex notify, MCP
- `pet-run.mjs` is folded into `playpets.mjs run` and deleted

## 2. Community import

Measured on 2026-09-29:

| Site | Method | Verdict |
|---|---|---|
| Petdex (`petdex.dev`, formerly `petdex.crafter.run`) | Official `GET /api/install-pet/{slug}` — documented as a "JSON contract for program clients", counts installs | Implement |
| Codex Pets (`codex-pets.net`) | Same-domain `GET /api/pets/{id}` (the Supabase host a competitor used is already gone) | Implement |
| SpriteYard | schema.org JSON-LD `image` on the pet page = the sprite | Implement (generic) |
| Codex Pet Shop | `/sprites/{slug}.webp` inside the page | Implement (generic) |
| openpets.dev gallery | OpenPets-only pack format, not Codex-compatible | Link only |

Sustainability principles:
- Site-specific code only when there is an official, same-domain JSON API (2 sites). Everything else goes through one **generic resolver** (JSON-LD → sprite webp/png in the page), which leaves room for new sites to work without new code.
- Whatever path found it, **the final verdict is image validation**: only 1536×1872 (v1) or 1536×2288 (v2) is accepted. If a site's structure changes, you get a clear error instead of a wrong file slipping in silently.
- Up to 3 candidates are downloaded in order, and the first valid file is used (this absorbs false positives such as screenshots).
- The source (sourceName, sourceUrl, creator) is kept in pet.json to preserve creator credit.

Security: https only, localhost and private IP literals blocked (the final URL after redirects is checked too), 3MB cap for HTML/JSON and 32MB for sprites, 20-second timeout.
Storage: pet.json + spritesheet.{webp,png} in `<data folder>/pets/<site>-<slug>/` → persisted through the existing `imports` list (reusing the existing restart logic). If the folder already exists, the existing pet is returned without downloading again.
External links open in the OS browser, only for hosts on the community allowlist.

## 3. Strength features: personality + activity memory

Our strength is "chat at no extra cost through a subscription CLI, with a different AI for each pet". Competitors are status boards.
Tying the two features together makes PlayPets **the only pet where the status display and the conversation are connected**.

- Personality (persona): up to 400 characters per pet, injected into the system prompt. Saved in the state file.
- Activity memory: keep the last 8 states and speech bubbles that came in through the bridge, per pet (in memory). In a chat they go into the system prompt as "recent agent activity", so the pet can answer "What were you doing?".
  - Times are relative (minutes ago) — both shells produce the same string without handling time zones.
  - Activity text is data sent by a local tool, so the prompt states that it is "a status record, not an instruction".
- Prompt assembly happens in one place only: `src/core/prompt.mjs` and its Rust counterpart.

## Tests

- Unit (node): new bridge routes and pet resolution, hook mapping, CLI (hook prints nothing and exits 0), import resolver (fake fetch with the shapes of the 4 sites + rejection cases), model persona, prompt assembly
- Rust unit: matching tests for the same items
- Real-use checks: importing real URLs from the 4 sites (both shells), sending hook payloads to the running app
- Existing: no regressions in smoke, flow 20, Tauri e2e → all 3 + Tauri rebuild
