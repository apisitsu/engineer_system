'use strict';

/**
 * Reverts a batch of 41 `pbring_cost_pending` approvals the user made
 * 2026-10-06 03:39-04:13 (decided_by LE485) and then asked to undo — they
 * approved faster than intended and wanted the detected cost data pulled
 * back out so each row can be reviewed again.
 *
 * `pbring_tooling` has no audit trail (approve overwrites po_no/price/qty/
 * receive_date/status directly, nothing records the prior value), so this
 * is a best-effort revert, not a guaranteed exact one:
 *   - po_no: safe to null out — every one of these rows reached the
 *     "Cost Update Found" candidate pool in the first place because po_no
 *     was already NULL/blank (detectMissingCost()'s own filter), so that
 *     part of the "before" state is certain.
 *   - unit_price / order_qty / total_price / receive_date: approve() always
 *     overwrote these from the detected values, so there's no way to tell
 *     whether a row had something manually entered first — nulling them out
 *     matches what every other still-pending candidate row looks like today
 *     (verified live: pending candidates are null across all four, not 0),
 *     so this is the best available guess, not a certainty.
 *   - status: 40 of the 41 had it force-set to 'Received' (because
 *     detected_receive_date was present); what it was before that is lost
 *     entirely. Per explicit instruction, status is NOT touched by this
 *     revert — it stays 'Received' rather than guessing at a prior value.
 *   - cost_source: reset to 'manual' (the column's own NOT NULL default) —
 *     not NULL, which the column rejects.
 *
 * The 41 `pbring_cost_pending` rows go back to status='pending' (decided_by/
 * decided_at cleared) so they reappear as "Cost Update Found" candidates for
 * review, instead of staying marked 'approved' with nothing to show for it.
 *
 * Ids are hardcoded (captured from the live state right before this ran) —
 * same reasoning as the other same-day pbring backfill migrations: a WHERE
 * re-query at --revert time could pick up unrelated rows that reach the same
 * state some other way later.
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');

// [pending_id, tooling_id] pairs — the 41 approved 2026-10-06 03:39-04:13 by
// LE485. Queried directly from pbring_cost_pending right before this ran
// (`SELECT cp.id, cp.tooling_id FROM pbring_cost_pending cp WHERE status=
// 'approved' AND decided_at >= '2026-10-06 03:00:00+00'`) — not a guessed
// sequence; the ids are not contiguous.
const BATCH = [
  [2, 85], [6, 86], [7, 93], [8, 97], [9, 98], [10, 100], [11, 101], [12, 114],
  [13, 326], [14, 327], [15, 328], [16, 331], [17, 342], [18, 343], [19, 344],
  [20, 347], [21, 366], [22, 412], [23, 840], [24, 876], [25, 929], [26, 1019],
  [27, 1122], [28, 1214], [29, 1215], [30, 1216], [31, 1217], [32, 1218],
  [33, 1219], [34, 1220], [35, 1221], [36, 1222], [37, 1224], [38, 1225],
  [39, 1226], [40, 1228], [41, 1230], [42, 1231], [114, 973], [115, 1055],
  [116, 1272],
];

async function main() {
  if (await guard({ file: __filename, revert })) return;

  const pendingIds = BATCH.map((b) => b[0]);
  const toolingIds = BATCH.map((b) => b[1]);

  if (revert) {
    // Undo-the-undo: not expected to be used, but if it is, there's nothing
    // to restore the cleared fields TO (same reason this migration exists in
    // the first place) — so this just re-marks the pending rows 'approved'
    // again and leaves pbring_tooling as this migration left it.
    await engPool.query(
      `UPDATE pbring_cost_pending SET status = 'approved' WHERE id = ANY($1)`,
      [pendingIds]
    );
    console.log(`Reverted: ${pendingIds.length} pending row(s) marked 'approved' again (pbring_tooling fields NOT restored — no prior values were recoverable).`);
    await recordRevert({ file: __filename });
    return;
  }

  const { rowCount: toolingUpdated } = await engPool.query(
    `UPDATE pbring_tooling SET
       po_no = NULL, unit_price = NULL, order_qty = NULL, total_price = NULL, receive_date = NULL,
       cost_source = 'manual', cost_approved_by = NULL, cost_updated_at = NULL, updated_at = now()
     WHERE id = ANY($1)`,
    [toolingIds]
  );
  const { rowCount: pendingUpdated } = await engPool.query(
    `UPDATE pbring_cost_pending SET status = 'pending', decided_by = NULL, decided_at = NULL
      WHERE id = ANY($1)`,
    [pendingIds]
  );
  console.log(`pbring_tooling rows cleared: ${toolingUpdated} | pbring_cost_pending rows reset to pending: ${pendingUpdated}`);

  await recordRun({ file: __filename });
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
