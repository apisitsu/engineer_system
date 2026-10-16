const { parseDate, resolveDates, parseRev, splitProcess, mergeGroup, buildRecords } = require('../../scripts/record_form_import/recordFormImport');

const steps = (...t) => t.map((text, i) => ({ no: i + 1, text, remark: null }));
const form = (o = {}) => ({ row: 10, col: 1, lot_no: 'L1', control_no: '123456', parts_no: 'PN', steps: steps('0081 TURNING'), ...o });

describe('parseDate', () => {
  test('reads ISO and DD-MM-YYYY', () => {
    expect(parseDate('2023-06-05')).toBe('2023-06-05');
    expect(parseDate('08-06-2023')).toBe('2023-08-06');
  });
  test('reads the hand-typed variants', () => {
    expect(parseDate('12-04-24')).toBe('2024-12-04'); // both fit → month-first
    expect(parseDate('22/01/24')).toBe('2024-01-22');
    expect(parseDate('18-9-26')).toBe('2026-09-18');
    expect(parseDate('05-MAR-25')).toBe('2025-03-05');
    expect(parseDate('9/16/2026')).toBe('2026-09-16'); // day-first impossible → month-first
    expect(parseDate('28/6/2023')).toBe('2023-06-28'); // month 28 impossible → day-first
  });
  test('rejects the unreadable instead of guessing', () => {
    expect(parseDate('16/03/202')).toBeNull();
    expect(parseDate('05-08-20424')).toBeNull();
    expect(parseDate('20-04-20204')).toBeNull();
    expect(parseDate('31-02-2023')).toBeNull();
    expect(parseDate('NC')).toBeNull();
    expect(parseDate(null)).toBeNull();
  });
});

describe('resolveDates', () => {
  test('a day/month-ambiguous date follows its neighbours in the sheet', () => {
    // 08-06-2023 alone reads as Aug 6; between June dates it can only be 8 June
    expect(resolveDates(['2023-06-05', '08-06-2023', '2023-06-12'])).toEqual(['2023-06-05', '2023-06-08', '2023-06-12']);
    expect(resolveDates(['2023-08-01', '08-06-2023', '2023-08-10'])).toEqual(['2023-08-01', '2023-08-06', '2023-08-10']);
  });
  test("the lot's entry date in the plan decides first", () => {
    // neighbours say nothing (no unambiguous dates); the lot opened 2023-06-03, so 08-06-2023 is 8 June
    expect(resolveDates(['08-06-2023'], ['2023-06-03'])).toEqual(['2023-06-08']);
    expect(resolveDates(['08-06-2023'], ['2023-08-01'])).toEqual(['2023-08-06']);
    // it beats the neighbours when they disagree
    expect(resolveDates(['2023-08-01', '08-06-2023', '2023-08-10'], [null, '2023-06-03', null])[1]).toBe('2023-06-08');
  });
  test('when neighbours cannot decide, month-first wins', () => {
    expect(resolveDates(['2023-06-05', '07-06-2023', '2023-07-05'])).toEqual(['2023-06-05', '2023-07-06', '2023-07-05']);
    expect(resolveDates(['08-06-2023'])).toEqual(['2023-08-06']);
  });
  test('unambiguous and unreadable values are untouched', () => {
    expect(resolveDates(['15-06-2023', '20-04-20204', null])).toEqual(['2023-06-15', null, null]);
  });
});

test('parseRev: NC / N/C / blank are 0, letters count up', () => {
  expect(['NC', 'N/C', null, '', 'A', 'B', 'Z', 'AA'].map(v => parseRev(v).rev)).toEqual([0, 0, 0, 0, 1, 2, 26, 27]);
  expect(parseRev('weird')).toEqual({ rev: 0, odd: true });
});

test('splitProcess separates the code from the name', () => {
  expect(splitProcess('3511 PLATE')).toEqual({ code: '3511', name: 'PLATE' });
  expect(splitProcess('8013 COMPONENT INSPECT(3)')).toEqual({ code: '8013', name: 'COMPONENT INSPECT(3)' });
  expect(splitProcess('NO CODE')).toEqual({ code: null, name: 'NO CODE' });
});

describe('mergeGroup', () => {
  test('exact copies and blank copies collapse to one form', () => {
    const a = form({ steps: steps('A', 'B') });
    expect(mergeGroup([a, { ...a, col: 17 }, { ...a, col: 33, steps: [] }])).toHaveLength(1);
  });
  test('a full block followed by another in the same row is one long route', () => {
    const full = Array.from({ length: 20 }, (_, i) => `00${i} P${i}`);
    const r = mergeGroup([form({ steps: steps(...full) }), form({ col: 17, steps: steps('1081 SUPER FINISH', '8601 STOCK') })]);
    expect(r).toHaveLength(1);
    expect(r[0].steps).toHaveLength(22);
    expect(r[0].continued).toBe(2);
  });
  test('a short block with a different route stays a separate record', () => {
    expect(mergeGroup([form({ steps: steps('A', 'B') }), form({ col: 17, steps: steps('A', 'C') })])).toHaveLength(2);
  });
  test('the same lot on another row is kept as its own record', () => {
    expect(mergeGroup([form({ steps: steps('A') }), form({ row: 99, steps: steps('B') })])).toHaveLength(2);
  });
});

test('buildRecords drops empty slots and normalises fields', () => {
  const recs = buildRecords([
    form({ established_date: '28-06-2023', record_rev: 'N/C', revised_date: 'NC', customer_pn: 'C-1', final_decided: null }),
    form({ lot_no: null, control_no: null }),
    form({ lot_no: 'L2', established_date: '20-04-20204', record_rev: 'A' }),
  ], 'WB.xlsx');
  expect(recs).toHaveLength(2);
  expect(recs[0]).toMatchObject({ established_date: '2023-06-28', record_rev: 0, revised_date: null });
  expect(recs[0].header).toMatchObject({ customer_pn: 'C-1', imported_from: 'WB.xlsx' });
  expect(recs[0].header.final_decided).toBeUndefined();
  expect(recs[1]).toMatchObject({ established_date: null, record_rev: 1 });
  expect(recs[1].header.established_raw).toBe('20-04-20204');
});
