'use strict';

/**
 * Backfills `receive_date` on the 4 remaining `pbring_tooling` rows (of the
 * 34 left after `20261006_pbring_backfill_received_date_from_maqdb.js`) whose
 * po_no doesn't exist in `lpb.pc_material_purchase` at all, but IS tracked in
 * the standalone prototype's own source workbook — "PCdata" sheet of
 * `Tooling status for all of PB Ring Parts.xlsx` (outside this repo, a
 * sibling project — see PBRING_IMPORT_DIR in the earlier import migration).
 * That sheet has its own `PO NO.` / `Receive Date` columns, independent of
 * maqdb.
 *
 * Checked all 34: only 4 rows (po_no IC00202, IC00204, RD00032×2) have a
 * non-blank Receive Date there; the other 30 are either absent from PCdata
 * entirely or present with Receive Date itself blank — there was nothing to
 * recover for those, so they're left alone.
 *
 * Values are hardcoded here (not read from the workbook at migration-run
 * time) — same reasoning as the ti_list precedent's hardcoded revert ids:
 * the source file lives outside this repo and isn't guaranteed to exist on
 * every host this migration might run on (plbmp130 in particular), so once
 * the 4 values are verified once, baking them in is more portable than
 * adding a runtime dependency on that workbook's path for 4 rows.
 *
 * PCdata's "Receive Date" is dd/mm/yyyy (unambiguous here — 26/01/2026 and
 * 14/07/2025 both have a day > 12).
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');

const FILLS = [
  { id: 801, po_no: 'IC00202', receive_date: '2026-01-26' },
  { id: 933, po_no: 'IC00204', receive_date: '2026-01-26' },
  { id: 800, po_no: 'RD00032', receive_date: '2025-07-14' },
  { id: 932, po_no: 'RD00032', receive_date: '2025-07-14' },
];

async function main() {
  if (await guard({ file: __filename, revert })) return;

  const ids = FILLS.map((f) => f.id);

  if (revert) {
    await engPool.query(`UPDATE pbring_tooling SET receive_date = NULL WHERE id = ANY($1)`, [ids]);
    console.log(`Reverted ${ids.length} row(s).`);
    await recordRevert({ file: __filename });
    return;
  }

  for (const f of FILLS) {
    const { rowCount } = await engPool.query(
      `UPDATE pbring_tooling SET receive_date = $1, updated_at = now()
        WHERE id = $2 AND status = 'Received' AND receive_date IS NULL`,
      [f.receive_date, f.id]
    );
    console.log(`id ${f.id} (po_no ${f.po_no}) -> receive_date = ${f.receive_date} (${rowCount ? 'filled' : 'skipped, no longer matches'})`);
  }

  await recordRun({ file: __filename });
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
