import { describe, expect, it } from 'vitest';
import { MAX_CARGO_PIECES, type CargoItem, type SpaceConfig } from '../src/studio/model';
import { packCargo } from '../src/studio/packing';
import { createPlanReport, exportCargoCsv, exportPlanCsv, parseCargoCsv } from '../src/studio/reports';
import type { StudioDocument } from '../src/studio/projects';

const space: SpaceConfig = { id: 'test', name: 'Test load space', mode: 'custom', lengthCm: 100, widthCm: 100, heightCm: 100, maxPayloadKg: 25, clearanceCm: 0, reservedDepthCm: 0 };
const cargo = (overrides: Partial<CargoItem> = {}): CargoItem => ({ id: 'box', name: 'Box', lengthCm: 40, widthCm: 40, heightCm: 40, weightKg: 10, quantity: 1, fragile: false, keepUpright: true, stackable: true, maxTopLoadKg: 100, priority: 'normal', color: '#77ddbb', ...overrides });
const document = (items: CargoItem[] = [cargo()]): StudioDocument => ({ name: 'Morning load', space: { ...space }, items, strategy: 'max-fill' });
const headers = 'name,lengthCm,widthCm,heightCm,weightKg,quantity';

describe('cargo CSV interchange', () => {
  it('accepts conventional headers, CRLF, BOM, quoted commas and escaped quotes', () => {
    const csv = `\uFEFF${headers},fragile,keepUpright,stackable,maxTopLoadKg,priority,color\r\n"Glass, \"\"premium\"\"",60,40,30,12,2,yes,true,no,0,high,#F4B36B\r\n`;
    const items = parseCargoCsv(csv);
    expect(items).toHaveLength(1);
    expect(items[0]).toEqual(cargo({ id: 'cargo-1', name: 'Glass, "premium"', lengthCm: 60, widthCm: 40, heightCm: 30, weightKg: 12, quantity: 2, fragile: true, stackable: false, maxTopLoadKg: 0, priority: 'high', color: '#F4B36B' }));
  });

  it('uses explicit conservative defaults for optional handling columns', () => {
    const items = parseCargoCsv(`${headers}\nSmall box,10,20,30,2,4\n\n`);
    expect(items[0]).toMatchObject({ fragile: false, keepUpright: false, stackable: true, maxTopLoadKg: 0, priority: 'normal', quantity: 4 });
    expect(items[0].color).toMatch(/^#[\da-f]{6}$/i);
  });

  it('round-trips IDs, decimal dimensions, unicode names and handling rules', () => {
    const items = [cargo({ id: 'fragile-case', name: '東京, "glass"', lengthCm: 40.5, fragile: true, stackable: false, maxTopLoadKg: 0, priority: 'high' }), cargo({ id: 'second', name: '工具', quantity: 3, keepUpright: false })];
    expect(parseCargoCsv(exportCargoCsv(items))).toEqual(items);
    expect(exportCargoCsv([]).split('\r\n')).toHaveLength(1);
    expect(parseCargoCsv(exportCargoCsv([]))).toEqual([]);
  });

  it.each([
    ['', /empty/],
    ['name,lengthCm\nBox,10', /missing required/],
    [`${headers},quantity\nBox,1,1,1,1,1,1`, /duplicate/],
    [`${headers},wieghtKg\nBox,1,1,1,1,1,1`, /unknown column/],
    [`${headers}\nBox,1,1,1,1`, /CSV row 2.*expected 6/],
    [`${headers}\n"Box,1,1,1,1,1`, /not closed/],
    [`${headers}\n"Box"oops,1,1,1,1,1`, /unexpected text/],
    [`${headers}\nBox,1,1,1,Infinity,1`, /CSV row 2 weightKg/],
    [`${headers}\nBox,1,1,1,10 kg,1`, /CSV row 2 weightKg/],
    [`${headers}\nBox,1,1,1,1,1.5`, /CSV row 2.*whole number/],
    [`${headers},fragile\nBox,1,1,1,1,1,sometimes`, /CSV row 2 fragile/],
    [`${headers},color\nBox,1,1,1,1,1,url\(x\)`, /CSV row 2.*color/],
    [`${headers}\n"Box\nwith newline",1,1,1,1,1`, /CSV row 2.*printable/],
  ] as const)('rejects malformed CSV with a helpful location: %s', (csv, error) => {
    expect(() => parseCargoCsv(csv)).toThrow(error);
  });

  it('reports physical row numbers after blank lines and accepts numeric scientific notation', () => {
    expect(parseCargoCsv(`${headers}\n\nBox,1e2,20,30,1.5e1,2`)[0].weightKg).toBe(15);
    expect(() => parseCargoCsv(`${headers}\n\nBox,100,20,30,bad,2`)).toThrow(/CSV row 3 weightKg/);
  });

  it('rejects duplicate explicit IDs and bounds rows before expanding quantities', () => {
    expect(() => parseCargoCsv(`id,${headers}\nsame,First,1,1,1,1,1\nsame,Second,1,1,1,1,1`)).toThrow(/duplicate ID/);
    const csv = [headers, ...Array.from({ length: MAX_CARGO_PIECES + 1 }, (_, index) => `Box ${index},1,1,1,1,1`)].join('\n');
    expect(() => parseCargoCsv(csv)).toThrow(/more than 400/);
    expect(parseCargoCsv(`${headers}\nBox,1,1,1,1,10000`)[0].quantity).toBe(10000);
  });

  it('neutralizes spreadsheet formulas in exported user text', () => {
    const csv = exportCargoCsv([cargo({ name: '=HYPERLINK("https://example.invalid")' })]);
    expect(csv).toContain("'=HYPERLINK");
    const plan = packCargo(space, [cargo({ name: '@SUM(1+1)' })]);
    expect(exportPlanCsv(plan)).toContain("'@SUM(1+1)");
  });
});

describe('load plan export and printable report', () => {
  it('exports packed coordinates and unplaced reasons in one labeled CSV', () => {
    const items = [cargo({ quantity: 3 })];
    const plan = packCargo(space, items);
    const lines = exportPlanCsv(plan).split('\r\n');
    expect(lines).toHaveLength(4);
    expect(lines[0]).toContain('xCm,yCm,zCm');
    expect(lines[0]).toContain('reasonCode,reason');
    expect(lines[1]).toContain('packed,1,box#1,box,Box,1,');
    expect(lines[3]).toContain('unplaced,,,box,Box,');
    expect(lines[3]).toContain('1,payload,');
  });

  it('prints the single piece and last unit using the planner’s one-based unit numbers', () => {
    const single = document();
    expect(createPlanReport(single, packCargo(single.space, single.items))).toContain('<td>Box / 1</td>');
    const multiple = document([cargo({ quantity: 2 })]);
    const report = createPlanReport(multiple, packCargo(multiple.space, multiple.items));
    expect(report).toContain('<td>Box / 2</td>');
    expect(report).not.toContain('<td>Box / 3</td>');
  });

  it('recomputes true packed statistics and excludes unplaced weight and volume', () => {
    const current = document([cargo({ quantity: 3 })]);
    const plan = packCargo(current.space, current.items);
    plan.stats.packedCount = 999;
    plan.stats.packedWeightKg = 999;
    plan.stats.volumeUtilization = 999;
    const report = createPlanReport(current, plan);
    expect(report).toContain('<strong>2 / 3</strong>');
    expect(report).toContain('<strong>20 kg</strong>');
    expect(report).toContain('30 kg requested');
    expect(report).toContain('<strong>12.8%</strong>');
    expect(report).toContain('Unplaced cargo · 1 pieces');
    expect(report).not.toContain('999');
  });

  it('reports an empty manifest without a fictional centre of mass', () => {
    const current = document([]);
    const report = createPlanReport(current, packCargo(current.space, current.items));
    expect(report).toContain('No loaded cargo');
    expect(report).toContain('<strong>0 / 0</strong>');
    expect(report).toContain('All requested cargo was placed.');
  });

  it('uses usable volume after clearance and the rear reserve, with explicit planning limitations', () => {
    const current = document();
    current.space = { ...space, clearanceCm: 5, reservedDepthCm: 10 };
    const report = createPlanReport(current, packCargo(current.space, current.items));
    expect(report).toContain('Usable: 80 × 90 × 95 cm');
    expect(report).toContain('Reserved rear slice: 10 cm');
    expect(report).toContain('at most 400 eligible pieces');
    expect(report).toContain('real axle limits');
    expect(report).toContain('collision-free loading path is not simulated');
    expect(report).toContain('Print / save PDF');
  });

  it('escapes project names, cargo names and report notes including unplaced user text', () => {
    const current = document([cargo({ name: '<img src=x onerror="alert(1)">', quantity: 3 })]);
    current.name = '<script>alert("project")</script>';
    current.space.name = 'Space & "friends"';
    const plan = packCargo(current.space, current.items);
    plan.explanation = '<script>alert("explanation")</script>';
    plan.warnings.push('<iframe src="bad"></iframe>');
    const report = createPlanReport(current, plan);
    expect(report).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
    expect(report).toContain('&lt;script&gt;alert(&quot;project&quot;)&lt;/script&gt;');
    expect(report).toContain('Space &amp; &quot;friends&quot;');
    expect(report).toContain('&lt;iframe');
    expect(report).not.toContain('<script>');
    expect(report).not.toContain('<img');
    expect(report).not.toContain('<iframe');
  });

  it('refuses stale reports after dimensions, quantity, name, weight or handling changes', () => {
    const original = document();
    const plan = packCargo(original.space, original.items);
    expect(() => createPlanReport({ ...original, space: { ...original.space, widthCm: 110 } }, plan)).toThrow(/Build a valid plan/);
    expect(() => createPlanReport({ ...original, strategy: 'gentle' }, plan)).toThrow(/Build a valid plan/);
    for (const overrides of [{ quantity: 2 }, { name: 'Revised' }, { weightKg: 11 }, { fragile: true }, { maxTopLoadKg: 200 }]) {
      expect(() => createPlanReport({ ...original, items: [cargo(overrides)] }, plan)).toThrow(/Rebuild/);
    }
  });

  it('retains unplaced planner-limit details in the report without truncating requested cargo', () => {
    const current = document([cargo({ quantity: MAX_CARGO_PIECES + 1, maxTopLoadKg: 0 })]);
    const plan = packCargo(current.space, current.items);
    const report = createPlanReport(current, plan);
    expect(report).toContain('401');
    expect(report).toContain('<td>limit</td>');
    expect(report).toContain('Split this manifest into smaller loads.');
  });
});
