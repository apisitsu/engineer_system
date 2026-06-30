'use strict';

// Pins the SDS coverage-level rules that the 2026-06 stamp-gating change introduced:
// COMPLETE now requires a FULL approval stamp, and a PDF-ready-but-unsigned sheet
// stays PENDING with reason NO_STAMP. classifyCoverage is the pure extraction of
// that decision (no DB), so these run without any pool.

const { classifyCoverage } = require('../../api/engineer/mtc/controllers/sdsV2ReportController');

// Minimal sheet factory — every flag defaults to the "happy path" so each test
// overrides only the dimension it exercises.
const sheet = (over = {}) => ({
  has_tooling_match: true,
  has_machine_template: true,
  has_process: true,
  stamped_full: true,
  tooling_source: 'saved',
  ...over,
});

describe('classifyCoverage — COMPLETE / PENDING / NO_STAMP rules', () => {
  it('tool + excel + full stamp → COMPLETE, no pending reason', () => {
    const r = classifyCoverage(sheet());
    expect(r.coverage_level).toBe('COMPLETE');
    expect(r.coverage_level_saved).toBe('COMPLETE');
    expect(r.pending_reason).toBeNull();
  });

  it('PDF-ready but UNSIGNED → PENDING with reason NO_STAMP (the regression guard)', () => {
    const r = classifyCoverage(sheet({ stamped_full: false }));
    expect(r.coverage_level).toBe('PENDING');
    expect(r.pending_reason).toBe('NO_STAMP');
  });

  it('missing Excel template → PENDING NO_EXCEL (takes precedence over stamp)', () => {
    const r = classifyCoverage(sheet({ has_machine_template: false, stamped_full: false }));
    expect(r.coverage_level).toBe('PENDING');
    expect(r.pending_reason).toBe('NO_EXCEL');
  });

  it('missing tool → PENDING NO_TOOL', () => {
    const r = classifyCoverage(sheet({ has_tooling_match: false }));
    expect(r.pending_reason).toBe('NO_TOOL');
  });

  it('missing tool AND excel → PENDING NO_TOOL_NO_EXCEL', () => {
    const r = classifyCoverage(sheet({ has_tooling_match: false, has_machine_template: false }));
    expect(r.pending_reason).toBe('NO_TOOL_NO_EXCEL');
  });

  it('no process at all → MISSING (not PENDING)', () => {
    const r = classifyCoverage(sheet({ has_process: false, has_tooling_match: false, has_machine_template: false, stamped_full: false }));
    expect(r.coverage_level).toBe('MISSING');
    expect(r.pending_reason).toBeNull();
  });

  it('baseline coverage_level_saved is also stamp-gated (signed T-Select #1 row)', () => {
    // tselect tool, fully signed: COMPLETE overall, but the saved-only baseline is
    // still PENDING — so complete − complete_saved isolates the T-Select #1 boost.
    const r = classifyCoverage(sheet({ tooling_source: 'tselect' }));
    expect(r.coverage_level).toBe('COMPLETE');
    expect(r.coverage_level_saved).toBe('PENDING');
  });
});
