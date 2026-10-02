# Cargo Twin redesign progress

This historical implementation record is preserved for traceability. See the [v4 reviewed candidate](../releases/V4-CANDIDATE.md) for the later publication verification and current limits.

## Historical checkpoint — 2026-10-01

- Date: 2026-10-01 (Asia/Hong_Kong).
- Goal: thoroughly redesign and complete Cargo Twin as a creative 3D application.
- Checkout: `repository root`, cloned from `SethyPagna/cargo-twin`, branch `main`. Initial Git status was clean. No project tracker or session log existed.
- App directory: `cargo-twin/`. Current app uses React 19, TypeScript, Vite, three.js, workers and tested packing engines.
- Baseline v4.0.0 is complete locally: 191 tests, strict build and browser journeys passed. **The follow-up usability refinement is complete locally**; see `USABILITY.md` for current final evidence and resume state. R1–R11 prior review findings remain resolved.
- Harness: project `cargo-twin`, area `studio`, run `local verification record`; root and all delegates actually read pointer/core/build/team references. Completion checkpoint records this delivery.
- Preview: `http://localhost:8811/` served by `npm.cmd run preview`. If stopped, run that command from the app directory. Dev server and isolated QA browser are stopped after verification.
- Next action: finish the intuitive space/cargo/review flow and usability checks recorded in USABILITY.md. GitHub and public deployment have not been updated.
- Uncommitted files: modified configuration/README plus StudioApp/StudioScene/studio.css, shared shadow configuration and aircraft version label; new studio controller/editors/dialog/map/analytics/persistence/history/fingerprint/report/scene modules, five test files, four QA callbacks, META-HARNESS binding and progress/review docs. Exact paths are in the final Git status snapshot below. Generated `dist/`, `output/` and `.playwright-cli/` are ignored and preserved locally.
- No commits or pushes authorized explicitly for this project; preserve changes on disk and in this log.

## Request and decisions

- Request (paraphrased for public repository): Redesign Cargo Twin thoroughly as a complete, creative 3D application; use full creative discretion and track it as a goal. **Done locally**.
- Chosen direction: an immersive load-planning studio with editable transports/cargo, meaningful 3D inspection, comparative packing, saved projects and loading/report exports. Retain the separate aircraft workflow and historical prototype.
- Continue using local computation and local persistence; no paid assets, services or external account setup required.
- One heavy job at a time. Agents must not run builds, installs or suites. Downscale screenshots before inspection.

## Tasks

| Task | Status | Evidence |
|---|---|---|
| Find GitHub repository and preserve source | Done | GitHub/CLI verified repository; fresh clone; clean initial status |
| Read architecture and establish redesign scope | Done | Studio, worker, model, presets, tests, configuration inspected |
| Redesign 3D transport scene | Done | All five modes, tools, replay, 400-piece and fallback browser checks passed |
| Complete editing, persistence and report workflows | Done | Project/export/recovery/import-race/reload journeys and final unit regressions passed |
| Redesign responsive studio UI | Done | Desktop/tablet/mobile to 320px passed; independent downscaled visual review |
| Verify packing, persistence and UI behavior | Done | 191 tests, strict build, browser journeys and production report/assets/mobile check passed |
| Document final behavior and limitations | Done | v4 README and independent review record updated |

## Checkpoint history

### 2026-10-01 — discovery

- `gh repo list`, `gh repo view`, `gh pr list`, repository tree and README inspected. No open PRs.
- No Cargo Twin-specific memory registry entries found. Local bounded lookup found no active Cargo Twin checkout; cloned into the configured Projects folder.
- `git status --short`: clean. GitHub goal created and active in this chat.
- Historical prototype and original attribution will be preserved.

### 2026-10-01 — implementation split

- Scene API retains existing selection/replay/CG behavior; adds shell, labels, color modes, exploded view and camera reset.
- Workflow API provides validated JSON/CSV, named projects, autosave, legacy migration and escaped reports.
- Analytics API provides geometric mass split, floor/height usage and plan advice without invented safety scores; SVG plan map provides accessible fallback.
- Root is integrating a responsive studio with undo/redo, scenario gallery, cargo/space editors and project/report dialogs.
- `npm.cmd ci --no-audit --no-fund` started with 4096 MiB Node cap. Agents instructed not to execute heavy jobs.

### 2026-10-01 — integrated source checkpoint

- `npm.cmd ci --no-audit --no-fund`: passed (57 packages).
- Initial `npm.cmd test -- --maxWorkers=1`: 8 files / 101 tests passed. Later report/project tests were still being authored and require a new full run.
- Scene, persistence/report and analytics delegates completed source and confirmed actual meta-harness loading. New root UI now integrates all APIs. No heavy agent jobs ran.
- Report unit indexing corrected to the engine's one-based numbering after independent audit.
- Undo/redo, scenario gallery, named project library, autosave, CSV/JSON exchanges, fresh-plan report gate, SVG map, camera/tools and replay are authored; browser validation pending.
- Next: readability refinement, strict build, full unit suite, browser QA and independent integration review.

### 2026-10-01 — first verification and review fixes

- First `npm.cmd run build`: strict TypeScript and production Vite build passed (82 modules).
- Full suite at that checkpoint: 10 files / 173 tests passed. Draft-session/history regressions added afterward and await final suite.
- Independent review in `docs/progress/REVIEW.md` found nine issues. Fixed project ID history, duplicate-save identity after reload, corrupt-autosave preservation, report-render validation, comparison history, focused-field Ctrl+S, mobile button labels, stale detail banners and import revision races.
- Browser screenshot inspected at 1100 × 764 only. Transport/cargo composition is rendered successfully. Scene label contrast refined after visual review.
- Dev-only React HMR warning occurred during hook dependency-array edits; fresh-load runtime errors will be checked independently. Removed obsolete three.js shadow-map setting in new and legacy renderer.
- Browser smoke uses isolated Playwright session `cargotwin` at `http://localhost:5301`; scripts under `cargo-twin/scripts/qa/`, evidence under `cargo-twin/output/playwright/`.

### 2026-10-01 — browser acceptance checkpoint

- `studio-journey.js`: PASS. Named saves, focused-field Ctrl+S, cross-project Undo/Save, reload identity, blank-name report handling, comparison Undo/Redo, report preview, four exports, JSON/CSV reimports, stale export gate, repack and corrupt-draft preservation/recovery. Zero page errors.
- `studio-scene.js`: PASS. Camera/tools, weight/handling legends, progressive replay, keyboard map selection, WebGL-loss fallback, road/sea/air/rail/custom scenes, invalid dimensions, blocked worker recovery, widths 1440/1024/768/390/320, mobile actions/dialogs and Escape. Zero page errors.
- Runtime checks corrected recovery guard placement (autosave effect only) and two pixels of 320px overflow. Scene screenshots saved locally and downscaled for review.
- Independent source re-review confirms R1–R9 corrected. New R10: modal notices were outside the native modal accessibility tree. Added visible in-dialog status/dismissal; targeted browser verification next.
- Added draft flush on page exit to preserve immediate edits before workspace navigation/reload; validation and damaged-data pause remain enforced.
- Package and lockfile version set to 4.0.0. Historical prototype preserved. QA output/browser cache now ignored; reusable QA scripts retained.
- Next: targeted modal/import/quick-reload checks, 400-piece and aircraft smoke, final sequential suite/build, production preview, final documentation and harness checkpoint.

### 2026-10-01 — final regression checkpoint / before final suite

- `studio-regressions.js`: PASS. Immediate reload retains edits; native dialog shows/dismisses validation and blocked-print messages; deliberately delayed file reads cannot overwrite a newer edit; 400/400 cartons pack and render; Map hides 3D-only controls; aircraft guided sample completes and return restores studio draft. Zero page errors.
- 400-piece import/pack/view/screenshot journey took 4,293 ms in this local headless run. This is a measured journey, not an engine-only benchmark or physical-device performance guarantee.
- Independent scene review inspected only downscaled desktop/mobile/sea/rail images. No high-impact issue; mobile tool rail overlapped scene labels. Moved mobile tools to a horizontal second row; final screenshot check follows.
- R1–R10 independently re-reviewed as corrected in source. Targeted runtime evidence now covers delayed import and modal-feedback regressions.
- Before final heavy checks: close the isolated browser and stop development server; run tests with one worker and Node cap, then strict production build sequentially. No delegates run heavy jobs. Changes remain local/uncommitted.

### 2026-10-01 — unit suite complete / before production build

- Final `npm.cmd test -- --maxWorkers=1` with 4096 MiB Node cap: **11 files / 187 tests passed**, duration 15.75 seconds. Includes aircraft domain/physics, studio placement invariants/performance, derived insights, persistence/corruption/schema, CSV/report escaping/freshness and ID-aware history/draft regressions.
- Isolated browser closed and development server stopped before the suite. No overlapping heavy job launched by this team.
- Next: `npm.cmd run build` (strict TypeScript + Vite), then serve production output on port 8811 and verify worker/report/mobile behavior without HMR.

### 2026-10-01 — production freshness correction / before re-verification

- Strict production build passed (83 modules). Production `studio-journey.js` also passed with zero page errors.
- `studio-production.js` exposed a meaningful edge case: normalized restored draft → identical scenario selection kept the editor snapshot as a no-op, but the plan fingerprint used preset property order, so fresh placements remained labeled stale.
- Independent audit confirmed equal fields but unequal raw JSON field ordering. Added `planningFingerprint.ts` with canonical planning-field tuples; no validation during render, so incomplete editor inputs stay editable. Added four regression tests covering normalized sample/no-op history, project versus cargo/space labels, relevant changes and non-finite number distinction.
- Next: close isolated browser; repeat suite and strict build sequentially because source changed; production report/mobile check and same-sample load regression must pass. Preview server on 8811 can remain idle during checks.

### 2026-10-01 — freshness regressions passed / before rebuild

- Repeated complete suite with one worker and Node cap: **12 files / 191 tests passed**, duration 21.13 seconds. New canonical fingerprint tests all pass.
- `git diff --check` passed (line-ending normalization warning only, no whitespace defects).
- Browser remains closed; production preview is idle. Next heavy job is strict build, followed by fresh built-app smoke.

### 2026-10-01 — final delivery

- Final `npm.cmd run build`: strict TypeScript and Vite production build passed, **84 modules**. The complete current suite has **191 passing tests** across 12 files.
- Fresh `studio-production.js`: PASS. Autosave → reload normalized draft → select identical sample remains Plan ready; current report opens in an actual popup and invokes a stubbed print function. Five viewport widths fit, mobile tools use a horizontal row, and final screenshots were captured. **Zero page errors or failed asset requests.**
- Earlier production `studio-journey.js` passed all saved-project, report/export/import and recovery flows. Scene and regression journeys verified transport modes, map keyboard access, WebGL/worker failures, 400-piece rendering and the retained aircraft guided pipeline.
- Final desktop/mobile screenshots inspected only after downscaling to at most 1080×750. Mobile scene controls no longer cover the dimension rail. A sprite label can crop at narrow camera framing; its numeric dimensions remain in the fixed caption and editable inputs. This is cosmetic and does not affect positions or exports.
- Independent review closes R1–R11 as corrected, distinguishing its source inspection from coordinator-run browser evidence. Actual OS-generated PDF output and physical-device/operational transport validation were not performed. Reports and UI disclose static rectangular planning scope.
- No extra application dependencies, paid services, purchased assets, commits, pushes or deployment changes. Original prototype and credits preserved.
- Durable notes: canonicalize planning-input comparison across parsed and preset objects; preserve saved IDs through history and atomic draft writes; pause damaged-draft autosave; display feedback inside native modals; flush valid draft edits on page exit. Keep heavy jobs sequential.

### Final uncommitted Git snapshot

```text
 M .gitignore
 M README.md
 M cargo-twin/index.html
 M cargo-twin/package-lock.json
 M cargo-twin/package.json
 M cargo-twin/src/studio/StudioApp.tsx
 M cargo-twin/src/studio/StudioScene.tsx
 M cargo-twin/src/studio/studio.css
 M cargo-twin/src/three/common.ts
 M cargo-twin/src/ui/TopBar.tsx
?? META-HARNESS.md
?? cargo-twin/scripts/qa/studio-journey.js
?? cargo-twin/scripts/qa/studio-production.js
?? cargo-twin/scripts/qa/studio-regressions.js
?? cargo-twin/scripts/qa/studio-scene.js
?? cargo-twin/src/studio/PlanMap.tsx
?? cargo-twin/src/studio/StudioDialog.tsx
?? cargo-twin/src/studio/StudioEditors.tsx
?? cargo-twin/src/studio/StudioIcons.tsx
?? cargo-twin/src/studio/StudioPanels.tsx
?? cargo-twin/src/studio/documentHistory.ts
?? cargo-twin/src/studio/insights.ts
?? cargo-twin/src/studio/planningFingerprint.ts
?? cargo-twin/src/studio/projects.ts
?? cargo-twin/src/studio/reports.ts
?? cargo-twin/src/studio/sceneTypes.ts
?? cargo-twin/src/studio/sceneWorld.ts
?? cargo-twin/src/studio/useStudio.ts
?? cargo-twin/tests/studio-fingerprint.test.ts
?? cargo-twin/tests/studio-history.test.ts
?? cargo-twin/tests/studio-insights.test.ts
?? cargo-twin/tests/studio-projects.test.ts
?? cargo-twin/tests/studio-reports.test.ts
?? docs/progress/REDESIGN.md
?? docs/progress/REVIEW.md
```


### 2026-10-01 — intuitive workflow follow-up complete

- Current final implementation includes StudioWorkspace/StudioTabs, guided setup/review, editor/panel/usability styles, inline validation and CSV format/example. U1–U15 usability source findings resolved; final191tests, strict89modulebuild and production browser journeys passed. See USABILITY.md for complete evidence/current Resume here.
- All changes remain local/uncommitted/unpushed. Preview8811 remains; dev server and isolated QA browser stopped. Root viewed only downscaled screenshots. Human usability-study validation remains unavailable.
