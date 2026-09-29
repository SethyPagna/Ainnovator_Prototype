import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export interface ScenePiece {
  id: string;
  itemId: string;
  name: string;
  color: string;
  fragile: boolean;
  x: number;
  y: number;
  z: number;
  widthCm: number;
  heightCm: number;
  lengthCm: number;
}

interface SceneProps {
  space: { widthCm: number; heightCm: number; lengthCm: number; reservedDepthCm: number; clearanceCm: number };
  pieces: ScenePiece[];
  selectedId: string | null;
  visibleCount: number;
  view: 'perspective' | 'top' | 'side';
  centerOfGravity?: { x: number; y: number; z: number } | null;
  showCenter: boolean;
  onSelect: (id: string) => void;
}

function label(text: string, width: number, color = '#344942', background = '#fffdf5') {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 112;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = '600 42px sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  ctx.fillText(text, 384, 58, 720);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true }));
  sprite.scale.set(width, width * 112 / 768, 1);
  sprite.renderOrder = 5;
  return sprite;
}

export function StudioScene({ space, pieces, selectedId, visibleCount, view, centerOfGravity, showCenter, onSelect }: SceneProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const live = useRef<{
    render: () => void;
    meshes: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>[];
    groups: THREE.Group[];
    center: THREE.Group;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    size: number;
    height: number;
  } | null>(null);
  const callbackRef = useRef(onSelect);
  callbackRef.current = onSelect;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (![space.widthCm, space.heightCm, space.lengthCm].every(value => Number.isFinite(value) && value > 0) || ![space.reservedDepthCm, space.clearanceCm].every(value => Number.isFinite(value) && value >= 0)) {
      setFailed(true);
      return;
    }
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    } catch {
      setFailed(true);
      return;
    }
    setFailed(false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.setAttribute('aria-label', 'Interactive 3D cargo plan. Drag to orbit, scroll to zoom, click a box to inspect.');
    renderer.domElement.setAttribute('role', 'img');
    renderer.domElement.tabIndex = 0;
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#eaece2');
    const w = space.widthCm / 100;
    const h = space.heightCm / 100;
    const l = space.lengthCm / 100;
    const size = Math.max(w, h, l);
    const decorationScale = Math.min(size / 4, 1);
    const platformScale = Math.min(w, h, l, 2) / 2;
    const camera = new THREE.PerspectiveCamera(38, 1, size * 0.001, size * 40);
    camera.position.set(-size * 1.15, size * 1.1, size * 1.25);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, h * 0.3, 0);
    controls.minDistance = size * 0.35;
    controls.maxDistance = size * 4;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.enableDamping = false;
    controls.update();
    scene.add(new THREE.HemisphereLight('#ffffff', '#718472', 2.6));
    const sun = new THREE.DirectionalLight('#fff8e9', 3.3);
    sun.position.set(-size * 0.7, size * 1.8, size);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -size;
    sun.shadow.camera.right = size;
    sun.shadow.camera.top = size;
    sun.shadow.camera.bottom = -size;
    sun.shadow.camera.near = size * 0.01;
    sun.shadow.camera.far = size * 5;
    sun.shadow.normalBias = size * 0.00625;
    sun.shadow.camera.updateProjectionMatrix();
    scene.add(sun);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(size * 12, size * 12), new THREE.MeshStandardMaterial({ color: '#eaece2', roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.15 * platformScale;
    ground.receiveShadow = true;
    scene.add(ground);
    const platform = new THREE.Mesh(new THREE.BoxGeometry(w + 0.12 * platformScale, 0.14 * platformScale, l + 0.12 * platformScale), new THREE.MeshStandardMaterial({ color: '#b9c6bb', roughness: 0.8 }));
    platform.position.y = -0.07 * platformScale;
    platform.receiveShadow = true;
    scene.add(platform);
    const wireGeo = new THREE.BoxGeometry(w, h, l);
    const frame = new THREE.LineSegments(new THREE.EdgesGeometry(wireGeo), new THREE.LineBasicMaterial({ color: '#527167', transparent: true, opacity: 0.55 }));
    wireGeo.dispose();
    frame.position.y = h / 2;
    scene.add(frame);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ color: '#c5d5c7', transparent: true, opacity: 0.24, side: THREE.DoubleSide, depthWrite: false }));
    back.position.set(0, h / 2, -l / 2);
    scene.add(back);
    const gridSegments = Math.max(6, Math.ceil(l / size * 12));
    for (let index = 0; index <= gridSegments; index++) {
      const z = -l / 2 + l * index / gridSegments;
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-w / 2, 0.005 * platformScale, z), new THREE.Vector3(w / 2, 0.005 * platformScale, z)]), new THREE.LineBasicMaterial({ color: '#879d8e', transparent: true, opacity: 0.26 }));
      scene.add(line);
    }
    if (space.reservedDepthCm > 0) {
      const depth = Math.min(space.reservedDepthCm / 100, l);
      const blocked = new THREE.Mesh(new THREE.BoxGeometry(w, h, depth), new THREE.MeshStandardMaterial({ color: '#b7755d', transparent: true, opacity: 0.16, depthWrite: false }));
      blocked.position.set(0, h / 2, l / 2 - depth / 2);
      scene.add(blocked);
      const tag = label('RESERVED SPACE', Math.min(w, 2.2 * decorationScale), '#914425', '#fbe5d7');
      tag.position.set(0, h + 0.15 * decorationScale, l / 2 - depth / 2);
      scene.add(tag);
    }
    const lengthLabel = label(`${space.lengthCm} cm  ·  LENGTH`, Math.min(size * 0.42, 2.6 * decorationScale));
    lengthLabel.position.set(-w / 2 - 0.26 * decorationScale, 0.08 * decorationScale, 0);
    scene.add(lengthLabel);
    const widthLabel = label(`${space.widthCm} cm  ·  WIDTH`, Math.min(size * 0.42, 2.6 * decorationScale));
    widthLabel.position.set(0, 0.08 * decorationScale, l / 2 + 0.38 * decorationScale);
    scene.add(widthLabel);
    const meshes: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>[] = [];
    const groups: THREE.Group[] = [];
    const textures = new Map<string, THREE.CanvasTexture>();
    for (const piece of pieces) {
      const group = new THREE.Group();
      const pw = piece.widthCm / 100, ph = piece.heightCm / 100, pl = piece.lengthCm / 100;
      const inset = Math.min(pw, ph, pl) * 0.02;
      const geometry = new THREE.BoxGeometry(pw - inset, ph - inset, pl - inset);
      const material = new THREE.MeshStandardMaterial({ color: piece.color, roughness: 0.8, metalness: 0.03 });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.userData.pieceId = piece.id;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      const edge = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: '#263e36', transparent: true, opacity: 0.3 }));
      group.add(edge);
      const tapeThickness = Math.min(pw, ph, pl) * 0.008;
      const tape = new THREE.Mesh(new THREE.BoxGeometry(Math.min((pw - inset) * 0.18, 0.08 * decorationScale), tapeThickness, pl - inset), new THREE.MeshStandardMaterial({ color: '#fff9e7', roughness: 1, transparent: true, opacity: 0.7 }));
      tape.position.y = (ph - inset + tapeThickness) / 2;
      group.add(tape);
      if (pw > size * 0.045 && ph > size * 0.03) {
        let texture = textures.get(piece.itemId);
        if (!texture) {
          const canvas = document.createElement('canvas');
          canvas.width = 256; canvas.height = 128;
          const ctx = canvas.getContext('2d')!;
          ctx.fillStyle = '#fffdf5'; ctx.fillRect(0, 0, 256, 128);
          ctx.fillStyle = '#233f35'; ctx.font = 'bold 24px sans-serif';
          ctx.fillText(piece.name.slice(0, 16), 14, 37, 226);
          ctx.font = '16px sans-serif'; ctx.fillText(piece.fragile ? 'FRAGILE  /  HANDLE WITH CARE' : 'CARGO TWIN  /  LOAD PLAN', 14, 66, 226);
          for (let k = 0; k < 40; k++) ctx.fillRect(14 + k * 4, 84, k % 3 === 0 ? 3 : 1, 24);
          texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
          textures.set(piece.itemId, texture);
        }
        const stickerWidth = Math.min((pw - inset) * 0.72, 0.4 * decorationScale);
        const sticker = new THREE.Mesh(new THREE.PlaneGeometry(stickerWidth, Math.min(stickerWidth / 2, (ph - inset) * 0.65)), new THREE.MeshBasicMaterial({ map: texture }));
        sticker.position.set(0, 0, (pl - inset) / 2 + inset * 0.1);
        group.add(sticker);
      }
      group.position.set((piece.x + piece.widthCm / 2) / 100 - w / 2, (piece.y + piece.heightCm / 2) / 100, (piece.z + piece.lengthCm / 2) / 100 - l / 2);
      meshes.push(mesh); groups.push(group); scene.add(group);
    }
    const center = new THREE.Group();
    if (centerOfGravity) {
      const x = centerOfGravity.x / 100 - w / 2, y = centerOfGravity.y / 100, z = centerOfGravity.z / 100 - l / 2;
      const dot = new THREE.Mesh(new THREE.SphereGeometry(size * 0.014, 16, 16), new THREE.MeshBasicMaterial({ color: '#ff6837', depthTest: false }));
      dot.position.set(x, y, z); dot.renderOrder = 8; center.add(dot);
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, 0.03 * decorationScale, z), new THREE.Vector3(x, y, z)]), new THREE.LineDashedMaterial({ color: '#e75827', dashSize: 0.05 * decorationScale, gapSize: 0.035 * decorationScale, depthTest: false }));
      line.computeLineDistances(); line.renderOrder = 8; center.add(line);
      const tag = label('CENTRE OF GRAVITY', Math.min(size * 0.34, 2 * decorationScale), '#a34123', '#fff4d9');
      tag.position.set(x, y + size * 0.06, z); center.add(tag);
    }
    scene.add(center);
    const render = () => renderer.render(scene, camera);
    const resize = () => {
      const width = host.clientWidth, height = host.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height, false); camera.aspect = width / height;
      camera.updateProjectionMatrix(); render();
    };
    const observer = new ResizeObserver(resize); observer.observe(host);
    controls.addEventListener('change', render);
    const raycaster = new THREE.Raycaster();
    let down = { x: 0, y: 0 };
    const pointerDown = (event: PointerEvent) => { down = { x: event.clientX, y: event.clientY }; };
    const pointerUp = (event: PointerEvent) => {
      if (Math.hypot(event.clientX - down.x, event.clientY - down.y) > 5) return;
      const rect = renderer.domElement.getBoundingClientRect();
      raycaster.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), camera);
      const hit = raycaster.intersectObjects(meshes.filter(mesh => mesh.parent?.visible));
      if (hit[0]) callbackRef.current(String(hit[0].object.userData.pieceId));
    };
    renderer.domElement.addEventListener('pointerdown', pointerDown);
    renderer.domElement.addEventListener('pointerup', pointerUp);
    live.current = { render, meshes, groups, center, camera, controls, size, height: h };
    resize();
    return () => {
      live.current = null; observer.disconnect(); controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', pointerDown);
      renderer.domElement.removeEventListener('pointerup', pointerUp);
      const disposed = new Set<THREE.Texture>();
      scene.traverse(object => {
        const drawable = object as THREE.Mesh;
        drawable.geometry?.dispose();
        const materials = drawable.material ? Array.isArray(drawable.material) ? drawable.material : [drawable.material] : [];
        materials.forEach(material => {
          const texture = (material as THREE.MeshBasicMaterial).map;
          if (texture && !disposed.has(texture)) { texture.dispose(); disposed.add(texture); }
          material.dispose();
        });
      });
      renderer.dispose(); renderer.domElement.remove();
    };
  }, [space, pieces, centerOfGravity]);

  useEffect(() => {
    const current = live.current;
    if (!current) return;
    current.groups.forEach((group, index) => { group.visible = index < visibleCount; });
    current.meshes.forEach(mesh => {
      const selected = mesh.userData.pieceId === selectedId && mesh.parent?.visible;
      mesh.material.emissive.set(selected ? '#dc6b28' : '#000000');
      mesh.material.emissiveIntensity = selected ? 0.35 : 0;
    });
    current.center.visible = showCenter && visibleCount === pieces.length;
    current.render();
  }, [selectedId, visibleCount, showCenter, pieces, space, centerOfGravity]);

  useEffect(() => {
    const current = live.current;
    if (!current) return;
    const { camera, controls, size, height } = current;
    camera.up.set(0, 1, 0);
    controls.target.set(0, height * 0.3, 0);
    if (view === 'top') { camera.position.set(size * 0.00025, size * 2, size * 0.00025); camera.up.set(0, 0, -1); }
    else if (view === 'side') camera.position.set(-size * 2, height * 0.5, 0);
    else camera.position.set(-size * 1.15, size * 1.1, size * 1.25);
    controls.update(); current.render();
  }, [view, space, pieces, centerOfGravity]);

  return <div ref={hostRef} className="ct-scene">{failed && <div className="ct-scene-fallback"><strong>3D view unavailable on this device</strong><p>You can still edit, pack, and inspect the complete load list below.</p></div>}</div>;
}
