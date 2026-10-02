# Cargo and load-space editor usability

## Resume here

- Date: 2026-10-01 (Asia/Hong_Kong).
- Scope: `cargo-twin/src/studio/StudioEditors.tsx` and its owned `editors.css`; parent owns navigation, controller and global CSS.
- State: implementation written; browser and build checks **NOT RUN** by this lane.
- Next: coordinator verifies the new native CSV format disclosure and actual sample download/import, then runs the required checks sequentially with the Node cap. The preceding editor journey passed according to the coordinator.
- Existing component props/callbacks are unchanged. `Numeric` adds optional internal validation/help options and keeps accessible labels such as `Quantity` and `Width cm`.
- `cargoHasInputErrors(item)` is exported for the coordinator to reveal the first invalid cargo row; it checks editable name/numeric fields without executing packing.

## Request and decisions

- Request (paraphrased): Make cargo and load-space editing intuitive, readable and accessible without changing packing behavior or preventing incomplete edits.
- Defaults: labeled CSV import; explicit Edit/Close card actions; visible per-piece, handling, priority and usable-space explanations; local style scope only; no confirmation flows.
- Empty numeric input passes `valueAsNumber` (`NaN`) and stays blank. History/fingerprint already retain incomplete editor values; parser/worker/autosave retain their validation boundaries.
- Totals and usable-space metrics guard incomplete numbers and show placeholders. No underlying cargo values are adjusted.

## Tasks and evidence

| Task | Status | Evidence |
|---|---|---|
| Read resume logs, Git state, harness and TypeScript instructions | Done | Existing progress/review records, pointer/core/build/team and skill read |
| Preserve component/callback and custom-space behavior | Written, untested | CargoEditor/SpaceEditor call the same callbacks; transport choices retain the preset lookup and active mode is now a no-op |
| Add contextual guidance and clear cargo actions | Written, untested | Owned TSX and scoped CSS |
| Add accessible inline numeric validation | Written, untested | Finite/min/max/integer checks; stable useId help/error descriptions; no edit blocking |
| Keep expanded editor visible through search/Add/Duplicate | Written, untested | Expanded row bypasses search filtering; expandedId-only focus effect checks existing focus before acting |
| Add in-app CSV schema/example and sample download | Written, untested | Native details, six required headers, optional handling/defaults and dependency-free CSV data URL |
| Verify mobile/keyboard behavior and compile | To do | Coordinator execution only; no heavy delegate jobs |

## Checkpoint history

### 2026-10-01 — implementation checkpoint

- Read existing source immediately before replacing the owned editor file.
- Styles use `.ct-editor` so global navigation/scene controls are unaffected. Input/action targets are at least 44 px high; labels/help are at least 12 px, with 16 px mobile input text.
- Cargo summaries retain name-prefixed accessible labels for existing QA. Units and numeric labels retain their earlier accessible names.
- Expanded editors use ordinary page scrolling rather than a clipped nested cargo list; search remains available for long manifests.
- Active transport clicks preserve edited dimensions; moving to a different mode still calls the existing preset callback. No mode/id mutation was added.
- Geometry-excluding clearance/reserve errors mark their own inputs with `aria-invalid`, so Build-error focus can reveal the relevant correction.
- An invalid saved top-load allowance remains repairable even if the current handling rules keep the top clear; this edits the saved value without changing those handling rules or disabling mid-typing.
- Required verification remains unrun. No build, suite, install, dependency, controller or global stylesheet changes by this lane.

### 2026-10-01 — CSV discoverability checkpoint

- Coordinator reports the preceding usability journey passed; this lane did not run it.
- Added a native “CSV format & example” disclosure beside the import/search area. Required headers match the parser; per-piece cm/kg and quantity meanings are explicit.
- Optional handling columns and their defaults explain the zero omitted top-load allowance.
- “Download sample CSV” uses a plain UTF-8 data URL anchor. The sample contains two cargo types, eight pieces and explicit handling rules; no dependency/controller changes.
- Actual sample download/reimport remains pending coordinator browser verification. This lane ran no tests, builds or installs.
