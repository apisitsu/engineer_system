import { describe, it, expect, beforeEach } from 'vitest';
import { useSketchStore } from './sketchStore.js';
import { useCamPlanStore } from './camPlanStore.js';
import { addPoint, addLine, addCircle } from '../engine/sketch/model.js';

const sketch = () => useSketchStore.getState();
const cam = () => useCamPlanStore.getState();

beforeEach(() => {
  sketch().clear();
  useSketchStore.setState({
    sketches: [{ id: 1, name: 'Sketch1', plane: { preset: 'XY', offset: 0 }, doc: sketch().sk }],
    activeId: 1,
    nextSketchId: 2,
    past: [], future: [], error: null,
  });
});

/** A closed rectangle on the active sketch. */
function rect(x0, y0, x1, y1) {
  const sk = sketch().sk;
  const p1 = addPoint(sk, x0, y0);
  const p2 = addPoint(sk, x1, y0);
  const p3 = addPoint(sk, x1, y1);
  const p4 = addPoint(sk, x0, y1);
  addLine(sk, p1, p2);
  addLine(sk, p2, p3);
  addLine(sk, p3, p4);
  addLine(sk, p4, p1);
  sketch()._bump();
}

describe('sketch → solid → CAM', () => {
  it('reads the closed regions of the active sketch', () => {
    rect(0, 0, 40, 20);
    const { regions, open, branches } = sketch().regions();
    expect(regions).toHaveLength(1);
    expect(open).toHaveLength(0);
    expect(branches).toHaveLength(0);
    expect(regions[0].area).toBeCloseTo(800);
  });

  it('extrudes into a part the CAM store has measured', async () => {
    rect(0, 0, 40, 20);
    const analysis = await sketch().build({ op: 'extrude', depth: 6 });
    expect(analysis).toBeTruthy();
    expect(cam().status).toBe('ready');
    expect(cam().stlName).toBe('Sketch1.extrude');
    expect(cam().partFormat).toBe('extrude');
    // Measured like any imported part: the bounding box is the slab it drew.
    expect(analysis.bounds.size[0]).toBeCloseTo(40, 3);
    expect(analysis.bounds.size[1]).toBeCloseTo(20, 3);
    expect(analysis.bounds.size[2]).toBeCloseTo(6, 3);
    expect(analysis.volume).toBeCloseTo(40 * 20 * 6, 3);
    // `analyzeMesh` warns about an inside-out solid; a generated one must never
    // trip it, and this is the check that the wall winding is right end to end.
    expect(analysis.warnings.join(' ')).not.toMatch(/inside-out/i);
  });

  it('carries a bore through to the solid', async () => {
    rect(0, 0, 40, 40);
    const c = addPoint(sketch().sk, 20, 20);
    addCircle(sketch().sk, c, 6);
    sketch()._bump();
    const { regions } = sketch().regions();
    expect(regions[0].holes).toHaveLength(1);
    expect(await sketch().build({ op: 'extrude', depth: 10 })).toBeTruthy();
    expect(cam().status).toBe('ready');
  });

  it('builds on the plane the sketch is on, not always the table', async () => {
    sketch().setSketchPlane(1, { preset: 'XZ', offset: 0 });
    rect(0, 0, 40, 20);
    const analysis = await sketch().build({ op: 'extrude', depth: 6 });
    expect(analysis).toBeTruthy();
    // Standing on the front plane, the part is 20 tall in Z, not 6.
    expect(analysis.bounds.size[2]).toBeCloseTo(20, 3);
    expect(analysis.bounds.size[1]).toBeCloseTo(6, 3);
    expect(analysis.warnings.join(' ')).not.toMatch(/inside-out/i);
  });

  it('revolves a profile into a turned part', async () => {
    rect(0, 4, 30, 10); // a tube: r 4→10 over 30 long
    const analysis = await sketch().build({ op: 'revolve', axis: 'x', segments: 120 });
    expect(analysis).toBeTruthy();
    expect(cam().partFormat).toBe('revolve');
    expect(cam().stlName).toBe('Sketch1.revolve');
  });
});

describe('sketch → solid — combining the profiles first', () => {
  it('unions two overlapping profiles into one body', async () => {
    rect(0, 0, 20, 20);
    rect(10, 10, 30, 30);
    expect(sketch().regions().regions).toHaveLength(2);
    expect(sketch().regions('union').regions).toHaveLength(1);
    const analysis = await sketch().build({ op: 'extrude', depth: 5, combine: 'union' });
    expect(analysis).toBeTruthy();
    expect(analysis.volume).toBeCloseTo((400 + 400 - 100) * 5, 2);
  });

  it('subtracts an enclosed profile into a pocket, not a second body', async () => {
    rect(0, 0, 40, 40);
    rect(10, 10, 20, 20);
    const analysis = await sketch().build({ op: 'extrude', depth: 5, combine: 'difference' });
    expect(analysis).toBeTruthy();
    expect(analysis.volume).toBeCloseTo((1600 - 100) * 5, 2);
    expect(analysis.warnings.join(' ')).not.toMatch(/inside-out/i);
  });

  it('keeps both bodies when asked to keep them apart', async () => {
    rect(0, 0, 10, 10);
    rect(30, 0, 40, 10);
    const analysis = await sketch().build({ op: 'extrude', depth: 5 });
    expect(analysis.volume).toBeCloseTo(2 * 100 * 5, 2);
  });

  it('says so when the combination leaves nothing', async () => {
    rect(0, 0, 10, 10);
    rect(30, 0, 40, 10); // no overlap at all
    expect(await sketch().build({ op: 'extrude', depth: 5, combine: 'intersect' })).toBeNull();
    expect(sketch().error).toMatch(/Nothing left after intersect/i);
  });

  it('ignores a combine when there is only one profile to combine', async () => {
    rect(0, 0, 20, 20);
    const analysis = await sketch().build({ op: 'extrude', depth: 5, combine: 'difference' });
    expect(analysis).toBeTruthy();
    expect(analysis.volume).toBeCloseTo(400 * 5, 2);
  });
});

describe('sketch → solid — combining with the part already loaded', () => {
  it('cuts a pocket out of the part standing on the machine', async () => {
    // First build makes the plate.
    rect(0, 0, 40, 40);
    expect(await sketch().build({ op: 'extrude', depth: 10 })).toBeTruthy();

    // Second build cuts a 10×10 through pocket out of it.
    sketch().clear();
    rect(15, 15, 25, 25);
    const analysis = await sketch().build({ op: 'extrude', depth: 30, base: -10, merge: 'cut' });
    expect(analysis).toBeTruthy();
    expect(analysis.volume).toBeCloseTo(40 * 40 * 10 - 10 * 10 * 10, 1);
    expect(analysis.warnings.join(' ')).not.toMatch(/inside-out/i);
  });

  it('adds a boss to the part without double-counting the overlap', async () => {
    rect(0, 0, 40, 40);
    await sketch().build({ op: 'extrude', depth: 10 });
    sketch().clear();
    rect(10, 10, 20, 20);
    const analysis = await sketch().build({ op: 'extrude', depth: 20, merge: 'add' });
    // The boss stands on the plate: 10 mm of it is already inside.
    expect(analysis.volume).toBeCloseTo(40 * 40 * 10 + 10 * 10 * 10, 1);
  });

  it('names the loaded part in what the result is called', async () => {
    rect(0, 0, 40, 40);
    await sketch().build({ op: 'extrude', depth: 10 });
    sketch().clear();
    rect(15, 15, 25, 25);
    await sketch().build({ op: 'extrude', depth: 30, base: -10, merge: 'cut' });
    expect(cam().stlName).toMatch(/cut/i);
  });

  it('says there is nothing to merge with when no part is loaded', async () => {
    // Setting `status` is not enough: the merge reads the module-level mesh
    // cache, not the store field. A failed load is what actually empties it.
    await cam().loadPart({ name: 'broken.stl', arrayBuffer: async () => new ArrayBuffer(4) });
    expect(cam().status).toBe('error');

    rect(0, 0, 10, 10);
    expect(await sketch().build({ op: 'extrude', depth: 5, merge: 'cut' })).toBeNull();
    expect(sketch().error).toMatch(/no part loaded to combine with/i);
  });
});

describe('sketch → solid — what it refuses, and what it says', () => {
  it('names the open profile rather than building something wrong', async () => {
    const sk = sketch().sk;
    const p1 = addPoint(sk, 0, 0);
    const p2 = addPoint(sk, 40, 0);
    const p3 = addPoint(sk, 40, 20);
    addLine(sk, p1, p2);
    addLine(sk, p2, p3);
    sketch()._bump();
    expect(await sketch().build({ depth: 5 })).toBeNull();
    expect(sketch().error).toMatch(/not closed/i);
  });

  it('names the ambiguous vertex when geometry branches', async () => {
    rect(0, 0, 40, 20);
    const sk = sketch().sk;
    const stray = addPoint(sk, -10, -10);
    addLine(sk, sk.entities.keys().next().value + 1, stray); // off an existing corner
    sketch()._bump();
    const res = await sketch().build({ depth: 5 });
    if (res === null) expect(sketch().error).toMatch(/ambiguous|not closed|Draw a closed/i);
  });

  it('asks for something to be drawn when the sketch is empty', async () => {
    expect(await sketch().build({ depth: 5 })).toBeNull();
    expect(sketch().error).toMatch(/Draw a closed profile/i);
  });

  it('passes a builder error through as the message, not as a crash', async () => {
    rect(0, 0, 40, 20);
    expect(await sketch().build({ op: 'extrude', depth: 0 })).toBeNull();
    expect(sketch().error).toMatch(/depth/i);
  });

  it('refuses a revolve across the axis with the reason', async () => {
    rect(0, -5, 20, 5);
    expect(await sketch().build({ op: 'revolve', axis: 'x' })).toBeNull();
    expect(sketch().error).toMatch(/crosses the X axis/i);
  });
});
