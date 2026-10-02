import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Point3, TransportMode } from './model';
import type { SceneColorMode, ScenePiece, SceneSpace } from './sceneTypes';

const ACCENT = '#635bff';
const INK = '#26314a';
const BACKGROUND = '#eff1f6';

interface WorldDimensions {
  width: number;
  height: number;
  length: number;
  size: number;
  detail: number;
  groundY: number;
}

interface CargoVisual {
  piece: ScenePiece;
  group: THREE.Group;
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  labelGroup: THREE.Group;
  selection: THREE.Group;
  anchor: THREE.Vector3;
  tether: THREE.Line;
}

export interface SceneWorld {
  scene: THREE.Scene;
  dimensions: WorldDimensions;
  shell: THREE.Group;
  cargo: CargoVisual[];
  center: THREE.Group;
  cameraTarget: THREE.Vector3;
  dispose: () => void;
}

interface BoxOptions {
  dimensions: [number, number, number];
  position: [number, number, number];
  material: THREE.Material;
  radius?: number;
  castShadow?: boolean;
}

function box(parent: THREE.Object3D, options: BoxOptions) {
  const [width, height, length] = options.dimensions;
  const geometry = options.radius
    ? new RoundedBoxGeometry(width, height, length, 2, options.radius)
    : new THREE.BoxGeometry(width, height, length);
  const mesh = new THREE.Mesh(geometry, options.material);
  mesh.position.set(...options.position);
  mesh.castShadow = options.castShadow ?? true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function standardMaterial(color: string, options: THREE.MeshStandardMaterialParameters = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.65, metalness: 0.04, ...options });
}

function line(parent: THREE.Object3D, points: THREE.Vector3[], material: THREE.LineBasicMaterial | THREE.LineDashedMaterial) {
  const object = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material);
  if (material instanceof THREE.LineDashedMaterial) object.computeLineDistances();
  parent.add(object);
  return object;
}

interface SpriteStyle {
  color?: string;
  background?: string;
  fontSize?: number;
}

function textSprite(text: string, width: number, style: SpriteStyle = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (!context) return new THREE.Sprite();
  context.fillStyle = style.background ?? '#fafbff';
  context.beginPath();
  context.roundRect(0, 0, canvas.width, canvas.height, 18);
  context.fill();
  context.strokeStyle = '#d4d9e8';
  context.lineWidth = 3;
  context.stroke();
  context.fillStyle = style.color ?? '#384363';
  context.font = `650 ${style.fontSize ?? 42}px Inter, system-ui, sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, canvas.width / 2, canvas.height / 2, canvas.width - 28);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true, toneMapped: false, fog: false }));
  sprite.scale.set(width, width * canvas.height / canvas.width, 1);
  sprite.renderOrder = 8;
  return sprite;
}

function addFloor(scene: THREE.Scene, dimensions: WorldDimensions) {
  const { width, length, size, detail, groundY } = dimensions;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(size * 16, size * 16), standardMaterial(BACKGROUND, { roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = groundY;
  ground.receiveShadow = true;
  scene.add(ground);
  const studioGrid = new THREE.GridHelper(size * 2.6, 30, '#d8deea', '#e0e4ed');
  studioGrid.position.y = groundY + detail * 0.002;
  studioGrid.material.opacity = 0.55;
  studioGrid.material.transparent = true;
  scene.add(studioGrid);

  box(scene, { dimensions: [width + detail * 0.07, detail * 0.095, length + detail * 0.07], position: [0, -detail * 0.05, 0], material: standardMaterial('#e2e6ef', { metalness: 0.3 }) });
  box(scene, { dimensions: [width, detail * 0.008, length], position: [0, -detail * 0.005, 0], material: standardMaterial('#fafbfe', { roughness: 0.85 }) });
  const gridMaterial = new THREE.LineBasicMaterial({ color: '#d4dae7', transparent: true, opacity: 0.62 });
  const across = Math.max(4, Math.min(24, Math.ceil(width / 0.3)));
  const along = Math.max(6, Math.min(48, Math.ceil(length / 0.3)));
  for (let index = 0; index <= across; index++) {
    const x = -width / 2 + width * index / across;
    line(scene, [new THREE.Vector3(x, 0.002 * detail, -length / 2), new THREE.Vector3(x, 0.002 * detail, length / 2)], gridMaterial);
  }
  for (let index = 0; index <= along; index++) {
    const z = -length / 2 + length * index / along;
    line(scene, [new THREE.Vector3(-width / 2, 0.002 * detail, z), new THREE.Vector3(width / 2, 0.002 * detail, z)], gridMaterial);
  }
}

function addLoadBounds(scene: THREE.Scene, space: SceneSpace, dimensions: WorldDimensions) {
  const { width, height, length, detail, size } = dimensions;
  const geometry = new THREE.BoxGeometry(width, height, length);
  const frame = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.32 }));
  geometry.dispose();
  frame.position.y = height / 2;
  scene.add(frame);

  const clearance = Math.min(space.clearanceCm / 100, width / 2, height, length / 2);
  const reservedDepth = Math.min(space.reservedDepthCm / 100, length);
  const usableWidth = width - clearance * 2;
  const usableLength = length - clearance * 2 - reservedDepth;
  if (clearance > 0 && usableWidth > 0 && usableLength > 0) {
    const material = new THREE.LineDashedMaterial({ color: '#9299b7', transparent: true, opacity: 0.55, dashSize: detail * 0.035, gapSize: detail * 0.025 });
    const left = -width / 2 + clearance;
    const right = width / 2 - clearance;
    const front = -length / 2 + clearance;
    const rear = length / 2 - clearance - reservedDepth;
    line(scene, [new THREE.Vector3(left, detail * 0.005, front), new THREE.Vector3(right, detail * 0.005, front), new THREE.Vector3(right, detail * 0.005, rear), new THREE.Vector3(left, detail * 0.005, rear), new THREE.Vector3(left, detail * 0.005, front)], material);
  }
  if (reservedDepth > 0) {
    const zone = new THREE.Group();
    const material = standardMaterial('#ffb77b', { transparent: true, opacity: 0.14, depthWrite: false });
    box(zone, { dimensions: [width, height, reservedDepth], position: [0, height / 2, length / 2 - reservedDepth / 2], material, castShadow: false });
    const stripes = new THREE.LineBasicMaterial({ color: '#e6a169', transparent: true, opacity: 0.5 });
    for (let index = 0; index < 12; index++) {
      const x = -width / 2 + width * index / 12;
      line(zone, [new THREE.Vector3(x, detail * 0.012, length / 2 - reservedDepth), new THREE.Vector3(Math.min(width / 2, x + reservedDepth), detail * 0.012, length / 2)], stripes);
    }
    const tag = textSprite('RESERVED · KEEP CLEAR', Math.min(width * 0.8, size * 0.4), { color: '#9d5b2e', background: '#fff4e8' });
    tag.position.set(0, height + detail * 0.13, length / 2 - reservedDepth / 2);
    zone.add(tag);
    scene.add(zone);
  }
}

interface DimensionGuide {
  start: THREE.Vector3;
  end: THREE.Vector3;
  text: string;
  labelPosition: THREE.Vector3;
  labelWidth: number;
}

function addDimensionGuide(scene: THREE.Scene, guide: DimensionGuide) {
  const material = new THREE.LineBasicMaterial({ color: '#7985a4', transparent: true, opacity: 0.85, toneMapped: false });
  line(scene, [guide.start, guide.end], material);
  const direction = guide.end.clone().sub(guide.start).normalize();
  const length = guide.start.distanceTo(guide.end);
  const tickLength = Math.min(length * 0.055, guide.labelWidth * 0.08);
  const tangent = Math.abs(direction.y) > 0.9 ? new THREE.Vector3(1, 0, -1).normalize() : new THREE.Vector3(-direction.z, 0, direction.x);
  for (const point of [guide.start, guide.end]) {
    line(scene, [point.clone().addScaledVector(tangent, -tickLength), point.clone().addScaledVector(tangent, tickLength)], material);
  }
  const label = textSprite(guide.text, guide.labelWidth, { color: '#384363', background: '#ffffff', fontSize: 48 });
  label.position.copy(guide.labelPosition);
  scene.add(label);
}

function addDimensions(scene: THREE.Scene, space: SceneSpace, dimensions: WorldDimensions) {
  const { width, height, length, size, detail } = dimensions;
  const offset = detail * 0.42;
  const labelWidth = Math.min(size * 0.46, detail * 2.1);
  const lengthX = -width / 2 - offset;
  addDimensionGuide(scene, { start: new THREE.Vector3(lengthX, 0, -length / 2), end: new THREE.Vector3(lengthX, 0, length / 2), text: `${space.lengthCm.toLocaleString('en')} cm · LENGTH`, labelPosition: new THREE.Vector3(lengthX - detail * 0.13, detail * 0.035, 0), labelWidth });
  const widthZ = length / 2 + offset;
  addDimensionGuide(scene, { start: new THREE.Vector3(-width / 2, 0, widthZ), end: new THREE.Vector3(width / 2, 0, widthZ), text: `${space.widthCm.toLocaleString('en')} cm · WIDTH`, labelPosition: new THREE.Vector3(0, detail * 0.035, widthZ + detail * 0.12), labelWidth: Math.min(labelWidth, width * 0.86) });
  const heightX = width / 2 + detail * 0.25;
  const heightZ = length / 2 + detail * 0.15;
  addDimensionGuide(scene, { start: new THREE.Vector3(heightX, 0, heightZ), end: new THREE.Vector3(heightX, height, heightZ), text: `${space.heightCm.toLocaleString('en')} cm · HEIGHT`, labelPosition: new THREE.Vector3(heightX + detail * 0.21, height * 0.65, heightZ), labelWidth: labelWidth * 0.85 });
}

function addCutawayWalls(shell: THREE.Group, dimensions: WorldDimensions, mode: TransportMode) {
  const { width, height, length, detail } = dimensions;
  const wallHeight = mode === 'air' ? height * 0.18 : height;
  const wall = standardMaterial('#e1e5ef', { roughness: 0.5, metalness: mode === 'sea' ? 0.2 : 0.08 });
  const rail = standardMaterial('#bac3d7', { metalness: 0.65, roughness: 0.38 });
  const thickness = detail * 0.035;
  box(shell, { dimensions: [thickness, wallHeight, length], position: [width / 2 + thickness / 2, wallHeight / 2, 0], material: wall });
  box(shell, { dimensions: [width, wallHeight, thickness], position: [0, wallHeight / 2, -length / 2 - thickness / 2], material: wall });
  for (const z of [-length / 2, length / 2]) {
    box(shell, { dimensions: [detail * 0.06, height, detail * 0.06], position: [width / 2 + detail * 0.02, height / 2, z], material: rail });
  }
  box(shell, { dimensions: [thickness * 1.5, thickness * 1.5, length + thickness], position: [width / 2 + thickness / 2, wallHeight, 0], material: rail });
  box(shell, { dimensions: [width + thickness, thickness * 1.5, thickness * 1.5], position: [0, wallHeight, -length / 2 - thickness / 2], material: rail });
  const strip = standardMaterial(ACCENT, { roughness: 0.35 });
  box(shell, { dimensions: [detail * 0.012, detail * 0.08, length * 0.8], position: [width / 2 - detail * 0.025, wallHeight * 0.82, 0], material: strip });

  if (mode === 'sea' || mode === 'rail') {
    const ribs = standardMaterial('#c9d1e1', { metalness: 0.32 });
    const count = Math.min(64, Math.max(12, Math.ceil(length / 0.25)));
    for (let index = 0; index < count; index++) {
      box(shell, { dimensions: [detail * 0.03, wallHeight * 0.89, detail * 0.035], position: [width / 2 - detail * 0.016, wallHeight / 2, -length / 2 + length * (index + 0.5) / count], material: ribs });
    }
    const frontCount = Math.max(5, Math.ceil(width / 0.25));
    for (let index = 0; index < frontCount; index++) {
      box(shell, { dimensions: [detail * 0.035, wallHeight * 0.89, detail * 0.03], position: [-width / 2 + width * (index + 0.5) / frontCount, wallHeight / 2, -length / 2 + detail * 0.016], material: ribs });
    }
  }
  if (mode === 'sea') {
    const casting = standardMaterial('#7d8ca8', { metalness: 0.72, roughness: 0.4 });
    for (const x of [-width / 2, width / 2]) {
      for (const z of [-length / 2, length / 2]) {
        box(shell, { dimensions: [detail * 0.13, detail * 0.11, detail * 0.13], position: [x, -detail * 0.075, z], material: casting, radius: detail * 0.014 });
      }
    }
  }
}

interface WheelOptions {
  x: number;
  y: number;
  z: number;
  radius: number;
  depth: number;
  tire: THREE.Material;
  hub: THREE.Material;
}

function addWheel(shell: THREE.Group, options: WheelOptions) {
  const wheel = new THREE.Group();
  wheel.position.set(options.x, options.y, options.z);
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(options.radius, options.radius, options.depth, 24), options.tire);
  tire.rotation.z = Math.PI / 2;
  tire.castShadow = true;
  wheel.add(tire);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(options.radius * 0.56, options.radius * 0.56, options.depth * 1.04, 16), options.hub);
  hub.rotation.z = Math.PI / 2;
  wheel.add(hub);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(options.radius * 0.18, options.radius * 0.18, options.depth * 1.08, 12), standardMaterial('#b9c5da', { metalness: 0.65 }));
  cap.rotation.z = Math.PI / 2;
  wheel.add(cap);
  shell.add(wheel);
}

function addRoadShell(shell: THREE.Group, dimensions: WorldDimensions) {
  const { width, height, length, detail } = dimensions;
  const chassis = standardMaterial('#333e57', { metalness: 0.3 });
  const tire = standardMaterial('#293043', { roughness: 0.95 });
  const hub = standardMaterial('#7b89a4', { metalness: 0.75, roughness: 0.35 });
  const radius = Math.min(width * 0.13, detail * 0.34);
  const wheelY = -radius - detail * 0.105;
  box(shell, { dimensions: [width * 0.83, detail * 0.14, length], position: [0, -detail * 0.145, 0], material: chassis });
  const rearAxles = length > width * 2.1 ? [length * 0.21, length * 0.32] : [length * 0.28];
  for (const z of rearAxles) {
    for (const x of [-width / 2, width / 2]) {
      addWheel(shell, { x, y: wheelY, z, radius, depth: detail * 0.17, tire, hub });
    }
  }
  const cabLength = Math.min(length * 0.38, width * 0.79);
  const cabHeight = Math.min(height * 0.77, width * 0.95);
  const cabZ = -length / 2 - cabLength / 2 - detail * 0.04;
  box(shell, { dimensions: [width * 0.94, cabHeight, cabLength], position: [0, cabHeight / 2 - detail * 0.05, cabZ], material: standardMaterial('#f4f5fb', { roughness: 0.35 }), radius: detail * 0.1 });
  box(shell, { dimensions: [width * 0.96, detail * 0.12, cabLength * 0.96], position: [0, detail * 0.1, cabZ], material: standardMaterial(ACCENT, { roughness: 0.38 }), radius: detail * 0.025 });
  const glass = standardMaterial('#35486b', { roughness: 0.16, metalness: 0.45 });
  box(shell, { dimensions: [width * 0.79, cabHeight * 0.31, detail * 0.015], position: [0, cabHeight * 0.68, cabZ - cabLength / 2 - detail * 0.01], material: glass, radius: detail * 0.006 });
  for (const x of [-width * 0.472, width * 0.472]) {
    box(shell, { dimensions: [detail * 0.012, cabHeight * 0.32, cabLength * 0.63], position: [x, cabHeight * 0.68, cabZ - cabLength * 0.1], material: glass });
    box(shell, { dimensions: [detail * 0.018, detail * 0.025, cabLength * 0.17], position: [x, cabHeight * 0.42, cabZ + cabLength * 0.17], material: chassis });
    addWheel(shell, { x: Math.sign(x) * width / 2, y: wheelY, z: cabZ + cabLength * 0.13, radius, depth: detail * 0.17, tire, hub });
  }
  box(shell, { dimensions: [width * 0.7, cabHeight * 0.13, detail * 0.03], position: [0, cabHeight * 0.24, cabZ - cabLength / 2 - detail * 0.012], material: chassis });
  for (const x of [-width * 0.32, width * 0.32]) {
    box(shell, { dimensions: [width * 0.16, detail * 0.065, detail * 0.035], position: [x, cabHeight * 0.37, cabZ - cabLength / 2 - detail * 0.025], material: standardMaterial('#e2ebff', { emissive: '#c5d9ff', emissiveIntensity: 0.4 }) });
  }
  for (const x of [-width * 0.42, width * 0.42]) {
    box(shell, { dimensions: [detail * 0.1, detail * 0.085, detail * 0.035], position: [x, detail * 0.12, length / 2 + detail * 0.045], material: standardMaterial('#ff765b', { emissive: '#ff6040', emissiveIntensity: 0.2 }) });
  }
}

function addRailShell(shell: THREE.Group, dimensions: WorldDimensions) {
  const { width, length, detail, groundY } = dimensions;
  const steel = standardMaterial('#6d7b95', { metalness: 0.8, roughness: 0.35 });
  const darkSteel = standardMaterial('#38435d', { metalness: 0.55 });
  box(shell, { dimensions: [width * 0.95, detail * 0.19, length + detail * 0.18], position: [0, -detail * 0.15, 0], material: darkSteel });
  const radius = detail * 0.24;
  for (const bogie of [-length * 0.34, length * 0.34]) {
    box(shell, { dimensions: [width * 0.65, detail * 0.18, detail * 0.85], position: [0, -detail * 0.28, bogie], material: darkSteel });
    for (const z of [bogie - detail * 0.28, bogie + detail * 0.28]) {
      for (const x of [-width * 0.33, width * 0.33]) {
        addWheel(shell, { x, y: groundY + radius, z, radius, depth: detail * 0.12, tire: darkSteel, hub: steel });
      }
    }
  }
  const railLength = length + detail * 1.5;
  for (const x of [-width * 0.33, width * 0.33]) {
    box(shell, { dimensions: [detail * 0.06, detail * 0.06, railLength], position: [x, groundY + detail * 0.018, 0], material: steel });
  }
  const count = Math.min(48, Math.ceil(railLength / (detail * 0.3)));
  const sleeper = standardMaterial('#bac1d2', { roughness: 0.9 });
  for (let index = 0; index < count; index++) {
    box(shell, { dimensions: [width * 0.88, detail * 0.025, detail * 0.11], position: [0, groundY, -railLength / 2 + railLength * (index + 0.5) / count], material: sleeper });
  }
}

function addAirPallet(shell: THREE.Group, dimensions: WorldDimensions) {
  const { width, length, detail } = dimensions;
  const aluminum = standardMaterial('#aebbd2', { metalness: 0.75, roughness: 0.28 });
  for (const x of [-width / 2, width / 2]) {
    box(shell, { dimensions: [detail * 0.055, detail * 0.06, length], position: [x, detail * 0.014, 0], material: aluminum });
    const ringCount = 6;
    for (let index = 0; index < ringCount; index++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(detail * 0.038, detail * 0.008, 6, 12), aluminum);
      ring.rotation.y = Math.PI / 2;
      ring.position.set(x, detail * 0.08, -length / 2 + length * (index + 0.5) / ringCount);
      shell.add(ring);
    }
  }
  for (const z of [-length / 2, length / 2]) {
    box(shell, { dimensions: [width, detail * 0.06, detail * 0.055], position: [0, detail * 0.014, z], material: aluminum });
  }
}

function addShell(scene: THREE.Scene, dimensions: WorldDimensions, mode: TransportMode) {
  const shell = new THREE.Group();
  addCutawayWalls(shell, dimensions, mode);
  if (mode === 'road') addRoadShell(shell, dimensions);
  if (mode === 'rail') addRailShell(shell, dimensions);
  if (mode === 'air') addAirPallet(shell, dimensions);
  scene.add(shell);
  return shell;
}

function cargoLabelTexture(piece: ScenePiece) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.fillStyle = '#fffef8';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = INK;
  context.font = '700 19px Inter, system-ui, sans-serif';
  context.fillText('CT / CARGO TWIN', 26, 35);
  context.font = '700 31px Inter, system-ui, sans-serif';
  context.fillText(piece.name.toUpperCase().slice(0, 25), 26, 84, 460);
  context.fillStyle = '#758099';
  context.font = '500 18px Inter, system-ui, sans-serif';
  context.fillText(`${piece.widthCm} × ${piece.lengthCm} × ${piece.heightCm} CM`, 26, 116);
  context.fillText(piece.weightKg ? `${piece.weightKg.toLocaleString('en')} KG` : 'LOAD PLAN', 26, 144);
  context.fillStyle = piece.fragile ? '#bc674b' : '#636a86';
  context.font = '700 18px Inter, system-ui, sans-serif';
  context.fillText(piece.fragile ? 'FRAGILE / HANDLE WITH CARE' : piece.keepUpright ? '↑ ↑  THIS SIDE UP' : 'TRACKED / READY TO LOAD', 26, 174);
  context.fillStyle = INK;
  let offset = 26;
  for (let index = 0; index < 65; index++) {
    const barWidth = index % 5 === 0 ? 5 : index % 3 === 0 ? 3 : 1;
    context.fillRect(offset, 194, barWidth, 32);
    offset += barWidth + 3;
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 2;
  return texture;
}

function addCargoLabels(group: THREE.Group, piece: ScenePiece, dimensions: [number, number, number], texture: THREE.CanvasTexture | null) {
  const labelGroup = new THREE.Group();
  group.add(labelGroup);
  if (!texture) return labelGroup;
  const [width, height, length] = dimensions;
  const frontWidth = Math.min(width * 0.65, height * 1.15, 0.48);
  const material = new THREE.MeshBasicMaterial({ map: texture, polygonOffset: true, polygonOffsetFactor: -1, toneMapped: false });
  const front = new THREE.Mesh(new THREE.PlaneGeometry(frontWidth, frontWidth / 2), material);
  front.position.set(width * 0.03, -height * 0.025, length / 2 + 0.0005);
  labelGroup.add(front);
  const sideWidth = Math.min(length * 0.6, height * 1.15, 0.42);
  const side = new THREE.Mesh(new THREE.PlaneGeometry(sideWidth, sideWidth / 2), material);
  side.rotation.y = -Math.PI / 2;
  side.position.set(-width / 2 - 0.0005, -height * 0.025, 0);
  labelGroup.add(side);
  if (piece.fragile || piece.keepUpright) {
    const symbol = textSprite(piece.fragile ? '◇ FRAGILE' : '↑ ↑ UPRIGHT', Math.min(width * 0.6, 0.34), { color: piece.fragile ? '#a86c48' : '#5360a1', background: '#fff9ec' });
    symbol.position.set(0, height / 2 + Math.min(height, width, length) * 0.035, 0);
    labelGroup.add(symbol);
  }
  return labelGroup;
}

function addCargo(scene: THREE.Scene, pieces: ScenePiece[], dimensions: WorldDimensions) {
  const { width, length } = dimensions;
  const textures = new Map<string, THREE.CanvasTexture | null>();
  const tapeMaterial = standardMaterial('#f3e7c7', { roughness: 0.92, transparent: true, opacity: 0.84 });
  const edgeMaterial = new THREE.LineBasicMaterial({ color: '#333f5a', transparent: true, opacity: 0.17 });
  const highlightMaterial = new THREE.LineBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.95, depthTest: false });
  const tetherMaterial = new THREE.LineDashedMaterial({ color: '#8d86ed', transparent: true, opacity: 0.65, dashSize: dimensions.detail * 0.04, gapSize: dimensions.detail * 0.028 });
  return pieces.map(piece => {
    const group = new THREE.Group();
    const widthM = piece.widthCm / 100;
    const heightM = piece.heightCm / 100;
    const lengthM = piece.lengthCm / 100;
    const smallest = Math.min(widthM, heightM, lengthM);
    const inset = smallest * 0.018;
    const cargoDimensions: [number, number, number] = [widthM - inset, heightM - inset, lengthM - inset];
    const geometry = new RoundedBoxGeometry(...cargoDimensions, 2, smallest * 0.014);
    const mesh = new THREE.Mesh(geometry, standardMaterial(piece.color, { roughness: 0.78, metalness: 0.01 }));
    mesh.userData.pieceId = piece.id;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    const rectangularEdges = new THREE.BoxGeometry(...cargoDimensions);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(rectangularEdges), edgeMaterial);
    rectangularEdges.dispose();
    group.add(edges);

    const tapeWidth = Math.min(cargoDimensions[0] * 0.16, 0.065);
    const tapeThickness = smallest * 0.005;
    box(group, { dimensions: [tapeWidth, tapeThickness, cargoDimensions[2]], position: [0, cargoDimensions[1] / 2 + tapeThickness / 2, 0], material: tapeMaterial, castShadow: false });
    for (const z of [-cargoDimensions[2] / 2, cargoDimensions[2] / 2]) {
      box(group, { dimensions: [tapeWidth, cargoDimensions[1] * 0.27, tapeThickness], position: [0, cargoDimensions[1] * 0.365, z + Math.sign(z) * tapeThickness / 2], material: tapeMaterial, castShadow: false });
    }
    const seamMaterial = new THREE.LineBasicMaterial({ color: '#766b57', transparent: true, opacity: 0.22 });
    line(group, [new THREE.Vector3(-cargoDimensions[0] / 2, cargoDimensions[1] / 2 + tapeThickness, 0), new THREE.Vector3(cargoDimensions[0] / 2, cargoDimensions[1] / 2 + tapeThickness, 0)], seamMaterial);
    const textureKey = `${piece.itemId}:${piece.widthCm}:${piece.heightCm}:${piece.lengthCm}`;
    if (!textures.has(textureKey)) textures.set(textureKey, cargoLabelTexture(piece));
    const labelGroup = addCargoLabels(group, piece, cargoDimensions, textures.get(textureKey) ?? null);

    const selection = new THREE.Group();
    const selectionGeometry = new THREE.BoxGeometry(widthM + smallest * 0.035, heightM + smallest * 0.035, lengthM + smallest * 0.035);
    const selectionEdges = new THREE.LineSegments(new THREE.EdgesGeometry(selectionGeometry), highlightMaterial);
    selectionGeometry.dispose();
    selectionEdges.renderOrder = 10;
    selection.add(selectionEdges);
    const selectedTag = textSprite(piece.name, Math.max(0.32, Math.min(widthM, 1.1)), { color: '#5147dd', background: '#f2f0ff' });
    selectedTag.position.y = heightM / 2 + smallest * 0.2;
    selection.add(selectedTag);
    selection.visible = false;
    group.add(selection);
    const anchor = new THREE.Vector3((piece.x + piece.widthCm / 2) / 100 - width / 2, (piece.y + piece.heightCm / 2) / 100, (piece.z + piece.lengthCm / 2) / 100 - length / 2);
    group.position.copy(anchor);
    scene.add(group);
    const tether = line(scene, [anchor, anchor], tetherMaterial);
    tether.visible = false;
    return { piece, group, mesh, labelGroup, selection, anchor, tether };
  });
}

function addCenterOfGravity(scene: THREE.Scene, point: Point3 | null | undefined, dimensions: WorldDimensions) {
  const center = new THREE.Group();
  const { width, length, detail, size } = dimensions;
  if (point) {
    const position = new THREE.Vector3(point.x / 100 - width / 2, point.y / 100, point.z / 100 - length / 2);
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(detail * 0.055, 20, 16), new THREE.MeshBasicMaterial({ color: '#ff8e52', depthTest: false }));
    sphere.position.copy(position);
    sphere.renderOrder = 10;
    center.add(sphere);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(detail * 0.16, detail * 0.008, 8, 32), new THREE.MeshBasicMaterial({ color: '#ef925f', depthTest: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(position.x, detail * 0.015, position.z);
    ring.renderOrder = 10;
    center.add(ring);
    const projection = line(center, [new THREE.Vector3(position.x, detail * 0.015, position.z), position], new THREE.LineDashedMaterial({ color: '#d98254', dashSize: detail * 0.055, gapSize: detail * 0.035, depthTest: false }));
    projection.renderOrder = 10;
    const tag = textSprite('CENTRE OF GRAVITY', Math.min(size * 0.34, detail * 1.7), { color: '#ad663d', background: '#fff3e8' });
    tag.position.copy(position).add(new THREE.Vector3(0, detail * 0.2, 0));
    center.add(tag);
  }
  scene.add(center);
  return center;
}

function addLights(scene: THREE.Scene, dimensions: WorldDimensions) {
  const { size } = dimensions;
  scene.add(new THREE.HemisphereLight('#ffffff', '#8993b2', 2.1));
  const key = new THREE.DirectionalLight('#fffaf5', 3.4);
  key.position.set(-size * 0.7, size * 1.6, size * 0.75);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -size * 1.35;
  key.shadow.camera.right = size * 1.35;
  key.shadow.camera.top = size * 1.35;
  key.shadow.camera.bottom = -size * 1.35;
  key.shadow.camera.near = size * 0.01;
  key.shadow.camera.far = size * 5;
  key.shadow.normalBias = size * 0.0015;
  key.shadow.bias = -0.0002;
  key.shadow.camera.updateProjectionMatrix();
  scene.add(key);
  const fill = new THREE.DirectionalLight('#c9d7ff', 1.15);
  fill.position.set(size, size * 0.7, -size);
  scene.add(fill);
}

function disposeScene(scene: THREE.Scene) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  scene.traverse(object => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Sprite) {
      if ('geometry' in object) geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        materials.add(material);
        if ('map' in material && material.map instanceof THREE.Texture) textures.add(material.map);
      }
    }
    if (object instanceof THREE.DirectionalLight) object.shadow.dispose();
  });
  geometries.forEach(geometry => geometry.dispose());
  materials.forEach(material => material.dispose());
  textures.forEach(texture => texture.dispose());
}

export function createSceneWorld({ space, pieces, centerOfGravity }: { space: SceneSpace; pieces: ScenePiece[]; centerOfGravity?: Point3 | null }): SceneWorld {
  const width = space.widthCm / 100;
  const height = space.heightCm / 100;
  const length = space.lengthCm / 100;
  const size = Math.max(width, height, length);
  const detail = Math.min(width, height, length, 2.4) / 2;
  const mode = space.mode ?? 'custom';
  const groundY = mode === 'road' ? -Math.min(width * 0.13, detail * 0.34) * 2 - detail * 0.11 : mode === 'rail' ? -detail * 0.72 : -detail * 0.15;
  const dimensions = { width, height, length, size, detail, groundY };
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BACKGROUND);
  scene.fog = new THREE.Fog(BACKGROUND, size * 4, size * 12);
  addLights(scene, dimensions);
  addFloor(scene, dimensions);
  addLoadBounds(scene, space, dimensions);
  addDimensions(scene, space, dimensions);
  const shell = addShell(scene, dimensions, mode);
  const cargo = addCargo(scene, pieces, dimensions);
  const center = addCenterOfGravity(scene, centerOfGravity, dimensions);
  const cabOffset = mode === 'road' ? Math.min(length * 0.38, width * 0.79) * 0.35 : 0;
  return { scene, dimensions, shell, cargo, center, cameraTarget: new THREE.Vector3(0, height * 0.32, -cabOffset), dispose: () => disposeScene(scene) };
}

function cargoColor(piece: ScenePiece, colorMode: SceneColorMode, maxWeight: number) {
  if (colorMode === 'handling') return new THREE.Color(piece.fragile ? '#ffae7d' : piece.keepUpright ? '#9b8aff' : '#72d9c0');
  if (colorMode === 'weight') return new THREE.Color().setHSL(0.64 - Math.min(1, (piece.weightKg ?? 0) / maxWeight) * 0.61, 0.75, 0.63, THREE.SRGBColorSpace);
  return new THREE.Color(piece.color);
}

interface AppearanceOptions {
  selectedId: string | null;
  visibleCount: number;
  showCenter: boolean;
  showShell: boolean;
  showLabels: boolean;
  colorMode: SceneColorMode;
  exploded: boolean;
}

export function updateSceneAppearance(world: SceneWorld, options: AppearanceOptions) {
  const maxWeight = Math.max(1, ...world.cargo.map(visual => visual.piece.weightKg ?? 0));
  const visibleCount = Math.max(0, Math.min(world.cargo.length, Math.floor(options.visibleCount)));
  world.shell.visible = options.showShell;
  world.center.visible = options.showCenter && visibleCount === world.cargo.length && !options.exploded;
  world.cargo.forEach((visual, index) => {
    const { group, mesh, anchor, piece, tether } = visual;
    group.visible = index < visibleCount;
    const selected = group.visible && piece.id === options.selectedId;
    mesh.material.color.copy(cargoColor(piece, options.colorMode, maxWeight));
    mesh.material.emissive.set(selected ? '#7562ff' : '#000000');
    mesh.material.emissiveIntensity = selected ? 0.2 : 0;
    visual.selection.visible = selected;
    visual.labelGroup.visible = options.showLabels;
    group.position.copy(anchor);
    if (options.exploded) {
      group.position.x *= 1.22;
      group.position.z *= 1.15;
      group.position.y = anchor.y * 1.32 + world.dimensions.height * 0.13;
    }
    const positions = tether.geometry.getAttribute('position') as THREE.BufferAttribute;
    positions.setXYZ(0, anchor.x, anchor.y, anchor.z);
    positions.setXYZ(1, group.position.x, group.position.y, group.position.z);
    positions.needsUpdate = true;
    tether.geometry.computeBoundingSphere();
    tether.computeLineDistances();
    tether.visible = options.exploded && group.visible;
  });
}
