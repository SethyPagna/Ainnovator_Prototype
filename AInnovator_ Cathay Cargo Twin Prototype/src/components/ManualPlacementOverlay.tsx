import React from 'react';
import { Move, RotateCw } from 'lucide-react';

interface ManualPlacementOverlayProps {
  isManualMode: boolean;
  onToggleManualMode: () => void;
  selectedItemName: string | null;
  onResetView: () => void;
}

export function ManualPlacementOverlay({
  isManualMode,
  onToggleManualMode,
  selectedItemName,
  onResetView
}: ManualPlacementOverlayProps) {
  return (
    <div className="absolute top-4 left-4 space-y-2">
      {/* Manual Mode Toggle */}
      <button
        onClick={onToggleManualMode}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
          isManualMode
            ? 'bg-gradient-to-r from-[#005D63] to-[#004852] text-white shadow-lg'
            : 'bg-black/70 backdrop-blur-sm text-white/80 hover:text-white border border-white/20'
        }`}
      >
        <Move className="size-4" />
        <span className="text-sm font-bold">
          {isManualMode ? 'Manual Mode: ON' : 'Manual Mode: OFF'}
        </span>
      </button>

      {/* Manual Mode Instructions */}
      {isManualMode && (
        <div className="bg-black/80 backdrop-blur-sm rounded-lg p-3 border border-[rgba(0,93,99,0.4)] max-w-[280px]">
          <div className="text-[#005D63] text-xs font-bold mb-2">📦 MANUAL PLACEMENT MODE</div>
          <div className="text-white/80 text-[10px] space-y-1">
            <div>• Click item to select</div>
            <div>• Drag to move position</div>
            <div>• Green = valid placement</div>
            <div>• Red = invalid (collision/out of bounds)</div>
            <div>• Release to place</div>
          </div>
          {selectedItemName && (
            <div className="mt-2 pt-2 border-t border-white/20">
              <div className="text-cyan-400 text-[10px] font-bold">
                Selected: {selectedItemName}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Reset View Button */}
      <button
        onClick={onResetView}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-black/70 backdrop-blur-sm text-white/80 hover:text-white border border-white/20 transition-all"
      >
        <RotateCw className="size-4" />
        <span className="text-sm">Reset View</span>
      </button>
    </div>
  );
}