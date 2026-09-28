import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { UldType } from '../domain/uld';
import { DG_LABEL_COLORS } from '../ui/colors';

export interface GlInfo {
  renderer: string;
  software: boolean;
}

export function detectGl(r: THREE.WebGLRenderer): GlInfo {
  const gl = r.getContext();
  let name = '';
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    name = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER));
  } catch {
    name = 'unknown';
  }
  const software = /swiftshader|llvmpipe|software|basic render/i.test(name);
  return { renderer: name, software };
}

export function createRenderer(canvasHost: HTMLElement): { renderer: THREE.WebGLRenderer; info: GlInfo } {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  const info = detectGl(renderer);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, info.software ? 1 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = !info.software;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  canvasHost.appendChild(renderer.domElement);
  return { renderer, info };
}

export function environment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  pm.dispose();
  return env;
}

/** Dispose geometries and materials below an object (textures shared via caches are kept). */
export function disposeTree(root: THREE.Object3D, keep: Set<THREE.BufferGeometry> = new Set()) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry && !keep.has(m.geometry)) m.geometry.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else mat?.dispose();
  });
}

export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Procedural floor texture: fine grid with a subtle radial vignette. */
export function gridTexture(size = 1024, cells = 32, color = 'rgba(120,220,200,0.10)', major = 'rgba(120,220,200,0.20)'): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  g.fillStyle = '#0c1719';
  g.fillRect(0, 0, size, size);
  const step = size / cells;
  for (let i = 0; i <= cells; i++) {
    g.strokeStyle = i % 4 === 0 ? major : color;
    g.lineWidth = i % 4 === 0 ? 2 : 1;
    g.beginPath();
    g.moveTo(i * step, 0);
    g.lineTo(i * step, size);
    g.moveTo(0, i * step);
    g.lineTo(size, i * step);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

/** A DG hazard-label diamond (simplified artwork: class colours + class number). */
const dgCache = new Map<string, THREE.CanvasTexture>();
export function dgLabelTexture(cls: string): THREE.CanvasTexture {
  const hit = dgCache.get(cls);
  if (hit) return hit;
  const s = 128;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d')!;
  const col = DG_LABEL_COLORS[cls] ?? { bg: '#f4f4f4', fg: '#111' };
  g.translate(s / 2, s / 2);
  g.rotate(Math.PI / 4);
  const r = s * 0.34;
  g.fillStyle = col.bg;
  g.fillRect(-r, -r, 2 * r, 2 * r);
  if (col.top === 'stripes9') {
    g.save();
    g.beginPath();
    g.rect(-r, -r, 2 * r, r);
    g.clip();
    g.fillStyle = '#111';
    for (let i = -r; i < r; i += 10) g.fillRect(i, -r, 5, 2 * r);
    g.restore();
  } else if (col.top && col.top !== 'stripes') {
    g.fillStyle = col.top;
    g.beginPath();
    g.moveTo(-r, -r);
    g.lineTo(r, -r);
    g.lineTo(-r, r);
    g.closePath();
    g.fill();
  }
  if (cls === '8') {
    g.fillStyle = '#111';
    g.beginPath();
    g.moveTo(r, -r);
    g.lineTo(r, r);
    g.lineTo(-r, r);
    g.closePath();
    g.fill();
  }
  g.strokeStyle = '#111';
  g.lineWidth = 4;
  g.strokeRect(-r + 5, -r + 5, 2 * r - 10, 2 * r - 10);
  g.rotate(-Math.PI / 4);
  g.fillStyle = cls === '8' ? '#fff' : col.fg;
  g.font = 'bold 26px "Inter Variable", system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(cls === '1.4S' ? '1.4' : cls.split('.')[0], 0, s * 0.3);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  dgCache.set(cls, t);
  return t;
}

/** Extruded outline geometry of a ULD in its own frame (metres; x lateral, y up, z depth), centred on x/z. */
export function outlineGeometry(t: UldType, which: 'outline' | 'profile' = 'outline'): THREE.ExtrudeGeometry {
  const pts = which === 'outline' ? t.outline : t.profile;
  const xs = t.outline.map((p) => p[0]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const shape = new THREE.Shape();
  pts.forEach(([x, y], i) => {
    const X = (x - cx) / 100, Y = y / 100;
    if (i === 0) shape.moveTo(X, Y);
    else shape.lineTo(X, Y);
  });
  shape.closePath();
  const depth = which === 'outline' ? t.external.depth / 100 : (t.zRange[1] - t.zRange[0]) / 100;
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, steps: 1 });
  const z0 = which === 'outline' ? -t.external.depth / 200 : (t.zRange[0] - t.external.depth / 2) / 100;
  geo.translate(0, 0, z0);
  return geo;
}

export function uldCentreX(t: UldType): number {
  const xs = t.outline.map((p) => p[0]);
  return (Math.min(...xs) + Math.max(...xs)) / 2;
}

/** Shell visual for a ULD: translucent panels + edges for containers; plate + contour net for pallets. */
export function buildUldShell(t: UldType, opts: { opacity?: number; edgeColor?: number; netDensity?: number } = {}): THREE.Group {
  const g = new THREE.Group();
  g.name = 'shell';
  const edgeColor = opts.edgeColor ?? 0x5fe0c4;
  if (t.kind === 'container') {
    const geo = outlineGeometry(t);
    const body = new THREE.Mesh(
      geo,
      new THREE.MeshPhysicalMaterial({
        color: t.active ? 0xdfe7ea : 0xa9c2c7,
        metalness: t.active ? 0.1 : 0.55,
        roughness: 0.35,
        transparent: true,
        opacity: opts.opacity ?? (t.active ? 0.22 : 0.13),
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    body.renderOrder = 2;
    g.add(body);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 15), new THREE.LineBasicMaterial({ color: edgeColor, transparent: true, opacity: 0.85 }));
    g.add(edges);
    // panel ribs every ~30 cm along the depth to read as a real container
    const ribMat = new THREE.LineBasicMaterial({ color: edgeColor, transparent: true, opacity: 0.18 });
    const cx = uldCentreX(t);
    const n = Math.max(2, Math.round(t.external.depth / 32));
    for (let i = 1; i < n; i++) {
      const z = -t.external.depth / 200 + (i * t.external.depth) / (n * 100);
      const pts = t.outline.map(([x, y]) => new THREE.Vector3((x - cx) / 100, y / 100, z));
      pts.push(pts[0].clone());
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), ribMat));
    }
    if (t.active) {
      // machinery bay at the rear of an active container
      const bay = new THREE.Mesh(
        new THREE.BoxGeometry(t.external.width / 100 - 0.06, t.external.height / 100 - 0.06, (t.zRange[0] - 4) / 100),
        new THREE.MeshStandardMaterial({ color: 0x33474c, roughness: 0.6, metalness: 0.4 }),
      );
      bay.position.set(0, t.external.height / 200, -t.external.depth / 200 + (t.zRange[0] - 4) / 200 + 0.02);
      g.add(bay);
      const vent = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.35), new THREE.MeshStandardMaterial({ color: 0x5fe0c4, emissive: 0x1a6b5c, emissiveIntensity: 0.6 }));
      vent.position.set(0, 1.3, -t.external.depth / 200 + (t.zRange[0] - 4) / 100 + 0.021);
      g.add(vent);
    }
  } else {
    // pallet plate
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(t.external.width / 100, 0.02, t.external.depth / 100),
      new THREE.MeshStandardMaterial({ color: 0xb8c4c8, metalness: 0.75, roughness: 0.35 }),
    );
    plate.position.y = 0.01;
    plate.receiveShadow = true;
    g.add(plate);
    const rail = new THREE.LineSegments(new THREE.EdgesGeometry(plate.geometry), new THREE.LineBasicMaterial({ color: 0x7a8a8e }));
    rail.position.copy(plate.position);
    g.add(rail);
    // contour template: faint envelope + dashed edges + net lines
    const geo = outlineGeometry(t);
    const env = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: edgeColor, transparent: true, opacity: 0.035, side: THREE.DoubleSide, depthWrite: false }));
    env.renderOrder = 2;
    g.add(env);
    const dashed = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 15), new THREE.LineDashedMaterial({ color: edgeColor, dashSize: 0.08, gapSize: 0.05, transparent: true, opacity: 0.7 }));
    dashed.computeLineDistances();
    g.add(dashed);
    const netMat = new THREE.LineBasicMaterial({ color: edgeColor, transparent: true, opacity: 0.13 });
    const cx = uldCentreX(t);
    const n = Math.round(t.external.depth / (opts.netDensity ?? 25));
    for (let i = 1; i < n; i++) {
      const z = -t.external.depth / 200 + (i * t.external.depth) / (n * 100);
      // over the top of the contour, from the right plate edge round to the left plate edge
      const pts = [...t.outline.slice(1), t.outline[0]].map(([x, y]) => new THREE.Vector3((x - cx) / 100, Math.max(0.02, y / 100), z));
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), netMat));
    }
  }
  return g;
}
