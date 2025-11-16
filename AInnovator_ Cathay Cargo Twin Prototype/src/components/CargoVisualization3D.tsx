import React, { useRef, useEffect, useState } from 'react';
import { Package, ULDContainer, SensorData } from '../types/cargo';

interface CargoVisualization3DProps {
  packages: Package[];
  containerType: ULDContainer;
  sensorData: SensorData;
  onPackageMove?: (packageId: string, newPosition: { x: number; y: number; z: number }) => void;
}

export function CargoVisualization3D({ packages, containerType, sensorData, onPackageMove }: CargoVisualization3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rotation, setRotation] = useState({ x: -25, y: 35 });
  const [zoom, setZoom] = useState(80);
  const [isDragging, setIsDragging] = useState(false);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });
  const [containerScale, setContainerScale] = useState(1.0);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [isDraggingPackage, setIsDraggingPackage] = useState(false);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null);
  const [ghostPosition, setGhostPosition] = useState<{ x: number; y: number; z: number } | null>(null);
  const [isManualMode, setIsManualMode] = useState(false);

  // Apply gravity simulation to packages
  const simulateGravity = (pkgs: Package[]): Package[] => {
    const sorted = [...pkgs].sort((a, b) => {
      // Sort by position priority: positioned items first, then by weight (heavy first)
      if (a.position && !b.position) return -1;
      if (!a.position && b.position) return 1;
      return b.weight - a.weight;
    });

    const placedPackages: Package[] = [];

    for (const pkg of sorted) {
      if (pkg.position) {
        // Keep manually positioned packages
        placedPackages.push(pkg);
      } else {
        // Auto-position with gravity
        const pos = findLowestPosition(pkg, placedPackages, containerType.dimensions);
        placedPackages.push({ ...pkg, position: pos });
      }
    }

    return placedPackages;
  };

  // Check if package is out of bounds
  const isPackageOutOfBounds = (
    pkg: Package,
    containerDims: { length: number; width: number; height: number }
  ): boolean => {
    if (!pkg.position) return false;
    
    const margin = 0.02; // 2cm margin
    
    // Check if package extends beyond container in any direction
    const exceedsX = pkg.position.x < margin || 
                     pkg.position.x + pkg.dimensions.length > containerDims.length - margin;
    const exceedsY = pkg.position.y < 0 || 
                     pkg.position.y + pkg.dimensions.height > containerDims.height;
    const exceedsZ = pkg.position.z < margin || 
                     pkg.position.z + pkg.dimensions.width > containerDims.width - margin;
    
    return exceedsX || exceedsY || exceedsZ;
  };

  // Find lowest stable position for a package
  const findLowestPosition = (
    pkg: Package,
    placed: Package[],
    containerDims: { length: number; width: number; height: number }
  ): { x: number; y: number; z: number } => {
    const margin = 0.02; // 2cm margin for safety
    
    // Check if package dimensions exceed container - if so, return null position
    if (pkg.dimensions.length > containerDims.length - (margin * 2) ||
        pkg.dimensions.width > containerDims.width - (margin * 2) ||
        pkg.dimensions.height > containerDims.height) {
      console.warn(`Package ${pkg.name} (${pkg.dimensions.length}×${pkg.dimensions.width}×${pkg.dimensions.height}m) exceeds container size (${containerDims.length}×${containerDims.width}×${containerDims.height}m) with margins`);
      return { x: -1000, y: -1000, z: -1000 }; // Invalid position marker
    }
    
    // Try to find the best position by testing grid points
    const gridResolution = 0.1; // 10cm grid resolution
    const positions: Array<{ x: number; y: number; z: number; score: number }> = [];

    // Generate potential positions on the floor and on top of packages
    // CRITICAL: Ensure we stay within margins
    const maxX = containerDims.length - pkg.dimensions.length - margin;
    const maxZ = containerDims.width - pkg.dimensions.width - margin;
    
    for (let x = margin; x <= maxX; x += gridResolution) {
      for (let z = margin; z <= maxZ; z += gridResolution) {
        // Check all possible Y levels (floor and on top of each package)
        const yLevels = [0]; // Start with floor level

        // Add Y levels on top of each placed package
        placed.forEach(other => {
          if (!other.position) return;
          
          // Check if there's XZ overlap potential
          const xOverlap = !(
            x + pkg.dimensions.length <= other.position.x + margin ||
            x >= other.position.x + other.dimensions.length - margin
          );
          const zOverlap = !(
            z + pkg.dimensions.width <= other.position.z + margin ||
            z >= other.position.z + other.dimensions.width - margin
          );

          if (xOverlap && zOverlap) {
            yLevels.push(other.position.y + other.dimensions.height + margin);
          }
        });

        // Test each Y level
        yLevels.forEach(y => {
          // CRITICAL: Check if package stays within container boundaries INCLUDING MARGINS
          if (y + pkg.dimensions.height > containerDims.height) return;
          if (x + pkg.dimensions.length > containerDims.length - margin) return;
          if (z + pkg.dimensions.width > containerDims.width - margin) return;
          if (x < margin || z < margin) return;

          // Create test position
          const testPos = { x, y, z };

          // Check for collisions with ALL placed packages
          let hasCollision = false;
          for (const other of placed) {
            if (!other.position) continue;
            if (checkCollision(testPos, pkg.dimensions, other.position, other.dimensions)) {
              hasCollision = true;
              break;
            }
          }

          if (!hasCollision) {
            // Check if package has support below (not floating)
            let hasSupport = y === 0; // Floor is always support

            if (y > 0) {
              // Need to check if there's a package below providing support
              for (const other of placed) {
                if (!other.position) continue;

                // Check if this package is directly below and provides support
                const isBelow = Math.abs(other.position.y + other.dimensions.height - y) < margin * 2;
                const xOverlap = !(
                  testPos.x + pkg.dimensions.length <= other.position.x ||
                  testPos.x >= other.position.x + other.dimensions.length
                );
                const zOverlap = !(
                  testPos.z + pkg.dimensions.width <= other.position.z ||
                  testPos.z >= other.position.z + other.dimensions.width
                );

                if (isBelow && xOverlap && zOverlap) {
                  // Calculate overlap area percentage
                  const overlapX = Math.min(testPos.x + pkg.dimensions.length, other.position.x + other.dimensions.length) -
                                   Math.max(testPos.x, other.position.x);
                  const overlapZ = Math.min(testPos.z + pkg.dimensions.width, other.position.z + other.dimensions.width) -
                                   Math.max(testPos.z, other.position.z);
                  const overlapArea = overlapX * overlapZ;
                  const packageArea = pkg.dimensions.length * pkg.dimensions.width;
                  
                  // Require at least 50% support
                  if (overlapArea / packageArea >= 0.5) {
                    hasSupport = true;
                    break;
                  }
                }
              }
            }

            if (hasSupport) {
              // Calculate score (prefer lower Y, then prefer positions closer to origin)
              const score = -y * 100 - Math.sqrt(x * x + z * z);
              positions.push({ x, y, z, score });
            }
          }
        });
      }
    }

    // Find best position (highest score = lowest, most compact)
    if (positions.length > 0) {
      positions.sort((a, b) => b.score - a.score);
      return positions[0];
    }

    // No valid position found - package too large or no space
    console.warn(`No valid position found for package ${pkg.name}`);
    return { x: -1000, y: -1000, z: -1000 }; // Invalid position marker
  };

  // Check if two boxes collide with strict precision
  const checkCollision = (
    pos1: { x: number; y: number; z: number },
    dims1: { length: number; width: number; height: number },
    pos2: { x: number; y: number; z: number },
    dims2: { length: number; width: number; height: number }
  ): boolean => {
    const epsilon = 0.001; // Very small tolerance for floating point comparison
    
    // Boxes collide if they overlap in all three dimensions
    const xOverlap = !(
      pos1.x + dims1.length <= pos2.x + epsilon ||
      pos1.x >= pos2.x + dims2.length - epsilon
    );
    const yOverlap = !(
      pos1.y + dims1.height <= pos2.y + epsilon ||
      pos1.y >= pos2.y + dims2.height - epsilon
    );
    const zOverlap = !(
      pos1.z + dims1.width <= pos2.z + epsilon ||
      pos1.z >= pos2.z + dims2.width - epsilon
    );

    return xOverlap && yOverlap && zOverlap;
  };

  // 3D projection
  const project3D = (x: number, y: number, z: number, width: number, height: number) => {
    const scale = zoom * containerScale;
    const centerX = width / 2;
    const centerY = height / 2;

    // Offset to center the container
    const offsetX = -containerType.dimensions.length / 2;
    const offsetY = -containerType.dimensions.height / 2;
    const offsetZ = -containerType.dimensions.width / 2;

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

  // Draw a 3D box
  const drawBox = (
    ctx: CanvasRenderingContext2D,
    pos: { x: number; y: number; z: number },
    dims: { length: number; width: number; height: number },
    color: string,
    alpha: number = 1.0
  ) => {
    const width = canvasRef.current!.width;
    const height = canvasRef.current!.height;

    // Define 8 corners of the box
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

    // Draw faces
    ctx.globalAlpha = alpha * 0.7;
    
    // Top face
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(corners[4].x, corners[4].y);
    ctx.lineTo(corners[5].x, corners[5].y);
    ctx.lineTo(corners[6].x, corners[6].y);
    ctx.lineTo(corners[7].x, corners[7].y);
    ctx.closePath();
    ctx.fill();

    // Front face (darker)
    const darkerColor = adjustColor(color, 0.7);
    ctx.fillStyle = darkerColor;
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    ctx.lineTo(corners[1].x, corners[1].y);
    ctx.lineTo(corners[5].x, corners[5].y);
    ctx.lineTo(corners[4].x, corners[4].y);
    ctx.closePath();
    ctx.fill();

    // Right face (darkest)
    const darkestColor = adjustColor(color, 0.5);
    ctx.fillStyle = darkestColor;
    ctx.beginPath();
    ctx.moveTo(corners[1].x, corners[1].y);
    ctx.lineTo(corners[2].x, corners[2].y);
    ctx.lineTo(corners[6].x, corners[6].y);
    ctx.lineTo(corners[5].x, corners[5].y);
    ctx.closePath();
    ctx.fill();

    // Draw edges
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = adjustColor(color, 0.3);
    ctx.lineWidth = 1.5;

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

    ctx.globalAlpha = 1.0;
  };

  const adjustColor = (color: string, factor: number): string => {
    const hex = color.replace('#', '');
    const r = Math.floor(parseInt(hex.substr(0, 2), 16) * factor);
    const g = Math.floor(parseInt(hex.substr(2, 2), 16) * factor);
    const b = Math.floor(parseInt(hex.substr(4, 2), 16) * factor);
    return `rgb(${r}, ${g}, ${b})`;
  };

  // Main render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#0a0e1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid overlay with dimension-aware spacing
    const dims = containerType.dimensions;
    const gridSpacing = Math.min(30, canvas.width / dims.length);
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.15)';
    ctx.lineWidth = 1;
    
    for (let i = 0; i <= canvas.width; i += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, canvas.height);
      ctx.stroke();
    }
    for (let i = 0; i <= canvas.height; i += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(canvas.width, i);
      ctx.stroke();
    }

    // Apply gravity to packages
    const positionedPackages = simulateGravity(packages);

    // Draw container wireframe
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'; // White border
    ctx.lineWidth = 2;
    const containerPos = { x: 0, y: 0, z: 0 };
    drawBox(ctx, containerPos, containerType.dimensions, '#3b82f6', 0.3);

    // Draw floor highlight
    const width = canvas.width;
    const height = canvas.height;
    const floorCorners = [
      project3D(0, 0, 0, width, height),
      project3D(containerType.dimensions.length, 0, 0, width, height),
      project3D(containerType.dimensions.length, 0, containerType.dimensions.width, width, height),
      project3D(0, 0, containerType.dimensions.width, width, height)
    ];

    ctx.fillStyle = 'rgba(43, 127, 255, 0.1)';
    ctx.beginPath();
    ctx.moveTo(floorCorners[0].x, floorCorners[0].y);
    ctx.lineTo(floorCorners[1].x, floorCorners[1].y);
    ctx.lineTo(floorCorners[2].x, floorCorners[2].y);
    ctx.lineTo(floorCorners[3].x, floorCorners[3].y);
    ctx.closePath();
    ctx.fill();

    // Add TOP label on the ceiling
    const topCenter = project3D(
      containerType.dimensions.length / 2,
      containerType.dimensions.height,
      containerType.dimensions.width / 2,
      width,
      height
    );
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
    const bottomCenter = project3D(
      containerType.dimensions.length / 2,
      0,
      containerType.dimensions.width / 2,
      width,
      height
    );
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

    // Sort packages by depth for correct rendering order
    const sortedPackages = [...positionedPackages].sort((a, b) => {
      const aDepth = a.position ? project3D(a.position.x, a.position.y, a.position.z, width, height).z : 0;
      const bDepth = b.position ? project3D(b.position.x, b.position.y, b.position.z, width, height).z : 0;
      return aDepth - bDepth;
    });

    // Draw packages
    sortedPackages.forEach((pkg) => {
      if (!pkg.position) return;
      
      // Dark green color scheme
      const color = pkg.color || (pkg.fragile ? '#dc2626' : '#166534'); // Dark green or red for fragile
      drawBox(ctx, pkg.position, pkg.dimensions, color, 0.9);

      // Draw label
      const center = project3D(
        pkg.position.x + pkg.dimensions.length / 2,
        pkg.position.y + pkg.dimensions.height + 0.1,
        pkg.position.z + pkg.dimensions.width / 2,
        width,
        height
      );

      ctx.fillStyle = 'white';
      ctx.font = 'bold 10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(pkg.name, center.x, center.y);
      
      if (pkg.fragile) {
        ctx.fillStyle = '#fbbf24';
        ctx.fillText('⚠ FRAGILE', center.x, center.y + 12);
      }
    });

    // Draw dimensions overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = '11px Consolas';
    ctx.textAlign = 'left';
    ctx.fillText(`Length: ${containerType.dimensions.length}m`, 16, canvas.height - 60);
    ctx.fillText(`Width: ${containerType.dimensions.width}m`, 16, canvas.height - 45);
    ctx.fillText(`Height: ${containerType.dimensions.height}m`, 16, canvas.height - 30);
    ctx.fillText(`Scale: ${(containerScale * 100).toFixed(0)}%`, 16, canvas.height - 15);

    // Draw container shape indicator
    const shapeType = 
      Math.abs(dims.length - dims.width) < 0.5 && Math.abs(dims.width - dims.height) < 0.5 ? 'Cube' :
      Math.abs(dims.length - dims.width) < 0.5 ? 'Square Base' :
      dims.length > dims.width * 1.5 ? 'Long Rectangle' :
      'Rectangle';
    
    ctx.fillStyle = 'rgba(43, 127, 255, 0.8)';
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(`Shape: ${shapeType}`, canvas.width - 16, canvas.height - 15);

  }, [packages, containerType, rotation, zoom, containerScale]);

  // Mouse handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setLastMouse({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;

    const deltaX = e.clientX - lastMouse.x;
    const deltaY = e.clientY - lastMouse.y;

    setRotation({
      x: rotation.x + deltaY * 0.5,
      y: rotation.y + deltaX * 0.5
    });

    setLastMouse({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -5 : 5;
    setZoom(Math.max(30, Math.min(150, zoom + delta)));
  };

  // Keyboard controls for container size
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === '+' || e.key === '=') {
        setContainerScale(prev => Math.min(2.0, prev + 0.1));
      } else if (e.key === '-' || e.key === '_') {
        setContainerScale(prev => Math.max(0.5, prev - 0.1));
      } else if (e.key === '0') {
        setContainerScale(1.0);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        width={785}
        height={508}
        className="cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{ width: '100%', height: '100%' }}
      />

      {/* Size adjustment controls */}
      <div className="absolute top-4 right-4 bg-black/70 backdrop-blur-sm rounded-lg p-3 space-y-2">
        <div className="text-white text-xs font-bold mb-1">Container Size</div>
        <div className="flex gap-2">
          <button
            onClick={() => setContainerScale(prev => Math.max(0.5, prev - 0.1))}
            className="bg-white/20 hover:bg-white/30 text-white px-2 py-1 rounded text-xs"
          >
            -
          </button>
          <div className="text-white text-xs px-2 py-1 min-w-[50px] text-center">
            {(containerScale * 100).toFixed(0)}%
          </div>
          <button
            onClick={() => setContainerScale(prev => Math.min(2.0, prev + 0.1))}
            className="bg-white/20 hover:bg-white/30 text-white px-2 py-1 rounded text-xs"
          >
            +
          </button>
        </div>
        <div className="text-white/60 text-[10px] mt-2">
          Keys: +/- to resize<br/>
          Mouse: Drag rotate, Scroll zoom
        </div>
      </div>
    </div>
  );
}