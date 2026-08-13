'use strict';

// The selection rule decides what lands on a shared board, so it is pinned here:
// NO_STAMP only, limit anomalies excluded, and never a row without a machine (its
// key could not match the one a signature would later produce).

jest.mock('../../instance/eng_db', () => ({ engPool: { query: jest.fn(), connect: jest.fn() } }));
jest.mock('../../api/engineer/mtc/utils/sdsBoardRef', () => ({
  boardRef: jest.fn(async (cn, m, p) => `${cn}||${m}||${p}`),
}));
jest.mock('../../api/engineer/mtc/services/kanbanIntake', () => ({ syncCard: jest.fn() }));

const kanbanIntake = require('../../api/engineer/mtc/services/kanbanIntake');
const { syncNoStampBacklog, selectNoStampRows, MAX_CARDS_PER_RUN } =
  require('../../api/engineer/mtc/services/sdsBacklogIntake');

const row = (over = {}) => ({
  cn: 'C25-00241', machine_type_name: 'MSG-410', process_code: '1021',
  pending_reason: 'NO_STAMP', tooling_source: 'saved', ...over,
});

afterEach(() => jest.clearAllMocks());

describe('selectNoStampRows', () => {
  it('takes NO_STAMP rows only', () => {
    const rows = [row(), row({ pending_reason: 'NO_TOOL' }), row({ pending_reason: 'NO_EXCEL' }),
      row({ pending_reason: 'NO_TOOL_NO_EXCEL' })];
    expect(selectNoStampRows(rows)).toHaveLength(1);
  });

  it('excludes limit anomalies — the sheet rests on contradictory data', () => {
    expect(selectNoStampRows([row({ limit_excluded: true })])).toEqual([]);
  });

  it('excludes rows with no machine, whose key could never match a signature', () => {
    expect(selectNoStampRows([row({ machine_type_name: null })])).toEqual([]);
  });

  it('handles a missing needsAttention array', () => {
    expect(selectNoStampRows()).toEqual([]);
  });
});

describe('syncNoStampBacklog', () => {
  it('seeds one createOnly card per row, with a deep link and no stage', async () => {
    kanbanIntake.syncCard.mockResolvedValue({ ok: true, action: 'created', cardId: 1 });

    const res = await syncNoStampBacklog([row(), row({ cn: 'C29-00205' })]);

    expect(res).toMatchObject({ ok: true, candidates: 2, created: 2, existing: 0, failed: 0 });
    const arg = kanbanIntake.syncCard.mock.calls[0][0];
    expect(arg.sourceType).toBe('sds_approval');
    expect(arg.sourceRef).toBe('C25-00241||MSG-410||1021');
    expect(arg.createOnly).toBe(true);
    expect(arg.stageKey).toBeNull();                 // → config default list (To Do)
    expect(arg.link.url).toContain('/eng/mtc_eng/sds-v2?cn=C25-00241');
    expect(arg.link.url).toContain('process=1021');
  });

  it('counts an already-carded sheet as existing, not created', async () => {
    kanbanIntake.syncCard.mockResolvedValue({ ok: true, action: 'noop', cardId: 1 });
    const res = await syncNoStampBacklog([row()]);
    expect(res).toMatchObject({ created: 0, existing: 1 });
  });

  it('refuses to flood the board past MAX_CARDS_PER_RUN', async () => {
    const many = Array.from({ length: MAX_CARDS_PER_RUN + 1 }, (_, i) => row({ cn: `C25-${i}` }));
    const res = await syncNoStampBacklog(many);
    expect(res).toMatchObject({ ok: false, reason: 'too_many_candidates', created: 0 });
    expect(kanbanIntake.syncCard).not.toHaveBeenCalled();
  });

  it('dryRun writes nothing but reports the keys it would use', async () => {
    const res = await syncNoStampBacklog([row()], { dryRun: true });
    expect(kanbanIntake.syncCard).not.toHaveBeenCalled();
    expect(res.rows).toEqual([expect.objectContaining({ sourceRef: 'C25-00241||MSG-410||1021' })]);
  });

  it('never throws — a board problem must not fail the coverage build', async () => {
    kanbanIntake.syncCard.mockRejectedValue(new Error('board gone'));
    const res = await syncNoStampBacklog([row()]);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('error');
  });

  it('tallies a failed card without aborting the rest', async () => {
    kanbanIntake.syncCard
      .mockResolvedValueOnce({ ok: false, reason: 'disabled' })
      .mockResolvedValueOnce({ ok: true, action: 'created', cardId: 2 });
    const res = await syncNoStampBacklog([row(), row({ cn: 'C29-00205' })]);
    expect(res).toMatchObject({ ok: true, failed: 1, created: 1 });
  });
});
