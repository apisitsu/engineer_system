import { describe, it, expect } from 'vitest';
import {
  holeSection, holePositions, holeSolid, drillDiameter, THREADS,
} from './hole.js';
import { createFeature, rebuildFeatures, describeFeature } from './featureTree.js';
import { meshBoolean } from '../../lib/csg.js';
import { createSketch, addPoint, addLine, addCircle } from '../sketch/model.js';
import { volume } from './solidAssert.js';

const near = (v, want, tol = 1) => expect(Math.abs(v - want)).toBeLessThan(tol);

/** A 40 × 40 plate sketch, and a sketch on its top with points where holes go. */
function plateAndPoints(points, top = 10) {
  const plate = createSketch();
  const p = [[0, 0], [40, 0], [40, 40], [0, 40]].map(([x, y]) => addPoint(plate, x, y));
  for (let i = 0; i < 4; i++) addLine(plate, p[i], p[(i + 1) % 4]);
  const holes = createSketch();
  for (const [x, y] of points) addPoint(holes, x, y);
  return {
    1: { doc: plate, plane: { preset: 'XY', offset: 0 } },
    2: { doc: holes, plane: { preset: 'XY', offset: top, gap: 0 } },
  };
}
const ctx = (sketches) => ({ sketchOf: (id) => sketches[id] || null, meshBoolean });
/** A faceted cylinder's volume, as the revolve builds it (one segment per 3°). */
const faceted = (r, h) => 0.5 * 120 * r * r * Math.sin((2 * Math.PI) / 120) * h;

describe('holePositions', () => {
  it('takes the sketch’s own points, not the corners of its lines', () => {
    const sk = createSketch();
    const a = addPoint(sk, 0, 0);
    const b = addPoint(sk, 10, 0);
    addLine(sk, a, b);
    addPoint(sk, 5, 5);
    expect(holePositions(sk)).toEqual([[5, 5]]);
  });

  it('falls back on the centres of circles when it has no points of its own', () => {
    const sk = createSketch();
    addCircle(sk, addPoint(sk, 3, 4), 2);
    expect(holePositions(sk)).toEqual([[3, 4]]);
  });
});

describe('holeSection', () => {
  it('drills a tapped hole at the tap drill, not the thread', () => {
    expect(drillDiameter({ holeType: 'tap', thread: 'M8' })).toBe(THREADS.M8.drill);
  });

  it('ends a blind hole in a 118° drill point, and a through one flat', () => {
    const blind = holeSection({ holeType: 'drill', diameter: 10 }, 20, false);
    const tipAlong = Math.max(...blind.filter((_, i) => i % 2 === 0));
    expect(tipAlong).toBeCloseTo(20 + 5 / Math.tan((59 * Math.PI) / 180), 6);
    const through = holeSection({ holeType: 'drill', diameter: 10 }, 20, true);
    expect(Math.max(...through.filter((_, i) => i % 2 === 0))).toBe(20);
  });

  it('refuses a counterbore no wider than its hole', () => {
    expect(() => holeSection({
      holeType: 'cbore', diameter: 10, cbDiameter: 8, cbDepth: 3,
    }, 20, true)).toThrow(/wider/);
  });
});

describe('Hole feature', () => {
  const plate = () => createFeature('extrude', { sketchId: 1, depth: 10 });

  it('drills through the plate at every point', () => {
    const sk = plateAndPoints([[10, 10], [30, 30]]);
    const hole = createFeature('hole', { sketchId: 2, diameter: 6, end: 'through' });
    const { soup, errors } = rebuildFeatures([plate(), hole], ctx(sk));
    expect(errors).toEqual([]);
    near(volume(soup), 16000 - 2 * faceted(3, 10));
  });

  it('cuts a counterbore: the wide part, then the hole', () => {
    const sk = plateAndPoints([[20, 20]]);
    const hole = createFeature('hole', {
      sketchId: 2, holeType: 'cbore', diameter: 6.6, cbDiameter: 11, cbDepth: 4, end: 'through',
    });
    const { soup } = rebuildFeatures([plate(), hole], ctx(sk));
    near(volume(soup), 16000 - faceted(5.5, 4) - faceted(3.3, 6));
  });

  it('stops a blind hole at its depth, point and all', () => {
    const sk = plateAndPoints([[20, 20]]);
    const hole = createFeature('hole', { sketchId: 2, diameter: 6, depth: 5 });
    const { soup } = rebuildFeatures([plate(), hole], ctx(sk));
    const cone = (Math.PI / 3) * 9 * (3 / Math.tan((59 * Math.PI) / 180));
    near(volume(soup), 16000 - faceted(3, 5) - cone, 1.5);
  });

  it('says so when there is nothing to put it in, or nowhere to put it', () => {
    const sk = plateAndPoints([]);
    expect(rebuildFeatures([createFeature('hole', { sketchId: 2 })], ctx(sk)).errors[0].message).toMatch(/needs a part/);
    expect(rebuildFeatures([plate(), createFeature('hole', { sketchId: 2 })], ctx(sk)).errors[0].message).toMatch(/no point/);
  });

  it('always cuts, and reads in the tree as the hole it is', () => {
    const f = createFeature('hole', { holeType: 'tap', thread: 'M10', merge: 'add' });
    expect(f.merge).toBe('cut');
    expect(describeFeature(f)).toMatch(/^Tapped M10 × 15 mm/);
  });

  it('builds one solid per point when asked for on its own', () => {
    const soup = holeSolid([[0, 0], [10, 0]], { preset: 'XY', offset: 0 }, { holeType: 'drill', diameter: 4 }, { depth: 5, through: true });
    near(volume(soup), 2 * faceted(2, 5.5), 0.5); // each starts 0.5 mm above the face
  });
});

describe('which way a hole runs', () => {
  it('goes into a part its plane is the top of without being reversed', async () => {
    const { defaultReverse } = await import('./featureTree.js');
    const bounds = { min: [0, 0, 0], max: [40, 40, 10] };
    // HolePanel's default: a hole needs reversing only where a boss would.
    expect(defaultReverse({ preset: 'XY', offset: 10 }, bounds, false)).toBe(false);
    expect(defaultReverse({ preset: 'XY', offset: 0 }, bounds, false)).toBe(true);
  });
});
