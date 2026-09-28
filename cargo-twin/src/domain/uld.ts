import { insetConvex, prismVolume, type P2 } from './geometry';

// ULD library. Dimensions in cm, weights in kg.
// Figures follow published IATA ULD specifications (ULD Technical Manual naming) and common
// manufacturer data sheets; tare weights and contour break-points vary by manufacturer, so the
// values below are REPRESENTATIVE and simplified for planning demonstrations.

export type UldKind = 'container' | 'pallet';

export interface UldType {
  id: string; // library key, e.g. 'PMC-Q6'
  iata: string; // IATA ULD type code
  alias: string; // industry nickname
  name: string;
  kind: UldKind;
  contour: string; // loading contour name
  deck: 'lower' | 'main';
  /** Overall external envelope: width along the profile axis (x), height (y), depth (z). */
  external: { width: number; height: number; depth: number };
  /** Base (floor / pallet plate) width along x. */
  baseWidth: number;
  /** External cross-section (x,y), convex CCW. x=0 is the "left" face of the ULD frame. */
  outline: P2[];
  /** Usable (internal / build-up) cross-section, convex CCW. */
  profile: P2[];
  /** Usable depth range along z. */
  zRange: [number, number];
  maxGross: number;
  tare: number;
  /** Which face carries the contour (the side that must face the fuselage skin). */
  contourSide: 'left' | 'both' | 'none';
  /** Active temperature control (setpoint range, deg C). */
  active?: { min: number; max: number };
  /** Door face for containers (always the +z face in this frame). */
  door?: boolean;
  compat: string;
  notes: string;
}

function container(
  id: string,
  iata: string,
  alias: string,
  name: string,
  outline: P2[],
  depth: number,
  opts: {
    wall?: number;
    floorRaise?: number;
    maxGross: number;
    tare: number;
    contourSide: UldType['contourSide'];
    compat: string;
    notes: string;
    active?: UldType['active'];
    usable?: { profile: P2[]; zRange: [number, number] };
  },
): UldType {
  const wall = opts.wall ?? 2.5;
  let profile = opts.usable?.profile ?? insetConvex(outline, wall);
  if (opts.floorRaise) {
    const f = opts.floorRaise;
    const minY = Math.min(...profile.map((p) => p[1]));
    // raise the floor by clipping the bottom: approximate by lifting bottom vertices
    // lifting the floor vertices keeps the section convex and inside the outline (conservative)
    profile = profile.map(([x, y]) => [x, y <= minY + 1e-6 ? y + f : y] as P2);
  }
  const xs = outline.map((p) => p[0]);
  const ys = outline.map((p) => p[1]);
  const bottom = outline.filter((p) => p[1] === Math.min(...ys)).map((p) => p[0]);
  return {
    id,
    iata,
    alias,
    name,
    kind: 'container',
    contour: alias,
    deck: 'lower',
    external: { width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys), depth },
    baseWidth: Math.max(...bottom) - Math.min(...bottom),
    outline,
    profile,
    zRange: opts.usable?.zRange ?? [wall, depth - wall],
    maxGross: opts.maxGross,
    tare: opts.tare,
    contourSide: opts.contourSide,
    active: opts.active,
    door: true,
    compat: opts.compat,
    notes: opts.notes,
  };
}

function pallet(
  id: string,
  iata: string,
  alias: string,
  name: string,
  contour: string,
  deck: 'lower' | 'main',
  outline: P2[],
  depth: number,
  opts: { maxGross: number; tare: number; contourSide: UldType['contourSide']; compat: string; notes: string },
): UldType {
  // Build-up keeps a 4 cm margin inside the pallet edge for the net and tie-down rail,
  // and cargo sits on the ~2 cm pallet plate.
  const m = 4;
  const plate = 2;
  const xs = outline.map((p) => p[0]);
  const ys = outline.map((p) => p[1]);
  const H = Math.max(...ys);
  // Inset the sides by the edge margin, then put the floor on the plate and let the build
  // reach the contour height (1 cm clearance under the contour template).
  const profile: P2[] = insetConvex(outline, m).map(([x, y]) => {
    if (y <= m + 0.01) return [x, plate] as P2;
    if (y >= H - m - 0.01) return [x, H - 1] as P2;
    return [x, y] as P2;
  });
  return {
    id,
    iata,
    alias,
    name,
    kind: 'pallet',
    contour,
    deck,
    external: { width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys), depth },
    baseWidth: Math.max(...xs) - Math.min(...xs),
    outline,
    profile,
    zRange: [m, depth - m],
    maxGross: opts.maxGross,
    tare: opts.tare,
    contourSide: opts.contourSide,
    compat: opts.compat,
    notes: opts.notes,
  };
}

// --- Lower-deck containers -------------------------------------------------------------
// AKE (LD3): base 156 cm, overall width 201 cm, height 163 cm, depth 153.4 cm.
// The contour (sloped side) runs from the base corner up to ~114 cm on one side.
const AKE_OUTLINE: P2[] = [[45, 0], [201, 0], [201, 163], [0, 163], [0, 114]];
// AKH (LD3-45): base 156 cm, overall width 244 cm, height 114 cm, contoured both sides.
const AKH_OUTLINE: P2[] = [[44, 0], [200, 0], [244, 70], [244, 114], [0, 114], [0, 70]];
// DQF (LD8): base 244 cm, overall width 318 cm, height 163 cm, contoured both sides.
const DQF_OUTLINE: P2[] = [[37, 0], [281, 0], [318, 91], [318, 163], [0, 163], [0, 91]];
// RKN: LD3-footprint active temperature-controlled container, rectangular body.
const RKN_OUTLINE: P2[] = [[0, 0], [156, 0], [156, 163], [0, 163]];

// --- Pallets ------------------------------------------------------------------------------
// PMC (P6P) 318 x 244 cm; PAG (P1P) 318 x 224 cm.
const box = (w: number, h: number): P2[] => [[0, 0], [w, 0], [w, h], [0, h]];
// Main-deck two-abreast contour (96 in / 244 cm high): outboard upper corner chamfered.
const q6 = (w: number): P2[] => [[0, 0], [w, 0], [w, 244], [56, 244], [0, 172]];
// Main-deck centre-line contour (118 in / 300 cm high): both upper corners chamfered.
const q7 = (w: number): P2[] => [[0, 0], [w, 0], [w, 226], [w - 58, 300], [58, 300], [0, 226]];

export const ULD_TYPES: UldType[] = [
  container('AKE', 'AKE', 'LD3', 'AKE lower-deck container', AKE_OUTLINE, 153.4, {
    maxGross: 1588, tare: 82, contourSide: 'left',
    compat: 'B777, B747, A350, A330 lower deck',
    notes: 'Most common widebody container; contoured on one side to follow the lower-lobe fuselage.',
  }),
  container('AKN', 'AKN', 'LD3 (forkliftable)', 'AKN forkliftable LD3', AKE_OUTLINE, 153.4, {
    maxGross: 1588, tare: 100, floorRaise: 5, contourSide: 'left',
    compat: 'B777, B747, A350, A330 lower deck',
    notes: 'LD3 envelope with forklift channels in the base (raised floor, heavier tare).',
  }),
  container('AKH', 'AKH', 'LD3-45', 'AKH LD3-45 container', AKH_OUTLINE, 153.4, {
    maxGross: 1134, tare: 75, contourSide: 'both',
    compat: 'A320 family lower deck (not loadable on the widebody freighters modelled here)',
    notes: 'Reduced-height (114 cm) LD3 for narrowbody holds; contoured on both sides.',
  }),
  container('DQF', 'DQF', 'LD8', 'DQF double-width container', DQF_OUTLINE, 153.4, {
    maxGross: 2449, tare: 130, contourSide: 'both',
    compat: 'B767 lower deck (not loadable on the freighters modelled here)',
    notes: 'Double-width lower-deck container with both lower corners contoured.',
  }),
  container('RKN', 'RKN', 'LD3 active', 'RKN active temperature-controlled container', RKN_OUTLINE, 153.4, {
    maxGross: 1588, tare: 285, contourSide: 'none',
    active: { min: -20, max: 25 },
    usable: { profile: box(128, 124).map(([x, y]) => [x + 14, y + 10] as P2), zRange: [28, 146] },
    compat: 'Any LD3 position',
    notes: 'Insulated body with compressor/heater unit (representative setpoint -20..+25 C). Internal space is reduced by insulation and the machinery bay.',
  }),
  pallet('PMC-LD', 'PMC', 'P6P / Q-LD', 'PMC pallet, lower-deck contour', 'LD 163 cm', 'lower', box(318, 163), 244, {
    maxGross: 5103, tare: 120, contourSide: 'none',
    compat: 'Widebody lower-deck pallet positions; main deck (any)',
    notes: '125 x 96 in pallet built to the 64 in (163 cm) lower-deck height. MGW restricted to 5,103 kg in the lower deck.',
  }),
  pallet('PMC-Q6', 'PMC', 'P6P / Q6', 'PMC pallet, main-deck Q6 contour', 'Q6 244 cm', 'main', q6(244), 318, {
    maxGross: 6804, tare: 120, contourSide: 'left',
    compat: 'B777F / B747F main deck, two-abreast positions',
    notes: '96 in (244 cm) main-deck build with the outboard top corner chamfered to the fuselage crown.',
  }),
  pallet('PMC-Q7', 'PMC', 'P6P / Q7', 'PMC pallet, main-deck Q7 centre contour', 'Q7 300 cm', 'main', q7(318), 244, {
    maxGross: 6804, tare: 120, contourSide: 'both',
    compat: 'B777F / B747F main deck, centre-line positions',
    notes: '118 in (300 cm) centre-loaded build with both top corners chamfered.',
  }),
  pallet('PAG-LD', 'PAG', 'P1P / Q-LD', 'PAG pallet, lower-deck contour', 'LD 163 cm', 'lower', box(318, 163), 224, {
    maxGross: 4626, tare: 110, contourSide: 'none',
    compat: 'Widebody lower-deck pallet positions; main deck (any)',
    notes: '125 x 88 in pallet at lower-deck height.',
  }),
  pallet('PAG-Q6', 'PAG', 'P1P / Q6', 'PAG pallet, main-deck Q6 contour', 'Q6 244 cm', 'main', q6(224), 318, {
    maxGross: 6033, tare: 110, contourSide: 'left',
    compat: 'B777F / B747F main deck, two-abreast positions',
    notes: '88 x 125 in pallet built to the 96 in main-deck contour.',
  }),
];

export const ULD_BY_ID: Record<string, UldType> = Object.fromEntries(ULD_TYPES.map((u) => [u.id, u]));

export function uldType(id: string): UldType {
  const t = ULD_BY_ID[id];
  if (!t) throw new Error(`Unknown ULD type ${id}`);
  return t;
}

export function usableVolumeM3(t: UldType): number {
  return prismVolume(t.profile, t.zRange[1] - t.zRange[0]) / 1e6;
}

export function usablePayload(t: UldType): number {
  return t.maxGross - t.tare;
}
