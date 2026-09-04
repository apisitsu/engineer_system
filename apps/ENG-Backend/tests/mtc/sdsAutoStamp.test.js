'use strict';

// Auto Stamp engine — the properties that matter if this ever mass-signs a shared
// table: it does nothing while the global toggle is off, it writes the three roles
// strictly in order, it stops (never skips ahead) at the first role with no
// configured signer, it only ever touches signature-only NO_STAMP sheets, and a
// failure on one sheet never throws or aborts the rest.

jest.mock('../../instance/eng_db', () => ({ engPool: { query: jest.fn(), connect: jest.fn() } }));
jest.mock('../../api/engineer/mtc/utils/sdsBoardRef', () => ({
  boardRef: jest.fn(async (cn, m, p) => `${cn}||${m}||${p}`),
  groupMembers: jest.fn(async (m) => [m]),
}));
jest.mock('../../api/engineer/mtc/services/kanbanIntake', () => ({ syncCard: jest.fn(async () => ({ ok: true, action: 'moved' })) }));
jest.mock('../../api/engineer/mtc/controllers/sdsApprovalController', () => ({
  ensureApprovalTables: jest.fn(async () => {}),
  resolveSdsRev: jest.fn(async () => 'A'),
  getSheet: jest.fn(async () => null),
  roleRec: jest.fn((sheet, role) => (sheet && sheet[role]) ? { em_id: sheet[role] } : null),
  signUpsert: jest.fn(async () => ({})),
  signPageUrl: jest.fn(() => 'http://x/eng/mtc_eng/sds-v2'),
}));

const { engPool } = require('../../instance/eng_db');
const approval = require('../../api/engineer/mtc/controllers/sdsApprovalController');
const kanbanIntake = require('../../api/engineer/mtc/services/kanbanIntake');
const { runAutoStamp, getConfig, resolveConfig, setConfig } = require('../../api/engineer/mtc/services/sdsAutoStamp');

const CFG = {
  id: 1, enabled: true, max_per_run: 200,
  prepared_em_id: 'E1', prepared_name: 'Alice',
  checked_em_id: 'E2', checked_name: 'Bob',
  approved_em_id: 'E3', approved_name: 'Carol',
};

// engPool.query is only reached by getConfig()/resolveConfig()/setConfig():
//   • SELECT on sds_auto_stamp_config      → the controlled config row
//   • SELECT on sds_approval_role_config   → `roleCfgRows` (default: none)
//   • SELECT on m_user_profile             → `userRows` (default: none)
//   • anything else (CREATE / INSERT / UPDATE) → empty result
let roleCfgRows = [];
let userRows = [];
const mockConfig = (over = {}, opts = {}) => {
  roleCfgRows = opts.roleCfgRows || [];
  userRows = opts.userRows || [];
  const cfgRow = { ...CFG, ...over };
  engPool.query.mockImplementation(async (sql) => {
    if (/sds_auto_stamp_config/i.test(sql) && /select/i.test(sql)) return { rows: [cfgRow] };
    if (/sds_approval_role_config/i.test(sql)) return { rows: roleCfgRows };
    if (/m_user_profile/i.test(sql)) return { rows: userRows };
    return { rows: [] };
  });
};

const row = (over = {}) => ({
  cn: 'C25-00241', machine_type_name: 'MSG-410', process_code: '1021',
  pending_reason: 'NO_STAMP', tooling_source: 'saved', ...over,
});

const rolesWritten = () => approval.signUpsert.mock.calls.map((c) => c[0].role);

afterEach(() => jest.clearAllMocks());

describe('runAutoStamp — global toggle', () => {
  it('is a no-op while disabled', async () => {
    mockConfig({ enabled: false });
    const res = await runAutoStamp([row()]);
    expect(res).toMatchObject({ enabled: false, reason: 'disabled' });
    expect(approval.signUpsert).not.toHaveBeenCalled();
  });
});

describe('runAutoStamp — signing', () => {
  it('writes prepared → checked → approved in order, tagged source=auto', async () => {
    mockConfig();
    approval.getSheet.mockResolvedValue(null);

    const res = await runAutoStamp([row()]);

    expect(rolesWritten()).toEqual(['prepared', 'checked', 'approved']);
    expect(approval.signUpsert.mock.calls[0][0]).toMatchObject({
      role: 'prepared', source: 'auto', em_id: 'E1', signer_name: 'Alice', created_by: 'AUTO_STAMP',
    });
    expect(res).toMatchObject({ ok: true, sheetsChanged: 1, rolesWritten: 3 });
    expect(res.stamped[0]).toMatchObject({ cn: 'C25-00241', roles: ['prepared', 'checked', 'approved'] });
  });

  it('leaves an already-signed role alone and fills the rest', async () => {
    mockConfig();
    approval.getSheet.mockResolvedValue({ prepared: 'E7' });   // prepared already signed by a person
    await runAutoStamp([row()]);
    expect(rolesWritten()).toEqual(['checked', 'approved']);
  });

  it('stops at the first role with no configured signer — never skips ahead', async () => {
    mockConfig({ checked_em_id: null, checked_name: null });
    approval.getSheet.mockResolvedValue(null);
    const res = await runAutoStamp([row()]);
    expect(rolesWritten()).toEqual(['prepared']);            // NOT approved
    expect(res.rolesWritten).toBe(1);
    expect(res.skipped).toEqual([]);
  });

  it('moves the board card to the last role written', async () => {
    mockConfig();
    approval.getSheet.mockResolvedValue(null);
    await runAutoStamp([row()]);
    await new Promise((r) => setImmediate(r));               // let the fire-and-forget syncCard resolve
    expect(kanbanIntake.syncCard).toHaveBeenCalledWith(expect.objectContaining({
      sourceType: 'sds_approval', stageKey: 'approved', sourceRef: 'C25-00241||MSG-410||1021',
    }));
  });
});

describe('runAutoStamp — scope', () => {
  it('only touches signature-only NO_STAMP rows', async () => {
    mockConfig();
    const res = await runAutoStamp([
      row({ pending_reason: 'NO_TOOL' }),
      row({ limit_excluded: true }),
      row({ machine_type_name: null }),
    ]);
    expect(res.candidates).toBe(0);
    expect(approval.signUpsert).not.toHaveBeenCalled();
  });

  it('aborts rather than mass-stamp past max_per_run', async () => {
    mockConfig({ max_per_run: 2 });
    const many = [row({ cn: 'C25-1' }), row({ cn: 'C25-2' }), row({ cn: 'C25-3' })];
    const res = await runAutoStamp(many);
    expect(res).toMatchObject({ ok: false, reason: 'too_many_candidates' });
    expect(approval.signUpsert).not.toHaveBeenCalled();
  });
});

describe('runAutoStamp — resilience', () => {
  it('catches a per-sheet failure and still processes the rest', async () => {
    mockConfig();
    approval.getSheet.mockResolvedValue(null);
    approval.resolveSdsRev.mockImplementation(async (cn) => {
      if (cn === 'C25-2') throw new Error('maqdb gone');
      return 'A';
    });
    const res = await runAutoStamp([row({ cn: 'C25-1' }), row({ cn: 'C25-2' })]);
    expect(res.ok).toBe(true);
    expect(res.sheetsChanged).toBe(1);
    expect(res.errors).toEqual([{ cn: 'C25-2', error: 'maqdb gone' }]);
  });

  it('never throws when the config read itself fails', async () => {
    engPool.query.mockRejectedValue(new Error('engPool down'));
    const res = await runAutoStamp([row()]);
    expect(res).toMatchObject({ ok: false, reason: 'error' });
  });

  it('a board-sync failure does not unwind the signature', async () => {
    mockConfig();
    approval.getSheet.mockResolvedValue(null);
    kanbanIntake.syncCard.mockRejectedValue(new Error('board gone'));
    const res = await runAutoStamp([row()]);
    await new Promise((r) => setImmediate(r));
    expect(res.sheetsChanged).toBe(1);
    expect(res.rolesWritten).toBe(3);
  });

  it('dryRun reports what it would sign and writes nothing', async () => {
    mockConfig();
    approval.getSheet.mockResolvedValue(null);
    const res = await runAutoStamp([row()], { dryRun: true });
    expect(approval.signUpsert).not.toHaveBeenCalled();
    expect(res.dryRun).toBe(true);
    expect(res.stamped[0].roles).toEqual(['prepared', 'checked', 'approved']);
  });
});

describe('config helpers', () => {
  it('getConfig normalises the row into { enabled, max_per_run, explicit }', async () => {
    mockConfig({ approved_em_id: null, approved_name: null });
    const c = await getConfig();
    expect(c.enabled).toBe(true);
    expect(c.explicit.prepared).toEqual({ em_id: 'E1', name: 'Alice' });
    expect(c.explicit.approved).toBeNull();
  });

  it('resolveConfig falls back to the single em_id permitted for a role, and names it from m_user_profile', async () => {
    mockConfig(
      { prepared_em_id: null, prepared_name: null, checked_em_id: null, checked_name: null,
        approved_em_id: null, approved_name: null },
      {
        roleCfgRows: [
          { role: 'prepared', match_value: 'LE485' },
          { role: 'prepared', match_value: 'LE403' },   // two → unresolved
          { role: 'checked', match_value: 'T1460' },    // one → resolved
        ],
        userRows: [{ u_code: 'T1460', u_name: 'Nong Q' }],
      },
    );
    const c = await resolveConfig();
    expect(c.signers.checked).toEqual({ em_id: 'T1460', name: 'Nong Q', from: 'role_config' });
    expect(c.signers.prepared).toBeNull();
    expect(c.signers.approved).toBeNull();
    expect(c.unresolved).toEqual(['prepared', 'approved']);
    expect(c.role_config_candidates.prepared).toEqual(['LE485', 'LE403']);
  });

  it('an explicit override beats the role-config fallback', async () => {
    mockConfig(
      { prepared_em_id: 'OVERRIDE', prepared_name: 'Boss', checked_em_id: null, checked_name: null },
      { roleCfgRows: [{ role: 'prepared', match_value: 'LE485' }, { role: 'checked', match_value: 'T1460' }],
        userRows: [{ u_code: 'T1460', u_name: 'Nong Q' }] },
    );
    const c = await resolveConfig();
    expect(c.signers.prepared).toEqual({ em_id: 'OVERRIDE', name: 'Boss', from: 'explicit' });
    expect(c.signers.checked).toMatchObject({ em_id: 'T1460', from: 'role_config' });
  });

  it('runAutoStamp uses a role-config-resolved signer', async () => {
    mockConfig(
      { prepared_em_id: null, prepared_name: null, checked_em_id: null, checked_name: null,
        approved_em_id: null, approved_name: null },
      {
        roleCfgRows: [
          { role: 'prepared', match_value: 'P9' },
          { role: 'checked', match_value: 'C9' },
          { role: 'approved', match_value: 'A9' },
        ],
        userRows: [{ u_code: 'P9', u_name: 'Pat' }, { u_code: 'C9', u_name: 'Cho' }, { u_code: 'A9', u_name: 'Ann' }],
      },
    );
    approval.getSheet.mockResolvedValue(null);
    await runAutoStamp([row()]);
    expect(approval.signUpsert.mock.calls.map((c) => [c[0].role, c[0].em_id, c[0].signer_name])).toEqual([
      ['prepared', 'P9', 'Pat'],
      ['checked', 'C9', 'Cho'],
      ['approved', 'A9', 'Ann'],
    ]);
  });

  it('setConfig writes only whitelisted columns and clears a signer on empty string', async () => {
    const calls = [];
    engPool.query.mockImplementation(async (sql, params) => { calls.push([sql, params]); return { rows: [{ id: 1 }] }; });

    await setConfig({ enabled: true, prepared_em_id: 'E9', approved_em_id: '', bogus: 'x' }, 'ADMIN1');

    const [sql, params] = calls.find(([s]) => /UPDATE sds_auto_stamp_config SET/.test(s));
    expect(sql).toContain('enabled = $1');
    expect(sql).not.toContain('bogus');
    const approvedIdx = Number(sql.match(/approved_em_id = \$(\d+)/)[1]) - 1;
    expect(params[approvedIdx]).toBeNull();               // '' → cleared
    expect(sql).toContain('updated_by = $');
    expect(params[params.length - 1]).toBe('ADMIN1');
  });
});
