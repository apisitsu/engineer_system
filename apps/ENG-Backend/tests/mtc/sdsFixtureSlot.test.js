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
