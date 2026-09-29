import { expect, it } from 'vitest';
import { comparePlans } from '../src/studio/packing';
import { MAX_CARGO_PIECES, type CargoItem, type SpaceConfig } from '../src/studio/model';
import { cargoScenario, spacePreset } from '../src/studio/presets';

it('measures realistic mixed loads in their sample spaces', () => {
  const samples = [cargoScenario('moving-day'), cargoScenario('export-mix')];
  samples[1].items = samples[1].items.map(item => item.id === 'retail' ? { ...item, quantity: 56 } : item);
  for (const scenario of samples) {
    const count = scenario.items.reduce((sum, item) => sum + item.quantity, 0);
    const start = performance.now();
    const plans = comparePlans(spacePreset(scenario.spaceId), scenario.items);
    console.info(`Cargo studio: ${scenario.name}, ${count} mixed pieces, all three strategies, ${(performance.now() - start).toFixed(1)} ms on this host.`);
    for (const plan of plans) {
      expect(plan.valid).toBe(true);
      expect(plan.stats.requestedCount).toBe(count);
      expect(plan.stats.packedCount + plan.unplaced.reduce((sum, item) => sum + item.count, 0)).toBe(count);
    }
  }
}, 60000);

it('keeps 50, 100 and the maximum 400-piece comparisons bounded and accounts for every piece', () => {
  const space: SpaceConfig = { id: 'benchmark', name: 'Benchmark bay', mode: 'custom', lengthCm: 400, widthCm: 200, heightCm: 200, maxPayloadKg: 10000, clearanceCm: 0, reservedDepthCm: 0 };
  for (const quantity of [50, 100, MAX_CARGO_PIECES]) {
    const item: CargoItem = { id: 'benchmark-box', name: 'Benchmark box', lengthCm: 20, widthCm: 20, heightCm: 20, weightKg: 2, quantity, fragile: false, keepUpright: true, stackable: true, maxTopLoadKg: 100, priority: 'normal', color: '#78d9c4' };
    const start = performance.now();
    const plans = comparePlans(space, [item]);
    const milliseconds = performance.now() - start;
    console.info(`Cargo studio: ${quantity} pieces, all three strategies, ${milliseconds.toFixed(1)} ms on this host.`);
    for (const plan of plans) {
      expect(plan.valid).toBe(true);
      expect(plan.stats.requestedCount).toBe(quantity);
      expect(plan.stats.packedCount).toBe(quantity);
      expect(plan.unplaced).toEqual([]);
      expect(plan.stats.packedWeightKg).toBe(quantity * 2);
    }
  }
}, 60000);
