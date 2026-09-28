import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { Aircraft, Position } from '../domain/aircraft';
import type { Shipment } from '../domain/cargo';
import type { BuiltUld } from '../domain/packing/buildup';
import { uldType, type UldType } from '../domain/uld';
import { handlingOf, weightColor } from '../ui/colors';
import { createRenderer, disposeTree, easeInOutCubic, environment, gridTexture, outlineGeometry, type GlInfo } from './common';

export type AircraftColorMode = 'handling' | 'weight';

interface UldVisual {
  group: THREE.Group;
  body: THREE.Mesh<THREE.ExtrudeGeometry, THREE.MeshStandardMaterial>;
  edges: THREE.LineSegments<THREE.EdgesGeometry, THREE.LineBasicMaterial>;
  target: THREE.Vector3;
  start: THREE.Vector3;
  via: THREE.Vector3;
  anim: number; // -delay .. 1
  uld: BuiltUld;
  pos: Position;
}

export class AircraftScene {
  readonly info: GlInfo;
  private renderer: THREE.WebGLRenderer;
  private labels: CSS2DRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(36, 1, 0.5, 600);
  private controls: OrbitControls;
  private host: HTMLElement;
  private ro: ResizeObserver;
  private raf = 0;
  private dirty = true;
  private disposed = false;
  private lastT = performance.now();
  private airframe = new THREE.Group();
  private decks = new THREE.Group();
  private uldGroup = new THREE.Group();
  private cgGroup = new THREE.Group();
  private posLines = new Map<string, THREE.LineLoop<THREE.BufferGeometry, THREE.LineBasicMaterial>>();
  private ulds = new Map<string, UldVisual>();
  private geoCache = new Map<string, THREE.ExtrudeGeometry>();
  private ac: Aircraft | null = null;
  private selected: string | null = null;
  private mode: AircraftColorMode = 'handling';
  private ray = new THREE.Raycaster();
  private cgLabel: CSS2DObject;
  private zfwLabel: CSS2DObject;
  private macBar = new THREE.Group();
  onPick: (uldId: string | null) => void = () => {};

  constructor(host: HTMLElement) {
    this.host = host;
    const { renderer, info } = createRenderer(host);
    this.renderer = renderer;
    this.renderer.shadowMap.enabled = false;
    this.info = info;
    this.labels = new CSS2DRenderer();
    this.labels.domElement.className = 'labels-layer';
    host.appendChild(this.labels.domElement);
    const bg = new THREE.Color('#0a1316');
    this.scene.background = bg;
    this.scene.fog = new THREE.Fog(bg, 90, 230);
    this.scene.environment = environment(renderer);
    this.scene.environmentIntensity = 0.5;
    this.scene.add(new THREE.HemisphereLight(0xcff5ec, 0x0a1214, 1.0));
    const key = new THREE.DirectionalLight(0xffffff, 1.3);
    key.position.set(-20, 40, -30);
    this.scene.add(key);
    const tex = gridTexture(1024, 32, 'rgba(120,220,200,0.07)', 'rgba(120,220,200,0.14)');
    tex.repeat.set(30, 30);
    const apron = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0.1 }));
    apron.rotation.x = -Math.PI / 2;
    apron.position.y = -6.2;
    this.scene.add(apron);
    this.scene.add(this.airframe, this.decks, this.uldGroup, this.cgGroup, this.macBar);
    this.cgLabel = this.label('', 'tag tag-cg');
    this.zfwLabel = this.label('', 'tag tag-zfw');
    this.scene.add(this.cgLabel, this.zfwLabel);

    this.camera.position.set(-30, 32, -70);
    this.controls = new OrbitControls(this.camera, renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI * 0.495;
    this.controls.minDistance = 8;
    this.controls.maxDistance = 160;
    this.controls.addEventListener('change', () => (this.dirty = true));
    this.bindPointer();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();
    this.loop();
  }

  private label(text: string, cls: string) {
    const el = document.createElement('div');
    el.className = cls;
    el.textContent = text;
    return new CSS2DObject(el);
  }

  private X(station: number): number {
    return (this.ac?.body.length ?? 60) / 2 - station; // nose towards +x (screen left from the port side)
  }

  // ---- airframe ----------------------------------------------------------------------
  setAircraft(ac: Aircraft) {
    if (this.ac?.id === ac.id) return;
    this.ac = ac;
    disposeTree(this.airframe);
    disposeTree(this.decks);
    this.airframe.clear();
    this.decks.clear();
    this.posLines.clear();
    this.clearUlds();
    const b = ac.body;
    const L = b.length, R = b.radius;
    const noseLen = R * 2.3, tailLen = R * 5.2;
    const radius = (x: number) => {
      if (x < noseLen) return R * Math.sqrt(Math.max(0, 1 - (1 - x / noseLen) ** 2)) * 0.98 + 0.02 * R;
      if (x > L - tailLen) return R * (1 - 0.8 * ((x - (L - tailLen)) / tailLen) ** 1.3);
      return R;
    };
    const centre = (x: number) => b.centerZ + (x > L - tailLen ? R * 0.62 * ((x - (L - tailLen)) / tailLen) ** 1.6 : 0) - (x < noseLen ? R * 0.18 * (1 - x / noseLen) ** 2 : 0);
    const hump = (x: number, th: number) => {
      if (!b.hump) return 0;
      const s = x < 2 ? 0 : x < 8 ? (x - 2) / 6 : x < 24 ? 1 : x < 34 ? 1 - (x - 24) / 10 : 0;
      const up = Math.max(0, Math.sin(th));
      return 1.35 * Math.sin((s * Math.PI) / 2) * up ** 3;
    };
    const N = 120, M = 44;
    const pos: number[] = [];
    const idx: number[] = [];
    const rings: THREE.Vector3[][] = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const x = L * (u < 0.15 ? (u / 0.15) ** 1.6 * 0.15 : u);
      const ring: THREE.Vector3[] = [];
      for (let j = 0; j <= M; j++) {
        const th = (j / M) * Math.PI * 2;
        const r = radius(x) + hump(x, th);
        const v = new THREE.Vector3(this.X(x), centre(x) + r * Math.sin(th) * (1 + 0.04 * Math.max(0, Math.sin(th))), r * Math.cos(th));
        ring.push(v);
        pos.push(v.x, v.y, v.z);
      }
      rings.push(ring);
    }
    for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) {
      const a = i * (M + 1) + j, c = a + M + 1;
      idx.push(a, c, a + 1, a + 1, c, c + 1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const skin = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xd4e8e6, metalness: 0.4, roughness: 0.35, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false }));
    skin.renderOrder = 5;
    this.airframe.add(skin);
    // frames and stringers
    const frameMat = new THREE.LineBasicMaterial({ color: 0x7fdcc8, transparent: true, opacity: 0.2 });
    const frames: THREE.Vector3[] = [];
    for (let i = 2; i < N; i += 2) {
      const r = rings[i];
      for (let j = 0; j < M; j++) frames.push(r[j], r[j + 1]);
    }
    for (const j of [0, 5, 11, 16, 22, 28, 33, 39]) for (let i = 0; i < N; i++) frames.push(rings[i][j], rings[i + 1][j]);
    this.airframe.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(frames), frameMat));
    // cockpit windows
    const winMat = new THREE.MeshBasicMaterial({ color: 0x5fe0c4, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
    for (const s of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.45), winMat);
      const x = noseLen * 0.62;
      w.position.set(this.X(x), centre(x) + radius(x) * 0.55 + hump(x, 1.2) * 0.6, s * radius(x) * 0.72);
      w.rotation.y = s > 0 ? 0.6 : Math.PI - 0.6;
      this.airframe.add(w);
    }
    // wings, engines and tail
    const shell = new THREE.MeshStandardMaterial({ color: 0xd4e8e6, metalness: 0.4, roughness: 0.4, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false });
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x7fdcc8, transparent: true, opacity: 0.45 });
    const flat = (pts: [number, number][], thick: number) => {
      const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
      const g = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false });
      g.translate(0, 0, -thick / 2);
      return g;
    };
    const semi = b.span / 2;
    const tan = Math.tan((b.sweepDeg * Math.PI) / 180);
    const wingY = b.centerZ - R * 0.62;
    for (const s of [-1, 1]) {
      const zr = R * 0.7;
      const pts: [number, number][] = [
        [this.X(b.wingRootX), zr], [this.X(b.wingRootX + tan * (semi - zr)), semi], [this.X(b.wingRootX + tan * (semi - zr) + b.tipChord), semi], [this.X(b.wingRootX + b.rootChord), zr],
      ];
      const g = flat(pts, 0.5);
      const wing = new THREE.Mesh(g, shell);
      wing.rotation.x = Math.PI / 2;
      if (s < 0) wing.scale.y = -1;
      const holder = new THREE.Group();
      holder.add(wing);
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(g), edgeMat);
      e.rotation.copy(wing.rotation);
      e.scale.copy(wing.scale);
      holder.add(e);
      holder.position.y = wingY;
      holder.rotation.x = s * 0.07; // dihedral
      this.airframe.add(holder);
      for (const ez of b.engines) {
        const lx = b.wingRootX + tan * (ez - zr) - 3.2;
        const nac = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.2, 6.2, 28, 1, true), shell);
        nac.rotation.z = Math.PI / 2;
        nac.position.set(this.X(lx + 2.6), wingY - 1.6 + ez * s * 0.07 * s, s * ez);
        this.airframe.add(nac);
        const lip = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.08, 8, 32), new THREE.MeshBasicMaterial({ color: 0x7fdcc8, transparent: true, opacity: 0.5 }));
        lip.rotation.y = Math.PI / 2;
        lip.position.set(this.X(lx - 0.5), nac.position.y, s * ez);
        this.airframe.add(lip);
      }
    }
    const tailX = L - tailLen * 0.62;
    const tcy = centre(L - 4);
    for (const s of [-1, 1]) {
      const hs = semi * 0.34;
      const pts: [number, number][] = [[this.X(tailX), 0.6], [this.X(tailX + hs * 0.9), hs], [this.X(tailX + hs * 0.9 + 2.2), hs], [this.X(tailX + 7.5), 0.6]];
      const g = flat(pts, 0.3);
      const m = new THREE.Mesh(g, shell);
      m.rotation.x = Math.PI / 2;
      if (s < 0) m.scale.y = -1;
      m.position.y = tcy;
      this.airframe.add(m);
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(g), edgeMat);
      e.rotation.copy(m.rotation);
      e.scale.copy(m.scale);
      e.position.copy(m.position);
      this.airframe.add(e);
    }
    const finH = R * 2.9;
    const fin = flat([[this.X(L - tailLen * 0.85), 0], [this.X(L - tailLen * 0.85 + finH * 0.95), finH], [this.X(L - tailLen * 0.85 + finH * 0.95 + 3.2), finH], [this.X(L - 1.2), 0]], 0.35);
    const finMesh = new THREE.Mesh(fin, shell);
    finMesh.position.y = centre(L - tailLen * 0.7) + R * 0.6;
    this.airframe.add(finMesh);
    const finEdge = new THREE.LineSegments(new THREE.EdgesGeometry(fin), edgeMat);
    finEdge.position.copy(finMesh.position);
    this.airframe.add(finEdge);

    // main-deck cargo door outline (port side)
    const dx0 = this.X(b.doorX[0]), dx1 = this.X(b.doorX[1]);
    const dz = -R * 0.97;
    const door = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(dx0, 0.1, dz), new THREE.Vector3(dx1, 0.1, dz), new THREE.Vector3(dx1, 3.05, dz * 0.93), new THREE.Vector3(dx0, 3.05, dz * 0.93),
    ]), new THREE.LineBasicMaterial({ color: 0xfab219 }));
    this.airframe.add(door);
    const dl = this.label('MD cargo door', 'tag tag-door');
    dl.position.set((dx0 + dx1) / 2, 3.6, dz - 0.4);
    this.airframe.add(dl);

    // decks
    const md = ac.positions.filter((p) => p.deck === 'main');
    const ld = ac.positions.filter((p) => p.deck === 'lower');
    const deckMat = new THREE.MeshStandardMaterial({ color: 0x14272b, metalness: 0.3, roughness: 0.8, transparent: true, opacity: 0.45, depthWrite: false });
    const mdx0 = Math.min(...md.map((p) => p.x0)) - 0.4, mdx1 = Math.max(...md.map((p) => p.x1)) + 0.4;
    const mdFloor = new THREE.Mesh(new THREE.BoxGeometry(mdx1 - mdx0, 0.06, 5.2), deckMat);
    mdFloor.position.set(this.X((mdx0 + mdx1) / 2), -0.03, 0);
    this.decks.add(mdFloor);
    for (const hold of ['FWD', 'AFT'] as const) {
      const hp = ld.filter((p) => p.hold === hold);
      if (!hp.length) continue;
      const x0 = Math.min(...hp.map((p) => p.x0)) - 0.3, x1 = Math.max(...hp.map((p) => p.x1)) + 0.3;
      const f = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.06, 4.3), deckMat);
      f.position.set(this.X((x0 + x1) / 2), b.lowerFloorZ - 0.03, 0);
      this.decks.add(f);
    }
    for (const p of ac.positions) {
      const y = (p.deck === 'main' ? 0 : b.lowerFloorZ) + 0.012 + (p.alt ? 0.01 : 0);
      const pts = [
        new THREE.Vector3(this.X(p.x0), y, p.y0), new THREE.Vector3(this.X(p.x1), y, p.y0), new THREE.Vector3(this.X(p.x1), y, p.y1), new THREE.Vector3(this.X(p.x0), y, p.y1),
      ];
      const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x3f7f76, transparent: true, opacity: p.alt ? 0.35 : 0.7 }));
      this.decks.add(line);
      this.posLines.set(p.id, line);
    }
    this.buildMacBar();
    this.frameAll();
    this.dirty = true;
  }

  private buildMacBar() {
    const ac = this.ac!;
    this.macBar.clear();
    const y = ac.body.lowerFloorZ - 1.6;
    const z = -ac.body.radius - 1.2;
    const bar = new THREE.Mesh(new THREE.BoxGeometry(ac.mac, 0.08, 0.08), new THREE.MeshBasicMaterial({ color: 0x5fe0c4 }));
    bar.position.set(this.X(ac.lemac + ac.mac / 2), y, z);
    this.macBar.add(bar);
    for (const f of [0, 1]) {
      const tick = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6, 0.06), new THREE.MeshBasicMaterial({ color: 0x5fe0c4 }));
      tick.position.set(this.X(ac.lemac + f * ac.mac), y, z);
      this.macBar.add(tick);
    }
    const l = this.label('LEMAC → MAC', 'tag tag-mac');
    l.position.set(this.X(ac.lemac) - 2.2, y, z);
    this.macBar.add(l);
  }

  private frameAll() {
    const L = this.ac?.body.length ?? 64;
    this.controls.target.set(L * 0.05, -2.2, 4);
    this.camera.position.set(L * 0.33, L * 0.34, -L * 1.1);
    this.controls.update();
  }

  resetView() {
    this.frameAll();
    this.dirty = true;
  }

  private geometry(t: UldType): THREE.ExtrudeGeometry {
    let g = this.geoCache.get(t.id);
    if (!g) {
      g = outlineGeometry(t);
      this.geoCache.set(t.id, g);
    }
    return g;
  }

  private clearUlds() {
    for (const v of this.ulds.values()) {
      v.body.material.dispose();
      v.edges.geometry.dispose();
      v.edges.material.dispose();
    }
    this.uldGroup.clear();
    this.ulds.clear();
  }

  /** Place ULDs according to an assignment map (positionId -> uldId). */
  setPlan(ulds: BuiltUld[], assignments: Record<string, string>, ships: Map<string, Shipment>, animateOrder?: string[]) {
    const ac = this.ac;
    if (!ac) return;
    this.clearUlds();
    const byId = new Map(ulds.map((u) => [u.id, u]));
    const posById = new Map(ac.positions.map((p) => [p.id, p]));
    for (const [pid, line] of this.posLines) {
      const occ = assignments[pid];
      line.material.color.set(occ ? 0x5fe0c4 : 0x3f7f76);
      line.material.opacity = occ ? 0.95 : posById.get(pid)!.alt ? 0.3 : 0.6;
    }
    const seqIndex = new Map((animateOrder ?? []).map((pid, i) => [pid, i]));
    for (const [pid, uid] of Object.entries(assignments)) {
      const u = byId.get(uid);
      const p = posById.get(pid);
      if (!u || !p) continue;
      const t = uldType(u.typeId);
      const color = this.colorFor(u, p, ships);
      const body = new THREE.Mesh(this.geometry(t), new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.15, transparent: true, opacity: 0.92 }));
      body.userData.uldId = uid;
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(this.geometry(t), 15), new THREE.LineBasicMaterial({ color: 0x0a1416, transparent: true, opacity: 0.7 }));
      const group = new THREE.Group();
      group.add(body, edges);
      // orientation: ULD profile axis across the aircraft; contour faces the fuselage skin
      const latW = (p.y1 - p.y0) * 100;
      const across = Math.abs(t.external.width - latW) < Math.abs(t.external.depth - latW);
      if (across) group.rotation.y = p.outboard === 'right' ? Math.PI / 2 : -Math.PI / 2;
      const target = new THREE.Vector3(this.X(p.arm), p.deck === 'main' ? 0 : ac.body.lowerFloorZ, p.lat);
      group.position.copy(target);
      const doorX = this.X((ac.body.doorX[0] + ac.body.doorX[1]) / 2);
      const start = p.deck === 'main' ? new THREE.Vector3(doorX, target.y, -ac.body.radius - 5) : new THREE.Vector3(target.x, target.y, ac.body.radius + 5);
      const via = p.deck === 'main' ? new THREE.Vector3(doorX, target.y, target.z) : target.clone();
      const order = seqIndex.get(pid);
      this.uldGroup.add(group);
      this.ulds.set(uid, { group, body, edges, target, start, via, anim: order === undefined ? 1 : -order * 0.16, uld: u, pos: p });
      if (order !== undefined) group.position.copy(start);
      group.visible = order === undefined;
    }
    this.applySelection();
    this.dirty = true;
  }

  setColorMode(mode: AircraftColorMode, ships: Map<string, Shipment>) {
    this.mode = mode;
    for (const v of this.ulds.values()) v.body.material.color.set(this.colorFor(v.uld, v.pos, ships));
    this.dirty = true;
  }

  private colorFor(u: BuiltUld, p: Position, ships: Map<string, Shipment>): string {
    if (this.mode === 'weight') return weightColor(u.gross / p.maxWeight);
    // dominant handling class by weight
    const w = new Map<string, { c: string; kg: number }>();
    for (const pl of u.placements) {
      const s = ships.get(pl.shipmentId);
      if (!s) continue;
      const h = handlingOf(s);
      const cur = w.get(h.key) ?? { c: h.color, kg: 0 };
      cur.kg += pl.weight * (h.key === 'dg' ? 3 : 1);
      w.set(h.key, cur);
    }
    return [...w.values()].sort((a, b) => b.kg - a.kg)[0]?.c ?? '#7d9295';
  }

  setSelected(uldId: string | null) {
    this.selected = uldId;
    this.applySelection();
  }

  private applySelection() {
    for (const [id, v] of this.ulds) {
      const sel = id === this.selected;
      v.body.material.emissive.set(sel ? 0x3de0c0 : 0x000000);
      v.body.material.emissiveIntensity = sel ? 0.6 : 0;
      v.edges.material.color.set(sel ? 0xffffff : 0x0a1416);
    }
    this.dirty = true;
  }

  /** CG markers (arms in metres from the nose datum). */
  setCg(towArm: number | null, zfwArm: number | null, towMac: number, zfwMac: number, limits: [number, number] | null, ok: boolean) {
    const ac = this.ac;
    disposeTree(this.cgGroup);
    this.cgGroup.clear();
    if (!ac || towArm === null || zfwArm === null) {
      this.cgLabel.visible = this.zfwLabel.visible = false;
      this.dirty = true;
      return;
    }
    const R = ac.body.radius;
    const mk = (arm: number, color: number, opacity: number) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(R + 0.35, 0.05, 8, 64), new THREE.MeshBasicMaterial({ color, transparent: true, opacity }));
      ring.rotation.y = Math.PI / 2;
      ring.position.set(this.X(arm), ac.body.centerZ, 0);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(R + 0.3, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: opacity * 0.08, side: THREE.DoubleSide, depthWrite: false }));
      disc.rotation.y = Math.PI / 2;
      disc.position.copy(ring.position);
      this.cgGroup.add(ring, disc);
    };
    mk(towArm, ok ? 0x5fe0c4 : 0xd03b3b, 0.95);
    mk(zfwArm, 0xfab219, 0.7);
    this.cgLabel.visible = true;
    this.zfwLabel.visible = false;
    (this.cgLabel.element as HTMLElement).textContent = `CG · TOW ${towMac.toFixed(1)} · ZFW ${zfwMac.toFixed(1)} %MAC`;
    this.cgLabel.position.set(this.X(towArm), ac.body.centerZ + R + 1.4, 0);
    this.zfwLabel.position.set(this.X(zfwArm), ac.body.lowerFloorZ - 2.6, -R);
    // limits on the MAC bar
    const y = ac.body.lowerFloorZ - 1.6, z = -R - 1.2;
    if (limits) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(((limits[1] - limits[0]) / 100) * ac.mac, 0.2, 0.2), new THREE.MeshBasicMaterial({ color: 0x0ca30c, transparent: true, opacity: 0.55 }));
      band.position.set(this.X(ac.lemac + (((limits[0] + limits[1]) / 2) / 100) * ac.mac), y, z);
      this.cgGroup.add(band);
    }
    const tick = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.6, 4), new THREE.MeshBasicMaterial({ color: ok ? 0xffffff : 0xd03b3b }));
    tick.rotation.x = Math.PI;
    tick.position.set(this.X(towArm), y + 0.5, z);
    this.cgGroup.add(tick);
    this.dirty = true;
  }

  private bindPointer() {
    const el = this.renderer.domElement;
    let down: { x: number; y: number } | null = null;
    el.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY }));
    el.addEventListener('pointerup', (e) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
      down = null;
      const r = el.getBoundingClientRect();
      this.ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), this.camera);
      const hits = this.ray.intersectObjects([...this.ulds.values()].filter((v) => v.group.visible).map((v) => v.body), false);
      this.onPick((hits[0]?.object.userData.uldId as string | undefined) ?? null);
    });
  }

  private resize() {
    const w = Math.max(1, this.host.clientWidth), h = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(w, h, false);
    this.labels.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.dirty = true;
  }

  get animating(): boolean {
    for (const v of this.ulds.values()) if (v.anim < 1) return true;
    return false;
  }

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    const dt = Math.min(0.25, (now - this.lastT) / 1000);
    this.lastT = now;
    let anim = false;
    for (const v of this.ulds.values()) {
      if (v.anim >= 1) continue;
      anim = true;
      v.anim = Math.min(1, v.anim + dt * 0.95);
      if (v.anim <= 0) continue;
      v.group.visible = true;
      const e = easeInOutCubic(v.anim);
      if (e < 0.4) v.group.position.lerpVectors(v.start, v.via, e / 0.4);
      else v.group.position.lerpVectors(v.via, v.target, (e - 0.4) / 0.6);
    }
    const moved = this.controls.update(dt);
    if (moved || anim || this.dirty) {
      this.renderer.render(this.scene, this.camera);
      this.labels.render(this.scene, this.camera);
      this.dirty = false;
    }
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.clearUlds();
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.labels.domElement.remove();
  }
}
