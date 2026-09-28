import type { DgClass, Shipment, Shc } from './cargo';
import type { UldType } from './uld';

// ---------------------------------------------------------------------------------------
// Temperature regimes
// ---------------------------------------------------------------------------------------

export type TempRegime = 'AMB' | 'CRT' | 'COL' | 'FRO';

export const REGIME_BAND: Record<TempRegime, { min: number; max: number } | null> = {
  AMB: null,
  CRT: { min: 15, max: 25 },
  COL: { min: 2, max: 8 },
  FRO: { min: -25, max: -18 },
};

export const REGIME_SETPOINT: Record<TempRegime, number | null> = { AMB: null, CRT: 20, COL: 5, FRO: -20 };

export const REGIME_LABEL: Record<TempRegime, string> = {
  AMB: 'Ambient',
  CRT: 'CRT +15..+25 °C',
  COL: 'COL +2..+8 °C',
  FRO: 'FRO ≤ -18 °C',
};

/** Temperature range a shipment tolerates (explicit range wins over the SHC default). */
export function tempRange(s: Pick<Shipment, 'temp' | 'shc'>): { min: number; max: number } | null {
  if (s.temp) return s.temp;
  if (s.shc.includes('FRO')) return { min: -30, max: -18 };
  if (s.shc.includes('COL')) return { min: 2, max: 8 };
  if (s.shc.includes('CRT')) return { min: 15, max: 25 };
  if (s.shc.includes('ERT')) return { min: 2, max: 25 };
  return null;
}

export function acceptsRegime(s: Pick<Shipment, 'temp' | 'shc'>, regime: TempRegime): boolean {
  const r = tempRange(s);
  if (!r) return regime === 'AMB';
  const band = REGIME_BAND[regime];
  if (!band) return false; // temperature-controlled goods never go uncontrolled
  return r.min <= band.min + 1e-9 && r.max >= band.max - 1e-9;
}

/** Preferred regime for a shipment (the tightest band it accepts, warmest first for ERT). */
export function preferredRegime(s: Pick<Shipment, 'temp' | 'shc'>): TempRegime | null {
  if (!tempRange(s)) return 'AMB';
  for (const r of ['FRO', 'COL', 'CRT'] as TempRegime[]) if (acceptsRegime(s, r)) return r === 'COL' && acceptsRegime(s, 'CRT') ? 'CRT' : r;
  return null; // range does not match any supported band
}

/**
 * Active (powered) temperature control is required for frozen goods and for cold-chain
 * pharmaceuticals (GDP); perishables such as fish or flowers may travel passive under a
 * thermal cover in a temperature-set compartment.
 */
export function needsActiveControl(s: Pick<Shipment, 'temp' | 'shc'>): boolean {
  const reg = preferredRegime(s);
  if (reg === 'FRO') return true;
  if (reg === 'COL' && s.shc.includes('PIL')) return true;
  return false;
}

// ---------------------------------------------------------------------------------------
// Dangerous goods segregation (simplified from IATA DGR Table 9.3.A)
// ---------------------------------------------------------------------------------------

const SEGREGATION: Partial<Record<string, string[]>> = {
  '1': ['2', '3', '4.2', '4.3', '5.1', '5.2', '8'],
  '2': ['1'],
  '3': ['1', '5.1'],
  '4.2': ['1', '5.1'],
  '4.3': ['1', '8'],
  '5.1': ['1', '3', '4.2'],
  '5.2': ['1'],
  '8': ['1', '4.3'],
};

/** Map a class/division to the label group used in the segregation table. */
function segGroup(cls: DgClass): string | null {
  if (cls === '1.4S') return null; // 1.4S is exempt from segregation
  if (cls.startsWith('2')) return '2';
  if (cls === '3' || cls === '4.2' || cls === '4.3' || cls === '5.1' || cls === '5.2' || cls === '8') return cls;
  return null; // 4.1, 6, 7 and 9 are not in Table 9.3.A
}

export function dgSegregationRequired(a: DgClass, b: DgClass): boolean {
  const ga = segGroup(a);
  const gb = segGroup(b);
  if (!ga || !gb) return false;
  return (SEGREGATION[ga] ?? []).includes(gb) || (SEGREGATION[gb] ?? []).includes(ga);
}

const FOOD_OR_ANIMAL: Shc[] = ['EAT', 'PER', 'PES', 'PEF', 'AVI'];

/**
 * Can shipments a and b share one ULD? Returns null when compatible, or a human-readable reason.
 * Rules (simplified): DGR Table 9.3.A segregation; toxic (6.1) / infectious (6.2) substances
 * separated from foodstuffs and live animals; dry ice not with live animals; VAL and AVI travel
 * in dedicated ULDs.
 */
export function coloadConflict(a: Shipment, b: Shipment): string | null {
  if (a.id === b.id) return null;
  if (a.dg && b.dg && dgSegregationRequired(a.dg.cls, b.dg.cls)) {
    return `DGR segregation: Class ${a.dg.cls} (${a.dg.un}) and Class ${b.dg.cls} (${b.dg.un}) may not share a ULD (Table 9.3.A)`;
  }
  const toxic = (s: Shipment) => !!s.dg && (s.dg.cls === '6.1' || s.dg.cls === '6.2');
  const foodish = (s: Shipment) => s.shc.some((c) => FOOD_OR_ANIMAL.includes(c));
  if ((toxic(a) && foodish(b)) || (toxic(b) && foodish(a))) {
    return 'Toxic / infectious substances must be separated from foodstuffs and live animals';
  }
  const ice = (s: Shipment) => s.shc.includes('ICE') || s.dg?.un === 'UN1845';
  const avi = (s: Shipment) => s.shc.includes('AVI');
  if ((ice(a) && avi(b)) || (ice(b) && avi(a))) return 'Dry ice (UN1845) must not be loaded with live animals';
  if (avi(a) !== avi(b)) return 'Live animals travel in a dedicated, ventilated ULD';
  const val = (s: Shipment) => s.shc.includes('VAL');
  if (val(a) !== val(b)) return 'Valuable cargo travels in a dedicated, sealed ULD';
  return null;
}

/** Adjacent-position check used by the aircraft planner (warnings, not hard rules). */
export function adjacencyConflict(a: Shipment[], b: Shipment[]): string | null {
  for (const x of a) {
    for (const y of b) {
      if (x.dg && y.dg && dgSegregationRequired(x.dg.cls, y.dg.cls)) {
        return `Class ${x.dg.cls} next to Class ${y.dg.cls}: keep incompatible DG ULDs apart`;
      }
      const ice = (s: Shipment) => s.shc.includes('ICE');
      const avi = (s: Shipment) => s.shc.includes('AVI');
      if ((ice(x) && avi(y)) || (ice(y) && avi(x))) return 'Dry ice ULD next to live animals';
    }
  }
  return null;
}

// ---------------------------------------------------------------------------------------
// ULD type eligibility
// ---------------------------------------------------------------------------------------

export function isCao(s: Shipment): boolean {
  return !!s.dg?.cao || s.shc.includes('CAO');
}

/** Can this shipment be built on/in this ULD type at all (before geometry)? */
export function typeEligibility(s: Shipment, t: UldType, regime: TempRegime, active: boolean): string | null {
  if (active && !t.active) return 'needs an active temperature-controlled ULD';
  if (!active && t.active) return 'active containers are reserved for cold-chain cargo';
  if (t.active && (regime !== 'AMB') && (REGIME_SETPOINT[regime]! < t.active.min || REGIME_SETPOINT[regime]! > t.active.max)) {
    return 'setpoint outside the unit range';
  }
  if (s.shc.includes('VAL') && t.kind !== 'container') return 'valuables require a lockable container';
  if (s.shc.includes('AVI') && t.kind !== 'pallet') return 'live animals need a ventilated pallet build';
  return null;
}
