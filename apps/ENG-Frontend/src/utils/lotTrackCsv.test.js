import { TextEncoder } from 'util';
import { buildTrackCsvFile, buildAllTrackCsvFiles } from './lotTrackCsv';
import { httpClient } from './HttpClient';

// jsdom has no TextEncoder; every real browser does.
global.TextEncoder = global.TextEncoder || TextEncoder;

jest.mock('./HttpClient', () => ({ httpClient: { get: jest.fn() } }));

const lotResponse = (lotNo, steps = 2) => ({
  data: {
    found: true,
    ambiguous: false,
    header: { lotNo, controlNo: 'C1', partsNo: 'P1' },
    steps: Array.from({ length: steps }, (_, i) => ({
      order: i + 1, nameEn: `STEP ${i + 1}`, processCode: `10${i}`, status: 'done',
      machineLabel: 'KS-B22G', wc: '31', goodQty: 5, badQty: 1, cycleSec: 3, setupSec: 600,
      runMinutes: 90, compDate: '2026-09-21', dwellDays: 2,
    })),
  },
});

const decode = (b64) => Buffer.from(b64, 'base64').toString('utf8');

beforeEach(() => {
  httpClient.get.mockReset();
  httpClient.get.mockImplementation((url) => Promise.resolve(lotResponse(decodeURIComponent(url.split('/').pop()))));
});

describe('buildTrackCsvFile', () => {
  it('writes a header plus one row per process step, in the on-screen formatting', async () => {
    const f = await buildTrackCsvFile({ id: 2, name: 'PB Ring All', lots: [{ lotNo: 'T1', controlNo: null }] });
    expect(f.fileName).toBe('PB_Ring_All.csv');
    const lines = decode(f.base64Data).split('\r\n');
    expect(lines).toHaveLength(3); // header + 2 steps
    expect(lines[0]).toMatch(/^Lot No,Control No,Part No,#,Process,Code,Status,/);
    expect(lines[1]).toContain('KS-B22G · WC 31');
    expect(lines[1]).toContain('5 / 1 ng');
    expect(lines[1]).toContain('1h 30m');
    expect(lines[1]).toContain('2 d');
  });

  it('counts a lot that is not found or ambiguous as skipped, and reports empty when none usable', async () => {
    httpClient.get.mockResolvedValue({ data: { found: false } });
    expect(await buildTrackCsvFile({ id: 1, name: 'x', lots: [{ lotNo: 'A' }, { lotNo: 'B' }] }))
      .toEqual({ empty: true, skipped: 2 });
  });

  it('reports a track with no lots as empty without calling the API', async () => {
    expect(await buildTrackCsvFile({ id: 1, name: 'x', lots: [] })).toEqual({ empty: true, skipped: 0 });
    expect(httpClient.get).not.toHaveBeenCalled();
  });

  it('falls back to the track id when the name has nothing the uploader accepts', async () => {
    const f = await buildTrackCsvFile({ id: 9, name: 'ทดสอบ', lots: [{ lotNo: 'T1' }] });
    expect(f.fileName).toBe('track_9.csv');
  });

  it('sends the control number only when the lot has one', async () => {
    await buildTrackCsvFile({ id: 1, name: 'x', lots: [{ lotNo: 'T1', controlNo: '1321' }, { lotNo: 'T2' }] });
    expect(httpClient.get.mock.calls[0][1]).toEqual({ params: { control_no: '1321' } });
    expect(httpClient.get.mock.calls[1][1]).toEqual({ params: {} });
  });
});

describe('buildAllTrackCsvFiles', () => {
  it('de-duplicates file names so two tracks cannot overwrite each other on Drive', async () => {
    const { files } = await buildAllTrackCsvFiles([
      { id: 1, name: 'PB Ring All', lots: [{ lotNo: 'T1' }] },
      { id: 2, name: 'PB_Ring_All', lots: [{ lotNo: 'T2' }] },
    ]);
    expect(files.map((f) => f.fileName)).toEqual(['PB_Ring_All.csv', 'PB_Ring_All_2.csv']);
  });

  it('counts empty tracks and skipped lots, and reports progress per lot', async () => {
    httpClient.get.mockImplementation((url) => (url.endsWith('/BAD')
      ? Promise.resolve({ data: { found: false } })
      : Promise.resolve(lotResponse(url.split('/').pop()))));
    const progress = [];
    const r = await buildAllTrackCsvFiles([
      { id: 1, name: 'ok', lots: [{ lotNo: 'T1' }, { lotNo: 'BAD' }] },
      { id: 2, name: 'nothing', lots: [] },
    ], { onProgress: (d, t) => progress.push([d, t]) });
    expect(r.files).toHaveLength(1);
    expect(r.emptyCount).toBe(1);
    expect(r.skippedTotal).toBe(1);
    expect(progress).toEqual([[1, 2], [2, 2]]);
  });
});
