// Geometry helpers for contoured ULDs.
//
// Frame used everywhere inside a ULD (cm):
//   x = lateral / "profile" axis (the axis in which the contour is drawn)
//   y = vertical (up)
//   z = depth (the extrusion axis of the contour)
// A ULD's usable space is a convex polygon in (x, y) extruded along z.

export type P2 = readonly [number, number];

export interface Box {
  x: number;
  y: number;
  z: number;
  w: number; // size along x
  h: number; // size along y
  d: number; // size along z
}

export const EPS = 1e-6;

export function polygonArea(poly: readonly P2[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}

/** True when the polygon is convex and wound counter-clockwise (x right, y up). */
export function isConvexCCW(poly: readonly P2[]): boolean {
  if (poly.length < 3) return false;
  if (polygonArea(poly) <= 0) return false;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const c = poly[(i + 2) % poly.length];
    const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (cross < -EPS) return false;
  }
  return true;
}

/** Point-in-convex-polygon test (CCW polygon); points on the boundary count as inside. */
export function pointInConvex(poly: readonly P2[], x: number, y: number, tol = 1e-4): boolean {
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const cross = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (cross / len < -tol) return false;
  }
  return true;
}

export function boundsOf(poly: readonly P2[]) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of poly) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { minX, maxX, minY, maxY };
}

/** Horizontal slice of a convex polygon at height y: [xmin, xmax] or null when y is outside. */
export function sliceAt(poly: readonly P2[], y: number): [number, number] | null {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    const ymin = Math.min(y1, y2);
    const ymax = Math.max(y1, y2);
    if (y < ymin - EPS || y > ymax + EPS) continue;
    if (Math.abs(y2 - y1) < EPS) {
      lo = Math.min(lo, x1, x2);
      hi = Math.max(hi, x1, x2);
    } else {
      const t = (y - y1) / (y2 - y1);
      const x = x1 + t * (x2 - x1);
      lo = Math.min(lo, x);
      hi = Math.max(hi, x);
    }
  }
  if (lo > hi) return null;
  return [lo, hi];
}

/**
 * Contour clipping: the lateral range available to an axis-aligned box that spans [y0, y1]
 * vertically. Because the profile is convex, the left boundary is a convex function of y and
 * the right boundary a concave one, so the binding values are always at the two ends.
 */
export function allowedXRange(poly: readonly P2[], y0: number, y1: number): [number, number] | null {
  const a = sliceAt(poly, y0);
  const b = sliceAt(poly, y1);
  if (!a || !b) return null;
  const lo = Math.max(a[0], b[0]);
  const hi = Math.min(a[1], b[1]);
  if (hi - lo < -EPS) return null;
  return [lo, hi];
}

/** Does the cross-section [x0,x1]x[y0,y1] fit inside the convex profile? */
export function rectFitsProfile(poly: readonly P2[], x0: number, x1: number, y0: number, y1: number, tol = 0.01): boolean {
  const r = allowedXRange(poly, y0, y1);
  if (!r) return false;
  return x0 >= r[0] - tol && x1 <= r[1] + tol;
}

/** Offset a convex CCW polygon inwards by t (wall thickness). */
export function insetConvex(poly: readonly P2[], t: number): P2[] {
  const n = poly.length;
  // each edge -> line shifted inward (left normal for CCW)
  const lines = poly.map((a, i) => {
    const b = poly[(i + 1) % n];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    const nx = -dy / len;
    const ny = dx / len;
    return { px: a[0] + nx * t, py: a[1] + ny * t, dx, dy };
  });
  const out: P2[] = [];
  for (let i = 0; i < n; i++) {
    const l1 = lines[(i - 1 + n) % n];
    const l2 = lines[i];
    const den = l1.dx * l2.dy - l1.dy * l2.dx;
    if (Math.abs(den) < EPS) {
      out.push([l2.px, l2.py]);
      continue;
    }
    const s = ((l2.px - l1.px) * l2.dy - (l2.py - l1.py) * l2.dx) / den;
    out.push([round2(l1.px + s * l1.dx), round2(l1.py + s * l1.dy)]);
  }
  return out;
}

export function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export function overlap1D(a0: number, a1: number, b0: number, b1: number): number {
  return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
}

/** Strict 3D overlap (touching faces do not count). */
export function boxesOverlap(a: Box, b: Box, eps = 0.01): boolean {
  return (
    a.x < b.x + b.w - eps && b.x < a.x + a.w - eps &&
    a.y < b.y + b.h - eps && b.y < a.y + a.h - eps &&
    a.z < b.z + b.d - eps && b.z < a.z + a.d - eps
  );
}

/** Footprint (x-z) overlap area of two boxes. */
export function footprintOverlap(a: Box, b: Box): number {
  return overlap1D(a.x, a.x + a.w, b.x, b.x + b.w) * overlap1D(a.z, a.z + a.d, b.z, b.z + b.d);
}

export function boxVolume(b: Box): number {
  return b.w * b.h * b.d;
}

/** Volume of a convex profile extruded over a depth. */
export function prismVolume(poly: readonly P2[], depth: number): number {
  return Math.abs(polygonArea(poly)) * depth;
}
