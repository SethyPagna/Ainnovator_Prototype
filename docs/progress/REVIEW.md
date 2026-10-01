# Cargo Twin integration review

## Resume here

- Date: 2026-10-01 (Asia/Hong_Kong).
- Request (paraphrased): Thoroughly redesign Cargo Twin as a complete, creative 3D application.
- Review scope: save/load/reload, undo/redo, stale-plan and export correctness, worker races, validated imports, keyboard/dialog and scene integration.
- Status: **REVIEW COMPLETE — R1–R11 resolved for the reviewed and exercised paths**. No browser interaction, builds, tests or installs run by this review lane; runtime evidence below is explicitly coordinator-reported.
- Owned file: this review record. Implementation changes remain owned by the coordinator and workflow/scene lanes.
- Current step: R1–R11 are corrected in source. Coordinator reports the final 191-test suite, strict TypeScript/production build and fresh production normalized-draft/same-sample/report regression all passed.
- Next step: coordinator records the overall delivery and goal disposition. No unresolved concrete finding remains in this review scope.

## Task table

| Task | Status | Evidence |
|---|---|---|
| Read current progress log and Git state | Done | REDESIGN.md and git status --short read on 2026-10-01 |
| Review controller history, persistence and races | Done (source only) | useStudio.ts inspected; worker request guards traced; history/persistence defects recorded |
| Review dialogs, editors and scene callers | Done (source only) | StudioApp/Panels/Editors/Dialog, StudioScene, sceneWorld and main inspected |
| Review export freshness and practical completion boundaries | Done (source only) | Current reports validation and stale export gates inspected |
| Report reproducible defects and limitations | Done | R1–R11 corrected in source; primary, targeted and final production journeys PASS reported; independent execution not performed by this lane |

## Evidence and checkpoints

### 2026-10-01 — review started

- Read `docs/progress/REDESIGN.md`, `cargo-twin/src/studio/useStudio.ts` and `StudioApp.tsx`.
- `git status --short` confirmed integrated studio changes plus untracked helper modules, tests and docs. No source files were modified by this review lane.
- Earlier independent inspection identified report unit-index mismatch; workflow lane reported correction. Correction awaits current-source inspection.
- Harness references explicitly loaded earlier: project META-HARNESS pointer, GET-STARTED, core workflow, build mode, harness-route skill and team-execution workflow. Harness status confirmed project binding and active shared build run. Coordinator owns shared checkpoints.

## Findings

All findings below are source-derived with reproduction steps; browser reproduction is **NOT RUN** by this lane.

| ID | Severity | Finding | Evidence / reproduction | Status |
|---|---|---|---|---|
| R1 | P1 | Undo changes project contents without restoring saved-project identity; Save can overwrite another project | Original `useStudio.ts:41`, `122–128`, `153`, `174`. Save A, open B, Undo, Save. | Source-reviewed corrected; journey PASS reported |
| R2 | P1 | Damaged or unsupported autosave is silently overwritten by the sample | Original `useStudio.ts:23–25`, `86–93`. Seed damaged/unsupported autosave and reload. | Source-reviewed corrected; corrupt-byte journey PASS reported |
| R3 | P1 | Blank project name can crash report rendering | Original `useStudio.ts:16`, `79`, `201`. Finish a plan, clear project name, open Load sheet. | Source-reviewed corrected; journey PASS reported |
| R4 | P2 | Choosing a comparison strategy bypasses Undo and retains a stale Redo branch | Original `useStudio.ts:130–133`. Compare → Use Balanced; or Edit → Undo → apply alternative. | Source-reviewed corrected; journey PASS reported |
| R5 | P2 | Advertised Save shortcut invokes browser Save Page while editing | Original `useStudio.ts:104–105`. Focus editable field, press Ctrl+S. | Source-reviewed corrected; journey PASS reported |
| R6 | P2 | Header action buttons lose accessible names on mobile | StudioApp header with spans hidden at 820 px; SVGs aria-hidden. | Source-reviewed corrected; scene/mobile PASS reported |
| R7 | P2 | Independently visible detail metrics omit stale-plan context | Original `StudioPanels.tsx:26–31`. Edit inputs and scroll to Load insights/Placement list. | Source-reviewed corrected; journey PASS reported |
| R8 | P2 | An older async import can overwrite later edits or project transitions | Original `useStudio.ts:182–188`. Delay file.text(), then edit/open another project/start another import. | Source-reviewed guarded; delayed-read/newer-edit PASS reported |
| R9 | P2 | Restored saved-project drafts create duplicates after reload | Original `useStudio.ts:41`, `50`, `89`, `174`. Save A, reload, Save. | Source-reviewed corrected; journey PASS reported |
| R10 | P2 | Errors raised inside native modal render outside the active modal | Original `StudioApp.tsx:45`, `StudioDialog.tsx:7`. Blank project name → Export files → Project JSON. | Source-reviewed corrected; modal/dismissal/blocked-print PASS reported |
| R11 | P1 | Semantically unchanged normalized/sample documents can remain dirty after successful packing | Original `useStudio.ts:16` JSON-stringifies property order, while `documentHistory.ts:46–49` preserves existing present for order-independent equality. `projects.ts:105–113` constructs cargo keys differently from `presets.ts:item`. Restore normalized City delivery, load the identical sample, pack: history retains normalized doc but builtFrom uses sample order. | Source-reviewed corrected; fresh production normalized-draft/same-sample/report PASS reported |

## Confirmed source safeguards

- Worker results, errors and timeout callbacks compare request IDs; edits and history travel terminate workers and advance the ID. No concrete worker-result race found in this source pass.
- UI blocks calculated exports when cargo, space or strategy differ from the built fingerprint. JSON/manifest exports validate inputs and catch failures.
- Current report code uses 1-based piece indices and checks represented handling flags, normalized top-load limits, upright height and per-item counts. Earlier index and represented-field issues are corrected in source; coordinator reports valid report preview and exports passed.
- SVG map preserves actual geometry, explicitly labels front/rear/left/right, supports keyboard selection and does not require WebGL. 3D selection and sequence visibility both use the same placement order.
- Final re-review: documentHistory snapshots carry project IDs; load explicitly detaches new/imported docs, Undo/Redo restore IDs, comparison strategy changes use commitHistory and clear future. No-op packing commits preserve history.
- Draft sessions persist document and saved ID together, verify IDs against the library on reload, and detach stale bindings. Autosave recovery errors pause only the autosave effect, leaving ordinary planning/editing available; deliberate reset preserves original raw data first.
- Report HTML is now generated and caught in openReport, outside React render. Ctrl+S is intercepted before the editable target guard; mobile header names are explicit; details show stale banners; async imports check both request IDs and document revision.
- R10 re-review: native StudioDialog renders notices/status and dismissal inside its modal subtree. All five ProjectDialogs branches pass feedback; outer toast is suppressed while a modal is open.
- R11 re-review: planningFingerprint explicitly covers every current SpaceConfig and CargoItem field plus strategy in a fixed order, while preserving cargo-array order and excluding the report title. It handles non-finite editor numbers distinctly without validation/coercion during render. Both dirty detection and applyPlan use this helper.

## Completion boundaries

- The source review and coordinator-reported browser journeys support the complete local planning studio scope. Coordinator reports 12 test files / 191 tests passed, strict TypeScript and the 84-module production build passed, and final production browser verification passed. This record does not itself declare the overall goal complete.
- Coordinator reports browser Save/Open/Undo/Redo/reload, duplicate prevention, corrupt-byte recovery, stale-export prevention, valid JSON/CSV roundtrip, report preview, mobile actions/dialog Escape, keyboard map selection, transport switches/replay, blocked-worker recovery and WebGL/context fallback passed. Their scripts and assertions were independently inspected here; this lane did not execute them.
- Coordinator additionally reports delayed-file import protection, in-modal validation/dismissal, blocked-print guidance, immediate-reload recovery, 400/400 small cargo pieces, aircraft sample pipeline and return-to-studio persistence passed. Final production verification also exercised restored normalized draft → identical City delivery sample → Plan ready, an actual report popup with 40/40 content, and a stubbed print invocation. Actual OS print/PDF dialog output remains unverified.
- Existing worker-result ID guards are source-reviewed and a delayed-file/newer-edit race passed according to coordinator evidence; no exhaustive race claim is made.
- Mass splits are geometric uniform-density estimates. Support order is not a collision-free loading path. Actual axle limits, vehicle/fuel mass, restraints, impact/vibration and operational certification remain unmodelled and are disclosed by the UI/report.
- Changes remain local and uncommitted. This review makes no claim about a GitHub update, deployment, user-installed artifact or operational transport safety.

### 2026-10-01 — first concrete findings

- Read integrated dialogs, editors, overview/details, current reports and scene source/callers.
- Sent R1–R4 independently to the coordinator with concrete reproduction steps.
- No tests, builds, browser actions or source modifications run by this lane.

### 2026-10-01 — source review completed

- Added R5–R9 and completion boundaries after inspecting keyboard guards, mobile button labeling, details panels and async import/reload paths.
- Current report source confirms earlier unit-index and represented handling/count validation corrections.
- Source review is complete; coordinator fixes and execution evidence are pending. This document remains IN PROGRESS until follow-up source inspection or coordinator evidence identifies the disposition of the findings.

### 2026-10-01 — final source re-review

- Re-read this record, REDESIGN.md and Git status before follow-up review.
- Inspected current useStudio, documentHistory, projects, report/dialog/panel callers and map integration. Nine original findings are corrected in source; execution disposition remains separate.
- Reported R10, the remaining native-modal error-feedback gap, with concrete steps and current path/line evidence.
- Coordinator progress log reports a first strict build and 173 tests passed; later persistence/history/scene changes and browser journeys were still in progress at this checkpoint. Those are coordinator-reported checks, not executions by this lane.
- No app-source writes or heavy jobs performed.

### 2026-10-01 — modal correction and browser evidence received

- Re-read this file immediately before updating it, plus current StudioDialog, ProjectDialogs feedback callers and StudioApp toast gate. R10 is corrected in source; no additional concrete source defect found.
- Coordinator message and latest REDESIGN checkpoint report both `cargo-twin/scripts/qa/studio-journey.js` and `studio-scene.js` PASS with zero page errors. Inspected both scripts' concrete assertions; reflected covered runtime dispositions above as coordinator-reported evidence.
- Targeted modal/import/navigation checks and final sequential suite/build are still in progress with the coordinator.

### 2026-10-01 — targeted runtime evidence and review closure

- Read this record immediately before editing and inspected `cargo-twin/scripts/qa/studio-regressions.js` assertions.
- Coordinator reports that script PASS with zero page errors: immediate reload retained the latest draft; export validation/dismissal and blocked-print guidance appeared inside active modals; delayed File.text followed by a newer project-name edit preserved the new state; 400/400 small cartons packed and the canvas remained visible; map hid controls that affect only 3D; aircraft sample completed and studio return restored its draft.
- R8 and R10 runtime-pending dispositions are resolved for the exercised reproduction paths. All R1–R10 are corrected in source, with relevant coordinator-reported browser regressions passed.
- Independent review is complete with no unresolved concrete source finding. Final suite/build/production release checks remain coordinator-owned. No app-source edits or heavy jobs performed by this lane.

### 2026-10-01 — production freshness investigation

- Coordinator reopened review after production packing produced 40/40 City delivery placements but left the UI dirty without input errors. The production build followed 187 passing unit tests.
- Re-read REDESIGN.md, current Git state, useStudio, documentHistory, projects cargo parsing, presets and model. Identified the concrete inconsistent equality semantics in R11.
- Lightweight JavaScript reproduction of the exact preset/parser Tool cases field orders yielded `sameValues: true` and `sameJsonFingerprint: false`. This confirms the source-level property-order defect; it is not a browser execution of the app by this lane.
- Sent correction guidance: canonical explicit planning fields or order-independent snapshot comparison. Fingerprinting must not invoke parseDocument because editor history supports temporary invalid inputs.
- No app source modified and no heavy jobs run.

### 2026-10-01 — R11 source correction reviewed

- Re-read this record immediately before editing. Inspected planningFingerprint.ts, current model.ts, useStudio imports and both freshness call sites, and all four studio-fingerprint.test.ts cases.
- The canonical tuples resolve the normalized/preset property-order mismatch and include all current planning/model fields. Tests cover the exact history no-op transition, project-title versus cargo/space label semantics, handling/geometry/color/item-order/strategy changes, and distinct non-finite editor values.
- R11 is corrected in source. These tests were not executed by this lane; the coordinator is rerunning the suite/build sequentially and owns the fresh production same-sample/report verification.
- No app source modified and no heavy jobs run.

### 2026-10-01 — final production regression evidence and review closure

- Re-read this record immediately before editing and inspected `cargo-twin/scripts/qa/studio-production.js` assertions. Coordinator reports PASS after the final production rebuild.
- Script waits for autosave, reloads the normalized draft, loads the identical City delivery sample and waits for Plan ready. It opens the current load sheet and an actual report popup, verifies 40/40 report content and observes a stubbed print invocation. R11's exercised production reproduction is resolved.
- Coordinator also reports all five viewport widths (1440, 1024, 768, 390, 320) fit, mobile inspection tools use a horizontal row, and zero page errors or failed asset requests. Final sequential checks passed: 12 files / 191 tests, strict TypeScript and 84-module production build.
- All R1–R11 are source-reviewed corrected with relevant coordinator-reported runtime evidence. No unresolved concrete review finding remains. No app-source edits, browser interaction or heavy jobs performed by this lane.
