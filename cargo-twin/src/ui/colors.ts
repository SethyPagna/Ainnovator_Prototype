import type { Shipment } from '../domain/cargo';
import { preferredRegime } from '../domain/rules';

// Categorical slots validated for the dark surface (#0f1c1f): CVD adjacent dE >= 8.4, normal >= 19.3.
export const SERIES = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'];

export const STATUS = { good: '#0ca30c', warning: '#fab219', serious: '#ec835a', critical: '#d03b3b' };

export type ColorMode = 'shipment' | 'handling' | 'weight' | 'temperature';

export const COLOR_MODES: { id: ColorMode; label: string }[] = [
  { id: 'handling', label: 'Handling' },
  { id: 'shipment', label: 'Shipment' },
  { id: 'weight', label: 'Weight' },
  { id: 'temperature', label: 'Temperature' },
];

function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t);
  const g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t);
  const bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`;
}

/** Shipment identity: 8 validated hues, then lighter/darker variants of the same hues (composite encoding). */
export function shipmentColor(index: number): string {
  const base = SERIES[index % SERIES.length];
  const tier = Math.floor(index / SERIES.length) % 3;
  if (tier === 0) return base;
  return tier === 1 ? mix(base, '#ffffff', 0.35) : mix(base, '#000000', 0.3);
}

export interface HandlingClass {
  key: 'dg' | 'cold' | 'perishable' | 'special' | 'fragile' | 'heavy' | 'general';
  label: string;
  color: string;
}

export const HANDLING: HandlingClass[] = [
  { key: 'dg', label: 'Dangerous goods', color: '#d95926' },
  { key: 'cold', label: 'Cold chain / pharma', color: '#3987e5' },
  { key: 'perishable', label: 'Perishable / food', color: '#199e70' },
  { key: 'special', label: 'VAL / AVI', color: '#9085e9' },
  { key: 'fragile', label: 'Fragile / top-only', color: '#d55181' },
  { key: 'heavy', label: 'Heavy ≥1 t / outsized', color: '#c98500' },
  { key: 'general', label: 'General cargo', color: '#8ea3a6' },
];

export function handlingOf(s: Shipment): HandlingClass {
  const k = (key: HandlingClass['key']) => HANDLING.find((h) => h.key === key)!;
  if (s.dg || s.shc.includes('DGR')) return k('dg');
  if (s.shc.some((c) => ['COL', 'FRO', 'CRT', 'PIL', 'ERT'].includes(c))) return k('cold');
  if (s.shc.some((c) => ['PER', 'PES', 'PEF', 'EAT'].includes(c))) return k('perishable');
  if (s.shc.includes('VAL') || s.shc.includes('AVI')) return k('special');
  if (s.shc.includes('FRG') || s.maxTopLoad <= 0) return k('fragile');
  if (s.shc.includes('BIG') || s.weight >= 1000) return k('heavy');
  return k('general');
}

/** Sequential single-hue (blue) ramp: dim for light pieces, bright for heavy ones (dark scene). */
const WEIGHT_STOPS = ['#184f95', '#256abf', '#3987e5', '#6da7ec', '#9ec5f4', '#cde2fb'];
export function weightColor(t: number): string {
  const x = Math.max(0, Math.min(1, t)) * (WEIGHT_STOPS.length - 1);
  const i = Math.min(WEIGHT_STOPS.length - 2, Math.floor(x));
  return mix(WEIGHT_STOPS[i], WEIGHT_STOPS[i + 1], x - i);
}
export const WEIGHT_RAMP = WEIGHT_STOPS;

export const TEMP_CLASSES = [
  { key: 'FRO', label: 'Frozen ≤ −18 °C', color: '#3987e5' },
  { key: 'COL', label: 'Cool +2..+8 °C', color: '#86b6ef' },
  { key: 'CRT', label: 'Room +15..+25 °C', color: '#e66767' },
  { key: 'AMB', label: 'Ambient', color: '#5d6d70' },
];

export function tempColor(s: Shipment): string {
  const r = preferredRegime(s) ?? 'AMB';
  return TEMP_CLASSES.find((t) => t.key === r)?.color ?? '#5d6d70';
}

export const DG_LABEL_COLORS: Record<string, { bg: string; fg: string; top?: string }> = {
  '1.4S': { bg: '#f08c00', fg: '#111' },
  '2.1': { bg: '#d62d2d', fg: '#fff' },
  '2.2': { bg: '#2e8b3d', fg: '#fff' },
  '2.3': { bg: '#f4f4f4', fg: '#111' },
  '3': { bg: '#d62d2d', fg: '#fff' },
  '4.1': { bg: '#d62d2d', fg: '#111', top: 'stripes' },
  '4.2': { bg: '#d62d2d', fg: '#111', top: '#f4f4f4' },
  '4.3': { bg: '#1f5fbf', fg: '#fff' },
  '5.1': { bg: '#f4d21f', fg: '#111' },
  '5.2': { bg: '#d62d2d', fg: '#111', top: '#f4d21f' },
  '6.1': { bg: '#f4f4f4', fg: '#111' },
  '6.2': { bg: '#f4f4f4', fg: '#111' },
  '7': { bg: '#f4d21f', fg: '#111', top: '#f4f4f4' },
  '8': { bg: '#f4f4f4', fg: '#fff', top: '#f4f4f4' },
  '9': { bg: '#f4f4f4', fg: '#111', top: 'stripes9' },
};
