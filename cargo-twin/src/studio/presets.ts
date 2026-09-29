import type { CargoItem, CargoScenario, SpaceConfig } from './model';

export const SPACE_PRESETS: SpaceConfig[] = [
  { id: 'delivery-van', name: 'Delivery van', mode: 'road', lengthCm: 320, widthCm: 175, heightCm: 185, maxPayloadKg: 1200, clearanceCm: 3, reservedDepthCm: 15 },
  { id: 'box-truck', name: 'Box truck', mode: 'road', lengthCm: 620, widthCm: 240, heightCm: 245, maxPayloadKg: 6000, clearanceCm: 4, reservedDepthCm: 25 },
  { id: 'sea-container', name: '20 ft container · example', mode: 'sea', lengthCm: 590, widthCm: 235, heightCm: 239, maxPayloadKg: 26000, clearanceCm: 3, reservedDepthCm: 15 },
  { id: 'air-uld', name: 'Air cargo box · example', mode: 'air', lengthCm: 155, widthCm: 150, heightCm: 160, maxPayloadKg: 1400, clearanceCm: 3, reservedDepthCm: 5 },
  { id: 'rail-wagon', name: 'Rail freight bay', mode: 'rail', lengthCm: 1200, widthCm: 280, heightCm: 260, maxPayloadKg: 40000, clearanceCm: 5, reservedDepthCm: 30 },
  { id: 'custom-space', name: 'My custom space', mode: 'custom', lengthCm: 400, widthCm: 220, heightCm: 220, maxPayloadKg: 3000, clearanceCm: 2, reservedDepthCm: 0 },
];

function item(id: string, name: string, dimensions: [number, number, number], weightKg: number, quantity: number, color: string, extra: Partial<CargoItem> = {}): CargoItem {
  const [lengthCm, widthCm, heightCm] = dimensions;
  return { id, name, lengthCm, widthCm, heightCm, weightKg, quantity, fragile: false, keepUpright: false, stackable: true, maxTopLoadKg: 120, priority: 'normal', color, ...extra };
}

export const CARGO_SCENARIOS: CargoScenario[] = [
  {
    id: 'city-delivery', name: 'City delivery', spaceId: 'delivery-van',
    description: 'Cartons, heavy cases, glassware and long panels share one delivery van.',
    items: [
      item('cartons', 'Everyday cartons', [60, 40, 40], 12, 16, '#78d9c4'),
      item('tools', 'Tool cases', [80, 60, 50], 58, 4, '#5ea8ff', { keepUpright: true, maxTopLoadKg: 220, priority: 'high' }),
      item('glass', 'Glassware', [70, 50, 55], 9, 3, '#f4b36b', { fragile: true, keepUpright: true, stackable: false, maxTopLoadKg: 0 }),
      item('panels', 'Wrapped panels', [120, 12, 70], 8, 5, '#b9a0f6', { maxTopLoadKg: 25 }),
      item('parcels', 'Small parcels', [40, 30, 30], 5, 12, '#e6cd72', { maxTopLoadKg: 35 }),
    ],
  },
  {
    id: 'moving-day', name: 'Moving day', spaceId: 'box-truck',
    description: 'A practical mix of furniture, book boxes and delicate upright pieces.',
    items: [
      item('sofa', 'Wrapped sofa', [210, 90, 85], 65, 1, '#79aef4', { keepUpright: true, maxTopLoadKg: 20, priority: 'high' }),
      item('cabinet', 'Cabinet', [70, 65, 165], 52, 2, '#be9ce8', { keepUpright: true, stackable: false, maxTopLoadKg: 0 }),
      item('books', 'Book boxes', [45, 35, 30], 18, 28, '#72d4b6', { maxTopLoadKg: 90 }),
      item('lamps', 'Lamp crates', [55, 55, 90], 7, 4, '#efaa77', { fragile: true, keepUpright: true, stackable: false, maxTopLoadKg: 0 }),
      item('linen', 'Linen boxes', [65, 45, 40], 6, 16, '#e6ce78', { maxTopLoadKg: 12 }),
    ],
  },
  {
    id: 'export-mix', name: 'Export mix', spaceId: 'sea-container',
    description: 'Machinery, retail cartons and delicate electronics for a container plan.',
    items: [
      item('machines', 'Machine crates', [120, 100, 95], 380, 4, '#659fdd', { keepUpright: true, maxTopLoadKg: 650, priority: 'high' }),
      item('retail', 'Retail cartons', [60, 40, 45], 14, 80, '#71cdbb', { maxTopLoadKg: 80 }),
      item('electronics', 'Display crates', [100, 35, 75], 19, 10, '#eaaa73', { fragile: true, keepUpright: true, stackable: false, maxTopLoadKg: 0 }),
      item('parts', 'Spare parts', [40, 30, 25], 12, 30, '#b29ce8', { maxTopLoadKg: 90 }),
    ],
  },
];

export const SAMPLE_CARGO: CargoItem[] = CARGO_SCENARIOS[0].items;

export function spacePreset(id: string): SpaceConfig {
  return { ...(SPACE_PRESETS.find(space => space.id === id) ?? SPACE_PRESETS[0]) };
}

export function cargoScenario(id: string): CargoScenario {
  const scenario = CARGO_SCENARIOS.find(candidate => candidate.id === id) ?? CARGO_SCENARIOS[0];
  return { ...scenario, items: scenario.items.map(cargo => ({ ...cargo })) };
}
