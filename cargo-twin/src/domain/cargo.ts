// Cargo model: shipments (air waybills) made of identical pieces.
// Units: cm, kg, deg C.

export type Shc =
  | 'GEN' // general cargo (no special handling)
  | 'PER' // perishable
  | 'PES' // fish / seafood
  | 'PEF' // flowers
  | 'EAT' // foodstuffs
  | 'PIL' // pharmaceuticals
  | 'COL' // cool goods +2..+8 C
  | 'CRT' // controlled room temperature +15..+25 C
  | 'ERT' // extended room temperature +2..+25 C
  | 'FRO' // frozen
  | 'DGR' // dangerous goods
  | 'RLI' // fully regulated lithium-ion batteries (UN3480 / UN3481)
  | 'ICE' // dry ice UN1845
  | 'CAO' // cargo aircraft only
  | 'AVI' // live animals
  | 'VAL' // valuable cargo
  | 'HEA' // heavy (single piece >= 150 kg)
  | 'BIG' // outsized
  | 'FRG'; // fragile handling label (not an IATA SHC - used here as a handling flag)

export interface ShcInfo {
  code: Shc;
  label: string;
  group: 'temp' | 'dg' | 'special' | 'handling' | 'general';
  official: boolean;
}

export const SHC_INFO: Record<Shc, ShcInfo> = {
  GEN: { code: 'GEN', label: 'General cargo', group: 'general', official: false },
  PER: { code: 'PER', label: 'Perishable', group: 'temp', official: true },
  PES: { code: 'PES', label: 'Fish / seafood', group: 'temp', official: true },
  PEF: { code: 'PEF', label: 'Flowers', group: 'temp', official: true },
  EAT: { code: 'EAT', label: 'Foodstuffs', group: 'special', official: true },
  PIL: { code: 'PIL', label: 'Pharmaceuticals', group: 'temp', official: true },
  COL: { code: 'COL', label: 'Cool goods +2..+8 °C', group: 'temp', official: true },
  CRT: { code: 'CRT', label: 'Controlled room temp +15..+25 °C', group: 'temp', official: true },
  ERT: { code: 'ERT', label: 'Extended room temp +2..+25 °C', group: 'temp', official: true },
  FRO: { code: 'FRO', label: 'Frozen', group: 'temp', official: true },
  DGR: { code: 'DGR', label: 'Dangerous goods', group: 'dg', official: true },
  RLI: { code: 'RLI', label: 'Lithium-ion batteries (fully regulated)', group: 'dg', official: true },
  ICE: { code: 'ICE', label: 'Dry ice UN1845', group: 'dg', official: true },
  CAO: { code: 'CAO', label: 'Cargo aircraft only', group: 'dg', official: true },
  AVI: { code: 'AVI', label: 'Live animals', group: 'special', official: true },
  VAL: { code: 'VAL', label: 'Valuable cargo', group: 'special', official: true },
  HEA: { code: 'HEA', label: 'Heavy cargo (≥150 kg/pc)', group: 'handling', official: true },
  BIG: { code: 'BIG', label: 'Outsized', group: 'handling', official: true },
  FRG: { code: 'FRG', label: 'Fragile (handling label)', group: 'handling', official: false },
};

export type DgClass =
  | '1.4S' | '2.1' | '2.2' | '2.3' | '3' | '4.1' | '4.2' | '4.3' | '5.1' | '5.2' | '6.1' | '6.2' | '7' | '8' | '9';

export interface DgInfo {
  un: string; // e.g. 'UN3480'
  cls: DgClass;
  psn: string; // proper shipping name
  cao: boolean; // cargo aircraft only
  pi?: string; // packing instruction
}

export type Orientation = 'any' | 'upright' | 'fixed';

export interface Shipment {
  id: string;
  awb: string;
  description: string;
  origin: string;
  dest: string;
  pieces: number;
  /** per-piece dimensions (cm) */
  l: number;
  w: number;
  h: number;
  /** per-piece gross weight (kg) */
  weight: number;
  shc: Shc[];
  temp?: { min: number; max: number };
  dg?: DgInfo;
  orientation: Orientation;
  /** Max weight that may rest on top of one piece (kg). 0 = non-stackable. */
  maxTopLoad: number;
  priority?: 'normal' | 'express';
}

export interface Piece {
  id: string; // shipmentId#n
  shipmentId: string;
  index: number;
  l: number;
  w: number;
  h: number;
  weight: number;
}

export interface Manifest {
  id: string;
  name: string;
  flight: string;
  route: { from: string; to: string };
  aircraftId: string;
  blockFuel: number; // kg
  tripFuel: number; // kg
  description: string;
  shipments: Shipment[];
}

export function piecesOf(s: Shipment): Piece[] {
  const out: Piece[] = [];
  for (let i = 0; i < s.pieces; i++) {
    out.push({ id: `${s.id}#${i + 1}`, shipmentId: s.id, index: i + 1, l: s.l, w: s.w, h: s.h, weight: s.weight });
  }
  return out;
}

export function allPieces(m: { shipments: Shipment[] }): Piece[] {
  return m.shipments.flatMap(piecesOf);
}

/** IATA volumetric divisor: 6000 cm3 per kg. */
export const VOLUMETRIC_DIVISOR = 6000;

export function shipmentVolumeM3(s: Shipment): number {
  return (s.l * s.w * s.h * s.pieces) / 1e6;
}

export function shipmentGross(s: Shipment): number {
  return s.weight * s.pieces;
}

/** Chargeable weight = max(actual gross, volumetric), rounded up to the next 0.5 kg. */
export function chargeableWeight(s: Shipment): number {
  const vol = (s.l * s.w * s.h * s.pieces) / VOLUMETRIC_DIVISOR;
  return Math.ceil(Math.max(shipmentGross(s), vol) * 2) / 2;
}

export function hasShc(s: Shipment, c: Shc): boolean {
  return s.shc.includes(c);
}

/** AWB serial check digit: the 8th digit is the first 7 digits modulo 7. */
export function awbCheckDigit(serial7: number): number {
  return serial7 % 7;
}

export function formatAwb(prefix: string, serial7: number): string {
  const s = String(serial7).padStart(7, '0');
  const full = `${s}${awbCheckDigit(serial7)}`;
  return `${prefix}-${full.slice(0, 4)} ${full.slice(4)}`;
}

export function isValidAwb(awb: string): boolean {
  const m = /^(\d{3})-?(\d{4})\s?(\d{4})$/.exec(awb.trim());
  if (!m) return false;
  const digits = m[2] + m[3];
  const serial = Number(digits.slice(0, 7));
  return Number(digits[7]) === awbCheckDigit(serial);
}
