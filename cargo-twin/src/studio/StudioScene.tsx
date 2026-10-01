import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createSceneWorld, updateSceneAppearance } from './sceneWorld';
import type { SceneWorld } from './sceneWorld';
import type { SceneProps, SceneView } from './sceneTypes';

export type { ScenePiece, SceneProps, SceneColorMode, SceneSpace, SceneView } from './sceneTypes';

interface LiveScene {
  world: SceneWorld;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  render: () => void;
}

function validSceneGeometry({ space, pieces }: Pick<SceneProps, 'space' | 'pieces'>) {
  const dimensions = [space.widthCm, space.heightCm, space.lengthCm];
  const margins = [space.reservedDepthCm, space.clearanceCm];
  return dimensions.every(value => Number.isFinite(value) && value > 0)
    && margins.every(value => Number.isFinite(value) && value >= 0)
    && pieces.every(piece => [piece.widthCm, piece.heightCm, piece.lengthCm].every(value => Number.isFinite(value) && value > 0)
      && [piece.x, piece.y, piece.z].every(Number.isFinite));
}

function frameCamera(current: LiveScene, view: SceneView, exploded: boolean) {
  const { world, camera, controls } = current;
  const { size, width, height, length, detail } = world.dimensions;
  const verticalField = THREE.MathUtils.degToRad(camera.fov);
  const horizontalField = 2 * Math.atan(Math.tan(verticalField / 2) * camera.aspect);
  const visibleField = Math.min(verticalField, horizontalField);
  const radius = Math.hypot(width + detail * 0.7, height, length + detail * 1.15) / 2;
  const distance = radius / Math.sin(visibleField / 2) * (exploded ? 1.16 : 1.04);
  const target = world.cameraTarget.clone();
  if (exploded) target.y += height * 0.12;
  controls.target.copy(target);
  camera.up.set(0, 1, 0);
  let direction = new THREE.Vector3(-0.9, 0.76, 1.15).normalize();
  if (view === 'top') {
    direction = new THREE.Vector3(0, 1, 0.0001).normalize();
    camera.up.set(0, 0, -1);
  }
  if (view === 'side') direction = new THREE.Vector3(-1, 0.0001, 0).normalize();
  camera.position.copy(target).addScaledVector(direction, distance);
  controls.minDistance = size * 0.3;
  controls.maxDistance = Math.max(size * 5, distance * 2.3);
  controls.update();
  current.render();
}

export function StudioScene({
  space,
  pieces,
  selectedId,
  visibleCount,
  view,
  centerOfGravity,
  showCenter,
  showShell = true,
  showLabels = true,
  colorMode = 'cargo',
  exploded = false,
  resetKey = 0,
  onSelect,
}: SceneProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const liveRef = useRef<LiveScene | null>(null);
  const callbackRef = useRef(onSelect);
  callbackRef.current = onSelect;
  const appearanceRef = useRef({ selectedId, visibleCount, showCenter, showShell, showLabels, colorMode, exploded });
  appearanceRef.current = { selectedId, visibleCount, showCenter, showShell, showLabels, colorMode, exploded };
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (!validSceneGeometry({ space, pieces })) {
      setFailed(true);
      return;
    }
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'default' });
    } catch {
      setFailed(true);
      return;
    }
    setFailed(false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    const canvas = renderer.domElement;
    canvas.setAttribute('aria-label', 'Interactive 3D cargo digital twin. Drag to orbit, scroll to zoom, click cargo to inspect. Focus the view and use arrow keys to pan.');
    canvas.setAttribute('role', 'img');
    canvas.tabIndex = 0;
    host.appendChild(canvas);
    const world = createSceneWorld({ space, pieces, centerOfGravity });
    updateSceneAppearance(world, appearanceRef.current);
    const camera = new THREE.PerspectiveCamera(38, 1, world.dimensions.size * 0.001, world.dimensions.size * 50);
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = false;
    controls.maxPolarAngle = Math.PI * 0.499;
    controls.screenSpacePanning = true;
    controls.listenToKeyEvents(canvas);
    const render = () => renderer.render(world.scene, camera);
    const current = { world, camera, controls, render };
    liveRef.current = current;
    let firstSize = true;
    const resize = () => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      if (firstSize) {
        firstSize = false;
        frameCamera(current, view, appearanceRef.current.exploded);
      } else render();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    controls.addEventListener('change', render);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerDownPosition: { x: number; y: number; pointerId: number } | null = null;
    const hitCargo = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(world.cargo.filter(visual => visual.group.visible).map(visual => visual.mesh));
      return hits[0]?.object.userData.pieceId as string | undefined;
    };
    const pointerDown = (event: PointerEvent) => {
      pointerDownPosition = event.isPrimary && event.button === 0 ? { x: event.clientX, y: event.clientY, pointerId: event.pointerId } : null;
    };
    const pointerUp = (event: PointerEvent) => {
      if (!pointerDownPosition || event.pointerId !== pointerDownPosition.pointerId) return;
      const distance = Math.hypot(event.clientX - pointerDownPosition.x, event.clientY - pointerDownPosition.y);
      pointerDownPosition = null;
      if (distance > 5) return;
      const id = hitCargo(event);
      if (id) callbackRef.current(id);
    };
    const pointerMove = (event: PointerEvent) => {
      if (!event.buttons) canvas.style.cursor = hitCargo(event) ? 'pointer' : 'grab';
      else canvas.style.cursor = 'grabbing';
    };
    const pointerCancel = () => { pointerDownPosition = null; };
    const contextLost = (event: Event) => {
      event.preventDefault();
      setFailed(true);
      canvas.style.visibility = 'hidden';
    };
    const contextRestored = () => {
      canvas.style.visibility = 'visible';
      setFailed(false);
      resize();
    };
    canvas.style.cursor = 'grab';
    canvas.addEventListener('pointerdown', pointerDown);
    canvas.addEventListener('pointerup', pointerUp);
    canvas.addEventListener('pointermove', pointerMove);
    canvas.addEventListener('pointercancel', pointerCancel);
    canvas.addEventListener('webglcontextlost', contextLost);
    canvas.addEventListener('webglcontextrestored', contextRestored);
    resize();

    return () => {
      liveRef.current = null;
      observer.disconnect();
      controls.removeEventListener('change', render);
      controls.dispose();
      canvas.removeEventListener('pointerdown', pointerDown);
      canvas.removeEventListener('pointerup', pointerUp);
      canvas.removeEventListener('pointermove', pointerMove);
      canvas.removeEventListener('pointercancel', pointerCancel);
      canvas.removeEventListener('webglcontextlost', contextLost);
      canvas.removeEventListener('webglcontextrestored', contextRestored);
      world.dispose();
      renderer.dispose();
      canvas.remove();
    };
  }, [space, pieces, centerOfGravity]);

  useEffect(() => {
    const current = liveRef.current;
    if (!current) return;
    updateSceneAppearance(current.world, { selectedId, visibleCount, showCenter, showShell, showLabels, colorMode, exploded });
    current.render();
  }, [selectedId, visibleCount, showCenter, showShell, showLabels, colorMode, exploded, space, pieces, centerOfGravity]);

  useEffect(() => {
    const current = liveRef.current;
    if (current) frameCamera(current, view, exploded);
  }, [view, resetKey, exploded, space, pieces, centerOfGravity]);

  return <div ref={hostRef} className="ct-scene">
    {exploded && !failed && <div className="ct-scene-exploded-note" style={{ position: 'absolute', bottom: 48, left: 18, zIndex: 2, pointerEvents: 'none', background: '#f6f4ffe8', border: '1px solid #dcd7ff', padding: '5px 9px', borderRadius: 6, color: '#6354c9', fontSize: 10 }}>Exploded view · illustrative spacing</div>}
    {failed && <div className="ct-scene-fallback" style={{ position: 'absolute', inset: 0, zIndex: 2, background: '#eff1f6', color: '#63708b' }}><strong>3D view unavailable on this device</strong><p>Switch to Map or the placement list to inspect your cargo. Reopen the 3D view to retry.</p></div>}
  </div>;
}
