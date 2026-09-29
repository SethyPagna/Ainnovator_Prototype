import { formatAwb, type DgInfo, type Manifest, type Orientation, type Shc, type Shipment } from './cargo';

// Demo AWB prefix "000" (not an airline prefix); serials carry a valid mod-7 check digit.
let serialSeed = 5230101;

interface ShipSpec {
  id: string;
  desc: string;
  pcs: number;
  dims: [number, number, number];
  kg: number;
  shc?: Shc[];
  temp?: [number, number];
  dg?: DgInfo;
  orient?: Orientation;
  top: number;
  dest?: string;
  express?: boolean;
}

function mk(spec: ShipSpec, from: string, to: string): Shipment {
  serialSeed += 137;
  const shc: Shc[] = spec.shc?.length ? spec.shc : ['GEN'];
  if (spec.kg >= 150 && !shc.includes('HEA')) shc.push('HEA');
  return {
    id: spec.id,
    awb: formatAwb('000', serialSeed),
    description: spec.desc,
    origin: from,
    dest: spec.dest ?? to,
    pieces: spec.pcs,
    l: spec.dims[0],
    w: spec.dims[1],
    h: spec.dims[2],
    weight: spec.kg,
    shc,
    temp: spec.temp ? { min: spec.temp[0], max: spec.temp[1] } : undefined,
    dg: spec.dg,
    orientation: spec.orient ?? 'upright',
    maxTopLoad: spec.top,
    priority: spec.express ? 'express' : 'normal',
  };
}

const UN3480: DgInfo = { un: 'UN3480', cls: '9', psn: 'Lithium ion batteries', cao: true, pi: '965 IA' };

function hkgLax(): Manifest {
  serialSeed = 5230101;
  const f = 'HKG', t = 'LAX';
  const s: ShipSpec[] = [
    { id: 'S01', desc: 'E-commerce parcels (consolidation)', pcs: 96, dims: [60, 40, 40], kg: 11, top: 60, orient: 'any' },
    { id: 'S02', desc: 'E-commerce fulfilment skids', pcs: 30, dims: [120, 100, 160], kg: 210, top: 300 },
    { id: 'S03', desc: 'Notebook computers on skids', pcs: 24, dims: [120, 100, 120], kg: 380, top: 420, express: true },
    { id: 'S04', desc: 'Lithium-ion battery packs', pcs: 10, dims: [100, 80, 90], kg: 420, shc: ['DGR', 'RLI', 'CAO'], dg: UN3480, top: 400 },
    { id: 'S05', desc: 'Smartphones (high value)', pcs: 16, dims: [60, 40, 50], kg: 28, shc: ['VAL'], top: 80, express: true },
    { id: 'S06', desc: 'Vaccines in passive shippers', pcs: 24, dims: [60, 40, 50], kg: 38, shc: ['PIL', 'COL', 'PER'], temp: [2, 8], top: 90 },
    { id: 'S07', desc: 'Semiconductor lithography module', pcs: 1, dims: [240, 180, 200], kg: 3850, shc: ['FRG', 'BIG'], top: 0 },
    { id: 'S08', desc: 'Automotive parts on skids', pcs: 20, dims: [120, 100, 110], kg: 520, top: 700 },
    { id: 'S09', desc: 'Apparel cartons', pcs: 48, dims: [60, 50, 50], kg: 18, top: 80, orient: 'any' },
    { id: 'S10', desc: 'Server racks', pcs: 8, dims: [120, 80, 200], kg: 650, shc: ['FRG'], top: 0 },
    { id: 'S11', desc: 'LED display panels in flight cases', pcs: 12, dims: [200, 30, 140], kg: 180, shc: ['FRG'], top: 40 },
    { id: 'S12', desc: 'Courier documents', pcs: 30, dims: [50, 40, 30], kg: 15, top: 60, orient: 'any', express: true },
    { id: 'S13', desc: 'Aerosol cosmetics', pcs: 12, dims: [60, 40, 40], kg: 22, shc: ['DGR'], dg: { un: 'UN1950', cls: '2.1', psn: 'Aerosols, flammable', cao: false, pi: '203' }, top: 80 },
    { id: 'S14', desc: 'Printing ink', pcs: 10, dims: [60, 40, 50], kg: 30, shc: ['DGR'], dg: { un: 'UN1210', cls: '3', psn: 'Printing ink, flammable', cao: false, pi: '364' }, top: 90 },
    { id: 'S15', desc: 'Pool chemicals (oxidiser)', pcs: 10, dims: [50, 50, 50], kg: 45, shc: ['DGR'], dg: { un: 'UN1479', cls: '5.1', psn: 'Oxidizing solid, n.o.s.', cao: false, pi: '559' }, top: 120 },
    { id: 'S16', desc: 'Machine-tool spare parts (crates)', pcs: 6, dims: [150, 120, 110], kg: 900, top: 1200 },
    { id: 'S17', desc: 'Toys on skids', pcs: 20, dims: [120, 100, 150], kg: 160, top: 250 },
    { id: 'S18', desc: 'Solar inverters', pcs: 12, dims: [120, 100, 130], kg: 480, top: 600 },
    { id: 'S19', desc: 'Chilled dim sum & bakery', pcs: 36, dims: [60, 40, 35], kg: 14, shc: ['EAT', 'PER', 'COL'], temp: [2, 8], top: 60 },
    { id: 'S20', desc: 'Diagnostic kits', pcs: 12, dims: [80, 60, 60], kg: 55, shc: ['PIL', 'CRT'], temp: [15, 25], top: 150 },
  ];
  return {
    id: 'HKG-LAX',
    name: 'Trans-Pacific tech & e-commerce',
    flight: 'TWN 882',
    route: { from: f, to: t },
    aircraftId: 'B777F',
    blockFuel: 104000,
    tripFuel: 92000,
    description: 'Mixed e-commerce, electronics, lithium batteries (CAO), cold-chain vaccines and a high-value smartphone lot on a 777F.',
    shipments: s.map((x) => mk(x, f, t)),
  };
}

function hkgFra(): Manifest {
  serialSeed = 6120707;
  const f = 'HKG', t = 'FRA';
  const s: ShipSpec[] = [
    { id: 'F01', desc: 'Fresh-cut flowers', pcs: 60, dims: [100, 50, 30], kg: 12, shc: ['PEF', 'PER', 'COL'], temp: [2, 8], top: 60 },
    { id: 'F02', desc: 'Fresh lychees', pcs: 72, dims: [50, 30, 25], kg: 8, shc: ['PER', 'EAT', 'COL'], temp: [2, 8], top: 50 },
    { id: 'F03', desc: 'Frozen seafood', pcs: 40, dims: [60, 40, 30], kg: 25, shc: ['PES', 'PER', 'FRO'], temp: [-25, -18], top: 150, orient: 'any' },
    { id: 'F04', desc: 'Insulin (cold chain)', pcs: 16, dims: [60, 40, 50], kg: 35, shc: ['PIL', 'COL'], temp: [2, 8], top: 90 },
    { id: 'F05', desc: 'Biologics, controlled room temp', pcs: 10, dims: [80, 60, 60], kg: 60, shc: ['PIL', 'CRT'], temp: [15, 25], top: 150 },
    { id: 'F06', desc: 'Clinical samples on dry ice', pcs: 8, dims: [50, 50, 50], kg: 30, shc: ['DGR', 'ICE'], dg: { un: 'UN1845', cls: '9', psn: 'Dry ice', cao: false, pi: '954' }, top: 60 },
    { id: 'F07', desc: 'Live ornamental fish', pcs: 30, dims: [60, 45, 40], kg: 18, shc: ['AVI'], top: 40 },
    { id: 'F08', desc: 'Industrial paint', pcs: 20, dims: [60, 40, 50], kg: 32, shc: ['DGR'], dg: { un: 'UN1263', cls: '3', psn: 'Paint', cao: false, pi: '364' }, top: 100 },
    { id: 'F09', desc: 'Pool chemicals (oxidiser)', pcs: 16, dims: [50, 50, 60], kg: 48, shc: ['DGR'], dg: { un: 'UN1479', cls: '5.1', psn: 'Oxidizing solid, n.o.s.', cao: false, pi: '559' }, top: 120 },
    { id: 'F10', desc: 'Battery fluid, acid', pcs: 12, dims: [60, 40, 40], kg: 30, shc: ['DGR'], dg: { un: 'UN2796', cls: '8', psn: 'Battery fluid, acid', cao: false, pi: '851' }, top: 80 },
    { id: 'F11', desc: 'Pesticide, solid, toxic', pcs: 10, dims: [60, 40, 40], kg: 25, shc: ['DGR'], dg: { un: 'UN2588', cls: '6.1', psn: 'Pesticide, solid, toxic, n.o.s.', cao: false, pi: '670' }, top: 80 },
    { id: 'F12', desc: 'Premium tea & dried goods', pcs: 30, dims: [60, 40, 40], kg: 18, shc: ['EAT'], top: 80, orient: 'any' },
    { id: 'F13', desc: 'Lithium-ion battery modules', pcs: 8, dims: [100, 80, 90], kg: 400, shc: ['DGR', 'RLI', 'CAO'], dg: UN3480, top: 400 },
    { id: 'F14', desc: 'Machinery parts on skids', pcs: 36, dims: [120, 100, 120], kg: 650, top: 800 },
    { id: 'F15', desc: 'Garments on skids', pcs: 36, dims: [120, 100, 160], kg: 240, top: 300 },
    { id: 'F16', desc: 'Electronic components (EUR pallets)', pcs: 30, dims: [120, 80, 120], kg: 320, top: 450 },
    { id: 'F17', desc: 'Luxury watches', pcs: 10, dims: [50, 40, 40], kg: 20, shc: ['VAL'], top: 60 },
    { id: 'F18', desc: 'E-commerce parcels', pcs: 80, dims: [60, 40, 40], kg: 10, top: 60, orient: 'any' },
    { id: 'F19', desc: 'APU on transport stand', pcs: 1, dims: [220, 160, 170], kg: 2600, shc: ['BIG'], top: 0 },
    { id: 'F20', desc: 'Laboratory glassware', pcs: 20, dims: [80, 60, 60], kg: 45, shc: ['FRG'], top: 30 },
    { id: 'F21', desc: 'Automotive parts (crates)', pcs: 24, dims: [150, 110, 100], kg: 700, top: 900 },
    { id: 'F22', desc: 'Steel fasteners', pcs: 20, dims: [100, 100, 60], kg: 1100, top: 1500 },
  ];
  return {
    id: 'HKG-FRA',
    name: 'Perishables, pharma & DG to Europe',
    flight: 'TWN 261',
    route: { from: f, to: t },
    aircraftId: 'B748F',
    blockFuel: 142000,
    tripFuel: 128000,
    description: 'Flowers and fruit (passive COL), frozen seafood and insulin (active RKN), live fish, and a DG mix that needs Table 9.3.A segregation.',
    shipments: s.map((x) => mk(x, f, t)),
  };
}

function hkgDwc(): Manifest {
  serialSeed = 7340303;
  const f = 'HKG', t = 'DWC';
  const s: ShipSpec[] = [
    { id: 'H01', desc: 'Gas-turbine casing', pcs: 1, dims: [300, 230, 200], kg: 5900, shc: ['BIG'], top: 0, orient: 'fixed' },
    { id: 'H02', desc: 'Reduction gearbox', pcs: 2, dims: [180, 150, 160], kg: 3400, top: 0 },
    { id: 'H03', desc: 'CNC machining centre', pcs: 1, dims: [250, 210, 215], kg: 6200, shc: ['BIG', 'FRG'], top: 0 },
    { id: 'H04', desc: 'Distribution transformer', pcs: 1, dims: [200, 160, 190], kg: 4800, top: 0 },
    { id: 'H05', desc: 'Hydraulic press frame', pcs: 1, dims: [260, 200, 180], kg: 7400, shc: ['BIG'], top: 0 },
    { id: 'H06', desc: 'Diesel generator set', pcs: 2, dims: [280, 120, 170], kg: 3900, top: 0 },
    { id: 'H07', desc: 'Precision steel shafts', pcs: 6, dims: [300, 60, 60], kg: 900, top: 1000, orient: 'upright' },
    { id: 'H08', desc: 'Spare-parts crates', pcs: 30, dims: [120, 100, 100], kg: 450, top: 700 },
    { id: 'H09', desc: 'Tool kits', pcs: 40, dims: [80, 60, 60], kg: 90, top: 200 },
    { id: 'H10', desc: 'Batteries, wet, filled with acid', pcs: 10, dims: [80, 60, 50], kg: 180, shc: ['DGR'], dg: { un: 'UN2794', cls: '8', psn: 'Batteries, wet, filled with acid', cao: false, pi: '870' }, top: 300 },
    { id: 'H11', desc: 'Lubricant drums (not restricted)', pcs: 20, dims: [60, 60, 90], kg: 210, top: 400 },
    { id: 'H12', desc: 'Electric motors', pcs: 4, dims: [150, 100, 110], kg: 1800, top: 0 },
    { id: 'H13', desc: 'Control cabinets', pcs: 6, dims: [120, 80, 210], kg: 420, shc: ['FRG'], top: 0 },
    { id: 'H14', desc: 'Touch-up paint', pcs: 12, dims: [60, 40, 50], kg: 30, shc: ['DGR'], dg: { un: 'UN1263', cls: '3', psn: 'Paint', cao: false, pi: '364' }, top: 100 },
  ];
  return {
    id: 'HKG-DWC',
    name: 'Heavy-machinery charter',
    flight: 'TWN 9401',
    route: { from: f, to: t },
    aircraftId: 'B748F',
    blockFuel: 96000,
    tripFuel: 82000,
    description: 'Outsized, non-stackable heavy pieces that need centre-line Q7 positions and careful CG placement; one piece exceeds every position limit.',
    shipments: s.map((x) => mk(x, f, t)),
  };
}

export const SAMPLE_MANIFESTS: (() => Manifest)[] = [hkgLax, hkgFra, hkgDwc];

export function sampleManifest(id: string): Manifest {
  const all = SAMPLE_MANIFESTS.map((f) => f());
  return all.find((m) => m.id === id) ?? all[0];
}

export function sampleList(): { id: string; name: string; flight: string; route: string; aircraftId: string }[] {
  return SAMPLE_MANIFESTS.map((f) => {
    const m = f();
    return { id: m.id, name: m.name, flight: m.flight, route: `${m.route.from} → ${m.route.to}`, aircraftId: m.aircraftId };
  });
}
