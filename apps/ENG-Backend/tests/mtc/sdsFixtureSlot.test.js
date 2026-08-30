'use strict';

// Unit tests for the fixture-NAME slot-matching tier in sdsV2HeadlessController.js
// (canonFixtureName / buildSlotByFixture / makeConfigSlotResolver).
//
// This is the highest blast-radius new logic in the controller: it decides which tool
// lands in which T-slot on every SDS PDF for MSB surface grinders (GS-64PFII / PSG-64),
// where the same fixture is stored at DIFFERENT DWG positions per bore band. A wrong
// canonicalization silently prints the wrong fixture on a production setup sheet, so the
// ordering contract (ARBOR before COLLET) and the same-family gate are pinned here.
//
// The three helpers are PURE (no DB), but the controller pulls in DB pools at require
// time — we mock the instance pools (same pattern as searchSimilarRef.test.js) so the
// require is hermetic and never opens a connection.

jest.mock('../../instance/eng_db', () => ({ engPool: { query: jest.fn() }, default: {} }));
jest.mock('../../instance/maq_db', () => ({ maqPool: { query: jest.fn() } }));
jest.mock('../../instance/instance', () => ({ pool: { query: jest.fn() } }));

const ctrl = require('../../api/engineer/mtc/controllers/sdsV2HeadlessController');
const { canonFixtureName, buildSlotByFixture, makeConfigSlotResolver } = ctrl;

describe('canonFixtureName (fixture TYPE from a tool name)', () => {
  it('returns COLLET_ARBOR for "COLLET ARBOR" — ARBOR is checked BEFORE COLLET (substring trap)', () => {
    expect(canonFixtureName('COLLET ARBOR')).toBe('COLLET_ARBOR');
    expect(canonFixtureName('collet  arbor')).toBe('COLLET_ARBOR');   // case + whitespace collapse
  });

  it('maps each plain fixture name to its canonical type', () => {
    expect(canonFixtureName('COLLET')).toBe('COLLET');
    expect(canonFixtureName('COLLAR')).toBe('COLLAR');
    expect(canonFixtureName('WORK FIXED BASE')).toBe('BASE');
    expect(canonFixtureName('SPACER')).toBe('SPACER');
  });

  it('recognises the Japanese fixture names', () => {
    expect(canonFixtureName('コレット')).toBe('COLLET');
    expect(canonFixtureName('ベース')).toBe('BASE');
  });

  it('returns null for non-fixture names and empty/nullish input (keeps the tier inert)', () => {
    expect(canonFixtureName('PILOT PIN')).toBeNull();
    expect(canonFixtureName('')).toBeNull();
    expect(canonFixtureName(null)).toBeNull();
    expect(canonFixtureName(undefined)).toBeNull();
  });

  it('excludes ASSY ("BASE ASSY" = assembly drawing) BEFORE the BASE check — must NOT steal the BASE slot', () => {
    expect(canonFixtureName('BASE ASSY')).toBeNull();   // would wrongly be 'BASE' without the guard
    expect(canonFixtureName('組立図')).toBeNull();
    expect(canonFixtureName('WORK FIXED BASE')).toBe('BASE');   // real BASE still resolves
  });
});

describe('buildSlotByFixture (canon fixture → { slot, family })', () => {
  const orderMap = {
    '4547-01-0017-02': 1,
    '4547-01-0017-03': 2,
    '4547-01-0017-04': 3,
  };

  it('maps single-occurrence fixtures to their slot + DWG family', () => {
    const mtRows = [
      { tool_drawing_no: '4547-01-0017-02', tool_number: 'T01' },
      { tool_drawing_no: '4547-01-0017-03', tool_number: 'T02' },
      { tool_drawing_no: '4547-01-0017-04', tool_number: 'T03' },
    ];
    const nameByDwg = {
      '4547-01-0017-02': 'COLLET',
      '4547-01-0017-03': 'COLLET ARBOR',
      '4547-01-0017-04': 'COLLAR',
    };
    const map = buildSlotByFixture(mtRows, nameByDwg, orderMap);
    expect(map.get('COLLET')).toEqual({ slot: 1, family: '4547-01' });
    expect(map.get('COLLET_ARBOR')).toEqual({ slot: 2, family: '4547-01' });
    expect(map.get('COLLAR')).toEqual({ slot: 3, family: '4547-01' });
  });

  it('DROPS a fixture that maps to more than one slot (ambiguous → never guess)', () => {
    const mtRows = [
      { tool_drawing_no: '4547-01-0017-02', tool_number: 'T01' }, // COLLET
      { tool_drawing_no: '4547-01-0017-03', tool_number: 'T02' }, // COLLET again → ambiguous
      { tool_drawing_no: '4547-01-0017-04', tool_number: 'T03' }, // COLLAR (unique)
    ];
    const nameByDwg = {
      '4547-01-0017-02': 'COLLET',
      '4547-01-0017-03': 'COLLET',
      '4547-01-0017-04': 'COLLAR',
    };
    const map = buildSlotByFixture(mtRows, nameByDwg, orderMap);
    expect(map.has('COLLET')).toBe(false);   // ambiguous dropped
    expect(map.get('COLLAR')).toEqual({ slot: 3, family: '4547-01' });
  });

  it('stays EMPTY for a non-MSB whitelist whose names do not canonicalize', () => {
    const mtRows = [
      { tool_drawing_no: '4664-02-0010', tool_number: 'T01' },
      { tool_drawing_no: '4664-06-0020', tool_number: 'T02' },
    ];
    const nameByDwg = { '4664-02-0010': 'LOADING CHUTE', '4664-06-0020': 'PLUG' };
    const map = buildSlotByFixture(mtRows, nameByDwg, { '4664-02-0010': 1, '4664-06-0020': 2 });
    expect(map.size).toBe(0);
  });
});

describe('makeConfigSlotResolver (DWG/family/name → T-slot)', () => {
  const allowedKeys = ['4547-01-0017-02', '4547-01-0017-03', '4547-01-0017-04'];
  const orderMap = {
    '4547-01-0017-02': 1,
    '4547-01-0017-03': 2,
    '4547-01-0017-04': 3,
  };
  const slotByFixture = new Map([
    ['COLLET',       { slot: 1, family: '4547-01' }],
    ['COLLET_ARBOR', { slot: 2, family: '4547-01' }],
    ['COLLAR',       { slot: 3, family: '4547-01' }],
  ]);
  const resolve = makeConfigSlotResolver({ orderMap, allowedKeys, slotByFixture });

  it('tier 1 — exact DWG hit', () => {
    expect(resolve('4547-01-0017-02', 'COLLET')).toBe(1);
  });

  it('tier 2 — dash-prefix family overlap', () => {
    expect(resolve('4547-01-0017-02-99', 'whatever')).toBe(1); // dwg startsWith key+'-'
  });

  it('tier 3 — fixture NAME match across bore bands of the SAME family', () => {
    // 4547-01-0031-07 is a different band than the whitelisted 4547-01-0017-02, but it is
    // the COLLET fixture of the SAME family → lands in the COLLET slot.
    expect(resolve('4547-01-0031-07', 'COLLET')).toBe(1);
    expect(resolve('4547-01-0031-08', 'COLLET ARBOR')).toBe(2);
  });

  it('tier 3 GATE — a same-named fixture of a DIFFERENT family does NOT cross over', () => {
    expect(resolve('8888-88-0001', 'COLLET')).toBeNull();
  });

  it('returns null when nothing matches and for a nullish DWG', () => {
    expect(resolve('7777-77-0001', 'PILOT PIN')).toBeNull();
    expect(resolve(null, 'COLLET')).toBeNull();
    expect(resolve('', 'COLLET')).toBeNull();
  });
});

// ── makeFixtureTracker ────────────────────────────────────────────────────────
// The "already placed this fixture" gate that suppresses a wrong-band T-Select
// duplicate. Its key is (canon fixture, DWG family); keying on canon ALONE is what
// silently dropped a real fixture from live sheets, so both halves are pinned here.
describe('makeFixtureTracker (suppress a wrong-BAND duplicate, never a different family)', () => {
  it('suppresses another band of the SAME family — the MSB case it exists for', () => {
    const t = ctrl.makeFixtureTracker();
    t.note('COLLET', '4547-01-0031-07');                     // factory plan placed it
    expect(t.placed('COLLET', '4547-01-0017-05')).toBe(true); // T-Select's wrong band → drop
  });

  it('does NOT suppress ARBOR PIN because ARBOR is there — both canonicalize to COLLET_ARBOR', () => {
    // X-100: ARBOR is 4857-01, ARBOR PIN is 4857-02. canonFixtureName matches on the
    // substring 'ARBOR', so canon alone made them one fixture and T02 printed blank on
    // every X-100 sheet (CN 414303). The DWG family is what tells them apart.
    expect(canonFixtureName('ARBOR')).toBe(canonFixtureName('ARBOR PIN'));  // the collision is real
    const t = ctrl.makeFixtureTracker();
    t.note('ARBOR', '4857-01-0035');
    expect(t.placed('ARBOR PIN', '4857-02-0032')).toBe(false);
  });

  it('keeps the three KS-H70 collets apart (COLLET 4691-19 / (A) 4691-03 / BODY 4691-18)', () => {
    const t = ctrl.makeFixtureTracker();
    t.note('COLLET', '4691-19-0004');
    expect(t.placed('COLLET (A)', '4691-03-0007')).toBe(false);
    expect(t.placed('COLLET BODY', '4691-18-8500')).toBe(false);
    expect(t.placed('COLLET', '4691-19-0011')).toBe(true);     // same family → still suppressed
  });

  it('still separates the MSB fixtures that SHARE family 4547-01 — canon does that half', () => {
    const t = ctrl.makeFixtureTracker();
    t.note('WORK FIXED BASE', '4547-01-0031-01');
    expect(t.placed('COLLET', '4547-01-0031-07')).toBe(false);
    expect(t.placed('COLLAR', '4547-01-0031-09')).toBe(false);
  });

  it('is inert for a tool whose name does not canonicalize, and for a nullish DWG', () => {
    const t = ctrl.makeFixtureTracker();
    t.note('PILOT PIN', '4664-11-0003');
    expect(t.placed('PILOT PIN', '4664-11-0003')).toBe(false);  // never tracked → never suppressed
    t.note('COLLET', null);
    expect(t.placed('COLLET', null)).toBe(false);
  });
});

// ── pickFamilyName ───────────────────────────────────────────────────────────
// The name printed on a config slot the part has no Tool No for. Chosen by how often the
// factory plan actually names each ASCII drawing in the family. ASCII is a hard gate, not
// a tie-break — letting a busy Japanese drawing win would print コレット on an English
// sheet. Both halves are pinned; two simpler rules were measured against the plan and lost.
describe('pickFamilyName (name for a slot with no Tool No)', () => {
  const { pickFamilyName } = ctrl;
  const t = (dwg, name) => ({ tool_dwg_no: dwg, tool_name: name });

  it('picks the ASCII name the factory plan uses most (XD-8 4858-11 — the live case)', () => {
    const fam = [
      t('4858-11-0001', 'WORK STOPPER(使用禁止)'),
      t('4858-11-0003', 'WORK STOPPER BASE'),   // first ASCII, but the plan never uses it
      t('4858-11-0002', 'WORK STOPPER'),        // what the shop actually builds
    ];
    expect(pickFamilyName(fam, { '4858-11-0001': 117, '4858-11-0002': 224 })).toBe('WORK STOPPER');
  });

  it('separates two slots of one sheet that both said PALLET (MD-V9910WA 4918-01)', () => {
    const fam = [t('4918-01-0004', 'PALLET'), t('4918-01-0001-99', 'UNIVERSAL PALLET ASSY')];
    expect(pickFamilyName(fam, { '4918-01-0004': 16, '4918-01-0001-99': 132 }))
      .toBe('UNIVERSAL PALLET ASSY');
  });

  it('sums the count across every drawing carrying the same name', () => {
    const fam = [
      t('4664-01-0001', 'WORK DRIVER'), t('4664-01-0002', 'WORK DRIVER'),
      t('4664-01-0009', 'WORK DRIVER(TYPE1)'),
    ];
    // 300 + 347 beats 600 — the plain name is the family's, not one drawing's
    expect(pickFamilyName(fam, { '4664-01-0001': 300, '4664-01-0002': 347, '4664-01-0009': 600 }))
      .toBe('WORK DRIVER');
  });

  it('never trades an ASCII name for a Japanese one, however well planned', () => {
    const fam = [t('4566-02-0001', 'COLLAR'), t('4566-02-0002', '球研アーバー用カラー')];
    expect(pickFamilyName(fam, { '4566-02-0002': 900 })).toBe('COLLAR');
  });

  it('falls back to the first ASCII name when the plan says nothing', () => {
    const fam = [t('4030-01-0001', 'コレット'), t('4030-01-0002', 'COLLET')];
    expect(pickFamilyName(fam, {})).toBe('COLLET');          // no plan data at all
    expect(pickFamilyName(fam, { '4030-01-9999': 5 })).toBe('COLLET');  // none of THESE planned
  });

  it('returns the Japanese name only when the family has no ASCII one', () => {
    const fam = [t('4671-14-0001', 'カラー')];
    expect(pickFamilyName(fam, { '4671-14-0001': 40 })).toBe('カラー');
  });

  it('returns empty string for an empty/nameless family', () => {
    expect(pickFamilyName([], {})).toBe('');
    expect(pickFamilyName([t('4999-01-0001', '')], {})).toBe('');
  });
});

describe('pickFamilyName — a family with no ASCII name at all', () => {
  const { pickFamilyName } = ctrl;
  const t = (dwg, name) => ({ tool_dwg_no: dwg, tool_name: name });

  it('still uses the plan, so a retired 使用禁止 drawing does not label the slot (4586-04)', () => {
    const fam = [
      t('4586-04-0001', '\u5916\u7814\u30a2\u30fc\u30d0\u30fc\u7528\u30ca\u30c3\u30c8 ON0001\uff08\u4f7f\u7528\u7981\u6b62\uff09'),
      t('4586-04-0002', '\u5916\u7814\u30a2\u30fc\u30d0\u30fc\u7528\u30ca\u30c3\u30c8'),
    ];
    expect(pickFamilyName(fam, { '4586-04-0002': 7 }))
      .toBe('\u5916\u7814\u30a2\u30fc\u30d0\u30fc\u7528\u30ca\u30c3\u30c8');
  });
});

// ── alternativeFamilies / dropUnchosenAlternatives ───────────────────────
// Which config slots are ALTERNATIVES is measured from the factory plan, not guessed.
// Two earlier rules were tried and both over-fired; the counts below are the live data
// that disproved them, so they are pinned here.
describe('alternativeFamilies (measured from the plan, not guessed)', () => {
  const { alternativeFamilies } = ctrl;

  it('calls two families alternatives when the plan never puts them on one C/N', () => {
    // MD-V9910WA PALLET 4918-01 vs 4918-02 — 145 and 138 C/N, zero together
    const alt = alternativeFamilies({ '4918-01': 145, '4918-02': 138 }, {});
    expect(alt.has('4918-01|4918-02')).toBe(true);
  });

  it('tolerates a handful of exceptions (KL-20 is 5 of 655)', () => {
    const alt = alternativeFamilies({ '4030-01': 720, '4030-02': 655 }, { '4030-01|4030-02': 5 });
    expect(alt.has('4030-01|4030-02')).toBe(true);
  });

  it('does NOT call complements alternatives, even when they share a fixture name', () => {
    // KS-400B1's second PLUG pair: 4664-06 and 4664-21 are planned together 15 times of 15.
    // The "same fixture name" rule this replaced dropped one of these from live sheets.
    const alt = alternativeFamilies({ '4664-06': 15, '4664-21': 15 }, { '4664-06|4664-21': 15 });
    expect(alt.size).toBe(0);
  });

  it('leaves a partly-overlapping pair alone — 37% is not an alternative', () => {
    const alt = alternativeFamilies({ '4652-10': 84, '4652-12': 57 }, { '4652-10|4652-12': 21 });
    expect(alt.size).toBe(0);
  });

  it('requires the SAME drawing series — unrelated fixtures never co-occur either', () => {
    // GI-20N's CLAMP PLATE 4652-12 and ROTARY DRESSER 4800-42 are 0 together and are NOT
    // alternatives; without this the dresser dropped the clamp plate from every sheet.
    const alt = alternativeFamilies({ '4652-12': 57, '4800-42': 88 }, {});
    expect(alt.size).toBe(0);
  });

  it('says nothing when the plan has too little to say', () => {
    expect(alternativeFamilies({ '4030-01': 3, '4030-02': 2 }, {}).size).toBe(0);
    expect(alternativeFamilies({}, {}).size).toBe(0);
  });
});

describe('dropUnchosenAlternatives (an alternative group occupies ONE slot)', () => {
  const { dropUnchosenAlternatives } = ctrl;
  const ALT = new Set(['4918-01|4918-02']);
  const FAM = ['4918-01', '4918-02', '4918-03'];          // what the whitelist reserves per slot
  const cfg = (dwg) => ({ tool_name: 'PALLET', tool_dwg_no: dwg, fromConfig: true });
  const ts = (dwg) => ({ tool_name: 'PALLET', tool_dwg_no: dwg, fromTs: true });
  const at = (out) => out.map((s, i) => (s ? `T${i + 1}:${s.tool_dwg_no || '(name)'}` : null))
                         .filter(Boolean).join(' ');

  it('moves the chosen member up to the first slot of its group', () => {
    const out = dropUnchosenAlternatives([cfg(''), cfg('4918-02-0011'), cfg('')], ALT, FAM);
    expect(at(out)).toBe('T1:4918-02-0011 T3:(name)');
  });

  it('moves it even when it arrived from T-Select — the live case', () => {
    // Group membership comes from famBySlot, not from the payload. Reading it off the payload
    // missed exactly this: the chosen pallet on CN 414303 @3491 is a ` *` T-Select fill.
    const out = dropUnchosenAlternatives([cfg(''), ts('4918-02-0011'), cfg('')], ALT, FAM);
    expect(at(out)).toBe('T1:4918-02-0011 T3:(name)');
  });

  it('leaves the chosen member alone when it is already the first slot', () => {
    const out = dropUnchosenAlternatives([cfg('4918-01-0001'), cfg(''), cfg('')], ALT, FAM);
    expect(at(out)).toBe('T1:4918-01-0001 T3:(name)');
  });

  it('keeps ONE name when the part uses neither', () => {
    const out = dropUnchosenAlternatives([cfg(''), cfg(''), cfg('')], ALT, FAM);
    expect(at(out)).toBe('T1:(name) T3:(name)');
  });

  it('leaves BOTH in place when the plan fitted both — the plan overrules the statistic', () => {
    const out = dropUnchosenAlternatives([cfg('4918-01-0001'), cfg('4918-02-0011'), cfg('')], ALT, FAM);
    expect(at(out)).toBe('T1:4918-01-0001 T2:4918-02-0011 T3:(name)');
  });

  it('never touches a slot outside an alternative group', () => {
    const out = dropUnchosenAlternatives([cfg(''), cfg('4918-02-0011'), cfg('4918-03-0007')], ALT, FAM);
    expect(at(out)).toBe('T1:4918-02-0011 T3:4918-03-0007');
  });

  it('is inert with no alternatives measured — the fail-toward-showing path', () => {
    const slots = () => [cfg(''), cfg('4918-02-0011'), cfg('')];
    expect(at(dropUnchosenAlternatives(slots(), new Set(), FAM))).toBe('T1:(name) T2:4918-02-0011 T3:(name)');
    expect(at(dropUnchosenAlternatives(slots(), null, FAM))).toBe('T1:(name) T2:4918-02-0011 T3:(name)');
  });

  it('is inert when the caller has no whitelist to describe the slots', () => {
    const out = dropUnchosenAlternatives([cfg(''), cfg('4918-02-0011')], ALT, []);
    expect(at(out)).toBe('T1:(name) T2:4918-02-0011');
  });
});
describe('pickFamilyName — "English" is a script test, not a byte test', () => {
  const { pickFamilyName } = ctrl;
  const t = (dwg, name) => ({ tool_dwg_no: dwg, tool_name: name });

  it('keeps an English name that contains Φ or ～ (X-100 4857-06 — the live case)', () => {
    // A plain ASCII test disqualified this and printed LOADER JAW BASE, never planned.
    const fam = [t('4857-06-0007', 'LOADER JAW BASE'), t('4857-06-0003', 'LOADER CHUCK(\u03a612\uff5e\u03a630)')];
    expect(pickFamilyName(fam, { '4857-06-0003': 381 })).toBe('LOADER CHUCK(\u03a612\uff5e\u03a630)');
  });

  it('still refuses a Japanese name however well planned', () => {
    const fam = [t('a', 'COLLAR'), t('b', '\u7403\u7814\u30a2\u30fc\u30d0\u30fc\u7528\u30ab\u30e9\u30fc')];
    expect(pickFamilyName(fam, { b: 900 })).toBe('COLLAR');
  });

  it('treats a name with no Latin letters at all as Japanese', () => {
    const fam = [t('a', '\u30ab\u30e9\u30fc'), t('b', '\u56fa\u5b9a\u30cd\u30b8')];
    expect(pickFamilyName(fam, { b: 40 })).toBe('\u56fa\u5b9a\u30cd\u30b8');
  });
});
