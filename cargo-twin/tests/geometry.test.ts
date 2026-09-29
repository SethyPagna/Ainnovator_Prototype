import { describe, expect, it } from 'vitest';
import { allowedXRange, boxesOverlap, insetConvex, isConvexCCW, pointInConvex, rectFitsProfile, sliceAt } from '../src/domain/geometry';
import { ULD_TYPES, uldType, usableVolumeM3 } from '../src/domain/uld';

describe('contour geometry', () => {
  it('every ULD outline and usable profile is convex and counter-clockwise', () => {
    for (const t of ULD_TYPES) {
      expect(isConvexCCW(t.outline), `${t.id} outline`).toBe(true);
      expect(isConvexCCW(t.profile), `${t.id} profile`).toBe(true);
      for (const [x, y] of t.profile) expect(pointInConvex(t.outline, x, y), `${t.id} profile inside outline`).toBe(true);
    }
  });

  it('insets a rectangle by the wall thickness', () => {
    const r = insetConvex([[0, 0], [100, 0], [100, 50], [0, 50]], 2);
    expect(r).toEqual([[2, 2], [98, 2], [98, 48], [2, 48]]);
  });

  it('AKE (LD3) keeps IATA overall dimensions and a contour that narrows the floor', () => {
    const ake = uldType('AKE');
    expect(ake.external).toEqual({ width: 201, height: 163, depth: 153.4 });
    expect(ake.baseWidth).toBe(156);
    const floor = sliceAt(ake.profile, 3)!;
    const top = sliceAt(ake.profile, 150)!;
    expect(floor[1] - floor[0]).toBeLessThan(153); // base ~156 minus walls
    expect(top[1] - top[0]).toBeGreaterThan(193); // overhang available at the top
    expect(usableVolumeM3(ake)).toBeGreaterThan(4.0);
    expect(usableVolumeM3(ake)).toBeLessThan(4.5);
  });

  it('clips a box against the sloped side: the binding width is at the lower edge', () => {
    const ake = uldType('AKE');
    const low = allowedXRange(ake.profile, 3, 60)!; // spans the slope
    const high = allowedXRange(ake.profile, 115, 155)!; // above the slope
    expect(low[0]).toBeGreaterThan(high[0] + 30);
    expect(low[1]).toBeCloseTo(high[1], 5);
    // a 180 cm wide carton cannot stand on the AKE floor, but fits above the contour break
    expect(rectFitsProfile(ake.profile, 10, 190, 3, 60)).toBe(false);
    expect(rectFitsProfile(ake.profile, 10, 190, 116, 155)).toBe(true);
  });

  it('main-deck Q6 contour chamfers the outboard top corner only', () => {
    const q6 = uldType('PMC-Q6');
    const top = allowedXRange(q6.profile, 200, 240)!;
    const base = allowedXRange(q6.profile, 2, 160)!;
    expect(top[0]).toBeGreaterThan(base[0] + 20); // left (outboard) side cut
    expect(top[1]).toBeCloseTo(base[1], 5); // inboard side vertical
  });

  it('treats touching faces as non-overlapping', () => {
    const a = { x: 0, y: 0, z: 0, w: 10, h: 10, d: 10 };
    expect(boxesOverlap(a, { x: 10, y: 0, z: 0, w: 5, h: 5, d: 5 })).toBe(false);
    expect(boxesOverlap(a, { x: 9, y: 0, z: 0, w: 5, h: 5, d: 5 })).toBe(true);
  });
});
