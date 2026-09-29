import { describe, expect, it } from 'vitest';
import type { Shipment } from '../src/domain/cargo';
import { awbCheckDigit, chargeableWeight, formatAwb, isValidAwb } from '../src/domain/cargo';
import { acceptsRegime, coloadConflict, dgSegregationRequired, needsActiveControl, preferredRegime, typeEligibility } from '../src/domain/rules';
import { uldType } from '../src/domain/uld';

const base: Shipment = { id: 'A', awb: '', description: '', origin: 'HKG', dest: 'LAX', pieces: 1, l: 50, w: 50, h: 50, weight: 20, shc: ['GEN'], orientation: 'any', maxTopLoad: 50 };
const ship = (p: Partial<Shipment>): Shipment => ({ ...base, ...p });

describe('DGR segregation (Table 9.3.A, simplified)', () => {
  it('segregates the pairs in the table', () => {
    expect(dgSegregationRequired('3', '5.1')).toBe(true);
    expect(dgSegregationRequired('5.1', '4.2')).toBe(true);
    expect(dgSegregationRequired('4.3', '8')).toBe(true);
    expect(dgSegregationRequired('2.1', '1.4S')).toBe(false); // 1.4S exempt
  });
  it('does not segregate classes outside the table', () => {
    expect(dgSegregationRequired('9', '3')).toBe(false);
    expect(dgSegregationRequired('6.1', '8')).toBe(false);
    expect(dgSegregationRequired('2.1', '5.1')).toBe(false);
  });
  it('blocks co-loading of incompatible DG, toxic with food, dry ice with animals, VAL with general', () => {
    const paint = ship({ id: 'P', dg: { un: 'UN1263', cls: '3', psn: 'Paint', cao: false } });
    const ox = ship({ id: 'O', dg: { un: 'UN1479', cls: '5.1', psn: 'Oxidizing solid', cao: false } });
    const tox = ship({ id: 'T', dg: { un: 'UN2588', cls: '6.1', psn: 'Pesticide', cao: false } });
    const food = ship({ id: 'F', shc: ['EAT'] });
    const ice = ship({ id: 'I', shc: ['DGR', 'ICE'], dg: { un: 'UN1845', cls: '9', psn: 'Dry ice', cao: false } });
    const avi = ship({ id: 'V', shc: ['AVI'] });
    const val = ship({ id: 'L', shc: ['VAL'] });
    expect(coloadConflict(paint, ox)).toMatch(/segregation/i);
    expect(coloadConflict(tox, food)).toMatch(/foodstuffs/i);
    expect(coloadConflict(ice, avi)).toMatch(/dry ice/i);
    expect(coloadConflict(val, base)).toMatch(/valuable/i);
    expect(coloadConflict(paint, food)).toBeNull();
  });
});

describe('temperature regimes', () => {
  it('matches shipments to regimes by containment of the band', () => {
    const col = ship({ shc: ['COL'], temp: { min: 2, max: 8 } });
    const ert = ship({ shc: ['ERT'], temp: { min: 2, max: 25 } });
    const fro = ship({ shc: ['FRO'], temp: { min: -25, max: -18 } });
    expect(acceptsRegime(col, 'COL')).toBe(true);
    expect(acceptsRegime(col, 'CRT')).toBe(false);
    expect(acceptsRegime(col, 'AMB')).toBe(false);
    expect(acceptsRegime(ert, 'COL') && acceptsRegime(ert, 'CRT')).toBe(true);
    expect(preferredRegime(fro)).toBe('FRO');
    expect(acceptsRegime(base, 'AMB')).toBe(true);
    expect(acceptsRegime(base, 'COL')).toBe(false);
    expect(preferredRegime(ship({ temp: { min: 10, max: 12 } }))).toBeNull();
  });
  it('requires active control for frozen goods and cold-chain pharma, not for perishables', () => {
    expect(needsActiveControl(ship({ shc: ['PIL', 'COL'], temp: { min: 2, max: 8 } }))).toBe(true);
    expect(needsActiveControl(ship({ shc: ['FRO'], temp: { min: -25, max: -18 } }))).toBe(true);
    expect(needsActiveControl(ship({ shc: ['PER', 'COL'], temp: { min: 2, max: 8 } }))).toBe(false);
  });
  it('reserves RKN for active loads and keeps VAL in lockable containers', () => {
    expect(typeEligibility(base, uldType('RKN'), 'AMB', false)).toMatch(/reserved/);
    expect(typeEligibility(ship({ shc: ['PIL', 'COL'] }), uldType('AKE'), 'COL', true)).toMatch(/active/);
    expect(typeEligibility(ship({ shc: ['VAL'] }), uldType('PMC-Q6'), 'AMB', false)).toMatch(/lockable/);
    expect(typeEligibility(ship({ shc: ['VAL'] }), uldType('AKE'), 'AMB', false)).toBeNull();
  });
});

describe('AWB and chargeable weight', () => {
  it('uses the mod-7 check digit', () => {
    expect(awbCheckDigit(1234567)).toBe(1234567 % 7);
    const awb = formatAwb('000', 5230238);
    expect(isValidAwb(awb)).toBe(true);
    expect(isValidAwb(awb.slice(0, -1) + ((Number(awb.slice(-1)) + 1) % 10))).toBe(false);
  });
  it('takes the greater of actual and volumetric weight (6000 cm3/kg)', () => {
    // 10 x 60x40x40 cm = 0.96 m3 -> 160 kg volumetric vs 110 kg actual
    expect(chargeableWeight(ship({ pieces: 10, l: 60, w: 40, h: 40, weight: 11 }))).toBe(160);
    expect(chargeableWeight(ship({ pieces: 2, l: 100, w: 100, h: 60, weight: 1100 }))).toBe(2200);
  });
});
