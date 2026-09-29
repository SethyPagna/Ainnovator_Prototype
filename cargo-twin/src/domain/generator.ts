import { formatAwb, type DgInfo, type Manifest, type Orientation, type Shc, type Shipment } from './cargo';
import { aircraftById } from './aircraft';
import { mulberry32, pick, randInt } from './rng';

interface Template {
  desc: string;
  dims: [number, number, number][];
  kg: [number, number];
  pcs: [number, number];
  shc?: Shc[];
  temp?: [number, number];
  dg?: DgInfo;
  orient?: Orientation;
  top: number | 'x2';
  weight: number; // relative frequency
}

const T: Template[] = [
  { desc: 'E-commerce parcels', dims: [[60, 40, 40], [50, 40, 30], [40, 30, 30]], kg: [6, 14], pcs: [30, 90], orient: 'any', top: 60, weight: 3 },
  { desc: 'Consumer electronics on skids', dims: [[120, 100, 120], [120, 80, 110]], kg: [260, 420], pcs: [6, 24], top: 'x2', weight: 3 },
  { desc: 'Garments on skids', dims: [[120, 100, 160], [120, 100, 140]], kg: [160, 260], pcs: [8, 30], top: 300, weight: 2 },
  { desc: 'Automotive parts (crates)', dims: [[150, 110, 100], [120, 100, 110]], kg: [380, 720], pcs: [4, 20], top: 'x2', weight: 2 },
  { desc: 'Machinery spare parts', dims: [[120, 100, 100], [100, 80, 90]], kg: [300, 600], pcs: [4, 16], top: 'x2', weight: 2 },
  { desc: 'Apparel cartons', dims: [[60, 50, 50], [60, 40, 40]], kg: [12, 20], pcs: [20, 60], orient: 'any', top: 80, weight: 2 },
  { desc: 'Lithium-ion battery packs', dims: [[100, 80, 90]], kg: [300, 450], pcs: [2, 10], shc: ['DGR', 'RLI', 'CAO'], dg: { un: 'UN3480', cls: '9', psn: 'Lithium ion batteries', cao: true, pi: '965 IA' }, top: 400, weight: 1 },
  { desc: 'Vaccines (cold chain)', dims: [[60, 40, 50]], kg: [30, 40], pcs: [8, 24], shc: ['PIL', 'COL'], temp: [2, 8], top: 90, weight: 1 },
  { desc: 'Frozen seafood', dims: [[60, 40, 30]], kg: [20, 26], pcs: [10, 40], shc: ['PES', 'PER', 'FRO'], temp: [-25, -18], orient: 'any', top: 150, weight: 1 },
  { desc: 'Fresh-cut flowers', dims: [[100, 50, 30]], kg: [10, 14], pcs: [20, 60], shc: ['PEF', 'PER', 'COL'], temp: [2, 8], top: 60, weight: 1 },
  { desc: 'Fresh fruit', dims: [[50, 30, 25], [60, 40, 25]], kg: [7, 12], pcs: [30, 80], shc: ['PER', 'EAT', 'COL'], temp: [2, 8], top: 50, weight: 1 },
  { desc: 'Biologics (CRT)', dims: [[80, 60, 60]], kg: [50, 65], pcs: [4, 12], shc: ['PIL', 'CRT'], temp: [15, 25], top: 150, weight: 1 },
  { desc: 'Industrial paint', dims: [[60, 40, 50]], kg: [25, 35], pcs: [6, 20], shc: ['DGR'], dg: { un: 'UN1263', cls: '3', psn: 'Paint', cao: false, pi: '364' }, top: 100, weight: 1 },
  { desc: 'Oxidising pool chemicals', dims: [[50, 50, 60]], kg: [40, 50], pcs: [4, 16], shc: ['DGR'], dg: { un: 'UN1479', cls: '5.1', psn: 'Oxidizing solid, n.o.s.', cao: false, pi: '559' }, top: 120, weight: 1 },
  { desc: 'Server racks', dims: [[120, 80, 200]], kg: [450, 700], pcs: [2, 8], shc: ['FRG'], top: 0, weight: 1 },
  { desc: 'Luxury goods', dims: [[50, 40, 40], [60, 40, 50]], kg: [15, 30], pcs: [4, 16], shc: ['VAL'], top: 60, weight: 1 },
  { desc: 'Laboratory glassware', dims: [[80, 60, 60]], kg: [35, 50], pcs: [6, 20], shc: ['FRG'], top: 30, weight: 1 },
  { desc: 'Industrial pump', dims: [[180, 120, 140], [160, 110, 130]], kg: [1400, 2600], pcs: [1, 3], top: 0, weight: 1 },
  { desc: 'Steel fasteners', dims: [[100, 100, 60]], kg: [800, 1100], pcs: [4, 16], top: 1500, weight: 1 },
];

const ROUTES: { from: string; to: string; ac: string; block: number; trip: number }[] = [
  { from: 'HKG', to: 'LAX', ac: 'B777F', block: 104000, trip: 92000 },
  { from: 'HKG', to: 'ANC', ac: 'B777F', block: 78000, trip: 66000 },
  { from: 'HKG', to: 'AMS', ac: 'B777F', block: 100000, trip: 88000 },
  { from: 'HKG', to: 'FRA', ac: 'B748F', block: 142000, trip: 128000 },
  { from: 'HKG', to: 'ORD', ac: 'B748F', block: 150000, trip: 136000 },
  { from: 'HKG', to: 'DWC', ac: 'B748F', block: 96000, trip: 82000 },
];

export function randomManifest(seed: number, aircraftId?: string): Manifest {
  const rnd = mulberry32(seed);
  const routes = aircraftId ? ROUTES.filter((r) => r.ac === aircraftId) : ROUTES;
  const route = pick(rnd, routes.length ? routes : ROUTES);
  const ac = aircraftById(route.ac);
  // aim for 45-75 % of structural payload
  const target = (ac.mzfw - ac.dow) * (0.45 + rnd() * 0.3);
  const shipments: Shipment[] = [];
  let total = 0;
  let n = 0;
  const bag = T.flatMap((t) => Array(t.weight).fill(t) as Template[]);
  let serial = 1000000 + Math.floor(rnd() * 8000000);
  while (total < target && n < 40) {
    const t = pick(rnd, bag);
    const dims = pick(rnd, t.dims);
    const kg = Math.round(t.kg[0] + rnd() * (t.kg[1] - t.kg[0]));
    let pcs = randInt(rnd, t.pcs[0], t.pcs[1]);
    if (total + pcs * kg > target * 1.08) pcs = Math.max(1, Math.floor((target * 1.08 - total) / kg));
    n++;
    serial += 1 + Math.floor(rnd() * 900);
    const shc: Shc[] = t.shc ? [...t.shc] : ['GEN'];
    if (kg >= 150 && !shc.includes('HEA')) shc.push('HEA');
    shipments.push({
      id: `R${String(n).padStart(2, '0')}`,
      awb: formatAwb('000', serial),
      description: t.desc,
      origin: route.from,
      dest: route.to,
      pieces: pcs,
      l: dims[0],
      w: dims[1],
      h: dims[2],
      weight: kg,
      shc,
      temp: t.temp ? { min: t.temp[0], max: t.temp[1] } : undefined,
      dg: t.dg,
      orientation: t.orient ?? 'upright',
      maxTopLoad: t.top === 'x2' ? kg * 2 : t.top,
      priority: rnd() < 0.15 ? 'express' : 'normal',
    });
    total += pcs * kg;
  }
  return {
    id: `RND-${seed}`,
    name: 'Random manifest',
    flight: `TWN ${100 + (seed % 800)}`,
    route: { from: route.from, to: route.to },
    aircraftId: ac.id,
    blockFuel: route.block,
    tripFuel: route.trip,
    description: `Generated mix (seed ${seed}) targeting ${Math.round(target / 1000)} t on a ${ac.short}.`,
    shipments,
  };
}
