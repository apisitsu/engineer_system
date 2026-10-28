import { describe, it, expect } from 'vitest';
import {
  odHolderGeometry, boringBarGeometry, partingBladeGeometry, drillGeometry,
  markerYSpan, toolScale, offerToolToggle,
} from './latheTool.js';
import { STANDARD_TURN_TOOLS } from '../sim/turning.js';

describe('every lathe marker cuts on the spindle centre plane', () => {
  // The regression: the OD insert was mounted on the holder's side face and sat
  // entirely at positive Y — 1 to 5 mm clear of the plane where the cut happens.
  it.each(STANDARD_TURN_TOOLS.map((t) => [t.id, t]))('%s has its cutting corner at Y=0', (_id, tool) => {
    const [lo, hi] = markerYSpan(tool.kind, 1.6, tool);
    expect(hi).toBe(0);
    expect(lo).toBeLessThan(0);
  });

  it('hangs the OD holder below the plane, never above it', () => {
    const g = odHolderGeometry(1.6, { sides: 4, angle: 35, lead: 93 });
    expect(g.depth).toBeGreaterThan(0);
    // Insert body spans [insertY − thickY/2, insertY + thickY/2]; its top is the
    // rake face and must land exactly on Y=0.
    const { thickY } = toolScale(1.6);
    expect(g.insertY + thickY / 2).toBeCloseTo(0, 12);
    expect(g.insertY - thickY / 2).toBeLessThan(0);
  });

  it('seats the OD holder body under the rake face rather than flush with it', () => {
    // Flush meant coplanar, and coplanar meant the insert and the holder took
    // turns winning the depth test — the tool flickered gold/grey as it moved.
    const { thickY, standout } = toolScale(1.6);
    const g = odHolderGeometry(1.6, { sides: 4, angle: 35, lead: 93 });
    expect(standout).toBeGreaterThan(0);
    expect(g.bodyY).toBe(-standout);
    // Still an insert seated in a pocket, not one balanced on top of the holder.
    expect(standout).toBeLessThan(thickY / 2);
  });

  it('sets the holder back from the cutting corner, so only the insert reaches it', () => {
    // The head's walls run along the insert's two edges. Left at the tip they
    // were coplanar with the insert's flanks for the whole height of the head.
    const { standout } = toolScale(1.6);
    const g = odHolderGeometry(1.6, { sides: 4, angle: 35, lead: 93 });
    for (const [x] of g.outline) expect(x).toBeGreaterThanOrEqual(standout - 1e-9);
  });

  it('lets only the clamp screw stand proud of the rake face', () => {
    const g = odHolderGeometry(1.6, {});
    // A screw head sits above the face by design; nothing else may.
    expect(g.screwY + g.screwH / 2).toBeGreaterThan(0);
    expect(g.screwY - g.screwH / 2).toBeLessThan(0);
  });

  it('puts the boring bar under the plane too, with its insert on it', () => {
    const { standout } = toolScale(1.6);
    const g = boringBarGeometry(1.6, {});
    // The insert reaches the plane; the bar's crown clears it, so the two are
    // not tangent along a line the depth buffer would have to arbitrate.
    expect(g.insertY + g.insert.thickY / 2).toBeCloseTo(0, 12);
    expect(g.barY + g.barRadius).toBeCloseTo(-standout, 12);
  });

  it('seats the boring bar insert against the bar face, with no gap', () => {
    // The regression: the insert's z was hardcoded in Viewport.jsx, landing
    // its far corner right at barRadius with no margin — any rounding either
    // way showed as a visible gap between the insert and the holder.
    for (const [sides, angle] of [[4, 35], [4, 60], [3, 60]]) {
      const g = boringBarGeometry(1.6, { sides, angle });
      const reach = g.insert.r * Math.SQRT1_2;
      expect(g.insert.z + reach).toBeGreaterThan(g.barRadius);
    }
  });

  it('puts the parting blade under the plane', () => {
    const { standout } = toolScale(1.6);
    const g = partingBladeGeometry(1.6, { grooveW: 3 });
    // Same again: the cutting tip is on the plane, the blade behind it is not.
    expect(g.tipY + (g.depth * 1.02) / 2).toBeCloseTo(0, 12);
    expect(g.bladeY + g.depth / 2).toBeCloseTo(-standout, 12);
  });

  it('draws its width true to scale with grooveW — the bug this exists for', () => {
    // `width` is the one real, measured dimension here: it is the kerf,
    // and `turningGrooveWidthResolver` carves exactly this many mm wide.
    // Running it through `toolScale()`'s proportional blow-up (as every
    // other dimension here still is) drew a groove narrower than the one
    // actually cut, whatever the marker radius.
    expect(partingBladeGeometry(1.6, { grooveW: 3 }).width).toBeCloseTo(3, 6);
    expect(partingBladeGeometry(1.6, { grooveW: 4.5 }).width).toBeCloseTo(4.5, 6);
    expect(partingBladeGeometry(0.8, {}).width).toBeCloseTo(3, 6); // default
  });
});

describe('OD holder silhouette', () => {
  it('starts on the tool position\'s own line, a hair back from the corner', () => {
    // The apex is on Z=0 — the holder is still pointed at the cutting corner and
    // not offset sideways — but it stops `standout` short of it, leaving the
    // corner to the insert.
    const g = odHolderGeometry(1.6, {});
    expect(g.outline[0]).toEqual([toolScale(1.6).standout, 0]);
  });

  it('reads as one family: same shank width and height for every insert angle', () => {
    const widths = new Set();
    const heights = new Set();
    for (const angle of [35, 55, 80]) {
      const g = odHolderGeometry(1.6, { sides: 4, angle, lead: 93, flip: true });
      widths.add(g.shankWidth.toFixed(6));
      heights.add(g.height.toFixed(6));
    }
    expect(widths.size).toBe(1);
    expect(heights.size).toBe(1);
  });

  it('produces a finite, non-degenerate outline for every tool actually drawn with it', () => {
    // Only 'od' (and, loosely, 'boring' — its own geometry doesn't share this
    // math, but its angles happen to live in the same safe range) ever reach
    // odHolderGeometry in the real app; `LatheTool` routes 'drill' to
    // `drillGeometry` instead. A 'drill' entry's angle is a literal tool
    // angle (118° for a twist drill) and is *expected* to be unsafe here —
    // see the catalogue's own comment — so it is deliberately excluded
    // rather than constraining real drill angles to stay odHolderGeometry-safe.
    for (const tool of STANDARD_TURN_TOOLS.filter((t) => t.kind !== 'drill')) {
      const g = odHolderGeometry(1.6, tool);
      expect(g.outline).toHaveLength(5);
      for (const [x, z] of g.outline) {
        expect(Number.isFinite(x)).toBe(true);
        expect(Number.isFinite(z)).toBe(true);
      }
      // The head must have real height, or the wedge collapses.
      expect(g.outline[1][0]).toBeGreaterThan(0);
      expect(g.height).toBeGreaterThan(g.outline[1][0]);
    }
  });

  it('mirrors the insert when the holder is flipped', () => {
    const a = odHolderGeometry(1.6, { sides: 4, angle: 35, lead: 93, flip: false });
    const b = odHolderGeometry(1.6, { sides: 4, angle: 35, lead: 93, flip: true });
    expect(Math.sign(a.insert.rot)).toBe(-Math.sign(b.insert.rot));
  });

  it('scales with the marker radius', () => {
    const small = odHolderGeometry(0.5, {});
    const big = odHolderGeometry(3, {});
    expect(big.height).toBeGreaterThan(small.height);
    expect(big.depth).toBeGreaterThan(small.depth);
  });
});

describe('drillGeometry — a coaxial axial tool, not a boring bar', () => {
  it('stays on the spindle axis: nothing here is offset in X the way a boring bar is', () => {
    // drillGeometry itself never returns an X offset — the marker's tip and
    // shaft are both built centred on X=0 in Viewport.jsx. This is the
    // property that distinguishes it from boringBarGeometry, whose insert
    // and bar are both deliberately shifted sideways.
    const g = drillGeometry(1.6, { angle: 118 });
    expect(g).not.toHaveProperty('barRadius'); // not a boring bar in disguise
    expect(g.shaftRadius).toBeGreaterThan(0);
  });

  it('does not go singular as the angle passes 90°, unlike odHolderGeometry', () => {
    // The whole reason this shape exists instead of reusing the OD/boring
    // one: a real twist drill is ~118°, which drove odHolderGeometry's head
    // height to blow up (see the catalogue's own comment on this).
    for (const angle of [45, 90, 118, 150]) {
      const g = drillGeometry(1.6, { angle });
      expect(Number.isFinite(g.tipHeight)).toBe(true);
      expect(g.tipHeight).toBeGreaterThan(0);
    }
  });

  it('a wider included angle makes a shorter, blunter tip', () => {
    const sharp = drillGeometry(1.6, { angle: 45 });
    const blunt = drillGeometry(1.6, { angle: 118 });
    expect(blunt.tipHeight).toBeLessThan(sharp.tipHeight);
  });

  it('scales with the marker radius', () => {
    const small = drillGeometry(0.5, { angle: 118 });
    const big = drillGeometry(3, { angle: 118 });
    expect(big.shaftRadius).toBeGreaterThan(small.shaftRadius);
    expect(big.shaftLength).toBeGreaterThan(small.shaftLength);
  });

  it('draws true to scale — the bug this exists for', () => {
    // Unlike the OD/boring/parting markers, which run `radius` through
    // `toolScale()`'s proportional blow-up, a drill's radius *is* the hole
    // it cuts: `turningCutRadiusResolver` carves this exact number. A
    // decorated shaft drew visibly narrower than the bore around it (a
    // ⌀8.5 drill's bore reaches 4.25, but the old formula drew a ⌀1.8 bit).
    expect(drillGeometry(4.25, { angle: 118 }).shaftRadius).toBeCloseTo(4.25, 6);
    expect(drillGeometry(0.8, { angle: 118 }).shaftRadius).toBeCloseTo(0.8, 6);
  });

  it('markerYSpan reaches exactly 0 — the apex, which needs no standout of its own', () => {
    const [lo, hi] = markerYSpan('drill', 1.6, { angle: 118 });
    expect(hi).toBe(0);
    expect(lo).toBeLessThan(0);
  });
});

describe('offerToolToggle', () => {
  it('is offered for turning', () => {
    expect(offerToolToggle({ mode: 'turn' })).toBe(true);
  });

  it('is withheld for milling — that is what the arbor toggle is for', () => {
    expect(offerToolToggle({ mode: 'mill' })).toBe(false);
  });

  it('is withheld on the sketch page, where there is no tool', () => {
    expect(offerToolToggle({ mode: 'turn', sketching: true })).toBe(false);
  });
});
