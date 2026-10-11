'use strict';

/**
 * pbringAutoStamp.js — Auto Stamp for PB Ring sheets.
 *
 * Mirrors the real sdsAutoStamp.js (sds_auto_stamp_config, run off the back
 * of every coverage build, same NO_STAMP selection, same fail-open
 * discipline, same MAX_PER_RUN guardrail) but writes ONLY to
 * pbring_sds_approval, gated by pbring_auto_stamp_config — never the real
 * sds_approval / sds_auto_stamp_config. Same reason pbring_sds_approval
 * exists as its own table at all: several PB Ring machine codes share
 * their real display name with an already-registered SDS machine, and an
 * auto-signer must never stamp a real production sheet nobody reviewed.
 *
 * ONE global toggle gates the whole thing: pbring_auto_stamp_config.enabled
 * (default false). With it off, runAutoStamp is a no-op.
 *
 * Called from sdsV2ReportController.kickCoverageBuild() alongside the real
 * sdsAutoStamp — same cadence, same trigger point — but entirely
 * independent of whether the real build succeeded: PB Ring's own data
 * availability has nothing to do with the real coverage build's health.
 */

const { buildPbRingCoverageRows } = require('./pbringCoverageService');
const {
  getPbRingAutoStampConfig, getPbRingApproval, signPbRingApproval, syncPbRingApprovalBoardCard,
} = require('./pbringGridService');

const ROLE_ORDER = ['prepared', 'checked', 'approved'];

/**
 * @param {(r) => {coverage_level, pending_reason}} classifyCoverage  passed
 *   in rather than required, so this module never needs to require() the
 *   report controller back (same pattern pbringCoverageService.js uses).
 * @param {object} [opts]
 * @param {object} [opts.io]      socket.io instance (realtime board updates)
 * @param {boolean} [opts.dryRun] evaluate + report, write nothing
 * @returns {Promise<object>} summary — never throws
 */
async function runAutoStamp(classifyCoverage, opts = {}) {
  const { io = null, dryRun = false } = opts;
  const summary = { ok: true, enabled: false, dryRun, candidates: 0, sheetsChanged: 0, rolesWritten: 0, stamped: [], skipped: [], errors: [] };

  try {
    const cfg = await getPbRingAutoStampConfig();
    summary.enabled = cfg.enabled;
    if (!cfg.enabled) return { ...summary, reason: 'disabled' };

    const pbRows = await buildPbRingCoverageRows(classifyCoverage);
    // Exactly what the real NO_STAMP backlog means: tool + template ready,
    // the signature the only thing missing.
    const rows = pbRows.filter((r) => r.pending_reason === 'NO_STAMP');
    summary.candidates = rows.length;
    if (!rows.length) return summary;

    if (rows.length > cfg.max_per_run) {
      console.warn(`[pbringAutoStamp] ${rows.length} candidates exceeds max_per_run (${cfg.max_per_run}) — skipped`);
      return { ...summary, ok: false, reason: 'too_many_candidates' };
    }

    for (const r of rows) {
      // pbringCoverageService's row shape aliases `cn`/`machine_type_name`
      // to the CONTROL-NO / DISPLAY forms (to match the real report's own
      // dedup key) — every pbring_* table, including pbring_sds_approval,
      // keys on item-no cn + mc_key instead, carried separately as
      // `_pbRingCn`/`_pbRingKey`. Using the display forms here was two
      // separate live bugs caught in the same test run: a FK violation on
      // machine_type_name (pbring_machine_type has no row literally named
      // "QUICK TURN SMART 200M"), and — after fixing that — 491 rows
      // written under the WRONG cn format that the coverage query's own
      // approval join (keyed on item-no) could never match, so
      // stamped_full silently stayed false for all of them despite the
      // rows existing.
      const { _pbRingCn: cn, _pbRingKey: mcKey, process_code: processCode } = r;
      try {
        const sheet = await getPbRingApproval(cn, mcKey, processCode);
        const wrote = [];
        let lastRole = null;
        for (const role of ROLE_ORDER) {
          if (sheet && sheet[`${role}_em_id`]) continue; // already signed (any source) — keep going
          const person = cfg[role];
          if (!person) break; // no responsible person configured → stop here, never skip ahead
          if (!dryRun) {
            await signPbRingApproval(cn, mcKey, processCode, role, person.em_id, person.name, 'auto');
          }
          wrote.push(role);
          lastRole = role;
        }

        if (!wrote.length) {
          const blockedRole = ROLE_ORDER.find((role) => !(sheet && sheet[`${role}_em_id`]));
          summary.skipped.push({ cn, machine_type_name: mcKey, process_code: processCode, reason: blockedRole ? `no_signer:${blockedRole}` : 'already_complete' });
          continue;
        }

        summary.sheetsChanged += 1;
        summary.rolesWritten += wrote.length;
        summary.stamped.push({ cn, machine_type_name: mcKey, process_code: processCode, roles: wrote });

        if (!dryRun && lastRole) {
          const person = cfg[lastRole];
          await syncPbRingApprovalBoardCard({ io, cn, machineTypeName: mcKey, processCode, role: lastRole, signerName: person.name });
        }
      } catch (e) {
        summary.errors.push({ cn, machine_type_name: mcKey, process_code: processCode, error: e.message });
      }
    }

    return summary;
  } catch (e) {
    console.warn('[pbringAutoStamp] run failed:', e.message);
    return { ...summary, ok: false, reason: e.message };
  }
}

module.exports = { runAutoStamp };
