import { describe, expect, it } from 'vitest';
import { comparePlans, packCargo, usableDimensions } from '../src/studio/packing';
import { CARGO_SCENARIOS, SPACE_PRESETS, cargoScenario, spacePreset } from '../src/studio/presets';
import { MAX_CARGO_PIECES, type CargoItem, type PackingPlan, type Placement, type SpaceConfig } from '../src/studio/model';

const room = (overrides: Partial<SpaceConfig> = {}): SpaceConfig => ({ id: 'test', name: 'Test space', mode: 'custom', lengthCm: 200, widthCm: 100, heightCm: 120, maxPayloadKg: 1000, clearanceCm: 0, reservedDepthCm: 0, ...overrides });
const cargo = (overrides: Partial<CargoItem> = {}): CargoItem => ({ id: 'box', name: 'Box', lengthCm: 50, widthCm: 50, heightCm: 40, weightKg: 10, quantity: 1, fragile: false, keepUpright: true, stackable: true, maxTopLoadKg: 100, priority: 'normal', color: '#77ddbb', ...overrides });
const overlapArea = (a: Placement, b: Placement) => Math.max(0, Math.min(a.x + a.widthCm, b.x + b.widthCm) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.z + a.lengthCm, b.z + b.lengthCm) - Math.max(a.z, b.z));

function assertInvariants(plan: PackingPlan, input: CargoItem[]) {
  const { placements, space, stats } = plan;
  const rows = new Map(input.map(item => [item.id, item]));
  const carried = new Map(placements.map(item => [item.id, item.weightKg]));
  const itemCounts = new Map<string, number>();
  for (const box of placements) itemCounts.set(box.itemId, (itemCounts.get(box.itemId) ?? 0) + 1);
  const tolerance = 1e-6;
  for (const box of placements) {
    const original = rows.get(box.itemId)!;
    expect(box.x).toBeGreaterThanOrEqual(space.clearanceCm - tolerance);
    expect(box.z).toBeGreaterThanOrEqual(space.clearanceCm - tolerance);
    expect(box.y).toBeGreaterThanOrEqual(-tolerance);
    expect(box.x + box.widthCm).toBeLessThanOrEqual(space.widthCm - space.clearanceCm + tolerance);
    expect(box.y + box.heightCm).toBeLessThanOrEqual(space.heightCm - space.clearanceCm + tolerance);
    expect(box.z + box.lengthCm).toBeLessThanOrEqual(space.lengthCm - space.clearanceCm - space.reservedDepthCm + tolerance);
    expect([box.widthCm, box.heightCm, box.lengthCm].sort((a, b) => a - b)).toEqual([original.widthCm, original.heightCm, original.lengthCm].sort((a, b) => a - b));
    if (original.keepUpright) expect(box.heightCm).toBe(original.heightCm);
    expect(box.weightKg).toBe(original.weightKg);
    expect(itemCounts.get(box.itemId)).toBeLessThanOrEqual(original.quantity);
  }
  const collisions: string[] = [];
  for (let index = 0; index < placements.length; index++) {
    const box = placements[index];
    for (let otherIndex = index + 1; otherIndex < placements.length; otherIndex++) {
      const other = placements[otherIndex];
      const x = Math.min(box.x + box.widthCm, other.x + other.widthCm) - Math.max(box.x, other.x);
      const y = Math.min(box.y + box.heightCm, other.y + other.heightCm) - Math.max(box.y, other.y);
      const z = Math.min(box.z + box.lengthCm, other.z + other.lengthCm) - Math.max(box.z, other.z);
      if (x > tolerance && y > tolerance && z > tolerance) collisions.push(`${box.id} overlaps ${other.id}`);
    }
  }
  expect(collisions).toEqual([]);
  // Derive the load graph from geometry, without trusting the planner's support IDs or loads.
  for (const box of [...placements].sort((a, b) => b.y - a.y)) {
    const topLoad = carried.get(box.id)! - box.weightKg;
    expect(box.loadOnTopKg).toBeCloseTo(topLoad, 6);
    expect(topLoad).toBeLessThanOrEqual(box.maxTopLoadKg + tolerance);
    if (box.fragile || !box.stackable) expect(topLoad).toBeCloseTo(0, 8);
    if (box.y <= tolerance) continue;
    const supports = placements.filter(other => other.id !== box.id && Math.abs(other.y + other.heightCm - box.y) < tolerance && overlapArea(box, other) > tolerance);
    const area = supports.reduce((sum, other) => sum + overlapArea(box, other), 0);
    expect(area, `${box.id} requires full support`).toBeCloseTo(box.widthCm * box.lengthCm, 5);
    expect(supports.every(other => !other.fragile && other.stackable)).toBe(true);
    for (const support of supports) carried.set(support.id, carried.get(support.id)! + carried.get(box.id)! * overlapArea(box, support) / area);
  }
  const kg = placements.reduce((sum, box) => sum + box.weightKg, 0);
  const m3 = placements.reduce((sum, box) => sum + box.lengthCm * box.widthCm * box.heightCm / 1e6, 0);
  expect(kg).toBeLessThanOrEqual(space.maxPayloadKg + tolerance);
  expect(stats.packedWeightKg).toBeCloseTo(kg, 8);
  expect(stats.packedVolumeM3).toBeCloseTo(m3, 8);
  expect(stats.packedCount).toBe(placements.length);
  expect(new Set(placements.map(box => box.id)).size).toBe(placements.length);
  expect(stats.packedCount + plan.unplaced.reduce((sum, item) => sum + item.count, 0)).toBe(stats.requestedCount);
  if (kg) for (const axis of ['x', 'y', 'z'] as const) {
    const dimension = axis === 'x' ? 'widthCm' : axis === 'y' ? 'heightCm' : 'lengthCm';
    const expected = placements.reduce((sum, box) => sum + (box[axis] + box[dimension] / 2) * box.weightKg, 0) / kg;
    expect(stats.centerOfGravity![axis]).toBeCloseTo(expected, 8);
  }
}

describe('general cargo packing', () => {
  it('tiles a known rectangular volume exactly without overlap', () => {
    const items = [cargo({ quantity: 24, maxTopLoadKg: 20 })];
    const plan = packCargo(room(), items);
    expect(plan.stats.packedCount).toBe(24);
    expect(plan.stats.volumeUtilization).toBeCloseTo(1, 10);
    expect(plan.stats.packedWeightKg).toBe(240);
    expect(plan.stats.centerOfGravity).toEqual({ x: 50, y: 60, z: 100 });
    assertInvariants(plan, items);
  });

  it('uses the real clearance and reserved rear slice in geometry and volume', () => {
    const space = room({ lengthCm: 130, widthCm: 120, heightCm: 60, clearanceCm: 10, reservedDepthCm: 10 });
    const items = [cargo({ lengthCm: 100, widthCm: 100, heightCm: 50 })];
    const plan = packCargo(space, items);
    expect(usableDimensions(space)).toEqual({ widthCm: 100, heightCm: 50, lengthCm: 100 });
    expect(plan.stats.usableVolumeM3).toBe(0.5);
    expect(plan.stats.totalVolumeM3).toBe(0.936);
    expect(plan.stats.volumeUtilization).toBe(1);
    expect(plan.placements[0]).toMatchObject({ x: 10, y: 0, z: 10 });
    assertInvariants(plan, items);
  });

  it('rejects a box that fits only in the reserved space', () => {
    const plan = packCargo(room({ reservedDepthCm: 60 }), [cargo({ lengthCm: 160, widthCm: 90, heightCm: 100 })]);
    expect(plan.placements).toHaveLength(0);
    expect(plan.unplaced[0].code).toBe('oversized');
  });

  it('respects upright locks, while an unlocked box may use another height', () => {
    const space = room({ lengthCm: 100, widthCm: 80, heightCm: 50 });
    const upright = cargo({ lengthCm: 40, widthCm: 70, heightCm: 90 });
    expect(packCargo(space, [upright]).unplaced[0].code).toBe('oversized');
    const unlocked = { ...upright, keepUpright: false };
    const plan = packCargo(space, [unlocked]);
    expect(plan.placements).toHaveLength(1);
    expect(plan.placements[0].rotated).toBe(true);
    assertInvariants(plan, [unlocked]);
  });

  it('never stacks on a fragile box even if its top-load input is positive', () => {
    const items = [cargo({ quantity: 3, fragile: true, maxTopLoadKg: 500 })];
    const plan = packCargo(room({ widthCm: 50, lengthCm: 50 }), items);
    expect(plan.placements).toHaveLength(1);
    expect(plan.placements[0].maxTopLoadKg).toBe(0);
    expect(plan.unplaced[0].count).toBe(2);
    assertInvariants(plan, items);
  });

  it('keeps non-stackable cargo free of all supported weight', () => {
    const items = [cargo({ quantity: 3, stackable: false, maxTopLoadKg: 500 })];
    const plan = packCargo(room({ widthCm: 50, lengthCm: 50 }), items);
    expect(plan.placements).toHaveLength(1);
    assertInvariants(plan, items);
  });

  it('counts cumulative weight through an entire column, not only the next box', () => {
    const items = [cargo({ quantity: 3, maxTopLoadKg: 15 })];
    const plan = packCargo(room({ widthCm: 50, lengthCm: 50 }), items);
    expect(plan.placements).toHaveLength(2);
    expect(plan.unplaced[0].code).toBe('no-safe-position');
    assertInvariants(plan, items);
  });

  it('does not bridge an unsupported footprint', () => {
    const items = [
      cargo({ id: 'base', widthCm: 50, lengthCm: 100, heightCm: 50, priority: 'high' }),
      cargo({ id: 'wide', widthCm: 100, lengthCm: 100, heightCm: 20, priority: 'low' }),
    ];
    const plan = packCargo(room({ widthCm: 100, lengthCm: 100, heightCm: 100 }), items);
    expect(plan.placements).toHaveLength(1);
    expect(plan.unplaced[0].itemId).toBe('wide');
    assertInvariants(plan, items);
  });

  it('shares load across two supports and propagates it to the floor', () => {
    const items = [
      cargo({ id: 'base', widthCm: 50, lengthCm: 100, heightCm: 40, quantity: 2, priority: 'high', maxTopLoadKg: 12 }),
      cargo({ id: 'bridge', widthCm: 100, lengthCm: 100, heightCm: 20, weightKg: 20, priority: 'low' }),
    ];
    const plan = packCargo(room({ widthCm: 100, lengthCm: 100, heightCm: 70 }), items);
    expect(plan.placements).toHaveLength(3);
    expect(plan.placements.filter(box => box.itemId === 'base').map(box => box.loadOnTopKg)).toEqual([10, 10]);
    assertInvariants(plan, items);
  });

  it('separates single-piece overweight from exhausted payload', () => {
    const items = [cargo({ id: 'huge', weightKg: 101 }), cargo({ id: 'normal', weightKg: 30, quantity: 5 })];
    const plan = packCargo(room({ maxPayloadKg: 100 }), items);
    expect(plan.stats.packedCount).toBe(3);
    expect(plan.stats.packedWeightKg).toBe(90);
    expect(plan.unplaced.find(item => item.itemId === 'huge')?.reason).toContain('One piece alone');
    expect(plan.unplaced.find(item => item.itemId === 'normal')?.count).toBe(2);
    assertInvariants(plan, items);
  });

  it('handles empty input without a fictional centre of mass', () => {
    const plan = packCargo(room(), []);
    expect(plan.valid).toBe(true);
    expect(plan.stats.centerOfGravity).toBeNull();
    expect(plan.stats.packedWeightKg).toBe(0);
    expect(plan.stats.volumeUtilization).toBe(0);
  });

  it.each([NaN, Infinity, -1, 0])('rejects invalid dimensions %s without NaN statistics', value => {
    const plan = packCargo(room(), [cargo({ lengthCm: value })]);
    expect(plan.valid).toBe(false);
    expect(plan.placements).toHaveLength(0);
    expect(plan.unplaced[0].code).toBe('invalid');
    expect(Object.values(plan.stats).filter(value => typeof value === 'number').every(Number.isFinite)).toBe(true);
  });

  it.each([NaN, Infinity, -1, 0, 1.5, 10001])('rejects invalid quantity %s explicitly', quantity => {
    const plan = packCargo(room(), [cargo({ quantity })]);
    expect(plan.valid).toBe(false);
    expect(plan.unplaced[0].reason).toContain('Quantity');
    expect(plan.placements).toHaveLength(0);
  });

  it('rejects duplicate IDs rather than silently overwriting cargo', () => {
    const plan = packCargo(room(), [cargo(), cargo()]);
    expect(plan.placements).toHaveLength(0);
    expect(plan.valid).toBe(false);
    expect(plan.unplaced.reduce((sum, item) => sum + item.count, 0)).toBe(2);
  });

  it.each([
    { color: 'url(javascript:alert(1))' }, { color: '#xyzxyz' }, { name: '' }, { name: 'bad\nname' },
    { priority: 'urgent' }, { weightKg: NaN }, { maxTopLoadKg: Infinity }, { fragile: 'false' }, { name: {} },
  ])('rejects malformed imported attributes', overrides => {
    const plan = packCargo(room(), [cargo(overrides as Partial<CargoItem>)]);
    expect(plan.valid).toBe(false);
    expect(plan.placements).toHaveLength(0);
    expect(plan.unplaced[0].code).toBe('invalid');
    expect(typeof plan.unplaced[0].name).toBe('string');
  });

  it('handles malformed imported item rows without throwing', () => {
    const plan = packCargo(room(), [null, 5, []] as unknown as CargoItem[]);
    expect(plan.valid).toBe(false);
    expect(plan.errors).toHaveLength(3);
    expect(plan.placements).toHaveLength(0);
    expect(packCargo(room(), null as unknown as CargoItem[]).valid).toBe(false);
  });

  it.each([
    room({ clearanceCm: 60 }), room({ reservedDepthCm: 200 }), room({ maxPayloadKg: NaN }), room({ widthCm: Infinity }),
  ])('rejects an invalid space before packing', space => {
    const plan = packCargo(space, [cargo()]);
    expect(plan.valid).toBe(false);
    expect(plan.errors.length).toBeGreaterThan(0);
    expect(plan.placements).toHaveLength(0);
    expect(plan.stats.usableVolumeM3).toBe(0);
  });

  it('reports the interactive limit without expanding unbounded quantities', () => {
    const items = [cargo({ quantity: MAX_CARGO_PIECES + 10, maxTopLoadKg: 0 })];
    const plan = packCargo(room({ lengthCm: 50, widthCm: 50, heightCm: 40 }), items);
    expect(plan.placements).toHaveLength(1);
    expect(plan.unplaced.find(item => item.code === 'limit')?.count).toBe(10);
    expect(plan.stats.requestedCount).toBe(MAX_CARGO_PIECES + 10);
    assertInvariants(plan, items);
  });

  it('preserves input values and gives reproducible comparisons', () => {
    const scenario = cargoScenario('city-delivery');
    const space = spacePreset(scenario.spaceId);
    const before = JSON.stringify({ space, items: scenario.items });
    const first = comparePlans(space, scenario.items);
    const second = comparePlans(space, scenario.items);
    expect(second).toEqual(first);
    expect(first.map(plan => plan.strategy)).toEqual(['max-fill', 'balanced', 'gentle']);
    expect(JSON.stringify({ space, items: scenario.items })).toBe(before);
    for (const plan of first) assertInvariants(plan, scenario.items);
  }, 20000);

  it('can improve mass centring compared with a corner-first layout', () => {
    const items = [cargo({ widthCm: 20, heightCm: 20, lengthCm: 20, weightKg: 100 })];
    const compact = packCargo(room(), items, 'max-fill');
    const balanced = packCargo(room(), items, 'balanced');
    expect(balanced.stats.centerOfGravity?.x).toBe(50);
    expect(balanced.stats.centerOfGravity?.z).toBe(100);
    expect(compact.stats.centerOfGravity).not.toEqual(balanced.stats.centerOfGravity);
  });

  it.each(SPACE_PRESETS.flatMap(space => CARGO_SCENARIOS.map(scenario => ({ space, scenario }))))('keeps $space.name / $scenario.name within independent geometry and load invariants', ({ space, scenario }) => {
    const plan = packCargo(space, scenario.items);
    expect(plan.valid).toBe(true);
    assertInvariants(plan, scenario.items);
  }, 30000);

  it('passes independent invariants across varied seeded dimensions, weights and constraints', () => {
    let seed = 8463;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
    for (let trial = 0; trial < 12; trial++) {
      const items = Array.from({ length: 7 }, (_, index) => cargo({
        id: `item-${index}`, widthCm: 15 + Math.floor(random() * 60), lengthCm: 15 + Math.floor(random() * 90),
        heightCm: 15 + Math.floor(random() * 50), weightKg: 1 + Math.floor(random() * 35), quantity: 1 + Math.floor(random() * 4),
        maxTopLoadKg: Math.floor(random() * 90), fragile: random() < 0.2, stackable: random() > 0.2, keepUpright: random() < 0.5,
      }));
      for (const plan of comparePlans(room({ maxPayloadKg: 240, clearanceCm: 2, reservedDepthCm: 10 }), items)) assertInvariants(plan, items);
    }
  }, 30000);
});
