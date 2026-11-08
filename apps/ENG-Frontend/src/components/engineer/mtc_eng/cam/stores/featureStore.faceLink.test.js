import { describe, it, expect, beforeEach } from 'vitest';
import { useSketchStore } from './sketchStore.js';
import { useCamPlanStore } from './camPlanStore.js';
import { useFeatureStore } from './featureStore.js';
import { addPoint, addLine } from '../engine/sketch/model.js';

const sketch = () => useSketchStore.getState();
const features = () => useFeatureStore.getState();
const build = (opts) => features().buildFromSketch(opts);

beforeEach(() => {
  features().clear();
  sketch().clear();
  useSketchStore.setState({
    sketches: [{ id: 1, name: 'Sketch1', plane: { preset: 'XY', offset: 0 }, doc: sketch().sk }],
    activeId: 1,
    nextSketchId: 2,
    past: [], future: [], error: null,
  });
  useCamPlanStore.setState({ selectedFeature: null });
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

/** Pick the top of the part the way a viewport click does. */
const pickTop = (z, x0 = 0, y0 = 0, x1 = 40, y1 = 20) => useCamPlanStore.setState({
  selectedFeature: {
    normal: [0, 0, 1],
    centroid: [(x0 + x1) / 2, (y0 + y1) / 2, z],
    bounds: { min: [x0, y0, z], max: [x1, y1, z] },
    facing: 'up',
  },
});

describe('sketch on a feature’s face — follows the feature when it changes', () => {
  it('moves a sketch placed on the top of an extrude when the extrude gets deeper', async () => {
    rect(0, 0, 40, 20);
    await build({ op: 'extrude', depth: 10 });
    pickTop(10);
    const id = features().sketchOnFace();
    const plane = () => sketch().sketches.find((s) => s.id === id).plane;
    expect(plane()).toMatchObject({ preset: 'XY', offset: 10, ref: { axis: 'z', side: 'max' } });

    features().updateFeature(features().features[0].id, { depth: 25 });
    await features().rebuild();

    expect(plane().offset).toBe(25);
    // The rebuild's own write to the sketch must not leave the tree looking stale.
    expect(features().dirty).toBe(false);
  });

  it('builds the dependent feature ON the moved face, not at the old height', async () => {
    rect(0, 0, 40, 20);
    await build({ op: 'extrude', depth: 10 });
    pickTop(10);
    features().sketchOnFace();
    rect(10, 5, 20, 15);
    const joined = await build({ op: 'extrude', depth: 5, merge: 'add' });
    expect(joined.bounds.size[2]).toBeCloseTo(15, 3);

    features().updateFeature(features().features[0].id, { depth: 30 });
    const analysis = await features().rebuild();
    // A 30 deep base with the 5 mm boss standing on z=30, not floating at z=10.
    expect(analysis.bounds.size[2]).toBeCloseTo(35, 3);
  });

  it('leaves a face that is not an end of any feature on its numbers, as before', async () => {
    rect(0, 0, 40, 20);
    await build({ op: 'extrude', depth: 10 });
    pickTop(6);
    const id = features().sketchOnFace();
    const plane = sketch().sketches.find((s) => s.id === id).plane;
    expect(plane.offset).toBe(6);
    expect(plane.ref).toBeUndefined();
  });

  it('keeps the numbers when the feature it was linked to is suppressed', async () => {
    rect(0, 0, 40, 20);
    await build({ op: 'extrude', depth: 10 });
    pickTop(10);
    const id = features().sketchOnFace();
    const first = features().features[0];
    features().updateFeature(first.id, { depth: 25 });
    features().toggleSuppress(first.id);
    await features().rebuild();
    expect(sketch().sketches.find((s) => s.id === id).plane.offset).toBe(10);
  });

  it('returns null and links nothing when no face is picked', () => {
    expect(features().sketchOnFace()).toBeNull();
  });
});

describe('sketch on a face picked on the Sketch page', () => {
  it('uses the face it is handed, already in the frame the solids are built in', async () => {
    rect(0, 0, 40, 20);
    await build({ op: 'extrude', depth: 10 });
    const id = features().sketchOnFace({
      face: { normal: [0, 0, 1], centroid: [20, 10, 10], bounds: { min: [0, 0, 10], max: [40, 20, 10] }, facing: 'up' },
    });
    expect(sketch().sketches.find((s) => s.id === id).plane)
      .toMatchObject({ preset: 'XY', offset: 10, ref: { axis: 'z', side: 'max' } });
  });
});
