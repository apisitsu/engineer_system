'use strict';

// RE21000H §4-3(2) work-type decode (utils/cnKubun.js). What matters:
//   1. it parses every C/N spelling the system uses, and safely returns null otherwise
//   2. the Y-BALL fold is byte-identical to the old hard-coded {'35'} set
//   3. NON_GRIND_KUBUN is exactly the non-grind rows and nothing else
//   4. every row is fully populated (the migration seeds the same object)

const { KUBUN, NON_GRIND_KUBUN, kubunCodeOf, resolveKubun } = require('../../api/engineer/mtc/utils/cnKubun');

describe('kubunCodeOf', () => {
  it('reads the class from every C/N spelling the system stores', () => {
    expect(kubunCodeOf('314047')).toBe('31');      // 6-digit
    expect(kubunCodeOf('C31-04047')).toBe('31');    // control-no
    expect(kubunCodeOf('A41-00001')).toBe('41');    // A-class
    expect(kubunCodeOf('c33-0553')).toBe('33');     // lower-case, short suffix
  });

  it('returns null for a class the standard does not list, and for junk', () => {
    expect(kubunCodeOf('790001')).toBeNull();       // 7x assembled rod-end — out of §4-3(2)
    expect(kubunCodeOf('200912')).toBeNull();       // class 20 — in the data, not the standard
    expect(kubunCodeOf('')).toBeNull();
    expect(kubunCodeOf(null)).toBeNull();
    expect(kubunCodeOf(undefined)).toBeNull();
    expect(kubunCodeOf('MISC-PART')).toBeNull();
  });
});

describe('resolveKubun', () => {
  it('decodes a race class to material + lube', () => {
    expect(resolveKubun('C25-00769')).toMatchObject({
      code: '25', family: 'RACE', material: '17-4PH', lube: 'TFE',
    });
  });

  it('decodes a body class to unit + thread side + assembly', () => {
    expect(resolveKubun('130602')).toMatchObject({
      family: 'BODY', unit: 'metric', thread: 'external', assembly: '3PCS',
    });
  });

  it('is null for an unknown class', () => {
    expect(resolveKubun('C79-00001')).toBeNull();
  });
});

describe('Y-BALL fold — identical to the retired {\'35\'} set', () => {
  const OLD_YBALL = new Set(['35']);
  const oldDerive = (cn) => {
    const s = String(cn || '').trim().toUpperCase();
    const cls = /^\d{6}$/.test(s) ? s.slice(0, 2) : s.slice(1, 3);
    return OLD_YBALL.has(cls) ? 'Y' : 'N';
  };
  const newDerive = (cn) => (resolveKubun(cn)?.shape === 'Y-BALL' ? 'Y' : 'N');

  it('agrees on every 2-digit class 00–99, in both spellings', () => {
    for (let n = 0; n < 100; n++) {
      const cc = String(n).padStart(2, '0');
      for (const cn of [`${cc}0001`, `C${cc}-00001`]) {
        expect(newDerive(cn)).toBe(oldDerive(cn));
      }
    }
  });

  it('only class 35 is Y-BALL', () => {
    expect(newDerive('350497')).toBe('Y');
    expect(newDerive('310894')).toBe('N');
    expect(newDerive('C35-00497')).toBe('Y');
  });
});

describe('NON_GRIND_KUBUN', () => {
  it('is exactly the needs-grind-sds = false rows', () => {
    const expected = Object.keys(KUBUN).filter((k) => KUBUN[k].needsGrindSds === false).sort();
    expect([...NON_GRIND_KUBUN].sort()).toEqual(expected);
  });

  it('covers tooling / blanks / paint-spec / purchased, not bearing components', () => {
    expect(NON_GRIND_KUBUN).toEqual(expect.arrayContaining(['96', '90', '98', '99']));
    expect(NON_GRIND_KUBUN).not.toContain('31');   // BALL
    expect(NON_GRIND_KUBUN).not.toContain('11');   // BODY
    expect(NON_GRIND_KUBUN).not.toContain('95');   // MECHA stays in
  });
});

describe('table shape (the migration seeds this same object)', () => {
  const FAMILIES = new Set(['BODY', 'RACE', 'BALL', 'SPHERICAL', 'SLEEVE', 'MECHA', 'OTHER']);
  const KEYS = ['family', 'material', 'lube', 'unit', 'thread', 'assembly', 'shape', 'needsGrindSds', 'desc'];

  it('every row is fully populated with a known family and a boolean flag', () => {
    for (const [code, row] of Object.entries(KUBUN)) {
      expect(code).toMatch(/^\d{2}$/);
      expect(Object.keys(row).sort()).toEqual([...KEYS].sort());
      for (const key of KEYS) expect(row[key]).toBeDefined();
      expect(FAMILIES.has(row.family)).toBe(true);
      expect(typeof row.needsGrindSds).toBe('boolean');
    }
  });
});
