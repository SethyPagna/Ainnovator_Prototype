import { describe, expect, it } from 'vitest';
import { aircraftById, buildOverlapMap, positionsOverlap } from '../src/domain/aircraft';
import { armFromMac, computeWb, envelopeLimitsAt, inEnvelope, pctMac, positionIssue } from '../src/domain/balance';
import { sampleManifest } from '../src/domain/manifests';
import { buildUp, type BuiltUld } from '../src/domain/packing/buildup';
import { autoPlan } from '../src/domain/planner';

describe('%MAC and envelope maths', () => {
  const ac = aircraftById('B777F');
  it('converts arms to %MAC and back', () => {
    expect(pctMac(ac, ac.lemac)).toBe(0);
    expect(pctMac(ac, ac.lemac + ac.mac)).toBeCloseTo(100, 10);
    expect(pctMac(ac, armFromMac(ac, 27.5))).toBeCloseTo(27.5, 10);
  });
  it('tests points against the envelope polygon', () => {
    expect(inEnvelope(ac.envelope, 27, 300000)).toBe(true);
    expect(inEnvelope(ac.envelope, 10, 300000)).toBe(false);
    expect(inEnvelope(ac.envelope, 27, 360000)).toBe(false); // above MTOW
    const [fwd, aft] = envelopeLimitsAt(ac.envelope, 300000)!;
    expect(fwd).toBeGreaterThan(14);
    expect(aft).toBeLessThan(43);
  });
  it('computes ZFW/TOW/LW weights and CG by moments', () => {
    const p = ac.positions.find((q) => q.id === 'GL')!;
    const u = { id: 'U1', typeId: 'PMC-Q6', gross: 5000, shipmentIds: [], dgClasses: [], shc: [], placements: [] } as unknown as BuiltUld;
    const wb = computeWb({ ac, ulds: [u], assignments: { GL: 'U1' }, fuel: 100000, tripFuel: 90000, ships: new Map() });
    expect(wb.zfw).toBe(ac.dow + 5000);
    expect(wb.zfwArm).toBeCloseTo((ac.dow * ac.dowArm + 5000 * p.arm) / (ac.dow + 5000), 9);
    expect(wb.tow).toBe(ac.dow + 5000 + 100000);
    expect(wb.lw).toBe(ac.dow + 5000 + 10000);
    expect(wb.lateralMoment).toBeCloseTo(5000 * p.lat, 6);
  });
});

describe('positions', () => {
  const ac = aircraftById('B777F');
  it('models overlapping lower-deck pallet and container positions', () => {
    const p = (id: string) => ac.positions.find((q) => q.id === id)!;
    expect(positionsOverlap(p('11P'), p('11L'))).toBe(true);
    expect(positionsOverlap(p('11L'), p('11R'))).toBe(false);
    expect(buildOverlapMap(ac).get('JC1')!.length).toBeGreaterThan(1); // centre-line alternative blocks side-by-side rows
  });
  it('rejects ULDs that exceed the position limit or do not fit the position', () => {
    const md = ac.positions.find((q) => q.id === 'AL')!;
    const ld = ac.positions.find((q) => q.id === '11L')!;
    const heavy = { id: 'H', typeId: 'PMC-Q6', gross: 5000, shipmentIds: [] } as unknown as BuiltUld;
    const ake = { id: 'K', typeId: 'AKE', gross: 900, shipmentIds: [] } as unknown as BuiltUld;
    expect(positionIssue(md, heavy, new Map())).toMatch(/limit/);
    expect(positionIssue(md, ake, new Map())).toMatch(/does not fit/);
    expect(positionIssue(ld, ake, new Map())).toBeNull();
  });
});

describe('auto-planner', () => {
  it('loads every ULD legally and lands the CG near target inside the envelope', () => {
    for (const id of ['HKG-LAX', 'HKG-DWC']) {
      const m = sampleManifest(id);
      const ac = aircraftById(m.aircraftId);
      const ships = new Map(m.shipments.map((s) => [s.id, s]));
      const r = buildUp(m, ac, { strategy: 'wall', minSupport: 0.75 });
      const plan = autoPlan(r.ulds, ac, ships, { fuel: m.blockFuel - 1000, tripFuel: m.tripFuel });
      expect(plan.unassigned).toHaveLength(0);
      const wb = computeWb({ ac, ulds: r.ulds, assignments: plan.assignments, fuel: m.blockFuel - 1000, tripFuel: m.tripFuel, ships });
      expect(wb.warnings.filter((w) => w.level === 'error')).toEqual([]);
      expect(wb.inEnvelope.zfw && wb.inEnvelope.tow && wb.inEnvelope.lw).toBe(true);
      expect(Math.abs(wb.zfwMac - ac.targetMac)).toBeLessThan(1.5);
    }
  });
});
