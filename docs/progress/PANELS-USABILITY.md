# Plan panels usability checkpoint

This historical implementation-lane record is preserved for traceability. See the [v4 reviewed candidate](../releases/V4-CANDIDATE.md) for the later integrated verification and current limits.

## Historical checkpoint — 2026-10-01

- Date: 2026-10-01 (Asia/Hong_Kong).
- Coordinator owns StudioApp, useStudio, dialogs and global CSS; this lane owns only StudioPanels.tsx and a new panels.css.
- Goal: make planning results, comparisons, saving and exports understandable without expert terminology.
- Current state: StudioPanels.tsx and panels.css are written, syntax parsed and source-reviewed. They are not typechecked or browser-verified by this lane. Existing uncommitted redesign is preserved.
- Next: root integrates and runs type/build/browser verification, including small-screen dialogs, delete/cancel and shared tab keyboard behavior.
- No commits, installs, heavy checks or publishing are authorized for this lane.

## Request and decisions

- Request (paraphrased): make the application fully intuitive, including results and project/file workflows. **In progress**.
- Lead with how many pieces fit; retain exact weight and volume information underneath.
- Keep mass balance/CG and placement technical columns available as optional details.
- Distinguish automatically saved working draft, named saved projects and downloaded portable files.
- Keep existing accessible action names where practical for existing browser QA.
- Coordinator exposed the existing setDeleteId setter for explicit Cancel in delete confirmation.
- Uses coordinator's StudioTabs component; all tab controls have mounted, correctly labelled panels, with inactive panels hidden.
- Primary fit results moved from the old ct-packed-count element to ct-fit-summary; root was told to update two QA CSS selectors.

## Tasks and evidence

| Task | Status | Evidence |
|---|---|---|
| Read project resume, Git state and harness rules | Done | REDESIGN.md, META-HARNESS, core/build/team and TS skill read explicitly |
| Inspect controller/panels/dialog/CSS contracts | Done | Existing callbacks and style selectors inspected |
| Rewrite panel UX and copy | Written but untested | Fit-first overview, optional advanced details, comparison explanations, explicit delete/cancel, file-purpose descriptions |
| Verify composed application | To do | Root owns heavy and browser checks |

## Checkpoints

- 2026-10-01: loaded project binding, active workflow and dirty source state; started bounded panels-only lane.
- 2026-10-01: confirmed active build run local verification record. TypeScript createSourceFile found no TSX parse diagnostics; PostCSS parsed panels.css; trailing-space search returned no matches. Full typecheck/build/tests/browser checks NOT RUN by this lane.
- 2026-10-01: source review corrected initial pending-fit copy, made delete require the explicit confirmation button, kept recovery-paused autosave copy honest, and disabled weight-centre display when map/exploded/partial replay suppresses that marker.
