'use strict';

const { toItemNo, toControlNo } = require('./cnFormat');

/**
 * CN targeting rules for grinding layout images (`sds_grinding_image.cn_prefixes`).
 *
 * One picture can be aimed at three levels of specificity, all stored in the same
 * `text[]` column:
 *
 *   C39-04137   full control-no  — this one part only
 *   C39         family prefix    — every part in that Sub Class
 *   C3          class prefix     — every BALL, whatever the Sub Class  ← added 2026-08-13
 *
 * The class level exists so a Sub Class that never got its own upload still prints a
 * picture: C39 with no image of its own falls back to C3. Before it, each of the ~9
 * Sub Classes in a family needed its own upload before any of them rendered, and the
 * common case — one shop drawing that is correct for the whole family — had no way to
 * be expressed once.
 *
 * Lookup is **specificity-first**: full → family → class. A process-code match only
 * breaks ties *within* one level, so a per-CN default image still beats a family image
 * that happens to name the process. Both the PDF renderer
 * (`sdsV2HeadlessController.buildValueMap`) and the admin lookup/coverage routes
 * (`sdsV2ImageController`) must use these helpers so the "Missing" list and the sheet
 * that actually prints can never disagree.
 *
 * **The 6-digit item-no trap.** A part has two written forms — `C29-00774` and `290774`
 * — and the operator sees both daily. The renderer only ever holds the control-no, so a
 * row targeted `290774` matches nothing, prints no picture, and reports no error; found
 * live on record #47, whose four per-CN targets had been dead since upload. Rather than
 * reject the form, both sides accept it: writes are normalised to the control-no
 * (`normalizeTarget`) and lookups match either spelling (`cnMatchKeys().exact`), so rows
 * already stored the wrong way start working without a data migration.
 */

/** Uppercase + trim; returns '' for null/blank so callers can filter in one step. */
function normalizePrefix(p) {
  return String(p ?? '').trim().toUpperCase();
}

/**
 * Which targeting level a `cn_prefixes` entry represents.
 * 'cn' (C39-04137 or 390 4137-style 6-digit item-no) | 'family' (C39) | 'class' (C3) | 'unknown'
 */
function prefixLevel(p) {
  const s = normalizePrefix(p);
  if (/^[A-Z]\d{2}-\d{4,5}$/.test(s)) return 'cn';
  if (/^\d{6}$/.test(s)) return 'cn';          // item-no form of a control-no
  if (/^[A-Z]\d{2}$/.test(s)) return 'family';
  if (/^[A-Z]\d$/.test(s)) return 'class';
  return 'unknown';
}

/**
 * Canonical form to STORE for a target the user typed. Item-nos are upgraded to the
 * control-no so every new row is written in the shape the renderer actually compares
 * against; prefixes pass through untouched.
 */
function normalizeTarget(p) {
  const s = normalizePrefix(p);
  if (/^\d{6}$/.test(s)) return toControlNo(s) || s;
  return s;
}

/**
 * The keys a control-no (or a prefix) should be matched against.
 *
 * Returns a **fixed shape** — never a bare array whose positions shift with the input
 * length. Callers take a prefix as well as a full CN (`GET /grinding/:cn_prefix`), and
 * with a positional array `cnMatchKeys('C39')` would hand back `['C39','C3']`, silently
 * binding the family value to the "full" slot and ranking a family image as a per-CN one.
 *
 *   'C39-04137' → exact ['C39-04137','390 4137'→'394137'], family 'C39', klass 'C3'
 *   'C39'       → exact [],                                family 'C39', klass 'C3'
 *   'C3'        → exact [],                                family null,  klass 'C3'
 *
 * `exact` holds every spelling of the one part (control-no + item-no) — all equally
 * specific, so they share rank 0. `keys` is everything, most specific first, ready for
 * `cn_prefixes && $1`.
 */
function cnMatchKeys(cn) {
  const s = normalizePrefix(cn);
  const isFull = s.length > 3;
  const exact = [];
  if (isFull) {
    const ctrl = toControlNo(s) || s;
    const item = toItemNo(s);
    exact.push(ctrl);
    if (item && item !== ctrl) exact.push(item);
    if (s !== ctrl && s !== item) exact.push(s);   // keep an odd-but-given spelling
  }
  // Family/class are read off the control-no shape, so a 6-digit input still resolves
  // ('290774' → base 'C29-00774' → family 'C29', class 'C2').
  const base = isFull ? (toControlNo(s) || s) : s;
  const family = base.length >= 3 ? base.slice(0, 3) : null;
  const klass = base.length >= 2 ? base.slice(0, 2) : null;
  const uniq = (a) => [...new Set(a.filter(Boolean))];
  return {
    exact: uniq(exact),
    family: family || null,
    klass: klass || null,
    keys: uniq([...exact, family, klass]),
  };
}

/**
 * True when `prefix` targets the part identified by `cn` at any level.
 * Used by the coverage report so a class-level image does not read as a gap.
 */
function prefixMatchesCn(prefix, cn) {
  return cnMatchKeys(cn).keys.includes(normalizeTarget(prefix));
}

/**
 * Which family buckets of the factory shape-mix a stored entry stands in for — the input
 * to the "is one picture covering several shapes?" risk read.
 *
 *   class  `C3`        → every known family under it, ['C31','C32',…]
 *   family `C39`       → itself
 *   full   `C39-04137` → **nothing**. A per-CN image serves exactly one part, so charging
 *                        it with its family's whole shape spread would invent a risk that
 *                        does not exist (and inflate `served_cns` by three orders).
 *
 * Without the class case a `C3` image reports "no shape data" and reads as unverified
 * while in fact covering more parts than any other record — the one entry that most needs
 * the check.
 */
function shapeFamiliesFor(prefix, knownFamilies) {
  const s = normalizeTarget(prefix);
  switch (prefixLevel(s)) {
    case 'family': return [s];
    case 'class':  return [...knownFamilies].filter(f => f.startsWith(s));
    default:       return [];   // 'cn' and 'unknown'
  }
}

module.exports = {
  normalizePrefix, normalizeTarget, prefixLevel, cnMatchKeys, prefixMatchesCn, shapeFamiliesFor,
};
