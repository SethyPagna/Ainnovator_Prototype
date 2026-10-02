import type { StudioDocument } from './projects';

/** Planning inputs have a fixed field order, regardless of their import or editor origin. */
export function planningFingerprint({ space, items, strategy }: StudioDocument): string {
  return JSON.stringify([
    [space.id, space.name, space.mode, space.lengthCm, space.widthCm, space.heightCm,
      space.maxPayloadKg, space.clearanceCm, space.reservedDepthCm],
    items.map(item => [item.id, item.name, item.lengthCm, item.widthCm, item.heightCm,
      item.weightKg, item.quantity, item.fragile, item.keepUpright, item.stackable,
      item.maxTopLoadKg, item.priority, item.color]),
    strategy,
  ], (_key, value: unknown) => typeof value === 'number' && !Number.isFinite(value) ? String(value) : value);
}
