// Aircraft models for weight & balance. Stations are metres aft of a nose datum,
// lateral offsets are metres (+ = right / starboard).
//
// All figures are REPRESENTATIVE and SIMPLIFIED for demonstration: published MTOW/MZFW/MLW and
// position counts are close to public data, while arms, position limits, hold limits and the CG
// envelope are illustrative. Never use them for real operations.

export type Deck = 'main' | 'lower';
export type HoldId = 'MD' | 'FWD' | 'AFT';

export interface Position {
  id: string;
  deck: Deck;
  hold: HoldId;
  compartment: string;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  arm: number;
  lat: number;
  maxWeight: number;
  accepts: string[];
  outboard: 'left' | 'right' | 'none';
  kind: 'LD3' | 'LDP' | 'MDS' | 'MDC';
  /** Centre-line alternative that overlays two-abreast positions. */
  alt?: boolean;
}

export interface Aircraft {
  id: string;
  name: string;
  short: string;
  lemac: number;
  mac: number;
  dow: number;
  dowArm: number;
  mtow: number;
  mzfw: number;
  mlw: number;
  maxFuel: number;
  fuelArm: number;
  /** Take-off / in-flight CG envelope: polygon of [%MAC, kg]. */
  envelope: [number, number][];
  targetMac: number;
  lateralLimit: number; // kg*m
  holds: { id: HoldId; label: string; maxWeight: number }[];
  positions: Position[];
  body: {
    length: number;
    radius: number;
    centerZ: number; // fuselage centre height above main-deck floor
    lowerFloorZ: number;
    wingRootX: number;
    rootChord: number;
    tipChord: number;
    span: number;
    sweepDeg: number;
    engines: number[]; // spanwise positions (m from centreline) of engines on one side
    doorX: [number, number];
    noseDoor: boolean;
    hump: boolean;
  };
  notes: string;
}

const MD_LETTERS_777 = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'P'];
const MD_LETTERS_748 = ['C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'P', 'Q', 'R', 'S', 'T', 'U'];

const PALLET_MD = ['PMC-Q6', 'PAG-Q6', 'PMC-LD', 'PAG-LD'];
const PALLET_CENTRE = ['PMC-Q7', 'PMC-LD', 'PAG-LD'];
const PALLET_LD = ['PMC-LD', 'PAG-LD'];
const LD3_TYPES = ['AKE', 'AKN', 'RKN'];

function mk(p: Omit<Position, 'arm' | 'lat'>): Position {
  return { ...p, arm: round3((p.x0 + p.x1) / 2), lat: round3((p.y0 + p.y1) / 2) };
}

function round3(v: number) {
  return Math.round(v * 1000) / 1000;
}

function mainDeckRows(letters: string[], start: number, limits: (i: number) => number): Position[] {
  const out: Position[] = [];
  const pitch = 3.26;
  letters.forEach((L, i) => {
    const x0 = round3(start + i * pitch);
    const x1 = round3(x0 + 3.18);
    const maxWeight = limits(i);
    out.push(mk({ id: `${L}L`, deck: 'main', hold: 'MD', compartment: L, x0, x1, y0: -2.46, y1: -0.02, maxWeight, accepts: PALLET_MD, outboard: 'left', kind: 'MDS' }));
    out.push(mk({ id: `${L}R`, deck: 'main', hold: 'MD', compartment: L, x0, x1, y0: 0.02, y1: 2.46, maxWeight, accepts: PALLET_MD, outboard: 'right', kind: 'MDS' }));
  });
  return out;
}

/** Centre-line alternatives overlaying a run of two-abreast rows (mutually exclusive with them). */
function centreOverlay(rows: Position[], fromLetter: string, count: number, maxWeight: number): Position[] {
  const first = rows.find((p) => p.id === `${fromLetter}L`)!;
  const out: Position[] = [];
  const pitch = 2.49;
  for (let i = 0; i < count; i++) {
    const x0 = round3(first.x0 + 0.1 + i * pitch);
    out.push(mk({ id: `${fromLetter}C${i + 1}`, deck: 'main', hold: 'MD', compartment: 'C', x0, x1: round3(x0 + 2.44), y0: -1.59, y1: 1.59, maxWeight, accepts: PALLET_CENTRE, outboard: 'none', kind: 'MDC', alt: true }));
  }
  return out;
}

interface LowerSpec {
  hold: HoldId;
  compartment: string;
  start: number;
  rows: number;
  pallets: number;
  palletLimit: number;
}

function lowerCompartment(s: LowerSpec): Position[] {
  const out: Position[] = [];
  const pitch = 1.59;
  for (let r = 0; r < s.rows; r++) {
    const x0 = round3(s.start + r * pitch);
    const x1 = round3(x0 + 1.534);
    const n = `${s.compartment}${r + 1}`;
    out.push(mk({ id: `${n}L`, deck: 'lower', hold: s.hold, compartment: s.compartment, x0, x1, y0: -2.03, y1: -0.02, maxWeight: 1588, accepts: LD3_TYPES, outboard: 'left', kind: 'LD3' }));
    out.push(mk({ id: `${n}R`, deck: 'lower', hold: s.hold, compartment: s.compartment, x0, x1, y0: 0.02, y1: 2.03, maxWeight: 1588, accepts: LD3_TYPES, outboard: 'right', kind: 'LD3' }));
  }
  for (let p = 0; p < s.pallets; p++) {
    const x0 = round3(s.start + p * 2.49);
    out.push(mk({ id: `${s.compartment}${p + 1}P`, deck: 'lower', hold: s.hold, compartment: s.compartment, x0, x1: round3(x0 + 2.44), y0: -1.59, y1: 1.59, maxWeight: s.palletLimit, accepts: PALLET_LD, outboard: 'none', kind: 'LDP' }));
  }
  return out;
}

function b777f(): Aircraft {
  const lemac = 29.83;
  const mac = 7.07;
  const md = mainDeckRows(MD_LETTERS_777, 7.5, (i) => [3600, 4500, 5200, 5200, 6000, 6000, 6000, 6000, 6000, 6000, 6000, 5000, 4000][i]);
  const tail = mk({ id: 'S', deck: 'main', hold: 'MD', compartment: 'S', x0: 49.9, x1: 52.34, y0: -1.59, y1: 1.59, maxWeight: 3000, accepts: PALLET_LD, outboard: 'none', kind: 'MDC' });
  const centre = centreOverlay(md, 'J', 3, 6804);
  const lower = [
    ...lowerCompartment({ hold: 'FWD', compartment: '1', start: 12.2, rows: 4, pallets: 2, palletLimit: 5103 }),
    ...lowerCompartment({ hold: 'FWD', compartment: '2', start: 18.6, rows: 5, pallets: 3, palletLimit: 5103 }),
    ...lowerCompartment({ hold: 'AFT', compartment: '3', start: 36.6, rows: 4, pallets: 2, palletLimit: 5103 }),
    ...lowerCompartment({ hold: 'AFT', compartment: '4', start: 43.0, rows: 3, pallets: 1, palletLimit: 5103 }),
  ];
  return {
    id: 'B777F',
    name: 'Boeing 777 Freighter',
    short: '777F',
    lemac,
    mac,
    dow: 145000,
    dowArm: round3(lemac + 0.26 * mac),
    mtow: 347815,
    mzfw: 248115,
    mlw: 260815,
    maxFuel: 145500,
    fuelArm: round3(lemac + 0.23 * mac),
    envelope: [[14, 140000], [14, 255000], [17, 315000], [21, 347815], [33, 347815], [37, 300000], [41.5, 220000], [43, 140000]],
    targetMac: 27,
    lateralLimit: 25000,
    holds: [
      { id: 'MD', label: 'Main deck', maxWeight: 112000 },
      { id: 'FWD', label: 'Lower fwd hold', maxWeight: 30000 },
      { id: 'AFT', label: 'Lower aft hold', maxWeight: 22000 },
    ],
    positions: [...md, tail, ...centre, ...lower],
    body: {
      length: 63.7, radius: 3.1, centerZ: 0.6, lowerFloorZ: -1.95,
      wingRootX: 24.2, rootChord: 13.2, tipChord: 2.6, span: 64.8, sweepDeg: 31.6,
      engines: [9.8], doorX: [43.2, 46.9], noseDoor: false, hump: false,
    },
    notes: '27 main-deck pallet positions (13 two-abreast rows + tail), 3 centre-line Q7 alternatives, 32 lower-deck LD3 or 8 lower-deck pallet positions.',
  };
}

function b748f(): Aircraft {
  const lemac = 35.9;
  const mac = 8.33;
  const md = mainDeckRows(MD_LETTERS_748, 11.6, (i) => [4000, 5000, 5200, 6000, 6000, 6000, 6000, 6000, 6000, 6000, 6000, 6000, 5600, 5200, 4600, 3800][i]);
  const nose = [
    mk({ id: 'A', deck: 'main', hold: 'MD', compartment: 'A', x0: 5.9, x1: 8.34, y0: -1.59, y1: 1.59, maxWeight: 3400, accepts: PALLET_LD, outboard: 'none', kind: 'MDC' }),
    mk({ id: 'B', deck: 'main', hold: 'MD', compartment: 'B', x0: 8.6, x1: 11.04, y0: -1.59, y1: 1.59, maxWeight: 4500, accepts: PALLET_LD, outboard: 'none', kind: 'MDC' }),
  ];
  const centre = centreOverlay(md, 'P', 3, 6804);
  const lower = [
    ...lowerCompartment({ hold: 'FWD', compartment: '1', start: 14.0, rows: 5, pallets: 3, palletLimit: 5103 }),
    ...lowerCompartment({ hold: 'FWD', compartment: '2', start: 22.0, rows: 5, pallets: 3, palletLimit: 5103 }),
    ...lowerCompartment({ hold: 'AFT', compartment: '3', start: 44.0, rows: 4, pallets: 2, palletLimit: 5103 }),
    ...lowerCompartment({ hold: 'AFT', compartment: '4', start: 50.4, rows: 5, pallets: 3, palletLimit: 5103 }),
  ];
  return {
    id: 'B748F',
    name: 'Boeing 747-8 Freighter',
    short: '747-8F',
    lemac,
    mac,
    dow: 199000,
    dowArm: round3(lemac + 0.24 * mac),
    mtow: 447696,
    mzfw: 330215,
    mlw: 346091,
    maxFuel: 182000,
    fuelArm: round3(lemac + 0.22 * mac),
    envelope: [[11, 190000], [11, 300000], [14, 380000], [19, 447696], [30, 447696], [32, 400000], [33.5, 330000], [35, 190000]],
    targetMac: 24,
    lateralLimit: 30000,
    holds: [
      { id: 'MD', label: 'Main deck', maxWeight: 150000 },
      { id: 'FWD', label: 'Lower fwd hold', maxWeight: 38000 },
      { id: 'AFT', label: 'Lower aft hold', maxWeight: 34000 },
    ],
    positions: [...nose, ...md, ...centre, ...lower],
    body: {
      length: 76.3, radius: 3.25, centerZ: 0.7, lowerFloorZ: -1.95,
      wingRootX: 28.6, rootChord: 15.0, tipChord: 3.9, span: 68.4, sweepDeg: 37.5,
      engines: [12.6, 21.4], doorX: [55.0, 58.4], noseDoor: true, hump: true,
    },
    notes: '34 main-deck pallet positions (nose A/B + 16 two-abreast rows), 3 centre-line Q7 alternatives, 38 lower-deck LD3 or 11 lower-deck pallet positions.',
  };
}

export const AIRCRAFT: Aircraft[] = [b777f(), b748f()];
export const AIRCRAFT_BY_ID: Record<string, Aircraft> = Object.fromEntries(AIRCRAFT.map((a) => [a.id, a]));

export function aircraftById(id: string): Aircraft {
  return AIRCRAFT_BY_ID[id] ?? AIRCRAFT[0];
}

/** Two positions conflict when their footprints overlap on the same deck. */
export function positionsOverlap(a: Position, b: Position): boolean {
  if (a.id === b.id || a.deck !== b.deck) return false;
  const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  const oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  return ox > 0.01 && oy > 0.01;
}

export function buildOverlapMap(ac: Aircraft): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const p of ac.positions) {
    map.set(p.id, ac.positions.filter((q) => positionsOverlap(p, q)).map((q) => q.id));
  }
  return map;
}

/** Positions sharing an edge (same deck, touching along x or y) - used for DG adjacency checks. */
export function positionsAdjacent(a: Position, b: Position): boolean {
  if (a.deck !== b.deck || a.id === b.id || positionsOverlap(a, b)) return false;
  const gapX = Math.max(a.x0, b.x0) - Math.min(a.x1, b.x1);
  const gapY = Math.max(a.y0, b.y0) - Math.min(a.y1, b.y1);
  return gapX < 0.2 && gapY < 0.2;
}

export function typeLoadableOn(ac: Aircraft, typeId: string, deck?: Deck): boolean {
  return ac.positions.some((p) => p.accepts.includes(typeId) && (!deck || p.deck === deck));
}
