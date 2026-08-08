/**
 * Closed regions of a sketch — the step between drawing a profile and making a
 * solid out of it.
 *
 * A sketch is a bag of lines, arcs and circles; an extrude needs *closed loops*
 * with the outer boundary and its holes told apart. This module is that
 * conversion, and nothing else: it is pure, takes a sketch document (`model.js`)
 * and returns flat `[x0,y0,x1,y1,...]` loops in the same outer-CCW / hole-CW
 * convention `sliceLoops` produces, so everything already written against slice
 * output — Clipper offsetting, the CAM planner — reads these unchanged.
 *
 * ## Chaining is topological, not by tolerance
 *
 * `mesh/slice.js` chains segments by welding endpoints within a tolerance,
 * because a triangle soup has no idea which points are the same one. A sketch
 * does: it is point-based (`model.js`), so a shared corner **is** one point id,
 * and two entities are connected exactly when they name the same point. Walking
 * ids is exact — no tolerance to tune, no near-miss that silently splits a
 * profile in half. Two things widen "the same point" beyond raw id equality:
 *
 * - a `coincident` constraint, which is how the solver joins two points the user
 *   drew separately, and
 * - points sitting on top of each other within `weldTol`, which is what a solve
 *   leaves behind when some other constraint drove them together.
 *
 * Both are folded in with a union-find before any walking happens.
 *
 * ## Branching is reported, not guessed
 *
 * A vertex with three or more edges on it (a line drawn across a rectangle) has
 * no single answer for "which way does the profile go" — SolidWorks asks. Rather
 * than pick one and quietly build the wrong solid, the walk stops and names the
 * vertex in `branches`. Splitting those into regions properly needs planar-face
 * traversal, which is the upgrade if branching profiles are ever wanted; until
 * then a caller has an honest thing to show the user.
 *
 * Construction geometry is reference only and never contributes.
 */
import { normalizeLoops, loopArea } from '../mesh/slice.js';

const TAU = Math.PI * 2;

/** Chord tolerance for tessellating arcs and circles, in mm. */
export const CHORD_TOL = 0.01;
/** Points closer than this are the same vertex (a solve settles well under it). */
export const WELD_TOL = 1e-6;

const norm = (a) => ((a % TAU) + TAU) % TAU;

/**
 * Segment count for an arc of radius `r` sweeping `span` radians, chosen so no
 * chord sits further than `chordTol` from the true arc. Below ~2 segments a
 * half-circle collapses to a straight line, and the cap keeps a hairline-radius
 * fillet from producing tens of thousands of points.
 */
export function arcSegments(r, span, chordTol = CHORD_TOL) {
  if (!(r > 0) || !(span > 0)) return 1;
  // Sagitta of a chord subtending `a`: r(1 - cos(a/2)). Invert for a = the
  // widest angle whose sagitta is still within tolerance.
  const maxAngle = chordTol >= r ? span : 2 * Math.acos(1 - chordTol / r);
  const n = Math.ceil(span / (maxAngle || span));
  return Math.min(720, Math.max(2, Number.isFinite(n) ? n : 2));
}

/**
 * Tessellate a counter-clockwise sweep as a flat point list, inclusive of both
 * ends. The caller drops the duplicate when appending to a running polyline.
 */
export function tessellateArc(cx, cy, r, a0, a1, chordTol = CHORD_TOL) {
  const span = norm(a1 - a0) || TAU;
  const segs = arcSegments(r, span, chordTol);
  const out = new Array((segs + 1) * 2);
  for (let i = 0; i <= segs; i++) {
    const a = a0 + (span * i) / segs;
    out[i * 2] = cx + r * Math.cos(a);
    out[i * 2 + 1] = cy + r * Math.sin(a);
  }
  return out;
}

/** Union-find over point ids. */
function makeUnion() {
  const parent = new Map();
  const find = (a) => {
    let root = a;
    while (parent.has(root) && parent.get(root) !== root) root = parent.get(root);
    let cur = a;
    while (parent.has(cur) && parent.get(cur) !== cur) {
      const next = parent.get(cur);
      parent.set(cur, root);
      cur = next;
    }
    return root;
  };
  return {
    add(a) { if (!parent.has(a)) parent.set(a, a); },
    find,
    union(a, b) {
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent.set(rb, ra);
    },
  };
}

/**
 * Group the sketch's points into vertices: one per distinct location, merging
 * ids joined by a `coincident` constraint or sitting within `weldTol` of each
 * other. Returns a `vertexOf(pointId)` lookup.
 */
function weldPoints(sk, weldTol) {
  const uf = makeUnion();
  const pts = [];
  for (const e of sk.entities.values()) {
    if (e.type !== 'point') continue;
    uf.add(e.id);
    pts.push(e);
  }
  for (const c of sk.constraints) {
    if (c.kind === 'coincident') uf.union(c.refs[0], c.refs[1]);
  }
  // Positional merge. O(n²) on points, which a hand-drawn sketch has few of; the
  // sketches this runs on are dozens of points, not the thousands a slice chains.
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      if (Math.abs(pts[i].x - pts[j].x) <= weldTol && Math.abs(pts[i].y - pts[j].y) <= weldTol) {
        uf.union(pts[i].id, pts[j].id);
      }
    }
  }
  return (id) => uf.find(id);
}

/**
 * The sketch as a graph: `edges` are the drawable entities with their two end
 * vertices and a polyline running from `a` to `b`, `rings` are the entities that
 * close on themselves (a circle, or an arc whose ends land on one vertex).
 */
function buildGraph(sk, { chordTol, weldTol }) {
  const vertexOf = weldPoints(sk, weldTol);
  const P = (id) => sk.entities.get(id);
  const edges = [];
  const rings = [];

  for (const e of sk.entities.values()) {
    if (e.construction) continue;
    if (e.type === 'line') {
      const p1 = P(e.p1);
      const p2 = P(e.p2);
      if (!p1 || !p2) continue;
      const a = vertexOf(e.p1);
      const b = vertexOf(e.p2);
      if (a === b) continue; // zero-length after welding — carries no boundary
      edges.push({ id: e.id, a, b, points: [p1.x, p1.y, p2.x, p2.y] });
    } else if (e.type === 'arc') {
      const c = P(e.center);
      const s = P(e.start);
      const en = P(e.end);
      if (!c || !s || !en) continue;
      const a0 = Math.atan2(s.y - c.y, s.x - c.x);
      const a1 = Math.atan2(en.y - c.y, en.x - c.x);
      const points = tessellateArc(c.x, c.y, e.r, a0, a1, chordTol);
      // Pin the ends to the points themselves: the rim projection is within
      // solver tolerance of them, and an exact match keeps a chained loop from
      // showing a hairline step where an arc meets the line it is tangent to.
      points[0] = s.x; points[1] = s.y;
      points[points.length - 2] = en.x; points[points.length - 1] = en.y;
      const a = vertexOf(e.start);
      const b = vertexOf(e.end);
      if (a === b) rings.push({ id: e.id, points });
      else edges.push({ id: e.id, a, b, points });
    } else if (e.type === 'circle') {
      const c = P(e.center);
      if (!c || !(e.r > 0)) continue;
      const points = tessellateArc(c.x, c.y, e.r, 0, TAU, chordTol);
      points.length -= 2; // a ring repeats its first point; loops never do
      rings.push({ id: e.id, points });
    }
  }

  const at = new Map(); // vertex -> edge indices touching it
  edges.forEach((edge, i) => {
    for (const v of [edge.a, edge.b]) {
      const list = at.get(v);
      if (list) list.push(i);
      else at.set(v, [i]);
    }
  });
  return { edges, rings, at };
}

/** A polyline reversed, as a flat point list. */
function reversePoints(pts) {
  const out = new Array(pts.length);
  const n = pts.length / 2;
  for (let i = 0; i < n; i++) {
    out[i * 2] = pts[(n - 1 - i) * 2];
    out[i * 2 + 1] = pts[(n - 1 - i) * 2 + 1];
  }
  return out;
}

/**
 * Strip the geometry that cannot bound a region.
 *
 * Anything hanging by one end — a line drawn and left, a chain that stops short
 * — is peeled off, repeatedly, because removing an edge can leave its neighbour
 * hanging in turn. What survives has every vertex on at least two edges, which
 * is the precondition for face traversal and, more usefully, means a dangling
 * line lying *inside* a profile no longer puts a zero-width spike into it.
 */
function pruneDangling(edges, at) {
  const degree = new Map();
  for (const [v, list] of at) degree.set(v, list.length);
  const alive = new Uint8Array(edges.length).fill(1);
  const queue = [...degree.entries()].filter(([, d]) => d === 1).map(([v]) => v);

  while (queue.length) {
    const v = queue.pop();
    if (degree.get(v) !== 1) continue;
    const i = (at.get(v) || []).find((k) => alive[k]);
    if (i === undefined) { degree.set(v, 0); continue; }
    alive[i] = 0;
    for (const u of [edges[i].a, edges[i].b]) {
      const d = (degree.get(u) || 1) - 1;
      degree.set(u, d);
      if (d === 1) queue.push(u);
    }
  }
  return { alive, degree };
}

/**
 * Trace the faces of the planar graph — the regions the geometry encloses.
 *
 * This replaced a walk that followed each edge to the next unused one and gave
 * up at any vertex with three edges on it, calling the profile ambiguous. It is
 * not ambiguous: a line across a rectangle makes two regions, and every CAD
 * shows them. What the old walk lacked was a rule for *which* way to turn.
 *
 * The rule is the standard one. Arriving along a half-edge, take its reverse and
 * step to the next half-edge **clockwise** around the vertex. Following it
 * always turns as sharply left as possible, so a bounded face comes out
 * counter-clockwise and the one unbounded face comes out clockwise — which is
 * exactly how it is told apart and dropped, by the sign of its area.
 *
 * Departure angles are taken from the **tessellated polyline's first step**, not
 * from the straight line between a curve's endpoints: at a vertex where an arc
 * meets a line the ordering has to follow the arc's tangent, and its chord can
 * point the other side of the line entirely.
 */
function traceFaces(edges, alive) {
  // Half-edge h: edge h>>1, travelled forwards when h is even. Its twin is h^1.
  const originOf = (h) => (h % 2 === 0 ? edges[h >> 1].a : edges[h >> 1].b);
  const pointsOf = (h) => (h % 2 === 0 ? edges[h >> 1].points : reversePoints(edges[h >> 1].points));

  const around = new Map(); // vertex -> half-edges leaving it, sorted CCW
  const angle = new Float64Array(edges.length * 2);
  for (let i = 0; i < edges.length; i++) {
    if (!alive[i]) continue;
    for (const h of [i * 2, i * 2 + 1]) {
      const p = pointsOf(h);
      angle[h] = Math.atan2(p[3] - p[1], p[2] - p[0]);
      const v = originOf(h);
      const list = around.get(v);
      if (list) list.push(h); else around.set(v, [h]);
    }
  }
  for (const list of around.values()) {
    // Ties (two curves leaving in the same direction) are broken by index, so
    // the order is at least deterministic where the geometry cannot decide.
    list.sort((x, y) => (angle[x] - angle[y]) || (x - y));
  }
  const slot = new Map(); // half-edge -> its position in its origin's list
  for (const [, list] of around) list.forEach((h, k) => slot.set(h, k));

  const seen = new Uint8Array(edges.length * 2);
  const faces = [];
  for (let start = 0; start < edges.length * 2; start++) {
    if (!alive[start >> 1] || seen[start]) continue;
    const points = [];
    const entities = [];
    let h = start;
    // A face cannot be longer than every half-edge there is.
    for (let guard = edges.length * 2 + 1; guard > 0; guard--) {
      seen[h] = 1;
      const seg = pointsOf(h);
      // Each half-edge starts where the last one ended; skip the repeat.
      for (let k = points.length ? 2 : 0; k < seg.length; k++) points.push(seg[k]);
      entities.push(edges[h >> 1].id);

      const twin = h ^ 1;
      const list = around.get(originOf(twin));
      const k = slot.get(twin);
      const next = list[(k - 1 + list.length) % list.length];
      if (next === start) break;
      h = next;
      if (seen[h]) break; // cannot happen for a well-formed graph; never spin
    }
    points.length -= 2; // the last point closed back onto the first
    faces.push({ points, entities });
  }
  return faces;
}

/**
 * Closed loops of the graph, plus the geometry that bounds nothing.
 *
 * Rings (a circle, or an arc closing on itself) never enter the graph — they are
 * already loops. Everything else is pruned, traced, and the unbounded face
 * dropped by the sign of its area.
 */
function chainGraph({ edges, rings, at }) {
  const closed = [];
  for (const ring of rings) closed.push({ points: ring.points, entities: [ring.id] });

  const { alive, degree } = pruneDangling(edges, at);
  for (const face of traceFaces(edges, alive)) {
    // The one clockwise face is the outside of the component, not a region.
    if (loopArea(face.points) > 0) closed.push(face);
  }

  // What was pruned is reported, not silently dropped: geometry left out of the
  // solid has to be visible to whoever drew it.
  const open = [];
  const used = new Uint8Array(edges.length);
  /** Extend a chain from `vertex`, appending to `out`. Only pruned edges. */
  const walk = (vertex, prev, out, ids) => {
    let at2 = vertex;
    let last = prev;
    for (;;) {
      const from = last;
      const next = (at.get(at2) || []).filter((i) => i !== from && !alive[i] && !used[i]);
      if (next.length !== 1) return;
      const i = next[0];
      used[i] = 1;
      ids.push(edges[i].id);
      const forward = edges[i].a === at2;
      const seg = forward ? edges[i].points : reversePoints(edges[i].points);
      for (let k = 2; k < seg.length; k++) out.push(seg[k]);
      at2 = forward ? edges[i].b : edges[i].a;
      last = i;
    }
  };
  for (let s = 0; s < edges.length; s++) {
    if (alive[s] || used[s]) continue;
    used[s] = 1;
    // Grown in both directions from the seed and spliced, the same way an open
    // chain was assembled before: forwards from b, then backwards from a with
    // the seed reversed, so the two halves overlap on the seed and line up.
    const points = edges[s].points.slice();
    const entities = [edges[s].id];
    walk(edges[s].b, s, points, entities);
    const tail = reversePoints(edges[s].points);
    const tailIds = [];
    walk(edges[s].a, s, tail, tailIds);
    const front = reversePoints(tail); // … → a → b
    open.push({
      points: [...front, ...points.slice(4)],
      entities: [...tailIds.reverse(), ...entities],
    });
  }

  // Reported for information now rather than as a failure: face traversal
  // resolves a junction rather than giving up at it.
  const branches = [...degree.entries()].filter(([, d]) => d > 2).map(([v]) => v);
  return { closed, open, branches };
}

/**
 * Closed loops of a sketch, outer-CCW / hole-CW and biggest first.
 *
 * @param {object} sk  sketch document (`model.js`)
 * @param {{chordTol?:number, weldTol?:number, minArea?:number}} [opts]
 * @returns {{loops: object[], open: object[], branches: number[]}}
 *   `loops[i]` is `{ points, area, isHole, depth, signedArea, entities }`;
 *   `open` holds the chains that never closed, so a caller can say which
 *   geometry is dangling; `branches` names the ambiguous vertices.
 */
export function sketchLoops(sk, opts = {}) {
  const { chordTol = CHORD_TOL, weldTol = WELD_TOL, minArea = 1e-6 } = opts;
  if (!sk?.entities) return { loops: [], open: [], branches: [] };
  const graph = buildGraph(sk, { chordTol, weldTol });
  const { closed, open, branches } = chainGraph(graph);
  const loops = normalizeLoops(closed.map((c) => c.points), { minArea })
    .map((loop) => ({ ...loop, entities: closed[loop.sourceIndex].entities }));
  return { loops, open, branches };
}

/**
 * Group loops into the regions a solid is actually made from: each outer
 * boundary with the holes that belong to it.
 *
 * Nesting depth already says which is which — `sliceLoops`' convention is that
 * an even depth is solid and an odd one is a hole — so a hole is assigned to the
 * *nearest* enclosing solid, which is the last loop before it whose depth is one
 * less. Loops arrive biggest-first, so that loop has always been seen already.
 * An island standing inside a pocket comes back as its own region, which is what
 * extruding it should produce.
 *
 * @returns {{outer:number[], holes:number[][], area:number, entities:number[]}[]}
 */
export function sketchRegions(sk, opts = {}) {
  const { loops, open, branches } = sketchLoops(sk, opts);
  return { regions: groupRegions(loops), open, branches };
}

/**
 * Group normalized loops into regions.
 *
 * Split from `sketchRegions` because a boolean produces loops too
 * (`engine/solid/regionBoolean.js`), and "which hole belongs to which outer" has
 * to be decided the same way for both or a subtracted pocket comes back as a
 * separate body sitting inside its own plate.
 *
 * @param {object[]} loops  `normalizeLoops` output — biggest first, depth set
 */
export function groupRegions(loops) {
  const regions = [];
  const openAt = []; // region index most recently opened at each depth
  for (const loop of loops) {
    if (!loop.isHole) {
      openAt[loop.depth] = regions.length;
      regions.push({
        outer: loop.points, holes: [], area: loop.area, entities: [...(loop.entities || [])],
      });
    } else {
      const owner = regions[openAt[loop.depth - 1]];
      // A hole with no enclosing solid cannot happen — depth is what made it a
      // hole — but a caller passing hand-built loops in could produce one.
      if (!owner) continue;
      owner.holes.push(loop.points);
      owner.area -= loop.area;
      owner.entities.push(...(loop.entities || []));
    }
  }
  return regions;
}
