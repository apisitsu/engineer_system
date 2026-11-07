import { describe, it, expect } from 'vitest';
import {
  translate, orientToNormal, angleToFaceUp, pointToRawFrame, pointFromRawFrame,
  displayedPointToRawFrame, applyDatum, originFromAxisPick, originFromAxisValue,
  originFromAxisOffset, toggledFlip,
} from './datum.js';
import { boundsOf, meshVolume, shellReport } from './analyze.js';
import { reorient } from './orient.js';
import { rotateAboutX } from './rotate.js';
import { weld } from './stl.js';
import { box, steppedShaft } from './fixtures.js';

describe('translate', () => {
  it('moves the chosen point to exactly the origin', () => {
    const m = weld(box(10, 20, 30));
    const point = [3, -4, 5];
    const out = translate(m, point);
    // Every vertex shifted by the same amount, so the box's own centre — at
    // (0,0,0) before the shift — now sits at -point.
    const b = boundsOf(out);
    expect(b.center[0]).toBeCloseTo(-3, 6);
    expect(b.center[1]).toBeCloseTo(4, 6);
    expect(b.center[2]).toBeCloseTo(-5, 6);
  });

  it('leaves normals untouched', () => {
    const m = weld(box());
    const out = translate(m, [1, 2, 3]);
    expect(out.normals).toBe(m.normals);
  });

  it('is a no-op for a zero offset, returning the same mesh', () => {
    const m = weld(box());
    expect(translate(m, [0, 0, 0])).toBe(m);
  });
});

describe('orientToNormal', () => {
  const cardinal = [
    [1, 0, 0], [-1, 0, 0],
    [0, 1, 0], [0, -1, 0],
    [0, 0, 1], [0, 0, -1],
  ];

  it('maps every cardinal face normal to +Z, preserving volume and winding', () => {
    for (const normal of cardinal) {
      const m = weld(box(20, 30, 40));
      const before = meshVolume(m);
      const o = orientToNormal(normal);

      // Re-derive the transformed normal the same way reorient() would.
      const transformedNormal = [0, 1, 2].map((k) => normal[o.order[k]] * o.signs[k]);
      expect(transformedNormal[2]).toBeCloseTo(1, 6);
      expect(transformedNormal[0]).toBeCloseTo(0, 6);
      expect(transformedNormal[1]).toBeCloseTo(0, 6);

      const r = o.changed ? reorient(m, o) : m;
      expect(meshVolume(r)).toBeCloseTo(before, 3);
      expect(Math.sign(meshVolume(r))).toBe(Math.sign(before));
      expect(shellReport(r).watertight).toBe(true);
    }
  });

  it('is a no-op when the normal already points +Z', () => {
    const o = orientToNormal([0, 0, 1]);
    expect(o.changed).toBe(false);
    expect(o.order).toEqual([0, 1, 2]);
  });
});

describe('angleToFaceUp', () => {
  const rotateNormal = (n, angle) => {
    const mesh = { positions: new Float32Array(n), triangleCount: 1 };
    return Array.from(rotateAboutX(mesh, angle).positions);
  };

  it('is zero when the normal already points at +Z', () => {
    expect(angleToFaceUp([0, 0, 1])).toBe(0);
  });

  it('is zero for a normal with no Y/Z component — an end face, not a side', () => {
    expect(angleToFaceUp([1, 0, 0])).toBe(0);
  });

  it('finds the angle that rotates any Y/Z-bearing normal onto +Z', () => {
    const normals = [[0, 1, 0], [0, -1, 0], [0, 1, 1], [0.3, -1, 0.4], [0, -1, -1]];
    for (const n of normals) {
      const angle = angleToFaceUp(n);
      const [, y, z] = rotateNormal(n, angle);
      const len = Math.hypot(y, z);
      expect(y / len).toBeCloseTo(0, 5);
      expect(z / len).toBeGreaterThan(0.999);
    }
  });
});

describe('pointToRawFrame', () => {
  it('round-trips through orientToNormal for every cardinal normal', () => {
    const cardinal = [
      [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
    ];
    for (const normal of cardinal) {
      const o = orientToNormal(normal);
      const raw = [7, -3, 11];
      const displayed = [0, 1, 2].map((k) => raw[o.order[k]] * o.signs[k]);
      const back = pointToRawFrame(displayed, o);
      expect(back[0]).toBeCloseTo(raw[0], 6);
      expect(back[1]).toBeCloseTo(raw[1], 6);
      expect(back[2]).toBeCloseTo(raw[2], 6);
    }
  });

  it('is the identity with no orientation', () => {
    expect(pointToRawFrame([1, 2, 3], null)).toEqual([1, 2, 3]);
  });

  it('round-trips through a permutation *and* a picked A0 angle together', () => {
    const o = { ...orientToNormal([0, -1, 0]), angle: 137 };
    const raw = [7, -3, 11];
    const displayed = pointFromRawFrame(raw, o);
    const back = pointToRawFrame(displayed, o);
    expect(back[0]).toBeCloseTo(raw[0], 6);
    expect(back[1]).toBeCloseTo(raw[1], 6);
    expect(back[2]).toBeCloseTo(raw[2], 6);
  });

  it.each([
    [[true, true, false]],
    [[false, true, true]],
    [[true, false, true]],
  ])('round-trips through a permutation, an A0 angle, and flip %j all together', (flip) => {
    const o = { ...orientToNormal([0, -1, 0]), angle: 42, flip };
    const raw = [7, -3, 11];
    const displayed = pointFromRawFrame(raw, o);
    const back = pointToRawFrame(displayed, o);
    expect(back[0]).toBeCloseTo(raw[0], 6);
    expect(back[1]).toBeCloseTo(raw[1], 6);
    expect(back[2]).toBeCloseTo(raw[2], 6);
  });
});

describe('displayedPointToRawFrame', () => {
  it('undoes both a previous shift and the orientation, not just the orientation', () => {
    const o = orientToNormal([0, -1, 0]); // a non-trivial reorientation
    const rawPreviousDatum = [2, -1, 4];
    // What a point at rawTarget would look like on screen, given the mesh has
    // already been reoriented *and* shifted by the previous datum.
    const rawTarget = [9, -6, 3];
    const orientedTarget = pointFromRawFrame(rawTarget, o);
    const orientedShift = pointFromRawFrame(rawPreviousDatum, o);
    const displayed = orientedTarget.map((v, i) => v - orientedShift[i]);

    const recovered = displayedPointToRawFrame(displayed, o, rawPreviousDatum);
    expect(recovered[0]).toBeCloseTo(rawTarget[0], 6);
    expect(recovered[1]).toBeCloseTo(rawTarget[1], 6);
    expect(recovered[2]).toBeCloseTo(rawTarget[2], 6);
  });

  it('is a plain orientation inverse when no datum is active yet', () => {
    const o = orientToNormal([1, 0, 0]);
    const rawTarget = [5, 6, 7];
    const displayed = pointFromRawFrame(rawTarget, o);
    const recovered = displayedPointToRawFrame(displayed, o, null);
    expect(recovered[0]).toBeCloseTo(rawTarget[0], 6);
    expect(recovered[1]).toBeCloseTo(rawTarget[1], 6);
    expect(recovered[2]).toBeCloseTo(rawTarget[2], 6);
  });
});

describe('per-axis origin (touch off one axis at a time)', () => {
  // The frame the numeric fields read in: displayed origin = pointFromRawFrame.
  const shown = (raw, o) => (raw ? pointFromRawFrame(raw, o) : [0, 0, 0]);

  describe('originFromAxisValue', () => {
    it('sets one axis and leaves the other two untouched', () => {
      let p = originFromAxisValue(null, null, 2, 10);
      expect(shown(p, null)).toEqual([0, 0, 10]);
      p = originFromAxisValue(p, null, 0, 5);
      expect(shown(p, null)).toEqual([5, 0, 10]); // Z survived the X pick
      p = originFromAxisValue(p, null, 1, -3);
      expect(shown(p, null)).toEqual([5, -3, 10]);
    });

    it('overwrites the same axis rather than accumulating', () => {
      let p = originFromAxisValue(null, null, 2, 10);
      p = originFromAxisValue(p, null, 2, 4);
      expect(shown(p, null)[2]).toBe(4);
    });

    it('never reorients — only the origin moves, through the lay-down frame', () => {
      // A non-trivial permutation, the kind the automatic lay-down produces.
      const o = orientToNormal([0, -1, 0]);
      let p = originFromAxisValue(null, o, 2, 7);
      expect(shown(p, o)[2]).toBeCloseTo(7, 6);
      expect(shown(p, o)[0]).toBeCloseTo(0, 6);
      expect(shown(p, o)[1]).toBeCloseTo(0, 6);
      // Setting X must not disturb the Z already set.
      p = originFromAxisValue(p, o, 0, 9);
      expect(shown(p, o)[0]).toBeCloseTo(9, 6);
      expect(shown(p, o)[2]).toBeCloseTo(7, 6);
    });
  });

  describe('originFromAxisPick', () => {
    it('moves an axis zero by the click offset, one axis only', () => {
      // No origin yet: clicking sets that axis to the clicked coordinate.
      let p = originFromAxisPick(null, null, 2, [3, 4, 5]);
      expect(shown(p, null)).toEqual([0, 0, 5]);
      // A second pick on X: its click is read in the frame already shifted on Z,
      // so only X moves.
      p = originFromAxisPick(p, null, 0, [7, 1, 2]);
      expect(shown(p, null)).toEqual([7, 0, 5]);
    });

    it('adds to an axis already set (relative to the current origin)', () => {
      let p = originFromAxisValue(null, null, 2, 10);
      p = originFromAxisPick(p, null, 2, [0, 0, 2]);
      expect(shown(p, null)[2]).toBe(12);
    });
  });
});

describe('toggledFlip', () => {
  it.each([
    [0, [true, true, false]],
    [1, [false, true, true]],
    [2, [true, false, true]],
  ])('axis %i reverses itself and the next axis', (axis, expected) => {
    expect(toggledFlip([false, false, false], axis)).toEqual(expected);
  });

  it('never leaves an odd number of axes reversed, which would be a mirror', () => {
    let flip = [false, false, false];
    for (const axis of [0, 1, 2, 2, 0, 1, 1]) {
      flip = toggledFlip(flip, axis);
      expect(flip.filter(Boolean).length % 2).toBe(0);
    }
  });

  it('undoes itself', () => {
    expect(toggledFlip(toggledFlip([true, true, false], 1), 1)).toEqual([true, true, false]);
  });
});

describe('offset from the picked plane', () => {
  // Nothing laid down, so the displayed and raw frames agree.
  const identity = null;

  it('adds the distance to a pick along that axis only', () => {
    const p = originFromAxisPick([1, 2, 0], identity, 2, [9, 9, 10], 0.5);
    expect(p).toEqual([1, 2, 10.5]);
  });

  it('moves the origin by the change, not by the whole value', () => {
    const first = originFromAxisOffset([0, 0, 10], [0, 0, 0], identity, 2, 0.5);
    expect(first.point[2]).toBeCloseTo(10.5);
    const second = originFromAxisOffset(first.point, first.offset, identity, 2, 1);
    expect(second.point[2]).toBeCloseTo(11);
    expect(second.offset[2]).toBeCloseTo(1);
    const cleared = originFromAxisOffset(second.point, second.offset, identity, 2, 0);
    expect(cleared.point[2]).toBeCloseTo(10);
  });

  it('leaves the other axes alone', () => {
    const { point, offset } = originFromAxisOffset([3, 4, 5], [0.1, 0.2, 0], identity, 2, 1);
    expect(point.slice(0, 2)).toEqual([3, 4]);
    expect(offset.slice(0, 2)).toEqual([0.1, 0.2]);
  });

  it('works when nothing has been picked yet', () => {
    const { point, offset } = originFromAxisOffset(null, null, identity, 0, 2);
    expect(point).toEqual([2, 0, 0]);
    expect(offset).toEqual([2, 0, 0]);
  });

  it('reads along the displayed axis on a part that was laid down and flipped', () => {
    const orientation = { ...orientToNormal([0, -1, 0]), flip: [false, true, true] };
    const { point, offset } = originFromAxisOffset(null, null, orientation, 2, 3);
    expect(pointFromRawFrame(point, orientation)[2]).toBeCloseTo(3);
    expect(pointFromRawFrame(offset, orientation)[2]).toBeCloseTo(3);
    expect(pointFromRawFrame(point, orientation)[0]).toBeCloseTo(0);
  });
});

describe('applyDatum', () => {
  it('with no plane picked, falls back to the automatic lay-down decision', () => {
    // Already the shortest-on-Z layout automatic orientation wants, so the
    // mesh passes through untouched — this is the "feature not used" case.
    const soup = box(60, 40, 10);
    const welded = weld(soup);
    const r = applyDatum({ soup, welded }, { planeNormal: null, point: null }, { mode: 'mill' });
    expect(r.soup).toBe(soup);
    expect(r.welded).toBe(welded);
    expect(r.orientation.changed).toBe(false);
  });

  it('a point with no plane still gets the automatic orientation applied first', () => {
    // Standing on end: automatic lay-down puts the shortest axis on Z before
    // the translation happens, so the picked point must be converted through
    // that orientation, not applied in the raw (standing) frame.
    const soup = box(18, 17, 67); // shortest (17mm) is raw Y here, not yet on Z
    const welded = weld(soup);
    const r = applyDatum(
      { soup, welded },
      { planeNormal: null, point: [0, 8.5, 0] }, // the top of the shortest face, in the raw frame
      { mode: 'mill' },
    );
    expect(r.orientation.changed).toBe(true);
    const b = boundsOf(r.welded);
    // The shortest axis (17mm) is now Z, with the picked face at its top.
    expect(b.max[2]).toBeCloseTo(0, 3);
    expect(b.min[2]).toBeCloseTo(-17, 3);
  });

  it('rotates a picked A0 face onto +Z, independent of the plane pick', () => {
    // The part already lies flat (Z is the shortest axis) — but the operator
    // wants the +Y face, not the current top, to read as A0.
    const soup = box(120, 30, 20);
    const welded = weld(soup);
    const r = applyDatum(
      { soup, welded },
      { planeNormal: null, rotaryZero: [0, 1, 0], point: null },
      { mode: 'mill' },
    );
    expect(r.orientation.angle).toBeCloseTo(270, 3);
    const b = boundsOf(r.welded);
    // The +Y face's half-width (30/2) is now the Z extreme; the old Z
    // half-depth (20/2) is now the Y extreme — the two axes swapped places.
    expect(b.max[2]).toBeCloseTo(15, 3);
    expect(b.max[1]).toBeCloseTo(10, 3);
  });

  // An offset part, so a turn visibly lands somewhere new: x 0..120, y 0..30, z 0..20.
  const cornered = () => translate(box(120, 30, 20), [-60, -15, -10]);

  it.each([
    ['X and Y', [true, true, false], { min: [-120, -30, 0], max: [0, 0, 20] }],
    ['Y and Z', [false, true, true], { min: [0, -30, -20], max: [120, 0, 0] }],
    ['Z and X', [true, false, true], { min: [-120, 0, -20], max: [0, 30, 0] }],
  ])('a flip of %s is a 180° turn, not a mirror', (_, flip, expected) => {
    const soup = cornered();
    const welded = weld(soup);
    const before = meshVolume(welded);
    const r = applyDatum({ soup, welded }, { flip, point: null }, { mode: 'mill' });
    expect(r.orientation.flip).toEqual(flip);
    expect(r.orientation.changed).toBe(true);
    // Proper rotation: same volume and winding, not flipped into a mirror image.
    expect(meshVolume(r.welded)).toBeCloseTo(before, 3);
    expect(Math.sign(meshVolume(r.welded))).toBe(Math.sign(before));
    expect(shellReport(r.welded).watertight).toBe(true);

    const b = boundsOf(r.welded);
    for (let i = 0; i < 3; i += 1) {
      expect(b.min[i]).toBeCloseTo(expected.min[i], 3);
      expect(b.max[i]).toBeCloseTo(expected.max[i], 3);
    }
  });

  it('turns about the picked origin, so the origin stays on the same spot of the part', () => {
    const soup = cornered();
    const welded = weld(soup);
    // The top face at Z0: flipping Z leaves that face on Z0 with the part above it.
    const r = applyDatum(
      { soup, welded },
      { flip: [true, false, true], point: [0, 0, 20] },
      { mode: 'mill' },
    );
    const b = boundsOf(r.welded);
    expect(b.min[2]).toBeCloseTo(0, 3);
    expect(b.max[2]).toBeCloseTo(20, 3);
  });

  it('says so in the setup note, because a flip can turn the part upside down', () => {
    const soup = cornered();
    const r = applyDatum({ soup, welded: weld(soup) }, { flip: [false, true, true] }, { mode: 'mill' });
    expect(r.orientation.description).toMatch(/Y and Z read reversed/);
  });

  it('still honours a project saved with the old reverseX flag', () => {
    const soup = cornered();
    const welded = weld(soup);
    const r = applyDatum({ soup, welded }, { reverseX: true, point: null }, { mode: 'mill' });
    expect(r.orientation.flip).toEqual([true, true, false]);
    expect(boundsOf(r.welded).max[0]).toBeCloseTo(0, 3);
  });

  it('relocates the origin to a picked point and stands a side face up', () => {
    const soup = steppedShaft();
    const welded = weld(soup);
    // The +X face of the fixture, picked at a point away from the centreline.
    const point = [10, 0, 5];
    const r = applyDatum({ soup, welded }, { planeNormal: [1, 0, 0], point }, { mode: 'mill' });
    const b = boundsOf(r.welded);
    // The picked point is now the origin, so it must sit on the mesh's shell,
    // i.e. one of the bounds touches (0,0,0) rather than straddling it.
    expect(Math.min(...b.min.map(Math.abs), ...b.max.map(Math.abs))).toBeLessThan(1e-3);
  });

  it('for turning, only translates — never reorients', () => {
    const soup = steppedShaft();
    const welded = weld(soup);
    const r = applyDatum(
      { soup, welded },
      { planeNormal: [1, 0, 0], point: [0, 0, 5] },
      { mode: 'turn' },
    );
    expect(r.orientation).toBe(null);
    const b = boundsOf(r.welded);
    expect(b.min[2] + 5).toBeCloseTo(boundsOf(welded).min[2], 4);
  });
});
