# In-app creation studio proposal

Status: proposed for review; not implemented. This record separates a future app
feature from the web studio's current prompt, validation and packaging tools.

## Intended experience

A person chooses a reference, asks for a character or background, reviews the
result at yard and mini sizes, then chooses **Add to PlayPets**. Generation alone
never adds an asset. A rejected result leaves their existing friends and places
unchanged. A character reference or one motion row is not a runnable pet.

Keep the web studio available without an account. It prepares prompts and guides,
checks completed files, and exports packages. It neither generates images nor
promises automatic transfer from a third-party image tool. Website editing remains
Vue inside VitePress; the app remains plain ES modules with a Rust backend.

## Options and recommendation

| Option | Advantage | Cost to the person | Decision |
|---|---|---|---|
| Web prompt and file handoff | No model setup or app account | Copy, generate elsewhere, return with files | Keep and explain clearly |
| App-assisted preparation and direct add | Removes ZIP extraction and folder picking | Generation is still external | First implementation stage |
| Connect an existing local image service | Generate and add in one app | Model installation, capable hardware, service setup | Optional second stage |
| Hosted image generation | Works without local image hardware | Credentials, recurring cost, provider availability and policies | Separate opt-in adapter later |

Start with app-assisted preparation, row assembly and a local draft. Do not bundle
model weights, install a generator, add a hosted service, or reuse chat credentials
automatically. A locally configured text model is not proof of image generation,
reference conditioning, transparent output or sprite-sheet support. Select the
first concrete image service only after a small compatibility trial.

## Workflow and screens

1. **Choose a project.** Character or background, new or derived from a permitted
   reference. Show one reference preview and a short description, not all schema
   fields. Preserve identity, clothing and geometry choices in the draft.
2. **Choose how to create.** Default to external creation with copy and TXT export.
   If a compatible image service is connected, offer Generate and show where the
   reference will be sent. Connection configuration lives in one app settings
   section, with a test connection action and an explicit capability result.
3. **Create and inspect.** Keep the reference beside the result. Retry creates a
   candidate rather than overwriting the accepted one. For pets, review the nine
   motion states and sixteen gaze directions; offer a guided eleven-row assembly
   view with missing rows and wrong dimensions identified. Do not present one
   large prompt as a reliable way to produce an animation atlas.
4. **Try in the yard.** Preview without registering: yard/mini crops, identity and
   scale, seasons, time, rain/snow and fishing where the scene supports them.
   Backgrounds keep editable floor, water, stance and window regions. An indoor
   scene can have no water or sky. Automated format checks and visual approval
   are separate gates.
5. **Add.** Review name and file summary, then explicitly add a new friend or place.
   Adding a friend goes through asset registration and the ordinary invite rule.
   Export a portable package as an optional separate action. Failed persistence
   leaves the preview and draft available for retry, and no partial asset in the
   catalog. Existing assets are not overwritten by name collisions.

An optional generator shows Preparing, Queued, Generating, Validating, Ready,
Failed or Cancelled, based on actual service events. An indeterminate activity
indicator replaces percentages when the service cannot report progress. Cancel
keeps accepted candidates and ignores late results. App restarts restore drafts;
non-resumable jobs become interrupted, never silently submit again. No automatic
paid retries or generation merely from editing a field.

## Data and implementation boundaries

Draft metadata has a version, draft ID, kind, reference file IDs, prompt snapshot,
selected adapter ID, geometry for backgrounds, candidate IDs, an accepted candidate
ID, row approvals and timestamps. Files live in an app-owned draft directory;
metadata contains opaque file IDs, not arbitrary paths or remote executable data.
Credentials and model weights are not draft fields. Never put generated drafts or
user references under the repository's tracked `assets/` tree.

A proposed adapter exposes `capabilities`, `submit`, `status` and `cancel`.
Capabilities declare reference-image support, accepted sizes/formats, alpha,
job progress and cancellation. Submission returns a job ID; results are bounded
image bytes plus the actual MIME type and dimensions. UI claims follow verified
capabilities, and errors map to the four app locales. Cancellation may be only
best effort, which the adapter reports. An adapter is not a shell command or a
workflow script supplied by an image or downloaded pet.

Backend commands follow the existing `COMMANDS` registry. Proposed operations are
create/read/save/delete draft, submit/cancel generation, stage result, validate,
and commit candidate. Release every state lock before file decoding, service
requests or child-process waits. Draft storage, job execution and asset catalog
registration are separate owners; keep `app.js` responsible only for wiring.
Job events carry draft/job/candidate IDs so stale callbacks cannot replace the
current selection. Size limits apply to downloads, decoded pixel counts, each
file and total draft storage. Retention and draft removal are visible controls;
never delete originals supplied by the person.

Keep the existing runtime formats: pets export a v2 1536 × 2288 transparent RGBA
PNG atlas and manifest; backgrounds export v1 JSON with validated 1536 × 1024 PNGs
and geometry. Convert supported source images without flattening alpha or silently
stretching them. Reuse `catalog::read_pet`, `register_asset` and existing invite
semantics after validation. Reuse the background validator and background-store
transaction for places; its current storage is IndexedDB, so do not invent a Rust
background catalog. Extract portable image/header and assembly rules to an owner
shared by app and website before implementing them, rather than importing Vue
components or website-only modules into `src/`.

## Connection and privacy boundaries

Default to a documented loopback image service that the person already installed.
Connect only on their explicit action; do not scan ports or start arbitrary
processes. Remote endpoints are a separate explicit choice using HTTPS. No
reference leaves the device without showing the configured destination. Store
optional provider credentials in the existing credential mechanism, never in web
build variables, exports, logs or drafts. Do not expose a local service to the
network or add broad Tauri network/filesystem capabilities to simplify the UI.
Treat prompts, references, metadata and returned files as untrusted data. Limit
redirects and destinations in the adapter instead of bypassing existing pet-import
network protections. A web origin does not gain access to the local app or model.

## Build sequence and acceptance gates

1. Validate the current external handoff and draft formats; build the app's draft
   editor and eleven-row assembler with complete fixture assets. Verify reload,
   failed save, name collision and cancel without touching the normal profile.
2. Add preview and direct commit using existing registration/storage paths. Check
   that the accepted candidate is exactly what is rendered after adding, in the
   yard and mini mode. Verify seasons, weather and fishing for declared scene
   capabilities; do not claim an inventory or successful image decode proves this.
3. Trial one optional image adapter. Check opaque/wrong-sized/malformed outputs,
   connection failure, cancellation, late replies, no-progress jobs and credential
   redaction. Pin a supported service contract before describing setup to users.
4. Consider a hosted adapter only after the local/external workflow is useful.
   Require a separate review of cost confirmation, provider terms and privacy.

Run app unit/lint checks, website build if shared docs change, and real-app E2E
with isolated data. Use a deterministic fake image service for job lifecycle tests;
a real service trial checks compatibility and artwork quality separately. Check
keyboard use, four locales, dark mode, reduced motion, narrow windows and desktop
OS behavior. No provider integration or generation quality is accepted merely by
approving this design.

## Follow-up: portable creation kits

The web studio now distributes a complete request, references, layout configuration
and the portable `playpets-creator` skill. It no longer accepts finished artwork
for browser inspection, conversion or packaging. The Python helper assembles and
validates files in the selected AI workspace; final pet ZIPs and background JSON
go directly to the app. This replaces the earlier web handoff described above.
In-app generation remains an unimplemented proposal; reuse these contracts before
considering a second generation interface.
