'use strict';

/**
 * `sds_excel_mapping` — suppress the SHARED (machine_type_name IS NULL) mapping rows
 * for machines running the "Turning" template (X-100, XD-8, J-WAVE).
 * ------------------------------------------------------------------------------
 * Reported from a real render: X-100's SDS PDF showed doubled/garbled values —
 * "4TWHT7AVR1  4TWHT7AVR1" (PART NO twice), "414303  414303" (C/N twice), the
 * "PART NO:"/"C/N :"/"MACHINE NO. :" LABELS themselves overwritten, a T-Select DWG
 * number ("9901-09-0005") printed over the "Hand :" label, "CENTER"/"INVERSION JAW"
 * tool names bleeding into the cutting-tool block, and a "GRINDING AREA" string on a
 * lathe sheet. Root cause: `sds_excel_mapping` resolution is per CELL ADDRESS
 * (`sds_excel_mapping_machine_type_name_cell_address_key`), not per param_key — a
 * shared (NULL) row and a machine-specific row are DIFFERENT rows whenever their
 * addresses differ, so BOTH fire. `20260916_seed_turning_excel_mapping_v2.js` added
 * X-100/XD-8/J-WAVE-specific rows at the Turning layout's REAL addresses, but never
 * cancelled the 100+ shared rows still pointing at the Standard layout's addresses —
 * which this compact Turning layout reuses for completely different cells (a label,
 * a different tool's field, empty space).
 *
 * Fix: for each machine, add an override row at every SHARED address that is NOT
 * also valid in the Turning layout, pointing at the inert param_key `_suppressed` —
 * `valueMap['_suppressed']` and `params['_suppressed']` are never set, so the scalar
 * write loop's `if (val == null || val === '') continue;` skips it, and the cell
 * keeps whatever the Turning template itself designed there. A machine-specific row
 * at the SAME address as a shared one wins (`buildGridHtmlForRequest`'s query orders
 * `machine_type_name IS NULL` first, so the machine-specific row is applied last and
 * overwrites the shared param_key in the `merged` map for that address).
 *
 * KEPT, not suppressed: rev_1-5/ecn_no_1-5/date_1-5 (A9-13/B9-13/G9-13) — the ECN
 * history's first three columns happen to sit at the identical addresses in both
 * layouts, confirmed cell-by-cell against the Turning grid_json dump.
 *
 * Idempotent: deletes this machine's `_suppressed` rows first, then re-inserts from
 * the CURRENT shared list — safe to re-run if shared mappings change. `--revert`
 * removes them (the shared rows resume applying — do that ONLY if reverting the
 * whole Turning rollout for a machine, not as a partial fix).
 *
 * Run from apps/ENG-Backend/:
 *   node api/engineer/mtc/db_migrations/20260916b_suppress_shared_mapping_for_turning.js --machine="X-100" --machine="XD-8" --machine="J-WAVE" --dry-run
 *   node api/engineer/mtc/db_migrations/20260916b_suppress_shared_mapping_for_turning.js --machine="X-100" --machine="XD-8" --machine="J-WAVE"
 *   node api/engineer/mtc/db_migrations/20260916b_suppress_shared_mapping_for_turning.js --machine="X-100" --revert
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const TABLE = 'sds_excel_mapping';
const SUPPRESS_KEY = '_suppressed';
const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');
const MACHINES = process.argv
  .filter((a) => a.startsWith('--machine='))
  .map((a) => a.slice('--machine='.length).replace(/^"|"$/g, ''))
  .filter(Boolean);

// The only shared addresses that are ALSO correct in the Turning layout.
const KEEP_ADDRESSES = new Set([
  'A9', 'A10', 'A11', 'A12', 'A13',   // rev_1..5
  'B9', 'B10', 'B11', 'B12', 'B13',   // ecn_no_1..5
  'G9', 'G10', 'G11', 'G12', 'G13',   // date_1..5
]);

async function main() {
  if (!MACHINES.length) {
    console.error('[error] at least one --machine="<sds_machine_type_code.machine_type_name>" is required');
    process.exitCode = 1;
    return;
  }
  if (await guard({ file: __filename, revert, alwaysRerun: true })) return;

  const client = await engPool.connect();
  try {
    const shared = await client.query(
      `SELECT cell_address, param_key FROM ${TABLE} WHERE machine_type_name IS NULL`
    );
    const toSuppressBase = shared.rows.filter((r) => !KEEP_ADDRESSES.has(r.cell_address));

    if (revert) {
      await client.query('BEGIN');
      const del = await client.query(
        `DELETE FROM ${TABLE} WHERE machine_type_name = ANY($1) AND param_key = $2`,
        [MACHINES, SUPPRESS_KEY]
      );
      await client.query('COMMIT');
      console.log(`[revert] removed ${del.rowCount} suppression row(s) for machines: ${MACHINES.join(', ')}`);
      await recordRevert({ file: __filename });
      return;
    }

    console.log(`[seed] ${toSuppressBase.length} shared address(es) to consider x ${MACHINES.length} machine(s)`);
    if (dryRun) {
      for (const r of toSuppressBase) console.log(`  ${r.cell_address.padEnd(6)} (was ${r.param_key})`);
      console.log('\n[seed] --dry-run — no changes written. machines:', MACHINES.join(', '));
      return;
    }

    await client.query('BEGIN');
    let totalDeleted = 0, totalInserted = 0;
    for (const machine of MACHINES) {
      const delRes = await client.query(
        `DELETE FROM ${TABLE} WHERE machine_type_name = $1 AND param_key = $2`,
        [machine, SUPPRESS_KEY]
      );
      totalDeleted += delRes.rowCount;
      // A shared address can coincide with an address this machine's OWN mapping
      // already uses for something real (confirmed live: X-100's `AP_5` cutting-tool
      // field and the shared `tool_name_T02` both land on R16) — the machine-specific
      // row there already wins over the shared one with no suppression needed, and
      // inserting a second row at that address would violate the (machine_type_name,
      // cell_address) unique constraint. Skip those.
      const ownRows = await client.query(
        `SELECT cell_address FROM ${TABLE} WHERE machine_type_name = $1 AND param_key != $2`,
        [machine, SUPPRESS_KEY]
      );
      const ownAddrs = new Set(ownRows.rows.map((r) => r.cell_address));
      const toSuppress = toSuppressBase.filter((r) => !ownAddrs.has(r.cell_address));
      const skipped = toSuppressBase.length - toSuppress.length;

      const COLS = 4;
      const placeholders = toSuppress.map((_, i) =>
        `($${i * COLS + 1},$${i * COLS + 2},$${i * COLS + 3},$${i * COLS + 4})`
      ).join(',');
      const values = toSuppress.flatMap((r) => [machine, r.cell_address, SUPPRESS_KEY, `suppresses shared '${r.param_key}' — not valid in the Turning layout`]);
      await client.query(
        `INSERT INTO ${TABLE} (machine_type_name, cell_address, param_key, description) VALUES ${placeholders}`,
        values
      );
      totalInserted += toSuppress.length;
      console.log(`  ${machine}: removed ${delRes.rowCount} old suppression row(s), inserted ${toSuppress.length}${skipped ? ` (skipped ${skipped} already owned by this machine's own mapping)` : ''}`);
    }
    await client.query('COMMIT');
    console.log(`[seed] done — ${totalDeleted} old row(s) removed, ${totalInserted} new row(s) inserted`);
    await recordRun({ file: __filename });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw e;
  } finally {
    client.release();
    await engPool.end();
  }
}

main().catch((e) => { console.error('[seed] FAILED:', e.message); process.exit(1); });
