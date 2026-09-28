// Load cases and result types for the stability check (no physics-engine dependency).

export type CaseId = 'fwd' | 'lat' | 'vert';

export interface StressCase {
  id: CaseId;
  label: string;
  short: string;
  description: string;
  duration: number; // s
  /** effective acceleration (in g, ULD frame: x lateral, y up, z towards door/net) at time t */
  g: (t: number) => [number, number, number];
}

const ramp = (t: number, t0: number, t1: number) => (t <= t0 ? 0 : t >= t1 ? 1 : (t - t0) / (t1 - t0));
const pulse = (t: number, a: number, b: number, c: number, d: number) => ramp(t, a, b) * (1 - ramp(t, c, d));

export const CASES: StressCase[] = [
  {
    id: 'fwd',
    label: 'Braking / RTO — 1.5 g longitudinal',
    short: '1.5 g FWD',
    description: 'Deceleration pushes the load towards the door / net side.',
    duration: 1.7,
    g: (t) => [0, -1, 1.5 * pulse(t, 0.05, 0.3, 0.8, 1.05)],
  },
  {
    id: 'lat',
    label: 'Lateral — 1.5 g side load',
    short: '1.5 g LAT',
    description: 'Side load towards the contoured (outboard) face.',
    duration: 1.7,
    g: (t) => [-1.5 * pulse(t, 0.05, 0.3, 0.8, 1.05), -1, 0],
  },
  {
    id: 'vert',
    label: 'Vertical gust — +2.5 g / 0 g',
    short: '+2.5 / 0 g VERT',
    description: 'Hard gust: 2.5 g down, then a brief zero-g unloading before returning to 1 g.',
    duration: 1.9,
    g: (t) => {
      const down = pulse(t, 0.05, 0.25, 0.45, 0.6);
      const up = pulse(t, 0.6, 0.7, 0.8, 0.95);
      return [0, -1 - 1.5 * down + 1.0 * up, 0];
    },
  },
];

export interface Mover {
  pieceId: string;
  disp: number; // final displacement (cm)
  maxDisp: number; // peak displacement during the case (cm)
  tilt: number; // final tilt (deg)
  kind: 'shift' | 'tip' | 'transient';
}

export interface CaseResult {
  id: CaseId;
  movers: Mover[];
  maxDisp: number;
  maxTilt: number;
}

export interface StabilityResult {
  uldId: string;
  cases: CaseResult[];
  verdict: 'stable' | 'restrain' | 'unstable';
  worst: Mover[];
}

export const THRESHOLDS = { shiftCm: 5, transientCm: 8, tipDeg: 12 };

