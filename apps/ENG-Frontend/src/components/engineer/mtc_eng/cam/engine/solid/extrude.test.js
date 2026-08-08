import { describe, it, expect } from 'vitest';
import { extrudeRegion, revolveRegion, buildSolid, mergeSoups } from './extrude.js';

/**
 * Signed volume by the divergence theorem — the single number that checks both
 * things that can go wrong with a generated solid at once. It is only correct
 * for a **closed** surface, and it comes out **positive** only when every
 * triangle faces outward. A gap or an inside-out face shows up here.
 */
function signedVolume({ positions, triangleCount }) {
  let v = 0;
  for (let t = 0; t < triangleCount; t++) {
    const o = t * 9;
    const ax = positions[o]; const ay = positions[o + 1]; const az = positions[o + 2];
    const bx = positions[o + 3]; const by = positions[o + 4]; const bz = positions[o + 5];
    const cx = positions[o + 6]; const cy = positions[o + 7]; const cz = positions[o + 8];
    v += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
  }
  return v;
}

/**
 * Whether every edge is shared by exactly two triangles — a watertight surface.
 * Keyed on rounded coordinates so the two copies of a shared vertex match.
 */
function isClosed({ positions, triangleCount }) {
  // `-0` and `0` must key the same, or a seam that lands on an axis reads as two
  // separate vertices and the surface looks torn where it is not.
  const q = (v) => {
    const r = Math.round(v * 1e5) / 1e5;
    return (r === 0 ? 0 : r).toFixed(5);
  };
  const key = (o) => `${q(positions[o])},${q(positions[o + 1])},${q(positions[o + 2])}`;
  const edges = new Map();
  for (let t = 0; t < triangleCount; t++) {
    const o = t * 9;
    const k = [key(o), key(o + 3), key(o + 6)];
    for (let i = 0; i < 3; i++) {
      const a = k[i];
      const b = k[(i + 1) % 3];
      if (a === b) continue; // degenerate sliver contributes no edge
      const id = a < b ? `${a}|${b}` : `${b}|${a}`;
      edges.set(id, (edges.get(id) || 0) + 1);
    }
  }
  return [...edges.values()].every((n) => n === 2);
}

const bounds = ({ positions }) => {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    for (let a = 0; a < 3; a++) {
      if (positions[i + a] < min[a]) min[a] = positions[i + a];
      if (positions[i + a] > max[a]) max[a] = positions[i + a];
    }
  }
  return { min, max };
};

const square = (x0, y0, x1, y1) => [x0, y0, x1, y0, x1, y1, x0, y1];
const ngon = (cx, cy, r, n, ccw = true) => {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = ((ccw ? 1 : -1) * i * Math.PI * 2) / n;
    out.push(cx + r * Math.cos(a), cy + r * Math.sin(a));
  }
  return out;
};

describe('extrudeRegion', () => {
  it('makes a watertight, outward-facing slab of the right volume', () => {
    const soup = extrudeRegion({ outer: square(0, 0, 40, 20) }, { depth: 6 });
    expect(isClosed(soup)).toBe(true);
    expect(signedVolume(soup)).toBeCloseTo(40 * 20 * 6);
    expect(soup.format).toBe('extrude');
  });

  it('subtracts a bore, and the solid stays closed around it', () => {
    const soup = extrudeRegion(
      { outer: square(0, 0, 40, 40), holes: [ngon(20, 20, 6, 32, false)] },
      { depth: 10 },
    );
    const bore = 0.5 * 32 * 36 * Math.sin((Math.PI * 2) / 32);
    expect(isClosed(soup)).toBe(true);
    expect(signedVolume(soup)).toBeCloseTo((1600 - bore) * 10, 2);
  });

  it('extrudes downward for a negative depth, still facing outward', () => {
    const soup = extrudeRegion({ outer: square(0, 0, 10, 10) }, { depth: -4 });
    expect(signedVolume(soup)).toBeCloseTo(400);
    expect(bounds(soup).min[2]).toBeCloseTo(-4);
    expect(bounds(soup).max[2]).toBeCloseTo(0);
  });

  it('lifts the slab off the plane when a base is given', () => {
    const soup = extrudeRegion({ outer: square(0, 0, 10, 10) }, { depth: 3, base: 12 });
    expect(bounds(soup).min[2]).toBeCloseTo(12);
    expect(bounds(soup).max[2]).toBeCloseTo(15);
  });

  it('stands the solid up when the sketch is on the front plane', () => {
    const soup = extrudeRegion(
      { outer: square(0, 0, 40, 20) },
      { depth: 6, plane: { preset: 'XZ', offset: 0 } },
    );
    const { min, max } = bounds(soup);
    // Sketch x → world X, sketch y → world Z, depth → world −Y (the XZ normal).
    expect(max[0]).toBeCloseTo(40);
    expect(max[2]).toBeCloseTo(20);
    expect(min[1]).toBeCloseTo(-6);
    expect(signedVolume(soup)).toBeCloseTo(40 * 20 * 6);
  });

  it('refuses a profile with no boundary, and a zero depth', () => {
    expect(() => extrudeRegion({ outer: [] }, { depth: 5 })).toThrow(/outer boundary/i);
    expect(() => extrudeRegion({ outer: square(0, 0, 1, 1) }, { depth: 0 })).toThrow(/depth/i);
  });
});

describe('revolveRegion', () => {
  it('turns a rectangle into a cylinder of the right volume', () => {
    // A 20 long × 5 tall profile standing off the X axis from r=0 to r=5.
    const soup = revolveRegion({ outer: square(0, 0, 20, 5) }, { axis: 'x', segments: 360 });
    expect(isClosed(soup)).toBe(true);
    // Faceting makes the swept polygon slightly smaller than the true circle.
    expect(signedVolume(soup)).toBeCloseTo(Math.PI * 25 * 20, 0);
  });

  it('turns an offset rectangle into a tube', () => {
    // r from 4 to 10 over a length of 12 → an annulus swept round.
    const soup = revolveRegion({ outer: square(0, 4, 12, 10) }, { axis: 'x', segments: 360 });
    expect(isClosed(soup)).toBe(true);
    expect(signedVolume(soup)).toBeCloseTo(Math.PI * (100 - 16) * 12, -1);
  });

  it('revolves a profile drawn on the negative side the same way', () => {
    const up = revolveRegion({ outer: square(0, 0, 20, 5) }, { axis: 'x', segments: 180 });
    const down = revolveRegion({ outer: square(0, -5, 20, 0) }, { axis: 'x', segments: 180 });
    expect(signedVolume(down)).toBeCloseTo(signedVolume(up), 6);
    expect(isClosed(down)).toBe(true);
  });

  it('revolves about the Y axis too', () => {
    const soup = revolveRegion({ outer: square(0, 0, 5, 20) }, { axis: 'y', segments: 360 });
    expect(signedVolume(soup)).toBeCloseTo(Math.PI * 25 * 20, 0);
  });

  it('caps a partial revolve so it is still a closed solid', () => {
    const soup = revolveRegion({ outer: square(0, 0, 20, 5) }, { axis: 'x', angle: Math.PI, segments: 180 });
    expect(isClosed(soup)).toBe(true);
    expect(signedVolume(soup)).toBeCloseTo((Math.PI * 25 * 20) / 2, 0);
  });

  it('refuses a profile straddling the axis rather than building a solid through itself', () => {
    expect(() => revolveRegion({ outer: square(0, -5, 20, 5) }, { axis: 'x' }))
      .toThrow(/crosses the X axis/i);
  });
});

describe('buildSolid / mergeSoups', () => {
  it('merges two separate profiles into one part', () => {
    const regions = [
      { outer: square(0, 0, 10, 10), holes: [] },
      { outer: square(30, 0, 40, 10), holes: [] },
    ];
    const soup = buildSolid(regions, { depth: 5 });
    expect(soup.triangleCount).toBe(2 * 12);
    expect(signedVolume(soup)).toBeCloseTo(2 * 100 * 5);
  });

  it('routes to the revolve builder when asked for one', () => {
    const soup = buildSolid([{ outer: square(0, 0, 20, 5) }], { op: 'revolve', axis: 'x', segments: 180 });
    expect(soup.format).toBe('revolve');
  });

  it('says so when there is nothing to build', () => {
    expect(() => buildSolid([], { depth: 5 })).toThrow(/closed profile/i);
    expect(() => mergeSoups([])).toThrow(/Nothing to build/i);
  });

  it('produces the soup shape the CAM pipeline already reads', () => {
    const soup = buildSolid([{ outer: square(0, 0, 10, 10) }], { depth: 5 });
    expect(soup.positions).toBeInstanceOf(Float32Array);
    expect(soup.positions.length).toBe(soup.triangleCount * 9);
    expect(typeof soup.format).toBe('string');
  });
});
