# Cargo Twin

**A cargo load-planning studio for road, sea, air, rail and the space you actually have.** Enter box sizes, quantities, weights and handling rules, customize the usable load space, then compare calculated 3D layouts and replay their loading sequence.

The current version is **v3** in [`cargo-twin/`](cargo-twin/). The general cargo studio opens by default. The **Aircraft workspace** retains the earlier ULD packing, rigid-body stress tests and freighter weight-and-balance tools.

## Cargo studio

- Start with a delivery van, box truck, sea container, air-freight space, rail wagon or custom rectangular space. Edit internal dimensions, payload, wall/ceiling clearance and a reserved rear section. The scene shows the excluded space; utilization uses the remaining usable volume.
- Describe each cargo group with its dimensions, quantity, mass per piece, priority, fragility, upright requirement, stackability and maximum supported load. Mix sturdy cartons, heavy equipment, delicate goods and other box-shaped cargo in one scenario.
- Compare **Max fill**, **Balanced** and **Gentle** deterministic packing heuristics. Placements respect dimensions, non-overlap, payload, orientation, full base support and cumulative load on supporting cargo. Fragile or non-stackable boxes receive no cargo on top.
- Inspect packed/unplaced counts, usable cubic metres, occupied-space percentage, payload percentage and the mass-weighted centre of gravity. Unplaced cargo has a reason; empty space is not automatically safe or reachable packing space.
- Orbit a cutaway 3D twin, select a box, switch to a top view and replay the placement sequence. Edit the scenario on desktop or phone, save it locally, or export/import its JSON.

These are comparative planning heuristics, not a guarantee of a global optimum. Presets are illustrative editable dimensions, not certified vehicle specifications. The studio models rectangular cargo/spaces and static support; its loading replay is a visual sequence, not a collision-free door-path or vehicle-dynamics simulation. The separate Aircraft workspace includes the earlier physics stress-test prototype. Neither workspace is an operational load approval.

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
replays a build sequence, runs the stress test and auto-plans the aircraft in about 25 seconds.
<kbd>?</kbd> lists every keyboard shortcut; <kbd>U</kbd> opens the equipment library (ULD cross-sections to
scale and aircraft data).

## Run it

```bash
cd cargo-twin
npm install
npm run dev        # http://localhost:5301
npm test           # vitest: contour clipping, packing constraints, DGR/temperature rules, CG/%MAC maths, physics, CSV
npm run build      # type-check (strict) + static build in cargo-twin/dist
npm run preview    # serves the build on http://localhost:8811
```

The build uses relative asset paths (`base: './'`), bundles everything locally (fonts included; no
CDN, no service worker, no runtime network requests) and works from any sub-path such as
`/play/cargo-twin/` or inside an `<iframe>`. Studio packing runs in a Web Worker and reports an error
if the host blocks workers. The aircraft workspace retains its earlier worker fallback. The complete
build is about 1.6 MB (fonts and both workspaces included).

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
└─ ui/                React control-room UI (manifest · 3D stage · KPIs / W&B)
```

The general studio lives in `src/studio/`, with pure planning types/engine/presets separated from its React UI and three.js view. Its tests independently check placement bounds, pairwise overlap, support, loading constraints, invalid inputs and strategy behavior.

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
