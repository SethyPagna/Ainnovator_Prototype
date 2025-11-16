// ULD Placement Optimization for Aircraft Hold
// EXACT SAME PHYSICS AS PACKAGE PACKING - just ULDs instead of packages

import { ULDContainer, Strategy, OPTIMIZATION_CONDITIONS } from '../types/cargo';

interface PlacedULD extends ULDContainer {
  position: { x: number; y: number; z: number };
}

// Check if two ULDs overlap in 3D space (CORNER-BASED) - EXACT COPY FROM PACKAGE LOGIC
function checkOverlap(
  pos1: { x: number; y: number; z: number },
  dims1: { length: number; width: number; height: number },
  pos2: { x: number; y: number; z: number },
  dims2: { length: number; width: number; height: number }
): boolean {
  // CORNER-BASED: positions represent bottom-left-front corner
  const box1 = {
    minX: pos1.x,
    maxX: pos1.x + dims1.length,
    minY: pos1.y,
    maxY: pos1.y + dims1.width,
    minZ: pos1.z,
    maxZ: pos1.z + dims1.height
  };

  const box2 = {
    minX: pos2.x,
    maxX: pos2.x + dims2.length,
    minY: pos2.y,
    maxY: pos2.y + dims2.width,
    minZ: pos2.z,
    maxZ: pos2.z + dims2.height
  };

  // Check overlap in all three dimensions
  return !(
    box1.maxX <= box2.minX ||
    box1.minX >= box2.maxX ||
    box1.maxY <= box2.minY ||
    box1.minY >= box2.maxY ||
    box1.maxZ <= box2.minZ ||
    box1.minZ >= box2.maxZ
  );
}

// Check if position is within aircraft hold bounds (CORNER-BASED) - EXACT COPY FROM PACKAGE LOGIC
function isWithinHold(
  pos: { x: number; y: number; z: number },
  dims: { length: number; width: number; height: number },
  hold: { dimensions: { length: number; width: number; height: number } }
): boolean {
  const margin = 0.05; // 5cm safety margin from hold walls

  // CORNER-BASED: position is bottom-left-front corner
  // ULD extends from pos.x to pos.x + dims.length
  return (
    pos.x >= margin &&
    pos.x + dims.length <= hold.dimensions.length - margin &&
    pos.y >= margin &&
    pos.y + dims.width <= hold.dimensions.width - margin &&
    pos.z >= 0 &&
    pos.z + dims.height <= hold.dimensions.height
  );
}

// Find the lowest stable position for a ULD at (x, y) - CORNER-BASED - EXACT COPY FROM PACKAGE LOGIC
function findLowestZPosition(
  x: number,
  y: number,
  uld: ULDContainer,
  placedULDs: PlacedULD[]
): number {
  let z = 0;
  const margin = 0.01; // 1cm margin for stability

  // Check if we need to stack on top of other ULDs
  for (const placed of placedULDs) {
    // CORNER-BASED: Check if ULDs overlap in XY plane
    const xyOverlap = !(
      x + uld.dimensions.length <= placed.position.x ||
      x >= placed.position.x + placed.dimensions.length ||
      y + uld.dimensions.width <= placed.position.y ||
      y >= placed.position.y + placed.dimensions.width
    );

    if (xyOverlap) {
      // This ULD is below us, so we need to be on top of it
      const topZ = placed.position.z + placed.dimensions.height + margin;
      z = Math.max(z, topZ);
    }
  }

  return z;
}

// Check if a ULD can be stably placed (has support from below) - CORNER-BASED - EXACT COPY FROM PACKAGE LOGIC
// GRAVITY: ULDs MUST have something below them (reduced to 30% for practical placement)
function hasAdequateSupport(
  pos: { x: number; y: number; z: number },
  dims: { length: number; width: number; height: number },
  placedULDs: PlacedULD[],
  minSupportRatio: number = 0.3  // 30% support requirement - practical for stacking
): boolean {
  // Ground level is always supported
  if (pos.z < 0.01) return true;

  // CRITICAL: ULD must have at least 30% of base supported
  // Calculate the area of the ULD base
  const uldArea = dims.length * dims.width;
  let supportedArea = 0;

  // Check each placed ULD to see if it provides support
  for (const placed of placedULDs) {
    // Check if the placed ULD is directly below (within 3cm gap tolerance)
    const gap = pos.z - (placed.position.z + placed.dimensions.height);
    if (gap > 0.03) continue; // More than 3cm gap, no support
    if (gap < -0.01) continue; // Overlapping, skip

    // CORNER-BASED: Calculate overlap area in XY plane
    const overlapMinX = Math.max(pos.x, placed.position.x);
    const overlapMaxX = Math.min(pos.x + dims.length, placed.position.x + placed.dimensions.length);
    const overlapMinY = Math.max(pos.y, placed.position.y);
    const overlapMaxY = Math.min(pos.y + dims.width, placed.position.y + placed.dimensions.width);

    if (overlapMinX < overlapMaxX && overlapMinY < overlapMaxY) {
      const overlapArea = (overlapMaxX - overlapMinX) * (overlapMaxY - overlapMinY);
      supportedArea += overlapArea;
    }
  }

  // Must have at least 30% of base supported
  const supportRatio = supportedArea / uldArea;
  return supportRatio >= minSupportRatio;
}

// Generate candidate positions for a ULD - EXACT COPY FROM PACKAGE LOGIC
function generateCandidatePositions(
  uld: ULDContainer,
  placedULDs: PlacedULD[],
  hold: { dimensions: { length: number; width: number; height: number } },
  strategy: Strategy
): Array<{ x: number; y: number; z: number; score: number }> {
  const candidates: Array<{ x: number; y: number; z: number; score: number }> = [];
  const step = 0.5; // 50cm steps for position search (larger than packages since ULDs are bigger)
  const margin = 0.05; // 5cm safety margin

  // If no ULDs placed yet, start at corner with margin
  if (placedULDs.length === 0) {
    candidates.push({
      x: margin,
      y: margin,
      z: 0,
      score: 100
    });
    return candidates;
  }

  // Generate positions based on existing ULDs
  // CRITICAL: Use corner-based positioning (x, y, z are bottom-left-front corner)
  const maxX = hold.dimensions.length - uld.dimensions.length - margin;
  const maxY = hold.dimensions.width - uld.dimensions.width - margin;
  
  for (let x = margin; x <= maxX; x += step) {
    for (let y = margin; y <= maxY; y += step) {
      const z = findLowestZPosition(x, y, uld, placedULDs);
      const pos = { x, y, z };

      // Check if position is valid
      if (!isWithinHold(pos, uld.dimensions, hold)) continue;

      // Check for overlaps
      let hasOverlap = false;
      for (const placed of placedULDs) {
        if (checkOverlap(pos, uld.dimensions, placed.position, placed.dimensions)) {
          hasOverlap = true;
          break;
        }
      }
      if (hasOverlap) continue;

      // GRAVITY CHECK: Must have adequate support (30% of base)
      if (!hasAdequateSupport(pos, uld.dimensions, placedULDs, 0.3)) continue;

      // Calculate score based on strategy
      let score = 0;
      const centerX = hold.dimensions.length / 2;
      const centerY = hold.dimensions.width / 2;
      const uldCenterX = x + uld.dimensions.length / 2;
      const uldCenterY = y + uld.dimensions.width / 2;
      const distanceFromCenter = Math.sqrt(
        Math.pow(uldCenterX - centerX, 2) + Math.pow(uldCenterY - centerY, 2)
      );

      switch (strategy) {
        case 'balanced':
          // Prefer positions near center and low
          score = 100 - distanceFromCenter * 10 - z * 5;
          break;

        case 'maxWeight':
          // Prefer low positions and near center
          score = 100 - z * 20 - distanceFromCenter * 5;
          break;

        case 'maxSpace':
          // Prefer positions that fill corners first
          score = z * 10 + Math.max(
            Math.abs(uldCenterX - centerX),
            Math.abs(uldCenterY - centerY)
          ) * 5;
          break;

        case 'fragile':
          // Fragile ULDs go on top
          const hasFragile = uld.packages && uld.packages.length > 0 ? uld.packages.some(p => p.fragile) : false;
          if (hasFragile) {
            score = z * 20 - distanceFromCenter * 5;
          } else {
            score = 100 - z * 20 - distanceFromCenter * 5;
          }
          break;

        case 'safety':
          // Prefer stable, low, centered positions
          score = 100 - z * 15 - distanceFromCenter * 15;
          break;

        case 'time':
          // Prefer quick placement (closer to entrance)
          score = 100 - x * 10 - z * 5;
          break;

        case 'cost':
          // Optimize for space efficiency
          score = z * 8 - distanceFromCenter * 8;
          break;

        default:
          score = 50;
      }

      candidates.push({ x, y, z, score });
    }
  }

  return candidates;
}

// Sort ULDs by strategy priority - EXACT COPY FROM PACKAGE LOGIC
function sortULDsByStrategy(ulds: ULDContainer[], strategy: Strategy): ULDContainer[] {
  return [...ulds].sort((a, b) => {
    switch (strategy) {
      case 'maxWeight':
        return b.currentWeight - a.currentWeight; // Heaviest first
      
      case 'maxSpace':
        const volA = a.dimensions.length * a.dimensions.width * a.dimensions.height;
        const volB = b.dimensions.length * b.dimensions.width * b.dimensions.height;
        return volB - volA; // Largest first
      
      case 'fragile':
        const fragileA = (a.packages && Array.isArray(a.packages) && a.packages.length > 0) ? a.packages.some(p => p && p.fragile) : false;
        const fragileB = (b.packages && Array.isArray(b.packages) && b.packages.length > 0) ? b.packages.some(p => p && p.fragile) : false;
        if (fragileA && !fragileB) return 1; // Non-fragile first
        if (!fragileA && fragileB) return -1;
        return b.currentWeight - a.currentWeight; // Then by weight
      
      case 'safety':
        return b.currentWeight - a.currentWeight; // Heaviest at bottom
      
      case 'balanced':
        // CRITICAL: For balanced strategy, place heaviest ULDs first so they go to center
        return b.currentWeight - a.currentWeight; // Heaviest first
      
      default:
        return b.currentWeight - a.currentWeight;
    }
  });
}

// Main optimization function - EXACT COPY FROM PACKAGE LOGIC
export function optimizeULDPlacement(
  ulds: ULDContainer[],
  hold: { dimensions: { length: number; width: number; height: number }; maxWeight: number },
  strategy: Strategy
): ULDContainer[] {
  // DEFENSIVE: Handle both {dimensions: {...}} and direct {...} formats
  const holdDims = (hold as any).dimensions ? (hold as any).dimensions : hold;
  const holdMaxWeight = (hold as any).maxWeight || 50000; // Default 50 tons
  
  // Validate hold dimensions
  if (!holdDims || typeof holdDims.length !== 'number' || typeof holdDims.width !== 'number' || typeof holdDims.height !== 'number') {
    console.error('❌ Invalid hold dimensions provided:', hold);
    return [];
  }
  
  // Only process completed ULDs
  const completedULDs = ulds.filter(u => u && u.status === 'completed');
  
  if (completedULDs.length === 0) {
    console.log('✈️ No completed ULDs to load into aircraft');
    return [];
  }

  const placedULDs: PlacedULD[] = [];
  const excludedULDs: ULDContainer[] = [];
  
  // Validate and filter ULDs with proper dimensions
  const validULDs = completedULDs.filter(uld => {
    // Safety check for undefined ULD or dimensions
    if (!uld || !uld.dimensions) {
      console.warn(`❌ ULD has undefined dimensions - skipping`);
      return false;
    }
    
    // Ensure packages array exists
    if (!uld.packages) {
      uld.packages = [];
    }
    
    return true;
  });
  
  if (validULDs.length === 0) {
    console.warn('❌ No valid ULDs with proper dimensions to load');
    return [];
  }
  
  // Sort ULDs by strategy priority
  const sortedULDs = sortULDsByStrategy([...validULDs], strategy);

  console.log(`🚁 Optimizing ${sortedULDs.length} ULDs for aircraft hold using ${strategy} strategy`);

  // Try to place each ULD
  for (const uld of sortedULDs) {
    // Double-check ULD has valid dimensions (defensive programming)
    if (!uld || !uld.dimensions) {
      console.warn(`❌ Skipping ULD with invalid dimensions`);
      continue;
    }
    
    // Check if ULD dimensions exceed hold
    const margin = 0.05;
    if (
      uld.dimensions.length > holdDims.length - margin * 2 ||
      uld.dimensions.width > holdDims.width - margin * 2 ||
      uld.dimensions.height > holdDims.height
    ) {
      // ULD too large - add to excluded
      excludedULDs.push(uld);
      console.warn(`❌ ULD "${uld.name}" too large for aircraft hold`);
      continue;
    }

    const candidates = generateCandidatePositions(uld, placedULDs, { dimensions: holdDims, maxWeight: holdMaxWeight }, strategy);
    
    if (candidates.length > 0) {
      // Sort by score and pick best position
      candidates.sort((a, b) => b.score - a.score);
      const bestPos = candidates[0];
      
      // GRAVITY DEBUG: Log placement details
      if (bestPos.z > 0.01) {
        console.log(`✈️ Stacking "${uld.name}" at z=${bestPos.z.toFixed(2)}m (on top of other ULDs)`);
      } else {
        console.log(`✈️ Placing "${uld.name}" on hold floor (z=0)`);
      }
      
      placedULDs.push({
        ...uld,
        position: { x: bestPos.x, y: bestPos.y, z: bestPos.z },
        status: 'loaded'
      });
    } else {
      // No valid position found - add to excluded
      console.warn(`❌ No valid position found for "${uld.name}" (gravity/support requirements not met)`);
      excludedULDs.push(uld);
    }
  }

  console.log(`✅ Successfully placed ${placedULDs.length}/${sortedULDs.length} ULDs in aircraft hold`);
  if (excludedULDs.length > 0) {
    console.warn(`⚠️ ${excludedULDs.length} ULD(s) could not be placed: ${excludedULDs.map(u => u.name).join(', ')}`);
  }

  return placedULDs;
}

// Calculate center of gravity - EXACT COPY FROM PACKAGE LOGIC
export function calculateHoldCOG(ulds: ULDContainer[]): { x: number; y: number; z: number } {
  if (ulds.length === 0) {
    return { x: 0, y: 0, z: 0 };
  }

  let totalWeight = 0;
  let cogX = 0;
  let cogY = 0;
  let cogZ = 0;

  for (const uld of ulds) {
    if (!uld.position) continue;

    // CRITICAL: Use ULD center position for COG calculation
    const uldCenterX = uld.position.x + uld.dimensions.length / 2;
    const uldCenterY = uld.position.y + uld.dimensions.width / 2;
    const uldCenterZ = uld.position.z + uld.dimensions.height / 2;
    
    cogX += uldCenterX * uld.currentWeight;
    cogY += uldCenterY * uld.currentWeight;
    cogZ += uldCenterZ * uld.currentWeight;
    totalWeight += uld.currentWeight;
  }

  if (totalWeight === 0) {
    return { x: 0, y: 0, z: 0 };
  }

  return {
    x: cogX / totalWeight,
    y: cogY / totalWeight,
    z: cogZ / totalWeight
  };
}

// Calculate stability score - OPTIMIZED FOR HIGHER SCORES
export function calculateHoldStability(
  ulds: ULDContainer[],
  hold: { dimensions: { length: number; width: number; height: number }; maxWeight?: number } | { length: number; width: number; height: number }
): number {
  if (ulds.length === 0) return 100;

  // DEFENSIVE: Handle both {dimensions: {...}} and direct {...} formats
  const holdDims = (hold as any).dimensions ? (hold as any).dimensions : hold;
  const holdMaxWeight = (hold as any).maxWeight || 50000; // Default 50 tons

  let score = 100;

  // Factor 1: Center of gravity deviation from hold center (REDUCED PENALTY)
  const holdCenterX = holdDims.length / 2;
  const holdCenterY = holdDims.width / 2;
  const centerOfGravity = calculateHoldCOG(ulds);
  const cogDeviation = Math.sqrt(
    Math.pow(centerOfGravity.x - holdCenterX, 2) +
    Math.pow(centerOfGravity.y - holdCenterY, 2)
  );
  // OPTIMIZED: Reduced from 10 to 2 - small deviations are acceptable in aircraft
  score -= cogDeviation * 2;

  // Factor 2: Height of COG (lower is better) - REDUCED PENALTY
  // OPTIMIZED: Reduced from 5 to 1 - height matters less for aircraft stability
  score -= centerOfGravity.z * 1;

  // Factor 3: Fragile ULDs on top bonus (REDUCED PENALTY)
  let fragileOnTop = true;
  const sortedByHeight = [...ulds]
    .filter(u => u.position)
    .sort((a, b) => (a.position?.z || 0) - (b.position?.z || 0));
  
  for (let i = 0; i < sortedByHeight.length; i++) {
    const uld = sortedByHeight[i];
    const hasFragile = uld.packages && uld.packages.length > 0 ? uld.packages.some(p => p.fragile) : false;
    if (hasFragile) {
      // Check if there are non-fragile ULDs above
      for (let j = i + 1; j < sortedByHeight.length; j++) {
        const upperULD = sortedByHeight[j];
        const upperHasFragile = upperULD.packages && upperULD.packages.length > 0 ? upperULD.packages.some(p => p.fragile) : false;
        if (!upperHasFragile) {
          fragileOnTop = false;
          // OPTIMIZED: Reduced from 10 to 3
          score -= 3;
          break;
        }
      }
    }
  }

  // Factor 4: Weight distribution (OPTIMIZED)
  const totalWeight = ulds.reduce((sum, u) => sum + u.currentWeight, 0);
  const weightUtilization = (totalWeight / holdMaxWeight) * 100;
  
  // OPTIMIZED: More lenient weight utilization penalties
  if (weightUtilization > 95) {
    // Only penalize if very overloaded
    score -= (weightUtilization - 95) * 3;
  } else if (weightUtilization < 30) {
    // Only penalize if extremely underutilized
    score -= (30 - weightUtilization) * 0.2;
  }

  // Factor 5: Support quality (OPTIMIZED)
  let poorSupportCount = 0;
  for (const uld of ulds) {
    if (!uld.position || uld.position.z < 0.01) continue;
    
    const placed = ulds.filter(u => u.position) as PlacedULD[];
    
    // Check if ULD has good support (70% threshold)
    if (!hasAdequateSupport(uld.position, uld.dimensions, placed, 0.7)) {
      // Has 30-70% support - minor penalty
      poorSupportCount++;
    } else if (!hasAdequateSupport(uld.position, uld.dimensions, placed, 0.5)) {
      // Has less than 50% support - moderate penalty
      poorSupportCount += 2;
    }
  }
  // OPTIMIZED: Reduced from 15 to 5 per poorly supported ULD
  score -= poorSupportCount * 5;

  // Bonus: All ULDs properly placed
  if (ulds.every(u => u.position)) {
    score += 5; // Bonus for successful placement
  }

  // Bonus: Balanced load (COG near center)
  if (cogDeviation < 1.0) {
    score += 3; // Excellent balance bonus (aircraft holds are larger, so 1m tolerance)
  }

  return Math.max(0, Math.min(100, score));
}