import { MAX_CARGO_PIECES, type CargoItem, type PackingPlan, type PackingStats, type PackingStrategy, type Placement, type Point3, type SpaceConfig, type UnplacedCargo, type UnplacedCode } from './model';

const EPS = 1e-7;
const PRIORITY = { high: 2, normal: 1, low: 0 };
const MODES = ['road', 'sea', 'air', 'rail', 'custom'];
const STRATEGY_IDS: PackingStrategy[] = ['max-fill', 'balanced', 'gentle'];
const MAX_POINTS = 450;
type Dimensions = { widthCm: number; heightCm: number; lengthCm: number };
type Bounds = { minX: number; maxX: number; maxY: number; minZ: number; maxZ: number };
type Unit = { item: CargoItem; index: number };
type Support = { index: number; fraction: number };
type InternalPlacement = Placement & { supports: Support[] };
type Candidate = Point3 & Dimensions & { supports: Support[]; delta: number[]; score: number[] };
type Policy = 'compact' | 'layer' | 'balanced';
type Order = 'volume' | 'footprint' | 'weight' | 'longest';

const volume = (box: Dimensions) => box.widthCm * box.heightCm * box.lengthCm;
const finitePositive = (value: number) => Number.isFinite(value) && value > 0;
const validQuantity = (value: number) => Number.isSafeInteger(value) && value > 0 && value <= 10000;

export function validateSpace(space: SpaceConfig): string[] {
  const errors: string[] = [];
  if (!space || typeof space !== 'object') return ['Choose a cargo space.'];
  for (const field of ['lengthCm', 'widthCm', 'heightCm'] as const) {
    if (!Number.isFinite(space[field]) || space[field] < 0.1 || space[field] > 100000) errors.push(`${field} must be between 0.1 and 100,000 cm.`);
  }
  if (!finitePositive(space.maxPayloadKg) || space.maxPayloadKg > 1e9) errors.push('Payload must be greater than zero and at most 1,000,000,000 kg.');
  if (!Number.isFinite(space.clearanceCm) || space.clearanceCm < 0) errors.push('Clearance must be a finite, nonnegative distance.');
  if (!Number.isFinite(space.reservedDepthCm) || space.reservedDepthCm < 0) errors.push('Reserved rear depth must be a finite, nonnegative distance.');
  if (!MODES.includes(space.mode)) errors.push('Choose a supported transport mode.');
  if (typeof space.name !== 'string' || !space.name.trim() || space.name.length > 120 || /[\u0000-\u001f\u007f]/.test(space.name)) errors.push('Use a space name with 1–120 printable characters.');
  if (!errors.length && (space.widthCm <= 2 * space.clearanceCm || space.heightCm <= space.clearanceCm || space.lengthCm <= 2 * space.clearanceCm + space.reservedDepthCm)) {
    errors.push('Clearance and the reserved rear slice leave no usable loading space.');
  }
  return errors;
}

function boundsOf(space: SpaceConfig): Bounds {
  return { minX: space.clearanceCm, maxX: space.widthCm - space.clearanceCm, maxY: space.heightCm - space.clearanceCm, minZ: space.clearanceCm, maxZ: space.lengthCm - space.clearanceCm - space.reservedDepthCm };
}

export function usableDimensions(space: SpaceConfig): Dimensions {
  if (validateSpace(space).length) return { widthCm: 0, heightCm: 0, lengthCm: 0 };
  const bounds = boundsOf(space);
  return { widthCm: bounds.maxX - bounds.minX, heightCm: bounds.maxY, lengthCm: bounds.maxZ - bounds.minZ };
}

function validateItem(item: CargoItem, duplicate: boolean): string[] {
  const errors: string[] = [];
  if (!item || typeof item !== 'object') return ['Cargo must be an item object.'];
  if (typeof item.id !== 'string' || !/^[\p{L}\p{N}_-]{1,64}$/u.test(item.id) || duplicate) errors.push('Use a unique item ID with 1–64 letters, numbers, hyphens or underscores.');
  if (typeof item.name !== 'string' || !item.name.trim() || item.name.length > 120 || /[\u0000-\u001f\u007f]/.test(item.name)) errors.push('Use a cargo name with 1–120 printable characters.');
  if (![item.widthCm, item.heightCm, item.lengthCm].every(value => Number.isFinite(value) && value >= 0.1 && value <= 100000)) errors.push('Dimensions must be between 0.1 and 100,000 cm.');
  if (!finitePositive(item.weightKg) || item.weightKg > 1e9) errors.push('Per-piece weight must be greater than zero and at most 1,000,000,000 kg.');
  if (!validQuantity(item.quantity)) errors.push('Quantity must be a whole number between 1 and 10,000.');
  if (!Number.isFinite(item.maxTopLoadKg) || item.maxTopLoadKg < 0 || item.maxTopLoadKg > 1e9) errors.push('Top-load allowance must be between zero and 1,000,000,000 kg.');
  if (![item.fragile, item.keepUpright, item.stackable].every(value => typeof value === 'boolean')) errors.push('Fragility, orientation and stackability must be on/off choices.');
  if (!Object.hasOwn(PRIORITY, item.priority)) errors.push('Choose low, normal or high priority.');
  if (typeof item.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(item.color)) errors.push('Choose a six-digit hexadecimal cargo color.');
  return errors;
}

function orientations(item: CargoItem): Dimensions[] {
  const { widthCm: w, heightCm: h, lengthCm: l } = item;
  const choices = item.keepUpright ? [[w, h, l], [l, h, w]] : [[w, h, l], [l, h, w], [w, l, h], [h, l, w], [l, w, h], [h, w, l]];
  const seen = new Set<string>();
  return choices.filter(value => { const key = value.join(':'); if (seen.has(key)) return false; seen.add(key); return true; })
    .map(([widthCm, heightCm, lengthCm]) => ({ widthCm, heightCm, lengthCm }));
}

function compareScore(a: number[], b: number[]): number {
  for (let index = 0; index < a.length; index++) if (Math.abs(a[index] - b[index]) > EPS) return a[index] - b[index];
  return 0;
}

function overlaps(a: Point3 & Dimensions, b: Point3 & Dimensions): boolean {
  return Math.min(a.x + a.widthCm, b.x + b.widthCm) - Math.max(a.x, b.x) > EPS
    && Math.min(a.y + a.heightCm, b.y + b.heightCm) - Math.max(a.y, b.y) > EPS
    && Math.min(a.z + a.lengthCm, b.z + b.lengthCm) - Math.max(a.z, b.z) > EPS;
}

function footprint(a: Point3 & Dimensions, b: Point3 & Dimensions): number {
  return Math.max(0, Math.min(a.x + a.widthCm, b.x + b.widthCm) - Math.max(a.x, b.x))
    * Math.max(0, Math.min(a.z + a.lengthCm, b.z + b.lengthCm) - Math.max(a.z, b.z));
}

function evaluate(point: Point3, dimensions: Dimensions, unit: Unit, placed: InternalPlacement[], bounds: Bounds, policy: Policy, mass: number, moment: Point3): Candidate | null {
  const box = { ...point, ...dimensions };
  if (box.x < bounds.minX - EPS || box.y < -EPS || box.z < bounds.minZ - EPS || box.x + box.widthCm > bounds.maxX + EPS || box.y + box.heightCm > bounds.maxY + EPS || box.z + box.lengthCm > bounds.maxZ + EPS) return null;
  if (placed.some(other => overlaps(box, other))) return null;
  const supports: Support[] = [];
  if (box.y > EPS) {
    let covered = 0;
    const area = box.widthCm * box.lengthCm;
    for (let index = 0; index < placed.length; index++) {
      const lower = placed[index];
      if (Math.abs(lower.y + lower.heightCm - box.y) > EPS) continue;
      const contact = footprint(box, lower);
      if (contact <= EPS) continue;
      if (lower.fragile || !lower.stackable || lower.maxTopLoadKg <= 0) return null;
      covered += contact;
      supports.push({ index, fraction: contact / area });
    }
    if (covered < area * (1 - 1e-9)) return null;
  }
  const delta = Array<number>(placed.length).fill(0);
  for (const support of supports) delta[support.index] += unit.item.weightKg * support.fraction;
  // Descending insertion order visits each support once, including converging load paths.
  for (let index = placed.length - 1; index >= 0; index--) {
    const lower = placed[index];
    if (lower.loadOnTopKg + delta[index] > lower.maxTopLoadKg + EPS) return null;
    for (const support of lower.supports) delta[support.index] += delta[index] * support.fraction;
  }
  const center = { x: box.x + box.widthCm / 2, y: box.y + box.heightCm / 2, z: box.z + box.lengthCm / 2 };
  const nextMass = mass + unit.item.weightKg;
  const deviation = Math.hypot(
    ((moment.x + center.x * unit.item.weightKg) / nextMass - (bounds.minX + bounds.maxX) / 2) / (bounds.maxX - bounds.minX),
    ((moment.z + center.z * unit.item.weightKg) / nextMass - (bounds.minZ + bounds.maxZ) / 2) / (bounds.maxZ - bounds.minZ),
  );
  const score = policy === 'balanced' ? [box.y, deviation, center.y, box.z, box.x]
    : policy === 'layer' ? [box.y, box.z, box.x, box.heightCm]
    : [box.z, box.y, box.x, box.heightCm];
  return { ...box, supports, delta, score };
}

function candidatePoints(points: Point3[], dimensions: Dimensions, bounds: Bounds, policy: Policy): Point3[] {
  const result = [...points];
  if (policy === 'balanced') {
    const xs = [bounds.minX, (bounds.minX + bounds.maxX - dimensions.widthCm) / 2, bounds.maxX - dimensions.widthCm];
    const zs = [bounds.minZ, (bounds.minZ + bounds.maxZ - dimensions.lengthCm) / 2, bounds.maxZ - dimensions.lengthCm];
    for (const x of xs) for (const z of zs) result.push({ x, y: 0, z });
  }
  return result;
}

function advancePoints(points: Point3[], last: InternalPlacement, placed: InternalPlacement[], bounds: Bounds): Point3[] {
  const { x, y, z, widthCm: w, heightCm: h, lengthCm: l } = last;
  const raw = [...points,
    { x: x + w, y, z }, { x, y: y + h, z }, { x, y, z: z + l },
    { x: x + w, y: 0, z }, { x: x + w, y, z: bounds.minZ },
    { x: bounds.minX, y: y + h, z }, { x, y: y + h, z: bounds.minZ },
    { x: bounds.minX, y, z: z + l }, { x, y: 0, z: z + l },
    { x: bounds.minX, y: y + h, z: bounds.minZ },
  ];
  const seen = new Set<string>();
  return raw.filter(point => {
    if (point.x >= bounds.maxX - EPS || point.y >= bounds.maxY - EPS || point.z >= bounds.maxZ - EPS) return false;
    if (placed.some(box => point.x >= box.x - EPS && point.x < box.x + box.widthCm - EPS && point.y >= box.y - EPS && point.y < box.y + box.heightCm - EPS && point.z >= box.z - EPS && point.z < box.z + box.lengthCm - EPS)) return false;
    const key = `${point.x.toFixed(6)}:${point.y.toFixed(6)}:${point.z.toFixed(6)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => a.y - b.y || a.z - b.z || a.x - b.x).slice(0, MAX_POINTS);
}

function addUnplaced(list: UnplacedCargo[], item: CargoItem, count: number, code: UnplacedCode, reason: string): void {
  const itemId = typeof item.id === 'string' ? item.id : '';
  const name = typeof item.name === 'string' ? item.name.slice(0, 120) : 'Unnamed cargo';
  const existing = list.find(entry => entry.itemId === itemId && entry.code === code && entry.reason === reason);
  if (existing) existing.count += count;
  else list.push({ itemId, name, count, code, reason });
}

function sortedUnits(units: Unit[], order: Order, gentle: boolean): Unit[] {
  const rank = (item: CargoItem) => order === 'weight' ? item.weightKg : order === 'footprint' ? item.widthCm * item.lengthCm : order === 'longest' ? Math.max(item.widthCm, item.heightCm, item.lengthCm) : volume(item);
  return [...units].sort((a, b) => PRIORITY[b.item.priority] - PRIORITY[a.item.priority]
    || Number(a.item.fragile || !a.item.stackable) - Number(b.item.fragile || !b.item.stackable)
    || (gentle ? b.item.maxTopLoadKg - a.item.maxTopLoadKg : 0)
    || rank(b.item) - rank(a.item)
    || a.item.id.localeCompare(b.item.id, 'en') || a.index - b.index);
}

function run(space: SpaceConfig, units: Unit[], strategy: PackingStrategy, order: Order, policy: Policy): { placements: Placement[]; unplaced: UnplacedCargo[] } {
  const bounds = boundsOf(space);
  const placed: InternalPlacement[] = [];
  const unplaced: UnplacedCargo[] = [];
  let points: Point3[] = [{ x: bounds.minX, y: 0, z: bounds.minZ }];
  let mass = 0;
  const moment = { x: 0, y: 0, z: 0 };
  for (const unit of sortedUnits(units, order, strategy === 'gentle')) {
    const { item } = unit;
    if (mass + item.weightKg > space.maxPayloadKg + EPS) {
      addUnplaced(unplaced, item, 1, 'payload', 'The remaining payload allowance is smaller than this piece’s weight.');
      continue;
    }
    let best: Candidate | null = null;
    for (const dimensions of orientations(item)) for (const point of candidatePoints(points, dimensions, bounds, policy)) {
      const candidate = evaluate(point, dimensions, unit, placed, bounds, policy, mass, moment);
      if (candidate && (!best || compareScore(candidate.score, best.score) < 0)) best = candidate;
    }
    if (!best) {
      addUnplaced(unplaced, item, 1, 'no-safe-position', 'No safe placement found by this heuristic with full base support, no overlap, and the stated stacking limits. Try another strategy or space.');
      continue;
    }
    for (let index = 0; index < placed.length; index++) placed[index].loadOnTopKg += best.delta[index];
    const placement: InternalPlacement = {
      id: `${item.id}#${unit.index}`, itemId: item.id, unitIndex: unit.index, sequence: placed.length + 1,
      name: item.name, color: item.color, x: best.x, y: best.y, z: best.z,
      widthCm: best.widthCm, heightCm: best.heightCm, lengthCm: best.lengthCm, weightKg: item.weightKg,
      fragile: item.fragile, keepUpright: item.keepUpright, stackable: item.stackable,
      maxTopLoadKg: item.fragile || !item.stackable ? 0 : item.maxTopLoadKg,
      loadOnTopKg: 0, supportRatio: 1, supportIds: best.supports.map(support => placed[support.index].id), supports: best.supports,
      rotated: best.widthCm !== item.widthCm || best.heightCm !== item.heightCm || best.lengthCm !== item.lengthCm,
    };
    placed.push(placement);
    mass += item.weightKg;
    moment.x += item.weightKg * (placement.x + placement.widthCm / 2);
    moment.y += item.weightKg * (placement.y + placement.heightCm / 2);
    moment.z += item.weightKg * (placement.z + placement.lengthCm / 2);
    points = advancePoints(points, placement, placed, bounds);
  }
  return { placements: placed.map(({ supports: _supports, ...placement }) => placement), unplaced };
}

function statsFor(space: SpaceConfig, items: CargoItem[], placements: Placement[], validSpace: boolean): PackingStats {
  const requestedCount = items.reduce((sum, item) => sum + (validQuantity(item.quantity) ? item.quantity : 0), 0);
  const requestedWeightKg = items.reduce((sum, item) => sum + (validQuantity(item.quantity) && finitePositive(item.weightKg) && item.weightKg <= 1e9 ? item.quantity * item.weightKg : 0), 0);
  const packedWeightKg = placements.reduce((sum, item) => sum + item.weightKg, 0);
  const packedVolumeM3 = placements.reduce((sum, item) => sum + volume(item) / 1e6, 0);
  const usableVolumeM3 = validSpace ? volume(usableDimensions(space)) / 1e6 : 0;
  const moment = placements.reduce((total, item) => ({ x: total.x + (item.x + item.widthCm / 2) * item.weightKg, y: total.y + (item.y + item.heightCm / 2) * item.weightKg, z: total.z + (item.z + item.lengthCm / 2) * item.weightKg }), { x: 0, y: 0, z: 0 });
  return {
    requestedCount, packedCount: placements.length, unplacedCount: requestedCount - placements.length,
    requestedWeightKg, packedWeightKg, totalVolumeM3: validSpace ? volume(space) / 1e6 : 0,
    usableVolumeM3, packedVolumeM3, emptyVolumeM3: Math.max(0, usableVolumeM3 - packedVolumeM3),
    volumeUtilization: usableVolumeM3 ? Math.min(1, packedVolumeM3 / usableVolumeM3) : 0,
    payloadUtilization: validSpace ? Math.min(1, packedWeightKg / space.maxPayloadKg) : 0,
    centerOfGravity: packedWeightKg ? { x: moment.x / packedWeightKg, y: moment.y / packedWeightKg, z: moment.z / packedWeightKg } : null,
  };
}

export function packCargo(space: SpaceConfig, items: CargoItem[], strategy: PackingStrategy = 'max-fill'): PackingPlan {
  const spaceErrors = validateSpace(space);
  const errors = [...spaceErrors];
  if (!STRATEGY_IDS.includes(strategy)) errors.push('Choose max-fill, balanced or gentle.');
  const warnings: string[] = [];
  const rejected: UnplacedCargo[] = [];
  if (!Array.isArray(items)) { errors.push('Cargo must be a list of item objects.'); items = []; }
  items = items.filter((item, index) => {
    if (item && typeof item === 'object' && !Array.isArray(item)) return true;
    errors.push(`Cargo row ${index + 1} must be an item object.`);
    rejected.push({ itemId: `invalid-row-${index + 1}`, name: 'Invalid cargo row', count: 0, code: 'invalid', reason: 'Cargo must be an item object with dimensions, weight and quantity.' });
    return false;
  });
  const units: Unit[] = [];
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item.id, (counts.get(item.id) ?? 0) + 1);
  const sorted = [...items].sort((a, b) => (PRIORITY[b.priority] ?? -1) - (PRIORITY[a.priority] ?? -1));
  const usable = usableDimensions(space);
  for (const item of sorted) {
    const itemErrors = validateItem(item, (counts.get(item.id) ?? 0) > 1);
    const count = validQuantity(item.quantity) ? item.quantity : 0;
    if (itemErrors.length || spaceErrors.length || !STRATEGY_IDS.includes(strategy)) {
      errors.push(...itemErrors.map(error => `${item.name || 'Cargo'}: ${error}`));
      addUnplaced(rejected, item, count, 'invalid', itemErrors.length ? itemErrors.join(' ') : 'Correct the space or strategy settings before packing.');
      continue;
    }
    if (!orientations(item).some(value => value.widthCm <= usable.widthCm + EPS && value.heightCm <= usable.heightCm + EPS && value.lengthCm <= usable.lengthCm + EPS)) {
      addUnplaced(rejected, item, count, 'oversized', 'This piece does not fit the usable dimensions in any permitted orientation. Clearance and the reserved rear slice are excluded.');
      continue;
    }
    if (item.weightKg > space.maxPayloadKg + EPS) {
      addUnplaced(rejected, item, count, 'payload', 'One piece alone exceeds this space’s entire payload allowance.');
      continue;
    }
    const accepted = Math.min(count, MAX_CARGO_PIECES - units.length);
    for (let index = 1; index <= accepted; index++) units.push({ item, index });
    if (accepted < count) addUnplaced(rejected, item, count - accepted, 'limit', `The interactive planner evaluates at most ${MAX_CARGO_PIECES} pieces per plan. Split this manifest into smaller loads.`);
  }
  if (rejected.some(item => item.code === 'limit')) warnings.push(`Only the first ${MAX_CARGO_PIECES} eligible pieces, in priority order, were evaluated; remaining pieces are listed separately.`);
  const candidates: [Order, Policy][] = strategy === 'max-fill' ? [['volume', 'compact'], ['footprint', 'layer'], ['longest', 'compact']]
    : strategy === 'balanced' ? [['weight', 'balanced'], ['volume', 'balanced']]
    : [['weight', 'layer'], ['footprint', 'layer']];
  const results = units.length ? candidates.map(([order, policy]) => run(space, units, strategy, order, policy)) : [{ placements: [], unplaced: [] }];
  results.sort((a, b) => b.placements.reduce((sum, item) => sum + volume(item), 0) - a.placements.reduce((sum, item) => sum + volume(item), 0)
    || b.placements.length - a.placements.length);
  const best = results[0];
  const stats = statsFor(space, items, best.placements, !spaceErrors.length);
  const cg = stats.centerOfGravity;
  if (cg && (Math.abs(cg.x - space.widthCm / 2) > space.widthCm * 0.2 || Math.abs(cg.z - (space.lengthCm - space.reservedDepthCm) / 2) > usable.lengthCm * 0.2)) warnings.push('The cargo centre of mass is offset from the usable-space centre. Compare the balanced plan and check the actual vehicle’s load limits.');
  if (best.unplaced.length) warnings.push('A partial plan is shown. Unplaced cargo is excluded from every packed-weight and fill calculation.');
  return {
    strategy, space: { ...space }, valid: errors.length === 0, placements: best.placements,
    unplaced: [...rejected, ...best.unplaced], stats, errors, warnings,
    explanation: 'Deterministic packing heuristic, not a proof of an optimal layout. Every placed box has full base support; load is shared by contact area and propagated through the whole stack. Clearance and the inaccessible rear slice are excluded from usable volume. Cargo centre of mass excludes the vehicle, fuel and restraints; real axle limits, door access and transport certification are not modelled.',
  };
}

export function comparePlans(space: SpaceConfig, items: CargoItem[]): PackingPlan[] {
  return STRATEGY_IDS.map(strategy => packCargo(space, items, strategy));
}
