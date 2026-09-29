import { describe, expect, it } from 'vitest';
import { aircraftById } from '../src/domain/aircraft';
import type { Shipment } from '../src/domain/cargo';
import { boxesOverlap, rectFitsProfile } from '../src/domain/geometry';
import { sampleManifest } from '../src/domain/manifests';
import { buildUp, type BuiltUld } from '../src/domain/packing/buildup';
import { UldPacker, orientationsOf } from '../src/domain/packing/packer';
import { dgSegregationRequired, isCao } from '../src/domain/rules';
import { uldType } from '../src/domain/uld';
import { runGa } from '../src/domain/packing/ga';

function assertPhysicallyValid(u: BuiltUld, ships: Map<string, Shipment>, minSupport: number) {
  const t = uldType(u.typeId);
  const pl = u.placements;
  for (const p of pl) {
    expect(rectFitsProfile(t.profile, p.x, p.x + p.w, p.y, p.y + p.h, 0.1), `${p.pieceId} inside contour of ${u.id}`).toBe(true);
    expect(p.z).toBeGreaterThanOrEqual(t.zRange[0] - 0.1);
    expect(p.z + p.d).toBeLessThanOrEqual(t.zRange[1] + 0.1);
    const s = ships.get(p.shipmentId)!;
    expect(p.loadOnTop, `${p.pieceId} load on top`).toBeLessThanOrEqual(s.maxTopLoad + 1e-6);
    if (s.orientation !== 'any') expect(p.h, `${p.pieceId} stays upright`).toBe(s.h);
    if (p.y > Math.min(...t.profile.map((q) => q[1])) + 0.1) expect(p.supportRatio).toBeGreaterThanOrEqual(minSupport - 1e-9);
  }
  for (let i = 0; i < pl.length; i++) for (let j = i + 1; j < pl.length; j++) {
    expect(boxesOverlap(pl[i], pl[j], 0.05), `${pl[i].pieceId} overlaps ${pl[j].pieceId}`).toBe(false);
  }
  expect(u.gross).toBeLessThanOrEqual(u.cap + 1e-6);
}

describe('single-ULD extreme-point packer', () => {
  const carton: Shipment = { id: 'C', awb: '', description: '', origin: '', dest: '', pieces: 60, l: 60, w: 40, h: 40, weight: 11, shc: ['GEN'], orientation: 'any', maxTopLoad: 30 };

  it('fills an AKE with cartons without violating contour, overlap, support or crush limits', () => {
    const pk = new UldPacker(uldType('AKE'), { minSupport: 0.75, score: 'contact', heavyLow: 1, maxGross: 1588 });
    for (let i = 0; i < 60; i++) pk.place({ id: `C#${i}`, shipmentId: 'C', index: i, l: 60, w: 40, h: 40, weight: 11 }, carton);
    expect(pk.placements.length).toBeGreaterThan(18);
    const fake = { id: 'T', typeId: 'AKE', placements: pk.placements, gross: pk.net + 82, cap: 1588 } as unknown as BuiltUld;
    assertPhysicallyValid(fake, new Map([['C', carton]]), 0.75);
    // crush limit binds: 30 kg on top of an 11 kg carton allows at most two cartons above it
    expect(Math.max(...pk.placements.map((p) => p.loadOnTop))).toBeLessThanOrEqual(30);
  });

  it('never stacks anything on a non-stackable piece', () => {
    const rack: Shipment = { ...carton, id: 'R', pieces: 2, l: 60, w: 60, h: 60, weight: 200, maxTopLoad: 0, orientation: 'upright' };
    const pk = new UldPacker(uldType('PMC-LD'), { minSupport: 0.75, score: 'layer', heavyLow: 1, maxGross: 5103 });
    pk.place({ id: 'R#1', shipmentId: 'R', index: 1, l: 60, w: 60, h: 60, weight: 200 }, rack);
    for (let i = 0; i < 80; i++) pk.place({ id: `C#${i}`, shipmentId: 'C', index: i, l: 60, w: 40, h: 40, weight: 11 }, carton);
    const r = pk.placements[0];
    const onTop = pk.placements.filter((p) => p.supports.some((s) => s.idx === 0));
    expect(onTop).toHaveLength(0);
    expect(r.loadOnTop).toBe(0);
  });

  it('honours orientation locks', () => {
    expect(orientationsOf({ l: 120, w: 100, h: 160 }, 'upright').every(([, h]) => h === 160)).toBe(true);
    expect(orientationsOf({ l: 120, w: 100, h: 160 }, 'any')).toHaveLength(6);
    expect(orientationsOf({ l: 120, w: 100, h: 160 }, 'fixed')).toEqual([[120, 160, 100]]);
  });

  it('refuses a piece that only fits in the contour overhang without support', () => {
    // 190 cm wide: wider than the AKE floor, so it cannot be the first piece
    const wide: Shipment = { ...carton, id: 'W', l: 190, w: 40, h: 30, orientation: 'upright' };
    const pk = new UldPacker(uldType('AKE'), { minSupport: 0.75, score: 'wall', heavyLow: 1, maxGross: 1588 });
    expect(pk.place({ id: 'W#1', shipmentId: 'W', index: 1, l: 190, w: 40, h: 30, weight: 11 }, wide)).toBe(false);
  });
});

describe('multi-ULD build-up on the sample manifests', () => {
  const lax = sampleManifest('HKG-LAX');
  const fra = sampleManifest('HKG-FRA');
  const dwc = sampleManifest('HKG-DWC');

  it('builds every ULD within physical rules and respects temperature, VAL and CAO handling (HKG-LAX)', () => {
    const ships = new Map(lax.shipments.map((s) => [s.id, s]));
    const r = buildUp(lax, aircraftById(lax.aircraftId), { strategy: 'wall', minSupport: 0.75 });
    expect(r.unplaced).toHaveLength(0);
    for (const u of r.ulds) {
      assertPhysicallyValid(u, ships, 0.75);
      const sh = u.shipmentIds.map((id) => ships.get(id)!);
      if (sh.some((s) => s.shc.includes('PIL') && s.shc.includes('COL'))) expect(u.typeId).toBe('RKN');
      if (u.typeId === 'RKN') expect(u.active && u.setpoint === 5).toBe(true);
      if (sh.some((s) => s.shc.includes('VAL'))) {
        expect(uldType(u.typeId).kind).toBe('container');
        expect(sh.every((s) => s.shc.includes('VAL'))).toBe(true);
      }
      if (sh.some(isCao)) expect(u.deckHint).toBe('main');
    }
    // chargeable weight never below actual
    expect(r.kpis.chargeableKg).toBeGreaterThanOrEqual(r.kpis.netKg - 1);
  });

  it('segregates dangerous goods and keeps toxics away from food and dry ice away from animals (HKG-FRA)', () => {
    const ships = new Map(fra.shipments.map((s) => [s.id, s]));
    const r = buildUp(fra, aircraftById(fra.aircraftId), { strategy: 'contact', minSupport: 0.75 });
    for (const u of r.ulds) {
      const sh = u.shipmentIds.map((id) => ships.get(id)!);
      const cls = sh.filter((s) => s.dg).map((s) => s.dg!.cls);
      for (const a of cls) for (const b of cls) expect(dgSegregationRequired(a, b), `${u.id}: ${a} with ${b}`).toBe(false);
      const toxic = sh.some((s) => s.dg?.cls === '6.1');
      const food = sh.some((s) => s.shc.some((c) => ['EAT', 'PER', 'PES', 'PEF', 'AVI'].includes(c)));
      expect(toxic && food).toBe(false);
      expect(sh.some((s) => s.shc.includes('ICE')) && sh.some((s) => s.shc.includes('AVI'))).toBe(false);
      if (sh.some((s) => s.shc.includes('FRO'))) expect(u.typeId === 'RKN' && u.setpoint === -20).toBe(true);
      assertPhysicallyValid(u, ships, 0.75);
    }
  });

  it('explains why an overweight piece cannot fly and routes outsized pieces to centre-line Q7 pallets (HKG-DWC)', () => {
    const r = buildUp(dwc, aircraftById(dwc.aircraftId), { strategy: 'wall', minSupport: 0.75 });
    const press = r.unplaced.find((u) => u.shipmentId === 'H05');
    expect(press?.code).toBe('weight');
    const casing = r.ulds.find((u) => u.shipmentIds.includes('H01'));
    expect(casing?.typeId).toBe('PMC-Q7');
  });

  it('is deterministic', () => {
    const a = buildUp(lax, aircraftById('B777F'), { strategy: 'layer', minSupport: 0.75 });
    const b = buildUp(lax, aircraftById('B777F'), { strategy: 'layer', minSupport: 0.75 });
    expect(JSON.stringify(a.ulds)).toBe(JSON.stringify(b.ulds));
  });

  it('GA refinement never does worse than its best greedy seed', () => {
    const ac = aircraftById(dwc.aircraftId);
    const seeds = (['wall', 'layer', 'contact', 'balanced'] as const).map((s) => buildUp(dwc, ac, { strategy: s, minSupport: 0.75 }));
    const ga = runGa(dwc, ac, { minSupport: 0.75, timeMs: 400, seed: 7, popSize: 6 }, seeds);
    expect(ga.kpis.cost).toBeLessThanOrEqual(Math.min(...seeds.map((s) => s.kpis.cost)));
  }, 20000);
});
