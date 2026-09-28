import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { Shipment } from '../domain/cargo';
import type { BuiltUld } from '../domain/packing/buildup';
import type { Placement } from '../domain/packing/packer';
import { uldType, type UldType } from '../domain/uld';
import { handlingOf, shipmentColor, tempColor, weightColor, type ColorMode, STATUS } from '../ui/colors';
import { buildUldShell, createRenderer, dgLabelTexture, easeInOutCubic, easeOutCubic, environment, gridTexture, uldCentreX, type GlInfo } from './common';

const FLOOR = -0.46;
const GAP = 0.004; // visual gap between pieces (m)

interface ItemVisual {
  mesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>;
  edges: THREE.LineSegments<THREE.EdgesGeometry, THREE.LineBasicMaterial>;
  pl: Placement;
  ship: Shipment;
  home: THREE.Vector3;
  decals: THREE.Mesh[];
  appear: number; // 0..1 drop-in progress
  color: THREE.Color;
}

export type MoverKind = 'tip' | 'shift' | 'transient';

export class UldScene {
  readonly info: GlInfo;
  private renderer: THREE.WebGLRenderer;
  private labels: CSS2DRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(38, 1, 0.05, 200);
  private controls: OrbitControls;
  private root = new THREE.Group(); // shell + items (shaken during stress tests)
  private itemsGroup = new THREE.Group();
  private shell: THREE.Group | null = null;
  private dolly = new THREE.Group();
  private cgMarker = new THREE.Group();
  private arrow: THREE.ArrowHelper;
  private arrowLabel: CSS2DObject;
  private idLabel: CSS2DObject;
  private cgLabel: CSS2DObject;
  private items: ItemVisual[] = [];
  private byPiece = new Map<string, ItemVisual>();
  private unitBox = new THREE.BoxGeometry(1, 1, 1);
  private unitEdges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
  private raf = 0;
  private dirty = true;
  private host: HTMLElement;
  private ro: ResizeObserver;
  private ray = new THREE.Raycaster();
  private uld: BuiltUld | null = null;
  private type: UldType | null = null;
  private mode: ColorMode = 'handling';
  private xray = false;
  private explode = 0;
  private explodeTarget = 0;
  private seqStep: number | null = null;
  private selected: string | null = null;
  private hovered: string | null = null;
  private movers = new Map<string, MoverKind>();
  private physics = false;
  private shake = new THREE.Vector3();
  private shakeT = 0;
  private maxWeight = 1;
  private disposed = false;
  private lastT = performance.now();
  private tweens: { update: (dt: number) => boolean }[] = [];
  onPick: (pieceId: string | null) => void = () => {};
  onHover: (pieceId: string | null, x: number, y: number) => void = () => {};

  constructor(host: HTMLElement) {
    this.host = host;
    const { renderer, info } = createRenderer(host);
    this.renderer = renderer;
    this.info = info;
    this.labels = new CSS2DRenderer();
    this.labels.domElement.className = 'labels-layer';
    host.appendChild(this.labels.domElement);

    const bg = new THREE.Color('#0a1316');
    this.scene.background = bg;
    this.scene.fog = new THREE.Fog(bg, 16, 48);
    this.scene.environment = environment(renderer);
    this.scene.environmentIntensity = 0.55;

    this.scene.add(new THREE.HemisphereLight(0xbfe9e0, 0x0b1214, 0.9));
    const key = new THREE.DirectionalLight(0xfff4e6, 1.6);
    key.position.set(4.5, 7.5, 5.5);
    key.castShadow = renderer.shadowMap.enabled;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -4;
    key.shadow.camera.right = 4;
    key.shadow.camera.top = 4;
    key.shadow.camera.bottom = -4;
    key.shadow.bias = -0.0008;
    key.shadow.normalBias = 0.02;
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x5fe0c4, 0.8);
    rim.position.set(-6, 3, -5);
    this.scene.add(rim);

    this.buildHangar();
    this.scene.add(this.dolly);
    this.root.add(this.itemsGroup);
    this.scene.add(this.root);

    // CG marker
    const cgSphere = new THREE.Mesh(new THREE.SphereGeometry(0.045, 24, 16), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfab219, emissiveIntensity: 1.2 }));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.006, 8, 48), new THREE.MeshBasicMaterial({ color: 0xfab219 }));
    ring.rotation.x = Math.PI / 2;
    const ring2 = ring.clone();
    ring2.rotation.set(0, 0, 0);
    this.cgMarker.add(cgSphere, ring, ring2);
    this.cgMarker.name = 'cg';
    this.root.add(this.cgMarker);
    this.cgLabel = this.label('ULD CG', 'tag tag-cg');
    this.cgLabel.position.set(0.12, 0.1, 0);
    this.cgMarker.add(this.cgLabel);

    this.arrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(), 1, 0xec835a, 0.22, 0.12);
    this.arrow.visible = false;
    this.scene.add(this.arrow);
    this.arrowLabel = this.label('', 'tag tag-load');
    this.arrowLabel.visible = false;
    this.scene.add(this.arrowLabel);
    this.idLabel = this.label('', 'tag tag-id');
    this.scene.add(this.idLabel);

    this.camera.position.set(4.2, 3.2, 5.2);
    this.controls = new OrbitControls(this.camera, renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.target.set(0, 0.8, 0);
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.minDistance = 1.5;
    this.controls.maxDistance = 18;
    this.controls.autoRotateSpeed = 0.6;
    this.controls.addEventListener('change', () => (this.dirty = true));

    this.bindPointer();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();
    this.setUld(null, new Map());
    this.loop();
  }

  private label(text: string, cls: string): CSS2DObject {
    const el = document.createElement('div');
    el.className = cls;
    el.textContent = text;
    return new CSS2DObject(el);
  }

  private buildHangar() {
    const tex = gridTexture();
    tex.repeat.set(18, 18);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.82, metalness: 0.15 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = FLOOR;
    floor.receiveShadow = true;
    this.scene.add(floor);
    // painted work-area box and hatched safety border
    const yellow = new THREE.MeshBasicMaterial({ color: 0xd9a21b, transparent: true, opacity: 0.55 });
    const border = (w: number, d: number) => {
      const g = new THREE.Group();
      const t = 0.06;
      for (const [sx, sz, px, pz] of [[w, t, 0, -d / 2], [w, t, 0, d / 2], [t, d, -w / 2, 0], [t, d, w / 2, 0]] as const) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(sx, sz), yellow);
        m.rotation.x = -Math.PI / 2;
        m.position.set(px, FLOOR + 0.002, pz);
        g.add(m);
      }
      return g;
    };
    this.scene.add(border(6.2, 5.4));
    // hangar arches, light strips and back wall ribs
    const archMat = new THREE.MeshStandardMaterial({ color: 0x1b2e33, metalness: 0.6, roughness: 0.5 });
    for (let i = 0; i < 4; i++) {
      const arch = new THREE.Mesh(new THREE.TorusGeometry(19, 0.22, 8, 64, Math.PI), archMat);
      arch.position.set(0, FLOOR, -14 - i * 7);
      this.scene.add(arch);
    }
    const stripMat = new THREE.MeshBasicMaterial({ color: 0xcff7ee });
    for (let i = 0; i < 4; i++) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(9, 0.05, 0.25), stripMat);
      strip.position.set(-6 + (i % 2) * 12, 11, -10 - Math.floor(i / 2) * 10);
      this.scene.add(strip);
    }
    const wallMat = new THREE.LineBasicMaterial({ color: 0x2a4a4f, transparent: true, opacity: 0.6 });
    const pts: THREE.Vector3[] = [];
    for (let x = -30; x <= 30; x += 2.5) pts.push(new THREE.Vector3(x, FLOOR, -36), new THREE.Vector3(x, 14, -36));
    this.scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), wallMat));
    // parked-equipment silhouettes (other ULDs on dollies) for depth
    const ghost = new THREE.MeshStandardMaterial({ color: 0x1a2a2e, roughness: 0.8 });
    for (const [x, z, w, h] of [[-7.5, -6, 3.2, 2.4], [7.8, -7.5, 2.0, 1.6], [-9.5, 2.5, 2.0, 1.6]] as const) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 2.4), ghost);
      b.position.set(x, FLOOR + h / 2 + 0.4, z);
      this.scene.add(b);
    }
  }

  private buildDolly(t: UldType | null) {
    this.dolly.clear();
    const w = t ? t.external.width / 100 + 0.2 : 2.3;
    const d = t ? t.external.depth / 100 + 0.2 : 1.8;
    const steel = new THREE.MeshStandardMaterial({ color: 0x2c3b40, metalness: 0.7, roughness: 0.45 });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), steel);
    deck.position.y = -0.04;
    deck.receiveShadow = deck.castShadow = true;
    this.dolly.add(deck);
    const rollerMat = new THREE.MeshStandardMaterial({ color: 0x9aa9ad, metalness: 0.8, roughness: 0.3 });
    const rollers = Math.floor(d / 0.25);
    const roller = new THREE.CylinderGeometry(0.025, 0.025, w - 0.1, 10);
    const inst = new THREE.InstancedMesh(roller, rollerMat, rollers);
    const m = new THREE.Matrix4();
    for (let i = 0; i < rollers; i++) {
      m.makeRotationZ(Math.PI / 2);
      m.setPosition(0, 0.0, -d / 2 + 0.12 + i * 0.25);
      inst.setMatrixAt(i, m);
    }
    this.dolly.add(inst);
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(w - 0.3, 0.16, d - 0.3), steel);
    chassis.position.y = -0.18;
    this.dolly.add(chassis);
    const wheel = new THREE.CylinderGeometry(0.14, 0.14, 0.1, 20);
    const tyre = new THREE.MeshStandardMaterial({ color: 0x111719, roughness: 0.9 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const wh = new THREE.Mesh(wheel, tyre);
      wh.rotation.z = Math.PI / 2;
      wh.position.set(sx * (w / 2 - 0.2), FLOOR + 0.14, sz * (d / 2 - 0.3));
      this.dolly.add(wh);
    }
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1.2), steel);
    bar.position.set(0, -0.2, d / 2 + 0.6);
    bar.rotation.x = 0.25;
    this.dolly.add(bar);
  }

  private demo = false;

  /** Idle showcase: a real packed ULD, slowly turning, without the planning annotations. */
  setDemo(uld: BuiltUld, ships: Map<string, Shipment>) {
    this.setUld(uld, ships);
    this.demo = true;
    this.controls.autoRotate = true;
    this.cgMarker.visible = false;
    this.idLabel.visible = false;
    for (const o of this.cgGuides) o.visible = false;
    this.mode = 'shipment';
    this.applyColors();
    this.frame(this.type!, true);
  }

  /** Load a built ULD (or null for the idle demo shell). */
  setUld(uld: BuiltUld | null, ships: Map<string, Shipment>) {
    this.demo = false;
    this.clearItems();
    if (this.shell) this.root.remove(this.shell);
    this.uld = uld;
    const t = uld ? uldType(uld.typeId) : uldType('AKE');
    this.type = t;
    this.shell = buildUldShell(t);
    this.root.add(this.shell);
    this.buildDolly(t);
    this.movers.clear();
    this.physics = false;
    this.controls.autoRotate = !uld;
    this.cgMarker.visible = !!uld;
    this.idLabel.visible = !!uld;
    if (uld) {
      this.maxWeight = Math.max(...uld.placements.map((p) => p.weight), 1);
      const cx = uldCentreX(t);
      for (const pl of uld.placements) {
        const ship = ships.get(pl.shipmentId);
        if (!ship) continue;
        const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.68, metalness: 0.02 });
        const mesh = new THREE.Mesh(this.unitBox, mat);
        mesh.scale.set(pl.w / 100 - GAP, pl.h / 100 - GAP, pl.d / 100 - GAP);
        const home = new THREE.Vector3((pl.x + pl.w / 2 - cx) / 100, (pl.y + pl.h / 2) / 100, (pl.z + pl.d / 2 - t.external.depth / 2) / 100);
        mesh.position.copy(home);
        mesh.castShadow = mesh.receiveShadow = this.renderer.shadowMap.enabled;
        mesh.userData.pieceId = pl.pieceId;
        const edges = new THREE.LineSegments(this.unitEdges, new THREE.LineBasicMaterial({ color: 0x0a1416, transparent: true, opacity: 0.55 }));
        mesh.add(edges);
        const decals: THREE.Mesh[] = [];
        if (ship.dg) {
          const s = Math.min(0.2, (Math.min(pl.w, pl.h, pl.d) / 100) * 0.55);
          const tex = dgLabelTexture(ship.dg.cls);
          const mk = () => new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }));
          const front = mk();
          front.scale.set(s / mesh.scale.x, s / mesh.scale.y, 1);
          front.position.set(0, 0.1, 0.502);
          mesh.add(front);
          const side = mk();
          side.rotation.y = Math.PI / 2;
          side.scale.set(s / mesh.scale.z, s / mesh.scale.y, 1);
          side.position.set(0.502, 0.1, 0);
          mesh.add(side);
          decals.push(front, side);
        }
        this.itemsGroup.add(mesh);
        const v: ItemVisual = { mesh, edges, pl, ship, home, decals, appear: 1, color: new THREE.Color() };
        this.items.push(v);
        this.byPiece.set(pl.pieceId, v);
      }
      // CG marker
      this.cgMarker.position.set((uld.cg.x - cx) / 100, uld.cg.y / 100, (uld.cg.z - t.external.depth / 2) / 100);
      (this.cgLabel.element as HTMLElement).textContent = `ULD CG · ${uld.cgOffsetPct.x >= 0 ? '+' : ''}${uld.cgOffsetPct.x.toFixed(1)}% lat · ${uld.cgOffsetPct.z >= 0 ? '+' : ''}${uld.cgOffsetPct.z.toFixed(1)}% long`;
      this.addCgGuides(t, cx);
      (this.idLabel.element as HTMLElement).innerHTML = `<b>${uld.id}</b><span>${t.iata} · ${t.contour} · ${Math.round(uld.gross).toLocaleString('en-US')} kg</span>`;
      this.idLabel.position.set(0, t.external.height / 100 + 0.28, 0);
      this.applyColors();
      this.frame(t);
    } else {
      this.frame(t, true);
    }
    this.dirty = true;
  }

  private cgGuides: THREE.Object3D[] = [];
  private addCgGuides(t: UldType, cx: number) {
    for (const o of this.cgGuides) this.root.remove(o);
    this.cgGuides = [];
    const u = this.uld!;
    const p = this.cgMarker.position;
    const mat = new THREE.LineDashedMaterial({ color: 0xfab219, dashSize: 0.05, gapSize: 0.035, transparent: true, opacity: 0.9 });
    const drop = new THREE.Line(new THREE.BufferGeometry().setFromPoints([p.clone(), new THREE.Vector3(p.x, 0.025, p.z)]), mat);
    drop.computeLineDistances();
    // +/-10 % CG tolerance box on the base (planning guideline)
    const bx = (t.baseWidth / 100) * 0.1, bz = (t.external.depth / 100) * 0.1;
    const baseCx = (t.kind === 'container' ? ((t.outline.filter((q) => q[1] === 0).reduce((s, q) => s + q[0], 0) / 2) - cx) : 0) / 100;
    const y = 0.026;
    const box = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(baseCx - bx, y, -bz), new THREE.Vector3(baseCx + bx, y, -bz), new THREE.Vector3(baseCx + bx, y, bz), new THREE.Vector3(baseCx - bx, y, bz),
      ]),
      new THREE.LineBasicMaterial({ color: Math.abs(u.cgOffsetPct.x) > 10 || Math.abs(u.cgOffsetPct.z) > 10 ? 0xd03b3b : 0x5fe0c4, transparent: true, opacity: 0.8 }),
    );
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.035, 24), new THREE.MeshBasicMaterial({ color: 0xfab219 }));
    dot.rotation.x = -Math.PI / 2;
    dot.position.set(p.x, y + 0.001, p.z);
    for (const o of [drop, box, dot]) {
      this.root.add(o);
      this.cgGuides.push(o);
    }
  }

  private frame(t: UldType, idle = false) {
    const w = t.external.width / 100, h = t.external.height / 100, d = t.external.depth / 100;
    const r = Math.hypot(w, h, d) / 2;
    const dist = r * (idle ? 4.6 : 3.55);
    this.controls.target.set(0, idle ? -0.55 : h * 0.36, 0);
    const dir = new THREE.Vector3(0.62, idle ? 0.42 : 0.5, 0.78).normalize();
    this.camera.position.copy(this.controls.target).addScaledVector(dir, dist);
    this.controls.update();
  }

  private clearItems() {
    for (const v of this.items) {
      v.mesh.material.dispose();
      v.edges.material.dispose();
      for (const dcl of v.decals) {
        dcl.geometry.dispose();
        (dcl.material as THREE.Material).dispose();
      }
    }
    this.itemsGroup.clear();
    this.items = [];
    this.byPiece.clear();
    for (const o of this.cgGuides) this.root.remove(o);
    this.cgGuides = [];
  }

  setColorMode(mode: ColorMode) {
    if (this.demo) return;
    this.mode = mode;
    this.applyColors();
  }

  private baseColor(v: ItemVisual): string {
    switch (this.mode) {
      case 'shipment': {
        const idx = Number(/\d+/.exec(v.ship.id)?.[0] ?? 0) - 1;
        return shipmentColor(Math.max(0, idx));
      }
      case 'handling':
        return handlingOf(v.ship).color;
      case 'weight':
        return weightColor(Math.sqrt(v.pl.weight / this.maxWeight));
      case 'temperature':
        return tempColor(v.ship);
    }
  }

  private applyColors() {
    const focusMovers = this.movers.size > 0;
    for (const v of this.items) {
      const mv = this.movers.get(v.pl.pieceId);
      let hex = this.baseColor(v);
      if (focusMovers) hex = mv === 'tip' ? STATUS.critical : mv === 'shift' ? STATUS.serious : mv === 'transient' ? STATUS.warning : '#4a6064';
      v.color.set(hex);
      const m = v.mesh.material;
      m.color.copy(v.color);
      const sel = this.selected === v.pl.pieceId;
      const hov = this.hovered === v.pl.pieceId;
      m.emissive.set(sel ? 0x3de0c0 : hov ? 0x1f5f55 : mv && focusMovers ? hex : 0x000000);
      m.emissiveIntensity = sel ? 0.55 : hov ? 0.5 : mv ? 0.25 : 0;
      const ghost = this.xray || (focusMovers && !mv);
      m.transparent = ghost;
      m.opacity = this.xray ? (sel ? 0.9 : 0.26) : focusMovers && !mv ? 0.22 : 1;
      m.depthWrite = !ghost;
      m.needsUpdate = true;
      v.edges.material.color.set(sel ? 0xffffff : this.xray ? v.color.clone().offsetHSL(0, 0, 0.25) : focusMovers && !mv ? 0x6f8a8e : 0x0a1416);
      v.edges.material.opacity = sel ? 1 : this.xray ? 0.9 : 0.55;
      v.mesh.castShadow = !ghost && this.renderer.shadowMap.enabled;
    }
    this.dirty = true;
  }

  setXray(on: boolean) {
    this.xray = on;
    this.applyColors();
  }

  setExplode(on: boolean) {
    this.explodeTarget = on ? 1 : 0;
    this.dirty = true;
  }

  setSelected(pieceId: string | null) {
    this.selected = pieceId;
    this.applyColors();
  }

  /** Show pieces 1..step (build-sequence playback); null shows everything. */
  setSequence(step: number | null, animate = true) {
    const prev = this.seqStep;
    this.seqStep = step;
    for (const v of this.items) {
      const visible = step === null || v.pl.seq <= step;
      v.mesh.visible = visible;
      if (visible && animate && step !== null && v.pl.seq === step && (prev === null || step > prev)) v.appear = 0;
      else if (visible) v.appear = 1;
    }
    this.dirty = true;
  }

  setMovers(m: Map<string, MoverKind> | null) {
    this.movers = m ?? new Map();
    this.applyColors();
  }

  /** Physics frame: piece transforms (ULD frame, metres, placement order) and effective g. */
  setPhysicsFrame(buf: Float32Array | null, g: [number, number, number] | null, caption = '') {
    const t = this.type;
    if (!t) return;
    if (!buf) {
      this.physics = false;
      this.arrow.visible = false;
      this.arrowLabel.visible = false;
      this.shake.set(0, 0, 0);
      for (const v of this.items) v.mesh.quaternion.identity();
      this.dirty = true;
      return;
    }
    this.physics = true;
    const cx = uldCentreX(t) / 100, cz = t.external.depth / 200;
    this.items.forEach((v, i) => {
      const o = i * 7;
      if (o + 6 >= buf.length) return;
      v.mesh.position.set(buf[o] - cx, buf[o + 1], buf[o + 2] - cz);
      v.mesh.quaternion.set(buf[o + 3], buf[o + 4], buf[o + 5], buf[o + 6]);
      v.mesh.visible = true;
    });
    if (g) {
      const lateral = new THREE.Vector3(g[0], 0, g[2]);
      const vert = g[1] + 1; // deviation from 1 g
      const mag = Math.hypot(lateral.length(), vert);
      this.shake.set(g[0] * 0.05, -vert * 0.03, g[2] * 0.05);
      this.shakeT += 1;
      if (mag > 0.05) {
        const dir = lateral.length() > Math.abs(vert) ? lateral.normalize() : new THREE.Vector3(0, vert < 0 ? -1 : 1, 0);
        const h = t.external.height / 100;
        const origin = new THREE.Vector3(0, h + 0.5, 0).addScaledVector(dir, -0.6 * Math.min(1.5, mag));
        this.arrow.position.copy(origin);
        this.arrow.setDirection(dir);
        this.arrow.setLength(0.4 + 0.6 * Math.min(1.5, mag), 0.2, 0.12);
        this.arrow.visible = true;
        this.arrowLabel.position.copy(origin).add(new THREE.Vector3(0, 0.22, 0));
        (this.arrowLabel.element as HTMLElement).textContent = caption;
        this.arrowLabel.visible = !!caption;
      } else {
        this.arrow.visible = false;
        this.arrowLabel.visible = false;
      }
    }
    this.dirty = true;
  }

  private bindPointer() {
    const el = this.renderer.domElement;
    let down: { x: number; y: number } | null = null;
    const pick = (ev: PointerEvent): string | null => {
      const r = el.getBoundingClientRect();
      const ndc = new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
      this.ray.setFromCamera(ndc, this.camera);
      const hits = this.ray.intersectObjects(this.items.filter((v) => v.mesh.visible).map((v) => v.mesh), false);
      return (hits[0]?.object.userData.pieceId as string | undefined) ?? null;
    };
    el.addEventListener('pointerdown', (ev) => (down = { x: ev.clientX, y: ev.clientY }));
    el.addEventListener('pointerup', (ev) => {
      if (down && Math.hypot(ev.clientX - down.x, ev.clientY - down.y) < 5) this.onPick(pick(ev));
      down = null;
    });
    let last = 0;
    el.addEventListener('pointermove', (ev) => {
      const now = performance.now();
      if (now - last < 40 || (ev.buttons & 1)) return;
      last = now;
      const id = pick(ev);
      if (id !== this.hovered) {
        this.hovered = id;
        this.applyColors();
      }
      const r = el.getBoundingClientRect();
      this.onHover(id, ev.clientX - r.left, ev.clientY - r.top);
      el.style.cursor = id ? 'pointer' : 'grab';
    });
    el.addEventListener('pointerleave', () => {
      if (this.hovered) {
        this.hovered = null;
        this.applyColors();
      }
      this.onHover(null, 0, 0);
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

  /** Nudge the camera (keyboard shortcuts / buttons). */
  resetView() {
    if (this.type) this.frame(this.type, !this.uld || this.demo);
    this.dirty = true;
  }

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastT) / 1000);
    this.lastT = now;
    let animating = this.controls.autoRotate;
    // explode easing
    if (Math.abs(this.explode - this.explodeTarget) > 1e-3 && !this.physics) {
      this.explode += Math.sign(this.explodeTarget - this.explode) * Math.min(Math.abs(this.explodeTarget - this.explode), dt * 2.2);
      animating = true;
    }
    if (!this.physics) {
      const e = easeInOutCubic(this.explode);
      for (const v of this.items) {
        if (v.appear < 1) {
          v.appear = Math.min(1, v.appear + dt * 2.8);
          animating = true;
        }
        const drop = (1 - easeOutCubic(v.appear)) * 0.9;
        v.mesh.position.set(v.home.x * (1 + 0.65 * e), v.home.y * (1 + 0.55 * e) + 0.04 * e + drop, v.home.z * (1 + 0.65 * e));
      }
      this.root.position.set(0, 0, 0);
    } else {
      const j = Math.sin(this.shakeT * 2.3) * 0.55 + 0.45;
      this.root.position.copy(this.shake).multiplyScalar(j);
    }
    for (let i = this.tweens.length - 1; i >= 0; i--) if (!this.tweens[i].update(dt)) this.tweens.splice(i, 1);
    if (this.tweens.length) animating = true;
    const moved = this.controls.update(dt);
    if (moved || this.dirty || animating) {
      this.renderer.render(this.scene, this.camera);
      this.labels.render(this.scene, this.camera);
      this.dirty = false;
    }
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.clearItems();
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.labels.domElement.remove();
  }
}
