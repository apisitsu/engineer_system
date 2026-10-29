/**
 * Lathe tool-marker geometry — the numbers behind the OD holder, boring bar and
 * parting blade, separated from the meshes that draw them.
 *
 * Turning cuts in the plane through the spindle axis (Y = 0), so **every marker's
 * cutting corner sits at Y = 0 with the body hanging below it**: the insert's
 * rake face is the top. Getting that wrong is invisible in a screenshot but
 * obvious in a number, which is why it lives here — the insert was once mounted
 * on the holder's side face and floated 1–5 mm clear of the plane it cuts in.
 *
 * ## Why the insert stands proud (`standout`)
 *
 * The insert used to sit exactly flush in its seat: its rake face on Y = 0 and
 * the holder's top face on Y = 0 as well, and the head's bevelled walls lying
 * *along* the insert's own two edges. Every one of those is a pair of
 * **coplanar** faces, and a depth buffer cannot order two surfaces at the same
 * depth — so the insert and the holder took turns winning, pixel by pixel, and
 * the tool flickered between gold and grey as the view moved. It reads as a
 * rendering fault, which it is, and no amount of re-colouring fixes it.
 *
 * A real insert is not flush either: it stands out of its pocket, which is what
 * lets it cut. So the *body* is dropped `standout` below the cutting plane and
 * recessed the same amount radially behind the insert's corner. The insert keeps
 * Y = 0 — the invariant above is untouched, and it is the insert that cuts.
 */

const DEG = Math.PI / 180;

/**
 * Shared sizes, from the marker radius the viewport passes in.
 *
 * `standout` is how far the insert stands out of its seat — small enough to look
 * like a seated insert, large enough that no viewing angle brings the two
 * surfaces within the depth buffer's resolution.
 */
export function toolScale(radius) {
  const s = Math.max(radius * 7, 6);
  const thickY = Math.max(radius * 2.4, 1.8);
  return { s, thickY, standout: thickY * 0.16 };
}

/**
 * OD turning holder. Returns the extruded silhouette (in the X-Z profile plane,
 * tip at the origin), the depth it hangs down −Y, and where the insert and its
 * clamp screw sit.
 *
 * The insert sits at the lead angle: its long diagonal is rotated `t` from
 * vertical (`t` = lead + angle/2 − 90, mirrored by `flip`). The shank stays
 * vertical; only its head is bevelled to the insert's two edges, so the tip juts
 * past the shank's front face on its own.
 */
export function odHolderGeometry(radius = 0.8, shape = {}) {
  const { s, thickY, standout } = toolScale(radius);
  const sides = shape.sides ?? 4;
  const angle = shape.angle ?? 35;
  const lead = shape.lead ?? 93;
  const flip = !!shape.flip;
  const r = s * 0.62;
  // tan(angle/2) is the insert's own half-nose-angle ratio — true of a pointed
  // diamond (sides: 4) exactly as much as a pointed V (sides: 3, the threading
  // tool/bar): both are a corner with two flanks at `angle` to each other. The
  // old `sides === 4` gate left every non-diamond insert at a hard-coded 1 —
  // for a 60°-V threading tool that is ~1.7× its real tan(30°) ≈ 0.577 — which
  // swung the holder's `shift` (below) the wrong way in Z on a flipped holder,
  // pointing the shank back toward the chuck instead of away from it.
  const zScale = Math.max(Math.tan((angle / 2) * DEG), 0.2);
  const depth = thickY * 1.5;

  const sgn = flip ? -1 : 1;
  const t = sgn * ((lead + angle / 2) * DEG - Math.PI / 2);
  const ct = Math.cos(t);
  const st = Math.sin(t);
  const insert = { x: r * ct, z: -r * st, rot: t, r, thickY, zScale, sides };

  // Ratios of Z gained per unit up the shank along the insert's trailing (+Z)
  // and leading (−Z) edges; the head bevels follow them.
  const eX = ct + zScale * st;
  const eZ = zScale * ct - st;
  const fX = ct - zScale * st;
  const fZ = -zScale * ct - st;
  const ratioBack = Math.abs(eX) > 1e-4 ? eZ / eX : 0;
  const ratioFront = Math.abs(fX) > 1e-4 ? fZ / fX : 0;
  const span = Math.max(ratioBack - ratioFront, 0.2);

  const W = s * 1.1;
  const topX = s * 5.0;          // fixed holder height, same for every insert
  const Xbot = W / span;         // head height → shank width stays W across angles
  const shift = flip ? Math.max(0, r * fZ - Xbot * ratioFront) : 0;
  const Zf = Xbot * ratioFront + shift;
  const Zb = Xbot * ratioBack + shift;

  return {
    depth,
    // Silhouette in (x = radial, y = along Z), apex first. The whole wedge is
    // pushed `standout` radially outward, so its walls run parallel to the
    // insert's two edges but a hair behind them and its apex stops short of the
    // cutting corner — the insert's corner is the tip of the tool, on its own.
    outline: [
      [standout, 0], [Xbot + standout, Zf], [topX, Zf], [topX, Zb], [Xbot + standout, Zb],
    ],
    insert,
    // Y placement: the insert's rake face is the cutting plane, and the body it
    // is seated in hangs from `standout` below that face down to `bodyY - depth`.
    insertY: -thickY / 2,
    bodyY: -standout,
    standout,
    screwY: 0,
    screwR: s * 0.16,
    screwH: thickY * 0.4,
    shankWidth: W,
    height: topX,
  };
}

/**
 * Boring bar: a round shank along +Z with a small insert at the tip.
 *
 * The insert's own `x`/`z` are computed here, not left for `Viewport.jsx` to
 * place inline the way an earlier version of this did — the file's own
 * header says every number lives here *because* it's tested, and an inline
 * position in the component is exactly the untested exception that slips
 * past that. It mattered in practice: the insert is a `sides`-gon rotated
 * 45° about its own axis (so a square insert reads as a diamond), and its
 * reach toward the bar is `r·cos(45°)` — the old inline position landed
 * that reach barely at `barRadius`, with no margin for rounding either way,
 * which is how it read as a visible gap rather than a seated insert.
 */
export function boringBarGeometry(radius = 0.8, shape = {}) {
  const { s, thickY, standout } = toolScale(radius);
  const sides = shape.sides ?? 4;
  const angle = shape.angle ?? 35;
  const r = s * 0.42;
  const barRadius = s * 0.55;
  // How far the insert's own corner reaches toward +Z from its centre, once
  // rotated 45° about Y — exact for the sides=4 case this always ships with;
  // a generic sides-gon's reach varies with its own rotation, but Math.SQRT1_2
  // (≈cos 45°) is the worst case among the vertices, so it never overshoots.
  const reach = r * Math.SQRT1_2;
  return {
    barRadius,
    barLength: s * 6,
    // The bar's crown clears the cutting plane by `standout`, so the insert's
    // rake face is not tangent to it — a cylinder touching a plane along a line
    // fights for that line exactly as two coplanar faces do.
    barY: -(barRadius + standout),
    insert: {
      r,
      thickY,
      sides,
      // Same fix as odHolderGeometry's zScale: a pointed insert's half-nose
      // angle, not a hard-coded 1 for anything that isn't a 4-sided diamond.
      zScale: Math.max(Math.tan((angle / 2) * DEG), 0.2),
      x: -r * 0.4,
      // Positioned so the insert's own far corner lands `0.3·reach` *past*
      // the bar's face (z = barRadius + 0.3·reach), not just touching it — a
      // real insert sits in its pocket, overlapping the holder, and that
      // margin is what survives the rounding a bare "just touching" position
      // does not.
      z: barRadius - reach * 0.7,
    },
    insertY: -thickY / 2,
    standout,
  };
}

/**
 * A coaxial axial tool — a drill, reamer, tap or centre drill — on the
 * spindle centreline: a straight round shaft along +Z ending in a pointed
 * tip, **not** a boring bar's offset shank. A boring bar reaches into a bore
 * from one side, which is why its geometry shifts sideways in X as well as
 * dropping in Y; a drill's own axis *is* the spindle axis, so it stays on
 * X = 0 and only the tip's point angle changes its silhouette.
 *
 * `angle` is a literal tool point angle here, not an insert-corner angle like
 * the OD/boring markers use — a twist drill really is ~118°, and nothing
 * about this shape goes singular as the angle passes 90° the way
 * `odHolderGeometry`'s does (see the comment on the catalogue entries), so
 * the real angle can be used directly.
 *
 * No `standout` drop, unlike every other marker here: that trick exists for
 * a *flat* face sitting coplanar with another flat face (an insert's rake
 * face against the cutting plane) — a drill's tip is a single vertex and its
 * shaft a curved surface, neither of which can coplanar-fight anything. The
 * first version of this dropped the shaft only, leaving the cone sitting flush
 * at the join — the step between the two read as a blunt, rounded cap
 * instead of a point, not a subtle depth-fight at all.
 */
export function drillGeometry(radius = 0.8, shape = {}) {
  // True to scale with `radius` itself — unlike the OD/boring/parting markers,
  // which run it through `toolScale()`'s proportional blow-up (that `radius`
  // is a small nose-radius-like number, not a real dimension). A drill's
  // radius *is* the hole it cuts (`turningCutRadiusResolver` carves the same
  // number), so scaling it up here would draw a bit visibly narrower than the
  // bore it is shown making.
  const shaftRadius = Math.max(radius, 0.25);
  const angle = shape.angle ?? 118;
  const tipHeight = shaftRadius / Math.max(Math.tan((angle / 2) * DEG), 0.05);
  return { shaftRadius, shaftLength: Math.max(shaftRadius * 8, 5), tipHeight };
}

/** Parting / grooving blade: a thin tall plate down to a narrow edge. */
export function partingBladeGeometry(radius = 0.8, shape = {}) {
  const { s, standout } = toolScale(radius);
  const depth = Math.max(radius * 2.4, 1.8) * 1.4;
  return {
    // True to scale with `grooveW` — this is the one dimension of the blade
    // that is a real, measured number rather than a decorated drawing: it
    // is the kerf, and `turningGrooveWidthResolver` carves exactly this wide.
    // Scaling it by `toolScale()`'s proportional factor (as every other
    // dimension here still is) drew a groove on the marker visibly narrower
    // than the one actually cut.
    width: Math.max(shape.grooveW ?? 3, 0.3),
    height: s * 5,
    depth,
    // Blade top `standout` under the plane; the cutting tip is what reaches it.
    bladeY: -depth / 2 - standout,
    tipY: -(depth * 1.02) / 2,
    tipHeight: s * 0.55,
    standout,
  };
}

/**
 * The Y span a marker occupies, as [low, high]. The whole point: `high` must be
 * 0 — the cutting corner on the spindle centre plane — for every marker.
 */
export function markerYSpan(kind, radius, shape = {}) {
  if (kind === 'boring') {
    const g = boringBarGeometry(radius, shape);
    return [Math.min(g.barY - g.barRadius, g.insertY - g.insert.thickY / 2), 0];
  }
  if (kind === 'parting') {
    const g = partingBladeGeometry(radius, shape);
    return [Math.min(g.bladeY - g.depth / 2, g.tipY - (g.depth * 1.02) / 2), 0];
  }
  if (kind === 'drill') {
    // No standout (see drillGeometry's own doc) — the marker is perfectly
    // coaxial, so its span is simply the shaft diameter either side of the
    // centreline, down to the tip sitting exactly on Y=0.
    const g = drillGeometry(radius, shape);
    return [-2 * g.shaftRadius, 0];
  }
  const g = odHolderGeometry(radius, shape);
  return [g.bodyY - g.depth, 0];
}

/**
 * Should the show/hide-tool control be offered at all?
 *
 * Only for turning. The lathe marker is one piece — holder and insert
 * together — so there is nothing inside it to partially drop the way
 * `showArbor` drops just the collet above a mill's cutter (see
 * `millTool.js`'s `offerArborToggle`); this toggle hides the whole thing,
 * which is exactly what a lathe operator wants when the holder sits over the
 * cut they are trying to look at. The sketch page has no tool at all.
 */
export function offerToolToggle({ mode = 'mill', sketching = false } = {}) {
  return !sketching && mode === 'turn';
}
