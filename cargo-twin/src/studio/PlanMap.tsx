import { useId, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import type { PackingPlan, Placement } from './model';

interface PlanMapProps {
  plan: PackingPlan;
  selectedId: string | null;
  onSelect: (id: string) => void;
  visibleCount?: number;
}

function validFootprint(piece: Placement): boolean {
  return [piece.x, piece.y, piece.z, piece.widthCm, piece.lengthCm].every(Number.isFinite)
    && piece.widthCm > 0 && piece.lengthCm > 0;
}

function accessibleLabel(piece: Placement): string {
  return `Piece ${piece.sequence}, ${piece.name}. ${piece.weightKg} kg. Width ${piece.widthCm}, length ${piece.lengthCm}, height ${piece.heightCm} cm. Base ${piece.y} cm above floor.${piece.fragile ? ' Fragile.' : ''}`;
}

/** The length runs horizontally: front at the left, rear at the right. */
export function PlanMap({ plan, selectedId, onSelect, visibleCount = plan.placements.length }: PlanMapProps) {
  const patternId = `cargo-map-${useId().replace(/:/g, '')}`;
  const controls = useRef(new Map<string, SVGGElement>());
  const { space } = plan;
  const pieces = plan.placements.slice(0, Math.max(0, visibleCount)).filter(validFootprint);
  const selected = pieces.find(piece => piece.id === selectedId);
  const focusId = selected?.id ?? pieces[0]?.id;
  const layeredPieces = [...pieces].sort((a, b) => a.y - b.y || a.sequence - b.sequence);
  if (![space.widthCm, space.lengthCm].every(value => Number.isFinite(value) && value > 0)) {
    return <div className="ct-plan-map" role="status">Correct the space dimensions to display the floor plan.</div>;
  }
  const scale = Math.max(space.widthCm, space.lengthCm);
  const margin = scale * 0.075;
  const labelSize = scale * 0.025;
  const strokeWidth = scale * 0.003;
  const clearance = Number.isFinite(space.clearanceCm) ? Math.max(0, space.clearanceCm) : 0;
  const reservedDepth = Number.isFinite(space.reservedDepthCm) ? Math.max(0, Math.min(space.lengthCm, space.reservedDepthCm)) : 0;
  const usableWidth = Math.max(0, space.widthCm - clearance * 2);
  const usableLength = Math.max(0, space.lengthCm - clearance * 2 - reservedDepth);

  function handleKey(event: KeyboardEvent<SVGGElement>, piece: Placement) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(piece.id);
      return;
    }
    const index = pieces.findIndex(candidate => candidate.id === piece.id);
    let nextIndex: number;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (index + 1) % pieces.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (index + pieces.length - 1) % pieces.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = pieces.length - 1;
    else return;
    event.preventDefault();
    const next = pieces[nextIndex];
    onSelect(next.id);
    controls.current.get(next.id)?.focus();
  }

  return <div className="ct-plan-map" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch', justifyContent: 'center', padding: '18px', boxSizing: 'border-box', background: '#e7e9e0', color: '#29483f' }}>
    <svg
      viewBox={`${-margin} ${-margin} ${space.lengthCm + margin * 2} ${space.widthCm + margin * 2}`}
      role="group"
      aria-label={`Interactive top view of ${space.name}. Front is left; rear is right. ${pieces.length} of ${plan.placements.length} packed pieces shown.`}
      aria-describedby={`${patternId}-instructions`}
      style={{ width: '100%', minHeight: 160, flex: 1, overflow: 'visible' }}
    >
      <defs><pattern id={patternId} width={scale * 0.035} height={scale * 0.035} patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2={scale * 0.035} stroke="#cf936b" strokeWidth={strokeWidth} /></pattern></defs>
      <rect x="0" y="0" width={space.lengthCm} height={space.widthCm} rx={scale * 0.006} fill="#d4dbd0" stroke="#526e5d" strokeWidth={strokeWidth} />
      {reservedDepth > 0 && <rect x={space.lengthCm - reservedDepth} y="0" width={reservedDepth} height={space.widthCm} fill={`url(#${patternId})`} opacity="0.7"><title>Reserved rear area; no cargo permitted.</title></rect>}
      <rect x={clearance} y={clearance} width={usableLength} height={usableWidth} fill="#f7f6ec" stroke="#7e9b8b" strokeWidth={strokeWidth} strokeDasharray={`${scale * 0.018} ${scale * 0.012}`} />
      <line x1={clearance + usableLength / 2} y1={clearance} x2={clearance + usableLength / 2} y2={clearance + usableWidth} stroke="#adbbae" strokeWidth={strokeWidth / 2} strokeDasharray={`${scale * 0.01} ${scale * 0.01}`} />
      <line x1={clearance} y1={clearance + usableWidth / 2} x2={clearance + usableLength} y2={clearance + usableWidth / 2} stroke="#adbbae" strokeWidth={strokeWidth / 2} strokeDasharray={`${scale * 0.01} ${scale * 0.01}`} />
      <text x={-margin * 0.55} y={space.widthCm / 2} fontSize={labelSize} fontFamily="inherit" textAnchor="middle" dominantBaseline="middle" transform={`rotate(-90 ${-margin * 0.55} ${space.widthCm / 2})`}>FRONT</text>
      <text x={space.lengthCm + margin * 0.55} y={space.widthCm / 2} fontSize={labelSize} fontFamily="inherit" textAnchor="middle" dominantBaseline="middle" transform={`rotate(90 ${space.lengthCm + margin * 0.55} ${space.widthCm / 2})`}>REAR</text>
      <text x={space.lengthCm / 2} y={-margin * 0.45} fontSize={labelSize} fontFamily="inherit" textAnchor="middle">LEFT SIDE</text>
      <text x={space.lengthCm / 2} y={space.widthCm + margin * 0.55} fontSize={labelSize} fontFamily="inherit" textAnchor="middle">RIGHT SIDE</text>
      {layeredPieces.map(piece => <g
        key={piece.id}
        ref={element => { if (element) controls.current.set(piece.id, element); else controls.current.delete(piece.id); }}
        role="button"
        tabIndex={piece.id === focusId ? 0 : -1}
        aria-label={accessibleLabel(piece)}
        aria-pressed={piece.id === selectedId}
        onClick={() => onSelect(piece.id)}
        onKeyDown={event => handleKey(event, piece)}
        style={{ cursor: 'pointer', outlineOffset: 3 }}
      >
        <title>{accessibleLabel(piece)}</title>
        <rect x={piece.z} y={piece.x} width={piece.lengthCm} height={piece.widthCm} rx={Math.min(piece.widthCm, piece.lengthCm) * 0.025} fill={piece.color} stroke={piece.id === selectedId ? '#f3683b' : '#314d45'} strokeWidth={piece.id === selectedId ? strokeWidth * 2.5 : strokeWidth} />
        {Math.min(piece.lengthCm, piece.widthCm) > labelSize * 1.5 && <text x={piece.z + piece.lengthCm / 2} y={piece.x + piece.widthCm / 2} textAnchor="middle" dominantBaseline="middle" fill="#173a31" stroke="#fffdf6" strokeWidth={labelSize * 0.08} paintOrder="stroke" fontSize={Math.min(labelSize, piece.widthCm * 0.35, piece.lengthCm * 0.3)} fontWeight="700" fontFamily="inherit" pointerEvents="none">{piece.sequence}</text>}
      </g>)}
      {selected && <rect x={selected.z} y={selected.x} width={selected.lengthCm} height={selected.widthCm} rx={Math.min(selected.widthCm, selected.lengthCm) * 0.025} fill="none" stroke="#f3683b" strokeWidth={strokeWidth * 2.5} pointerEvents="none" />}
    </svg>
    <p id={`${patternId}-instructions`} style={{ fontSize: 11, lineHeight: 1.5, textAlign: 'center', margin: '10px 0 0', opacity: 0.75 }}>Top view · upper pieces cover lower pieces. Select a box to inspect; use arrow keys to move through cargo.</p>
  </div>;
}
