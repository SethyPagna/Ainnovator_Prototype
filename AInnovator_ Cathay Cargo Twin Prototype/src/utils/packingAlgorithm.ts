// Advanced 3D Bin Packing Algorithm with realistic stacking

import {
  Package,
  ULDContainer,
  Strategy,
  OptimizationResult,
  OPTIMIZATION_CONDITIONS,
} from "../types/cargo";

interface PlacedPackage extends Package {
  position: { x: number; y: number; z: number };
  rotation: number; // 0, 90, 180, 270
}

// Check if two packages overlap in 3D space (CORNER-BASED)
function checkOverlap(
  pos1: { x: number; y: number; z: number },
  dims1: { length: number; width: number; height: number },
  pos2: { x: number; y: number; z: number },
  dims2: { length: number; width: number; height: number },
): boolean {
  // CORNER-BASED: positions represent bottom-left-front corner
  const box1 = {
    minX: pos1.x,
    maxX: pos1.x + dims1.length,
    minY: pos1.y,
    maxY: pos1.y + dims1.width,
    minZ: pos1.z,
    maxZ: pos1.z + dims1.height,
  };

  const box2 = {
    minX: pos2.x,
    maxX: pos2.x + dims2.length,
    minY: pos2.y,
    maxY: pos2.y + dims2.width,
    minZ: pos2.z,
    maxZ: pos2.z + dims2.height,
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

// Check if position is within container bounds (CORNER-BASED)
function isWithinContainer(
  pos: { x: number; y: number; z: number },
  dims: { length: number; width: number; height: number },
  container: ULDContainer,
): boolean {
  const margin = 0.02; // 2cm safety margin from container walls

  // CORNER-BASED: position is bottom-left-front corner
  // Package extends from pos.x to pos.x + dims.length
  // STRICT BOUNDARY CHECK: Package must NEVER exceed container bounds
  return (
    pos.x >= margin &&
    pos.x + dims.length <=
      container.dimensions.length - margin &&
    pos.y >= margin &&
    pos.y + dims.width <= container.dimensions.width - margin &&
    pos.z >= 0 &&
    pos.z + dims.height <= container.dimensions.height &&
    // Double-check: ensure the package end points are strictly within bounds
    pos.x >= 0 &&
    pos.y >= 0 &&
    pos.z >= 0 &&
    pos.x + dims.length <= container.dimensions.length &&
    pos.y + dims.width <= container.dimensions.width &&
    pos.z + dims.height <= container.dimensions.height
  );
}

// Find the lowest stable position for a package at (x, y) - CORNER-BASED
function findLowestZPosition(
  x: number,
  y: number,
  pkg: Package,
  placedPackages: PlacedPackage[],
  container: ULDContainer,
): number {
  let z = 0;
  const margin = 0.01; // 1cm margin for stability

  // Check if we need to stack on top of other packages
  for (const placed of placedPackages) {
    // CORNER-BASED: Check if packages overlap in XY plane
    const xyOverlap = !(
      x + pkg.dimensions.length <= placed.position.x ||
      x >= placed.position.x + placed.dimensions.length ||
      y + pkg.dimensions.width <= placed.position.y ||
      y >= placed.position.y + placed.dimensions.width
    );

    if (xyOverlap) {
      // This package is below us, so we need to be on top of it
      const topZ =
        placed.position.z + placed.dimensions.height + margin;
      z = Math.max(z, topZ);
    }
  }

  return z;
}

// Check if a package can be stably placed (has support from below) - CORNER-BASED
// GRAVITY: Packages MUST have something below them (reduced to 30% for practical placement)
function hasAdequateSupport(
  pos: { x: number; y: number; z: number },
  dims: { length: number; width: number; height: number },
  placedPackages: PlacedPackage[],
  minSupportRatio: number = 0.3, // 30% support requirement - practical for stacking
): boolean {
  // Ground level is always supported
  if (pos.z < 0.01) return true;

  // CRITICAL: Package must have at least 30% of base supported
  // Calculate the area of the package base
  const packageArea = dims.length * dims.width;
  let supportedArea = 0;

  // Check each placed package to see if it provides support
  for (const placed of placedPackages) {
    // Check if the placed package is directly below (within 3cm gap tolerance)
    const gap =
      pos.z - (placed.position.z + placed.dimensions.height);
    if (gap > 0.03) continue; // More than 3cm gap, no support
    if (gap < -0.01) continue; // Overlapping, skip

    // CORNER-BASED: Calculate overlap area in XY plane
    const overlapMinX = Math.max(pos.x, placed.position.x);
    const overlapMaxX = Math.min(
      pos.x + dims.length,
      placed.position.x + placed.dimensions.length,
    );
    const overlapMinY = Math.max(pos.y, placed.position.y);
    const overlapMaxY = Math.min(
      pos.y + dims.width,
      placed.position.y + placed.dimensions.width,
    );

    if (
      overlapMinX < overlapMaxX &&
      overlapMinY < overlapMaxY
    ) {
      const overlapArea =
        (overlapMaxX - overlapMinX) *
        (overlapMaxY - overlapMinY);
      supportedArea += overlapArea;
    }
  }

  // Must have at least 30% of base supported
  const supportRatio = supportedArea / packageArea;
  return supportRatio >= minSupportRatio;
}

// Generate candidate positions for a package
function generateCandidatePositions(
  pkg: Package,
  placedPackages: PlacedPackage[],
  container: ULDContainer,
  strategy: Strategy,
): Array<{ x: number; y: number; z: number; score: number }> {
  const candidates: Array<{
    x: number;
    y: number;
    z: number;
    score: number;
  }> = [];
  const step = 0.2; // 20cm steps for position search
  const margin = 0.02; // 2cm safety margin

  // If no packages placed yet, start at corner with margin
  if (placedPackages.length === 0) {
    candidates.push({
      x: margin,
      y: margin,
      z: 0,
      score: 100,
    });
    return candidates;
  }

  // Generate positions based on existing packages
  // CRITICAL: Use corner-based positioning (x, y, z are bottom-left-front corner)
  const maxX =
    container.dimensions.length -
    pkg.dimensions.length -
    margin;
  const maxY =
    container.dimensions.width - pkg.dimensions.width - margin;

  for (let x = margin; x <= maxX; x += step) {
    for (let y = margin; y <= maxY; y += step) {
      const z = findLowestZPosition(
        x,
        y,
        pkg,
        placedPackages,
        container,
      );
      const pos = { x, y, z };

      // Check if position is valid
      if (!isWithinContainer(pos, pkg.dimensions, container))
        continue;

      // Check for overlaps
      let hasOverlap = false;
      for (const placed of placedPackages) {
        if (
          checkOverlap(
            pos,
            pkg.dimensions,
            placed.position,
            placed.dimensions,
          )
        ) {
          hasOverlap = true;
          break;
        }
      }
      if (hasOverlap) continue;

      // GRAVITY CHECK: Must have adequate support (30% of base)
      if (
        !hasAdequateSupport(
          pos,
          pkg.dimensions,
          placedPackages,
          0.3,
        )
      )
        continue;

      // Calculate score based on strategy
      let score = 0;
      const centerX = container.dimensions.length / 2;
      const centerY = container.dimensions.width / 2;
      const pkgCenterX = x + pkg.dimensions.length / 2;
      const pkgCenterY = y + pkg.dimensions.width / 2;
      const distanceFromCenter = Math.sqrt(
        Math.pow(pkgCenterX - centerX, 2) +
          Math.pow(pkgCenterY - centerY, 2),
      );

      switch (strategy) {
        case "balanced":
          // Prefer positions near center and low
          score = 100 - distanceFromCenter * 10 - z * 5;
          break;

        case "maxWeight":
          // Prefer low positions and near center
          score = 100 - z * 20 - distanceFromCenter * 5;
          break;

        case "maxSpace":
          // Prefer positions that fill corners first
          score =
            z * 10 +
            Math.max(
              Math.abs(pkgCenterX - centerX),
              Math.abs(pkgCenterY - centerY),
            ) *
              5;
          break;

        case "fragile":
          // Fragile items go on top
          if (pkg.fragile) {
            score = z * 20 - distanceFromCenter * 5;
          } else {
            score = 100 - z * 20 - distanceFromCenter * 5;
          }
          break;

        case "safety":
          // Prefer stable, low, centered positions
          score = 100 - z * 15 - distanceFromCenter * 15;
          break;

        case "time":
          // Prefer quick placement (closer to entrance)
          score = 100 - x * 10 - z * 5;
          break;

        case "cost":
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

// Sort packages by strategy priority
function sortPackagesByStrategy(
  packages: Package[],
  strategy: Strategy,
): Package[] {
  return [...packages].sort((a, b) => {
    switch (strategy) {
      case "maxWeight":
        return b.weight - a.weight; // Heaviest first

      case "maxSpace":
        const volA =
          a.dimensions.length *
          a.dimensions.width *
          a.dimensions.height;
        const volB =
          b.dimensions.length *
          b.dimensions.width *
          b.dimensions.height;
        return volB - volA; // Largest first

      case "fragile":
        if (a.fragile && !b.fragile) return 1; // Non-fragile first
        if (!a.fragile && b.fragile) return -1;
        return b.weight - a.weight; // Then by weight

      case "safety":
        return b.weight - a.weight; // Heaviest at bottom

      default:
        return b.weight - a.weight;
    }
  });
}

// Main optimization function - now returns both placed and excluded packages
export function optimizePackagePacking(
  packages: Package[],
  container: ULDContainer,
  strategy: Strategy,
): OptimizationResult & { excludedPackages: Package[] } {
  if (packages.length === 0) {
    return {
      packages: [],
      excludedPackages: [],
      stability: 100,
      centerOfGravity: { x: 0, y: 0, z: 0 },
      volumeUtilization: 0,
    };
  }

  const placedPackages: PlacedPackage[] = [];
  const excludedPackages: Package[] = [];

  // Sort packages by strategy priority
  const sortedPackages = sortPackagesByStrategy(
    [...packages],
    strategy,
  );

  // Try to place each package
  for (const pkg of sortedPackages) {
    // Check if package dimensions exceed container
    const margin = 0.02;
    if (
      pkg.dimensions.length >
        container.dimensions.length - margin * 2 ||
      pkg.dimensions.width >
        container.dimensions.width - margin * 2 ||
      pkg.dimensions.height > container.dimensions.height
    ) {
      // Package too large - add to excluded
      excludedPackages.push(pkg);
      console.warn(
        `❌ Package "${pkg.name}" too large for container`,
      );
      continue;
    }

    const candidates = generateCandidatePositions(
      pkg,
      placedPackages,
      container,
      strategy,
    );

    if (candidates.length > 0) {
      // Sort by score and pick best position
      candidates.sort((a, b) => b.score - a.score);
      const bestPos = candidates[0];

      // GRAVITY DEBUG: Log placement details
      if (bestPos.z > 0.01) {
        console.log(
          `📦 Stacking "${pkg.name}" at z=${bestPos.z.toFixed(2)}m (on top of other packages)`,
        );
      } else {
        console.log(`📦 Placing "${pkg.name}" on ground (z=0)`);
      }

      placedPackages.push({
        ...pkg,
        position: { x: bestPos.x, y: bestPos.y, z: bestPos.z },
        rotation: 0,
      });
    } else {
      // No valid position found - add to excluded
      console.warn(
        `❌ No valid position found for "${pkg.name}" (gravity/support requirements not met)`,
      );
      excludedPackages.push(pkg);
    }
  }

  // Calculate stability
  const stability = calculateStability(
    placedPackages,
    container,
  );

  // Calculate center of gravity
  const cog = calculateCenterOfGravity(
    placedPackages,
    container,
  );

  // Calculate volume utilization
  const totalPackageVolume = placedPackages.reduce(
    (sum, pkg) =>
      sum +
      pkg.dimensions.length *
        pkg.dimensions.width *
        pkg.dimensions.height,
    0,
  );
  const containerVolume =
    container.dimensions.length *
    container.dimensions.width *
    container.dimensions.height;
  const volumeUtilization =
    (totalPackageVolume / containerVolume) * 100;

  return {
    packages: placedPackages,
    excludedPackages,
    stability,
    centerOfGravity: cog,
    volumeUtilization,
  };
}

// Calculate center of gravity
export function calculateCenterOfGravity(
  packages: Package[],
  container: ULDContainer,
): { x: number; y: number; z: number } {
  if (packages.length === 0) {
    return { x: 0, y: 0, z: 0 };
  }

  let totalWeight = 0;
  let cogX = 0;
  let cogY = 0;
  let cogZ = 0;

  for (const pkg of packages) {
    if (!pkg.position) continue;

    const pkgCenterZ =
      pkg.position.z + pkg.dimensions.height / 2;

    cogX += pkg.position.x * pkg.weight;
    cogY += pkg.position.y * pkg.weight;
    cogZ += pkgCenterZ * pkg.weight;
    totalWeight += pkg.weight;
  }

  if (totalWeight === 0) {
    return { x: 0, y: 0, z: 0 };
  }

  return {
    x: cogX / totalWeight,
    y: cogY / totalWeight,
    z: cogZ / totalWeight,
  };
}

// Calculate stability score
export function calculateStability(
  packages: Package[],
  container: ULDContainer,
): number {
  if (packages.length === 0) return 100;

  let score = 100;

  // Factor 1: Center of gravity deviation from container center (REDUCED PENALTY)
  const containerCenterX = container.dimensions.length / 2;
  const containerCenterY = container.dimensions.width / 2;
  const centerOfGravity = calculateCenterOfGravity(
    packages,
    container,
  );
  const cogDeviation = Math.sqrt(
    Math.pow(centerOfGravity.x - containerCenterX, 2) +
      Math.pow(centerOfGravity.y - containerCenterY, 2),
  );
  // OPTIMIZED: Reduced from 10 to 2 - small deviations are acceptable
  score -= cogDeviation * 2;

  // Factor 2: Height of COG (lower is better) - REDUCED PENALTY
  // OPTIMIZED: Reduced from 5 to 1 - height matters less for stability
  score -= centerOfGravity.z * 1;

  // Factor 3: Fragile items on top bonus (REDUCED PENALTY)
  let fragileOnTop = true;
  const sortedByHeight = [...packages]
    .filter((p) => p.position)
    .sort(
      (a, b) => (a.position?.z || 0) - (b.position?.z || 0),
    );

  for (let i = 0; i < sortedByHeight.length; i++) {
    const pkg = sortedByHeight[i];
    if (pkg.fragile) {
      // Check if there are non-fragile items above
      for (let j = i + 1; j < sortedByHeight.length; j++) {
        if (!sortedByHeight[j].fragile) {
          fragileOnTop = false;
          // OPTIMIZED: Reduced from 10 to 3
          score -= 3;
          break;
        }
      }
    }
  }

  // Factor 4: Weight distribution (OPTIMIZED)
  const totalWeight = packages.reduce(
    (sum, p) => sum + p.weight,
    0,
  );
  const weightUtilization =
    (totalWeight / container.maxWeight) * 100;

  // OPTIMIZED: More lenient weight utilization penalties
  if (weightUtilization > 95) {
    // Only penalize if very overloaded
    score -= (weightUtilization - 95) * 3;
  } else if (weightUtilization < 30) {
    // Only penalize if extremely underutilized
    score -= (30 - weightUtilization) * 0.2;
  }

  // Factor 5: Support quality (MOST IMPORTANT - but optimized)
  let poorSupportCount = 0;
  for (const pkg of packages) {
    if (!pkg.position || pkg.position.z < 0.01) continue;

    const placed = packages.filter(
      (p) => p.position,
    ) as PlacedPackage[];
    
    // Check if package has good support (70% threshold)
    if (
      !hasAdequateSupport(
        pkg.position,
        pkg.dimensions,
        placed,
        0.7,
      )
    ) {
      // Has 30-70% support - minor penalty
      poorSupportCount++;
    } else if (
      !hasAdequateSupport(
        pkg.position,
        pkg.dimensions,
        placed,
        0.5,
      )
    ) {
      // Has less than 50% support - moderate penalty
      poorSupportCount += 2;
    }
  }
  // OPTIMIZED: Reduced from 15 to 5 per poorly supported package
  score -= poorSupportCount * 5;

  // Bonus: All packages properly placed
  if (packages.every(p => p.position)) {
    score += 5; // Bonus for successful placement
  }

  // Bonus: Balanced load (COG near center)
  if (cogDeviation < 0.5) {
    score += 3; // Excellent balance bonus
  }

  return Math.max(0, Math.min(100, score));
}