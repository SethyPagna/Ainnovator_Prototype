import type { PackingPlan, Placement, Point3, UnplacedCode } from './model';
import { usableDimensions } from './packing';

const CM2_PER_M2 = 10_000;
const CM3_PER_M3 = 1_000_000;
const FLOOR_TOLERANCE_CM = 1e-7;

export interface PlanAdvice {
  id: string;
  tone: 'info' | 'attention';
  title: string;
  detail: string;
}

export interface CargoGroupInsights {
  itemId: string;
  name: string;
  color: string | null;
  requestedCount: number;
  packedCount: number;
  unplacedCount: number;
  packedWeightKg: number;
  packedVolumeM3: number;
  fragileCount: number;
}

export interface MassDistribution {
  leftKg: number;
  rightKg: number;
  frontKg: number;
  rearKg: number;
  leftFraction: number;
  rightFraction: number;
  frontFraction: number;
  rearFraction: number;
}

export interface PlanInsights {
  usableDimensions: { widthCm: number; heightCm: number; lengthCm: number };
  usableFloorAreaM2: number;
  occupiedFloorAreaM2: number;
  floorUtilization: number;
  maxHeightCm: number;
  heightUtilization: number;
  remainingPayloadKg: number;
  packedWeightKg: number;
  packedVolumeM3: number;
  packedCount: number;
  unplacedCount: number;
  floorCount: number;
  stackedCount: number;
  fragileCount: number;
  uprightCount: number;
  rotatedCount: number;
  massDistribution: MassDistribution;
  centerOfGravity: Point3 | null;
  centerOffsetCm: { x: number; z: number } | null;
  groups: CargoGroupInsights[];
  unplacedByReason: Record<UnplacedCode, number>;
  advice: PlanAdvice[];
}

export const PLAN_RULES = [
  { title: 'Respect the envelope', detail: 'Clearance and the reserved rear slice are excluded from the usable cargo space.' },
  { title: 'Protect the stack', detail: 'Placed cargo has full base support. Fragile and non-stackable pieces carry no cargo above; loads propagate through the whole stack.' },
  { title: 'Review the real journey', detail: 'Cargo-only mass estimates assume uniform mass in each box. Vehicle axle limits, restraints, door access and transport certification need separate checks.' },
] as const;

function fractionBeforePlane(start: number, extent: number, plane: number): number {
  if (extent <= 0) return 0;
  return Math.max(0, Math.min(1, (plane - start) / extent));
}

function validPlacement(piece: Placement): boolean {
  return [piece.x, piece.y, piece.z, piece.widthCm, piece.heightCm, piece.lengthCm, piece.weightKg].every(Number.isFinite)
    && piece.widthCm > 0 && piece.heightCm > 0 && piece.lengthCm > 0 && piece.weightKg > 0;
}

function groupFor(groups: Map<string, CargoGroupInsights>, itemId: string, name: string): CargoGroupInsights {
  const existing = groups.get(itemId);
  if (existing) return existing;
  const group: CargoGroupInsights = { itemId, name, color: null, requestedCount: 0, packedCount: 0, unplacedCount: 0, packedWeightKg: 0, packedVolumeM3: 0, fragileCount: 0 };
  groups.set(itemId, group);
  return group;
}

function adviceFor(plan: PackingPlan, counts: Record<UnplacedCode, number>, fragileCount: number): PlanAdvice[] {
  const advice: PlanAdvice[] = [];
  if (!plan.valid || plan.errors.length) advice.push({
    id: 'invalid', tone: 'attention', title: 'Correct the inputs',
    detail: 'Review the input errors before using this plan. Rejected cargo is excluded from the packed metrics.',
  });
  if (counts.oversized) advice.push({
    id: 'oversized', tone: 'attention', title: `${counts.oversized} pieces exceed the usable envelope`,
    detail: 'Choose a larger space, reduce clearance only if appropriate, or check the permitted orientations. The rear reserve is unavailable for packing.',
  });
  if (counts.payload) advice.push({
    id: 'payload', tone: 'attention', title: `${counts.payload} pieces exceed available payload`,
    detail: 'Split the shipment or choose a vehicle with sufficient rated cargo payload. A different layout cannot increase the payload allowance.',
  });
  if (counts['no-safe-position']) advice.push({
    id: 'placement', tone: 'attention', title: `${counts['no-safe-position']} pieces need another arrangement`,
    detail: 'Compare packing approaches or use another space. This heuristic did not find a position satisfying support and stacking rules; that does not prove no arrangement exists.',
  });
  if (counts.limit) advice.push({
    id: 'limit', tone: 'attention', title: `${counts.limit} pieces were not evaluated`,
    detail: 'Split the manifest into smaller loads to evaluate the remaining cargo within the interactive piece limit.',
  });
  if (fragileCount) advice.push({
    id: 'fragile', tone: 'info', title: `${fragileCount} fragile pieces protected from top loads`,
    detail: 'Confirm cushioning, handling and restraints separately. The planner prevents cargo above fragile pieces but does not model impact or vibration.',
  });
  advice.push({
    id: 'journey', tone: 'info', title: 'Finish the transport checks',
    detail: 'Review actual axle limits, load restraints and loading access. Mass distribution describes cargo geometry and does not certify vehicle balance or transport safety.',
  });
  return advice;
}

/** Mass is divided by each box's intersecting extent, assuming uniform density. */
export function derivePlanInsights(plan: PackingPlan): PlanInsights {
  const dimensions = usableDimensions(plan.space);
  const usableFloorAreaM2 = dimensions.widthCm * dimensions.lengthCm / CM2_PER_M2;
  const midX = plan.space.clearanceCm + dimensions.widthCm / 2;
  const midZ = plan.space.clearanceCm + dimensions.lengthCm / 2;
  const pieces = plan.placements.filter(validPlacement);
  const groups = new Map<string, CargoGroupInsights>();
  const unplacedByReason: Record<UnplacedCode, number> = { invalid: 0, oversized: 0, payload: 0, 'no-safe-position': 0, limit: 0 };
  let packedWeightKg = 0;
  let packedVolumeM3 = 0;
  let occupiedFloorAreaM2 = 0;
  let maxHeightCm = 0;
  let leftKg = 0;
  let frontKg = 0;
  let floorCount = 0;
  let fragileCount = 0;
  let uprightCount = 0;
  let rotatedCount = 0;
  const moments: Point3 = { x: 0, y: 0, z: 0 };
  for (const piece of pieces) {
    const volumeM3 = piece.widthCm * piece.heightCm * piece.lengthCm / CM3_PER_M3;
    packedWeightKg += piece.weightKg;
    packedVolumeM3 += volumeM3;
    maxHeightCm = Math.max(maxHeightCm, piece.y + piece.heightCm);
    leftKg += piece.weightKg * fractionBeforePlane(piece.x, piece.widthCm, midX);
    frontKg += piece.weightKg * fractionBeforePlane(piece.z, piece.lengthCm, midZ);
    moments.x += piece.weightKg * (piece.x + piece.widthCm / 2);
    moments.y += piece.weightKg * (piece.y + piece.heightCm / 2);
    moments.z += piece.weightKg * (piece.z + piece.lengthCm / 2);
    if (Math.abs(piece.y) <= FLOOR_TOLERANCE_CM) {
      floorCount++;
      occupiedFloorAreaM2 += piece.widthCm * piece.lengthCm / CM2_PER_M2;
    }
    fragileCount += Number(piece.fragile);
    uprightCount += Number(piece.keepUpright);
    rotatedCount += Number(piece.rotated);
    const group = groupFor(groups, piece.itemId, piece.name);
    group.color = piece.color;
    group.packedCount++;
    group.requestedCount++;
    group.packedWeightKg += piece.weightKg;
    group.packedVolumeM3 += volumeM3;
    group.fragileCount += Number(piece.fragile);
  }
  let unplacedCount = 0;
  for (const cargo of plan.unplaced) {
    const count = Number.isFinite(cargo.count) ? Math.max(0, cargo.count) : 0;
    unplacedCount += count;
    unplacedByReason[cargo.code] += count;
    const group = groupFor(groups, cargo.itemId, cargo.name);
    group.unplacedCount += count;
    group.requestedCount += count;
  }
  const centerOfGravity = packedWeightKg ? { x: moments.x / packedWeightKg, y: moments.y / packedWeightKg, z: moments.z / packedWeightKg } : null;
  const rightKg = Math.max(0, packedWeightKg - leftKg);
  const rearKg = Math.max(0, packedWeightKg - frontKg);
  return {
    usableDimensions: dimensions, usableFloorAreaM2, occupiedFloorAreaM2,
    floorUtilization: usableFloorAreaM2 ? occupiedFloorAreaM2 / usableFloorAreaM2 : 0,
    maxHeightCm, heightUtilization: dimensions.heightCm ? maxHeightCm / dimensions.heightCm : 0,
    remainingPayloadKg: Number.isFinite(plan.space.maxPayloadKg) ? Math.max(0, plan.space.maxPayloadKg - packedWeightKg) : 0,
    packedWeightKg, packedVolumeM3, packedCount: pieces.length, unplacedCount, floorCount,
    stackedCount: pieces.length - floorCount, fragileCount, uprightCount, rotatedCount,
    massDistribution: {
      leftKg, rightKg, frontKg, rearKg,
      leftFraction: packedWeightKg ? leftKg / packedWeightKg : 0,
      rightFraction: packedWeightKg ? rightKg / packedWeightKg : 0,
      frontFraction: packedWeightKg ? frontKg / packedWeightKg : 0,
      rearFraction: packedWeightKg ? rearKg / packedWeightKg : 0,
    },
    centerOfGravity,
    centerOffsetCm: centerOfGravity ? { x: centerOfGravity.x - midX, z: centerOfGravity.z - midZ } : null,
    groups: [...groups.values()], unplacedByReason,
    advice: adviceFor(plan, unplacedByReason, fragileCount),
  };
}
