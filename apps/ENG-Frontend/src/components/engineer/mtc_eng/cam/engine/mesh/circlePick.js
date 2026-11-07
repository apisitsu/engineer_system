/**
 * Finding the circle an operator clicked on, so its centre can become the origin.
 *
 * An STL has no circles in it, only facets, so the circle is recovered from a
 * section through the click: a bore or a boss cut square to its axis comes back as
 * a closed loop whose points all sit one radius from a centre.
 *
 * Pure functions over typed arrays. No three.js, no store, no DOM.
 */

import { sliceLoops } from './slice.js';

/** Fewer points than this is a polygon that happens to have a circumcircle, like a square. */
const MIN_POINTS = 8;
/** Largest departure from the fitted radius. A coarse STL's chords stay inside this. */
const ROUNDNESS = 0.03;
/** Widest empty arc allowed round the centre: 50°, a little over an octagon's 45°. */
const MAX_GAP = (50 * Math.PI) / 180;
/** How far under a flat face to cut, so the section goes through material. */
const UNDER_FACE = 0.01;

/**
 * Least-squares circle through a closed loop (Kåsa's fit), or `null` if the loop
 * is not round.
 *
 * @param {number[]} flat flat `[u0, v0, u1, v1, ...]`
 * @returns {{center:[number,number], radius:number}|null}
 */
export function fitCircle(flat) {
  // A section through a mesh vertex yields the same point twice, so a plain
  // rectangle can arrive with eight points that are really its four corners.
  const seen = new Set();
  const pts = [];
  for (let i = 0; i < flat.length; i += 2) {
    const key = `${flat[i].toFixed(3)},${flat[i + 1].toFixed(3)}`;
    if (!seen.has(key)) {
      seen.add(key);
      pts.push(flat[i], flat[i + 1]);
    }
  }
  const n = pts.length / 2;
  if (n < MIN_POINTS) return null;
  let mu = 0;
  let mv = 0;
  for (let i = 0; i < n; i += 1) { mu += pts[i * 2]; mv += pts[i * 2 + 1]; }
  mu /= n;
  mv /= n;

  let suu = 0; let suv = 0; let svv = 0; let suuu = 0; let svvv = 0; let suvv = 0; let svuu = 0;
  for (let i = 0; i < n; i += 1) {
    const u = pts[i * 2] - mu;
    const v = pts[i * 2 + 1] - mv;
    suu += u * u;
    suv += u * v;
    svv += v * v;
    suuu += u * u * u;
    svvv += v * v * v;
    suvv += u * v * v;
    svuu += v * u * u;
  }
  const det = suu * svv - suv * suv;
  if (Math.abs(det) < 1e-12) return null;
  const a = (suuu + suvv) / 2;
  const b = (svvv + svuu) / 2;
  const uc = (a * svv - b * suv) / det;
  const vc = (b * suu - a * suv) / det;
  const radius = Math.sqrt(uc * uc + vc * vc + (suu + svv) / n);

  for (let i = 0; i < n; i += 1) {
    const d = Math.hypot(pts[i * 2] - mu - uc, pts[i * 2 + 1] - mv - vc);
    if (Math.abs(d - radius) > ROUNDNESS * radius) return null;
  }

  // Points bunched at four corners also sit one radius from a centre, so they have
  // to be spread round it as well.
  const angles = [];
  for (let i = 0; i < n; i += 1) {
    angles.push(Math.atan2(pts[i * 2 + 1] - mv - vc, pts[i * 2] - mu - uc));
  }
  angles.sort((a1, a2) => a1 - a2);
  for (let i = 0; i < n; i += 1) {
    const next = i + 1 < n ? angles[i + 1] : angles[0] + 2 * Math.PI;
    if (next - angles[i] > MAX_GAP) return null;
  }
  return { center: [uc + mu, vc + mv], radius };
}

/**
 * The circle nearest a click on a mesh.
 *
 * The clicked facet says which sections are worth cutting: a flat face is cut just
 * under itself, so clicking an end face finds the bores and bosses that meet it,
 * and a wall is cut through the click along each axis that lies in its plane. Only
 * axis-aligned circles are found, the same assumption the rest of the origin
 * tools make.
 *
 * @param {object} mesh a welded mesh, in the same frame as `point` and `normal`
 * @param {number[]} point the clicked location
 * @param {number[]} normal the clicked facet's outward normal
 * @returns {{axis:0|1|2, center:number[], radius:number}|null} `axis` is the
 *   circle's own axis; `center` has the clicked coordinate along it
 */
export function circleAtPick(mesh, point, normal) {
  const len = Math.hypot(...normal) || 1;
  let best = null;
  let bestMiss = Infinity;
  for (let axis = 0; axis < 3; axis += 1) {
    const along = normal[axis] / len;
    let coord = null;
    if (Math.abs(along) > 0.9998) coord = point[axis] - Math.sign(along) * UNDER_FACE;
    else if (Math.abs(along) < 0.05) coord = point[axis];
    if (coord !== null) {
      const [u, v] = [0, 1, 2].filter((k) => k !== axis);
      for (const loop of sliceLoops(mesh, axis, coord).loops) {
        const circle = fitCircle(Array.from(loop.points));
        if (circle) {
          const miss = Math.abs(
            Math.hypot(point[u] - circle.center[0], point[v] - circle.center[1]) - circle.radius,
          );
          if (miss < bestMiss) {
            bestMiss = miss;
            const center = [...point];
            center[u] = circle.center[0];
            center[v] = circle.center[1];
            best = { axis, center, radius: circle.radius };
          }
        }
      }
    }
  }
  return best;
}
