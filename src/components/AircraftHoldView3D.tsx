import React, { useRef, useEffect, useState } from 'react';
import { ULDContainer } from '../types/cargo';
import { calculateHoldCOG, calculateHoldStability } from '../utils/uldOptimization';
import { AircraftConfig } from '../types/aircraft';
import { ZoomIn, ZoomOut, RotateCcw, Settings as SettingsIcon, Move } from 'lucide-react';

interface AircraftHoldView3DProps {
  ulds: ULDContainer[];
  aircraftConfig: AircraftConfig;
  onULDClick?: (uld: ULDContainer) => void;
  onConfigureAircraft?: () => void;
  onULDMove?: (uldId: string, newPosition: { x: number; y: number; z: number }) => void;
}

export function AircraftHoldView3D({ ulds, aircraftConfig, onULDClick, onConfigureAircraft, onULDMove }: AircraftHoldView3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [rotation, setRotation] = useState({ x: -25, y: 35 });
  const [zoom, setZoom] = useState(30);
  const [isDragging, setIsDragging] = useState(false);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });
  const [hoveredULD, setHoveredULD] = useState<string | null>(null);
  const [isManualMode, setIsManualMode] = useState(false);
  const [selectedULDId, setSelectedULDId] = useState<string | null>(null);
  const [isDraggingULD, setIsDraggingULD] = useState(false);
  const [ghostPosition, setGhostPosition] = useState<{ x: number; y: number; z: number } | null>(null);
  const [isValidPlacement, setIsValidPlacement] = useState(true);

  const holdDimensions = aircraftConfig.holdDimensions;

  // GRAVITY SIMULATION FOR ULDs - MATCHING PACKAGE LOGIC
  const simulateULDGravity = (uldContainers: ULDContainer[]): ULDContainer[] => {
    const completedULDs = uldContainers.filter(u => u.status === 'completed' || u.status === 'loaded');
    
    // Sort by position priority: positioned items first, then by weight (heavy first)
    const sorted = [...completedULDs].sort((a, b) => {
      if (a.position && !b.position) return -1;
      if (!a.position && b.position) return 1;
      return b.currentWeight - a.currentWeight;
    });

    const placedULDs: ULDContainer[] = [];

    for (const uld of sorted) {
      if (uld.position) {
        // Keep manually positioned ULDs
        placedULDs.push(uld);
      } else {
        // Auto-position with gravity
        const pos = findLowestULDPosition(uld, placedULDs, holdDimensions);
        placedULDs.push({ ...uld, position: pos, status: 'loaded' as const });
      }
    }

    // Return all ULDs, with unpositioned ones filtered out from other statuses
    return uldContainers.map(uld => {
      const placed = placedULDs.find(p => p.id === uld.id);
      return placed || uld;
    });
  };

  // Check if ULD is out of bounds
  const isULDOutOfBounds = (
    uld: ULDContainer,
    holdDims: { length: number; width: number; height: number }
  ): boolean => {
    if (!uld.position) return false;
    
    const margin = 0.05; // 5cm margin for aircraft hold
    
    // Check if ULD extends beyond hold in any direction
    const exceedsX = uld.position.x < margin || 
                     uld.position.x + uld.dimensions.length > holdDims.length - margin;
    const exceedsY = uld.position.y < margin ||
                     uld.position.y + uld.dimensions.width > holdDims.width - margin;
    const exceedsZ = uld.position.z < 0 || 
                     uld.position.z + uld.dimensions.height > holdDims.height;
    
    return exceedsX || exceedsY || exceedsZ;
  };

  // Find lowest stable position for a ULD - EXACT SAME LOGIC AS PACKAGE PLACEMENT
  const findLowestULDPosition = (
    uld: ULDContainer,
    placed: ULDContainer[],
    holdDims: { length: number; width: number; height: number }
  ): { x: number; y: number; z: number } => {
    const margin = 0.05; // 5cm margin for safety
    
    // Check if ULD dimensions exceed hold - if so, return null position
    if (uld.dimensions.length > holdDims.length - (margin * 2) ||
        uld.dimensions.width > holdDims.width - (margin * 2) ||
        uld.dimensions.height > holdDims.height) {
      console.warn(`ULD ${uld.name} exceeds hold dimensions`);
      return { x: -1000, y: -1000, z: -1000 }; // Invalid position marker
    }
    
    // Try to find the best position by testing grid points
    const gridResolution = 0.2; // 20cm grid resolution for ULDs
    const positions: Array<{ x: number; y: number; z: number; score: number }> = [];

    // Generate potential positions on the floor and on top of ULDs
    const maxX = holdDims.length - uld.dimensions.length - margin;
    const maxY = holdDims.width - uld.dimensions.width - margin;
    
    for (let x = margin; x <= maxX; x += gridResolution) {
      for (let y = margin; y <= maxY; y += gridResolution) {
        // Check all possible Z levels (floor and on top of each ULD)
        const zLevels = [0]; // Start with floor level

        // Add Z levels on top of each placed ULD
        placed.forEach(other => {
          if (other.position) {
            zLevels.push(other.position.z + other.dimensions.height);
          }
        });

        // Test each Z level
        for (const z of zLevels) {
          // Check if this position would exceed height
          if (z + uld.dimensions.height > holdDims.height) continue;

          const testPos = { x, y, z };
          
          // Check for collisions with other ULDs
          let hasCollision = false;
          for (const other of placed) {
            if (!other.position) continue;
            if (checkULDCollision(testPos, uld.dimensions, other.position, other.dimensions)) {
              hasCollision = true;
              break;
            }
          }

          if (hasCollision) continue;

          // Check if ULD needs support (not on floor)
          if (z > 0.01) {
            if (!hasAdequateULDSupport(testPos, uld.dimensions, placed)) {
              continue; // Skip positions without proper support
            }
          }

          // Valid position found - calculate score
          // Lower positions are better (z), positions closer to center are better
          const centerX = holdDims.length / 2;
          const centerY = holdDims.width / 2;
          const distanceFromCenter = Math.sqrt(
            Math.pow(x + uld.dimensions.length / 2 - centerX, 2) +
            Math.pow(y + uld.dimensions.width / 2 - centerY, 2)
          );
          
          const score = z * 10 + distanceFromCenter; // Prioritize low z, then center
          positions.push({ x, y, z, score });
        }
      }
    }

    // Return best position (lowest score)
    if (positions.length === 0) {
      console.warn(`No valid position found for ULD ${uld.name}`);
      return { x: -1000, y: -1000, z: -1000 };
    }

    positions.sort((a, b) => a.score - b.score);
    return positions[0];
  };

  // Check for collision between two ULDs
  const checkULDCollision = (
    pos1: { x: number; y: number; z: number },
    dims1: { length: number; width: number; height: number },
    pos2: { x: number; y: number; z: number },
    dims2: { length: number; width: number; height: number }
  ): boolean => {
    const gap = 0.01; // 1cm minimum gap

    return !(
      pos1.x + dims1.length + gap <= pos2.x ||
      pos2.x + dims2.length + gap <= pos1.x ||
      pos1.y + dims1.width + gap <= pos2.y ||
      pos2.y + dims2.width + gap <= pos1.y ||
      pos1.z + dims1.height + gap <= pos2.z ||
      pos2.z + dims2.height + gap <= pos1.z
    );
  };

  // Check if ULD has adequate support from below
  const hasAdequateULDSupport = (
    pos: { x: number; y: number; z: number },
    dims: { length: number; width: number; height: number },
    placed: ULDContainer[]
  ): boolean => {
    const supportThreshold = 0.3; // Need 30% of base supported
    const tolerance = 0.03; // 3cm tolerance for gaps

    // Find all ULDs that could provide support
    const supportingULDs = placed.filter(other => {
      if (!other.position) return false;
      
      // ULD must be below
      const isBelow = Math.abs(other.position.z + other.dimensions.height - pos.z) < tolerance;
      if (!isBelow) return false;

      // Check for horizontal overlap
      const overlapX = Math.max(0, 
        Math.min(pos.x + dims.length, other.position.x + other.dimensions.length) -
        Math.max(pos.x, other.position.x)
      );
      const overlapY = Math.max(0,
        Math.min(pos.y + dims.width, other.position.y + other.dimensions.width) -
        Math.max(pos.y, other.position.y)
      );

      return overlapX > 0.01 && overlapY > 0.01;
    });

    if (supportingULDs.length === 0) return false;

    // Calculate total support area
    let totalSupportArea = 0;
    const baseArea = dims.length * dims.width;

    supportingULDs.forEach(other => {
      if (!other.position) return;
      
      const overlapX = Math.max(0,
        Math.min(pos.x + dims.length, other.position.x + other.dimensions.length) -
        Math.max(pos.x, other.position.x)
      );
      const overlapY = Math.max(0,
        Math.min(pos.y + dims.width, other.position.y + other.dimensions.width) -
        Math.max(pos.y, other.position.y)
      );

      totalSupportArea += overlapX * overlapY;
    });

    const supportRatio = totalSupportArea / baseArea;
    return supportRatio >= supportThreshold;
  };

  // 3D projection - EXACT SAME AS PACKAGE VISUALIZATION
  const project3D = (x: number, y: number, z: number, canvasWidth: number, canvasHeight: number) => {
    const scale = zoom;
    const centerX = canvasWidth / 2 - canvasWidth * 0.22; // Moved more left - FIXED POSITION
    const centerY = canvasHeight / 2 - canvasHeight * 0.25; // Moved further up - FIXED POSITION

    // Offset to center the hold horizontally, but keep floor at bottom
    const offsetX = -holdDimensions.length / 2;
    const offsetY = 0; // Don't offset Y - let floor stay at y=0
    const offsetZ = -holdDimensions.width / 2;

    x += offsetX;
    y += offsetY;
    z += offsetZ;

    // Rotate around Y axis (left-right)
    const cosY = Math.cos((rotation.y * Math.PI) / 180);
    const sinY = Math.sin((rotation.y * Math.PI) / 180);
    const x1 = x * cosY - z * sinY;
    const z1 = x * sinY + z * cosY;

    // Rotate around X axis (up-down)
    const cosX = Math.cos((rotation.x * Math.PI) / 180);
    const sinX = Math.sin((rotation.x * Math.PI) / 180);
    const y1 = y * cosX - z1 * sinX;
    const z2 = y * sinX + z1 * cosX;

    // Project to 2D
    return {
      x: centerX + x1 * scale,
      y: centerY - y1 * scale,
      z: z2
    };
  };

  // Draw a 3D ULD box with wireframe style - MATCHING ULD PACKING VISUALIZATION
  const drawULDBox = (
    ctx: CanvasRenderingContext2D,
    uld: ULDContainer,
    pos: { x: number; y: number; z: number },
    dims: { length: number; width: number; height: number },
    isHovered: boolean = false
  ) => {
    const width = canvasRef.current!.width;
    const height = canvasRef.current!.height;

    // Define 8 corners of the box (SAME AS ULD PACKING)
    const corners = [
      // Bottom corners (y=0 in ULD packing coordinate system, z=0 in aircraft)
      project3D(pos.x, pos.z, pos.y, width, height),
      project3D(pos.x + dims.length, pos.z, pos.y, width, height),
      project3D(pos.x + dims.length, pos.z, pos.y + dims.width, width, height),
      project3D(pos.x, pos.z, pos.y + dims.width, width, height),
      // Top corners (y=height in ULD packing, z=height in aircraft)
      project3D(pos.x, pos.z + dims.height, pos.y, width, height),
      project3D(pos.x + dims.length, pos.z + dims.height, pos.y, width, height),
      project3D(pos.x + dims.length, pos.z + dims.height, pos.y + dims.width, width, height),
      project3D(pos.x, pos.z + dims.height, pos.y + dims.width, width, height)
    ];

    const wireframeColor = isHovered ? '#00D4D4' : '#005D63';
    
    // Draw faces with shading (SAME STYLE AS ULD PACKING)
    ctx.globalAlpha = 0.5;
    
    // Top face (lighter)
    ctx.fillStyle = wireframeColor;
    ctx.beginPath();
    ctx.moveTo(corners[4].x, corners[4].y);
    ctx.lineTo(corners[5].x, corners[5].y);
    ctx.lineTo(corners[6].x, corners[6].y);
    ctx.lineTo(corners[7].x, corners[7].y);
    ctx.closePath();
    ctx.fill();

    // Front face (darker)
    const darkerColor = adjustColor(wireframeColor, 0.7);
    ctx.fillStyle = darkerColor;
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    ctx.lineTo(corners[1].x, corners[1].y);
    ctx.lineTo(corners[5].x, corners[5].y);
    ctx.lineTo(corners[4].x, corners[4].y);
    ctx.closePath();
    ctx.fill();

    // Right face (darkest)
    const darkestColor = adjustColor(wireframeColor, 0.5);
    ctx.fillStyle = darkestColor;
    ctx.beginPath();
    ctx.moveTo(corners[1].x, corners[1].y);
    ctx.lineTo(corners[2].x, corners[2].y);
    ctx.lineTo(corners[6].x, corners[6].y);
    ctx.lineTo(corners[5].x, corners[5].y);
    ctx.closePath();
    ctx.fill();

    // Draw edges (SAME AS ULD PACKING)
    ctx.globalAlpha = isHovered ? 1.0 : 0.8;
    ctx.strokeStyle = adjustColor(wireframeColor, 0.3);
    ctx.lineWidth = isHovered ? 2.5 : 2;

    // Bottom edges
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    ctx.lineTo(corners[1].x, corners[1].y);
    ctx.lineTo(corners[2].x, corners[2].y);
    ctx.lineTo(corners[3].x, corners[3].y);
    ctx.closePath();
    ctx.stroke();

    // Top edges
    ctx.beginPath();
    ctx.moveTo(corners[4].x, corners[4].y);
    ctx.lineTo(corners[5].x, corners[5].y);
    ctx.lineTo(corners[6].x, corners[6].y);
    ctx.lineTo(corners[7].x, corners[7].y);
    ctx.closePath();
    ctx.stroke();

    // Vertical edges
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(corners[i].x, corners[i].y);
      ctx.lineTo(corners[i + 4].x, corners[i + 4].y);
      ctx.stroke();
    }

    // Draw corner highlights for depth effect
    ctx.globalAlpha = isHovered ? 1.0 : 0.6;
    ctx.fillStyle = wireframeColor;
    const cornerSize = isHovered ? 5 : 3;
    corners.forEach(corner => {
      ctx.beginPath();
      ctx.arc(corner.x, corner.y, cornerSize, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw ULD label with shadow
    const center = project3D(
      pos.x + dims.length / 2,
      pos.z + dims.height + 0.2,
      pos.y + dims.width / 2,
      width,
      height
    );

    ctx.globalAlpha = 1.0;
    
    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.font = isHovered ? 'bold 14px monospace' : 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(uld.name, center.x + 1, center.y + 1);
    
    // Label
    ctx.fillStyle = wireframeColor;
    ctx.fillText(uld.name, center.x, center.y);
    
    // Stats
    ctx.font = '10px monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillText(`${uld.packages.length} pkgs • ${uld.currentWeight}kg`, center.x, center.y + 14);

    // Stability indicator
    if (uld.stability < 70) {
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 9px monospace';
      ctx.fillText('⚠ UNSTABLE', center.x, center.y + 26);
    } else if (isHovered) {
      ctx.fillStyle = '#22c55e';
      ctx.font = '9px monospace';
      ctx.fillText(`Stability: ${uld.stability.toFixed(0)}%`, center.x, center.y + 26);
    }

    // Draw position indicator line to floor (when hovered)
    if (isHovered) {
      const floorPoint = project3D(
        pos.x + dims.length / 2,
        0,
        pos.y + dims.width / 2,
        width,
        height
      );

      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = wireframeColor;
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(center.x, center.y - 10);
      ctx.lineTo(floorPoint.x, floorPoint.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.globalAlpha = 1.0;
  };

  // Adjust color helper (SAME AS ULD PACKING)
  const adjustColor = (color: string, factor: number): string => {
    // Handle hex colors
    if (color.startsWith('#')) {
      const hex = color.replace('#', '');
      const r = Math.floor(parseInt(hex.substr(0, 2), 16) * factor);
      const g = Math.floor(parseInt(hex.substr(2, 2), 16) * factor);
      const b = Math.floor(parseInt(hex.substr(4, 2), 16) * factor);
      return `rgb(${r}, ${g}, ${b})`;
    }
    return color;
  };

  // Draw hold outline - DARK GREEN WIREFRAME STYLE
  const drawHoldOutline = (ctx: CanvasRenderingContext2D) => {
    const width = canvasRef.current!.width;
    const height = canvasRef.current!.height;
    const pos = { x: 0, y: 0, z: 0 };
    const dims = holdDimensions;

    // Define 8 corners
    const corners = [
      project3D(pos.x, pos.y, pos.z, width, height),
      project3D(pos.x + dims.length, pos.y, pos.z, width, height),
      project3D(pos.x + dims.length, pos.y, pos.z + dims.width, width, height),
      project3D(pos.x, pos.y, pos.z + dims.width, width, height),
      project3D(pos.x, pos.y + dims.height, pos.z, width, height),
      project3D(pos.x + dims.length, pos.y + dims.height, pos.z, width, height),
      project3D(pos.x + dims.length, pos.y + dims.height, pos.z + dims.width, width, height),
      project3D(pos.x, pos.y + dims.height, pos.z + dims.width, width, height)
    ];

    // Draw hold wireframe - DARK GREEN
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = '#005D63'; // Pantone 323 C teal
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Bottom edges
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    ctx.lineTo(corners[1].x, corners[1].y);
    ctx.lineTo(corners[2].x, corners[2].y);
    ctx.lineTo(corners[3].x, corners[3].y);
    ctx.closePath();
    ctx.stroke();

    // Top edges
    ctx.beginPath();
    ctx.moveTo(corners[4].x, corners[4].y);
    ctx.lineTo(corners[5].x, corners[5].y);
    ctx.lineTo(corners[6].x, corners[6].y);
    ctx.lineTo(corners[7].x, corners[7].y);
    ctx.closePath();
    ctx.stroke();

    // Vertical edges
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(corners[i].x, corners[i].y);
      ctx.lineTo(corners[i + 4].x, corners[i + 4].y);
      ctx.stroke();
    }

    // Draw corner nodes
    ctx.fillStyle = '#005D63';
    corners.forEach(corner => {
      ctx.beginPath();
      ctx.arc(corner.x, corner.y, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw 3D floor grid - PROPERLY ALIGNED TO 3D PERSPECTIVE
    ctx.globalAlpha = 0.2;
    ctx.strokeStyle = '#005D63';
    ctx.lineWidth = 1;
    
    const gridStep = 1.0; // 1 meter grid
    
    // Draw grid lines along length (X-axis)
    for (let x = 0; x <= dims.length; x += gridStep) {
      for (let z = 0; z <= dims.width; z += gridStep) {
        if (x < dims.length) {
          // Draw line from (x, 0, z) to (x+gridStep, 0, z)
          const start = project3D(x, 0, z, width, height);
          const end = project3D(Math.min(x + gridStep, dims.length), 0, z, width, height);
          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);
          ctx.stroke();
        }
        if (z < dims.width) {
          // Draw line from (x, 0, z) to (x, 0, z+gridStep)
          const start = project3D(x, 0, z, width, height);
          const end = project3D(x, 0, Math.min(z + gridStep, dims.width), width, height);
          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);
          ctx.stroke();
        }
      }
    }

    // Add TOP label on the ceiling
    const topCenter = project3D(dims.length / 2, dims.height, dims.width / 2, width, height);
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = '#00CED1';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.lineWidth = 3;
    ctx.strokeText('TOP', topCenter.x, topCenter.y);
    ctx.fillText('TOP', topCenter.x, topCenter.y);
    
    // Add upward arrow
    ctx.strokeStyle = '#00CED1';
    ctx.lineWidth = 2;
    const arrowY = topCenter.y + 15;
    ctx.beginPath();
    ctx.moveTo(topCenter.x, arrowY);
    ctx.lineTo(topCenter.x, arrowY - 20);
    ctx.stroke();
    // Arrow head
    ctx.beginPath();
    ctx.moveTo(topCenter.x, arrowY - 20);
    ctx.lineTo(topCenter.x - 5, arrowY - 15);
    ctx.moveTo(topCenter.x, arrowY - 20);
    ctx.lineTo(topCenter.x + 5, arrowY - 15);
    ctx.stroke();

    // Add BOTTOM label on the floor
    const bottomCenter = project3D(dims.length / 2, 0, dims.width / 2, width, height);
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.lineWidth = 3;
    ctx.strokeText('BOTTOM', bottomCenter.x, bottomCenter.y - 10);
    ctx.fillText('BOTTOM', bottomCenter.x, bottomCenter.y - 10);
    
    // Add downward arrow
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 2;
    const arrowBottomY = bottomCenter.y + 10;
    ctx.beginPath();
    ctx.moveTo(bottomCenter.x, arrowBottomY);
    ctx.lineTo(bottomCenter.x, arrowBottomY + 20);
    ctx.stroke();
    // Arrow head
    ctx.beginPath();
    ctx.moveTo(bottomCenter.x, arrowBottomY + 20);
    ctx.lineTo(bottomCenter.x - 5, arrowBottomY + 15);
    ctx.moveTo(bottomCenter.x, arrowBottomY + 20);
    ctx.lineTo(bottomCenter.x + 5, arrowBottomY + 15);
    ctx.stroke();

    ctx.globalAlpha = 1.0;
  };

  // Draw Center of Gravity indicator
  const drawCOG = (ctx: CanvasRenderingContext2D) => {
    const loadedULDs = ulds.filter(u => u.status === 'loaded' && u.position);
    if (loadedULDs.length === 0) return;

    const cog = calculateHoldCOG(loadedULDs);
    const width = canvasRef.current!.width;
    const height = canvasRef.current!.height;

    const cogScreen = project3D(cog.x, cog.z, cog.y, width, height);

    // Draw COG marker
    ctx.globalAlpha = 0.8;
    
    // Outer glow
    const gradient = ctx.createRadialGradient(cogScreen.x, cogScreen.y, 0, cogScreen.x, cogScreen.y, 20);
    gradient.addColorStop(0, 'rgba(255, 215, 0, 0.6)');
    gradient.addColorStop(1, 'rgba(255, 215, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cogScreen.x, cogScreen.y, 20, 0, Math.PI * 2);
    ctx.fill();

    // Center marker
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(cogScreen.x, cogScreen.y, 6, 0, Math.PI * 2);
    ctx.fill();

    // Cross hair
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cogScreen.x - 10, cogScreen.y);
    ctx.lineTo(cogScreen.x + 10, cogScreen.y);
    ctx.moveTo(cogScreen.x, cogScreen.y - 10);
    ctx.lineTo(cogScreen.x, cogScreen.y + 10);
    ctx.stroke();

    // Label
    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = '#ffd700';
    ctx.textAlign = 'center';
    ctx.fillText('COG', cogScreen.x, cogScreen.y - 15);

    ctx.globalAlpha = 1.0;
  };

  // Main render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas resolution
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    // Clear canvas with dark background
    ctx.fillStyle = '#0a0e1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw subtle background grid
    ctx.strokeStyle = 'rgba(0, 93, 99, 0.08)';
    ctx.lineWidth = 1;
    const gridSize = 30;
    for (let i = 0; i <= canvas.width; i += gridSize) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, canvas.height);
      ctx.stroke();
    }
    for (let i = 0; i <= canvas.height; i += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(canvas.width, i);
      ctx.stroke();
    }

    // Draw hold outline first (background)
    drawHoldOutline(ctx);

    // Draw floor highlight
    const floorCorners = [
      project3D(0, 0, 0, rect.width, rect.height),
      project3D(holdDimensions.length, 0, 0, rect.width, rect.height),
      project3D(holdDimensions.length, 0, holdDimensions.width, rect.width, rect.height),
      project3D(0, 0, holdDimensions.width, rect.width, rect.height)
    ];

    const gradient = ctx.createLinearGradient(
      floorCorners[0].x, floorCorners[0].y,
      floorCorners[2].x, floorCorners[2].y
    );
    gradient.addColorStop(0, 'rgba(0, 93, 99, 0.1)');
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0.1)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(floorCorners[0].x, floorCorners[0].y);
    ctx.lineTo(floorCorners[1].x, floorCorners[1].y);
    ctx.lineTo(floorCorners[2].x, floorCorners[2].y);
    ctx.lineTo(floorCorners[3].x, floorCorners[3].y);
    ctx.closePath();
    ctx.fill();

    // Filter and sort ULDs by depth (painter's algorithm)
    const completedULDs = ulds.filter(uld => 
      (uld.status === 'completed' || uld.status === 'loaded') && uld.position
    );

    const sortedULDs = [...completedULDs].sort((a, b) => {
      if (!a.position || !b.position) return 0;
      const aDepth = project3D(a.position.x, a.position.z, a.position.y, rect.width, rect.height).z;
      const bDepth = project3D(b.position.x, b.position.z, b.position.y, rect.width, rect.height).z;
      return aDepth - bDepth;
    });

    // Draw ULDs
    sortedULDs.forEach((uld) => {
      const isHovered = hoveredULD === uld.id;
      drawULDBox(ctx, uld, uld.position!, uld.dimensions, isHovered);
    });

    // Draw Center of Gravity
    drawCOG(ctx);

    // Draw statistics overlay
    const loadedULDs = ulds.filter(u => u.status === 'loaded');
    const totalWeight = loadedULDs.reduce((sum, uld) => sum + uld.currentWeight, 0);
    const stability = loadedULDs.length > 0 ? calculateHoldStability(loadedULDs, holdDimensions) : 100;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(12, rect.height - 95, 250, 80);
    
    ctx.fillStyle = 'rgba(0, 93, 99, 0.8)';
    ctx.fillRect(12, rect.height - 95, 250, 2);

    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = '#005D63';
    ctx.textAlign = 'left';
    ctx.fillText('AIRCRAFT HOLD STATUS', 20, rect.height - 75);

    ctx.font = '10px monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillText(`Hold: ${holdDimensions.length}×${holdDimensions.width}×${holdDimensions.height}m`, 20, rect.height - 58);
    ctx.fillText(`ULDs Loaded: ${loadedULDs.length}`, 20, rect.height - 43);
    ctx.fillText(`Total Weight: ${totalWeight.toFixed(0)}kg`, 20, rect.height - 28);
    
    // Stability with color coding
    ctx.fillStyle = stability >= 80 ? '#22c55e' : stability >= 60 ? '#f59e0b' : '#ef4444';
    ctx.fillText(`Stability: ${stability.toFixed(0)}%`, 20, rect.height - 13);

  }, [ulds, holdDimensions, rotation, zoom, hoveredULD]);

  // Mouse handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setLastMouse({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      const deltaX = e.clientX - lastMouse.x;
      const deltaY = e.clientY - lastMouse.y;

      setRotation({
        x: Math.max(-90, Math.min(0, rotation.x + deltaY * 0.5)),
        y: rotation.y + deltaX * 0.5
      });

      setLastMouse({ x: e.clientX, y: e.clientY });
    }

    // Hover detection
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const completedULDs = ulds.filter(uld => 
      (uld.status === 'completed' || uld.status === 'loaded') && uld.position
    );

    let foundHover = false;
    for (const uld of completedULDs) {
      if (!uld.position) continue;

      // Check if mouse is inside the projected 3D box (NOT just near the center/label)
      const pos = uld.position;
      const dims = uld.dimensions;

      // Get all 8 corners of the ULD box
      const corners = [
        project3D(pos.x, pos.z, pos.y, rect.width, rect.height),
        project3D(pos.x + dims.length, pos.z, pos.y, rect.width, rect.height),
        project3D(pos.x + dims.length, pos.z, pos.y + dims.width, rect.width, rect.height),
        project3D(pos.x, pos.z, pos.y + dims.width, rect.width, rect.height),
        project3D(pos.x, pos.z + dims.height, pos.y, rect.width, rect.height),
        project3D(pos.x + dims.length, pos.z + dims.height, pos.y, rect.width, rect.height),
        project3D(pos.x + dims.length, pos.z + dims.height, pos.y + dims.width, rect.width, rect.height),
        project3D(pos.x, pos.z + dims.height, pos.y + dims.width, rect.width, rect.height)
      ];

      // Check if mouse is within the bounding box of the ULD (in screen space)
      const minX = Math.min(...corners.map(c => c.x));
      const maxX = Math.max(...corners.map(c => c.x));
      const minY = Math.min(...corners.map(c => c.y));
      const maxY = Math.max(...corners.map(c => c.y));

      // Check if mouse is within the bounding rectangle of the ULD
      if (mouseX >= minX && mouseX <= maxX && mouseY >= minY && mouseY <= maxY) {
        setHoveredULD(uld.id);
        foundHover = true;
        break;
      }
    }

    if (!foundHover) {
      setHoveredULD(null);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -5 : 5;
    setZoom(Math.max(40, Math.min(150, zoom + delta)));
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onULDClick || !hoveredULD) return;
    
    const uld = ulds.find(u => u.id === hoveredULD);
    if (uld) {
      onULDClick(uld);
    }
  };

  const handleManualModeToggle = () => {
    setIsManualMode(!isManualMode);
    if (!isManualMode) {
      setSelectedULDId(null);
      setIsDraggingULD(false);
      setGhostPosition(null);
      setIsValidPlacement(true);
    }
  };

  const handleULDSelect = (uldId: string) => {
    setSelectedULDId(uldId);
    setIsDraggingULD(true);
  };

  const handleULDMove = (newPosition: { x: number; y: number; z: number }) => {
    if (onULDMove && selectedULDId) {
      onULDMove(selectedULDId, newPosition);
    }
    setIsDraggingULD(false);
    setSelectedULDId(null);
    setGhostPosition(null);
    setIsValidPlacement(true);
  };

  const handleGhostPositionUpdate = (newPosition: { x: number; y: number; z: number }) => {
    setGhostPosition(newPosition);
    // Add logic to check if the new position is valid
    // For now, assume all positions are valid
    setIsValidPlacement(true);
  };

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className="cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onClick={handleClick}
        style={{ width: '100%', height: '100%' }}
      />

      {/* Controls overlay */}
      <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-sm rounded-lg p-2 border border-[rgba(0,93,99,0.3)] space-y-1.5 min-w-[160px]">
        <div className="text-[#00CED1] font-bold text-[10px] mb-1.5 text-center">✈️ HOLD VIEW</div>
        
        {/* Zoom Controls - Horizontal with percentage in middle */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setZoom(Math.max(10, zoom - 10))}
            className="flex-1 bg-[rgba(0,93,99,0.2)] hover:bg-[rgba(0,93,99,0.3)] text-[#00CED1] px-2 py-1.5 rounded text-sm transition-all border border-[rgba(0,93,99,0.4)] font-bold"
          >
            -
          </button>
          <div className="px-2 py-1 text-center min-w-[50px]">
            <div className="text-[#00CED1] font-bold text-sm">{zoom}%</div>
          </div>
          <button
            onClick={() => setZoom(Math.min(150, zoom + 10))}
            className="flex-1 bg-[rgba(0,93,99,0.2)] hover:bg-[rgba(0,93,99,0.3)] text-[#00CED1] px-2 py-1.5 rounded text-sm transition-all border border-[rgba(0,93,99,0.4)] font-bold"
          >
            +
          </button>
        </div>
        
        <button
          onClick={onConfigureAircraft}
          className="w-full bg-[rgba(0,93,99,0.2)] hover:bg-[rgba(0,93,99,0.3)] text-[#00CED1] px-2 py-2 rounded text-[10px] transition-all border border-[rgba(0,93,99,0.4)]"
        >
          <SettingsIcon className="inline-block w-3 h-3 mr-1" />
          Aircraft Configuration
        </button>
      </div>

      {/* ULD hover info */}
      {hoveredULD && (() => {
        const uld = ulds.find(u => u.id === hoveredULD);
        if (!uld) return null;
        const utilization = ((uld.currentWeight / uld.maxWeight) * 100).toFixed(1);
        const hasFragile = uld.packages.some(p => p.fragile);
        
        return (
          <div className="absolute top-32 right-4 bg-black/85 backdrop-blur-sm rounded-lg p-4 min-w-[250px] border border-[rgba(0,93,99,0.4)]">
            <div className="flex items-center gap-2 mb-2">
              <div className="size-3 bg-[#005D63] rounded-full animate-pulse" />
              <div className="text-white font-bold">{uld.name}</div>
            </div>
            <div className="text-white/80 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-white/60">Type:</span>
                <span>{uld.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Dimensions:</span>
                <span>{uld.dimensions.length}×{uld.dimensions.width}×{uld.dimensions.height}m</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Packages:</span>
                <span>{uld.packages.length} items</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Weight:</span>
                <span>{uld.currentWeight}kg / {uld.maxWeight}kg</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Utilization:</span>
                <span className={utilization > '90' ? 'text-orange-400' : 'text-green-400'}>
                  {utilization}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Stability:</span>
                <span className={uld.stability >= 70 ? 'text-green-400' : 'text-red-400'}>
                  {uld.stability.toFixed(1)}%
                </span>
              </div>
              {uld.position && (
                <div className="flex justify-between">
                  <span className="text-white/60">Position:</span>
                  <span className="text-cyan-400">
                    ({uld.position.x.toFixed(1)}, {uld.position.y.toFixed(1)}, {uld.position.z.toFixed(1)})
                  </span>
                </div>
              )}
              {hasFragile && (
                <div className="flex items-center gap-1 text-yellow-400 mt-2 pt-2 border-t border-white/20">
                  <span>⚠️</span>
                  <span>Contains fragile items</span>
                </div>
              )}
              <div className={`mt-2 pt-2 border-t border-white/20 text-center font-bold ${
                uld.stability >= 70 ? 'text-green-400' : 'text-red-400'
              }`}>
                {uld.stability >= 70 ? '✓ STABLE' : '⚠ UNSTABLE'}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Manual Placement Overlay */}
      {isManualMode && (
        <div className="absolute top-4 left-4 space-y-2">
          {/* Manual Mode Toggle */}
          <button
            onClick={handleManualModeToggle}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-[#005D63] to-[#004852] text-white shadow-lg"
          >
            <Move className="size-4" />
            <span className="text-sm font-bold">Manual Mode: ON</span>
          </button>

          {/* Manual Mode Instructions */}
          <div className="bg-black/80 backdrop-blur-sm rounded-lg p-3 border border-[rgba(0,93,99,0.4)] max-w-[280px]">
            <div className="text-[#005D63] text-xs font-bold mb-2">📦 MANUAL PLACEMENT MODE</div>
            <div className="text-white/80 text-[10px] space-y-1">
              <div>• Click ULD to select</div>
              <div>• Drag to move position</div>
              <div>• Green = valid placement</div>
              <div>• Red = invalid (collision/out of bounds)</div>
              <div>• Release to place</div>
            </div>
            {selectedULDId && (() => {
              const selectedULD = ulds.find(u => u.id === selectedULDId);
              return selectedULD ? (
                <div className="mt-2 pt-2 border-t border-white/20">
                  <div className="text-cyan-400 text-[10px] font-bold">
                    Selected: {selectedULD.name}
                  </div>
                </div>
              ) : null;
            })()}
          </div>
        </div>
      )}

      {/* Center of Gravity Legend */}
      {ulds.filter(u => u.status === 'loaded' && u.position).length > 0 && (
        <div className="absolute bottom-4 right-4 bg-black/80 backdrop-blur-sm rounded-lg p-2.5 border border-yellow-500/40">
          <div className="flex items-center gap-2">
            <div className="relative">
              {/* COG Icon */}
              <div className="w-6 h-6 rounded-full bg-gradient-radial from-yellow-400/60 to-transparent flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
              </div>
              {/* Cross hair */}
              <svg className="absolute inset-0 w-6 h-6" viewBox="0 0 24 24">
                <line x1="4" y1="12" x2="20" y2="12" stroke="#ffd700" strokeWidth="1.5" />
                <line x1="12" y1="4" x2="12" y2="20" stroke="#ffd700" strokeWidth="1.5" />
              </svg>
            </div>
            <div>
              <div className="text-yellow-400 text-xs font-bold">COG</div>
              <div className="text-white/60 text-[10px]">Center of Gravity</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}