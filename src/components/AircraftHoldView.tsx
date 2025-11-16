import React, { useRef, useEffect } from 'react';
import cargoHoldImage from 'figma:asset/c02f9bff31ceb588865899aaa71e2f7fcf4e0bfa.png';
import { ULDContainer } from '../types/cargo';

interface AircraftHoldViewProps {
  ulds: ULDContainer[];
  holdDimensions: { length: number; width: number; height: number };
  onULDClick?: (uld: ULDContainer) => void;
}

export function AircraftHoldView({ ulds, holdDimensions, onULDClick }: AircraftHoldViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background image
    const img = new Image();
    img.src = cargoHoldImage;
    img.onload = () => {
      ctx.globalAlpha = 0.3;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1.0;

      // Draw hold outline
      const scale = 15; // pixels per meter
      const offsetX = 50;
      const offsetY = 100;

      // Hold floor
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.5)';
      ctx.lineWidth = 3;
      ctx.strokeRect(offsetX, offsetY, holdDimensions.length * scale, holdDimensions.width * scale);

      // Grid lines
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.3)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= holdDimensions.length; i += 2) {
        ctx.beginPath();
        ctx.moveTo(offsetX + i * scale, offsetY);
        ctx.lineTo(offsetX + i * scale, offsetY + holdDimensions.width * scale);
        ctx.stroke();
      }
      for (let i = 0; i <= holdDimensions.width; i += 1) {
        ctx.beginPath();
        ctx.moveTo(offsetX, offsetY + i * scale);
        ctx.lineTo(offsetX + holdDimensions.length * scale, offsetY + i * scale);
        ctx.stroke();
      }

      // Draw ULDs
      const completedULDs = ulds.filter(uld => uld.status === 'completed' || uld.status === 'loaded');
      completedULDs.forEach((uld, index) => {
        if (!uld.position) return;

        const x = offsetX + uld.position.x * scale;
        const y = offsetY + uld.position.y * scale;
        const w = uld.dimensions.length * scale;
        const h = uld.dimensions.width * scale;

        // ULD container
        const utilization = (uld.currentWeight / uld.maxWeight) * 100;
        let color;
        if (utilization > 90) {
          color = 'rgba(239, 68, 68, 0.7)'; // Red - overloaded warning
        } else if (utilization > 70) {
          color = 'rgba(34, 197, 94, 0.7)'; // Green - optimal
        } else {
          color = 'rgba(59, 130, 246, 0.7)'; // Blue - underutilized
        }

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(x + 3, y + 3, w, h);

        // ULD body
        ctx.fillStyle = color;
        ctx.fillRect(x, y, w, h);

        // Border
        ctx.strokeStyle = uld.stability < 70 ? '#ef4444' : '#3b82f6';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);

        // ULD label
        ctx.fillStyle = 'white';
        ctx.font = 'bold 11px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(uld.name, x + w / 2, y + h / 2 - 10);
        
        ctx.font = '9px Arial';
        ctx.fillText(`${uld.packages.length} pkgs`, x + w / 2, y + h / 2 + 2);
        ctx.fillText(`${uld.currentWeight}kg`, x + w / 2, y + h / 2 + 12);
        
        // Stability indicator
        const stabColor = uld.stability > 80 ? '#22c55e' : uld.stability > 60 ? '#eab308' : '#ef4444';
        ctx.fillStyle = stabColor;
        ctx.fillText(`${uld.stability.toFixed(0)}%`, x + w / 2, y + h / 2 + 22);

        // Warning icon if issues
        if (uld.stability < 70 || utilization > 95) {
          ctx.fillStyle = '#fbbf24';
          ctx.font = 'bold 16px Arial';
          ctx.fillText('⚠', x + w - 10, y + 15);
        }
      });

      // Draw labels
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(`Aircraft Hold: ${holdDimensions.length}m × ${holdDimensions.width}m`, offsetX, offsetY - 60);
      
      const totalWeight = completedULDs.reduce((sum, uld) => sum + uld.currentWeight, 0);
      const totalPackages = completedULDs.reduce((sum, uld) => sum + uld.packages.length, 0);
      
      ctx.font = '12px Arial';
      ctx.fillText(`ULDs Loaded: ${completedULDs.length}`, offsetX, offsetY - 40);
      ctx.fillText(`Total Weight: ${totalWeight}kg`, offsetX, offsetY - 25);
      ctx.fillText(`Total Packages: ${totalPackages}`, offsetX, offsetY - 10);
    };
  }, [ulds, holdDimensions]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onULDClick) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const scale = 15;
    const offsetX = 50;
    const offsetY = 100;

    const completedULDs = ulds.filter(uld => uld.status === 'completed' || uld.status === 'loaded');
    
    for (const uld of completedULDs) {
      if (!uld.position) continue;

      const uldX = offsetX + uld.position.x * scale;
      const uldY = offsetY + uld.position.y * scale;
      const uldW = uld.dimensions.length * scale;
      const uldH = uld.dimensions.width * scale;

      if (x >= uldX && x <= uldX + uldW && y >= uldY && y <= uldY + uldH) {
        onULDClick(uld);
        break;
      }
    }
  };

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        width={785}
        height={508}
        onClick={handleCanvasClick}
        className="cursor-pointer"
        style={{ width: '100%', height: '100%' }}
      />
      
      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-black/70 backdrop-blur-sm rounded-lg p-3 text-white text-[10px] space-y-1">
        <div className="font-bold mb-2">Color Legend:</div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-[#3b82f6] rounded"></div>
          <span>&lt;70% Load</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-[#22c55e] rounded"></div>
          <span>70-90% Optimal</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-[#ef4444] rounded"></div>
          <span>&gt;90% Warning</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[#fbbf24] text-xl">⚠</span>
          <span>Safety Alert</span>
        </div>
      </div>
    </div>
  );
}