# Cargo Twin usability refinement

This historical usability record is preserved for traceability. See the [v4 reviewed candidate](../releases/V4-CANDIDATE.md) for the later publication verification and current limits.

## Historical checkpoint — 2026-10-01

- Date: 2026-10-01 (Asia/Hong_Kong).
- User request (paraphrased): Make ease of use and the entire design intuitive.
- Baseline v4 implementation: complete locally; 191 tests, strict build and browser journeys passed. Existing uncommitted source, assets, tests and historical prototype preserved. Read REDESIGN.md and current Git status first.
- This phase is **complete locally**. Harness run `local verification record`, project cargo-twin, area studio; build/core/team workflow actually read by root and delegates.
- Owners: root StudioApp/StudioWorkspace/useStudio/StudioTabs/usability.css and integration; editor lane StudioEditors/editors.css; panels lane StudioPanels/panels.css; independent auditor USABILITY-REVIEW.md. No shared source writers.
- Next: user reviews the completed usability refinement at http://localhost:8811/. No implementation/check work remains in this scope. If preview is stopped, run npm.cmd run preview from the nested cargo-twin app directory. Dev server and isolated QA browser are stopped. Changes remain uncommitted and unpushed.
- No commit/push/deployment authorized. One heavy job at a time with Node cap; agents must not run heavy jobs. Inspect downscaled screenshots only.

## Decisions and acceptance

- Keep the 3D identity and engine, local project storage and aircraft workspace. Improve comprehension and interaction instead of introducing accounts/services.
- Show visible labels, meaningful readable metrics, larger interaction targets and plain language. Hide advanced inspection and weight detail until requested.
- Space and cargo setup precede the scene on mobile; a persistent next-step action guides the user. Step navigation remains nonblocking.
- Invalid inputs remain editable, with inline descriptions; do not silently alter cargo values. Preserve stale-plan/export and recovery safeguards.
- Keyboard tabs follow arrow/Home/End/roving focus; input and result panels remain correctly labeled.
- A real first-time human usability session is unavailable; browser journeys and independent review will verify concrete interactions, not claim universal intuitiveness.

| Task | Status | Evidence |
|---|---|---|
| Inspect baseline and independent UX findings | Done | U1–U11 recorded in USABILITY-REVIEW.md |
| Clear workflow and navigation | Done | Production usability journey |
| Editor validation and discoverability | Done | Invalid focus, filtered edits, CSV download/import and search reset verified |
| Results/library/export progressive disclosure | Done | Production library, delete/cancel, report, exports and stale gates |
| Responsive/readable design and labeled scene controls | Done | Five widths, keyboard controls, labeled44pxmobile actions; downscaled visual review |
| Browser journeys / preserved workflow checks | Done | Usability, CSV, library/export/report/recovery and production passed; dev scene and400piece/aircraft passed |
| Strict build / proportionate unit suite | Done | Final strict89modulebuild and12files/191tests passed |

## Checkpoints

### 2026-10-01 — refinement started

- Read prior Resume block/latest checkpoints, Git state, project pointer, GET-STARTED/core/build/team and TypeScript skill. Current bound project/harness complete run verified; new scoped run started.
- Independent audit found mobile workflow order, ambiguous sample/New/settings, distant selection feedback, empty number coercion, unclear delete confirmation, tab keyboard gaps, active-mode reset, tiny low-contrast text and filtered-out newly edited cargo.
- Editor and panels owners received exact paths and unchanged callback contracts. Root adds a shared accessible tab control and exposes existing delete cancellation setter; other controller APIs stay intact.

### 2026-10-01 — usability implementation integrated, verification pending

- Wrote explicit three-step workspace with setup-first mobile order, persistent next action, visible project/save guidance, labeled scene settings, normal-flow piece details and direct editing. Shared tabs have keyboard navigation and panel associations.
- Editor and panel lanes source reviewed their own files. Empty numeric input now stays blank with inline errors; active mode preserves customization; expanded edits stay visible under search; project deletion has visible confirm/cancel; fit results and stale status lead.
- Independent re-review found Map focus theft, repeated table-selection navigation, invalid collapsed-row reveal, and stale mobile Save CTA. Root addressed these with panel-specific inspection callbacks, shared guided build/update, expanded invalid row focus and dirty-aware next action.
- Files are written but **untested**. Next: root serial tests/build, focused first-time/mobile/keyboard workflow and existing regression journeys. No commit or push.

### 2026-10-01 — first integration checks

- Serial `npm.cmd test -- --maxWorkers=1`: 12 files / 191 tests passed. `npm.cmd run build`: strict TypeScript and Vite build passed, 89 modules. Later root focus and modal target tweaks require final rebuild.
- `studio-usability.js`: passed the first-time/blank/invalid/filtered duplicate/build/repeated inspection/direct editing/settings/library deletion/mobile Map keyboard/stale export and five-width journey, zero page errors. Downscaled desktop/mobile screenshots visually inspected.
- Independent source review U1–U14 resolved; no unresolved concrete source issue. Runtime checks remain root-owned.
- Existing project/export journey completed interactions but its injected storage init script ran in sandboxed report frames and caused two harness SecurityErrors. Restricted QA init to the main frame and restart the isolated QA browser; app report sandbox remains intact. Re-run journey for clean evidence.


### 2026-10-01 — complete dev verification / before final build

- Fresh main-frame-guarded `studio-journey.js`: PASS. Saved project IDs/history, Ctrl+S, report validation/preview, four exports, JSON/CSV reimport, stale gates/rebuild and damaged draft preservation all passed with zero page errors.
- `studio-scene.js`: PASS. Views, labeled settings, legends, replay, Map keyboard, forced WebGL loss/fallback, five transports, invalid space, deliberately blocked worker/recovery, five widths and mobile dialogs passed; zero page errors.
- `studio-regressions.js`: PASS. Immediate reload, modal errors/blocked print, delayed-import guard, 400/400 pieces (4696 ms including UI/screenshot), aircraft sample pipeline and studio return passed; zero page errors.
- CSV helper added with plain format/units/handling instructions and a downloadable example. `studio-csv-example.js`: PASS, download/import packs 8/8 and retains fragile/upright flags, then restores City delivery.
- Root owns heavy jobs and ran them serially. Dev server and isolated QA browser stopped. No further app-source edits planned; final strict build and production browser checks remain.

### 2026-10-01 — production search carry-over correction

- Final strict build passed (89 modules); production usability journey passed with zero page errors.
- Added a focused assertion to CSV example/import QA: a search from the previous load must clear on import. It failed against the first production build, exposing local editor search carry-over (the imported plan still packed correctly but its editable rows were hidden).
- Controller now increments a UI editor-session key and clears placement search on load/history restore. Root keys CargoEditor to it, resetting its local search only at those document boundaries; normal edits/Add/Duplicate preserve search. Next: source review, serial suite/build after this controller change, then production CSV/import/search, usability, report/assets/layout checks.
- Independent U15 review caught the CSV branch uses editDocument, so the explicit CSV-success branch now resets editorSession/listQuery too, after parse and delayed-import guards. Existing suite remains191passing; UI-state correction is verified by the added import/scenario/history browser assertions, with strict build next.

### 2026-10-01 — final production checks passed

- Strict89module build passed after U15, with no further app-source changes.
- Production `studio-csv-example.js`: PASS including old search clearing on CSV replacement, scenario change and Undo;8/8sample preserves handling. Production `studio-usability.js`: PASS all first-time/invalid/filter/direct-edit/tab/Map/delete/stale/five-width journeys; zero page errors.
- Production `studio-journey.js`: PASS saved identities/history, reports, four exports, JSON/CSV, stale gates, recovery; zero page errors.
- Production `studio-production.js`: PASS normalized draft reload, same sample, printable window and actual print invocation, five widths with CSV guidance expanded, mobile labeled toolbar and settings; zero page errors or failed asset requests. Screenshots include desktop, mobile setup and mobile3Dreview, downscaled before viewing.
- Isolated QA browser closed. Final unit confirmation and screenshot review next; preview server on8811 remains available. No commit/push/deployment.


### 2026-10-01 — usability refinement completed locally

- Final confirmation after all source changes: `npm.cmd test -- --maxWorkers=1` passed12files/191tests in15.14s; strict TypeScript/Vite build passed89modules. No source changes after those validated builds.
- Independent source review U1–U15 resolved. Root accepted downscaled production desktop, mobile setup and mobile3Dreview screenshots: readable labels, coherent hierarchy and input-first mobile navigation; no obstructed required controls observed.
- Scope delivered: clear three-step journey, larger labeled controls, inline blank-number repair, accessible tabs, precise repeated inspection/edit focus, fit-first results with optional detail, clear draft/library/backup choices, explicit delete/cancel, CSV example and document-boundary search resets. Earlier planning, scene, recovery and aircraft features retained.
- Complete local goal; no commit/push/public deployment. Live preview8811 remains, dev5301 and isolated browser stopped. No original assets/history deleted. README and recoverable progress logs updated.
- Limits: interaction checks and independent source/visual review support this scope; no real first-time-human study was performed. LocalStorage/browser-origin storage and prototype planning limits remain accurately explained in the app/docs.
