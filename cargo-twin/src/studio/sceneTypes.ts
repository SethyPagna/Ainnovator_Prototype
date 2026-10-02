import type { Point3, TransportMode } from './model';

export type SceneColorMode = 'cargo' | 'weight' | 'handling';
export type SceneView = 'perspective' | 'top' | 'side';

export interface SceneSpace {
  widthCm: number;
  heightCm: number;
  lengthCm: number;
  reservedDepthCm: number;
  clearanceCm: number;
  mode?: TransportMode;
}

export interface ScenePiece extends Point3 {
  id: string;
  itemId: string;
  name: string;
  color: string;
  fragile: boolean;
  keepUpright?: boolean;
  weightKg?: number;
  widthCm: number;
  heightCm: number;
  lengthCm: number;
}

export interface SceneProps {
  space: SceneSpace;
  pieces: ScenePiece[];
  selectedId: string | null;
  visibleCount: number;
  view: SceneView;
  centerOfGravity?: Point3 | null;
  showCenter: boolean;
  showShell?: boolean;
  showLabels?: boolean;
  colorMode?: SceneColorMode;
  exploded?: boolean;
  resetKey?: number;
  onSelect: (id: string) => void;
}
