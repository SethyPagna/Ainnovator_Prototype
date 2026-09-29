import { describe, expect, it } from 'vitest';
import type { Shipment } from '../src/domain/cargo';
import { fromCsv, toCsv } from '../src/domain/csv';
import { sampleManifest } from '../src/domain/manifests';
import type { BuiltUld } from '../src/domain/packing/buildup';
import { runStability } from '../src/physics/stability';

function uld(typeId: string, boxes: { x: number; y: number; z: number; w: number; h: number; d: number; kg: number }[]): BuiltUld {
  return {
    id: 'TEST', typeId, regime: 'AMB', active: false, setpoint: null,
    placements: boxes.map((b, i) => ({ ...b, weight: b.kg, pieceId: `P#${i + 1}`, shipmentId: 'P', seq: i + 1, supportRatio: 1, supports: [], loadOnTop: 0, maxTopLoad: 100 })),
    net: 0, tare: 0, gross: 0, cap: 0, itemVolM3: 0, usableM3: 0, volUtil: 0, wtUtil: 0, cg: { x: 0, y: 0, z: 0 }, cgOffsetPct: { x: 0, z: 0 },
    heightUsed: 0, shipmentIds: ['P'], shc: [], dgClasses: [], cao: false, deckHint: 'lower', group: 'AMB',
  };
}

describe('rigid-body stability check', () => {
  it('flags a tall, lone piece with a big void in front of it and is repeatable', () => {
    // 40 x 40 cm footprint, 150 cm tall, standing against the rear wall of an AKE
    const u = uld('AKE', [{ x: 120, y: 2.5, z: 2.5, w: 40, h: 150, d: 40, kg: 60 }]);
    const a = runStability(u);
    const b = runStability(u);
    expect(a.verdict).not.toBe('stable');
    expect(a.worst[0].maxDisp).toBeGreaterThan(5);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  }, 30000);

  it('keeps a low, wide slab that fills the container floor in place', () => {
    const u = uld('RKN', [{ x: 14, y: 10, z: 28, w: 128, h: 30, d: 118, kg: 200 }]);
    const r = runStability(u);
    expect(r.verdict).toBe('stable');
  }, 30000);
});

describe('CSV import / export', () => {
  it('round-trips a manifest', () => {
    const m = sampleManifest('HKG-FRA');
    const back = fromCsv(toCsv(m.shipments));
    expect(back.errors).toEqual([]);
    expect(back.shipments).toHaveLength(m.shipments.length);
    const strip = (s: Shipment) => ({ awb: s.awb, d: s.description, n: s.pieces, dims: [s.l, s.w, s.h], kg: s.weight, shc: s.shc, t: s.temp, dg: s.dg && { un: s.dg.un, cls: s.dg.cls, cao: s.dg.cao }, o: s.orientation, top: s.maxTopLoad });
    expect(back.shipments.map(strip)).toEqual(m.shipments.map(strip));
  });
  it('reports bad rows and unknown codes without crashing', () => {
    const r = fromCsv('description,pieces,length_cm,width_cm,height_cm,weight_kg_per_piece,shc\nBox,2,50,40,30,10,GEN XYZ\nBad,0,1,1,1,1,\n');
    expect(r.shipments).toHaveLength(1);
    expect(r.errors.some((e) => /XYZ/.test(e))).toBe(true);
    expect(r.errors.some((e) => /Line 3/.test(e))).toBe(true);
  });
});
