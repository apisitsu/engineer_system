'use strict';

/**
 * C/N 区分 (kubun) — the RE21000H §4-3(2) "CONTROL NUMBER 区分一覧" decoded.
 * ============================================================================
 * The first two digits of a control number are a factory-authoritative work-type
 * code that carries part family, material class, lubrication type, unit system,
 * thread side, assembly count and shape — none of which the system currently
 * derives (it collapses everything to ~6 part-type buckets + a hard-coded
 * `{'35'}` Y-BALL set + scattered `cnPrefix == 23 or 25 …` lists).
 *
 * This module is the single decode. It is a plain in-memory table — **no I/O, no
 * DB call** — so `resolveKubun()` is safe to call on every search. The identical
 * data is also seeded into the `cn_kubun` table by
 * `db_migrations/20260830b_create_cn_kubun.js` for report JOINs; a test pins the
 * two copies together.
 *
 * Source: RE21000H rev H (2017-09-08), api/engineer/mtc/doc/RE21000H.pdf, §4-3(2).
 * Validated against the live `lpb.eng_item.sub_class` population by
 * `scripts/validate_cn_kubun.js` (classes 27 / 37 appear in the data but not the
 * standard — low count, left unmapped so `resolveKubun` returns null for them).
 *
 * `needs_grind_sds` is a DELIBERATELY CONSERVATIVE flag: false only for codes that
 * are unambiguously not a ground bearing component (raw blanks, tooling, paint
 * specs, purchased/unclassified, assembly kits). Liners / seals / retainers stay
 * true — they are components, and the audit's own "no process plan" branch already
 * filters them; asserting more here would be a guess.
 */

// code → { family, material, lube, unit, thread, assembly, shape, needsGrindSds, desc }
// '-' means "not distinguished by the 区分". Keep this literal in sync with the
// migration's SEED array (the parity test enforces it).
const KUBUN = {
  // ── 3PCS BODY ──────────────────────────────────────────────────────────────
  11: { family: 'BODY', material: 'steel', lube: '-', unit: 'inch',   thread: 'external', assembly: '3PCS', shape: 'standard', needsGrindSds: true,  desc: '3PCS BODY · inch · external thread' },
  12: { family: 'BODY', material: 'steel', lube: '-', unit: 'inch',   thread: 'internal', assembly: '3PCS', shape: 'standard', needsGrindSds: true,  desc: '3PCS BODY · inch · internal thread' },
  13: { family: 'BODY', material: 'steel', lube: '-', unit: 'metric', thread: 'external', assembly: '3PCS', shape: 'standard', needsGrindSds: true,  desc: '3PCS BODY · metric · external thread' },
  14: { family: 'BODY', material: 'steel', lube: '-', unit: 'metric', thread: 'internal', assembly: '3PCS', shape: 'standard', needsGrindSds: true,  desc: '3PCS BODY · metric · internal thread' },
  // ── BODY (non-3PCS): 4PCS / special / 2PCS / die-cast ─────────────────────
  15: { family: 'BODY', material: 'steel', lube: '-',   unit: 'inch',   thread: 'external', assembly: '4PCS', shape: 'standard', needsGrindSds: true, desc: '4PCS BODY · inch · external thread' },
  16: { family: 'BODY', material: 'steel', lube: '-',   unit: 'inch',   thread: 'internal', assembly: '4PCS', shape: 'standard', needsGrindSds: true, desc: '4PCS BODY · inch · internal thread' },
  17: { family: 'BODY', material: 'steel', lube: '-',   unit: 'metric', thread: 'external', assembly: '4PCS', shape: 'standard', needsGrindSds: true, desc: '4PCS BODY · metric · external thread' },
  18: { family: 'BODY', material: 'steel', lube: '-',   unit: 'metric', thread: 'internal', assembly: '4PCS', shape: 'standard', needsGrindSds: true, desc: '4PCS BODY · metric · internal thread' },
  19: { family: 'BODY', material: 'steel', lube: '-',   unit: '-',      thread: '-',        assembly: '-',    shape: 'special',  needsGrindSds: true, desc: 'BODY · special shape (LOADING SLOT etc.)' },
  51: { family: 'BODY', material: 'steel', lube: 'M/M', unit: 'inch',   thread: 'external', assembly: '2PCS', shape: 'standard', needsGrindSds: true, desc: '2PCS BODY M/M · inch · external thread' },
  52: { family: 'BODY', material: 'steel', lube: 'M/M', unit: 'inch',   thread: 'internal', assembly: '2PCS', shape: 'standard', needsGrindSds: true, desc: '2PCS BODY M/M · inch · internal thread' },
  53: { family: 'BODY', material: 'steel', lube: 'M/M', unit: 'metric', thread: 'external', assembly: '2PCS', shape: 'standard', needsGrindSds: true, desc: '2PCS BODY M/M · metric · external thread' },
  54: { family: 'BODY', material: 'steel', lube: 'M/M', unit: 'metric', thread: 'internal', assembly: '2PCS', shape: 'standard', needsGrindSds: true, desc: '2PCS BODY M/M · metric · internal thread' },
  55: { family: 'BODY', material: 'steel', lube: 'TFE', unit: 'inch',   thread: 'external', assembly: '2PCS', shape: 'standard', needsGrindSds: true, desc: '2PCS BODY TFE · inch · external thread' },
  56: { family: 'BODY', material: 'steel', lube: 'TFE', unit: 'inch',   thread: 'internal', assembly: '2PCS', shape: 'standard', needsGrindSds: true, desc: '2PCS BODY TFE · inch · internal thread' },
  57: { family: 'BODY', material: 'steel', lube: 'TFE', unit: 'metric', thread: 'external', assembly: '2PCS', shape: 'standard', needsGrindSds: true, desc: '2PCS BODY TFE · metric · external thread' },
  58: { family: 'BODY', material: 'steel', lube: 'TFE', unit: 'metric', thread: 'internal', assembly: '2PCS', shape: 'standard', needsGrindSds: true, desc: '2PCS BODY TFE · metric · internal thread' },
  59: { family: 'BODY', material: '-',     lube: '-',   unit: '-',      thread: '-',        assembly: '2PCS', shape: 'die-cast', needsGrindSds: true, desc: 'die-cast ROD END BODY' },
  // ── RACE ──────────────────────────────────────────────────────────────────
  21: { family: 'RACE', material: '4130',   lube: 'M/M', unit: '-', thread: '-', assembly: '-', shape: 'standard', needsGrindSds: true, desc: 'RACE · 4130 · M/M' },
  22: { family: 'RACE', material: '410',    lube: 'M/M', unit: '-', thread: '-', assembly: '-', shape: 'standard', needsGrindSds: true, desc: 'RACE · 410 · M/M' },
  23: { family: 'RACE', material: '410',    lube: 'TFE', unit: '-', thread: '-', assembly: '-', shape: 'standard', needsGrindSds: true, desc: 'RACE · 410 · TFE' },
  24: { family: 'RACE', material: '17-4PH', lube: 'M/M', unit: '-', thread: '-', assembly: '-', shape: 'standard', needsGrindSds: true, desc: 'RACE · 17-4PH (SUS630) · M/M' },
  25: { family: 'RACE', material: '17-4PH', lube: 'TFE', unit: '-', thread: '-', assembly: '-', shape: 'standard', needsGrindSds: true, desc: 'RACE · 17-4PH (SUS630) · TFE' },
  26: { family: 'RACE', material: 'Al-Bz',  lube: '-',   unit: '-', thread: '-', assembly: '-', shape: 'standard', needsGrindSds: true, desc: 'RACE · Al-Bz' },
  28: { family: 'RACE', material: '-',      lube: '-',   unit: '-', thread: '-', assembly: '-', shape: 'fracture', needsGrindSds: true, desc: 'RACE · fracture' },
  29: { family: 'RACE', material: '-',      lube: '-',   unit: '-', thread: '-', assembly: '-', shape: 'other',    needsGrindSds: true, desc: 'RACE · other' },
  // ── BALL ──────────────────────────────────────────────────────────────────
  31: { family: 'BALL', material: '440C',  lube: '-', unit: '-', thread: '-', assembly: '-', shape: 'dia<=1in', needsGrindSds: true, desc: 'BALL · 440C · dia <= 1 inch' },
  32: { family: 'BALL', material: '440C',  lube: '-', unit: '-', thread: '-', assembly: '-', shape: 'dia>1in',  needsGrindSds: true, desc: 'BALL · 440C · dia > 1 inch' },
  33: { family: 'BALL', material: '52100', lube: '-', unit: '-', thread: '-', assembly: '-', shape: 'dia<=1in', needsGrindSds: true, desc: 'BALL · 52100 (SUJ2) · dia <= 1 inch' },
  34: { family: 'BALL', material: '52100', lube: '-', unit: '-', thread: '-', assembly: '-', shape: 'dia>1in',  needsGrindSds: true, desc: 'BALL · 52100 (SUJ2) · dia > 1 inch' },
  35: { family: 'BALL', material: '-',     lube: '-', unit: '-', thread: '-', assembly: '-', shape: 'Y-BALL',   needsGrindSds: true, desc: 'BALL · Y-BALL' },
  38: { family: 'BALL', material: 'PM',    lube: '-', unit: '-', thread: '-', assembly: '-', shape: 'standard', needsGrindSds: true, desc: 'BALL · powdered metal' },
  39: { family: 'BALL', material: '-',     lube: '-', unit: '-', thread: '-', assembly: '-', shape: 'other',    needsGrindSds: true, desc: 'BALL · other' },
  // ── SPHERICAL ────────────────────────────────────────────────────────────
  41: { family: 'SPHERICAL', material: '-', lube: 'TFE', unit: 'inch',   thread: '-', assembly: '-', shape: 'standard', needsGrindSds: true,  desc: 'SPHERICAL · inch · TFE' },
  42: { family: 'SPHERICAL', material: '-', lube: 'TFE', unit: 'metric', thread: '-', assembly: '-', shape: 'standard', needsGrindSds: true,  desc: 'SPHERICAL · metric · TFE' },
  43: { family: 'SPHERICAL', material: '-', lube: 'M/M', unit: 'inch',   thread: '-', assembly: '-', shape: 'standard', needsGrindSds: true,  desc: 'SPHERICAL · inch · M/M' },
  44: { family: 'SPHERICAL', material: '-', lube: 'M/M', unit: 'metric', thread: '-', assembly: '-', shape: 'standard', needsGrindSds: true,  desc: 'SPHERICAL · metric · M/M' },
  48: { family: 'SPHERICAL', material: '-', lube: '-',   unit: '-',      thread: '-', assembly: '-', shape: 'fracture', needsGrindSds: true,  desc: 'SPHERICAL · insert-fracture' },
  49: { family: 'SPHERICAL', material: '-', lube: '-',   unit: '-',      thread: '-', assembly: 'kit', shape: 'kit',    needsGrindSds: false, desc: 'SPHERICAL · kit delivery (registration needs separate notice)' },
  // ── SLEEVE ───────────────────────────────────────────────────────────────
  61: { family: 'SLEEVE', material: 'aluminum', lube: '-', unit: '-', thread: '-', assembly: '-', shape: 'straight', needsGrindSds: true, desc: 'SLEEVE · aluminum · straight' },
  62: { family: 'SLEEVE', material: 'aluminum', lube: '-', unit: '-', thread: '-', assembly: '-', shape: 'flange',   needsGrindSds: true, desc: 'SLEEVE · aluminum · flange' },
  63: { family: 'SLEEVE', material: 'steel',    lube: '-', unit: '-', thread: '-', assembly: '-', shape: 'straight', needsGrindSds: true, desc: 'SLEEVE · steel · straight' },
  64: { family: 'SLEEVE', material: 'steel',    lube: '-', unit: '-', thread: '-', assembly: '-', shape: 'flange',   needsGrindSds: true, desc: 'SLEEVE · steel · flange' },
  69: { family: 'SLEEVE', material: '-',        lube: '-', unit: '-', thread: '-', assembly: '-', shape: 'special',  needsGrindSds: true, desc: 'SLEEVE · special shape' },
  // ── OTHER (F08) ──────────────────────────────────────────────────────────
  81: { family: 'OTHER', material: '-', lube: '-',   unit: '-', thread: '-', assembly: '-', shape: 'stud',           needsGrindSds: true,  desc: 'stud' },
  82: { family: 'OTHER', material: '-', lube: 'TFE', unit: '-', thread: '-', assembly: '-', shape: 'liner-inner',    needsGrindSds: true,  desc: 'TFE liner · inner-diameter face' },
  83: { family: 'OTHER', material: '-', lube: 'TFE', unit: '-', thread: '-', assembly: '-', shape: 'liner-flange',   needsGrindSds: true,  desc: 'TFE liner · flange face' },
  84: { family: 'OTHER', material: '-', lube: 'DU',  unit: '-', thread: '-', assembly: '-', shape: 'liner-inner',    needsGrindSds: true,  desc: 'DU liner · inner-diameter face' },
  85: { family: 'OTHER', material: '-', lube: 'DU',  unit: '-', thread: '-', assembly: '-', shape: 'liner-flange',   needsGrindSds: true,  desc: 'DU liner · flange face' },
  86: { family: 'OTHER', material: '-', lube: '-',   unit: '-', thread: '-', assembly: '-', shape: 'seal',           needsGrindSds: true,  desc: 'seal' },
  87: { family: 'OTHER', material: '-', lube: '-',   unit: '-', thread: '-', assembly: '-', shape: 'link',           needsGrindSds: true,  desc: 'link' },
  88: { family: 'OTHER', material: '-', lube: '-',   unit: '-', thread: '-', assembly: '-', shape: 'ball-stud',      needsGrindSds: true,  desc: 'ball stud' },
  89: { family: 'OTHER', material: '-', lube: '-',   unit: '-', thread: '-', assembly: '-', shape: 'seal-retainer',  needsGrindSds: true,  desc: 'seal retainer' },
  90: { family: 'OTHER', material: '-', lube: '-',   unit: '-', thread: '-', assembly: '-', shape: 'forging-blank',  needsGrindSds: false, desc: 'forging blank (raw input, not a finished part)' },
  91: { family: 'OTHER', material: '-', lube: '-',   unit: '-', thread: '-', assembly: '-', shape: 'ball-retainer',  needsGrindSds: true,  desc: 'ball retainer' },
  92: { family: 'OTHER', material: '-', lube: '-',   unit: '-', thread: '-', assembly: '-', shape: 'stud-blank',     needsGrindSds: false, desc: 'stud blank (raw input)' },
  95: { family: 'MECHA', material: '-', lube: '-',   unit: '-', thread: '-', assembly: '-', shape: 'mecha-part',     needsGrindSds: true,  desc: 'mecha part' },
  96: { family: 'OTHER', material: '-', lube: '-',   unit: '-', thread: '-', assembly: '-', shape: 'tooling',        needsGrindSds: false, desc: 'tooling / jig (not a product)' },
  97: { family: 'OTHER', material: '-', lube: '-',   unit: '-', thread: '-', assembly: '-', shape: 'blank-machining',needsGrindSds: false, desc: 'blank machining (fasteners division)' },
  98: { family: 'OTHER', material: '-', lube: '-',   unit: '-', thread: '-', assembly: '-', shape: 'paint-spec',     needsGrindSds: false, desc: 'purchasing spec no. requiring paint (not a part)' },
  99: { family: 'OTHER', material: '-', lube: '-',   unit: '-', thread: '-', assembly: '-', shape: 'purchased',      needsGrindSds: false, desc: 'purchased item / not otherwise classified' },
};

// 2-digit 区分 codes that do NOT get a grinding setup data sheet — the conservative
// subset used to keep tooling / blanks / specs / purchased parts out of the SDS
// audit and the coverage denominators.
const NON_GRIND_KUBUN = Object.freeze(
  Object.keys(KUBUN).filter((k) => KUBUN[k].needsGrindSds === false)
);

/**
 * The 2-digit 区分 code for a control number in any spelling this system uses:
 *   "314047"     → "31"
 *   "C31-04047"  → "31"
 *   "A41-00001"  → "41"
 * Returns null for anything that is not a class-prefixed control number.
 */
function kubunCodeOf(cn) {
  const s = String(cn == null ? '' : cn).trim().toUpperCase();
  const code = /^\d{6}$/.test(s) ? s.slice(0, 2)
    : /^[A-Z]\d{2}-/.test(s) ? s.slice(1, 3)
      : null;
  return code && Object.prototype.hasOwnProperty.call(KUBUN, code) ? code : null;
}

/** Full decoded attributes for a control number, or null if the class is unknown. */
function resolveKubun(cn) {
  const code = kubunCodeOf(cn);
  return code ? { code, ...KUBUN[code] } : null;
}

module.exports = { KUBUN, NON_GRIND_KUBUN, kubunCodeOf, resolveKubun };
