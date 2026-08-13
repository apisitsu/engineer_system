'use strict';

/**
 * Coverage report → Project Board backlog.
 *
 * The board only ever knew about a sheet once someone had already signed it, so
 * the work that most needs chasing — printable sheets nobody has signed yet —
 * was invisible on it. This seeds those into the board's first list.
 *
 * Scope is deliberately narrow: `pending_reason === 'NO_STAMP'` means the sheet
 * is tool- and config-complete and the ONLY thing missing is the signature, so a
 * card is a real, actionable task. The other pending reasons (NO_TOOL, NO_EXCEL,
 * NO_TOOL_NO_EXCEL) are configuration gaps, not sign-offs, and would bury the
 * board — 256 rows against 38 at the time of writing.
 *
 * `limit_excluded` rows are skipped. Those are the red "limit anomaly" badge: the
 * part was produced on a machine whose Tooling Select size limit says it cannot
 * physically run there, so either the limit or the production record is wrong.
 * Asking someone to sign a sheet built on contradictory data is not a task.
 *
 * Every card is seeded with `createOnly`, so re-running the report never drags a
 * sheet that has since been signed back into the first list.
 */

const kanbanIntake = require('./kanbanIntake');
const { boardRef } = require('../utils/sdsBoardRef');

const SDS_SOURCE = 'sds_approval';

// Guardrail: a run this large means the report changed shape or the scope config
// widened, not that 300 sheets genuinely need signing. Refuse rather than flood a
// shared board with cards someone then has to delete by hand.
const MAX_CARDS_PER_RUN = 150;

const SDS_PAGE_PATH = '/eng/mtc_eng/sds-v2';
// NB: the process-code argument must NOT be named `process` — it would shadow the
// Node global and `process.env` below would throw.
const signPageUrl = (cn, machine, processCode) => {
  const base = (process.env.FRONTEND_BASE_URL || '').replace(/\/+$/, '');
  const qs = new URLSearchParams({ cn, machine, process: String(processCode ?? '') });
  return `${base}${SDS_PAGE_PATH}?${qs}`;
};

/** The rows a card should exist for. Exported so the rule is unit-testable. */
function selectNoStampRows(needsAttention = []) {
  return needsAttention.filter(
    (r) => r.pending_reason === 'NO_STAMP' && !r.limit_excluded && r.machine_type_name
  );
}

/**
 * Seed one board card per unsigned-but-printable sheet.
 *
 * Never throws — this runs off the back of the coverage build, which must not
 * fail because a board is misconfigured.
 *
 * @param {object[]} needsAttention  the report's needsAttention array
 * @param {object}   [opts]
 * @param {object}   [opts.io]       socket.io instance for realtime board updates
 * @param {boolean}  [opts.dryRun]   report what would happen, write nothing
 * @returns {Promise<{ok:boolean, candidates:number, created:number, existing:number, failed:number, reason?:string, rows?:object[]}>}
 */
async function syncNoStampBacklog(needsAttention, opts = {}) {
  const { io, dryRun = false } = opts;
  const summary = { ok: true, candidates: 0, created: 0, existing: 0, failed: 0 };

  try {
    const rows = selectNoStampRows(needsAttention);
    summary.candidates = rows.length;
    if (!rows.length) return summary;

    if (rows.length > MAX_CARDS_PER_RUN) {
      console.warn(`[sdsBacklog] ${rows.length} candidates exceeds MAX_CARDS_PER_RUN (${MAX_CARDS_PER_RUN}) — skipped`);
      return { ...summary, ok: false, reason: 'too_many_candidates' };
    }

    if (dryRun) {
      return {
        ...summary,
        rows: await Promise.all(rows.map(async (r) => ({
          cn: r.cn,
          machine_type_name: r.machine_type_name,
          process_code: r.process_code,
          tooling_source: r.tooling_source,
          sourceRef: await boardRef(r.cn, r.machine_type_name, r.process_code),
        }))),
      };
    }

    // Sequential: syncCard takes a pooled client per call, and this runs in the
    // background off a cache rebuild — there is nothing to be gained by racing
    // the pool against whatever request traffic is live.
    for (const r of rows) {
      const ref = await boardRef(r.cn, r.machine_type_name, r.process_code);
      const res = await kanbanIntake.syncCard({
        io,
        sourceType: SDS_SOURCE,
        sourceRef: ref,
        // No stageKey → the config's default_list_id, i.e. the board's first list.
        stageKey: null,
        createOnly: true,
        name: `SDS ${r.cn} · ${r.machine_type_name} · ${r.process_code}`,
        description:
          `Awaiting signature — PDF-ready, no stamp yet.\n` +
          `Tool source: ${r.tooling_source || 'unknown'}. Detected by the SDS coverage report.`,
        link: {
          url: signPageUrl(r.cn, r.machine_type_name, r.process_code),
          name: `Open SDS ${r.cn} — sign`,
        },
      });
      if (!res.ok) summary.failed += 1;
      else if (res.action === 'created') summary.created += 1;
      else summary.existing += 1;
    }

    if (summary.created) {
      console.log(`[sdsBacklog] seeded ${summary.created} NO_STAMP card(s) (${summary.existing} already on the board)`);
    }
    return summary;
  } catch (err) {
    console.warn('[sdsBacklog] sync skipped:', err.message);
    return { ...summary, ok: false, reason: 'error', error: err.message };
  }
}

module.exports = { syncNoStampBacklog, selectNoStampRows, MAX_CARDS_PER_RUN };
