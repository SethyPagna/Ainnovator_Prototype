export type TransportMode = 'road' | 'sea' | 'air' | 'rail' | 'custom';
export type PackingStrategy = 'max-fill' | 'balanced' | 'gentle';
export type CargoPriority = 'low' | 'normal' | 'high';

export interface SpaceConfig {
  id: string;
  name: string;
  mode: TransportMode;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  maxPayloadKg: number;
  clearanceCm: number;
  reservedDepthCm: number;
}

export interface CargoItem {
  id: string;
  name: string;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  weightKg: number;
  quantity: number;
  fragile: boolean;
  keepUpright: boolean;
  stackable: boolean;
  maxTopLoadKg: number;
  priority: CargoPriority;
  color: string;
}

/** Centimetres: x crosses the width, y points up, z follows the length. */
export interface Point3 { x: number; y: number; z: number }

export interface Placement extends Point3 {
  id: string;
  itemId: string;
  unitIndex: number;
  sequence: number;
  name: string;
  color: string;
  widthCm: number;
  heightCm: number;
  lengthCm: number;
  weightKg: number;
  fragile: boolean;
  keepUpright: boolean;
  stackable: boolean;
  maxTopLoadKg: number;
  loadOnTopKg: number;
  supportRatio: number;
  supportIds: string[];
  rotated: boolean;
}

export type UnplacedCode = 'invalid' | 'oversized' | 'payload' | 'no-safe-position' | 'limit';
export interface UnplacedCargo {
  itemId: string;
  name: string;
  count: number;
  code: UnplacedCode;
  reason: string;
}

export interface PackingStats {
  requestedCount: number;
  packedCount: number;
  unplacedCount: number;
  requestedWeightKg: number;
  packedWeightKg: number;
  totalVolumeM3: number;
  usableVolumeM3: number;
  packedVolumeM3: number;
  emptyVolumeM3: number;
  /** Fractions from 0 to 1, with clearance and the reserved rear slice excluded. */
  volumeUtilization: number;
  payloadUtilization: number;
  centerOfGravity: Point3 | null;
}

export interface PackingPlan {
  strategy: PackingStrategy;
  space: SpaceConfig;
  valid: boolean;
  placements: Placement[];
  unplaced: UnplacedCargo[];
  stats: PackingStats;
  errors: string[];
  warnings: string[];
  explanation: string;
}

export interface CargoScenario {
  id: string;
  name: string;
  description: string;
  spaceId: string;
  items: CargoItem[];
}

export const STRATEGIES: { id: PackingStrategy; name: string; description: string }[] = [
  { id: 'max-fill', name: 'Max fill', description: 'Compare deterministic packing orders and keep the highest packed volume.' },
  { id: 'balanced', name: 'Balanced', description: 'Prefer low, centrally distributed weight while retaining priority cargo.' },
  { id: 'gentle', name: 'Gentle', description: 'Prefer low stacks and place delicate cargo after sturdy support boxes.' },
];

export const MAX_CARGO_PIECES = 400;
