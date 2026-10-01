# Cargo Twin

**A cargo load-planning studio for road, sea, air, rail and the space you actually have.** Enter box sizes, quantities, weights and handling rules, customize the usable load space, then compare calculated 3D layouts and replay their loading sequence.

The **v4 redesign** lives in [`cargo-twin/`](cargo-twin/). The general cargo studio opens by default with a responsive workspace, transport-specific 3D scenes, a project library and portable reports. The **Aircraft workspace** retains the earlier ULD packing, rigid-body stress tests and freighter weight-and-balance tools.

## Cargo studio

Follow **Choose space → Add cargo → Review plan**. The studio starts with an editable sample; **New project** clears the cargo for a blank load. On phones, setup appears before the scene and the next action stays visible. **Build 3D plan** calculates a layout; **Update plan** refreshes it after edits. Blank or invalid values remain editable and have inline guidance.

Scene views, reset and **Display settings** have visible labels. Select a piece to inspect it, then use **Edit this cargo type** to open its exact editor. Results lead with the number of pieces that fit, while advanced measurements are optional. The library distinguishes working drafts, named saved projects and portable JSON backups; deleting a saved copy requires explicit confirmation and offers Cancel.

- Start with a delivery van, box truck, sea container, air-freight space, rail wagon or custom rectangular space. Edit internal dimensions, payload, wall/ceiling clearance and a reserved rear section. The scene shows the excluded space; utilization uses the remaining usable volume.
- Describe each cargo group with its dimensions, quantity, mass per piece, priority, fragility, upright requirement, stackability and maximum supported load. Mix sturdy cartons, heavy equipment, delicate goods and other box-shaped cargo in one scenario.
- Compare **Max fill**, **Balanced** and **Gentle** deterministic packing heuristics. Placements respect dimensions, non-overlap, payload, orientation, full base support and cumulative load on supporting cargo. Fragile or non-stackable boxes receive no cargo on top.
- Inspect packed/unplaced counts, usable cubic metres, occupied-space percentage, payload percentage and the mass-weighted centre of gravity. Load insights add floor coverage, height used, stacked/rotated counts, cargo-group totals and mass distribution. Unplaced cargo has a reason; empty space is not automatically safe or reachable packing space.
- Orbit the 3D twin, switch between **3D**, **Top**, **Side** and **Map**, and click a piece to inspect its dimensions, weight, base support and load above. Toggle the transport shell, labels, exploded inspection and cargo centre of gravity; color cargo by type, weight or handling. Exploded positions are display offsets, not calculated placements. Replay, pause or scrub the loading sequence at 0.5×, 1× or 2× speed.
- Use the SVG floor map and searchable placement list without WebGL. The map supports Tab focus, arrow keys, Home/End and Enter/Space selection. Upper cargo can cover lower cargo in the map; the placement list provides access to every calculated piece. A failed 3D renderer reports its state while the map remains available.
- Save named projects, reopen them, save a new copy or delete a saved copy through the **Projects** library. Undo/redo retains the matching project ID when moving between projects, so saving a restored document updates its own saved project. The editor retains up to 40 history entries during the session.
- Export/import project JSON or cargo CSV. Download placement CSV with coordinates, handling rules, support/top loads and unplaced reasons, or preview/download the standalone HTML load sheet and print it to PDF. Changing cargo, space or strategy marks the calculated plan as stale; repack before exporting calculated placements or a report.

### Saving and recovery

Projects and drafts use this browser's `localStorage`, scoped to its origin and profile. There is no account, server database, cloud sync or shared project library. Changing browser, device, hostname or port gives a separate store; clearing site data removes its saved copies. Export JSON for a portable backup.

The draft autosaves after a short pause when its inputs validate, and flushes current valid edits when leaving or reloading the page. Its document and active saved-project ID are written together, so reloading resumes the correct binding. Autosave is separate from the named library: **Save project** updates the library, and **Save as a new copy** creates another identity. Deleting a saved project leaves its open draft available. Up to 50 named projects can be stored; actual capacity also depends on the browser's storage quota.

Invalid or damaged stored drafts pause autosave and expose recovery controls. **Download original data** preserves the raw stored text; **Use current draft** first saves those original bytes under a recovery key, then resumes autosave. A damaged project collection cannot be silently replaced by a new save. Valid legacy `cargo-twin-studio-v1` data appears as a recovered project, and migration preserves its original stored copy.

### CSV and JSON interchange

Cargo CSV requires these exact, case-sensitive headers, in any order:

```csv
name,lengthCm,widthCm,heightCm,weightKg,quantity
"Glass, premium",60,40,30,12,2
```

Optional columns are `id`, `fragile`, `keepUpright`, `stackable`, `maxTopLoadKg`, `priority` and `color`. Flags accept `true/false`, `yes/no` or `1/0`; priority is `low`, `normal` or `high`. Omitted handling columns default to non-fragile, free orientation, stackable, **zero top-load allowance**, normal priority and an assigned color; set an explicit positive allowance to permit supporting cargo above. Omitted IDs are generated. Quoted commas, doubled quotes, UTF-8 BOMs and CRLF/LF line endings are supported. Exports include IDs to retain cargo identity; formula-like exported text receives a leading apostrophe for spreadsheet safety.

Imports validate before replacing editor state and report malformed CSV rows. JSON export includes the project name, space, cargo and strategy under `format: "cargo-twin"`, schema `version: 2`; valid version 1 scenarios and legacy unnamed documents remain supported. Importing JSON opens a detached editable project; save it to create a library entry.

| Boundary | Current limit |
|---|---|
| UI file import | At most 1,000,000 bytes per JSON or CSV file |
| Cargo rows | 0–400 rows; the CSV parser also caps input at 2,000,000 characters |
| Quantity | Whole numbers from 1 to 10,000 per cargo row |
| Interactive plan | At most 400 eligible pieces, considered in priority order; remaining pieces are listed as unplaced with a limit reason |
| Cargo and space dimensions | Finite values from 0.1 to 100,000 cm |
| Per-piece mass and space payload | Greater than zero and at most 1,000,000,000 kg |
| Top-load allowance | From zero to 1,000,000,000 kg |
| Imported clearance / reserved depth | From zero to 100,000 cm, while leaving positive usable dimensions |
| Imported names | 1–120 printable characters; control characters are rejected |
| IDs and colors | Unique cargo IDs with 1–64 letters, numbers, hyphens or underscores; six-digit hexadecimal colors |

Clearance and reserved rear depth must be nonnegative and leave usable space. Unsupported priorities, modes, strategies, flags, unknown/duplicate CSV headers and duplicate cargo IDs are rejected. These are validation bounds, not realistic equipment recommendations.

### Keyboard controls

| Action | Shortcut |
|---|---|
| Save current project | Ctrl/Cmd + S, including when an editor input has focus |
| Undo / redo an app edit | Ctrl/Cmd + Z / Ctrl/Cmd + Shift + Z outside text inputs and dialogs |
| Reset camera / open guide | R / ? outside editor inputs and dialogs |
| Close a dialog | Escape |
| Navigate input/result tabs | Left/Right arrows, Home/End; Tab enters the selected tab |
| Inspect cargo on the map | Arrow keys or Home/End to navigate; Enter/Space to select |

These are comparative planning heuristics, not a guarantee of a global optimum. Presets and transport shells are illustrative, not certified vehicle specifications. The studio models rectangular cargo/spaces and static support; its loading replay is a visual sequence, not a collision-free door-path or vehicle-dynamics simulation. Cargo centre of gravity excludes vehicle/fuel mass, and real axle limits, restraints, acceleration, friction, irregular cargo and loading/unloading access are not modeled. Packed statistics exclude unplaced cargo. The separate Aircraft workspace includes the earlier physics stress-test prototype. Neither workspace is an operational load approval.

## Aircraft workspace

**An air-cargo load-planning digital twin that runs in the browser.** It turns a cargo manifest into
built ULDs (containers and pallets, packed against their real contours), stress-tests each stack with
a rigid-body simulation, and places the ULDs on a Boeing 777F or 747-8F within position limits and
the CG envelope. Then it prints the loading instruction.

> Portfolio prototype · **not affiliated with any airline** · no airline logos or liveries · all aircraft
> and ULD figures are *representative and simplified* and must never be used for real operations.

The aircraft workspace comes from **v2**. The original hackathon prototype is kept,
untouched, in [`AInnovator_ Cathay Cargo Twin Prototype/`](AInnovator_%20Cathay%20Cargo%20Twin%20Prototype/).

---

### What the aircraft workspace does

| Stage | What happens |
|---|---|
| **1 · Manifest** | 3 realistic sample flights (HKG→LAX e-commerce/tech/pharma on a 777F, HKG→FRA perishables + DG on a 747-8F, a heavy-machinery charter HKG→DWC), a seeded random manifest generator, CSV import/export, and a shipment editor. Shipments have AWBs with valid mod-7 check digits, pieces, dimensions, weight, IATA special handling codes (PER, PES, PEF, EAT, PIL, COL/CRT/ERT/FRO, DGR + class/UN number, RLI, ICE, CAO, AVI, VAL, HEA, BIG) plus a fragile flag, a temperature range, a “this way up” orientation lock and a max load on top. |
| **2 · Build-up** | A contour-aware **extreme-point 3D packer** assigns pieces to ULDs and places them with gravity drop, contour clipping (sloped LD3 side, chamfered main-deck contours), no overlap, minimum base support, load-bearing propagation (weight on top ≤ each piece’s allowance), orientation locks and a residual-space “waste” merit. Temperature regimes (active RKN for frozen goods and cold-chain pharma, passive covers for perishables), IATA DGR Table 9.3.A segregation, toxic-vs-food and dry-ice-vs-animal separation, dedicated VAL/AVI ULDs and cargo-aircraft-only (main deck) are enforced. Every piece that cannot fly gets a reason. Reports volume/weight utilisation and chargeable weight (6000 cm³/kg). |
| **Compare** | Four greedy strategies (wall builder, layer builder, max-contact, CG-balanced) and a time-boxed **biased random-key genetic algorithm** seeded with them, ranked in a KPI table with a GA convergence chart. |
| **3 · Stability** | A **cannon-es rigid-body stress test** (fixed 240 Hz step, deterministic): the stack settles under 1 g, then 1.5 g braking, 1.5 g lateral and a +2.5 g / 0 g vertical gust are applied; pieces that shift > 5 cm or tip > 12° are highlighted, with the ULD centre of gravity shown against a ±10 % base guide. |
| **4 · Load plan** | ULDs are placed on the aircraft by an **auto-optimiser** (constraint-aware greedy + move/swap local search) or by **drag and drop** on a deck plan with overlapping lower-deck pallet/container positions and centre-line main-deck alternatives. Live **weight & balance**: DOW, ZFW, TOW, LW, %MAC, a hand-drawn CG envelope chart, fuel slider, hold limits, lateral imbalance and DG adjacency warnings. |
| **5 · LIR** | A printable loading instruction sheet (HTML print view) and a JSON export of the plan. |

The 3D views are three.js: a hangar scene with the ULD on a dolly (colour by handling class, shipment,
weight or temperature; x-ray; exploded view; build-sequence playback; click-to-inspect) and a
translucent freighter with its decks, positions, loaded ULDs, CG rings and the MAC bar.

**Try it:** open **Aircraft workspace**, then press **“Try a sample flight”** (or <kbd>S</kbd>) — it loads a manifest, builds the ULDs,
replays a build sequence, runs the stress test and auto-plans the aircraft.
<kbd>?</kbd> lists every keyboard shortcut; <kbd>U</kbd> opens the equipment library (ULD cross-sections to
scale and aircraft data).

## Run it

Use Node.js 22.12 or newer and npm. From the cloned repository root, PowerShell commands are:

```powershell
$taskAppPath = Join-Path (Get-Location) 'cargo-twin'
$env:NODE_OPTIONS = '--max-old-space-size=4096'
npm.cmd --prefix $taskAppPath ci
npm.cmd --prefix $taskAppPath run typecheck
npm.cmd --prefix $taskAppPath test -- --maxWorkers=1
npm.cmd --prefix $taskAppPath run build
```

Run installs, full type checks, tests and builds sequentially. `npm.cmd` avoids PowerShell execution-policy issues with the `npm.ps1` shim. The build performs a strict type check and writes static assets to `cargo-twin/dist`.

Start the development server:

```powershell
npm.cmd --prefix $taskAppPath run dev
```

Open [localhost:5301](http://localhost:5301). To inspect a completed production build, stop the development server and run:

```powershell
npm.cmd --prefix $taskAppPath run preview
```

Open [localhost:8811](http://localhost:8811). On other shells, use `npm` with the same `--prefix`, script names and test arguments, and set the equivalent `NODE_OPTIONS` environment variable.

The build uses relative asset paths (`base: './'`), bundles everything locally (fonts included; no
CDN, no service worker, no runtime network requests) and works from any sub-path such as
`/play/cargo-twin/` or inside an `<iframe>`. Studio packing runs in a Web Worker and reports an error
if the host blocks workers. The aircraft workspace retains its earlier worker fallback.

### Verification entry points

The unit suite covers both workspaces: geometry, packing/support constraints, invalid inputs, strategy behavior, aircraft rules/balance/physics and CSV. Studio regressions also cover project/draft persistence, corrupt-data preservation, project identity through undo/redo, insights, CSV quoting/validation, escaped reports and packed statistics.

Browser journey callbacks live in [`studio-journey.js`](cargo-twin/scripts/qa/studio-journey.js), [`studio-scene.js`](cargo-twin/scripts/qa/studio-scene.js), [`studio-regressions.js`](cargo-twin/scripts/qa/studio-regressions.js) and [`studio-production.js`](cargo-twin/scripts/qa/studio-production.js). They are `async (page) => { ... }` callbacks for a Playwright-capable browser runner, not standalone Node scripts or part of `npm test`. Open the running app in an **isolated browser session/profile**, use `cargo-twin/` as the runner's working directory, and run them sequentially, starting with the journey to create import fixtures. The journey callback clears `cargo-twin-*` local storage and injects damaged recovery data; the scene callback simulates WebGL context loss and a blocked Worker. Never run these against a browser profile containing projects you want to keep. Downloads/screenshots go under `output/playwright/`.

The callbacks exercise project/export/recovery, camera tools, map keyboard selection, transport scenes, responsive widths and failure handling. Regression checks add delayed file reads, in-modal feedback, immediate reload, 400-piece rendering and the aircraft sample pipeline. The production callback checks built assets, the worker and report-window print invocation with a stubbed print function; it does not validate a physical printer or OS-generated PDF. Their presence describes the checks available; it does not certify an untested checkout or deployment. Record the revision, commands and observed results for each validation run.

## How it is built

```
cargo-twin/src
├─ domain/            pure TypeScript, no DOM (unit-tested)
│  ├─ uld.ts          ULD library: AKE/LD3, AKN, AKH/LD3-45, DQF/LD8, RKN, PMC & PAG (LD / Q6 / Q7 contours)
│  ├─ geometry.ts     convex contour maths: slices, contour clipping, inset walls
│  ├─ cargo.ts        shipments, SHCs, AWB check digit, chargeable weight
│  ├─ rules.ts        temperature regimes, DGR segregation, co-loading and ULD eligibility
│  ├─ packing/        extreme-point packer, multi-ULD build-up, strategies, GA
│  ├─ aircraft.ts     777F & 747-8F: positions (with overlaps), limits, envelope, body geometry
│  ├─ balance.ts      moments, %MAC, envelope tests, W&B warnings, loading sequence
│  ├─ planner.ts      aircraft auto-optimiser
│  └─ manifests.ts, generator.ts, csv.ts
├─ physics/           cannon-es stability simulation
├─ workers/           packing/GA/planning and physics run in Web Workers
├─ three/             UldScene (hangar) and AircraftScene
├─ ui/                React aircraft control-room UI (manifest · 3D stage · KPIs / W&B)
└─ studio/            general cargo studio
   ├─ model.ts, packing.ts, packing.worker.ts, presets.ts
   ├─ projects.ts, documentHistory.ts   validated persistence and ID-aware editor history
   ├─ reports.ts, insights.ts          interchange, load sheets and derived load metrics
   ├─ StudioScene.tsx, sceneWorld.ts, sceneTypes.ts
   ├─ PlanMap.tsx                     SVG map and keyboard cargo selection
   └─ StudioApp.tsx, StudioWorkspace.tsx, useStudio.ts, StudioEditors.tsx, StudioPanels.tsx,
      StudioTabs.tsx, StudioDialog.tsx, studio.css, usability.css, editors.css, panels.css
```

The studio separates the pure planning, persistence, history, report and insight modules from its React controller/UI and three.js rendering. Packing work runs in a cancellable worker; edits invalidate prior calculations, and import completion checks that the draft has not changed while a file was read.

Stack: Vite 8, TypeScript (strict), React 19, zustand, three.js, cannon-es, vitest.

### Honest simplifications

- ULD dimensions, MGW and contours follow published IATA types, but tare weights and contour
  break-points vary by manufacturer; the pallet net is modelled as a rigid restraint around the load.
- Aircraft stations, position limits, hold limits, DOW/DOI and the CG envelope are illustrative; the fuel
  arm is fixed; cumulative/running-load limits are not modelled.
- DGR handling covers Table 9.3.A segregation plus a few separation rules — not the full DGR.
- Load factors in the stress test are representative restraint cases, not certification values.

## Credits

Originally a **team hackathon prototype (AInnovator, November 2025)** — a Figma Make export with a
Canvas-2D pseudo-3D view ([original site](https://ainnovator-cathay-cargotwin.figma.site)).
**v2 rebuilt in 2026** by Sethy Pagna UNG as a from-scratch rewrite with a real packing engine,
physics, weight & balance and a three.js twin.

**v3 broadens Cargo Twin in 2026** into a customizable transport and packing studio while retaining the aircraft workspace and the original team's attribution. The historical prototype keeps its original name in the archive; the current project and repository are Cargo Twin / `SethyPagna/cargo-twin`.

**v4 redesigns the studio in 2026** with transport-specific 3D presentation, responsive editing, an accessible map, named local projects, recoverable drafts, project-aware undo/redo, structured file interchange and printable load sheets. The earlier aircraft workspace and historical team credits remain part of the project.
