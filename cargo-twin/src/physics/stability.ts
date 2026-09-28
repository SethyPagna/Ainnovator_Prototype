import * as CANNON from 'cannon-es';
import type { BuiltUld } from '../domain/packing/buildup';
import { uldType } from '../domain/uld';

// Rigid-body stability check for one built ULD (cannon-es, fixed time step => repeatable).
// The ULD shell (floor, contour walls, rear wall and door/net) is static; every piece is a
// dynamic box. After settling under 1 g, each representative load case is applied as a change
// of the effective gravity vector (inertial load) and the pieces that slide or tip are flagged.
// Load factors are REPRESENTATIVE restraint cases, not certification values. Containers are
// restrained by their walls and door; a pallet net is modelled as a rigid restraint tensioned
// around the outside of the load (sides and top), so only internal voids let pieces move.

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

const STEP = 1 / 240;

interface Baseline {
  p: CANNON.Vec3;
  q: CANNON.Quaternion;
}

export class StabilitySim {
  readonly world: CANNON.World;
  readonly bodies: CANNON.Body[] = [];
  readonly pieceIds: string[] = [];
  private baseline: Baseline[] = [];
  private maxDisp: number[] = [];
  readonly uld: BuiltUld;
  caseIndex = -1; // -1 = settling
  t = 0;
  phase: 'settle' | 'case' | 'done' = 'settle';
  results: CaseResult[] = [];
  private settleTime = 0.6;

  constructor(uld: BuiltUld) {
    this.uld = uld;
    const t = uldType(uld.typeId);
    const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.81, 0) });
    world.broadphase = new CANNON.SAPBroadphase(world);
    world.allowSleep = false;
    (world.solver as CANNON.GSSolver).iterations = 16;
    (world.solver as CANNON.GSSolver).tolerance = 1e-7;
    const shellMat = new CANNON.Material('shell');
    const itemMat = new CANNON.Material('item');
    world.addContactMaterial(new CANNON.ContactMaterial(itemMat, itemMat, { friction: 0.45, restitution: 0.02, contactEquationStiffness: 5e7, contactEquationRelaxation: 4 }));
    world.addContactMaterial(new CANNON.ContactMaterial(itemMat, shellMat, { friction: 0.35, restitution: 0.02, contactEquationStiffness: 5e7, contactEquationRelaxation: 4 }));
    this.world = world;

    // static shell from the usable profile (convex CCW polygon), extruded over the usable depth
    const cm = 0.01;
    const th = 0.2;
    const shell = new CANNON.Body({ mass: 0, material: shellMat, type: CANNON.Body.STATIC });
    const addWall = (hx: number, hy: number, hz: number, x: number, y: number, z: number, q?: CANNON.Quaternion) =>
      shell.addShape(new CANNON.Box(new CANNON.Vec3(hx, hy, hz)), new CANNON.Vec3(x, y, z), q);
    if (t.kind === 'container') {
      const z0 = t.zRange[0] * cm, z1 = t.zRange[1] * cm;
      const zc = (z0 + z1) / 2, zh = (z1 - z0) / 2;
      const prof = t.profile;
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (let i = 0; i < prof.length; i++) {
        const [ax, ay] = prof[i];
        const [bx, by] = prof[(i + 1) % prof.length];
        minX = Math.min(minX, ax); maxX = Math.max(maxX, ax); minY = Math.min(minY, ay); maxY = Math.max(maxY, ay);
        const dx = (bx - ax) * cm, dy = (by - ay) * cm;
        const len = Math.hypot(dx, dy);
        if (len < 1e-4) continue;
        const nx = dy / len, ny = -dx / len; // outward normal for CCW
        const q = new CANNON.Quaternion();
        q.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), Math.atan2(dy, dx));
        addWall(len / 2 + th, th / 2, zh + th, ((ax + bx) / 2) * cm + (nx * th) / 2, ((ay + by) / 2) * cm + (ny * th) / 2, zc, q);
      }
      const hx = ((maxX - minX) / 2) * cm + th, hy = ((maxY - minY) / 2) * cm + th;
      const cx = ((maxX + minX) / 2) * cm, cy = ((maxY + minY) / 2) * cm;
      addWall(hx, hy, th / 2, cx, cy, z0 - th / 2);
      addWall(hx, hy, th / 2, cx, cy, z1 + th / 2); // door
    } else {
      // pallet plate + net tensioned around the load envelope
      const pl = uld.placements;
      const minX = Math.min(...pl.map((p) => p.x)) * cm - 0.005, maxX = Math.max(...pl.map((p) => p.x + p.w)) * cm + 0.005;
      const minZ = Math.min(...pl.map((p) => p.z)) * cm - 0.005, maxZ = Math.max(...pl.map((p) => p.z + p.d)) * cm + 0.005;
      const floor = Math.min(...t.profile.map((p) => p[1])) * cm;
      const top = Math.max(...pl.map((p) => p.y + p.h)) * cm + 0.01;
      const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2, cy = (floor + top) / 2;
      const hx = (maxX - minX) / 2, hz = (maxZ - minZ) / 2, hy = (top - floor) / 2;
      addWall(hx + th, th / 2, hz + th, cx, floor - th / 2, cz);
      addWall(hx + th, th / 2, hz + th, cx, top + th / 2, cz);
      addWall(th / 2, hy + th, hz + th, minX - th / 2, cy, cz);
      addWall(th / 2, hy + th, hz + th, maxX + th / 2, cy, cz);
      addWall(hx + th, hy + th, th / 2, cx, cy, minZ - th / 2);
      addWall(hx + th, hy + th, th / 2, cx, cy, maxZ + th / 2);
    }
    world.addBody(shell);

    const shrink = 0.25; // cm clearance per face so touching pieces do not start interpenetrating
    for (const p of uld.placements) {
      const body = new CANNON.Body({
        mass: p.weight,
        material: itemMat,
        shape: new CANNON.Box(new CANNON.Vec3(((p.w / 2 - shrink) * cm), ((p.h / 2 - shrink) * cm), ((p.d / 2 - shrink) * cm))),
        position: new CANNON.Vec3((p.x + p.w / 2) * cm, (p.y + p.h / 2) * cm + 0.0005, (p.z + p.d / 2) * cm),
        linearDamping: 0.05,
        angularDamping: 0.1,
      });
      world.addBody(body);
      this.bodies.push(body);
      this.pieceIds.push(p.pieceId);
    }
    this.maxDisp = this.bodies.map(() => 0);
  }

  get currentCase(): StressCase | null {
    return this.caseIndex >= 0 && this.caseIndex < CASES.length ? CASES[this.caseIndex] : null;
  }

  /** Current effective acceleration in g (for visualising the load arrow). */
  currentG(): [number, number, number] {
    const c = this.currentCase;
    return this.phase === 'case' && c ? c.g(this.t) : [0, -1, 0];
  }

  private resetToBaseline() {
    this.bodies.forEach((b, i) => {
      b.position.copy(this.baseline[i].p);
      b.quaternion.copy(this.baseline[i].q);
      b.velocity.set(0, 0, 0);
      b.angularVelocity.set(0, 0, 0);
      b.force.set(0, 0, 0);
      b.torque.set(0, 0, 0);
    });
    this.maxDisp = this.bodies.map(() => 0);
  }

  /** Advance n fixed steps. Returns true when every case has finished. */
  step(n: number): boolean {
    for (let k = 0; k < n; k++) {
      if (this.phase === 'done') return true;
      if (this.phase === 'settle') {
        this.world.gravity.set(0, -9.81, 0);
        this.world.step(STEP);
        this.t += STEP;
        if (this.t >= this.settleTime) {
          this.baseline = this.bodies.map((b) => ({ p: b.position.clone(), q: b.quaternion.clone() }));
          this.phase = 'case';
          this.caseIndex = 0;
          this.t = 0;
          this.resetToBaseline();
        }
        continue;
      }
      const c = CASES[this.caseIndex];
      const [gx, gy, gz] = c.g(this.t);
      this.world.gravity.set(gx * 9.81, gy * 9.81, gz * 9.81);
      this.world.step(STEP);
      this.t += STEP;
      this.bodies.forEach((b, i) => {
        const d = b.position.distanceTo(this.baseline[i].p) * 100;
        if (d > this.maxDisp[i]) this.maxDisp[i] = d;
      });
      if (this.t >= c.duration) {
        this.results.push(this.measure(c.id));
        this.caseIndex++;
        this.t = 0;
        if (this.caseIndex >= CASES.length) {
          this.phase = 'done';
          return true;
        }
        this.resetToBaseline();
      }
    }
    return this.phase === 'done';
  }

  private measure(id: CaseId): CaseResult {
    const movers: Mover[] = [];
    let maxDisp = 0, maxTilt = 0;
    this.bodies.forEach((b, i) => {
      const disp = b.position.distanceTo(this.baseline[i].p) * 100;
      const up = b.quaternion.vmult(new CANNON.Vec3(0, 1, 0));
      const up0 = this.baseline[i].q.vmult(new CANNON.Vec3(0, 1, 0));
      const tilt = (Math.acos(Math.max(-1, Math.min(1, up.dot(up0)))) * 180) / Math.PI;
      maxDisp = Math.max(maxDisp, disp);
      maxTilt = Math.max(maxTilt, tilt);
      const md = this.maxDisp[i];
      let kind: Mover['kind'] | null = null;
      if (tilt > THRESHOLDS.tipDeg) kind = 'tip';
      else if (disp > THRESHOLDS.shiftCm) kind = 'shift';
      else if (md > THRESHOLDS.transientCm) kind = 'transient';
      if (kind) movers.push({ pieceId: this.pieceIds[i], disp: round1(disp), maxDisp: round1(md), tilt: round1(tilt), kind });
    });
    movers.sort((a, b) => b.maxDisp - a.maxDisp);
    return { id, movers, maxDisp: round1(maxDisp), maxTilt: round1(maxTilt) };
  }

  /** World transforms (metres) of every piece, in placement order. */
  transforms(): { p: [number, number, number]; q: [number, number, number, number] }[] {
    return this.bodies.map((b) => ({ p: [b.position.x, b.position.y, b.position.z], q: [b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w] }));
  }

  summary(): StabilityResult {
    return summarise(this.uld.id, this.results);
  }
}

function round1(v: number) {
  return Math.round(v * 10) / 10;
}

export function summarise(uldId: string, cases: CaseResult[]): StabilityResult {
  const all = new Map<string, Mover>();
  for (const c of cases) for (const m of c.movers) {
    const prev = all.get(m.pieceId);
    const rank = (k: Mover['kind']) => (k === 'tip' ? 3 : k === 'shift' ? 2 : 1);
    if (!prev || rank(m.kind) > rank(prev.kind) || (rank(m.kind) === rank(prev.kind) && m.maxDisp > prev.maxDisp)) all.set(m.pieceId, m);
  }
  const worst = [...all.values()].sort((a, b) => b.maxDisp - a.maxDisp);
  const verdict = worst.some((m) => m.kind === 'tip') ? 'unstable' : worst.some((m) => m.kind === 'shift') ? 'restrain' : 'stable';
  return { uldId, cases, verdict, worst };
}

/** Headless run (tests, batch checks). */
export function runStability(uld: BuiltUld): StabilityResult {
  const sim = new StabilitySim(uld);
  let guard = 0;
  while (!sim.step(240) && guard++ < 100) { /* advance */ }
  return sim.summary();
}

export const TOTAL_STEPS = Math.round((0.6 + CASES.reduce((s, c) => s + c.duration, 0)) / STEP);
export { STEP as PHYSICS_STEP };
