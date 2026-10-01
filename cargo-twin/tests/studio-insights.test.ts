import { describe, expect, it } from 'vitest';
import { derivePlanInsights } from '../src/studio/insights';
import { packCargo } from '../src/studio/packing';
import type { PackingPlan, Placement, SpaceConfig } from '../src/studio/model';

const space: SpaceConfig = { id: 'insights', name: 'Insights test space', mode: 'custom', widthCm: 100, heightCm: 120, lengthCm: 200, maxPayloadKg: 1000, clearanceCm: 0, reservedDepthCm: 0 };

function piece(overrides: Partial<Placement> = {}): Placement {
  return {
    id: 'box#1', itemId: 'box', unitIndex: 1, sequence: 1, name: 'Box', color: '#78d9c4',
    x: 0, y: 0, z: 0, widthCm: 50, heightCm: 40, lengthCm: 50, weightKg: 10,
    fragile: false, keepUpright: true, stackable: true, maxTopLoadKg: 100,
    loadOnTopKg: 0, supportRatio: 1, supportIds: [], rotated: false, ...overrides,
  };
}

function plan(placements: Placement[], overrides: Partial<PackingPlan> = {}): PackingPlan {
  return { ...packCargo(space, []), placements, ...overrides };
}

describe('studio plan insights', () => {
  it('splits mass proportionally when boxes cross the usable-space midplanes', () => {
    const result = derivePlanInsights(plan([piece({ x: 20, z: 40, widthCm: 40, lengthCm: 80, weightKg: 40 })], {
      space: { ...space, lengthCm: 240, clearanceCm: 10, reservedDepthCm: 40 },
    }));
    expect(result.massDistribution).toEqual({
      leftKg: 30, rightKg: 10, frontKg: 30, rearKg: 10,
      leftFraction: 0.75, rightFraction: 0.25, frontFraction: 0.75, rearFraction: 0.25,
    });
    expect(result.centerOfGravity).toEqual({ x: 40, y: 20, z: 80 });
    expect(result.centerOffsetCm).toEqual({ x: -10, z: -20 });
  });

  it('preserves total mass on either side of both axes and includes elevated cargo', () => {
    const result = derivePlanInsights(plan([
      piece({ widthCm: 100, lengthCm: 200, weightKg: 60 }),
      piece({ id: 'box#2', sequence: 2, y: 40, x: 50, z: 100, weightKg: 20 }),
    ]));
    expect(result.massDistribution.leftKg).toBe(30);
    expect(result.massDistribution.rightKg).toBe(50);
    expect(result.massDistribution.frontKg).toBe(30);
    expect(result.massDistribution.rearKg).toBe(50);
    expect(result.massDistribution.leftFraction + result.massDistribution.rightFraction).toBe(1);
    expect(result.massDistribution.frontFraction + result.massDistribution.rearFraction).toBe(1);
    expect(result.packedWeightKg).toBe(80);
  });

  it('measures actual floor cargo without double-counting the upper stack', () => {
    const result = derivePlanInsights(plan([
      piece(),
      piece({ id: 'box#2', sequence: 2, y: 40, supportIds: ['box#1'] }),
    ]));
    expect(result.occupiedFloorAreaM2).toBe(0.25);
    expect(result.usableFloorAreaM2).toBe(2);
    expect(result.floorUtilization).toBe(0.125);
    expect(result.floorCount).toBe(1);
    expect(result.stackedCount).toBe(1);
    expect(result.maxHeightCm).toBe(80);
    expect(result.heightUtilization).toBeCloseTo(2 / 3);
  });

  it('uses the clearance, ceiling and rear reserve for utilization denominators', () => {
    const result = derivePlanInsights(plan([piece({ x: 10, z: 10, widthCm: 80, lengthCm: 140, heightCm: 110 })], {
      space: { ...space, clearanceCm: 10, reservedDepthCm: 40 },
    }));
    expect(result.usableDimensions).toEqual({ widthCm: 80, lengthCm: 140, heightCm: 110 });
    expect(result.floorUtilization).toBe(1);
    expect(result.heightUtilization).toBe(1);
  });

  it('aggregates packed and rejected groups without inventing volume or weight for rejected cargo', () => {
    const result = derivePlanInsights(plan([piece({ fragile: true }), piece({ id: 'other#1', itemId: 'other', name: 'Other', weightKg: 25 })], {
      unplaced: [
        { itemId: 'box', name: 'Box', count: 2, code: 'no-safe-position', reason: 'No position found.' },
        { itemId: 'large', name: 'Large', count: 3, code: 'oversized', reason: 'Too big.' },
      ],
    }));
    expect(result.groups.find(group => group.itemId === 'box')).toMatchObject({ requestedCount: 3, packedCount: 1, unplacedCount: 2, packedWeightKg: 10, packedVolumeM3: 0.1, fragileCount: 1 });
    expect(result.groups.find(group => group.itemId === 'large')).toMatchObject({ color: null, requestedCount: 3, packedCount: 0, unplacedCount: 3, packedWeightKg: 0, packedVolumeM3: 0 });
    expect(result.unplacedCount).toBe(5);
    expect(result.unplacedByReason.oversized).toBe(3);
    expect(result.remainingPayloadKg).toBe(965);
    expect(result.advice.find(advice => advice.id === 'placement')?.detail).toContain('does not prove');
    expect(result.advice.find(advice => advice.id === 'fragile')).toBeDefined();
  });

  it('reports uncomputed empty mass without a fictional balance or centre', () => {
    const result = derivePlanInsights(packCargo(space, []));
    expect(result.centerOfGravity).toBeNull();
    expect(result.centerOffsetCm).toBeNull();
    expect(result.massDistribution).toEqual({ leftKg: 0, rightKg: 0, frontKg: 0, rearKg: 0, leftFraction: 0, rightFraction: 0, frontFraction: 0, rearFraction: 0 });
    expect(result.floorUtilization).toBe(0);
    expect(result.heightUtilization).toBe(0);
    expect(result.remainingPayloadKg).toBe(1000);
  });

  it('keeps invalid-space metrics finite and highlights input errors', () => {
    const result = derivePlanInsights(packCargo({ ...space, widthCm: NaN, maxPayloadKg: Infinity }, []));
    expect(result.usableFloorAreaM2).toBe(0);
    expect(result.remainingPayloadKg).toBe(0);
    expect(Object.values(result).filter(value => typeof value === 'number').every(Number.isFinite)).toBe(true);
    expect(result.advice[0].id).toBe('invalid');
  });

  it('does not mutate the plan while inspecting placements', () => {
    const input = plan([piece()]);
    const before = JSON.stringify(input);
    derivePlanInsights(input);
    expect(JSON.stringify(input)).toBe(before);
  });
});
