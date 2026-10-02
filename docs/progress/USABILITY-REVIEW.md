# Cargo Twin usability review

## Resume here

- Date: 2026-10-01 (Asia/Hong_Kong).
- Request (paraphrased for this public repository): Make the application's design and common workflows easy to understand and use without prior training.
- Status: **REVIEW COMPLETE — U1–U15 resolved in source and exercised runtime paths**.
- Ownership: this review lane owns only this file. The coordinator owns integrated UI/controller changes; other lanes have separate write scopes. Existing uncommitted work is preserved. No commits or pushes authorized.
- Baseline: local v4.0.0 redesign previously passed 191 tests and production journeys according to REDESIGN.md. Those functional checks do not establish first-time-user intuitiveness.
- Current step: U1–U15 are addressed in source. Coordinator reports final production usability/CSV/history/report/assets/mobile journeys passed, strict 89-module build passed, and the final 12-file / 191-test suite passed after all source edits (15.14 seconds).
- Next step: coordinator records final local delivery and goal disposition. No unresolved concrete review finding remains. Preview is available on localhost:8811; isolated QA browser and development server are stopped according to coordinator evidence.

## Scope and evidence

- Source inspected: StudioApp, StudioWorkspace, StudioTabs, useStudio, StudioPanels, StudioEditors, StudioDialog, StudioScene, PlanMap, and current studio/editor/panel/usability CSS including final overrides and responsive rules.
- Read REDESIGN.md Resume here and latest checkpoint, then `git status --short`. Shared dirty/untracked application modules, QA scripts and progress records were present; no app source was modified here.
- Explicitly loaded project META-HARNESS.md and harness GET-STARTED.md, workflows/core.md, modes/build.md and workflows/team-execution.md for this pass. Previously loaded harness-route skill remains applicable. The status command was invoked; this pass returned no displayed status output, so it is not new binding evidence. Coordinator owns shared run/checkpoints.
- Method: independent source walkthrough of first use, create/edit/build/review, mobile order, selection/edit, keyboard navigation, import/save/delete/export and unavailable-3D fallback. No browser interaction, tests, builds or installs were run by this lane.
- Color ratios below are lightweight arithmetic from the final source foreground/background values, not pixel sampling or an exhaustive accessibility audit.

## Task table

| Task | Status | Evidence |
|---|---|---|
| Read resume/Git/harness context | Done | Current records and specified reference bodies loaded |
| Audit first-use/mobile/keyboard workflow | Done (source only) | Initial U1–U11 findings below, sent to coordinator |
| Re-review revised integrated UI | Done (source only) | Integrated workspace/tabs/editors/panels/wrapper/CSS inspected; concrete findings corrected |
| Record coordinator runtime evidence | Done | Development and final production usability/preserved workflow journeys PASS reported; scripts/assertions independently inspected |

## Findings

Severity indicates practical impact, not a claim that every user will encounter the issue. All paths are under `cargo-twin/src/studio/`; line numbers identify the initial reviewed source and can move during redesign.

The following table records the baseline findings. Current dispositions are in the subsequent re-review table.

| ID | Priority | Concrete finding and evidence | Acceptance path | Baseline status |
|---|---|---|---|---|
| U1 | High | On widths ≤680px, studio.css:206 explicitly orders `.ct-visual` before `.ct-inputs`. Pack cargo is at the end of the visual section (StudioApp:35), above all editable inputs. Editing on mobile requires scrolling past the scene, then back upward to build; errors appear later in PlanOverview. | At 390/320px, start a blank load, choose space, add/edit cargo and build with obvious next actions and no search for a distant build button. | Open |
| U2 | High | First load auto-packs an existing City delivery sample (useStudio:23–25,89) but StudioApp:18 uses a slogan and vague subtitle without stating that the sample is editable or showing the sequence. The sample button loses visible text and New loses visible text on mobile (studio.css:206). The default active input is Cargo rather than the first setup step. | A first-time user can tell what the app does, recognize the editable sample, choose a blank plan or sample, and see Choose space → Add cargo → Review plan. | Open |
| U3 | High | Five scene settings are icon-only with hover titles (StudioApp:25). Touch users cannot discover shell/labels/explode/weight centre/reset from those symbols. Targets are 28×29px (studio.css:121); view and color controls are also small. | Settings have visible plain-language labels or a clearly labeled inspection panel, current states and comfortable tap targets on mobile. | Open |
| U4 | High | Selecting a placement only sets selection/sequence (useStudio:183). Details live in a scene popover (StudioApp:30), distant from the placement table, with no Edit cargo action. A table user receives no nearby detail or navigation; a scene user must manually find the matching manifest card. | Selecting from scene/map/list visibly reveals the correct details. An explicit Edit this cargo action opens and focuses the corresponding source editor without losing the draft. | Open |
| U5 | High | Numeric:10–11 maps an empty field immediately to0. Users clearing length/quantity/weight cannot keep a blank field while typing. Domain errors only appear after a build request, in a separate results panel; the input is not marked or connected to the error. | Clear a required number, type a replacement, and see understandable inline guidance for incomplete/out-of-range input. Build failure brings the user to visible issues and a repair action. | Open |
| U6 | High | Project library deletion is an icon that changes trash→check on first click (StudioPanels:41); useStudio:191–193 retains the armed ID until another deletion/library-open operation. Only hover title/aria-label explain the next click. No visible confirmation question or Cancel action exists. | Delete presents the project name and explicit Delete/Cancel choices; cancellation/Escape leaves the library item intact and resets confirmation. | Open |
| U7 | Medium | Input/detail controls declare tab/tablist (StudioApp:21, StudioPanels:28) without Arrow/Home/End handling, roving tabindex or associated tabpanel IDs. They do not behave as their announced widget suggests to keyboard users. | Both tab groups support Arrow keys and Home/End, active tab is the tab stop, panels are associated/labeled, and ordinary Tab enters the selected panel. | Open |
| U8 | High | Every transport mode button applies the first preset, including clicking the currently active mode (StudioEditors:55; useStudio:182). A user who edited road dimensions and taps Road again silently resets dimensions/payload/clearance. Switching between modes also replaces all numeric constraints without an explanation. | Active mode click is a no-op; template application is explicit and clearly says which fields it replaces. Undo remains available and its effect is understandable. | Open |
| U9 | Medium | Readability/tap size remains weak: base12px, many9–11px labels, icons29px, desktop fields32px/mobile36px, narrow header buttons28px. Final palette arithmetic gives inactive strategy2.49:1, advice3.11:1 and secondary metric3.85:1. These are actionable text, not merely decoration. | Main labels, guidance, metrics and errors are legible with stronger contrast; common controls have comfortable targets. Verify narrow layouts and keyboard focus visually in a browser. | Open |
| U10 | Medium | Autosave and Save project refer to different persistence scopes without explaining their relationship at the point of use. `.ct-autosave` is hidden at≤1100px. Import CSV is an unlabeled visible icon (accessible label exists) with no nearby schema/template instruction. Several field terms are unclear to new users: Description means cargo name; Per piece means weight; Top-load limit and Reserved rear need concrete explanations (StudioEditors:29,38–42,61). | Distinguish automatic local draft recovery from named library saves in visible copy. CSV import has a visible label and practical file preparation guidance. Field names communicate their quantity/meaning and units directly. | Open |
| U11 | High | CargoEditor keeps query locally and filters every card by name (StudioEditors:26–27,31). addItem/duplicateItem sets expandedId for a new name (useStudio:170–178) but cannot clear the query. Search Tool → Add cargo creates Cargo N invisibly. A future direct-edit action can fail the same way. | Add/duplicate/edit-selected always reveals the target editor even while a search filter is active, then scrolls/focuses it. Clearing search remains available. | Open |

## Revised source dispositions

| IDs | Source disposition | Execution disposition |
|---|---|---|
| U1/U2/U3 | Integrated StudioWorkspace has plain primary/sample/blank-load copy, three steps, setup next actions, labeled Display settings/Reset view, selected details and loading controls. Active input starts at Space. Final CSS makes mobile inputs first and preserves visible labels. | Source-corrected; first-use/settings/mobile order/five widths PASS reported |
| U4 | Inline PieceDetails includes Edit this cargo type. Table inspection reveals/focuses details on every click. Map retains selection focus; explicit View selected cargo details navigates when desired. Direct edit explicitly reveals/focuses the expanded Description on every action, including unchanged expanded ID. | Source-corrected; repeated table/direct edit and mobile Map focus PASS reported |
| U5 | Numeric keeps blank as NaN, stable error/help IDs, aria-invalid and inline guidance. Totals avoid misleading incomplete values; invalid top-load storage remains repairable under clear-top rules. Guided build/update expands the first invalid cargo, reveals and focuses an invalid field. | Source-corrected; blank space/quantity and collapsed invalid repair PASS reported |
| U6 | Named explicit Delete saved project/Cancel confirmation replaces icon arming. Existing controller deletion and saved-ID detach semantics preserved. | Source-corrected; save/delete/cancel/open-draft preservation and dialog Escape PASS reported |
| U7 | Shared StudioTabs uses roving tabindex, ArrowLeft/Right and Home/End with panel IDs; input/detail panel associations exist. | Source-corrected; Arrow/Home/End keyboard journey PASS reported |
| U8 | Active transport-mode click is a no-op. Template explanatory copy and remaining usable dimensions added. Different-mode changes still apply an example template, with Undo preserved. | Source-corrected; customized active-mode preservation and five transport modes PASS reported |
| U9 | Integrated editor/panel/workspace CSS increases text contrast, visible labels and common targets; mobile field fonts are 16px and modal icon targets are 44×44px. Final CSS was source-inspected. | Source-corrected; five widths, labeled 44px mobile project controls and coordinator downscaled visual review reported |
| U10 | Working draft/named project/portable backup distinctions are explicit in workspace and library. CSV import has visible text; compact help specifies required/optional columns, units/defaults and a downloadable example. Fields have concrete help; Description/Per piece labels retained with context. | Source-corrected; library explanation, CSV example download/import/8-of-8 and saved/report/export/recovery journeys PASS reported |
| U11 | Expanded cargo bypasses search. Expansion-only effect reveals/focuses Description without rerunning on every typed update. | Source-corrected; filtered expanded/duplicate and repeated direct edit PASS reported |

## Concrete follow-up findings

| ID | Priority | Evidence and reproduction | Required outcome | Status |
|---|---|---|---|---|
| U12 | High | Original StudioWorkspace selectedId effect called reveal with default focus=true when offscreen. Map's ArrowRight handler selected/focused its SVG control, but parent effect stole focus. Same selected ID also prevented later table navigation. | Preserve Map keyboard focus/selection loop. Table inspection explicitly reveals/focuses details on every click, including repeated same-ID clicks. | Source-corrected; mobile repeated Map arrows/table clicks PASS reported |
| U13 | High | Original failed-build path selected Cargo without expanding an invalid row; collapsed cards had no invalid field node. Export/overview Update plan bypassed guided repair/navigation. | Expand/reveal the first invalid cargo and focus its invalid field. All main build/update actions should have coherent repair feedback, including within export modal. | Source-corrected; collapsed repair/export-to-update PASS reported |
| U14 | Medium | Original mobile-next rendered Save solely for step=review even after still-visible input edits made the plan dirty. | Dirty review offers Update/Build plan; saving remains available as a secondary project action. | Source-corrected; dirty mobile Update action PASS reported |
| U15 | High | Coordinator's stronger production CSV test fills cargo search with previous-load-only before importing the example. Imported rows are hidden by retained local query. Initial session-reset patch covered loadDocument/travelHistory but omitted the CSV success branch; ordinary edits intentionally preserve the session/query. | Clear cargo and placement searches at successful manifest/document/history replacement boundaries; keep ordinary edits/add/duplicate behavior and current project binding unchanged. Invalid/stale imports must not reset the current editor. | Source-reviewed corrected; final CSV/scenario/Undo production regression PASS reported |

## Existing useful safeguards to preserve

- Draft/history/source correctness fixes R1–R11 remain relevant; simplify the UX without bypassing validation, current-plan export gates or saved-ID history.
- PlanMap already provides keyboard selection, explicit front/rear/side labels, geometry and fallback independence from WebGL. Its footer describes upper pieces covering lower pieces.
- Native dialog supports Escape, focus containment and in-modal notices. Keep all operation feedback inside the active modal.
- New/sample/import transitions remain reversible through Undo; damaged stored bytes are preserved before recovery reset. Explain reversibility at the action, rather than relying on users to discover it.
- Packing metrics disclose static rectangular/support limits. Plain-language UI should retain meaningful limitations and avoid implying operational certification.

## Checkpoints

### 2026-10-01 — initial usability source audit

- Read the current recovery point/Git state and explicitly loaded the requested harness references. No app writes or heavy jobs performed.
- Sent prioritized findings as they emerged so implementation could progress independently: mobile input/build order, first-use guidance, visible inspection labels, direct edit/navigation, numeric/error behavior, delete confirmation, tab keyboard handling, mode reset, readability/targets and filtered-out new editors.
- Calculated source color ratios with lightweight JavaScript for four text/background pairs. No screenshots, browser or general usability testing performed here.
- Initial audit is complete. Overall usability task remains IN PROGRESS until source re-review and coordinator browser evidence cover the revised paths.

### 2026-10-01 — first revised-source re-review

- Re-read REDESIGN.md Resume/latest checkpoint, USABILITY.md and Git state. Inspected new StudioWorkspace/StudioTabs, current controller/history, complete editor/panel code and their scoped CSS. Wrapper/CSS integration had not been completed at this checkpoint.
- Confirmed source improvements and corrected U6/U7/U11 plus the active-mode part of U8. No new persistence/history/worker stale-result defect was found in this pass.
- Sent U12–U14 immediately with concrete map/table focus, collapsed-invalid repair and stale mobile-action paths. These remain source hypotheses pending correction and coordinator runtime checks.
- Read this record immediately before updating it. No application source edits, browser actions or heavy jobs performed.

### 2026-10-01 — final integrated source re-review

- Re-read current USABILITY.md/Git state and inspected actual integrated StudioApp wrapper, StudioWorkspace, StudioTabs, controller/editor/panel callers and all final CSS layers. U1–U14 are addressed in source. No concrete persistence/history/current-plan regression remains from this review.
- Confirmed panel-specific inspection and guided-build adapters are passed to overview/details/dialogs. Map/3D use the unchanged focus-preserving selection callback; explicit detail navigation is available. Invalid builds reveal an expanded invalid cargo or space field, export updates close the modal before repair, and dirty mobile review offers Update/Build.
- Identified a same-expanded-ID direct-edit focus omission and narrow modal icon targets during this pass. Coordinator corrected both; re-read exact action code and 44×44px icon rule before recording resolution.
- Shared tabs have associations, roving focus and Arrow/Home/End; comparison destination is now focusable. Editor search bypass, NaN/history preservation, active-mode guard and named delete/cancel remain coherent with integration.
- All new execution checks remain coordinator-owned and pending at this source checkpoint. No application writes, tests/builds/installs or browser interaction performed by this lane. No claim of universal intuitiveness or exhaustive accessibility validation.

### 2026-10-01 — CSV helper and development execution evidence

- Re-read this record and latest USABILITY.md before updating. Inspected final CSV helper/example in StudioEditors, its scoped CSS, and reports.ts parser requirements/defaults. Required/optional headers, cm/kg-per-piece units, accepted handling flags, priority/default top-load behavior and reversible replace semantics match the current parser. The two example rows request eight pieces with valid colors and handling flags.
- Independently inspected `studio-usability.js` and `studio-csv-example.js` assertions. Coordinator reports both PASS with zero page errors, covering first-use/blank workflow, invalid-number focus/repair, active-mode preservation, filtered duplicate, repeated inspection/direct edit, keyboard tabs/mobile Map, display settings, named saves/delete/cancel, dirty mobile update/export gates, five widths, and example download/import with 8/8 packed and fragile/upright retained.
- Coordinator reports updated `studio-journey.js`, `studio-scene.js` and `studio-regressions.js` PASS with zero page errors: saved-ID/history/report/export/recovery, all transports/WebGL and blocked-worker fallback, immediate reload/modal feedback/delayed import, 400/400 pieces and retained aircraft workflow. A QA-only storage-init script was corrected to avoid injecting localStorage access into sandboxed report frames before the clean journey rerun; report sandbox remained intact.
- Coordinator reports sequential 191-test suite and final strict TypeScript/89-module build passed. Fresh production checks remain in progress at this checkpoint. This lane performed source/script inspection only; no browser interaction or heavy job was executed here.
- No unresolved concrete source finding remains. A real first-time human usability session and exhaustive accessibility assessment were not performed; observed assertions support the exercised workflows without claiming universal intuitiveness.

### 2026-10-01 — U15 production carry-over investigation

- Coordinator reports production usability PASS. A strengthened `studio-csv-example.js` deliberately applies previous-load-only before import and fails the new empty-search assertion, despite the example packing correctly. Previous CSV PASS used no pre-existing filter and remains limited to that exercised input.
- Re-read the current controller session reset, keyed CargoEditor integration, preserved history/persistence/import revision guards and updated QA assertion. Key remounts reset local query at loadDocument/history transitions; ordinary edit/add/duplicate paths preserve it as intended. The session state is UI-only and does not affect planning fingerprints, document snapshots or saved project IDs.
- Identified that CSV replacement still uses editDocument and omits both session increment and placement-query reset. Sent precise line207 evidence to the coordinator before their final rerun. Successful CSV must keep the existing named-project binding; failed/stale parse paths should preserve current query.
- Review is reopened only for U15. No application source or heavy jobs were performed by this lane; correction/source recheck and production execution remain pending.

### 2026-10-01 — U15 source correction re-reviewed

- Re-read this record immediately before editing, plus exact current CSV branch and strengthened CSV QA assertions. Successful CSV parse/revision guards run before editDocument/session reset; invalid, outdated or superseded reads leave current editor state untouched.
- CSV success now increments editorSession and clears placement listQuery after the content edit, then clears expansion and requests the new plan. It retains the current saved-project ID and Undo history through editDocument. loadDocument/history transitions also reset the session/query; ordinary edit/Add/Duplicate do not.
- The keyed CargoEditor remount clears its local query at these boundaries. UI-only session state is excluded from document/history/fingerprint data. No concrete regression found in this exact patch.
- U15 is source-corrected. Current strengthened QA checks search reset on CSV import, scenario load and Undo restoration with imported rows visible, then Redo/rebuild. Coordinator owns the pending sequential suite/build and production run; no application source edits or heavy jobs performed here.

### 2026-10-01 — final production acceptance and review closure

- Re-read this record immediately before editing, inspected latest USABILITY.md evidence and current `studio-production.js` assertions. Coordinator reports all final production checks PASS after U15: strengthened CSV/search/scenario/Undo with 8/8 pieces, full first-use/invalid/filter/direct-edit/tab/Map/delete/stale/mobile usability workflow, and saved-project/history/export/report/recovery journey. Zero page errors reported.
- Production smoke independently inspects its assertion scope: normalized autosave reload → identical sample → current report in an actual popup with 40/40 content and a stubbed print invocation; all five widths (1440/1024/768/390/320) fit with CSV guidance expanded, and mobile display settings fit. Coordinator reports zero page errors or failed requests.
- Coordinator reports final strict TypeScript/89-module production build passed after U15 and final sequential 12-file / 191-test suite passed after all source edits (15.14 seconds). Coordinator inspected downscaled desktop/mobile setup/mobile 3D screenshots and accepted their readability/composition. QA browser/development server are stopped; preview on port 8811 remains available.
- All U1–U15 are source-reviewed resolved with relevant coordinator-reported execution acceptance. This lane performed independent source/script review and maintained this record; it did not run browsers, tests, builds or installs and did not edit app source.
- Acceptance supports the exercised local workflows. A first-time human usability session, exhaustive accessibility assessment, physical-device transport validation and actual OS-generated PDF output were not performed. The print function in QA was stubbed; no universal intuitiveness or operational-safety claim is made. Changes remain local/uncommitted, with no GitHub push or deployment claim.
