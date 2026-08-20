'use strict';

const path = require('path');
const os = require('os');
const fs = require('fs');

// PATHS is frozen at require time, so the GAS config has to be in place first.
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'ti-gas-'));
process.env.TI_CSV_OUTPUT_DIR = path.join(ROOT, 'out');
process.env.TI_CSV_GAS_URL = 'https://script.google.com/a/macros/example/s/AAA/exec';
process.env.TI_CSV_GAS_SECRET = 'shhh';

jest.mock('../../instance/eng_db', () => ({ engPool: { query: jest.fn() } }));
jest.mock('axios');

const axios = require('axios');
const svc = require('../../api/engineer/mtc/services/toolingImportService');

const COLS = ['a', 'b'];
const ROWS = [{ a: '1', b: '2' }];

describe('uploadCsvToDrive', () => {
  afterEach(() => jest.clearAllMocks());

  it('posts the CSV base64-encoded with the shared secret', async () => {
    axios.post.mockResolvedValue({ data: { success: true, action: 'updated', bytes: 12 } });
    const log = new svc.StepLog('test');

    await svc.uploadCsvToDrive('ToolingInspection.csv', COLS, ROWS, log);

    const [url, body, config] = axios.post.mock.calls[0];
    expect(url).toContain('/exec');
    expect(body.secret).toBe('shhh');
    expect(body.fileName).toBe('ToolingInspection.csv');
    expect(Buffer.from(body.base64Data, 'base64').toString('utf8')).toContain('1,2');
    // The corporate proxy returns a McAfee page with HTTP 200 for internal hosts, so
    // every internal call in this codebase disables it explicitly.
    expect(config.proxy).toBe(false);
    expect(log.warnings).toHaveLength(0);
  });

  it('degrades to a warning when Apps Script reports a failure', async () => {
    axios.post.mockResolvedValue({ data: { success: false, error: 'Bad secret' } });
    const log = new svc.StepLog('test');

    const result = await svc.uploadCsvToDrive('ToolingInspection.csv', COLS, ROWS, log);

    // Never throws: the local write is the step's real output and already succeeded.
    expect(result.error).toBe('Bad secret');
    expect(log.warnings.join('\n')).toContain('Bad secret');
  });

  it('names a stale deployment URL rather than dumping HTML', async () => {
    // A re-deploy mints a new /exec URL; the old one answers with a Google login page.
    const err = new Error('Request failed with status code 302');
    err.response = { data: '<!DOCTYPE html><html>...' };
    axios.post.mockRejectedValue(err);
    const log = new svc.StepLog('test');

    await svc.uploadCsvToDrive('ToolingInspection.csv', COLS, ROWS, log);

    expect(log.warnings.join('\n')).toMatch(/deployment URL is probably stale/);
  });

  it('does nothing at all when no GAS url is configured', async () => {
    const saved = process.env.TI_CSV_GAS_URL;
    delete process.env.TI_CSV_GAS_URL;
    jest.resetModules();
    const fresh = require('../../api/engineer/mtc/services/toolingImportService');
    const log = new fresh.StepLog('test');

    const result = await fresh.uploadCsvToDrive('ToolingInspection.csv', COLS, ROWS, log);

    expect(result).toEqual({ skipped: true });
    expect(axios.post).not.toHaveBeenCalled();
    expect(log.output).toBe('');

    process.env.TI_CSV_GAS_URL = saved;
    jest.resetModules();
  });
});
